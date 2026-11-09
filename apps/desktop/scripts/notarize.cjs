// Placeholder for notarization. A no-op unless APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD / APPLE_TEAM_ID
// are set; implement with @electron/notarize when signing certificates are available (docs/releasing.md).
exports.default = async function notarize() {
  if (!process.env.APPLE_ID) {
    console.log("notarize: skipped (no APPLE_ID)");
    return;
  }
  console.log("notarize: APPLE_* variables found but notarization is not implemented yet");
};
