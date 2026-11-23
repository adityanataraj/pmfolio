import { renderPortfolio, THEMES, esc } from "/render.js";

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const PDFJS = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs";
const PDFJS_WORKER = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";
const DRAFT_KEY = "pmfolio:draft";
const keyFor = (u) => `pmfolio:key:${u}`;
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};

const blankProfile = () => ({
  name: "", headline: "", location: "", email: "", avatarUrl: "", openToWork: false, about: "", theme: "paper", feedUrl: "",
  links: { linkedin: "", website: "", twitter: "", producthunt: "", substack: "", medium: "", github: "" },
  metrics: [{ value: "", label: "" }],
  products: [{ name: "", company: "", year: "", problem: "", action: "", outcome: "", link: "", tags: [] }],
  experience: [{ role: "", company: "", start: "", end: "", summary: "", highlights: [] }],
  education: [], skills: [], domains: [], writing: [],
});

const state = { profile: null, editing: null, key: null, sourceText: "", tab: "upload" };

/* ---------------- step 1: import ---------------- */
$$(".tabs button").forEach((b) => b.addEventListener("click", () => {
  state.tab = b.dataset.tab;
  $$(".tabs button").forEach((x) => x.classList.toggle("on", x === b));
  $$("[data-pane]").forEach((p) => (p.hidden = p.dataset.pane !== state.tab));
  $("#goBtn").textContent = state.tab === "blank" ? "Open the editor →" : "Generate my portfolio →";
}));

const drop = $("#drop"), fileInput = $("#file");
["dragenter", "dragover"].forEach((e) => drop.addEventListener(e, (ev) => { ev.preventDefault(); drop.classList.add("over"); }));
["dragleave", "drop"].forEach((e) => drop.addEventListener(e, (ev) => { ev.preventDefault(); drop.classList.remove("over"); }));
drop.addEventListener("drop", (ev) => ev.dataTransfer.files[0] && readFile(ev.dataTransfer.files[0]));
fileInput.addEventListener("change", () => fileInput.files[0] && readFile(fileInput.files[0]));

async function readFile(file) {
  hideErr("#importErr");
  const ok = $("#fileOk");
  ok.hidden = false; ok.textContent = `Reading ${file.name}…`;
  try {
    let text = "";
    if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) text = await pdfToText(file);
    else text = await file.text();
    text = text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    if (text.length < 80) throw new Error("We couldn't find readable text in that file. If it's a scanned PDF, paste the text instead.");
    state.sourceText = text;
    ok.textContent = `✓ ${file.name} — ${text.split(/\s+/).length.toLocaleString()} words ready`;
  } catch (e) {
    ok.hidden = true; state.sourceText = "";
    showErr("#importErr", e.message || "Couldn't read that file.");
  }
}

async function pdfToText(file) {
  const pdfjs = await import(PDFJS);
  pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages = [];
  for (let i = 1; i <= Math.min(doc.numPages, 15); i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    pages.push(content.items.map((it) => it.str + (it.hasEOL ? "\n" : " ")).join(""));
  }
  return pages.join("\n\n");
}

const LOADING_MSGS = ["Reading your resume…", "Finding the products you shipped…", "Pulling out impact metrics…", "Framing problem → action → outcome…", "Writing your headline…", "Laying out your page…"];

