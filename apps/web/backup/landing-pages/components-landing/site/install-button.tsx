"use client";
import { EXTENSION_HREF, EXTENSION_STORE_URL } from "@/lib/extension";
import { useVisitor } from "./visitor";

const STYLE = {
  accent: "inline-flex items-center gap-2 rounded-full bg-accent px-7 py-4 text-lg font-medium text-accent-ink transition-transform duration-200 hover:scale-[1.04] active:scale-95",
  ink: "inline-flex items-center gap-2 rounded-full bg-[#1a0d07] px-7 py-4 text-lg font-medium text-white transition-transform duration-200 hover:scale-[1.04] active:scale-95",
  small: "inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 font-medium text-accent-ink transition-transform duration-200 hover:scale-[1.04] active:scale-95",
  link: "inline-flex items-center gap-1 hover:underline",
};

/** The install call to action. It names the visitor's browser, and says when theirs isn't supported. */
export function InstallButton({ variant = "accent", note = false, hideOnPhone = false, className = "" }: { variant?: keyof typeof STYLE; note?: boolean; hideOnPhone?: boolean; className?: string }) {
  const v = useVisitor();
  const external = EXTENSION_STORE_URL.startsWith("http");
  return (
    <span className={`${hideOnPhone ? "hidden sm:inline-flex" : "inline-flex"} flex-col items-center gap-2 ${className}`}>
      <a href={EXTENSION_HREF} target={external ? "_blank" : undefined} rel={external ? "noopener" : undefined} className={STYLE[variant]}>
        {v.label}<span className="cta-arrow" aria-hidden>→</span>
      </a>
      {note && <span className="text-sm text-muted">{v.note}</span>}
    </span>
  );
}
