export function getOutsideInteractionTarget(event: Event): Element | null {
  const originalTarget = (
    event as CustomEvent<{ originalEvent?: Event }>
  ).detail?.originalEvent?.target;

  if (originalTarget instanceof Element) {
    return originalTarget;
  }

  const originalEvent = (
    event as CustomEvent<{ originalEvent?: Event }>
  ).detail?.originalEvent;
  if (originalEvent?.composedPath) {
    const pathTarget = originalEvent
      .composedPath()
      .find((entry): entry is Element => entry instanceof Element);
    if (pathTarget) {
      return pathTarget;
    }
  }

  if (event.composedPath) {
    const pathTarget = event
      .composedPath()
      .find((entry): entry is Element => entry instanceof Element);
    if (pathTarget) {
      return pathTarget;
    }
  }

  return event.target instanceof Element ? event.target : null;
}

export function isPortaledOverlayInteraction(target: Element | null): boolean {
  if (!target) {
    return false;
  }

  return Boolean(
    target.closest("[data-radix-popper-content-wrapper]") ||
      target.closest("[data-slot='popover-content']") ||
      target.closest("[data-slot='select-content']") ||
      target.closest("[data-slot='select-item']") ||
      target.closest("[cmdk-root]") ||
      target.closest("[cmdk-list]") ||
      target.closest("[cmdk-item]") ||
      target.closest("[role='listbox']") ||
      target.closest("[role='menu']"),
  );
}
