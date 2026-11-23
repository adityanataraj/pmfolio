// Shared portfolio renderer — used by the server (/:username pages) and the editor preview.
// Pure function: profile object in, complete HTML document out. No DOM access.

export const THEMES = {
  paper: { label: "Paper", bg: "#FAF7F2", surface: "#FFFFFF", ink: "#1B1A17", muted: "#6B665E", line: "#E7E1D7", accent: "#D9480F", accentInk: "#FFFFFF", chip: "#F1ECE3" },
  midnight: { label: "Midnight", bg: "#0D1117", surface: "#151B23", ink: "#ECEAE4", muted: "#9AA3AE", line: "#242C37", accent: "#7DD3A8", accentInk: "#0D1117", chip: "#1C232D" },
  sky: { label: "Sky", bg: "#F5F8FC", surface: "#FFFFFF", ink: "#0F1B2D", muted: "#5A6B82", line: "#DFE6F0", accent: "#2457D6", accentInk: "#FFFFFF", chip: "#E8EEF8" },
  plum: { label: "Plum", bg: "#FBF8FC", surface: "#FFFFFF", ink: "#221628", muted: "#6E6075", line: "#EAE1EE", accent: "#8E3BB5", accentInk: "#FFFFFF", chip: "#F2EAF6" },
};

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const safeUrl = (u) => {
  if (!u) return "";
  let s = String(u).trim();
  if (!/^https?:\/\//i.test(s)) {
    if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(s)) s = "https://" + s;
    else return "";
  }
  try { const url = new URL(s); return url.protocol === "http:" || url.protocol === "https:" ? url.href : ""; } catch { return ""; }
};

const list = (a) => (Array.isArray(a) ? a.filter(Boolean) : []);
const has = (s) => typeof s === "string" ? s.trim().length > 0 : !!s;
const initials = (name) => String(name || "PM").trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("") || "PM";
const fmtDate = (d) => { const t = Date.parse(d); return isNaN(t) ? esc(d || "") : new Date(t).toLocaleDateString("en-US", { month: "short", year: "numeric" }); };

const LINK_LABELS = { linkedin: "LinkedIn", website: "Website", twitter: "X / Twitter", producthunt: "Product Hunt", substack: "Newsletter", medium: "Medium", github: "GitHub", email: "Email" };

function linkChips(p) {
  const links = p.links || {};
  const out = [];
  for (const k of Object.keys(LINK_LABELS)) {
    if (k === "email") continue;
    const u = safeUrl(links[k]);
    if (u) out.push(`<a class="chip link" href="${esc(u)}" target="_blank" rel="noopener">${LINK_LABELS[k]} ↗</a>`);
  }
  if (has(p.email)) out.push(`<a class="chip link" href="mailto:${esc(p.email)}">${esc(p.email)}</a>`);
  return out.join("");
}

function section(id, title, body, kicker) {
  if (!body) return "";
  return `<section id="${id}" class="sec"><div class="sec-head">${kicker ? `<span class="kicker">${esc(kicker)}</span>` : ""}<h2>${esc(title)}</h2></div>${body}</section>`;
}

