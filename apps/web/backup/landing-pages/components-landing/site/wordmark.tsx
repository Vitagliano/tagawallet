"use client";
import { useRef } from "react";
import { useScrollProgress } from "../shared";

/** The footer wordmark slides in as the page ends, as in Story. */
export function Wordmark() {
  const root = useRef<HTMLParagraphElement>(null);
  useScrollProgress(root, (p) => { if (root.current) root.current.style.transform = `translateX(${(1 - p) * 10}%)`; });
  return <p ref={root} aria-hidden className="-mb-[1.5vw] whitespace-nowrap text-center text-[17vw] font-semibold leading-none tracking-tighter text-white will-change-transform">TagAWallet</p>;
}
