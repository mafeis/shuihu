export function currencyFeedback(previous, current) {
  if (!Number.isFinite(previous) || !Number.isFinite(current)) return null;
  const delta = Math.trunc(current) - Math.trunc(previous);
  if (!delta) return null;
  return {
    delta,
    tone: delta < 0 ? "spend" : "gain",
    label: `${delta > 0 ? "+" : ""}${delta}`,
  };
}

export function clickFeedbackOrigin(element, pointer = null) {
  const rect = element?.getBoundingClientRect?.();
  if (!rect) return null;
  const hasPointer =
    pointer &&
    Number.isFinite(pointer.clientX) &&
    Number.isFinite(pointer.clientY);
  return {
    x: hasPointer
      ? Math.max(rect.left, Math.min(rect.right, pointer.clientX))
      : rect.left + rect.width / 2,
    y: hasPointer
      ? Math.max(rect.top, Math.min(rect.bottom, pointer.clientY))
      : rect.top + rect.height / 2,
    width: rect.width,
    height: rect.height,
  };
}
