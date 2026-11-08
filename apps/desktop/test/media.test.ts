import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildMediaUrl,
  handleMediaRequest,
  parseMediaUrl,
  type MediaRequest,
} from "../src/main/media/handler";
import { parseRange } from "../src/main/media/range";
import { Registry } from "../src/main/registry";
import { realpathSync } from "node:fs";
import { silentLog, tempDir } from "./helpers";

describe("parseRange", () => {
  it.each([
    [undefined, 100, { kind: "full" }],
    ["", 100, { kind: "full" }],
    ["bytes=0-9", 100, { kind: "partial", start: 0, end: 9 }],
    ["bytes=10-", 100, { kind: "partial", start: 10, end: 99 }],
    ["bytes=-10", 100, { kind: "partial", start: 90, end: 99 }],
    ["bytes=-500", 100, { kind: "partial", start: 0, end: 99 }],
    ["bytes=90-500", 100, { kind: "partial", start: 90, end: 99 }],
    ["bytes=99-99", 100, { kind: "partial", start: 99, end: 99 }],
    ["bytes=100-", 100, { kind: "unsatisfiable" }],
    ["bytes=50-10", 100, { kind: "unsatisfiable" }],
    ["bytes=-0", 100, { kind: "unsatisfiable" }],
    ["bytes=-", 100, { kind: "full" }],
    ["bytes=0-1,5-6", 100, { kind: "full" }],
    ["items=0-1", 100, { kind: "full" }],
    ["bytes=a-b", 100, { kind: "full" }],
    ["bytes=0-9", 0, { kind: "unsatisfiable" }],
    ["bytes=0-0", 1, { kind: "partial", start: 0, end: 0 }],
    ["bytes=1-", 1, { kind: "unsatisfiable" }],
    ["bytes=99999999999999999999-", 100, { kind: "unsatisfiable" }],
    ["bytes=0-99999999999999999999", 100, { kind: "unsatisfiable" }],
  ] as const)("%s on %d bytes", (header, size, expected) => {
    expect(parseRange(header, size)).toEqual(expected);
  });
});

describe("media URL", () => {
  it.each([
    "0x" + "a".repeat(30),
    "1".repeat(32),
    "0".repeat(32),
    "f".repeat(32),
    "0123456789abcdef0123456789abcdef",
  ])("round-trips the id %s through URL parsing (id lives in the path, host is fixed)", (id) => {
    const url = buildMediaUrl(
      "app-media",
      id.startsWith("0x") ? id.padEnd(32, "0").slice(0, 32) : id,
      "sesión 1 (final).m4a",
    );
    const parsed = parseMediaUrl(url);
    // ids that are not 32 lowercase hex chars never come from the registry; the ones that are must round-trip
    if (/^[0-9a-f]{32}$/.test(new URL(url).pathname.split("/")[1] ?? "")) {
      expect(parsed?.name).toBe("sesión 1 (final).m4a");
      expect(parsed?.projectId).toBe(new URL(url).pathname.split("/")[1]);
    }
    expect(new URL(url).hostname).toBe("media");
  });
  it("rejects malformed URLs", () => {
    const id = "a".repeat(32);
    for (const bad of [
      "not a url",
      `app-media://other/${id}/x.m4a`,
      `app-media://user@media/${id}/x.m4a`,
      `app-media://media:81/${id}/x.m4a`,
      `app-media://media/${id}`,
      `app-media://media/${id}/a/b.m4a`,
      `app-media://media/XYZ/x.m4a`,
      `app-media://media/${id}/%E0%A4%A.m4a`,
      `app-media://media/${id}/..%2Fx.m4a`,
      `app-media://media/${id}/%2e%2e`,
    ]) {
      expect(parseMediaUrl(bad), bad).toBeNull();
    }
  });
});