export function renderPortfolio(p = {}, opts = {}) {
  const theme = THEMES[p.theme] || THEMES.paper;
  const posts = list(opts.posts).length ? list(opts.posts) : list(p.writing);
  const name = p.name || "Your Name";
  const username = opts.username || "";
  const siteUrl = opts.siteUrl || "";

  const metrics = list(p.metrics).filter((m) => has(m.value) || has(m.label));
  const products = list(p.products).filter((x) => has(x.name));
  const exp = list(p.experience).filter((x) => has(x.role) || has(x.company));
  const edu = list(p.education).filter((x) => has(x.school));
  const skills = list(p.skills);
  const domains = list(p.domains);

  const metricsHtml = metrics.length ? `<div class="metrics">${metrics.map((m) => `<div class="metric"><div class="mv">${esc(m.value)}</div><div class="ml">${esc(m.label)}</div></div>`).join("")}</div>` : "";

  const productsHtml = products.length ? `<div class="products">${products.map((x) => {
    const link = safeUrl(x.link);
    const tags = list(x.tags);
    const row = (k, v) => has(v) ? `<div class="par"><span class="par-k">${k}</span><p>${esc(v)}</p></div>` : "";
    return `<article class="card product">
      <div class="p-top"><div><h3>${esc(x.name)}</h3><div class="meta">${esc([x.company, x.year].filter(has).join(" · "))}</div></div>${link ? `<a class="p-link" href="${esc(link)}" target="_blank" rel="noopener" aria-label="Open ${esc(x.name)}">↗</a>` : ""}</div>
      ${has(x.summary) ? `<p class="p-sum">${esc(x.summary)}</p>` : ""}
      ${row("Problem", x.problem)}${row("What I did", x.action)}${row("Outcome", x.outcome)}
      ${tags.length ? `<div class="chips">${tags.map((t) => `<span class="chip sm">${esc(t)}</span>`).join("")}</div>` : ""}
    </article>`;
  }).join("")}</div>` : "";

  const expHtml = exp.length ? `<ol class="timeline">${exp.map((x) => {
    const hl = list(x.highlights);
    return `<li class="tl-item"><div class="tl-dot"></div><div class="tl-body">
      <div class="tl-head"><h3>${esc(x.role)}${has(x.company) ? ` <span class="at">@ ${esc(x.company)}</span>` : ""}</h3><span class="dates">${esc([x.start, x.end || (has(x.start) ? "Present" : "")].filter(has).join(" — "))}</span></div>
      ${has(x.summary) ? `<p>${esc(x.summary)}</p>` : ""}
      ${hl.length ? `<ul class="hl">${hl.map((h) => `<li>${esc(h)}</li>`).join("")}</ul>` : ""}
    </div></li>`;
  }).join("")}</ol>` : "";

  const skillsHtml = skills.length || domains.length ? `<div class="two">
    ${skills.length ? `<div><h4>Craft</h4><div class="chips">${skills.map((s) => `<span class="chip">${esc(s)}</span>`).join("")}</div></div>` : ""}
    ${domains.length ? `<div><h4>Domains</h4><div class="chips">${domains.map((s) => `<span class="chip">${esc(s)}</span>`).join("")}</div></div>` : ""}
  </div>` : "";

  const postsHtml = posts.length ? `<ul class="posts">${posts.slice(0, 6).map((w) => {
    const u = safeUrl(w.url || w.link);
    return `<li><a href="${esc(u || "#")}" target="_blank" rel="noopener"><span class="pt">${esc(w.title)}</span><span class="pd">${has(w.date) ? fmtDate(w.date) : ""} ↗</span></a></li>`;
  }).join("")}</ul>` : "";

  const eduHtml = edu.length ? `<div class="edu">${edu.map((e) => `<div class="edu-item"><strong>${esc(e.school)}</strong><span>${esc([e.degree, e.years].filter(has).join(" · "))}</span></div>`).join("")}</div>` : "";

  const avatar = safeUrl(p.avatarUrl);
  const title = `${name}${has(p.headline) ? " — " + p.headline : ""}`;
  const desc = (p.about || p.headline || `${name}'s product portfolio`).slice(0, 160);

  const navItems = [
    products.length && ["products", "Products"],
    exp.length && ["experience", "Experience"],
    posts.length && ["writing", "Writing"],
  ].filter(Boolean);

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="profile">${siteUrl && username ? `<meta property="og:url" content="${esc(siteUrl + "/" + username)}"><link rel="canonical" href="${esc(siteUrl + "/" + username)}">` : ""}
${avatar ? `<meta property="og:image" content="${esc(avatar)}">` : ""}
<meta name="twitter:card" content="summary">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='46' fill='${encodeURIComponent(theme.accent)}'/%3E%3Ctext x='50' y='66' font-size='46' text-anchor='middle' fill='white' font-family='Georgia'%3E${encodeURIComponent(initials(name)[0])}%3C/text%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
:root{--bg:${theme.bg};--surface:${theme.surface};--ink:${theme.ink};--muted:${theme.muted};--line:${theme.line};--accent:${theme.accent};--accent-ink:${theme.accentInk};--chip:${theme.chip}}
*{box-sizing:border-box}html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 Inter,system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased}
a{color:inherit}
.wrap{max-width:920px;margin:0 auto;padding:0 24px}
.nav{position:sticky;top:0;z-index:5;background:color-mix(in srgb,var(--bg) 85%,transparent);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
.nav .wrap{display:flex;align-items:center;justify-content:space-between;height:60px;gap:16px}
.brand{font-family:Fraunces,serif;font-weight:600;font-size:18px;text-decoration:none}
.nav-links{display:flex;gap:20px;align-items:center;font-size:14px;color:var(--muted)}
.nav-links a{text-decoration:none}.nav-links a:hover{color:var(--ink)}
.btn{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);background:var(--surface);color:var(--ink);padding:8px 14px;border-radius:999px;font:500 13px Inter,sans-serif;cursor:pointer;text-decoration:none}
.btn:hover{border-color:var(--ink)}
.hero{padding:72px 0 40px}
.hero-top{display:flex;gap:24px;align-items:center;margin-bottom:24px}
.avatar{width:84px;height:84px;border-radius:50%;flex:none;background:var(--accent);color:var(--accent-ink);display:grid;place-items:center;font:600 28px Fraunces,serif;object-fit:cover}
h1{font:600 clamp(38px,6vw,60px)/1.05 Fraunces,serif;letter-spacing:-.02em;margin:0}
.headline{font-size:clamp(18px,2.4vw,22px);color:var(--muted);margin:10px 0 0;max-width:680px}
.badges{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0 0;align-items:center;font-size:14px;color:var(--muted)}
.otw{display:inline-flex;align-items:center;gap:6px;color:var(--ink);background:var(--chip);padding:4px 10px;border-radius:999px;font-weight:500}
.otw::before{content:"";width:8px;height:8px;border-radius:50%;background:#22C55E}
.about{font-size:18px;max-width:700px;margin:26px 0 0}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.chip{background:var(--chip);border:1px solid transparent;padding:6px 12px;border-radius:999px;font-size:14px;text-decoration:none}
.chip.sm{font-size:12px;padding:3px 10px}
.chip.link:hover{border-color:var(--ink)}
.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:1px;background:var(--line);border:1px solid var(--line);border-radius:18px;overflow:hidden;margin:8px 0 0}
.metric{background:var(--surface);padding:24px}
.mv{font:600 clamp(30px,4vw,40px)/1 Fraunces,serif;color:var(--accent);letter-spacing:-.02em}
.ml{color:var(--muted);font-size:14px;margin-top:8px;line-height:1.4}
.sec{padding:48px 0;border-top:1px solid var(--line)}
.sec-head{margin-bottom:26px}
.kicker{font-size:12px;text-transform:uppercase;letter-spacing:.12em;color:var(--accent);font-weight:600}
h2{font:600 30px/1.2 Fraunces,serif;margin:4px 0 0;letter-spacing:-.01em}
h3{font-size:18px;margin:0;font-weight:600;line-height:1.35}
h4{font-size:13px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin:0;font-weight:600}
.products{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,400px),1fr));gap:18px}
.card{background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:24px}
.p-top{display:flex;justify-content:space-between;gap:12px}
.meta{color:var(--muted);font-size:14px;margin-top:2px}
.p-link{width:34px;height:34px;border-radius:50%;border:1px solid var(--line);display:grid;place-items:center;text-decoration:none;flex:none}
.p-link:hover{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}
.p-sum{margin:14px 0 0}
.par{margin-top:14px}.par p{margin:2px 0 0}
.par-k{font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);font-weight:600}
.par:last-of-type p{font-weight:500}
.timeline{list-style:none;margin:0;padding:0;position:relative}
.timeline::before{content:"";position:absolute;left:5px;top:8px;bottom:8px;width:2px;background:var(--line)}
.tl-item{position:relative;padding:0 0 30px 32px}
.tl-dot{position:absolute;left:0;top:7px;width:12px;height:12px;border-radius:50%;background:var(--bg);border:2px solid var(--accent)}
.tl-head{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:baseline}
.at{color:var(--muted);font-weight:500}
.dates{color:var(--muted);font-size:14px;white-space:nowrap}
.tl-body p{margin:6px 0 0;color:var(--ink)}
.hl{margin:8px 0 0;padding-left:18px}.hl li{margin:4px 0}
.two{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:28px}
.posts{list-style:none;margin:0;padding:0}
.posts li{border-bottom:1px solid var(--line)}
.posts a{display:flex;justify-content:space-between;gap:16px;padding:14px 0;text-decoration:none}
.posts a:hover .pt{color:var(--accent)}
.pt{font-weight:500}.pd{color:var(--muted);font-size:14px;white-space:nowrap}
.edu{display:grid;gap:12px}.edu-item{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}.edu-item span{color:var(--muted)}
footer{border-top:1px solid var(--line);padding:32px 0 48px;color:var(--muted);font-size:14px}
footer .wrap{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
footer a{color:var(--accent);text-decoration:none;font-weight:500}
@media (max-width:640px){.nav-links a.nl{display:none}.hero{padding:44px 0 28px}.hero-top{flex-direction:column;align-items:flex-start}}
@media print{
  :root{--bg:#fff;--surface:#fff;--ink:#111;--muted:#555;--line:#ddd;--chip:#f2f2f2}
  .nav,footer,.no-print,.p-link{display:none!important}
  body{font-size:11pt}.hero{padding:0 0 12px}.sec{padding:14px 0;break-inside:auto}
  .card,.tl-item,.metric{break-inside:avoid}.products{grid-template-columns:1fr 1fr;gap:10px}.card{padding:12px;border-radius:8px}
  .metrics{border-radius:8px}.metric{padding:10px}.mv{font-size:22pt}h1{font-size:30pt}h2{font-size:16pt}
  a[href^="http"].chip::after{content:" (" attr(href) ")";font-size:9pt;color:#555}
}
</style></head>
<body>
<nav class="nav"><div class="wrap">
  <a class="brand" href="#top">${esc(name)}</a>
  <div class="nav-links">${navItems.map(([id, l]) => `<a class="nl" href="#${id}">${l}</a>`).join("")}
    <button class="btn no-print" onclick="window.print()" title="Save as PDF">↓ Resume</button></div>
</div></nav>
<main class="wrap" id="top">
  <header class="hero">
    <div class="hero-top">${avatar ? `<img class="avatar" src="${esc(avatar)}" alt="${esc(name)}">` : `<div class="avatar" aria-hidden="true">${esc(initials(name))}</div>`}
      <div><h1>${esc(name)}</h1>${has(p.headline) ? `<p class="headline">${esc(p.headline)}</p>` : ""}</div></div>
    <div class="badges">${p.openToWork ? `<span class="otw">Open to opportunities</span>` : ""}${has(p.location) ? `<span>📍 ${esc(p.location)}</span>` : ""}</div>
    ${has(p.about) ? `<p class="about">${esc(p.about)}</p>` : ""}
    <div class="chips">${linkChips(p)}</div>
  </header>
  ${metricsHtml ? `<div class="sec-metrics">${metricsHtml}</div><div style="height:40px"></div>` : ""}
  ${section("products", "Products I've shipped", productsHtml, "Work")}
  ${section("experience", "Experience", expHtml, "Career")}
  ${section("skills", "Skills & domains", skillsHtml, "Toolkit")}
  ${section("writing", "Writing", postsHtml, "Thinking")}
  ${section("education", "Education", eduHtml, "Learning")}
</main>
<footer><div class="wrap"><span>© ${new Date().getFullYear()} ${esc(name)}</span><span>Built with <a href="/" target="_top">pmfolio</a> · <a href="/create" target="_top">Create yours →</a></span></div></footer>
</body></html>`;
}
