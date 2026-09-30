import test from "node:test";
import assert from "node:assert/strict";
import { Drive } from "../drive.js";
import { emptyPerson } from "../core.js";
import { mockDrive } from "./mock-drive.mjs";
test("create, reload, edit, social persistence, media and delete/cleanup", async () => {
  const mock = mockDrive();
  let drive = new Drive(mock.fetch);
  drive.token = "test";
  const p = {
    ...emptyPerson(),
    name: "Sarah",
    socials: [
      {
        platform: "Instagram",
        username: "@sarah",
        url: "https://instagram.com/sarah",
      },
    ],
  };
  await drive.save(p, []);
  assert.equal(drive.entries.length, 1);
  drive = new Drive(mock.fetch);
  drive.token = "test";
  await drive.sync();
  assert.equal(drive.entries[0].record.person.socials[0].username, "@sarah");
  const parents = drive.entries[0].heads.map((r) => r.rev);
  p.likes = "Coffee";
  await drive.save(p, parents);
  assert.equal(drive.entries[0].record.person.likes, "Coffee");
  await assert.rejects(
    () => drive.save({ ...p, notes: "Stale edit" }, parents),
    /conflict/,
  );
  const m = await drive.addMedia(
    new File(["abc"], "test.png", { type: "image/png" }),
    p.id,
  );
  assert.equal(await (await drive.blob(m.id)).text(), "abc");
  p.media = [m];
  p.profilePhoto = m.id;
  await drive.save(
    p,
    drive.entries[0].heads.map((r) => r.rev),
  );
  await drive.deletePerson(
    p,
    drive.entries[0].heads.map((r) => r.rev),
  );
  assert.equal(drive.entries[0].record.deleted, true);
  assert.equal(drive.entries[0].record.person.socials.length, 0);
  await drive.cleanup();
  assert.equal(mock.files.size, 1);
  assert.equal(drive.entries[0].record.deleted, true);
});
test("expired session and invalid media fail without writes", async () => {
  const d = new Drive(async () => new Response("", { status: 401 }));
  d.token = "expired";
  await assert.rejects(() => d.sync(), /signInAgain/);
  assert.equal(d.token, "");
  await assert.rejects(
    () =>
      d.addMedia(new File(["x"], "x.svg", { type: "image/svg+xml" }), "person"),
    /invalidMedia/,
  );
});
test("failed upload is never reported as saved", async () => {
  const m = mockDrive();
  const d = new Drive((u, o) =>
    u.includes("/upload/") ? Promise.reject(Error("offline")) : m.fetch(u, o),
  );
  d.token = "test";
  await assert.rejects(
    () => d.save({ ...emptyPerson(), name: "Sarah" }, []),
    /networkError/,
  );
  assert.equal(m.files.size, 0);
});
test("missing media reports an error", async () => {
  const m = mockDrive();
  const d = new Drive(m.fetch);
  d.token = "test";
  await assert.rejects(() => d.blob("missing"), /missingMedia/);
});
