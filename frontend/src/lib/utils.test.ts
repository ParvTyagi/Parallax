import { describe, it, expect } from "vitest";
import { looksLikeCid, taskHeadline, taskHeadlineText, MISSING_BRIEF_LABEL } from "./utils";

describe("looksLikeCid", () => {
  it("matches a real CIDv0 and the locally generated hex fallback", () => {
    expect(looksLikeCid("QmNYZcXiw2AyUjykXZDe4Jpd8KfvzoCo19n3EHfPud4SSH")).toBe(true);
    expect(looksLikeCid("Qm9508c2766de8605bd202a3e3e5eb852ce103bf09f21c")).toBe(true);
  });

  it("does not match ordinary prose", () => {
    expect(looksLikeCid("Research the top 5 protocols")).toBe(false);
    expect(looksLikeCid("")).toBe(false);
  });
});

describe("taskHeadline", () => {
  it("prefers the structured objective", () => {
    expect(taskHeadline({ objective: "Count the primes", description: "# Master Task" })).toEqual({
      text: "Count the primes",
      isPlaceholder: false,
    });
  });

  it("falls back to the first real line of the markdown brief", () => {
    const description = "# Master Task\n\n## Objective\nBuild a widget that counts primes.\n";
    expect(taskHeadline({ description })).toEqual({
      text: "Build a widget that counts primes.",
      isPlaceholder: false,
    });
  });

  it("never renders a bare CID as the description", () => {
    const cid = "Qm9508c2766de8605bd202a3e3e5eb852ce103bf09f21c";
    const headline = taskHeadline({ description: cid });
    expect(headline.text).not.toContain(cid);
    expect(headline.isPlaceholder).toBe(true);
  });

  it("flags an unresolvable brief so callers can style it as absent", () => {
    expect(taskHeadline({ objective: null, description: "" })).toEqual({
      text: MISSING_BRIEF_LABEL,
      isPlaceholder: true,
    });
  });

  it("ignores the attachment marker appended to the brief", () => {
    const description =
      "Research Monad DeFi protocols.\n\nAttached Dataset: data.zip (3 files) - ipfs://QmAbc";
    expect(taskHeadline({ description }).text).toBe("Research Monad DeFi protocols.");
  });

  it("exposes a plain-string form for search filters", () => {
    expect(taskHeadlineText({ objective: "Count the primes" })).toBe("Count the primes");
  });
});
