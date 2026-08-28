"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    MAds?: {
      show: (options: { placement: string }) => Promise<unknown>;
    };
  }
}

const NAV_AD_PATHS = new Set(["/homework", "/play", "/team", "/classroom", "/messages"]);
const NAV_COUNT_KEY = "mstudy-mads-nav-count";
const LAST_AD_KEY = "mstudy-mads-last-shown";
const NAV_AD_EVERY = 2;
const MIN_AD_GAP_MS = 45_000;

export function MAdsTransitions() {
  useEffect(() => {
    const bypass = new WeakSet<Element>();

    const canShowAd = () => {
      const last = Number(window.localStorage.getItem(LAST_AD_KEY) || "0");
      return Date.now() - last >= MIN_AD_GAP_MS;
    };

    const markAdShown = () => {
      window.localStorage.setItem(LAST_AD_KEY, String(Date.now()));
    };

    const showAdThenContinue = async (placement: string, target: HTMLElement) => {
      try {
        await window.MAds?.show({ placement });
        markAdShown();
      } catch (error) {
        console.warn("M-Ads could not be shown; continuing in MStudy.", error);
      }
      bypass.add(target);
      target.click();
    };

    const handleClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;

      const gameButton = event.target.closest("button.game-start") as HTMLButtonElement | null;
      if (gameButton) {
        if (bypass.has(gameButton)) {
          bypass.delete(gameButton);
          return;
        }

        const label = gameButton.textContent?.trim().toLowerCase() || "";
        const isGameStart = label.includes("build my game") || label.includes("play again");
        if (!isGameStart || !canShowAd()) return;

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        void showAdThenContinue("mstudy-study-game-start", gameButton);
        return;
      }

      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const link = event.target.closest("a[href]") as HTMLAnchorElement | null;
      if (!link || bypass.has(link)) {
        if (link) bypass.delete(link);
        return;
      }

      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (!NAV_AD_PATHS.has(url.pathname)) return;
      if (url.pathname === window.location.pathname) return;

      const nextCount = Number(window.localStorage.getItem(NAV_COUNT_KEY) || "0") + 1;
      window.localStorage.setItem(NAV_COUNT_KEY, String(nextCount));

      if (nextCount % NAV_AD_EVERY !== 0 || !canShowAd()) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      void showAdThenContinue(`mstudy-nav-${url.pathname.replace(/^\//, "")}`, link);
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  return null;
}
