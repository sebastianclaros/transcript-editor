# Requirements: Packaging and releases

Status: implemented in v0.1. Acceptance criteria use EARS.

1. THE SYSTEM SHALL build installers for macOS (Intel and Apple Silicon), Windows and Linux from one config.
2. WHEN a tag `v*` is pushed THE SYSTEM SHALL build all platforms and create a draft release with checksums.
3. THE SYSTEM SHALL harden the binary with Electron Fuses.
4. THE SYSTEM SHALL provide a `--smoke-test` flag that proves the packaged app boots.
5. WHERE builds are unsigned THE SYSTEM SHALL document how to open them and keep updates notify-only.
