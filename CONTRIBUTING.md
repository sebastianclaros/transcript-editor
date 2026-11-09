# Contributing

Thanks for helping. This project is small and friendly; please keep it that way.

## Ground rules

- Be kind: see the [Code of Conduct](CODE_OF_CONDUCT.md).
- **Never add private data.** No real audio, transcripts, names, tokens or `.env` files. Use the invented
  data in `samples/`. `npm run check:privacy` scans the tree and the history.
- Code, identifiers, commit messages and the main README are in **English**. The app UI and the user
  docs are Spanish (default) and English; Spanish docs are named `*.es.md`.

## Setup

```bash
nvm use            # Node 22, see .nvmrc
npm ci
npm run dev
```

Before opening a pull request:

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

`npm run check` runs everything including the privacy scan, the Kiro file check and the link check.
Architecture and conventions: [docs/architecture.md](docs/architecture.md), [docs/development.md](docs/development.md).

## Pull requests

1. Open an issue first for anything bigger than a small fix.
2. One topic per pull request, with tests for behaviour changes. `packages/core` keeps its coverage gate.
3. Use [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `test:`,
   `chore:`, `build:`, `ci:`.
4. **Sign off your commits** (`git commit -s`). That adds a `Signed-off-by` line and means you agree to the
   [Developer Certificate of Origin](https://developercertificate.org/). There is no CLA.
5. Package boundaries are enforced: `core` and `storage` must not import React, Electron or Node.

## Licensing

The project is under Apache-2.0. Contributions are accepted under the same license (inbound = outbound).
If the project ever needs another license for a hosted edition, that decision and its constraints are
discussed in [ADR 0003](docs/decisions/0003-license.md) before external contributions grow.

## Reporting bugs and ideas

Use the issue forms. Questions go to GitHub Discussions. Security issues: see [SECURITY.md](SECURITY.md).
