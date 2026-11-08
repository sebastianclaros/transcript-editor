// Privacy patterns. EVERY pattern is assembled from fragments at runtime so that no tracked
// file contains a forbidden literal (the scanner can scan itself). See design 11.2.
const j = (...parts) => parts.join("");
const word = (...parts) => new RegExp(`\\b${j(...parts)}\\b`, "i");

/** Content patterns: { id, re, tier } scanned line by line. */
export const CONTENT_PATTERNS = [
  { id: "github-token", re: new RegExp(`${j("gh", "[pousr]", "_")}[A-Za-z0-9]{20,}`) },
  { id: "github-pat", re: new RegExp(`${j("github", "_pat", "_")}[A-Za-z0-9_]{20,}`) },
  { id: "google-api-key", re: new RegExp(`${j("AI", "za")}[0-9A-Za-z_-]{30,}`) },
  { id: "hf-token", re: new RegExp(`${j("h", "f_")}[A-Za-z0-9]{20,}`) },
  { id: "private-key", re: new RegExp(`-----BEGIN (?:[A-Z]+ )?${j("PRIVATE", " KEY")}-----`) },
  { id: "author-home-path", re: new RegExp(j("/ho", "me/", "flow")) },
  {
    id: "users-path",
    re: new RegExp(
      `${j("/Us", "ers/")}(?!<|you\\b|user\\b|username\\b|yourname\\b|name\\b|Shared\\b|\\$|\\{|\\*|%)[A-Za-z0-9._-]+`,
    ),
  },
  { id: "windows-users-path", re: new RegExp(j("[A-Za-z]:", "\\\\+", "Us", "ers", "\\\\+")) },
  { id: "real-name-a", re: word("so", "fi") },
  { id: "real-name-b", re: word("ale", "xis") },
  {
    id: "oauth-client-id-value",
    re: new RegExp(`[0-9]{6,}-[a-z0-9]{8,}\\.apps\\.${j("google", "usercontent")}\\.com`),
  },
  {
    id: "oauth-secret-value",
    re: new RegExp(`${j("client", "_secret")}"?\\s*[:=]\\s*"?[A-Za-z0-9_-]{8,}`),
  },
  { id: "oauth-secret-word", re: new RegExp(j("client", "_secret")) },
  { id: "oauth-domain-word", re: new RegExp(j("google", "usercontent")) },
];

/** Ids that can never be allow-listed (tier a). */
export const NEVER_ALLOWED = new Set([
  "github-token",
  "github-pat",
  "google-api-key",
  "hf-token",
  "private-key",
  "oauth-client-id-value",
  "oauth-secret-value",
]);

export const MEDIA_EXT = new RegExp(`\\.(${j("mp3|mp4|m4a|wav|ogg|", "flac|mov|mkv|webm")})$`, "i");
export const ALLOWED_MEDIA = new Set([
  "samples/demo-session/demo.m4a",
  "samples/demo-session/demo.ogg",
]);
export const MAX_FILE_BYTES = 1024 * 1024;
export const ENV_FILE = /(^|\/)\.env(\.|$)/;
export const ENV_EXAMPLE = /(^|\/)\.env\.example$/;
