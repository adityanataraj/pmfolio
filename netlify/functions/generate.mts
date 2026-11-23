import type { Config } from "@netlify/functions";
import Anthropic from "@anthropic-ai/sdk";
import { json, sanitizeProfile } from "../lib/shared.mts";

// Models tried in order. Override with the PMFOLIO_MODELS env var (comma-separated).
const DEFAULT_MODELS = ["claude-sonnet-5-5", "claude-haiku-5-5", "claude-sonnet-4-5"];

const SYSTEM = `You turn a product manager's resume or LinkedIn export into a sharp, credible portfolio.
Rules:
- Use ONLY facts present in the source. Never invent companies, products, numbers, dates or links. If a metric isn't in the source, don't make one up.
- "headline": one line positioning statement, e.g. "Senior PM building AI-powered B2B workflows". No buzzword soup.
- "about": 2-3 first-person sentences, plain and specific, no superlatives ("passionate", "results-driven" are banned).
- "metrics": up to 4 of the most impressive quantified outcomes from the source, value short (e.g. "3.2M", "+38%", "$12M ARR"), label under 8 words.
- "products": the products/features/launches they owned. For each write problem -> what they did -> outcome, each 1-2 sentences, outcome quantified when the source has numbers. Prefer 3-6 strongest.
- "experience": reverse-chronological roles; summary 1 sentence; up to 3 highlights each, terse.
- "skills": PM craft skills (e.g. Discovery, Experimentation, Roadmapping, SQL). "domains": industries/areas (e.g. Fintech, B2B SaaS, Growth, AI/ML).
- Keep dates as written, e.g. "Mar 2021". Leave fields empty rather than guessing.`;

const S = { type: "string" } as const;
const TOOL = {
  name: "save_portfolio",
  description: "Save the structured portfolio extracted from the source.",
  input_schema: {
    type: "object",
    properties: {
      name: S, headline: S, location: S, email: S, about: S,
      links: { type: "object", properties: { linkedin: S, website: S, twitter: S, producthunt: S, substack: S, medium: S, github: S } },
      metrics: { type: "array", items: { type: "object", properties: { value: S, label: S }, required: ["value", "label"] } },
      products: { type: "array", items: { type: "object", properties: { name: S, company: S, year: S, summary: S, problem: S, action: S, outcome: S, link: S, tags: { type: "array", items: S } }, required: ["name"] } },
      experience: { type: "array", items: { type: "object", properties: { role: S, company: S, start: S, end: S, summary: S, highlights: { type: "array", items: S } }, required: ["role", "company"] } },
      education: { type: "array", items: { type: "object", properties: { school: S, degree: S, years: S } } },
      skills: { type: "array", items: S },
      domains: { type: "array", items: S },
    },
    required: ["name", "headline", "about", "metrics", "products", "experience", "skills", "domains"],
  },
};

export default async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (text.length < 80) return json({ error: "That's too little text to work with — paste your full resume or LinkedIn export." }, 400);

  if (!Netlify.env.get("ANTHROPIC_BASE_URL") && !Netlify.env.get("ANTHROPIC_API_KEY")) {
    const seen = ["ANTHROPIC_BASE_URL", "ANTHROPIC_API_KEY", "NETLIFY_AI_GATEWAY_URL", "NETLIFY_AI_GATEWAY_KEY", "OPENAI_BASE_URL"].filter((k) => !!(Netlify.env.get(k) || process.env[k]));
    console.error("generate: no Anthropic credentials; gateway vars present:", seen);
    return json({ error: "AI isn't configured on this site yet (Netlify AI Gateway inactive).", gatewayVars: seen }, 503);
  }

  const client = new Anthropic();
  const models = (Netlify.env.get("PMFOLIO_MODELS") || "").split(",").map((s) => s.trim()).filter(Boolean);
  const order = models.length ? models : DEFAULT_MODELS;
  const started = Date.now();
  let lastErr: unknown;

  for (const model of order) {
    const remaining = 55_000 - (Date.now() - started);
    if (remaining < 8_000) break;
    try {
      const msg = await client.messages.create(
        {
          model,
          max_tokens: 4000,
          system: SYSTEM,
          tools: [TOOL as any],
          tool_choice: { type: "tool", name: "save_portfolio" },
          messages: [{ role: "user", content: `Source document:\n\n<source>\n${text.slice(0, 60_000)}\n</source>` }],
        },
        { timeout: Math.min(remaining, 45_000), maxRetries: 0 }
      );
      const block: any = msg.content.find((c: any) => c.type === "tool_use");
      if (!block) throw new Error("No structured output");
      return json({ profile: sanitizeProfile(block.input), model });
    } catch (e: any) {
      lastErr = e;
      console.error(`generate: model ${model} failed`, e?.status, e?.message);
    }
  }
  return json({ error: "The AI couldn't process this right now. Try again, or start from a blank form.", detail: String((lastErr as any)?.message || lastErr) }, 502);
};

export const config: Config = {
  path: "/api/generate",
  method: "POST",
  rateLimit: { windowLimit: 8, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