$("#goBtn").addEventListener("click", async () => {
  hideErr("#importErr");
  const feed = $("#feedInput").value.trim();
  if (state.tab === "blank") { const p = blankProfile(); p.feedUrl = feed; return openEditor(p); }

  const text = state.tab === "paste" ? $("#pasteText").value.trim() : state.sourceText;
  if (!text || text.length < 80) return showErr("#importErr", state.tab === "paste" ? "Paste a bit more — your full resume or LinkedIn sections work best." : "Choose a PDF first (or switch to Paste text).");

  const loading = $("#loading"); loading.classList.add("on");
  let i = 0; const tick = setInterval(() => ($("#loadingMsg").textContent = LOADING_MSGS[++i % LOADING_MSGS.length]), 3500);
  try {
    const res = await fetch("/api/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || (res.status === 429 ? "Too many requests — wait a minute and try again." : `Something went wrong (${res.status}).`));
    const p = { ...blankProfile(), ...data.profile, theme: "paper", feedUrl: feed };
    if (!p.metrics.length) p.metrics = [{ value: "", label: "" }];
    openEditor(p);
    toast("Draft ready — review everything before publishing");
  } catch (e) {
    showErr("#importErr", `${e.message} You can also use “Start blank”.`);
  } finally { clearInterval(tick); loading.classList.remove("on"); }
});

/* ---------------- step 2: editor ---------------- */
const SECTIONS = [
  { id: "basics", title: "Basics", open: true, fields: [
    { k: "name", label: "Full name" },
    { k: "headline", label: "Headline", hint: "One line: what you build and for whom." },
    { k: "location", label: "Location" },
    { k: "about", label: "About", type: "textarea", rows: 4 },
    { k: "avatarUrl", label: "Photo URL (optional)", hint: "Leave blank to show your initials." },
    { k: "email", label: "Public email (optional)" },
    { k: "openToWork", label: "Show “Open to opportunities” badge", type: "check" },
  ]},
  { id: "theme", title: "Theme", custom: "theme" },
  { id: "metrics", title: "Impact metrics", list: "metrics", max: 6, itemLabel: "metric", fields: [
    { k: "value", label: "Number", hint: "e.g. +38%, $4.1M, 2M users" }, { k: "label", label: "What it measures" },
  ], empty: { value: "", label: "" } },
  { id: "products", title: "Products shipped", list: "products", max: 12, itemLabel: "product", fields: [
    { k: "name", label: "Product / feature" }, { k: "company", label: "Company" }, { k: "year", label: "Year" },
    { k: "problem", label: "Problem", type: "textarea" }, { k: "action", label: "What I did", type: "textarea" },
    { k: "outcome", label: "Outcome", type: "textarea", hint: "Quantify it if you can." },
    { k: "link", label: "Link (optional)" }, { k: "tags", label: "Tags", type: "csv", hint: "Comma-separated" },
  ], empty: { name: "", company: "", year: "", problem: "", action: "", outcome: "", link: "", tags: [] } },
  { id: "experience", title: "Experience", list: "experience", max: 15, itemLabel: "role", fields: [
    { k: "role", label: "Role" }, { k: "company", label: "Company" }, { k: "start", label: "Start", hint: "e.g. Jan 2022" },
    { k: "end", label: "End", hint: "Blank = Present" }, { k: "summary", label: "Summary", type: "textarea" },
    { k: "highlights", label: "Highlights", type: "lines", hint: "One per line" },
  ], empty: { role: "", company: "", start: "", end: "", summary: "", highlights: [] } },
  { id: "skills", title: "Skills & domains", fields: [
    { k: "skills", label: "Craft skills", type: "csv", hint: "e.g. Discovery, Experimentation, SQL" },
    { k: "domains", label: "Domains", type: "csv", hint: "e.g. Fintech, B2B SaaS, AI/ML" },
  ]},
  { id: "links", title: "Links & writing", fields: [
    { k: "links.linkedin", label: "LinkedIn URL" }, { k: "links.website", label: "Website" }, { k: "links.twitter", label: "X / Twitter" },
    { k: "links.producthunt", label: "Product Hunt" }, { k: "links.github", label: "GitHub" },
    { k: "feedUrl", label: "Newsletter / blog for auto-updating posts", hint: "Substack, Medium or any blog with RSS." },
  ]},
  { id: "writing", title: "Pinned writing & talks", list: "writing", max: 10, itemLabel: "post", note: "Shown when you don't have a feed above.", fields: [
    { k: "title", label: "Title" }, { k: "url", label: "URL" }, { k: "date", label: "Date (optional)" },
  ], empty: { title: "", url: "", date: "" } },
  { id: "education", title: "Education", list: "education", max: 6, itemLabel: "school", fields: [
    { k: "school", label: "School" }, { k: "degree", label: "Degree" }, { k: "years", label: "Years" },
  ], empty: { school: "", degree: "", years: "" } },
];

const getPath = (o, path) => path.split(".").reduce((a, k) => (a == null ? a : a[k]), o);
const setPath = (o, path, v) => { const ks = path.split("."); const last = ks.pop(); const t = ks.reduce((a, k) => (a[k] ??= {}), o); t[last] = v; };

function fieldHtml(f, value, idAttr) {
  const hint = f.hint ? `<small class="hint">${esc(f.hint)}</small>` : "";
  if (f.type === "check") return `<label class="check"><input type="checkbox" ${idAttr} ${value ? "checked" : ""}> ${esc(f.label)}</label>`;
  let v = value ?? "";
  if (f.type === "csv") v = (Array.isArray(v) ? v : []).join(", ");
  if (f.type === "lines") v = (Array.isArray(v) ? v : []).join("\n");
  const input = f.type === "textarea" || f.type === "lines"
    ? `<textarea ${idAttr} rows="${f.rows || 3}">${esc(v)}</textarea>`
    : `<input type="text" ${idAttr} value="${esc(v)}">`;
  return `<label class="field"><span>${esc(f.label)}</span>${input}${hint}</label>`;
}

function parseVal(f, el) {
  if (f.type === "check") return el.checked;
  if (f.type === "csv") return el.value.split(",").map((s) => s.trim()).filter(Boolean);
  if (f.type === "lines") return el.value.split("\n").map((s) => s.trim()).filter(Boolean);
  return el.value;
}

function renderSection(sec) {
  const p = state.profile;
  let body = "";
  if (sec.custom === "theme") {
    body = `<div class="themes">${Object.entries(THEMES).map(([k, t]) =>
      `<button type="button" class="theme-btn ${p.theme === k ? "on" : ""}" data-theme="${k}"><span class="sw"><i style="background:${t.bg}"></i><i style="background:${t.accent}"></i><i style="background:${t.ink}"></i></span>${t.label}</button>`).join("")}</div>`;
  } else if (sec.list) {
    const items = p[sec.list] || [];
    body = (sec.note ? `<p class="hint" style="font-size:13px;color:var(--muted);margin:0">${sec.note}</p>` : "") +
      items.map((it, i) => `<div class="item" data-i="${i}">
        <div class="mv">${i > 0 ? `<button type="button" data-up="${i}" title="Move up">↑</button>` : ""}${i < items.length - 1 ? `<button type="button" data-down="${i}" title="Move down">↓</button>` : ""}</div>
        <button type="button" class="rm" data-rm="${i}">Remove</button>
        ${sec.fields.map((f) => fieldHtml(f, it[f.k], `data-list="${sec.list}" data-i="${i}" data-k="${f.k}"`)).join("")}
      </div>`).join("") +
      (items.length < sec.max ? `<button type="button" class="add" data-add="${sec.list}">+ Add ${sec.itemLabel}</button>` : "");
  } else {
    body = sec.fields.map((f) => fieldHtml(f, getPath(p, f.k), `data-k="${f.k}"`)).join("");
  }
  const count = sec.list ? `<span class="count">${(p[sec.list] || []).length}</span>` : "";
  return `<details class="panel" data-sec="${sec.id}" ${sec.open ? "open" : ""}><summary><span>${sec.title}${count}</span></summary><div class="panel-body">${body}</div></details>`;
}

function renderEditor() {
  const openIds = new Set($$("#fields details[open]").map((d) => d.dataset.sec));
  const firstRender = !$("#fields").children.length;
  $("#fields").innerHTML = SECTIONS.map(renderSection).join("");
  if (!firstRender) $$("#fields details").forEach((d) => (d.open = openIds.has(d.dataset.sec)));
}

function rerenderSection(id) {
  const sec = SECTIONS.find((s) => s.id === id || s.list === id);
  const old = $(`#fields details[data-sec="${sec.id}"]`);
  const wasOpen = old.open;
  old.outerHTML = renderSection(sec);
  $(`#fields details[data-sec="${sec.id}"]`).open = wasOpen;
}

$("#fields").addEventListener("input", onFieldChange);
$("#fields").addEventListener("change", onFieldChange);
function onFieldChange(e) {
  const el = e.target;
  if (!el.dataset.k) return;
  if (el.dataset.list) {
    const sec = SECTIONS.find((s) => s.list === el.dataset.list);
    const f = sec.fields.find((x) => x.k === el.dataset.k);
    state.profile[el.dataset.list][+el.dataset.i][el.dataset.k] = parseVal(f, el);
  } else {
    const f = SECTIONS.flatMap((s) => s.fields || []).find((x) => x.k === el.dataset.k);
    setPath(state.profile, el.dataset.k, parseVal(f, el));
  }
  schedulePreview();
}

$("#fields").addEventListener("click", (e) => {
  const t = e.target.closest("button"); if (!t) return;
  const p = state.profile;
  if (t.dataset.theme) { p.theme = t.dataset.theme; $$(".theme-btn").forEach((b) => b.classList.toggle("on", b === t)); return schedulePreview(0); }
  const sec = t.closest("details")?.dataset.sec; const s = SECTIONS.find((x) => x.id === sec);
  if (!s?.list) return;
  const arr = p[s.list];
  if (t.dataset.add) arr.push(structuredClone(s.empty));
  else if (t.dataset.rm != null) arr.splice(+t.dataset.rm, 1);
  else if (t.dataset.up != null) { const i = +t.dataset.up; [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; }
  else if (t.dataset.down != null) { const i = +t.dataset.down; [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; }
  else return;
  rerenderSection(s.id);
  schedulePreview(0);
});

let previewTimer, previewScrollY = 0;
addEventListener("message", (e) => {
  if (e.source === $("#preview").contentWindow && typeof e.data?.pmScroll === "number") previewScrollY = e.data.pmScroll;
});
function schedulePreview(delay = 250) {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(() => {
    // The preview iframe is sandboxed (no same-origin), so it reports its scroll position
    // via postMessage and restores it itself after each re-render.
    const keepScroll = `<script>scrollTo(0,${Math.round(previewScrollY)});addEventListener("scroll",()=>parent.postMessage({pmScroll:scrollY},"*"),{passive:true})</script></body>`;
    $("#preview").srcdoc = renderPortfolio(state.profile, { posts: [] }).replace("</body>", keepScroll);
    $("#feedNote").textContent = state.profile.feedUrl ? "· feed posts load on your live page" : "";
    if (!state.editing) store.set(DRAFT_KEY, JSON.stringify({ profile: state.profile, at: Date.now() }));
  }, delay);
}

$$(".device-toggle button").forEach((b) => b.addEventListener("click", () => {
  $$(".device-toggle button").forEach((x) => x.classList.toggle("on", x === b));
  $("#preview").classList.toggle("mobile", b.dataset.dev === "mobile");
}));

function openEditor(profile) {
  state.profile = profile;
  $("#importView").hidden = true;
  $("#editorView").hidden = false;
  renderEditor();
  schedulePreview(0);
  const u = $("#username");
  if (!state.editing && !u.value) {
    const pre = new URLSearchParams(location.search).get("u");
    u.value = slug(pre || profile.name || "");
    checkAvailability();
  }
  scrollTo(0, 0);
}

$("#restartBtn").addEventListener("click", () => {
  if (state.editing) { location.href = "/create"; return; }
  if (!confirm("Start over? Your current edits will be discarded.")) return;
  store.del(DRAFT_KEY);
  $("#editorView").hidden = true; $("#importView").hidden = false;
});

/* ---------------- username + publish ---------------- */
const slug = (s) => String(s).toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32);
let availTimer, availOk = false;
$("#username").addEventListener("input", (e) => {
  const v = slug(e.target.value.replace(/\s/g, "-")) + (/-$/.test(e.target.value) ? "-" : "");
  if (v !== e.target.value) e.target.value = v;
  clearTimeout(availTimer); availTimer = setTimeout(checkAvailability, 350);
});

async function checkAvailability() {
  const u = $("#username").value.replace(/-+$/, "");
  const el = $("#avail");
  if (state.editing) { el.className = "avail ok"; el.textContent = "✓ Editing your published portfolio"; availOk = true; return; }
  if (u.length < 3) { el.className = "avail"; el.textContent = "At least 3 characters"; availOk = false; return; }
  el.className = "avail"; el.textContent = "Checking…";
  try {
    const r = await (await fetch(`/api/available/${encodeURIComponent(u)}`)).json();
    if ($("#username").value.replace(/-+$/, "") !== u) return;
    availOk = !!r.available;
    el.className = `avail ${availOk ? "ok" : "bad"}`;
    el.textContent = availOk ? `✓ ${location.host}/${u} is yours to claim` : `✗ ${r.reason || "Not available"}`;
  } catch { el.className = "avail"; el.textContent = ""; availOk = true; }
}

$("#publishBtn").addEventListener("click", async () => {
  hideErr("#pubErr");
  const username = $("#username").value.replace(/-+$/, "");
  if (!state.profile.name?.trim()) { openSection("basics"); return showErr("#pubErr", "Add your name first."); }
  if (!state.editing && !availOk) return showErr("#pubErr", "Pick an available username first.");
  const btn = $("#publishBtn"); btn.disabled = true; btn.textContent = state.editing ? "Saving…" : "Publishing…";
  try {
    const res = await fetch("/api/publish", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, profile: state.profile, key: state.key || store.get(keyFor(username)) || undefined }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Publish failed (${res.status})`);
    const live = `${location.origin}/${username}`;
    if (data.key) { state.key = data.key; store.set(keyFor(username), data.key); }
    store.del(DRAFT_KEY);
    const wasEditing = !!state.editing;
    state.editing = username;
    lockUsername();
    $("#liveUrl").value = live;
    $("#viewLive").href = live;
    $("#editUrl").value = `${location.origin}/create?edit=${username}#key=${state.key}`;
    $("#keyBlock").hidden = !data.key;
    $("#doneTitle").textContent = wasEditing ? "Changes saved" : "Your portfolio is live";
    if (wasEditing) toast("Saved — live page updates within a minute");
    else $("#doneModal").classList.add("on");
  } catch (e) { showErr("#pubErr", e.message); }
  finally { btn.disabled = false; btn.textContent = state.editing ? "Save changes" : "Publish portfolio"; }
});

function lockUsername() {
  $("#username").value = state.editing; $("#username").readOnly = true;
  $("#publishBtn").textContent = "Save changes";
  $("#stepLabel").textContent = "Editing · changes go live when you save";
  $("#restartBtn").textContent = "＋ Create a new portfolio";
  const nav = $("#topActions");
  if (!$("#viewLink")) nav.insertAdjacentHTML("afterbegin", `<a id="viewLink" class="btn sm" href="/${state.editing}" target="_blank">View live ↗</a>`);
  if (!$("#deleteBtn")) {
    $("#restartBtn").insertAdjacentHTML("afterend", `<button class="btn sm" id="deleteBtn" style="margin:8px 0 0 6px;color:var(--err)">Delete portfolio</button>`);
    $("#deleteBtn").addEventListener("click", async () => {
      if (!confirm(`Permanently delete /${state.editing}? This frees the username and can't be undone.`)) return;
      const res = await fetch("/api/publish", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: state.editing, key: state.key || store.get(keyFor(state.editing)), delete: true }) });
      if (!res.ok) return showErr("#pubErr", (await res.json().catch(() => ({}))).error || "Delete failed");
      store.del(keyFor(state.editing));
      location.href = "/";
    });
  }
  checkAvailability();
}

