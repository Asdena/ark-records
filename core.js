export const FIELDS = [
  "name",
  "nickname",
  "relationship",
  "phone",
  "email",
  "address",
  "birthday",
  "occupation",
  "organization",
  "school",
  "likes",
  "dislikes",
  "hobbies",
  "interests",
  "tags",
  "notes",
];
export const normalize = (s) =>
  String(s ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .trim();
export const words = (s) =>
  String(s || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
export function emptyPerson() {
  return {
    id: crypto.randomUUID(),
    ...Object.fromEntries(FIELDS.map((k) => [k, ""])),
    socials: [],
    memories: [],
    media: [],
    profilePhoto: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
export function validatePerson(p) {
  if (
    !p ||
    typeof p !== "object" ||
    !/^[a-f0-9-]{36}$/i.test(p.id || "") ||
    typeof p.name !== "string" ||
    !p.name.trim()
  )
    throw Error("invalidData");
  for (const k of FIELDS)
    if (typeof p[k] !== "string" || p[k].length > 50000)
      throw Error("invalidData");
  for (const key of ["socials", "memories", "media"])
    if (!Array.isArray(p[key]) || p[key].length > 1000)
      throw Error("invalidData");
  if (
    typeof p.createdAt !== "string" ||
    !Number.isFinite(Date.parse(p.createdAt)) ||
    typeof p.updatedAt !== "string" ||
    !Number.isFinite(Date.parse(p.updatedAt))
  )
    throw Error("invalidData");
  for (const s of p.socials)
    if (
      !["platform", "username", "url"].every(
        (k) => typeof s[k] === "string" && s[k].length < 3000,
      ) ||
      (s.url && !safeUrl(s.url))
    )
      throw Error("invalidLink");
  for (const m of p.memories)
    if (
      !["title", "date", "location", "description"].every(
        (k) => typeof m[k] === "string" && m[k].length < 50000,
      )
    )
      throw Error("invalidData");
  for (const m of p.media)
    if (
      !/^[\w-]+$/.test(m.id || "") ||
      !allowedMedia(m.type) ||
      (m.thumbnail !== undefined && !/^[\w-]+$/.test(m.thumbnail)) ||
      typeof m.caption !== "string" ||
      typeof m.name !== "string" ||
      !Number.isFinite(m.size) ||
      m.size < 0 ||
      m.size > MAX_MEDIA
    )
      throw Error("invalidMedia");
  if (
    typeof p.profilePhoto !== "string" ||
    (p.profilePhoto &&
      !p.media.some(
        (m) => m.id === p.profilePhoto && m.type.startsWith("image/"),
      ))
  )
    throw Error("invalidMedia");
  return p;
}
export const MAX_MEDIA = 50 * 1024 * 1024;
export const MAX_BACKUP = 100 * 1024 * 1024;
export const allowedMedia = (type) =>
  [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "video/mp4",
    "video/webm",
    "video/quicktime",
  ].includes(type);
export function safeUrl(s) {
  try {
    const u = new URL(s);
    return ["http:", "https:"].includes(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
}
export function search(people, q) {
  const n = normalize(q);
  return people.filter((p) =>
    normalize(
      [
        ...FIELDS.map((k) => p[k]),
        ...p.socials.flatMap((s) => [s.platform, s.username]),
        ...p.memories.flatMap((m) => [m.title, m.description, m.location]),
      ].join(" "),
    ).includes(n),
  );
}
export function ask(people, input) {
  const q = normalize(input).replace(/[?.!]+$/, "");
  let m,
    intent = "person",
    term = q,
    platform = "";
  const rules = [
    [/^(?:who likes|siapa (?:yang )?suka) (.+)$/, "likes"],
    [/^(?:who dislikes|siapa (?:yang )?tidak suka) (.+)$/, "dislikes"],
    [/^(?:who works at|siapa (?:yang )?bekerja di) (.+)$/, "organization"],
    [/^(?:people from|orang dari) (.+)$/, "school"],
    [/^(?:tag|tagged|orang dengan tag) (.+)$/, "tags"],
    [/^(?:relationship|hubungan) (.+)$/, "relationship"],
    [/^(?:who is|siapa) (.+)$/, "person"],
  ];
  for (const [re, key] of rules)
    if ((m = q.match(re))) {
      intent = key;
      term = m[1];
      break;
    }
  if (
    (m = q.match(
      /^(?:what does (.+) (like|dislike)|apa yang (disukai|tidak disukai) (.+))$/,
    ))
  ) {
    return {
      intent:
        m[2] === "dislike" || m[3] === "tidak disukai"
          ? "getDislikes"
          : "getLikes",
      people: findPerson(people, m[1] || m[4]),
    };
  }
  if (
    (m = q.match(
      /^show (.+?)(?:'s|’s) (instagram|facebook|x|tiktok|linkedin|youtube|telegram|whatsapp|photos|videos)$/,
    )) ||
    (m = q.match(
      /^tampilkan (instagram|facebook|x|tiktok|linkedin|youtube|telegram|whatsapp|foto|video) (.+)$/,
    ))
  ) {
    const indo = q.startsWith("tampilkan ");
    term = indo ? m[2] : m[1];
    platform = indo ? m[1] : m[2];
    intent = /^(photos|foto)$/.test(platform)
      ? "photos"
      : /^(videos|video)$/.test(platform)
        ? "videos"
        : "social";
    return { intent, platform, people: findPerson(people, term) };
  }
  if (intent === "person") return { intent, people: search(people, term) };
  // ponytail: deterministic phrases and a small explicit synonym table; no semantic AI.
  const synonyms = {
    coffee: ["coffee", "kopi"],
    kopi: ["coffee", "kopi"],
    university: ["university", "universitas"],
    universitas: ["university", "universitas"],
  };
  const terms = synonyms[term] || [term];
  return {
    intent,
    people: people.filter((p) =>
      terms.some((t) => normalize(p[intent]).includes(t)),
    ),
  };
}
function findPerson(people, q) {
  const exact = people.filter((p) =>
    [p.name, p.nickname].some((n) => normalize(n) === normalize(q)),
  );
  return exact.length
    ? exact
    : people.filter((p) =>
        normalize(p.name + " " + p.nickname).includes(normalize(q)),
      );
}
// Immutable revisions avoid silent last-write-wins when two devices save concurrently.
export function resolveRevisions(revisions) {
  const grouped = new Map();
  for (const r of revisions) {
    if (
      !r ||
      r.schema !== 1 ||
      typeof r.rev !== "string" ||
      !Array.isArray(r.parents) ||
      !r.parents.every((v) => typeof v === "string") ||
      typeof r.deleted !== "boolean"
    )
      throw Error("invalidData");
    validatePerson(r.person);
    const a = grouped.get(r.person.id) || [];
    a.push(r);
    grouped.set(r.person.id, a);
  }
  return [...grouped.values()].map((all) => {
    const parents = new Set(all.flatMap((r) => r.parents));
    const heads = all.filter((r) => !parents.has(r.rev));
    if (!heads.length) throw Error("invalidData");
    return {
      heads,
      record: heads.toSorted((a, b) =>
        b.person.updatedAt.localeCompare(a.person.updatedAt),
      )[0],
    };
  });
}
export function validateBackup(b) {
  if (
    b?.format !== "ARK-WEB-BACKUP" ||
    b.version !== 1 ||
    !Array.isArray(b.people) ||
    !Array.isArray(b.media) ||
    b.people.length > 10000
  )
    throw Error("invalidBackup");
  const ids = new Set();
  for (const p of b.people) {
    validatePerson(p);
    if (ids.has(p.id)) throw Error("invalidBackup");
    ids.add(p.id);
  }
  const media = new Map();
  for (const m of b.media) {
    if (
      !m ||
      typeof m.id !== "string" ||
      media.has(m.id) ||
      typeof m.data !== "string" ||
      !allowedMedia(m.type) ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(m.data)
    )
      throw Error("invalidBackup");
    media.set(m.id, m);
  }
  for (const p of b.people)
    for (const m of p.media) {
      const f = media.get(m.id);
      if (!f || f.type !== m.type) throw Error("invalidBackup");
    }
  return b;
}
