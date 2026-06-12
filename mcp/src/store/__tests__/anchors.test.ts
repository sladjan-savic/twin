import { describe, it, expect, beforeEach } from "vitest";
import { saveAnchor, loadAnchor } from "../anchors.js";
import { db } from "../db.js";

function clearAll() {
  db.exec("DELETE FROM anchors");
  db.exec("DELETE FROM knowledge_fts");
}

function anchorExists(id: string): boolean {
  return db.prepare("SELECT 1 FROM anchors WHERE anchor_id = ?").get(id) !== undefined;
}

const ROOT = {
  anchor_id: "anchor-root",
  tag: "ticket-999",
  anchor_type: "investigation",
  status: "active",
  state: "## Current\nWorking.",
  resume: "Root anchor",
  next: ["step-a", "step-b"] as string[],
  delta: "",
  depth: 0,
};

// ─── loadAnchor ───────────────────────────────────────────────────────────────

describe("loadAnchor", () => {
  beforeEach(clearAll);

  it("returns not-found message when DB is empty", () => {
    expect(loadAnchor("anything")).toContain('No anchor found for: "anything"');
  });

  it("finds by exact anchor_id", () => {
    saveAnchor(ROOT);
    expect(JSON.parse(loadAnchor("anchor-root")).identity.anchor_id).toBe("anchor-root");
  });

  it("finds by tag substring", () => {
    saveAnchor(ROOT);
    expect(JSON.parse(loadAnchor("ticket-999")).identity.tag).toBe("ticket-999");
  });

  it("deserializes next back to an array", () => {
    saveAnchor(ROOT);
    expect(JSON.parse(loadAnchor("anchor-root")).next).toEqual(["step-a", "step-b"]);
  });

  it("includes parent_id and depth in identity", () => {
    saveAnchor({ ...ROOT, parent_id: "anchor-parent", depth: 2 });
    const result = JSON.parse(loadAnchor("anchor-root"));
    expect(result.identity.parent_id).toBe("anchor-parent");
    expect(result.identity.depth).toBe(2);
  });

  it("lists available anchors in not-found message", () => {
    saveAnchor(ROOT);
    const msg = loadAnchor("nonexistent");
    expect(msg).toContain("anchor-root");
  });
});

// ─── saveAnchor: parent.next cascade ─────────────────────────────────────────

describe("saveAnchor — parent.next cascade on child completion", () => {
  beforeEach(clearAll);

  it("completing a child removes it from parent.next", () => {
    saveAnchor({ ...ROOT, anchor_id: "parent", next: ["child-1", "child-2"] });
    saveAnchor({ ...ROOT, anchor_id: "child-1", tag: "child-1", parent_id: "parent", depth: 1, status: "completed", next: [] });

    expect(JSON.parse(loadAnchor("parent")).next).toEqual(["child-2"]);
  });

  it("last sibling completion sets parent.next to ['integrate']", () => {
    saveAnchor({ ...ROOT, anchor_id: "parent", next: ["only-child"] });
    saveAnchor({ ...ROOT, anchor_id: "only-child", tag: "only-child", parent_id: "parent", depth: 1, status: "completed", next: [] });

    expect(JSON.parse(loadAnchor("parent")).next).toEqual(["integrate"]);
  });

  it("no cascade when completed anchor has no parent_id", () => {
    saveAnchor({ ...ROOT, anchor_id: "standalone", next: [], status: "completed" });
    expect(JSON.parse(loadAnchor("standalone")).identity.status).toBe("completed");
  });

  it("completing a child does not affect other parents", () => {
    saveAnchor({ ...ROOT, anchor_id: "parent-a", next: ["child-a"] });
    saveAnchor({ ...ROOT, anchor_id: "parent-b", next: ["child-b"] });
    saveAnchor({ ...ROOT, anchor_id: "child-a", tag: "ca", parent_id: "parent-a", depth: 1, status: "completed", next: [] });

    expect(JSON.parse(loadAnchor("parent-b")).next).toEqual(["child-b"]);
  });
});

// ─── saveAnchor: orphan deletion ──────────────────────────────────────────────

describe("saveAnchor — orphan tree deletion on close/abandon", () => {
  beforeEach(clearAll);

  it("closing deletes non-completed direct children", () => {
    saveAnchor({ ...ROOT, anchor_id: "root", next: ["child"] });
    saveAnchor({ ...ROOT, anchor_id: "child", tag: "child", parent_id: "root", depth: 1, next: [] });
    saveAnchor({ ...ROOT, anchor_id: "root", next: [], status: "closed" });

    expect(anchorExists("child")).toBe(false);
  });

  it("closing deletes the full subtree recursively", () => {
    saveAnchor({ ...ROOT, anchor_id: "root", next: ["child"] });
    saveAnchor({ ...ROOT, anchor_id: "child", tag: "child", parent_id: "root", depth: 1, next: ["grandchild"] });
    saveAnchor({ ...ROOT, anchor_id: "grandchild", tag: "grandchild", parent_id: "child", depth: 2, next: [] });
    saveAnchor({ ...ROOT, anchor_id: "root", next: [], status: "closed" });

    expect(anchorExists("child")).toBe(false);
    expect(anchorExists("grandchild")).toBe(false);
  });

  it("closing does NOT delete already-completed children", () => {
    saveAnchor({ ...ROOT, anchor_id: "root", next: [] });
    saveAnchor({ ...ROOT, anchor_id: "done", tag: "done", parent_id: "root", depth: 1, next: [], status: "completed" });
    saveAnchor({ ...ROOT, anchor_id: "root", next: [], status: "closed" });

    expect(anchorExists("done")).toBe(true);
  });

  it("abandoning also deletes non-completed descendants", () => {
    saveAnchor({ ...ROOT, anchor_id: "root", next: ["child"] });
    saveAnchor({ ...ROOT, anchor_id: "child", tag: "child", parent_id: "root", depth: 1, next: [] });
    saveAnchor({ ...ROOT, anchor_id: "root", next: [], status: "abandoned" });

    expect(anchorExists("child")).toBe(false);
  });
});