describe("handleMediaRequest (real files)", () => {
  function setup() {
    const dir = realpathSync(tempDir());
    const bytes = Buffer.from(Array.from({ length: 1000 }, (_, i) => i % 251));
    writeFileSync(join(dir, "a.m4a"), bytes);
    writeFileSync(join(dir, "empty.mp3"), "");
    writeFileSync(join(dir, "notes.txt"), "hi");
    mkdirSync(join(dir, "folder.mp3"));
    const outside = realpathSync(tempDir());
    writeFileSync(join(outside, "secret.m4a"), "secret");
    symlinkSync(join(outside, "secret.m4a"), join(dir, "link.m4a"));
    const registry = new Registry();
    registry.addWindow(1);
    const p = registry.addProject(1, { root: dir, key: "k".repeat(32), displayName: "d" });
    const codes: number[] = [];
    const deps = {
      registry,
      trust: { devOrigin: null },
      log: silentLog,
      onResponse: (c: number) => codes.push(c),
    };
    const req = (
      name: string,
      headers: Record<string, string> = {},
      method = "GET",
    ): MediaRequest => ({
      method,
      url: buildMediaUrl("app-media", p.projectId, name),
      headers: { get: (n) => headers[n] ?? null },
    });
    return { bytes, deps, req, codes, p };
  }
  const body = async (r: Response) => Buffer.from(await r.arrayBuffer());

  it("serves the whole file with 200 and Accept-Ranges", async () => {
    const { bytes, deps, req } = setup();
    const r = await handleMediaRequest(req("a.m4a"), deps);
    expect(r.status).toBe(200);
    expect(r.headers.get("Accept-Ranges")).toBe("bytes");
    expect(r.headers.get("Content-Type")).toBe("audio/mp4");
    expect(r.headers.get("Content-Length")).toBe("1000");
    expect(await body(r)).toEqual(bytes);
  });

  it("serves 206 with Content-Range for a range (this is what makes seeking stick)", async () => {
    const { bytes, deps, req } = setup();
    const r = await handleMediaRequest(req("a.m4a", { Range: "bytes=100-199" }), deps);
    expect(r.status).toBe(206);
    expect(r.headers.get("Content-Range")).toBe("bytes 100-199/1000");
    expect(r.headers.get("Content-Length")).toBe("100");
    expect(await body(r)).toEqual(bytes.subarray(100, 200));
    const tail = await handleMediaRequest(req("a.m4a", { Range: "bytes=-5" }), deps);
    expect(tail.headers.get("Content-Range")).toBe("bytes 995-999/1000");
    expect(await body(tail)).toEqual(bytes.subarray(995));
    const open = await handleMediaRequest(req("a.m4a", { Range: "bytes=990-" }), deps);
    expect((await body(open)).length).toBe(10);
  });

  it("answers 416 with Content-Range */size", async () => {
    const { deps, req } = setup();
    const r = await handleMediaRequest(req("a.m4a", { Range: "bytes=5000-" }), deps);
    expect(r.status).toBe(416);
    expect(r.headers.get("Content-Range")).toBe("bytes */1000");
    expect((await body(r)).length).toBe(0);
  });

  it("answers HEAD without a body and 405 for other methods", async () => {
    const { deps, req } = setup();
    const head = await handleMediaRequest(req("a.m4a", {}, "HEAD"), deps);
    expect(head.status).toBe(200);
    expect(head.headers.get("Content-Length")).toBe("1000");
    expect((await body(head)).length).toBe(0);
    const post = await handleMediaRequest(req("a.m4a", {}, "POST"), deps);
    expect(post.status).toBe(405);
    expect(post.headers.get("Allow")).toBe("GET, HEAD");
  });

  it("handles an empty file and range on it", async () => {
    const { deps, req } = setup();
    expect((await handleMediaRequest(req("empty.mp3"), deps)).status).toBe(200);
    expect((await handleMediaRequest(req("empty.mp3", { Range: "bytes=0-0" }), deps)).status).toBe(
      416,
    );
  });

  it("maps errors: 400 bad url, 404 unknown id or file, 403 outside/not a media file/referer", async () => {
    const { deps, req, p } = setup();
    expect(
      (await handleMediaRequest({ ...req("a.m4a"), url: "app-media://media/zz/a.m4a" }, deps))
        .status,
    ).toBe(400);
    expect(
      (
        await handleMediaRequest(
          { ...req("a.m4a"), url: buildMediaUrl("app-media", "b".repeat(32), "a.m4a") },
          deps,
        )
      ).status,
    ).toBe(404);
    expect((await handleMediaRequest(req("missing.m4a"), deps)).status).toBe(404);
    expect((await handleMediaRequest(req("notes.txt"), deps)).status).toBe(403); // not a media extension
    expect((await handleMediaRequest(req("link.m4a"), deps)).status).toBe(403); // symlink escapes the folder
    expect((await handleMediaRequest(req("folder.mp3"), deps)).status).toBe(403); // not a regular file
    expect(
      (await handleMediaRequest(req("a.m4a", { Referer: "https://evil.example/" }), deps)).status,
    ).toBe(403);
    expect(
      (await handleMediaRequest(req("a.m4a", { Referer: "app://renderer/index.html" }), deps))
        .status,
    ).toBe(200);
    deps.registry.closeProject(1, p.projectId);
    expect((await handleMediaRequest(req("a.m4a"), deps)).status).toBe(404); // closed project revokes the id
  });

  it("records response codes for the E2E counters", async () => {
    const { deps, req, codes } = setup();
    await handleMediaRequest(req("a.m4a"), deps);
    await handleMediaRequest(req("a.m4a", { Range: "bytes=0-1" }), deps);
    await handleMediaRequest(req("a.m4a", { Range: "bytes=9999-" }), deps);
    expect(codes).toEqual([200, 206, 416]);
  });

  it("stops reading when the request is aborted", async () => {
    const { deps, req } = setup();
    const ac = new AbortController();
    const r = await handleMediaRequest({ ...req("a.m4a"), signal: ac.signal }, deps);
    ac.abort();
    // the body stream is destroyed: reading must not hang or throw an unhandled error
    await r.arrayBuffer().catch(() => undefined);
    expect(r.status).toBe(200);
  });
});
