import { describe, expect, it } from "vitest";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SPECS, checkKiro } from "./check-kiro.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("check-kiro", () => {
  it("passes for this repository", () => {
    expect(checkKiro(root)).toEqual([]);
  });
  it("lists the 16 specs", () => {
    expect(SPECS).toHaveLength(16);
  });
  it("reports problems for a directory without Kiro files", () => {
    expect(checkKiro(join(root, "docs")).length).toBeGreaterThan(10);
  });
});
