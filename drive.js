import {
  resolveRevisions,
  validatePerson,
  MAX_MEDIA,
  allowedMedia,
  emptyPerson,
} from "./core.js";
const API = "https://www.googleapis.com/drive/v3/";
export const SCOPE = "https://www.googleapis.com/auth/drive.appdata";
export class Drive {
  constructor(fetcher = globalThis.fetch.bind(globalThis)) {
    this.fetcher = fetcher;
    this.token = "";
    this.entries = [];
    this.files = [];
    this.cache = new Map();
    this.generation = 0;
  }
  clear() {
    this.generation++;
    this.token = "";
    this.entries = [];
    this.files = [];
    for (const u of this.cache.values()) URL.revokeObjectURL(u);
    this.cache.clear();
  }
  async request(path, options = {}) {
    if (!this.token) throw Error("signInAgain");
    let response;
    try {
      response = await this.fetcher(
        path.startsWith("https://") ? path : API + path,
        {
          ...options,
          headers: {
            ...options.headers,
            Authorization: `Bearer ${this.token}`,
          },
          cache: "no-store",
        },
      );
    } catch {
      throw Error("networkError");
    }
    if (!response.ok) {
      if (response.status === 401) {
        this.token = "";
        throw Error("signInAgain");
      }
      if (response.status === 403) throw Error("permissionError");
      if (response.status === 404) throw Error("missingMedia");
      throw Error(response.status === 429 ? "rateLimit" : "driveError");
    }
    return response;
  }
  async list() {
    let out = [],
      page = "";
    do {
      const q = new URLSearchParams({
        spaces: "appDataFolder",
        q: "trashed = false",
        fields: "nextPageToken,files(id,name,mimeType,size,appProperties)",
        pageSize: "1000",
      });
      if (page) q.set("pageToken", page);
      const data = await (await this.request("files?" + q)).json();
      out.push(...data.files);
      page = data.nextPageToken;
    } while (page);
    this.files = out;
    return out;
  }
  async sync() {
    const files = await this.list();
    const revisions = [];
    // ponytail: loads compact person revisions in batches of 6; for large archives add an index.
    const records = files.filter((f) => f.appProperties?.ark === "record");
    for (let i = 0; i < records.length; i += 6)
      revisions.push(
        ...(await Promise.all(
          records.slice(i, i + 6).map(async (f) => {
            const r = await (
              await this.request(`files/${encodeURIComponent(f.id)}?alt=media`)
            ).json();
            return { ...r, fileId: f.id };
          }),
        )),
      );
    const entries = resolveRevisions(revisions);
    this.entries = entries;
    return entries;
  }
  async upload(blob, kind, name, extra = {}) {
    const ids = await (
      await this.request(
        "files/generateIds?count=1&space=appDataFolder&type=files",
      )
    ).json();
    const id = ids.ids[0];
    const meta = {
      id,
      name,
      parents: ["appDataFolder"],
      appProperties: { ark: kind, ...extra },
    };
    const boundary = "ark_" + crypto.randomUUID();
    const body = new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
      JSON.stringify(meta),
      `\r\n--${boundary}\r\nContent-Type: ${blob.type || "application/octet-stream"}\r\n\r\n`,
      blob,
      `\r\n--${boundary}--`,
    ]);
    // Probe the pre-generated ID if the upload response is lost; do not duplicate uploads.
    const send = () =>
      this.request(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
        {
          method: "POST",
          headers: {
            "Content-Type": `multipart/related; boundary=${boundary}`,
          },
          body,
        },
      );
    try {
      await send();
    } catch (e) {
      if (e.message !== "networkError") throw e;
      try {
        await this.request(`files/${id}?fields=id`);
      } catch {
        throw e;
      }
    }
    return id;
  }
  async save(person, parents, deleted = false) {
    validatePerson(person);
    await this.sync();
    const current = this.entries.find((e) => e.record.person.id === person.id);
    const heads = current?.heads.map((r) => r.rev) || [];
    if (
      heads.length !== parents.length ||
      heads.some((id) => !parents.includes(id))
    )
      throw Error("conflict");
    const revision = {
      schema: 1,
      rev: crypto.randomUUID(),
      parents,
      deleted,
      person: { ...person, updatedAt: new Date().toISOString() },
    };
    await this.upload(
      new Blob([JSON.stringify(revision)], { type: "application/json" }),
      "record",
      `person-${person.id}-${revision.rev}.json`,
    );
    await this.sync();
  }
  async addMedia(file, personId) {
    if (!allowedMedia(file.type) || file.size > MAX_MEDIA)
      throw Error("invalidMedia");
    const id = await this.upload(file, "media", crypto.randomUUID(), {
      person: personId,
    });
    return {
      id,
      type: file.type,
      name: file.name,
      caption: "",
      size: file.size,
    };
  }
  async blob(id) {
    if (!/^[\w-]+$/.test(id)) throw Error("invalidMedia");
    return (await this.request(`files/${id}?alt=media`)).blob();
  }
  async url(id) {
    if (!this.cache.has(id)) {
      const generation = this.generation;
      const blob = await this.blob(id);
      if (generation !== this.generation || !this.token)
        throw Error("signInAgain");
      this.cache.set(id, URL.createObjectURL(blob));
    }
    return this.cache.get(id);
  }
  async removeFile(id) {
    await this.request(`files/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (this.cache.has(id)) {
      URL.revokeObjectURL(this.cache.get(id));
      this.cache.delete(id);
    }
  }
  async deletePerson(person, parents) {
    const tombstone = {
      ...emptyPerson(),
      id: person.id,
      name: "[Deleted]",
      createdAt: person.createdAt,
    };
    await this.save(
      tombstone,
      parents,
      true,
    ); /* Keep tombstone and history: cleanup is a separate confirmed operation. */
  }
  async cleanup() {
    await this.sync();
    if (this.entries.some((e) => e.heads.length > 1)) throw Error("conflict");
    const keep = new Set(
      this.entries
        .filter((e) => !e.record.deleted)
        .flatMap((e) =>
          e.record.person.media.flatMap((m) =>
            [m.id, m.thumbnail].filter(Boolean),
          ),
        ),
    );
    const heads = new Set(
      this.entries.flatMap((e) => e.heads.map((r) => r.fileId)),
    );
    const dead = this.files.filter(
      (f) =>
        (f.appProperties?.ark === "media" && !keep.has(f.id)) ||
        (f.appProperties?.ark === "record" && !heads.has(f.id)),
    );
    for (const f of dead) await this.removeFile(f.id);
    await this.sync();
    return dead.length;
  }
}
