import { describe, it, expect } from "vitest";
import { AnchorSchema } from "../anchors.js";
import { OrientationSchema } from "../orientations.js";
import { PolicySchema } from "../policies.js";
import { AdlSchema } from "../adls.js";
import { TestPlanSchema } from "../test-plans.js";

const BASE_ANCHOR = {
  anchor_id: "anchor-test",
  tag: "ticket-999",
  anchor_type: "investigation",
  status: "active",
  state: "## Current\nWorking.",
  resume: "Test anchor",
  next: ["step-1"],
  delta: "",
};

describe("AnchorSchema", () => {
  it("parses a valid anchor", () => {
    const result = AnchorSchema.parse(BASE_ANCHOR);
    expect(result.anchor_id).toBe("anchor-test");
    expect(result.next).toEqual(["step-1"]);
  });

  it("defaults depth to 0 when omitted", () => {
    expect(AnchorSchema.parse(BASE_ANCHOR).depth).toBe(0);
  });

  it("accepts explicit depth", () => {
    expect(AnchorSchema.parse({ ...BASE_ANCHOR, depth: 3 }).depth).toBe(3);
  });

  it("accepts parent_id", () => {
    expect(
      AnchorSchema.parse({ ...BASE_ANCHOR, parent_id: "anchor-parent" }).parent_id
    ).toBe("anchor-parent");
  });

  it("rejects missing anchor_id", () => {
    const { anchor_id: _, ...without } = BASE_ANCHOR;
    expect(() => AnchorSchema.parse(without)).toThrow();
  });

  it("rejects non-array next", () => {
    expect(() => AnchorSchema.parse({ ...BASE_ANCHOR, next: "not-array" })).toThrow();
  });
});

describe("PolicySchema", () => {
  const BASE = {
    id: "test-policy",
    name: "Test Policy",
    trigger_tags: ["stuck", "blocked"],
    strategy: "Do something.",
    status: "active",
  };

  it("defaults priority to 99 when omitted", () => {
    expect(PolicySchema.parse(BASE).priority).toBe(99);
  });

  it("accepts explicit priority", () => {
    expect(PolicySchema.parse({ ...BASE, priority: 5 }).priority).toBe(5);
  });

  it("rejects missing trigger_tags", () => {
    const { trigger_tags: _, ...without } = BASE;
    expect(() => PolicySchema.parse(without)).toThrow();
  });
});

describe("AdlSchema", () => {
  const BASE = {
    adl_id: "ADL-14",
    name: "Test ADL",
    type: "tooling",
    status: "accepted",
    content: "# ADL-14\n\nContent.",
  };

  it("defaults tag to empty string when omitted", () => {
    expect(AdlSchema.parse(BASE).tag).toBe("");
  });

  it("accepts explicit tag", () => {
    expect(AdlSchema.parse({ ...BASE, tag: "tests" }).tag).toBe("tests");
  });

  it("rejects missing content", () => {
    const { content: _, ...without } = BASE;
    expect(() => AdlSchema.parse(without)).toThrow();
  });
});

describe("OrientationSchema", () => {
  it("parses a valid orientation", () => {
    const result = OrientationSchema.parse({
      id: "test-domain",
      domain: "Test Domain",
      keywords: ["test", "keyword"],
      content: "# Test\n\nContent.",
    });
    expect(result.keywords).toEqual(["test", "keyword"]);
  });

  it("rejects non-array keywords", () => {
    expect(() =>
      OrientationSchema.parse({ id: "x", domain: "X", keywords: "not-array", content: "#" })
    ).toThrow();
  });
});

describe("TestPlanSchema", () => {
  it("parses with only required fields", () => {
    const result = TestPlanSchema.parse({ id: "plan-1", content: "# Plan\n\nSteps." });
    expect(result.issue_id).toBeUndefined();
    expect(result.anchor_id).toBeUndefined();
    expect(result.title).toBeUndefined();
  });

  it("accepts all optional fields", () => {
    const result = TestPlanSchema.parse({
      id: "plan-1",
      content: "# Plan",
      issue_id: "ticket-123",
      anchor_id: "anchor-abc",
      title: "My Plan",
    });
    expect(result.issue_id).toBe("ticket-123");
    expect(result.title).toBe("My Plan");
  });
});
