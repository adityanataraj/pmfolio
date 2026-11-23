import type { Config, Context } from "@netlify/functions";
import { renderPortfolio } from "../../public/render.js";
import { feeds, profiles, USERNAME_RE } from "../lib/shared.mts";
import { DEMO } from "../lib/demo.mts";

const FEED_TTL_MS = 6 * 60 * 60 * 1000; // refresh writing feeds every 6 hours

// Normalise a Substack / Medium / blog URL into an RSS feed URL.
export function feedUrlFor(raw: string): string {
  if (!raw) return "";
  let s = raw.trim();
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  let u: URL;
  try { u = new URL(s); } catch { return ""; }
  const host = u.hostname.toLowerCase();
  if (host === "medium.com" || host === "www.medium.com") {
    const m = u.pathname.match(/^\/(?:feed\/)?(@[^/]+)/);
    return m ? `https://medium.com/feed/${m[1]}` : "";
  }
  if (host.endsWith(".medium.com")) return `https://${host}/feed`;
  if (host.endsWith(".substack.com")) return `https://${host}/feed`;
  if (/\/(feed|rss)(\.xml)?\/?$/i.test(u.pathname) || /\.xml$/i.test(u.pathname)) return u.href;
  return `${u.origin}/feed`; // most Substack custom domains & WordPress
}

const decode = (s: string) =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).trim();

export function parseFeed(xml: string) {
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>/g) || xml.match(/<entry[\s>][\s\S]*?<\/entry>/g) || [];
  return items.slice(0, 6).map((it) => {
    const tag = (t: string) => { const m = it.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)<\\/${t}>`)); return m ? decode(m[1]) : ""; };
    let link = tag("link");
    if (!link) { const m = it.match(/<link[^>]*href="([^"]+)"/); link = m ? m[1] : ""; }
    return { title: tag("title"), url: link, date: tag("pubDate") || tag("published") || tag("updated") };
  }).filter((x) => x.title && x.url);
}

async function getPosts(feedSource: string, context: Context) {
  const url = feedUrlFor(feedSource);
  if (!url) return [];
  const store = feeds();
  const key = encodeURIComponent(url).slice(0, 500);
  const cached: any = await store.get(key, { type: "json" }).catch(() => null);
  if (cached && Date.now() - cached.at < FEED_TTL_MS) return cached.posts;

  const refresh = (async () => {
    try {
      const res = await fetch(url, { headers: { "user-agent": "pmfolio/1.0 (+portfolio feed reader)" }, signal: AbortSignal.timeout(4000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const posts = parseFeed(await res.text());
      await store.setJSON(key, { at: Date.now(), posts });
      return posts;
    } catch (e) {
      console.warn("feed fetch failed", url, String(e));
      return cached?.posts || [];
    }
  })();

  // Stale cache: serve it now, refresh in the background. No cache: wait for the fetch.
  if (cached) { context.waitUntil(refresh); return cached.posts; }
  return refresh;
}

const notFound = (username: string) => new Response(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Not found · pmfolio</title><link rel="stylesheet" href="/styles.css"></head>
<body class="center-page"><main><p class="kicker">404</p><h1 class="display">No portfolio at /${username.replace(/[^a-z0-9-]/g, "")} yet.</h1><p class="lede">This username is still available.</p><p><a class="btn primary" href="/create?u=${encodeURIComponent(username)}">Claim it →</a> <a class="btn" href="/">Home</a></p></main></body></html>`,
  { status: 404, headers: { "content-type": "text/html; charset=utf-8" } });

export default async (req: Request, context: Context) => {
  const username = String(context.params.username || "").toLowerCase();
  if (!USERNAME_RE.test(username)) return notFound(username);

  let profile: any;
  if (username === "demo") profile = DEMO;
  else {
    const rec: any = await profiles().get(username, { type: "json" });
    if (!rec) return notFound(username);
    profile = rec.profile;
  }

  const feedSource = profile.feedUrl || profile.links?.substack || profile.links?.medium || "";
  const posts = feedSource ? await getPosts(feedSource, context) : [];
  const siteUrl = new URL(req.url).origin;

  return new Response(renderPortfolio(profile, { posts, username, siteUrl }), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=0, must-revalidate",
      "netlify-cdn-cache-control": "public, s-maxage=60, stale-while-revalidate=600",
    },
  });
};

export const config: Config = {
  path: "/:username",
  preferStatic: true,
  method: "GET",
};
