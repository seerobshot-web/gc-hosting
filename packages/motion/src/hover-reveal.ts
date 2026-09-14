export interface HoverRevealOptions {
  row: HTMLElement;
  payload: HTMLElement;
  /** ms fade duration */
  duration?: number;
}

/**
 * The Stokt awards-wall pattern: a plain text row that reveals a large
 * image payload on hover. Pure CSS/JS, no render pipeline — the
 * highest-leverage device from the Stokt reference doc that GCH can reuse
 * (e.g. for a case-study or client-logo section) without touching Three.js.
 */
export function createHoverReveal(options: HoverRevealOptions) {
  const { row, payload, duration = 200 } = options;

  payload.style.opacity = "0";
  payload.style.pointerEvents = "none";
  payload.style.transition = `opacity ${duration}ms ease`;

  const show = () => {
    payload.style.opacity = "1";
  };
  const hide = () => {
    payload.style.opacity = "0";
  };

  row.addEventListener("mouseenter", show);
  row.addEventListener("mouseleave", hide);
  row.addEventListener("focus", show);
  row.addEventListener("blur", hide);

  return {
    destroy: () => {
      row.removeEventListener("mouseenter", show);
      row.removeEventListener("mouseleave", hide);
      row.removeEventListener("focus", show);
      row.removeEventListener("blur", hide);
    },
  };
}
