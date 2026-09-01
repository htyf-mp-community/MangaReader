import { getCapsuleAvoidanceRight, normalizeCapsuleRect } from '../src/utils/capsule';

const logical = { left: 300, top: 48, right: 380, bottom: 80, width: 80, height: 32 };

describe('HTYF capsule geometry', () => {
  it('keeps logical-point coordinates', () => {
    expect(normalizeCapsuleRect(logical, { width: 390, height: 844 }, 3)).toEqual(logical);
  });

  it('normalizes physical pixels on a 3x display', () => {
    expect(
      normalizeCapsuleRect(
        { left: 900, top: 144, right: 1140, bottom: 240, width: 240, height: 96 },
        { width: 390, height: 844 },
        3
      )
    ).toEqual(logical);
  });

  it('rejects missing and invalid geometry', () => {
    expect(normalizeCapsuleRect(null, { width: 390, height: 844 }, 3)).toBeNull();
    expect(normalizeCapsuleRect({ ...logical, width: 0 }, { width: 390, height: 844 }, 3)).toBeNull();
  });

  it('only constrains vertically intersecting elements', () => {
    expect(getCapsuleAvoidanceRight({ top: 50, bottom: 75 }, logical, 390)).toBe(290);
    expect(getCapsuleAvoidanceRight({ top: 90, bottom: 134 }, logical, 390)).toBe(390);
  });
});
