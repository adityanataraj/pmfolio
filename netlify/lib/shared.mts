import { getStore } from "@netlify/blobs";

export const profiles = () => getStore({ name: "profiles", consistency: "strong" });
export const feeds = () => getStore("feeds");

export const USERNAME_RE = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/;
export const RESERVED = new Set([
  "api", "create", "edit", "admin", "login", "logout", "signup", "settings", "about", "pricing", "privacy",
  "terms", "help", "support", "docs", "blog", "static", "assets", "public", "app", "www", "pmfolio",
  "dashboard", "explore", "examples", "example", "netlify", "index", "home", "new", "demo",
]);

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8" } });

export async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function newKey() {
  const a = new Uint8Array(24);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const str = (v: unknown, max = 500) => (typeof v === "string" ? v.slice(0, max).trim() : "");
function arr<T>(v: unknown, max: number, fn: (x: any) => T): T[] {
  return Array.isArray(v) ? v.slice(0, max).map(fn) : [];
}
const strs = (v: unknown, max: number, len = 60) => arr(v, max, (x) => str(x, len)).filter(Boolean);

// Whitelists every field and caps sizes so stored profiles stay clean.
export function sanitizeProfile(p: any) {
  p = p && typeof p === "object" ? p : {};
  const links = p.links && typeof p.links === "object" ? p.links : {};
  return {
    name: str(p.name, 80),
    headline: str(p.headline, 160),
    location: str(p.location, 80),
    email: str(p.email, 120),
    avatarUrl: str(p.avatarUrl, 500),
    openToWork: !!p.openToWork,
    about: str(p.about, 1200),
    theme: ["paper", "midnight", "sky", "plum"].includes(p.theme) ? p.theme : "paper",
    feedUrl: str(p.feedUrl, 300),
    links: Object.fromEntries(
      ["linkedin", "website", "twitter", "producthunt", "substack", "medium", "github"].map((k) => [k, str(links[k], 300)])
    ),
    metrics: arr(p.metrics, 6, (m) => ({ value: str(m?.value, 24), label: str(m?.label, 90) })),
    products: arr(p.products, 12, (x) => ({
      name: str(x?.name, 80), company: str(x?.company, 80), year: str(x?.year, 20), summary: str(x?.summary, 300),
      problem: str(x?.problem, 600), action: str(x?.action, 600), outcome: str(x?.outcome, 600),
      link: str(x?.link, 300), tags: strs(x?.tags, 6, 30),
    })),
    experience: arr(p.experience, 15, (x) => ({
      role: str(x?.role, 100), company: str(x?.company, 100), start: str(x?.start, 30), end: str(x?.end, 30),
      summary: str(x?.summary, 600), highlights: strs(x?.highlights, 6, 300),
    })),
    education: arr(p.education, 6, (x) => ({ school: str(x?.school, 120), degree: str(x?.degree, 120), years: str(x?.years, 30) })),
    skills: strs(p.skills, 20, 40),
    domains: strs(p.domains, 12, 40),
    writing: arr(p.writing, 10, (x) => ({ title: str(x?.title, 160), url: str(x?.url, 300), date: str(x?.date, 30) })),
  };
}

export function publicRecord(rec: any) {
  if (!rec) return null;
  const { keyHash, ...rest } = rec;
  return rest;
}
