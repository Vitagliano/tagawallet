"use client";

import { useEffect } from "react";

/**
 * app/icon.svg follows the OS via prefers-color-scheme. An explicit Settings → Display choice
 * sets data-theme, which SVG media queries can't see — so this swaps a fixed light/dark favicon.
 * Switching back to system restores the adaptive SVG even if the SSR metadata still points at a fixed one.
 */
export function ThemeFavicon() {
  useEffect(() => {
    const sync = () => {
      const forced = document.documentElement.dataset.theme;
      let link = document.querySelector<HTMLLinkElement>('link[rel="icon"][data-taw-theme]');
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        link.type = "image/svg+xml";
        link.dataset.tawTheme = "";
        document.head.appendChild(link);
      }
      link.href = forced === "dark" ? "/icon-dark.svg" : forced === "light" ? "/icon-light.svg" : "/icon-system.svg";
    };
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);
  return null;
}
