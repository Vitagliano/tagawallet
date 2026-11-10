"use client";
import { useEffect, useState } from "react";
import { BROWSERS, type Browser } from "@/lib/extension";

export type Visitor = { browser: Browser | null; desktop: boolean };

/** Chromium only. Brave hides behind Chrome's UA, so it's checked first. */
function detect(): Visitor {
  const ua = navigator.userAgent;
  const desktop = !/Mobi|Android|iPhone|iPad|iPod/i.test(ua);
  const nav = navigator as Navigator & { brave?: unknown; userAgentData?: { brands?: { brand: string }[] } };
  const brands = nav.userAgentData?.brands?.map((b) => b.brand) ?? [];
  if (nav.brave) return { browser: "brave", desktop };
  if (brands.some((b) => /Edge/i.test(b)) || /Edg\//.test(ua)) return { browser: "edge", desktop };
  if (/Firefox\//.test(ua) || /FxiOS/.test(ua)) return { browser: null, desktop };
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua) && !/Chromium\//.test(ua)) return { browser: null, desktop };
  if (brands.some((b) => /Chrome|Chromium/i.test(b)) || /Chrome\//.test(ua)) return { browser: "chrome", desktop };
  return { browser: null, desktop };
}

/** Server and first paint assume Chrome; the visitor's own browser fills in after hydration. */
export function useVisitor() {
  const [v, setV] = useState<Visitor>({ browser: "chrome", desktop: true });
  useEffect(() => { setV(detect()); }, []);
  const supported = !!v.browser && v.desktop;
  return {
    ...v,
    supported,
    label: supported ? `Add to ${BROWSERS[v.browser!]}` : "Get the extension",
    note: supported ? "Free. Chrome, Brave and Edge." : v.desktop ? "Chrome, Brave and Edge. Firefox and Safari aren't supported yet." : "Desktop browsers only. Open this on your computer.",
  };
}
