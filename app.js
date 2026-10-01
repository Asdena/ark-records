import { loadClientConfig, validClientId } from "./auth-config.js?v=1.0.1";
import { Drive, SCOPE } from "./drive.js";
import {
  FIELDS,
  emptyPerson,
  validatePerson,
  search,
  ask,
  words,
  safeUrl,
  normalize,
  validateBackup,
  MAX_BACKUP,
} from "./core.js";
import { t, lang, setLanguage, strings } from "./i18n.js?v=1.1.0";
const $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const paths = {
  home: "M3 10 12 3l9 7v10H3z M9 20v-7h6v7",
  people:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M18 8a3 3 0 0 1 0 6 M22 21v-2a4 4 0 0 0-3-4",
  assistant: "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z",
  settings:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2",
  lock: "M6 11h12v10H6z M8 11V7a4 4 0 0 1 8 0v4",
  search: "M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14 M15 15l6 6",
};
const icon = (k) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[k] || paths.people}"/></svg>`;
const drive = new Drive();
let connected = false,
  busy = false,
  account = "",
  draft = null,
  draftParents = [],
  dirty = false,
  route = "home",
  query = "",
  relation = "",
  tag = "",
  sort = "recent",
  answer = null;
const loadedConfig = await loadClientConfig(
  () => import(`./config.js?fresh=${Date.now()}`), localStorage,
);
let {clientId, source: configSource} = loadedConfig;
let googleState = window.google?.accounts?.oauth2 ? 'ready' : 'loading';
let authPending = false;
function updateConnectButtons() {
  document.querySelectorAll('[data-action="connect"]').forEach(b => {
    b.disabled = busy || authPending || googleState === 'loading' || !validClientId(clientId);
    b.textContent = t(authPending ? 'openingGoogle' : googleState === 'loading' ? 'googleLoading' : 'openArchive');
  });
}
function googleLoaded() {
  googleState = window.google?.accounts?.oauth2 ? 'ready' : 'error';
  if (googleState === 'ready') clearTimeout(googleTimer);
  updateConnectButtons();
}
const googleScript = document.getElementById('google-identity');
googleScript?.addEventListener('load', googleLoaded);
googleScript?.addEventListener('error', () => {googleState='error';updateConnectButtons();toast('googleUnavailable',true);});
const googleTimer = googleState === 'ready' ? null : setTimeout(() => {
  googleLoaded();
  if (googleState !== 'ready') toast('googleUnavailable', true);
}, 15000);
let theme = localStorage.getItem("ark-theme") || "dark";
document.documentElement.dataset.theme = theme;
document.documentElement.lang = lang;
let effects = localStorage.getItem('ark-effects') === 'off' ? 'off' : 'on';
let palette = localStorage.getItem('ark-palette') || 'cyan';
if (!['cyan','amber','violet'].includes(palette)) palette = 'cyan';
let listView = localStorage.getItem('ark-list-view') === 'list' ? 'list' : 'grid';
document.documentElement.dataset.effects = effects;
document.documentElement.dataset.palette = palette;
const people = () =>
  drive.entries
    .filter((e) => !e.record.deleted || e.heads.length > 1)
    .map((e) => e.record.person);
const entry = (id) => drive.entries.find((e) => e.record.person.id === id);
const button = (key, action, cls = "", extra = "") =>
  `<button type="button" class="${cls}" data-action="${action}" ${extra}>${t(key)}</button>`;
const bytes = (n) =>
  n < 1024 * 1024
    ? `${(n / 1024).toFixed(1)} KB`
    : `${(n / 1024 / 1024).toFixed(1)} MB`;
