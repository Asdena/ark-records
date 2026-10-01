import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyPerson,
  validatePerson,
  search,
  ask,
  safeUrl,
  resolveRevisions,
  validateBackup,
  allowedMedia,
} from "../core.js";
const person = () => ({
  ...emptyPerson(),
  name: "Sarah",
  nickname: "Sa",
  relationship: "Friend",
  likes: "Coffee, Gaming",
  dislikes: "Spicy food",
  organization: "Microsoft",
  school: "University",
  tags: "friend, university",
  socials: [
    {
      platform: "Instagram",
      username: "@sarah",
      url: "https://instagram.com/sarah",
    },
  ],
});
test("CRUD record validation and search across required fields, case insensitive", () => {
  const p = person();
  validatePerson(p);
  for (const q of [
    "SARAH",
    "sa",
    "friend",
    "coffee",
    "gaming",
    "university",
    "Microsoft",
    "@sarah",
  ])
    assert.equal(search([p], q)[0], p, q);
  p.name = "Sarah Tan";
  validatePerson(p);
  assert.equal(search([p], "Sarah Tan").length, 1);
  assert.equal(search([], "Sarah").length, 0);
  assert.throws(() => validatePerson({ ...p, name: "" }));
});
test("assistant English and Indonesian intents and ambiguity", () => {
  const p = person();
  for (const q of [
    "Who is Sarah?",
    "Who likes coffee?",
    "Siapa yang suka kopi?",
    "Who works at Microsoft?",
    "Orang dari universitas",
  ])
    assert.equal(ask([p], q).people[0], p, q);
  for (const q of ["Show Sarah's Instagram.", "Tampilkan Instagram Sarah"]) {
    const r = ask([p], q);
    assert.equal(r.intent, "social");
    assert.equal(r.platform, "instagram");
  }
  assert.equal(ask([p], "What does Sarah like?").intent, "getLikes");
  assert.equal(ask([p], "Apa yang tidak disukai Sarah?").intent, "getDislikes");
  assert.equal(ask([p], "Show Sarah's photos.").intent, "photos");
  assert.equal(
    ask([p, { ...p, id: crypto.randomUUID() }], "Who is Sarah?").people.length,
    2,
  );
  assert.equal(ask([p], "Who is David?").people.length, 0);
});
test("immutable revisions retain both concurrent edits and allow explicit resolution", () => {
  const p = person();
  const a = { schema: 1, rev: "a", parents: [], deleted: false, person: p };
  const b = {
    ...a,
    rev: "b",
    parents: ["a"],
    person: { ...p, notes: "From laptop" },
  };
  const c = {
    ...a,
    rev: "c",
    parents: ["a"],
    person: { ...p, notes: "From phone" },
  };
  assert.equal(resolveRevisions([a, b])[0].heads.length, 1);
  assert.equal(resolveRevisions([a, b, c])[0].heads.length, 2);
  assert.equal(
    resolveRevisions([a, b, c, { ...b, rev: "d", parents: ["b", "c"] }])[0]
      .heads.length,
    1,
  );
});
test("backup validates complete portable record/media data and rejects malformed data", () => {
  const p = person();
  p.media = [
    {
      id: "media-1",
      name: "photo.png",
      type: "image/png",
      caption: "First meeting",
      size: 3,
    },
  ];
  p.profilePhoto = "media-1";
  const b = {
    format: "ARK-WEB-BACKUP",
    version: 1,
    people: [p],
    media: [{ id: "media-1", type: "image/png", data: "YWJj" }],
  };
  assert.deepEqual(validateBackup(JSON.parse(JSON.stringify(b))), b);
  assert.throws(() => validateBackup({ ...b, media: [] }));
  assert.throws(() => validateBackup({ ...b, people: [p, p] }));
  assert.throws(() => validateBackup({ ...b, version: 9 }));
  assert.throws(() =>
    validateBackup({ ...b, media: [{ ...b.media[0], data: "<script>" }] }),
  );
});
test("reject active content and unsafe links", () => {
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,a",
    "file:///tmp/a",
  ])
    assert.equal(safeUrl(url), null);
  assert.equal(allowedMedia("image/svg+xml"), false);
  assert.throws(() =>
    validatePerson({
      ...person(),
      socials: [{ platform: "X", username: "a", url: "javascript:alert(1)" }],
    }),
  );
});
