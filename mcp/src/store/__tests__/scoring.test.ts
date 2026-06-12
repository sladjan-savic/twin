import { describe, it, expect, beforeEach } from "vitest";
import { findPolicies, savePolicy } from "../policies.js";
import { findOrientations, saveOrientation } from "../orientations.js";
import { db } from "../db.js";

beforeEach(() => {
  db.exec("DELETE FROM policies");
  db.exec("DELETE FROM orientation_maps");
  db.exec("DELETE FROM knowledge_fts");
});

// ─── findPolicies ─────────────────────────────────────────────────────────────

describe("findPolicies", () => {
  it("returns no-match message when no policies exist", () => {
    expect(findPolicies(["stuck"])).toContain("No policies matched");
  });

  it("returns no-match when tags do not overlap", () => {
    savePolicy({ id: "p1", name: "P1", trigger_tags: ["blocker"], strategy: "x", status: "active" });
    expect(findPolicies(["unrelated"])).toContain("No policies matched");
  });

  it("returns matching policy by tag overlap", () => {
    savePolicy({ id: "no-progress", name: "No Progress", trigger_tags: ["stuck", "spiral"], strategy: "Escalate.", status: "active" });
    expect(findPolicies(["stuck"])).toContain("no-progress");
  });

  it("ranks higher-overlap policy first", () => {
    savePolicy({ id: "broad", name: "Broad", trigger_tags: ["stuck", "blocked", "spiral"], strategy: "x", status: "active" });
    savePolicy({ id: "narrow", name: "Narrow", trigger_tags: ["stuck"], strategy: "x", status: "active" });

    const result = findPolicies(["stuck", "blocked", "spiral"]);
    expect(result.indexOf("broad")).toBeLessThan(result.indexOf("narrow"));
  });

  it("breaks score ties by priority — lower number wins", () => {
    savePolicy({ id: "hi-prio", name: "Hi", trigger_tags: ["stuck"], strategy: "x", status: "active", priority: 1 });
    savePolicy({ id: "lo-prio", name: "Lo", trigger_tags: ["stuck"], strategy: "x", status: "active", priority: 50 });

    const result = findPolicies(["stuck"]);
    expect(result.indexOf("hi-prio")).toBeLessThan(result.indexOf("lo-prio"));
  });

  it("matching is case-insensitive", () => {
    savePolicy({ id: "p1", name: "P1", trigger_tags: ["Stuck"], strategy: "x", status: "active" });
    expect(findPolicies(["stuck"])).toContain("p1");
  });

  it("excludes policies with zero overlap", () => {
    savePolicy({ id: "unrelated", name: "Unrelated", trigger_tags: ["auth"], strategy: "x", status: "active" });
    expect(findPolicies(["stuck"])).toContain("No policies matched");
  });

  it("includes score in output", () => {
    savePolicy({ id: "p1", name: "P1", trigger_tags: ["stuck", "blocked"], strategy: "x", status: "active" });
    expect(findPolicies(["stuck", "blocked"])).toContain("[score:2]");
  });
});

// ─── findOrientations ────────────────────────────────────────────────────────

describe("findOrientations", () => {
  it("returns no-match message when no maps exist", () => {
    expect(findOrientations(["csv"])).toContain("No orientation maps matched");
  });

  it("returns matching orientation by keyword overlap", () => {
    saveOrientation({ id: "dataset-eval", domain: "Widget Review", keywords: ["csv", "upload"], content: "#" });
    expect(findOrientations(["csv"])).toContain("dataset-eval");
  });

  it("ranks higher-overlap map first", () => {
    saveOrientation({ id: "full", domain: "Full Match", keywords: ["csv", "upload", "dataset"], content: "#" });
    saveOrientation({ id: "partial", domain: "Partial Match", keywords: ["csv"], content: "#" });

    const result = findOrientations(["csv", "upload", "dataset"]);
    expect(result.indexOf("full")).toBeLessThan(result.indexOf("partial"));
  });

  it("excludes maps with zero keyword overlap", () => {
    saveOrientation({ id: "unrelated", domain: "Auth", keywords: ["oauth", "login"], content: "#" });
    expect(findOrientations(["csv"])).toContain("No orientation maps matched");
  });

  it("matching is case-insensitive", () => {
    saveOrientation({ id: "x", domain: "X", keywords: ["CSV"], content: "#" });
    expect(findOrientations(["csv"])).toContain("x");
  });

  it("lists available maps in no-match message", () => {
    saveOrientation({ id: "auth-map", domain: "Auth Domain", keywords: ["oauth"], content: "#" });
    const result = findOrientations(["csv"]);
    expect(result).toContain("auth-map");
  });
});
