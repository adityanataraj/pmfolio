import type { Config } from "@netlify/functions";
import { json, newKey, profiles, RESERVED, sanitizeProfile, sha256, USERNAME_RE } from "../lib/shared.mts";

// POST /api/publish  { username, profile, key? }
// New username  -> claims it, returns a one-time edit key.
// Existing one  -> requires the matching edit key.
export default async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const username = String(body?.username || "").toLowerCase().trim();
  if (!USERNAME_RE.test(username)) return json({ error: "Usernames are 3–32 characters: lowercase letters, numbers and hyphens." }, 400);
  if (RESERVED.has(username)) return json({ error: "That username is reserved. Try another." }, 409);

  const store = profiles();
  const existing: any = await store.get(username, { type: "json" });

  // { username, key, delete: true } removes a portfolio and frees the username.
  if (body?.delete === true) {
    const key = String(body?.key || "");
    if (!existing) return json({ error: "Not found" }, 404);
    if (!key || (await sha256(key)) !== existing.keyHash) return json({ error: "Invalid edit key." }, 403);
    await store.delete(username);
    return json({ ok: true, deleted: true, username });
  }

  const profile = sanitizeProfile(body?.profile);
  if (!profile.name) return json({ error: "Add your name before publishing." }, 400);
  const now = new Date().toISOString();

  if (existing) {
    const key = String(body?.key || "");
    if (!key || (await sha256(key)) !== existing.keyHash) {
      return json({ error: "That username is taken. If it's yours, open your private edit link." }, 409);
    }
    await store.setJSON(username, { ...existing, profile, updatedAt: now });
    return json({ ok: true, username, url: `/${username}`, updated: true });
  }

  const key = newKey();
  const { modified } = await store.setJSON(
    username,
    { username, profile, keyHash: await sha256(key), createdAt: now, updatedAt: now },
    { onlyIfNew: true }
  );
  if (!modified) return json({ error: "Someone just claimed that username. Try another." }, 409);
  return json({ ok: true, username, url: `/${username}`, key, created: true });
};

export const config: Config = {
  path: "/api/publish",
  method: "POST",
  rateLimit: { windowLimit: 20, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
