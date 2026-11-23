import type { Config, Context } from "@netlify/functions";
import { json, profiles, publicRecord, RESERVED, sha256, USERNAME_RE } from "../lib/shared.mts";

// GET /api/available/:username  -> { available, reason? }
// GET /api/profile/:username    -> public profile JSON (+ canEdit when a valid key is sent)
export default async (req: Request, context: Context) => {
  const username = String(context.params.username || "").toLowerCase();
  const isAvailability = new URL(req.url).pathname.startsWith("/api/available/");

  if (!USERNAME_RE.test(username)) {
    return isAvailability ? json({ available: false, reason: "3–32 characters: lowercase letters, numbers, hyphens" }) : json({ error: "Not found" }, 404);
  }

  const rec: any = await profiles().get(username, { type: "json" });

  if (isAvailability) {
    if (RESERVED.has(username)) return json({ available: false, reason: "Reserved" });
    return json({ available: !rec, reason: rec ? "Taken" : undefined });
  }

  if (!rec) return json({ error: "Not found" }, 404);
  const key = req.headers.get("x-edit-key") || "";
  const canEdit = !!key && (await sha256(key)) === rec.keyHash;
  return json({ ...publicRecord(rec), canEdit });
};

export const config: Config = {
  path: ["/api/profile/:username", "/api/available/:username"],
  method: "GET",
};