function toast(key, error = false) {
  $("#toast").textContent = t(key);
  $("#toast").style.display = "block";
  clearTimeout(toast.timer);
  toast.timer = setTimeout(
    () => ($("#toast").style.display = "none"),
    error ? 10000 : 4000,
  );
}
async function run(fn) {
  if (busy) return;
  busy = true;
  document.body.classList.add("busy");
  document.querySelectorAll("button").forEach((b) => {
    b.dataset.wasDisabled = String(b.disabled);
    b.disabled = true;
  });
  try {
    await fn();
  } catch (e) {
    toast(strings[e.message] ? e.message : "error", true);
    if (e.message === "signInAgain") {
      const retry = document.createElement("button");
      retry.textContent = t("connect");
      retry.dataset.action = "connect";
      $("#toast").append(" ", retry);
      clearTimeout(toast.timer);
    }
    const err = $("#form-error");
    if (err) {
      err.textContent = t(e.message);
      if (e.message === 'signInAgain') {
        const retry = document.createElement('button');
        retry.type = 'button'; retry.dataset.action = 'connect'; retry.textContent = t('openArchive');
        err.append(' ', retry);
      }
    }
    console.error("ARK operation failed:", e.message);
  } finally {
    busy = false;
    document.body.classList.remove("busy");
    document.querySelectorAll("button").forEach((b) => {
      if (b.dataset.wasDisabled !== undefined) {
        b.disabled = b.dataset.wasDisabled === "true";
        delete b.dataset.wasDisabled;
      }
    });
    updateConnectButtons();
  }
}
function avatar(p, large = false) {
  return `<div class="avatar${large ? " large" : ""}">${
    p.profilePhoto
      ? `<img data-media="${esc(p.media.find((m) => m.id === p.profilePhoto)?.thumbnail || p.profilePhoto)}" alt="${esc(p.name)}" loading="lazy">`
      : esc(
          p.name
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map((n) => n[0])
            .join(""),
        )
  }</div>`;
}
function card(p) {
  return `<button class="card person-card" data-action="profile" data-id="${esc(p.id)}">${avatar(p)}<h3>${esc(p.name)}</h3><p class="muted">${esc([p.relationship, p.organization || p.school || p.occupation].filter(Boolean).join(" · ")) || "—"}</p><div class="tags">${words(
    p.tags,
  )
    .slice(0, 3)
    .map((x) => `<span class="badge">${esc(x)}</span>`)
    .join(
      "",
    )}${entry(p.id)?.heads.length > 1 ? `<span class="badge">${t("conflicts")}</span>` : ""}</div></button>`;
}
function empty(found = false) {
  return `<div class="empty">${icon(found ? "search" : "people")}<h2>${t(found ? "noResults" : "empty")}</h2><p>${t(found ? "noResultsText" : "emptyText")}</p>${found ? "" : button("add", "add", "primary")}</div>`;
}
function connection() {
  const ready = validClientId(clientId);
  const info = ready
    ? `<h3>${t('configReady')}</h3><p>${t(configSource === 'published' ? 'configPublished' : 'configLocal')}</p><p>${t('deviceLogin')}</p>`
    : `<h3>${t('setup')}</h3><p>${t(configSource === 'error' ? 'configLoadError' : 'setupText')}</p><form id="config-form"><div class="field"><label for="client-id">${t('clientId')}</label><input id="client-id" name="clientId" placeholder="123456789-….apps.googleusercontent.com" autocomplete="off" required></div><button type="submit">${t('saveConfig')}</button></form>`;
  return `<div class="connect-panel"><section class="connect-intro"><div class="seal">${icon('lock')} ${t('archive')}</div><h2>${t('locked')}</h2><p class="muted">${t('connectText')}</p>${button('openArchive','connect','primary')}<p class="hint">${t('privacy')}</p></section><section class="connect-settings">${info}<p class="hint">v1.1.0 · <a href="SETUP.html" target="_blank" rel="noopener">${t('guide')}</a></p></section></div>`;
}
function render() {
  const title = route.startsWith("person/") ? "people" : route;
  $("#app").innerHTML =
    `<div class="shell"><aside class="sidebar"><a href="#home" class="brand"><span class="mark">A</span><span>ARK RECORDS<small>MEMORY SYSTEM / 1.1</small></span></a><nav aria-label="ARK">${["home", "people", "assistant", "settings"].map((k) => `<a href="#${k}" class="navitem ${title === k ? "active" : ""}">${icon(k)}<span>${t(k)}</span></a>`).join("")}</nav><div class="sidefoot"><div class="rule">${t("tagline")}<br>${t("privacy")}</div></div></aside><main class="main"><header class="topbar"><div class="topbar-title"><span class="terminal-label">ARK /</span><strong>${t(title)}</strong></div><button type="button" class="command-trigger" data-action="commands" aria-haspopup="dialog">${icon("search")}<span>${t("quickMenu")}</span><kbd>Ctrl K</kbd></button><div class="session"><span class="status-dot ${connected ? "on" : ""}"></span><span>${t(connected ? "connected" : "notConnected")}</span>${connected ? button("logout", "logout", "quiet") : ""}</div></header><div class="content">${view()}<footer class="terminal-footer"><span>ARK RECORDS / 1.1.0</span><span>${t("privacy")}</span></footer></div></main></div>`;
  loadImages();
  updateConnectButtons();
}
function archiveStats() {
  const ps = people();
  return `<div class="archive-stats" aria-label="${t('archiveSummary')}">${[
    ['people',ps.length], ['media',ps.reduce((n,p)=>n+p.media.length,0)],
    ['memories',ps.reduce((n,p)=>n+p.memories.length,0)],
  ].map(([key,n],i)=>`<div class="stat-cell"><span class="stat-index">0${i+1}</span><div><span class="stat-name">${t(key)}</span><strong>${String(n).padStart(2,'0')}</strong></div>${icon(key==='people'?'people':key==='media'?'home':'assistant')}</div>`).join('')}</div>`;
}
function viewButtons() {
  return `<div class="view-toggle" role="group" aria-label="${t('viewLayout')}">${['grid','list'].map(v=>`<button type="button" data-action="view-layout" data-layout="${v}" aria-pressed="${listView===v}">${t(v+'View')}</button>`).join('')}</div>`;
}
function view() {
  if (route === "settings") return settings();
  if (!connected)
    return `<p class="eyebrow">${t("archive")}</p><div class="heading"><div><h1>${t("welcome")}</h1><p class="muted">${t("subtitle")}</p></div></div>${connection()}`;
  if (route.startsWith("person/")) return profile(route.slice(7));
  if (route === "assistant") return assistant();
  return `<div class="heading"><div><p class="eyebrow">${t("archive")}</p><h1>${t(route === "home" ? "welcome" : "people")}</h1><p class="muted">${t("subtitle")}</p></div>${button("add", "add", "primary")}</div>${route === "home" ? archiveStats() : ""}<div class="searchbar">${icon("search")}<input id="search" aria-label="${t("search")}" placeholder="${t("search")}" value="${esc(query)}"></div>${route === "people" ? filters() : `<div class="actions">${button("assistant", "assistant")}${button("sync", "sync", "quiet")}</div>`}<div class="section-title"><h2>${t(route === "home" ? "recent" : "people")}</h2><div class="actions"><span class="muted" id="result-count"></span>${viewButtons()}</div></div><div id="results">${results()}</div>`;
}
function filters() {
  const options = (arr, v) =>
    arr
      .map(
        (s) =>
          `<option ${s === v ? "selected" : ""} value="${esc(s)}">${esc(s)}</option>`,
      )
      .join("");
  return `<div class="filters"><select id="sort" aria-label="${t("sort")}">${["recent", "alphabet", "newest"].map((k) => `<option value="${k}" ${sort === k ? "selected" : ""}>${t(k)}</option>`).join("")}</select><select id="relation" aria-label="${t("relationship")}"><option value="">${t("filterRelationship")}</option>${options(
    [
      ...new Set(
        people()
          .map((p) => p.relationship)
          .filter(Boolean),
      ),
    ].sort(),
    relation,
  )}</select><select id="tag" aria-label="${t("tags")}"><option value="">${t("filterTag")}</option>${options([...new Set(people().flatMap((p) => words(p.tags)))].sort(), tag)}</select>${button("sync", "sync", "quiet")}</div>`;
}
function results() {
  let list = search(people(), query).filter(
    (p) =>
      (route === "home" || !relation || p.relationship === relation) &&
      (route === "home" || !tag || words(p.tags).includes(tag)),
  );
  list.sort((a, b) =>
    sort === "alphabet" && route !== "home"
      ? a.name.localeCompare(b.name)
      : sort === "newest" && route !== "home"
        ? b.createdAt.localeCompare(a.createdAt)
        : b.updatedAt.localeCompare(a.updatedAt),
  );
  setTimeout(() => {
    if ($("#result-count"))
      $("#result-count").textContent = `${list.length} ${t("count")}`;
  }, 0);
  if (!list.length) return empty(people().length > 0);
  return `<div class="grid people-grid ${listView === "list" ? "list-view" : ""}">${list.map(card).join("")}</div>`;
}
function profile(id) {
  const e = entry(id);
  if (!e) return empty(true);
  const p = e.record.person;
  if (e.heads.length > 1)
    return `<h1>${t("conflicts")}</h1><p>${t("conflictHelp")}</p><div class="stack">${e.heads.map((r) => `<section class="card"><h2>${esc(r.person.name)} ${r.deleted ? "· " + t("deleted") : ""}</h2><p class="muted">${esc(r.person.updatedAt)}</p><p class="pre">${esc([r.person.relationship, r.person.notes, r.person.likes].filter(Boolean).join("\n"))}</p>${button("resolve", "resolve", "primary", `data-id="${esc(id)}" data-rev="${esc(r.rev)}"`)}</section>`).join("")}</div>`;
  const section = (name, html) =>
    html ? `<section class="card"><h2>${t(name)}</h2>${html}</section>` : "";
  const details = (keys) =>
    keys
      .filter((k) => p[k])
      .map((k) => `<dt>${t(k)}</dt><dd>${esc(p[k])}</dd>`)
      .join("");
  return `<div class="actions">${button("back", "people", "quiet")}<span class="muted">/ ${esc(p.name)}</span></div><div class="profile-top">${avatar(p, true)}<div><p class="eyebrow">${t("archive")}</p><h1>${esc(p.name)}</h1><p class="muted">${esc([p.nickname, p.relationship].filter(Boolean).join(" · "))}</p></div></div><div class="actions">${button("edit", "edit", "primary", `data-id="${id}"`)}${p.phone ? `<a href="tel:${esc(p.phone.replace(/[^+\d]/g, ""))}">${t("call")}</a><a href="sms:${esc(p.phone.replace(/[^+\d]/g, ""))}">${t("message")}</a>` : ""}${button("delete", "delete", "quiet danger", `data-id="${id}"`)}</div><div class="two-col section-title"><div class="stack">${section("about", details(["occupation", "organization", "school", "address", "birthday", "phone", "email"]) ? `<dl class="details">${details(["occupation", "organization", "school", "address", "birthday", "phone", "email"])}</dl>` : "")}${[
    "likes",
    "dislikes",
    "hobbies",
    "interests",
    "tags",
  ]
    .filter((k) => p[k])
    .map((k) =>
      section(
        k,
        `<div class="tags">${words(p[k])
          .map((x) => `<span class="badge">${esc(x)}</span>`)
          .join("")}</div>`,
      ),
    )
    .join(
      "",
    )}${section("notes", p.notes ? `<p class="pre">${esc(p.notes)}</p>` : "")}</div><div class="stack">${section("socials", p.socials.map((s) => `<div class="social-row"><span><strong>${esc(s.platform)}</strong><br>${esc(s.username)}</span>${safeUrl(s.url) ? `<a href="${esc(safeUrl(s.url))}" target="_blank" rel="noopener noreferrer">${t("view")}</a>` : ""}</div>`).join(""))}${section(
    "memories",
    p.memories
      .toSorted((a, b) => b.date.localeCompare(a.date))
      .map(
        (m) =>
          `<article class="memory"><small>${esc(m.date)} ${esc(m.location)}</small><h3>${esc(m.title)}</h3><p class="pre">${esc(m.description)}</p></article>`,
      )
      .join(""),
  )}</div><div class="full">${section("media", p.media.length ? mediaGrid(p.media) : `<p class="muted">${t("noMedia")}</p>`)}</div></div>`;
}
function mediaGrid(media, editing = false) {
  return `<div class="media-grid">${media.map((m) => `<div class="media-tile"><button type="button" data-action="view-media" data-id="${esc(m.id)}" data-type="${esc(m.type)}" data-caption="${esc(m.caption || m.name)}" aria-label="${esc(t("view") + " " + m.name)}">${m.type.startsWith("image/") || m.thumbnail ? `<img data-media="${esc(m.thumbnail || m.id)}" loading="lazy" alt="${esc(m.caption || m.name)}">` : `<span>▷ ${t("videos")}<br><small>${bytes(m.size)}</small></span>`}</button>${editing ? `<input data-caption-id="${esc(m.id)}" aria-label="${t("caption")}" placeholder="${t("caption")}" value="${esc(m.caption)}"><div class="actions">${m.type.startsWith("image/") ? button(draft.profilePhoto === m.id ? "photoSelected" : "profilePhoto", "set-photo", "", `data-id="${esc(m.id)}"`) : ""}${button("delete", "remove-media", "danger", `data-id="${esc(m.id)}"`)}</div>` : `<p>${esc(m.caption || m.name)}</p>`}</div>`).join("")}</div>`;
}
function assistant() {
  return `<div class="assistant-box"><div class="ask-header"><div class="ask-mark">A</div><p class="eyebrow">${t("assistant")}</p><h1>${t("askTitle")}</h1><p class="muted">${t("askSubtitle")}</p></div><form id="ask-form" class="ask-form"><input name="question" required maxlength="300" aria-label="${t("assistant")}" placeholder="${t("askPlaceholder")}"><button class="primary" type="submit">${t("ask")}</button></form><div class="suggestions">${(lang === "id" ? ["Siapa yang suka kopi?", "Tampilkan Instagram Sarah", "Orang dari universitas"] : ["Who likes coffee?", "Show Sarah’s Instagram", "People from university"]).map((q) => `<button data-action="suggest" data-question="${esc(q)}">${esc(q)}</button>`).join("")}</div><div id="answer" class="answer">${answerHtml()}</div></div>`;
}
function answerHtml() {
  if (!answer) return "";
  const r = answer;
  if (!r.people.length) return empty(true);
  if (r.people.length > 1)
    return `<p class="muted">${t("choose")}</p><div class="grid">${r.people.map((p) => `<div>${card(p)}${button("view", "answer-person", "", `data-id="${p.id}"`)}</div>`).join("")}</div>`;
  const p = r.people[0];
  let detail = "";
  if (r.intent === "social")
    detail = p.socials
      .filter((s) => normalize(s.platform) === r.platform)
      .map(
        (s) =>
          `<p>${esc(s.platform)} · ${esc(s.username)} ${safeUrl(s.url) ? `<a target="_blank" rel="noopener noreferrer" href="${esc(safeUrl(s.url))}">${t("view")}</a>` : ""}</p>`,
      )
      .join("");
  else if (r.intent === "getLikes" || r.intent === "getDislikes")
    detail = esc(p[r.intent === "getLikes" ? "likes" : "dislikes"]);
  else if (r.intent === "photos" || r.intent === "videos") {
    const media = p.media.filter((m) =>
      m.type.startsWith(r.intent === "photos" ? "image/" : "video/"),
    );
    detail = media.length ? mediaGrid(media) : "";
  } else
    detail = esc(
      [p.relationship, p.occupation, p.organization, p.school]
        .filter(Boolean)
        .join(" · "),
    );
  return `<section class="card"><h2>${esc(p.name)}</h2><div>${detail || t("unknown")}</div>${button("view", "profile", "quiet", `data-id="${p.id}"`)}</section>`;
}
function settings() {
  const sizes = { data: 0, photos: 0, videos: 0 };
  for (const f of drive.files) {
    const k =
      f.appProperties?.ark === "record"
        ? "data"
        : f.mimeType?.startsWith("video/")
          ? "videos"
          : "photos";
    sizes[k] += Number(f.size) || 0;
  }
  return `<p class="eyebrow">ARK RECORDS</p><h1>${t("settings")}</h1><div class="settings-grid section-title"><section class="card"><h2>${t("language")} & ${t("theme")}</h2><div class="field"><label for="language">${t("language")}</label><select id="language"><option value="id" ${lang === "id" ? "selected" : ""}>Bahasa Indonesia</option><option value="en" ${lang === "en" ? "selected" : ""}>English</option></select></div><label for="theme">${t("theme")}</label><select id="theme">${["system", "light", "dark"].map((k) => `<option value="${k}" ${theme === k ? "selected" : ""}>${t(k)}</option>`).join("")}</select><div class="field appearance-field"><label for="palette">${t('accentColor')}</label><select id="palette">${['cyan','amber','violet'].map(k=>`<option value="${k}" ${palette===k?'selected':''}>${t(k)}</option>`).join('')}</select></div><div class="field"><label for="effects">${t('visualEffects')}</label><select id="effects"><option value="on" ${effects==='on'?'selected':''}>${t('effectsOn')}</option><option value="off" ${effects==='off'?'selected':''}>${t('effectsOff')}</option></select><p class="hint">${t('motionHelp')}</p></div></section><section class="card"><h2>Google Drive</h2><p class="muted">${t("privacyDetails")}</p><div class="actions">${button(connected ? "logout" : "connect", connected ? "logout" : "connect", "primary")}<a href="SETUP.html" target="_blank" rel="noopener">${t("guide")}</a></div></section><section class="card"><h2>${t("backup")}</h2><p class="muted">${t("backupHelp")}</p><div class="actions">${button("export", "export", "", connected ? "" : "disabled")}${button("import", "import", "", connected ? "" : "disabled")}</div><input type="file" id="backup-file" accept=".arkbackup,application/json" hidden></section><section class="card"><h2>${t("storage")}</h2>${Object.entries(
    sizes,
  )
    .map(
      ([k, v]) =>
        `<div class="stats"><span>${t(k)}</span><strong>${bytes(v)}</strong></div>`,
    )
    .join(
      "",
    )}<div class="stats"><span>${t("total")}</span><strong>${bytes(Object.values(sizes).reduce((a, b) => a + b, 0))}</strong></div><p class="hint">${t("cleanHelp")}</p>${button("clean", "clean", "quiet danger", connected ? "" : "disabled")}</section><section class="card full"><h2>${t("about")} ARK RECORDS</h2><p class="muted">${t("historyNotice")}</p><p class="small muted">v1.1.0 · ${t("privacy")}</p></section></div>${!connected ? connection() : ""}`;
}
function field(key, type = "text") {
  return `<div class="field ${key === "notes" ? "full" : ""}"><label for="f-${key}">${t(key)}</label>${key === "notes" || key === "address" ? `<textarea id="f-${key}" name="${key}" maxlength="50000">${esc(draft[key])}</textarea>` : `<input id="f-${key}" name="${key}" type="${type}" value="${esc(draft[key])}" ${key === "name" ? "required" : ""} maxlength="50000">`}${["likes", "dislikes", "hobbies", "interests", "tags"].includes(key) ? `<p class="hint">${t("comma")}</p>` : ""}</div>`;
}
function openEditor(id) {
  if (!connected) return;
  const e = id ? entry(id) : null;
  if (e?.heads.length > 1) {
    toast("conflict", true);
    return;
  }
  draft = e ? structuredClone(e.record.person) : emptyPerson();
  draftParents = e ? e.heads.map((r) => r.rev) : [];
  dirty = false;
  renderEditor();
  $("#editor").showModal();
}
function renderEditor() {
  const sections = [
    ["contact", ["phone", "email", "address"]],
    ["about", ["occupation", "organization", "school", "birthday"]],
    ["preferences", ["likes", "dislikes", "hobbies", "interests", "tags"]],
    ["notes", ["notes"]],
  ];
  $("#editor").innerHTML =
    `<form id="person-form"><div class="dialog-head"><h2>${t(entry(draft.id) ? "edit" : "add")}</h2>${button("close", "close-editor", "quiet")}</div><div class="dialog-body"><p class="muted">${t("required")}</p><div class="form-grid">${["name", "nickname", "relationship"].map((k) => field(k)).join("")}</div>${sections.map(([s, ks]) => `<details><summary>${t(s)}</summary><div class="form-grid">${ks.map((k) => field(k, k === "birthday" ? "date" : k === "email" ? "email" : k === "phone" ? "tel" : "text")).join("")}</div></details>`).join("")}<details open><summary>${t("socials")}</summary><div id="social-rows">${socialRows()}</div>${button("addSocial", "add-social")}</details><details><summary>${t("memories")}</summary><div id="memory-rows">${memoryRows()}</div>${button("addMemory", "add-memory")}</details><details open><summary>${t("media")}</summary><p class="muted">${t("mediaHelp")}</p><div class="actions">${button("addMedia", "pick-media")}${button("camera", "camera")}</div><input id="media-files" type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" hidden><input id="camera-file" type="file" accept="image/*" capture="environment" hidden><div id="draft-media">${mediaGrid(draft.media, true)}</div></details><p id="form-error" role="alert" class="error"></p></div><div class="dialog-footer">${button("cancel", "close-editor")}<button type="submit" class="primary">${t("save")}</button></div></form>`;
  loadImages();
}
function socialRows() {
  return (
    draft.socials
      .map(
        (s, i) =>
          `<div class="repeat-row"><div class="form-grid">${["platform", "username", "url"].map((k) => `<div><label for="s-${i}-${k}">${t(k)}</label><input id="s-${i}-${k}" data-social="${i}" data-key="${k}" value="${esc(s[k])}" maxlength="2999" ${k === "url" ? 'type="url"' : ""} list="${k === "platform" ? "platforms" : ""}"></div>`).join("")}</div>${button("delete", "remove-social", "danger", `data-index="${i}"`)}</div>`,
      )
      .join("") +
    `<datalist id="platforms">${["Instagram", "Facebook", "X", "TikTok", "LinkedIn", "YouTube", "Telegram", "WhatsApp"].map((s) => `<option>${s}</option>`).join("")}</datalist>`
  );
}
function memoryRows() {
  return draft.memories
    .map(
      (m, i) =>
        `<div class="repeat-row">${["title", "date", "location", "description"].map((k) => `<label for="m-${i}-${k}">${t(k)}</label>${k === "description" ? `<textarea id="m-${i}-${k}" data-memory="${i}" data-key="${k}">${esc(m[k])}</textarea>` : `<input id="m-${i}-${k}" type="${k === "date" ? "date" : "text"}" data-memory="${i}" data-key="${k}" value="${esc(m[k])}">`}`).join("")}${button("delete", "remove-memory", "danger", `data-index="${i}"`)}</div>`,
    )
    .join("");
}
async function loadImages() {
  for (const img of document.querySelectorAll("img[data-media]:not([src])")) {
    const id = img.dataset.media;
    try {
      const url = await drive.url(id);
      if (img.isConnected) img.src = url;
    } catch {
      img.alt = t("missingMedia");
    }
  }
}
function signIn() {
  if (!validClientId(clientId)) {
    toast("invalidConfig", true);
    return;
  }
  if (!window.google?.accounts?.oauth2) {
    toast("googleUnavailable", true);
    return;
  }
  if (authPending) return;
  authPending = true;
  updateConnectButtons();
  try {
  const client = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPE,
    include_granted_scopes: false,
    callback: (response) => {
      authPending = false;
      updateConnectButtons();
      if (
        response.error ||
        !google.accounts.oauth2.hasGrantedAllScopes(response, SCOPE)
      ) {
        toast("permissionError", true);
        return;
      }
      run(async () => {
        const oldToken = drive.token;
        drive.token = response.access_token;
        const about = await (
          await drive.request("about?fields=user(permissionId)")
        ).json();
        if (account && account !== about.user.permissionId) {
          drive.token = oldToken;
          throw Error("accountChanged");
        }
        account = about.user.permissionId;
        await drive.sync();
        connected = true;
        render();
      });
    },
    error_callback: (error) => {
      authPending = false;
      updateConnectButtons();
      toast(error.type === 'popup_closed' ? 'googleCancelled' : 'googlePopupBlocked', true);
    },
  });
  // Keep the popup inside the user's click. No await/timer before this call.
  // Google decides whether account selection or consent is still necessary.
  client.requestAccessToken({ prompt: "" });
  } catch {
    authPending = false;
    updateConnectButtons();
    toast('googleUnavailable', true);
  }
}
async function exportBackup() {
  await drive.sync();
  const ps = people();
  if (drive.entries.some((e) => e.heads.length > 1)) throw Error("conflict");
  const meta = [
    ...new Map(ps.flatMap((p) => p.media).map((m) => [m.id, m])).values(),
  ];
  if (meta.reduce((n, m) => n + m.size * 1.38, 0) > MAX_BACKUP)
    throw Error("backupLarge");
  const media = [];
  for (const m of meta) {
    const blob = await drive.blob(m.id);
    media.push({ id: m.id, type: m.type, data: await base64(blob) });
  }
  const body = JSON.stringify({
    format: "ARK-WEB-BACKUP",
    version: 1,
    exportedAt: new Date().toISOString(),
    people: ps,
    media,
  });
  if (new Blob([body]).size > MAX_BACKUP) throw Error("backupLarge");
  const url = URL.createObjectURL(
    new Blob([body], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `ARK-${new Date().toISOString().slice(0, 10)}.arkbackup`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
const base64 = (blob) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result.split(",")[1]);
    r.onerror = () => reject(Error("invalidMedia"));
    r.readAsDataURL(blob);
  });
