// electron-builder configuration. Values come from ../../brand.json (single place for the name).
const brand = require("../../brand.json");
const rootPkg = require("../../package.json");

const [owner, repo] = brand.repo.split("/");
const name = brand.executableName;

/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: brand.appId,
  productName: brand.productName,
  executableName: name,
  copyright: "Copyright © Sebastian Claros and contributors",
  directories: { output: "dist", buildResources: "build" },
  files: ["out/**", "package.json"],
  asar: true,
  npmRebuild: false,
  electronLanguages: ["es", "en-US", "en"],
  extraMetadata: { version: rootPkg.version, homepage: rootPkg.homepage, author: rootPkg.author },
  extraResources: [{ from: "../../samples/demo-session", to: "samples/demo-session" }],
  afterPack: "scripts/after-pack.cjs",
  publish: { provider: "github", owner, repo, releaseType: "draft" },

  mac: {
    category: "public.app-category.productivity",
    target: [
      { target: "dmg", arch: ["x64", "arm64"] },
      { target: "zip", arch: ["x64", "arm64"] },
    ],
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: "build/entitlements.mac.plist",
    entitlementsInherit: "build/entitlements.mac.plist",
    // Unsigned by default; set CSC_LINK / CSC_KEY_PASSWORD to sign (see docs/releasing.md).
    identity: process.env.CSC_LINK ? undefined : null,
    artifactName: `${name}-\${version}-mac-\${arch}.\${ext}`,
  },
  dmg: { artifactName: `${name}-\${version}-mac-\${arch}.\${ext}` },
  win: {
    target: [
      { target: "nsis", arch: ["x64"] },
      { target: "zip", arch: ["x64"] },
    ],
    artifactName: `${name}-\${version}-win-\${arch}.\${ext}`,
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    artifactName: `${name}-\${version}-win-setup-\${arch}.\${ext}`,
  },
  linux: {
    target: [
      { target: "AppImage", arch: ["x64"] },
      { target: "deb", arch: ["x64"] },
    ],
    category: "Utility",
    maintainer: "Sebastian Claros <noreply@users.noreply.github.com>",
    synopsis: "Correct interview transcripts while listening to the audio",
    artifactName: `${name}-\${version}-linux-x86_64.\${ext}`,
  },
  deb: { artifactName: `${name}-\${version}-linux-amd64.\${ext}` },
  appImage: { artifactName: `${name}-\${version}-linux-x86_64.\${ext}` },
};
