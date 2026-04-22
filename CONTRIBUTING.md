# Contributing to FeroxStats

Thank you for your interest in contributing! This document outlines how to get
started and what to keep in mind when submitting changes.

## Getting started

1. Fork the repository and clone your fork.
2. Follow the [setup instructions in the README](README.md#getting-started) to
   get the project running locally.
3. Create a new branch for your change:

```bash
git checkout -b feat/my-feature
```

## Development guidelines

- **TypeScript strict mode is enabled.** All new code must type-check cleanly (`npm run build`).
- **Run the linter before committing:** `npm run lint`.
- Keep changes focused — one logical change per pull request.
- If you introduce a new environment variable, add it to `.env.example` with a comment explaining its purpose.
- Do not commit `.env.local`, secrets, or any credentials.

## Commit message style

Use short, imperative-mood subjects. Examples:

- `fix: correct xp gain calculation for week period`
- `feat: add skill filter to hiscores`
- `chore: update dependencies`

## Pull request process

1. Ensure your branch is up to date with `main` before opening a PR.
2. Describe what your PR changes and why.
3. Link any related issues using `Closes #issue-number`.
4. A maintainer will review and provide feedback before merging.

## Reporting issues

Please open a GitHub issue with:

- A clear title and description
- Steps to reproduce (for bugs)
- Expected vs actual behaviour
- Browser / OS info if relevant

## Code of conduct

Be respectful and constructive. Harassment or abusive behaviour will not be tolerated.
