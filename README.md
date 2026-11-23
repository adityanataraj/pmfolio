# pmfolio

**Effortless portfolios for product managers.**

Engineers have GitHub. PMs have a resume buried in a PDF. pmfolio turns your LinkedIn export or resume into a polished portfolio on your own link: shipped products, impact metrics, career timeline and writing. It takes about a minute.

Inspired by [devb.io](https://devb.io) ([source](https://github.com/sunithvs/devb.io)), which does the same for developers using GitHub.

**Live:** https://pmfolio-app.netlify.app · **Example:** https://pmfolio-app.netlify.app/demo

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/adityanataraj/pmfolio)

![pmfolio landing page](docs/landing.png)

## Features

- **One input, full portfolio.** Upload a LinkedIn "Save to PDF" export or a resume, or paste text. The PDF is parsed in the browser with pdf.js.
- **AI drafting built for PMs.** Claude extracts products shipped as *problem → what I did → outcome*, pulls out quantified impact metrics, and writes a headline and bio. It's told to use only facts from the source and never invent numbers.
- **Edit with a live preview.** Every field is editable. Four themes, desktop and mobile preview, reorder and add or remove items. Unsaved drafts are kept in the browser.
- **Your own URL.** Publish to `/your-name`. There are no accounts: each portfolio gets a private edit link (only a SHA-256 hash of the key is stored).
- **Writing that updates itself.** Point it at a Substack, Medium or any RSS blog and your latest posts appear on your page, refreshed every 6 hours.
- **Resume download.** A print stylesheet turns any portfolio into a clean PDF resume.
- **SEO-ready.** Portfolios are server-rendered with Open Graph tags.
- **No manual form needed.** You can also skip the AI and start from a blank template.

| Editor | Portfolio |
|---|---|
| ![Editor](docs/editor.png) | ![Portfolio](docs/portfolio.png) |

## How it works

```
public/                     static frontend, no build step
  index.html                landing page
  create/index.html         builder (import → edit → publish)
  create.js                 builder logic
  render.js                 shared renderer: profile JSON → HTML (used by browser preview AND server)
  styles.css
netlify/
  functions/
    generate.mts            POST /api/generate     resume text → structured profile (Claude, tool-use JSON)
    publish.mts             POST /api/publish      claim username / save edits / delete (edit-key protected)
    profile-api.mts         GET  /api/profile/:u, /api/available/:u
    page.mts                GET  /:username        server-rendered portfolio + RSS feed (cached in Blobs)
  lib/
    shared.mts              storage, validation, sanitising
    demo.mts                fictional profile served at /demo
```

- **Hosting:** Netlify (static site + Functions)
- **Storage:** Netlify Blobs: a `profiles` store (one JSON record per username) and a `feeds` store (RSS cache)
- **AI:** any OpenAI-compatible provider (free open-weight models on Groq by default), or Anthropic Claude (via your own key or Netlify AI Gateway)

## Deploy your own

1. Click **Deploy to Netlify** above, or fork the repo and import it in Netlify.
2. Set up AI, choosing one of the options below. Add the variable under *Project configuration → Environment variables* with the scope set to Functions, then redeploy.
   - **Free, open-weight (recommended):** create a free key at [console.groq.com](https://console.groq.com) (no card needed) and set `GROQ_API_KEY`. It uses `openai/gpt-oss-120b`, with `llama-3.3-70b-versatile` as a fallback.
   - **Any OpenAI-compatible API** (OpenRouter `:free` models, Together, a self-hosted Ollama or vLLM…): set `LLM_API_KEY`, `LLM_BASE_URL` and `LLM_MODELS`.
   - **Anthropic Claude:** set `ANTHROPIC_API_KEY`. Or use [Netlify AI Gateway](https://docs.netlify.com/build/ai-gateway/overview/) with no key, which needs a credit-based Netlify plan.
3. Optional: add a custom domain under *Domain management*. Portfolio URLs follow it automatically (`yourdomain.com/username`).

### Environment variables

| Variable | Purpose |
|---|---|
| `GROQ_API_KEY` | Use Groq's free open-weight models (default provider when set) |
| `LLM_API_KEY` / `LLM_BASE_URL` | Any OpenAI-compatible endpoint, e.g. `https://openrouter.ai/api/v1` (default: Groq) |
| `LLM_MODELS` | Comma-separated models to try in order, e.g. `openai/gpt-oss-120b,llama-3.3-70b-versatile` |
| `LLM_MAX_INPUT_CHARS` | Characters of resume text sent to open models (default 18000, sized for free-tier token limits) |
| `ANTHROPIC_API_KEY` | Use Claude instead (only when no `LLM_API_KEY`/`GROQ_API_KEY` is set) |
| `PMFOLIO_MODELS` | Claude models to try in order |

The order of precedence is `LLM_API_KEY`/`GROQ_API_KEY`, then Anthropic credentials. If none are set, the "Start blank" option still works.

## Local development

```bash
npm install
npx netlify-cli link        # link to your Netlify project
npx netlify-cli dev         # http://localhost:8888
```

Blobs use a local sandbox in dev. For AI generation, put `GROQ_API_KEY` (or another provider's key) in your environment.

## Roadmap

Ideas for contributors:

- [ ] Product Hunt, App Store and Notion case-study imports
- [ ] "PM Wrapped" shareable image card
- [ ] Per-portfolio view analytics
- [ ] "Contact me" form
- [ ] Case-study pages (long-form, one per product)
- [ ] More themes, and custom accent colours
- [ ] Recovering an edit key by email

## Contributing

PRs welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
