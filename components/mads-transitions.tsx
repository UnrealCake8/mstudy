"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    MAds?: {
      show: (options: { placement: string }) => Promise<unknown>;
    };
  }
}

export function MAdsTransitions() {
  useEffect(() => {
    const bypass = new WeakSet<Element>();

    const handleClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest("button.game-start") : null;
      if (!target || bypass.has(target)) {
        if (target) bypass.delete(target);
        return;
      }

      const label = target.textContent?.trim().toLowerCase() || "";
      if (!label.includes("build my game") && !label.includes("play again")) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      void (async () => {
        try {
          await window.MAds?.show({ placement: "mstudy-study-game-start" });
        } catch (error) {
          console.warn("M-Ads could not be shown; continuing into the game.", error);
        }
        bypass.add(target);
        (target as HTMLButtonElement).click();
      })();
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  return null;
}
