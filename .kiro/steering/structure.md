---
inclusion: always
---

# Structure

```
brand.json               product name, app id, repo, protocol names (single source)
packages/core/src        parse, estado, navigation, speakers, stats, minimap, project, config, state, rate,
                         hotkeys, files, text, time, i18n/{es,en}.ts   (pure; tests in packages/core/test)
packages/storage/src     host.ts (HostApi), provider.ts, localfs.ts, drive/stub.ts, testing/memoryHost.ts
packages/ui/src          App.tsx, Editor.tsx, player/, transcript/, sidebar/, project/, help/, hotkeys/,
                         i18n/, components/, styles/   (tests in packages/ui/test)
apps/desktop/src/main    index.ts, window.ts, menu.ts, security.ts, closeProtocol.ts, registry.ts,
                         host/service.ts, ipc/register.ts, fs/{authorize,atomic}.ts, store/{config,state}.ts,
                         media/{range,handler}.ts, appProtocol.ts, updates.ts
apps/desktop/src/{preload,renderer,shared}
apps/desktop/{e2e,test,scripts,build}   Playwright specs, unit tests, after-pack, icons
apps/web                 placeholder
samples/demo-session     invented demo (m4a + txt + meta + proyecto.json)
tools/transcribe         optional Python pipeline
docs/                    user guides, architecture, ADRs in docs/decisions
.kiro/ and AGENTS.md     steering and specs
scripts/                 boundary check, privacy scan, link check, Kiro check, sample generator
```

Dependency direction: `core <- storage <- ui <- apps/desktop`. `core` and `storage` import no React, Electron or Node;
`ui` imports no Electron or Node. Enforced by `npm run lint`.
