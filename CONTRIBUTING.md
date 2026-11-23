# Contributing to pmfolio

Thanks for helping make portfolios easier for product people!

## Getting started

1. Fork the repo and clone your fork.
2. Run `npm install`, then `npx netlify-cli dev` (see the README for AI setup).
3. Create a branch: `git checkout -b feat/short-description`.

## Guidelines

- **No build step.** The frontend is plain HTML, CSS and ES modules. Please keep it that way unless there's a strong reason.
- **One renderer.** `public/render.js` produces portfolio HTML for both the browser preview and the server. Change it there, and keep it free of DOM access.
- **Escape everything.** User content must go through `esc()`, and URLs through `safeUrl()`, in `render.js`.
- **Whitelist new profile fields** in `sanitizeProfile()` in `netlify/lib/shared.mts`, or they won't be saved.
- **Never fabricate.** If you change the AI prompt in `generate.mts`, keep the rule that the model must only use facts from the source.
- Keep functions in TypeScript (`.mts`) and read env vars with `Netlify.env.get()`.

## Pull requests

- Describe the change and add a screenshot for anything visual.
- Check the main flow by hand: import → edit → publish → view → edit via the edit link.
- Keep PRs focused. One feature or fix per PR.

## Reporting bugs

Open an issue with steps to reproduce, what you expected, and what happened. Please don't include real resumes. Use made-up data.
