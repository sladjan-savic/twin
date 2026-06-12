import { describe, it, expect, beforeEach } from "vitest";
import { saveAdl, loadAdl } from "../adls.js";
import { saveTestPlan, loadTestPlan } from "../test-plans.js";
import { saveOrientation, loadOrientation, findOrientations } from "../orientations.js";
import { savePolicy, loadPolicy } from "../policies.js";
import { db } from "../db.js";

beforeEach(() => {
  db.exec("DELETE FROM adls");
  db.exec("DELETE FROM test_plans");
  db.exec("DELETE FROM orientation_maps");
  db.exec("DELETE FROM policies");
  db.exec("DELETE FROM knowledge_fts");
});

// ─── ADLs ─────────────────────────────────────────────────────────────────────

describe("ADL round-trip", () => {
  it("saves and loads content intact", () => {
    saveAdl({ adl_id: "ADL-14", name: "Test ADL", type: "tooling", status: "accepted", content: "# ADL-14\n\nContent here." });
    expect(loadAdl("ADL-14")).toContain("Content here.");
  });

  it("finds by name substring", () => {
    saveAdl({ adl_id: "ADL-14", name: "Vitest Testing", type: "tooling", status: "accepted", content: "# Content" });
    expect(loadAdl("Vitest")).toContain("# Content");
  });

  it("returns not-found for missing ADL", () => {
    expect(loadAdl("ADL-99")).toContain('No ADL found for: "ADL-99"');
  });

  it("lists available ADLs in not-found message", () => {
    saveAdl({ adl_id: "ADL-14", name: "Test", type: "tooling", status: "accepted", content: "#" });
    expect(loadAdl("ADL-99")).toContain("ADL-14");
  });
});

// ─── Test plans ───────────────────────────────────────────────────────────────

describe("Test plan round-trip", () => {
  it("saves and loads content intact", () => {
    saveTestPlan({ id: "ticket-123-plan", content: "# Plan\n\n- Step 1", radar_id: "ticket-123", title: "My Plan" });
    expect(loadTestPlan("ticket-123-plan")).toContain("Step 1");
  });

  it("finds by numeric ticket ID (7+ digits)", () => {
    saveTestPlan({ id: "ticket-1234567-plan", content: "# Plan content", radar_id: "ticket-1234567" });
    expect(loadTestPlan("1234567")).toContain("Plan content");
  });

  it("finds by title keyword", () => {
    saveTestPlan({ id: "plan-abc", content: "# My Steps", title: "GroupBy Feature" });
    expect(loadTestPlan("GroupBy")).toContain("My Steps");
  });

  it("returns not-found for missing plan", () => {
    expect(loadTestPlan("nonexistent")).toContain("No test plan found");
  });
});

// ─── Orientations ─────────────────────────────────────────────────────────────

describe("Orientation round-trip", () => {
  it("saves and loads content with domain header prepended", () => {
    saveOrientation({ id: "test-domain", domain: "Test Domain", keywords: ["test"], content: "Body content here." });
    const result = loadOrientation("test-domain");
    expect(result).toMatch(/^# Test Domain/);
    expect(result).toContain("Body content here.");
  });

  it("preserves keywords for find operations after save", () => {
    saveOrientation({ id: "csv-domain", domain: "CSV", keywords: ["csv", "upload"], content: "#" });
    expect(findOrientations(["upload"])).toContain("csv-domain");
  });

  it("returns not-found for missing orientation", () => {
    expect(loadOrientation("nonexistent")).toContain("No orientation map found");
  });
});

// ─── Policies ─────────────────────────────────────────────────────────────────

describe("Policy round-trip", () => {
  it("saves and loads with name + status header", () => {
    savePolicy({ id: "test-policy", name: "Test Policy", trigger_tags: ["stuck"], strategy: "Do X.", status: "active" });
    const result = loadPolicy("test-policy");
    expect(result).toMatch(/^# Test Policy \[active\]/);
    expect(result).toContain("Do X.");
  });

  it("finds by name keyword", () => {
    savePolicy({ id: "escalation", name: "No Progress Escalation", trigger_tags: ["stuck"], strategy: "Escalate.", status: "active" });
    expect(loadPolicy("Progress")).toContain("Escalate.");
  });

  it("returns not-found for missing policy", () => {
    expect(loadPolicy("nonexistent")).toContain("No policy found");
  });
});
