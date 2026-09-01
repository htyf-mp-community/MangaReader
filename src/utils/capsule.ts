export interface CapsuleRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

interface WindowSize {
  width: number;
  height: number;
}

/** 将 HTYF SDK 胶囊矩形归一化为 React Native 逻辑点。 */
export function normalizeCapsuleRect(
  raw: Partial<CapsuleRect> | null | undefined,
  window: WindowSize,
  pixelRatio: number
): CapsuleRect | null {
  if (!raw || window.width <= 0 || window.height <= 0 || pixelRatio <= 0) return null;

  const values = [raw.left, raw.top, raw.right, raw.bottom, raw.width, raw.height];
  if (values.some((value) => typeof value !== 'number' || !Number.isFinite(value))) return null;

  const candidate = raw as CapsuleRect;
  if (candidate.width <= 0 || candidate.height <= 0) return null;

  const fits = (rect: CapsuleRect) =>
    rect.left >= 0 &&
    rect.top >= 0 &&
    rect.right > rect.left &&
    rect.bottom > rect.top &&
    rect.right <= window.width * 1.25 &&
    rect.bottom <= window.height * 1.25;

  let rect = candidate;
  if (!fits(rect)) {
    rect = {
      left: candidate.left / pixelRatio,
      top: candidate.top / pixelRatio,
      right: candidate.right / pixelRatio,
      bottom: candidate.bottom / pixelRatio,
      width: candidate.width / pixelRatio,
      height: candidate.height / pixelRatio,
    };
  }
  if (!fits(rect)) return null;

  const left = Math.max(0, Math.min(window.width, rect.left));
  const top = Math.max(0, Math.min(window.height, rect.top));
  const right = Math.max(left, Math.min(window.width, rect.right));
  const bottom = Math.max(top, Math.min(window.height, rect.bottom));
  if (right <= left || bottom <= top) return null;
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

/** 元素与胶囊垂直相交时，返回胶囊左侧的最大可用右边界。 */
export function getCapsuleAvoidanceRight(
  element: { top: number; bottom: number },
  capsule: CapsuleRect | null,
  contentRight: number,
  safetyGap = 10
) {
  if (!capsule || element.top >= capsule.bottom || element.bottom <= capsule.top) {
    return contentRight;
  }
  return Math.max(0, Math.min(contentRight, capsule.left - safetyGap));
}
