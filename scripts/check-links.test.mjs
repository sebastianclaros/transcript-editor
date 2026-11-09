import { describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findBrokenLinks } from "./check-links.mjs";

describe("check-links", () => {
  it("finds broken relative links and ignores urls, anchors, code blocks and GitHub routes", () => {
    const root = mkdtempSync(join(tmpdir(), "te-links-"));
    try {
      mkdirSync(join(root, "docs"));
      writeFileSync(join(root, "docs", "a.md"), "ok");
      const f = join(root, "README.md");
      writeFileSync(
        f,
        [
          "[ok](docs/a.md) [anchor](docs/a.md#x) [web](https://x.org) [top](#t)",
          "[bad](docs/missing.md) [releases](../../releases)",
          "```",
          "[in code](nope.md)",
          "```",
        ].join("\n"),
      );
      expect(findBrokenLinks(root, [f])).toEqual(["README.md -> docs/missing.md"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
