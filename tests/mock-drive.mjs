import assert from "node:assert/strict";
export function mockDrive() {
  let seq = 0;
  const files = new Map();
  const fetch = async (url, opt = {}) => {
    const u = new URL(url);
    assert.match(opt.headers.Authorization, /^Bearer /);
    const id = u.pathname.split("/").at(-1);
    const ok = (x) =>
      new Response(JSON.stringify(x), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    if (u.pathname.endsWith("/about"))
      return ok({ user: { permissionId: "owner" } });
    if (u.pathname.endsWith("generateIds"))
      return ok({ ids: ["file-" + ++seq] });
    if (u.pathname.includes("/upload/")) {
      const text = await opt.body.text();
      const boundary = opt.headers["Content-Type"].split("boundary=")[1];
      const parts = text.split("--" + boundary);
      const meta = JSON.parse(parts[1].split("\r\n\r\n")[1]);
      const body = parts[2].slice(parts[2].indexOf("\r\n\r\n") + 4, -2);
      files.set(meta.id, {
        ...meta,
        body,
        size: body.length,
        mimeType:
          meta.appProperties.ark === "record"
            ? "application/json"
            : "image/png",
      });
      return ok({ id: meta.id });
    }
    if (u.pathname.endsWith("/files"))
      return ok({ files: [...files.values()].map(({ body, ...f }) => f) });
    if (!files.has(id)) return new Response("", { status: 404 });
    if (opt.method === "DELETE") {
      files.delete(id);
      return new Response(null, { status: 204 });
    }
    if (u.searchParams.get("alt") === "media")
      return new Response(files.get(id).body);
    return ok(files.get(id));
  };
  return { files, fetch };
}
