import { describe, it, expect, beforeEach } from "vitest";
import { saveAnchor } from "../anchors.js";
import { contextSearch } from "../search.js";
import { db } from "../db.js";

function clearAll() {
  db.exec("DELETE FROM anchors");
  db.exec("DELETE FROM knowledge_fts");
}

const ROOT = {
  anchor_id: "ticket-178698943",
  tag: "#speed-limit-v2-dup-custom-feedback",
  anchor_type: "investigation",
  status: "active",
  state: "## Current\nWorking.",
  resume: "Dedupe overlapping CUSTOM feedback scope claims",
  next: ["ship"] as string[],
  delta: "",
  depth: 0,
};

describe("contextSearch", () => {
  beforeEach(clearAll);

  it("finds an anchor by ticket number embedded only in anchor_id", () => {
    saveAnchor(ROOT);
    expect(contextSearch("178698943")).toContain("ticket-178698943");
  });

  it("finds an anchor by exact anchor_id even when absent from tag/resume", () => {
    saveAnchor(ROOT);
    expect(contextSearch("ticket-178698943")).toContain("ticket-178698943");
  });

  it("still finds an anchor by free-text tag/resume content", () => {
    saveAnchor(ROOT);
    expect(contextSearch("dedupe")).toContain("ticket-178698943");
  });

  it("returns no-results message when nothing matches", () => {
    expect(contextSearch("nonexistent")).toContain("No results for");
  });
});
