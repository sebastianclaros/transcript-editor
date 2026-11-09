# Security policy

## Reporting a vulnerability

Please **do not open a public issue**. Use GitHub's private vulnerability reporting:
_Security_ tab of the repository, then _Report a vulnerability_. You will get an answer as soon as
the maintainer can, normally within a week.

Useful details: affected version and OS, steps to reproduce, and impact.

## Scope

The app is local-first and has no server. Relevant areas are the Electron security model
(context isolation, sandbox, IPC validation, path authorization, the `app-media://` protocol and the
Content-Security-Policy), parsing of untrusted transcript and project files, and the release pipeline.
See [docs/architecture.md](docs/architecture.md).

## Supported versions

Only the latest release receives fixes while the project is at version 0.x.
