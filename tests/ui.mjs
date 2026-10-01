// Optional DOM integration check (not a real-browser visual test).
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { readFile } from "node:fs/promises";
import { mockDrive } from "./mock-drive.mjs";
const win = new Window({
  url: "https://ark.example.test/",
  settings: { disableJavaScriptFileLoading: true, disableCSSFileLoading: true },
});
for (const k of [
  "window",
  "document",
  "localStorage",
  "location",
  "FormData",
  "FileReader",
])
  globalThis[k] = k === "window" ? win : win[k];
globalThis.confirm = () => true;
const mock = mockDrive();
globalThis.fetch = mock.fetch;
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
document.body.innerHTML = html
  .match(/<body>([\s\S]*)<\/body>/)[1]
  .replace(/<noscript>[\s\S]*<\/noscript>/, "");
let requestedPrompt;
const oauth = {
  hasGrantedAllScopes: () => true,
  initTokenClient: (options) => ({
    requestAccessToken: (request) => { requestedPrompt = request.prompt; options.callback({ access_token: "test-token" }); },
  }),
};
const googleScript = document.createElement('script');
googleScript.id = 'google-identity';
document.head.append(googleScript);
localStorage.setItem("ark-client-id", "123-demo.apps.googleusercontent.com");
await import("../app.js");
const click = (s) => {
  assert.ok(document.querySelector(s), s);
  document.querySelector(s).click();
};
const fill = (s, v) => {
  const el = document.querySelector(s);
  assert.ok(el, s);
  el.value = v;
  el.dispatchEvent(new win.Event("input", { bubbles: true }));
};
const submit = (s) =>
  document
    .querySelector(s)
    .dispatchEvent(
      new win.Event("submit", { bubbles: true, cancelable: true }),
    );
const idle = async () => {
  for (let i = 0; i < 300; i++) {
    await new Promise((r) => setTimeout(r, 5));
    if (!document.body.classList.contains("busy")) return;
  }
  throw Error("Operation timeout");
};
const route = (hash) => {
  location.hash = hash;
  win.dispatchEvent(new win.Event("hashchange"));
};
assert.match(document.body.textContent, /Arsipmu, hanya untukmu/);
assert.equal(document.querySelector('#config-form'),null,'configured browsers must not show setup form');
assert.match(document.body.textContent,/baru disimpan di browser ini/);
assert.equal(document.querySelector('[data-action=connect]').disabled,true,'wait for slow mobile Google script');
win.google = { accounts: { oauth2: oauth } };
globalThis.google = win.google;
googleScript.dispatchEvent(new win.Event('load'));
assert.equal(document.querySelector('[data-action=connect]').disabled,false);
click("[data-action=connect]");
await idle();
assert.equal(requestedPrompt,"","do not force account selection on every page load");
assert.match(document.body.textContent, /Arsipmu masih kosong/);
click("[data-action=add]");
fill("#f-name", "Sarah");
fill("#f-likes", "Coffee");
fill("#f-notes", "<img src=x onerror=alert(1)>");
click("[data-action=add-social]");
fill("#s-0-username", "@sarah");
fill("#s-0-url", "https://instagram.com/sarah");
submit("#person-form");
await idle();
route(location.hash);
assert.match(document.body.textContent, /@sarah/);
assert.equal(document.querySelectorAll("img[onerror]").length, 0);
route("#people");
fill("#search", "coffee");
assert.match(document.querySelector("#results").textContent, /Sarah/);
fill("#search", "nobody");
assert.match(document.querySelector("#results").textContent, /Tidak ada orang/);
route("#assistant");
fill("#ask-form input", "Show Sarah's Instagram");
submit("#ask-form");
assert.match(document.querySelector("#answer").textContent, /@sarah/);
route("#settings");
const select = document.querySelector("#language");
select.value = "en";
select.dispatchEvent(new win.Event("change", { bubbles: true }));
assert.equal(document.documentElement.lang, "en");
assert.match(document.body.textContent, /Backup & restore/);
for (let i = 0; i < localStorage.length; i++) {
  const val = localStorage.getItem(localStorage.key(i));
  assert.ok(!val.includes("Sarah") && !val.includes("test-token"));
}
click("[data-action=logout]");
assert.equal(document.querySelector("[data-action=export]").disabled, true);
assert.ok(!document.querySelector("#app").textContent.includes("Sarah"));
console.log(
  "DOM integration passed: connect, add, social, search, assistant, XSS escaping, language, logout.",
);
await win.happyDOM.abort();