async function importBackup(file) {
  if (file.size > MAX_BACKUP) throw Error("backupLarge");
  let b;
  try {
    b = validateBackup(JSON.parse(await file.text()));
    for (const m of b.media) {
      const raw = atob(m.data);
      if (raw.length > 50 * 1024 * 1024) throw Error();
      for (const p of b.people)
        for (const f of p.media)
          if (f.id === m.id && f.size !== raw.length) throw Error();
    }
  } catch {
    throw Error("invalidBackup");
  }
  if (!confirm(t("importConfirm"))) return;
  try {
    for (const original of b.people) {
      const p = structuredClone(original);
      p.id = crypto.randomUUID();
      const mapping = new Map();
      for (const m of p.media) {
        const src = b.media.find((x) => x.id === m.id),
          raw = atob(src.data),
          blob = new File(
            [Uint8Array.from(raw, (c) => c.charCodeAt(0))],
            m.name,
            { type: m.type },
          );
        const next = await drive.addMedia(blob, p.id);
        mapping.set(m.id, next.id);
        m.id = next.id;
        delete m.thumbnail;
        const thumb = await makeThumbnail(blob);
        if (thumb) m.thumbnail = (await drive.addMedia(thumb, p.id)).id;
      }
      p.profilePhoto = mapping.get(p.profilePhoto) || "";
      await drive.save(p, []);
    }
    toast("imported");
    render();
  } catch {
    await drive.sync().catch(() => {});
    render();
    throw Error("partialImport");
  }
}
window.addEventListener("hashchange", () => {
  route = location.hash.slice(1) || "home";
  if (
    !["home", "people", "assistant", "settings"].includes(route) &&
    !route.startsWith("person/")
  )
    route = "home";
  render();
  if (searchAfterNavigation) { searchAfterNavigation=false; $("#search")?.focus(); }
});
window.addEventListener("beforeunload", (e) => {
  if (dirty) {
    e.preventDefault();
    e.returnValue = "";
  }
});
$("#viewer").addEventListener("close", () => {
  $("#viewer").innerHTML = "";
});
$("#editor").addEventListener("cancel", (e) => {
  e.preventDefault();
  if (!busy && (!dirty || confirm(t("discard")))) {
    draft = null;
    dirty = false;
    $("#editor").close();
  }
});
document.addEventListener("input", (e) => {
  const el = e.target;
  if (el.id === "search") {
    query = el.value;
    $("#results").innerHTML = results();
    loadImages();
  }
  if (el.closest("#person-form")) {
    dirty = true;
    if (FIELDS.includes(el.name)) draft[el.name] = el.value;
    if (el.dataset.social !== undefined)
      draft.socials[+el.dataset.social][el.dataset.key] = el.value;
    if (el.dataset.memory !== undefined)
      draft.memories[+el.dataset.memory][el.dataset.key] = el.value;
    if (el.dataset.captionId)
      draft.media.find((m) => m.id === el.dataset.captionId).caption = el.value;
  }
});
document.addEventListener("change", (e) => {
  const el = e.target;
  if (el.id === "language") {
    setLanguage(el.value);
    answer = null;
    render();
  }
  if (el.id === "theme") {
    theme = el.value;
    localStorage.setItem("ark-theme", theme);
    document.documentElement.dataset.theme = theme;
  }
  if (el.id === 'effects') {
    effects = el.value === 'off' ? 'off' : 'on';
    localStorage.setItem('ark-effects',effects);
    document.documentElement.dataset.effects = effects;
  }
  if (el.id === 'palette' && ['cyan','amber','violet'].includes(el.value)) {
    palette = el.value;
    localStorage.setItem('ark-palette',palette);
    document.documentElement.dataset.palette = palette;
  }
  if (["sort", "relation", "tag"].includes(el.id)) {
    if (el.id === "sort") sort = el.value;
    if (el.id === "relation") relation = el.value;
    if (el.id === "tag") tag = el.value;
    $("#results").innerHTML = results();
    loadImages();
  }
  if (["media-files", "camera-file"].includes(el.id) && el.files.length) {
    const files = [...el.files];
    run(async () => {
      try {
        for (const file of files) {
          const media = await drive.addMedia(file, draft.id);
          draft.media.push(media);
          dirty = true;
          const thumb = await makeThumbnail(file);
          if (thumb)
            media.thumbnail = (await drive.addMedia(thumb, draft.id)).id;
        }
      } finally {
        $("#draft-media").innerHTML = mediaGrid(draft.media, true);
        loadImages();
      }
    });
    el.value = "";
  }
  if (el.id === "backup-file" && el.files[0]) {
    const f = el.files[0];
    run(() => importBackup(f));
    el.value = "";
  }
});
document.addEventListener("submit", (e) => {
  e.preventDefault();
  if (e.target.id === "config-form") {
    const v = new FormData(e.target).get("clientId").trim();
    if (!validClientId(v)) {
      toast("invalidConfig", true);
      return;
    }
    clientId = v;
    localStorage.setItem("ark-client-id", v);
    configSource = "local";
    render();
    toast("done");
  }
  if (e.target.id === "person-form")
    run(async () => {
      draft.name = draft.name.trim();
      validatePerson(draft);
      await drive.save(draft, draftParents);
      dirty = false;
      const id = draft.id;
      draft = null;
      $("#editor").close();
      location.hash = `person/${id}`;
      render();
      toast("saved");
    });
  if (e.target.id === "ask-form") {
    answer = ask(people(), new FormData(e.target).get("question"));
    $("#answer").innerHTML = answerHtml();
    loadImages();
  }
});
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-action]");
  if (!b || busy) return;
  const a = b.dataset.action,
    id = b.dataset.id;
  if (a === 'commands') { openCommands(); return; }
  if (a === 'close-commands') { $('#commands').close(); return; }
  if (a === 'view-layout') {
    listView = b.dataset.layout === 'list' ? 'list' : 'grid';
    localStorage.setItem('ark-list-view',listView);
    render();
    document.querySelector(`[data-layout="${listView}"]`)?.focus();
    return;
  }
  if (a === "connect") {
    signIn();
    return;
  }
  if (["people", "assistant"].includes(a)) {
    location.hash = a;
    return;
  }
  if (a === "profile") {
    location.hash = `person/${id}`;
    return;
  }
  if (a === "add" || a === "edit") {
    openEditor(a === "edit" ? id : undefined);
    return;
  }
  if (a === "close-editor") {
    if (!dirty || confirm(t("discard"))) {
      draft = null;
      dirty = false;
      $("#editor").close();
    }
    return;
  }
  if (a === "logout") {
    if (dirty && !confirm(t("discard"))) return;
    drive.clear();
    connected = false;
    account = "";
    draft = null;
    dirty = false;
    answer = null;
    $("#editor").close();
    $("#viewer").close();
    render();
    return;
  }
  if (a === "sync") {
    run(async () => {
      await drive.sync();
      render();
      toast("done");
    });
    return;
  }
  if (a === "delete") {
    if (confirm(t("deleteConfirm")))
      run(async () => {
        const en = entry(id);
        await drive.deletePerson(
          en.record.person,
          en.heads.map((r) => r.rev),
        );
        location.hash = "people";
        render();
      });
    return;
  }
  if (a === "add-social") {
    draft.socials.push({ platform: "Instagram", username: "", url: "" });
    dirty = true;
    $("#social-rows").innerHTML = socialRows();
    return;
  }
  if (a === "remove-social") {
    draft.socials.splice(+b.dataset.index, 1);
    dirty = true;
    $("#social-rows").innerHTML = socialRows();
    return;
  }
  if (a === "add-memory") {
    draft.memories.push({ title: "", date: "", location: "", description: "" });
    dirty = true;
    $("#memory-rows").innerHTML = memoryRows();
    return;
  }
  if (a === "remove-memory") {
    draft.memories.splice(+b.dataset.index, 1);
    dirty = true;
    $("#memory-rows").innerHTML = memoryRows();
    return;
  }
  if (a === "pick-media") {
    $("#media-files").click();
    return;
  }
  if (a === "camera") {
    $("#camera-file").click();
    return;
  }
  if (a === "set-photo") {
    draft.profilePhoto = id;
    dirty = true;
    $("#draft-media").innerHTML = mediaGrid(draft.media, true);
    loadImages();
    return;
  }
  if (a === "remove-media") {
    if (confirm(t("mediaConfirm"))) {
      draft.media = draft.media.filter((m) => m.id !== id);
      if (draft.profilePhoto === id) draft.profilePhoto = "";
      dirty = true;
      $("#draft-media").innerHTML = mediaGrid(draft.media, true);
      loadImages();
    }
    return;
  }
  if (a === "view-media") {
    run(async () => {
      const url = await drive.url(id);
      $("#viewer").innerHTML =
        `<div class="dialog-head"><h2>${esc(b.dataset.caption)}</h2>${button("close", "close-viewer", "quiet")}</div><div class="viewer-body">${b.dataset.type.startsWith("video/") ? `<video controls autoplay src="${esc(url)}"></video>` : `<img src="${esc(url)}" alt="${esc(b.dataset.caption)}">`}</div>`;
      $("#viewer").showModal();
    });
    return;
  }
  if (a === "close-viewer") {
    $("#viewer").close();
    $("#viewer").innerHTML = "";
    return;
  }
  if (a === "suggest") {
    $("#ask-form input").value = b.dataset.question;
    $("#ask-form").requestSubmit();
    return;
  }
  if (a === "answer-person") {
    answer = { ...answer, people: answer.people.filter((p) => p.id === id) };
    $("#answer").innerHTML = answerHtml();
    loadImages();
    return;
  }
  if (a === "export") {
    run(exportBackup);
    return;
  }
  if (a === "import") {
    $("#backup-file").click();
    return;
  }
  if (a === "clean") {
    if (confirm(t("cleanConfirm")))
      run(async () => {
        await drive.cleanup();
        render();
        toast("done");
      });
    return;
  }
  if (a === "resolve") {
    run(async () => {
      const en = entry(id),
        r = en.heads.find((r) => r.rev === b.dataset.rev);
      await drive.save(
        r.person,
        en.heads.map((r) => r.rev),
        r.deleted,
      );
      render();
    });
  }
});
// Optional read/navigation tools use the same authenticated in-memory state as the UI.
if (document.modelContext?.registerTool) {
  document.modelContext.registerTool({
    name: "search_ark_people",
    description:
      "Search the connected private ARK archive. Requires an active Drive session.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string", maxLength: 300 } },
      required: ["query"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: (input) => {
      if (!connected || !drive.token) throw Error("Not connected");
      if (typeof input?.query !== "string" || input.query.length > 300)
        throw Error("Invalid query");
      return search(people(), input.query).map((p) => ({
        id: p.id,
        name: p.name,
        relationship: p.relationship,
      }));
    },
  });
}
route = location.hash.slice(1) || "home";
render();
async function makeThumbnail(file) {
  let url, source;
  try {
    if (file.type.startsWith("image/")) source = await createImageBitmap(file);
    else {
      url = URL.createObjectURL(file);
      source = document.createElement("video");
      source.muted = true;
      source.preload = "auto";
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(Error("timeout")), 8000);
        source.onloadeddata = () => {
          clearTimeout(timer);
          resolve();
        };
        source.onerror = () => {
          clearTimeout(timer);
          reject(Error("video"));
        };
        source.src = url;
      });
    }
    const w = source.width || source.videoWidth,
      h = source.height || source.videoHeight;
    if (!w || !h) return null;
    const canvas = document.createElement("canvas");
    const ratio = Math.min(1, 360 / Math.max(w, h));
    canvas.width = Math.round(w * ratio);
    canvas.height = Math.round(h * ratio);
    canvas
      .getContext("2d")
      .drawImage(source, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.8),
    );
    return blob
      ? new File([blob], "thumbnail.jpg", { type: "image/jpeg" })
      : null;
  } catch {
    return null;
  } finally {
    source?.close?.();
    if (source?.tagName === "VIDEO") {
      source.removeAttribute("src");
      source.load();
    }
    if (url) URL.revokeObjectURL(url);
  }
}

