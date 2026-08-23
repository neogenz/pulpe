import { isVersionBelow } from "./semver";

describe("isVersionBelow", () => {
  it("should compare segments as numbers, not as text", () => {
    expect(isVersionBelow("1.9.0", "1.10.0")).toBe(true);
    expect(isVersionBelow("1.10.0", "1.9.0")).toBe(false);
  });

  it("should treat an equal version as supported", () => {
    expect(isVersionBelow("2.0.0", "2.0.0")).toBe(false);
  });

  it("should pad a missing segment with zero", () => {
    expect(isVersionBelow("1.2", "1.2.1")).toBe(true);
    expect(isVersionBelow("1.2.0", "1.2")).toBe(false);
  });

  it("should keep the gate open on an unparseable version", () => {
    expect(isVersionBelow("1.2.0-beta", "1.3.0")).toBe(false);
    expect(isVersionBelow("", "1.0.0")).toBe(false);
  });
});
