import type { Config } from "@netlify/functions";
import Anthropic from "@anthropic-ai/sdk";
import { json, sanitizeProfile } from "../lib/shared.mts";

// Claude models tried in order. Override with the PMFOLIO_MODELS env var (comma-separated).
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

// ---- Providers ---------------------------------------------------------------
// 1. Any OpenAI-compatible endpoint (Groq, OpenRouter, Together, Ollama…) when
//    LLM_API_KEY or GROQ_API_KEY is set. Defaults to Groq's free tier.
// 2. Otherwise Anthropic Claude (ANTHROPIC_API_KEY, or Netlify AI Gateway credentials).
const GROQ_BASE = "https://api.groq.com/openai/v1";
const DEFAULT_OPEN_MODELS = ["openai/gpt-oss-120b", "llama-3.3-70b-versatile"];

type Provider = { kind: "openai"; baseURL: string; apiKey: string; models: string[]; maxChars: number }
  | { kind: "anthropic"; models: string[]; maxChars: number };

const envList = (k: string) => (Netlify.env.get(k) || "").split(",").map((s) => s.trim()).filter(Boolean);

function pickProvider(): Provider | null {
  const apiKey = Netlify.env.get("LLM_API_KEY") || Netlify.env.get("GROQ_API_KEY");
  if (apiKey) {
    const models = envList("LLM_MODELS").length ? envList("LLM_MODELS") : envList("PMFOLIO_MODELS");
    return {
      kind: "openai",
      baseURL: (Netlify.env.get("LLM_BASE_URL") || GROQ_BASE).replace(/\/+$/, ""),
      apiKey,
      models: models.length ? models : DEFAULT_OPEN_MODELS,
      // Free tiers have small tokens-per-minute budgets; keep the prompt lean.
      maxChars: Number(Netlify.env.get("LLM_MAX_INPUT_CHARS")) || 18_000,
    };
  }
  if (Netlify.env.get("ANTHROPIC_BASE_URL") || Netlify.env.get("ANTHROPIC_API_KEY")) {
    const models = envList("PMFOLIO_MODELS");
    return { kind: "anthropic", models: models.length ? models : DEFAULT_MODELS, maxChars: 60_000 };
  }
  return null;
}

const userPrompt = (text: string) => `Source document:\n\n<source>\n${text}\n</source>`;

async function callAnthropic(model: string, text: string, timeout: number) {
  const client = new Anthropic();
  const msg = await client.messages.create(
    {
      model,
      max_tokens: 4000,
      system: SYSTEM,
      tools: [TOOL as any],
      tool_choice: { type: "tool", name: "save_portfolio" },
      messages: [{ role: "user", content: userPrompt(text) }],
    },
    { timeout, maxRetries: 0 }
  );
  const block: any = msg.content.find((c: any) => c.type === "tool_use");
  if (!block) throw new Error("No structured output");
  return block.input;
}

async function callOpenAICompat(p: Extract<Provider, { kind: "openai" }>, model: string, text: string, timeout: number) {
  const body: any = {
    model,
    max_tokens: 3500,
    temperature: 0.3,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: userPrompt(text) },
    ],
    tools: [{ type: "function", function: { name: TOOL.name, description: TOOL.description, parameters: TOOL.input_schema } }],
    tool_choice: { type: "function", function: { name: TOOL.name } },
  };
  if (/gpt-oss/i.test(model)) body.reasoning_effort = "low";

  const res = await fetch(`${p.baseURL}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${p.apiKey}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: any = new Error(data?.error?.message || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const msg = data?.choices?.[0]?.message || {};
  const args = msg.tool_calls?.[0]?.function?.arguments;
  if (args) return typeof args === "string" ? JSON.parse(args) : args;
  // Some models answer with plain JSON instead of a tool call.
  const m = String(msg.content || "").match(/\{[\s\S]*\}/);
  if (m) return JSON.parse(m[0]);
  throw new Error("No structured output");
}

export default async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (text.length < 80) return json({ error: "That's too little text to work with — paste your full resume or LinkedIn export." }, 400);

  const provider = pickProvider();
  if (!provider) {
    console.error("generate: no AI provider configured (set GROQ_API_KEY, LLM_API_KEY or ANTHROPIC_API_KEY)");
    return json({ error: "AI isn't configured on this site yet. You can still start from a blank form." }, 503);
  }

  const source = text.slice(0, provider.maxChars);
  const started = Date.now();
  let lastErr: any;

  for (const model of provider.models) {
    const remaining = 55_000 - (Date.now() - started);
    if (remaining < 8_000) break;
    const timeout = Math.min(remaining, 45_000);
    try {
      const out = provider.kind === "openai"
        ? await callOpenAICompat(provider, model, source, timeout)
        : await callAnthropic(model, source, timeout);
      return json({ profile: sanitizeProfile(out), model });
    } catch (e: any) {
      lastErr = e;
      console.error(`generate: ${provider.kind} model ${model} failed`, e?.status, e?.message);
    }
  }
  const busy = lastErr?.status === 429;
  return json({
    error: busy
      ? "The free AI tier is busy right now — wait a minute and try again, or start from a blank form."
      : "The AI couldn't process this right now. Try again, or start from a blank form.",
  }, busy ? 429 : 502);
};

export const config: Config = {
  path: "/api/generate",
  method: "POST",
  rateLimit: { windowLimit: 8, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
