import { describe, expect, it } from "vitest";
import {
  closestPhaseForIndex,
  easeInOutCubic,
  frontWeight,
  FULL_TURN,
  wrapAngle,
} from "../src/scenes/hero-carousel/heroMotion";

describe("Hero selection continuity", () => {
  it("selects the nearest equivalent turn at first/last and after many cycles", () => {
    for (const phase of [
      -FULL_TURN * 12 - 0.2,
      -0.05,
      0,
      FULL_TURN * 8 + 0.12,
    ]) {
      for (let index = 0; index < 5; index++) {
        const target = closestPhaseForIndex(phase, index, 5);
        expect(Math.abs(target - phase)).toBeLessThanOrEqual(Math.PI + 0.00001);
        expect(Math.cos(target + (index * FULL_TURN) / 5)).toBeCloseTo(1, 10);
      }
    }
  });
  it("an interrupted selection begins at the rendered position with zero initial displacement", () => {
    const current = -0.83;
    const target = closestPhaseForIndex(current, 4, 5);
    expect(current + (target - current) * easeInOutCubic(0)).toBe(current);
    expect(current + (target - current) * easeInOutCubic(1)).toBe(target);
  });
  it("promotes the center symmetrically without a seam between turns", () => {
    expect(frontWeight(0)).toBe(1);
    expect(frontWeight(FULL_TURN)).toBe(1);
    expect(frontWeight(-0.35)).toBeCloseTo(frontWeight(0.35), 10);
    expect(frontWeight(Math.PI)).toBeLessThan(0.01);
    expect(wrapAngle(FULL_TURN * 4 + 0.1)).toBeCloseTo(0.1, 10);
  });
});
