// electron-builder afterPack hook: flips Electron Fuses and ad-hoc signs unsigned macOS builds.
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { flipFuses, FuseVersion, FuseV1Options } = require("@electron/fuses");

function executablePath(context) {
  const { appOutDir, packager, electronPlatformName } = context;
  const exe = packager.executableName;
  if (electronPlatformName === "darwin") {
    const app = `${packager.appInfo.productFilename}.app`;
    return path.join(appOutDir, app, "Contents", "MacOS", packager.appInfo.productFilename);
  }
  if (electronPlatformName === "win32")
    return path.join(appOutDir, `${packager.appInfo.productFilename}.exe`);
  return path.join(appOutDir, exe);
}

exports.default = async function afterPack(context) {
  await flipFuses(executablePath(context), {
    version: FuseVersion.V1,
    resetAdHocDarwinSignature: context.electronPlatformName === "darwin",
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableCookieEncryption]: true,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
    [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
    // Not verifiable on a Linux dev machine; enable after checking packaged mac/win builds (ADR 0002).
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: false,
  });
  // Unsigned macOS builds: Apple Silicon may refuse a binary with no signature at all.
  if (
    context.electronPlatformName === "darwin" &&
    process.platform === "darwin" &&
    !process.env.CSC_LINK
  ) {
    const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
    execFileSync("codesign", ["--force", "--deep", "-s", "-", app], { stdio: "inherit" });
  }
};