$("#keepEditing").addEventListener("click", () => $("#doneModal").classList.remove("on"));
$("#doneModal").addEventListener("click", (e) => { if (e.target.id === "doneModal") e.currentTarget.classList.remove("on"); });
$$("[data-copy]").forEach((b) => b.addEventListener("click", async () => {
  const v = $("#" + b.dataset.copy).value;
  try { await navigator.clipboard.writeText(v); } catch { $("#" + b.dataset.copy).select(); document.execCommand("copy"); }
  toast("Copied");
}));

/* ---------------- helpers ---------------- */
function openSection(id) { const d = $(`#fields details[data-sec="${id}"]`); if (d) { d.open = true; d.scrollIntoView({ behavior: "smooth" }); } }
function showErr(sel, msg) { const el = $(sel); el.textContent = msg; el.hidden = false; }
function hideErr(sel) { $(sel).hidden = true; }
let toastTimer;
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("on"), 2600); }

/* ---------------- boot ---------------- */
$("#hostLabel").textContent = `${location.host}/`;
(async function boot() {
  const params = new URLSearchParams(location.search);
  const editU = params.get("edit");
  if (editU) {
    const hashKey = new URLSearchParams(location.hash.slice(1)).get("key");
    if (hashKey) { store.set(keyFor(editU), hashKey); history.replaceState(null, "", `/create?edit=${encodeURIComponent(editU)}`); }
    const key = hashKey || store.get(keyFor(editU));
    try {
      const res = await fetch(`/api/profile/${encodeURIComponent(editU)}`, { headers: key ? { "x-edit-key": key } : {} });
      const data = await res.json();
      if (!res.ok) throw new Error("not found");
      if (!data.canEdit) { showErr("#importErr", `You don't have the edit key for /${editU} in this browser. Open your private edit link to make changes.`); return; }
      state.editing = editU; state.key = key;
      openEditor({ ...blankProfile(), ...data.profile });
      lockUsername();
    } catch { showErr("#importErr", `Couldn't find a portfolio at /${editU}.`); }
    return;
  }
  const draft = JSON.parse(store.get(DRAFT_KEY) || "null");
  if (draft?.profile && Date.now() - draft.at < 7 * 864e5) {
    $("#resumeDraft").innerHTML = `<button class="btn" id="resumeBtn">Continue your unsaved draft${draft.profile.name ? ` (${esc(draft.profile.name)})` : ""}</button>`;
    $("#resumeBtn").addEventListener("click", () => openEditor({ ...blankProfile(), ...draft.profile }));
  }
})();