let searchAfterNavigation = false;
function openCommands() {
  if (busy || document.querySelector('dialog[open]')) return;
  const actions = connected ? ['add','search','assistant','settings'] : ['settings'];
  $('#commands').innerHTML = `<div class="dialog-head"><div><p class="eyebrow">ARK / CONTROL</p><h2 id="commands-title">${t('quickMenu')}</h2></div>${button('close','close-commands','quiet')}</div><div class="command-options">${actions.map(a=>`<button type="button" data-command="${a}"><span>${icon(a==='search'?'search':a==='add'?'people':a)}${t(a==='search'?'searchPeople':a)}</span><span aria-hidden="true">↵</span></button>`).join('')}</div><p class="command-hint">${t('shortcutHint')}</p>`;
  $('#commands').showModal();
}
document.addEventListener('keydown',e=>{
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase()==='k' && !e.repeat && !e.isComposing) {
    e.preventDefault(); openCommands();
  }
});
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-command]'); if(!b || busy) return;
  const action=b.dataset.command;
  if(!['add','search','assistant','settings'].includes(action))return;
  $('#commands').close();
  if(action==='add'){openEditor();return;}
  if(action==='search'){
    if(!connected)return;
    if(route==='people'){ $('#search')?.focus(); }
    else { searchAfterNavigation=true; location.hash='people'; }
  }else location.hash=action;
});
