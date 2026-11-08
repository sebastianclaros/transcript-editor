import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkBoundaries } from "./check-boundaries.mjs";

let root;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "te-bounds-"));
  mkdirSync(join(root, "packages/core/src"), { recursive: true });
  writeFileSync(
    join(root, "packages/core/package.json"),
    JSON.stringify({ dependencies: { zod: "3" } }),
  );
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("check-boundaries", () => {
  it("passes for a clean core", () => {
    writeFileSync(
      join(root, "packages/core/src/a.ts"),
      'import { z } from "zod";\nexport const a = z.string();\n',
    );
    expect(checkBoundaries(root)).toEqual([]);
  });

  it("fails when a core file imports react", () => {
    writeFileSync(
      join(root, "packages/core/src/a.ts"),
      'import React from "react";\nexport default React;\n',
    );
    const problems = checkBoundaries(root);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('"react"');
  });

  it("fails on node builtins and node: specifiers", () => {
    writeFileSync(
      join(root, "packages/core/src/a.ts"),
      'import fs from "node:fs";\nimport p from "path";\n',
    );
    expect(checkBoundaries(root)).toHaveLength(2);
  });

  it("fails on a disallowed dependency in package.json", () => {
    writeFileSync(
      join(root, "packages/core/package.json"),
      JSON.stringify({ dependencies: { lodash: "4" } }),
    );
    expect(checkBoundaries(root)[0]).toContain("lodash");
  });

  it("does not confuse prefixes (reactive-thing is not react)", () => {
    writeFileSync(join(root, "packages/core/src/a.ts"), 'import x from "reactive-thing";\n');
    expect(checkBoundaries(root)).toEqual([]);
  });
});
