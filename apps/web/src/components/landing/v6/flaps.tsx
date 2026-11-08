"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/ui";
import { reducedMotion } from "../shared";

/* Solari board. A callsign is a tag. A near flight cannot borrow it. */

const ROWS = [
  { id: "a", no: "TA 4C1F", addr: "0x4c1f…c2a8", to: "ETH" },
  { id: "b", no: "TA 91AA", addr: "0x91aa…10e4", to: "BASE" },
  { id: "c", no: "TA 7KQP", addr: "7KqP…m2nR", to: "SOL" },
  { id: "x", no: "TA 4C1G", addr: "0x4c1f…c2a9", to: "ETH" },
];

const near = (a: string, b: string) => a.slice(0, 6) === b.slice(0, 6) && a !== b;

function useFlap(target: string) {
  const [shown, setShown] = useState(target);
  const first = useRef(true);
  useEffect(() => {
    if (first.current || reducedMotion()) {
      first.current = false;
      setShown(target);
      return;
    }
    const glyphs = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .-";
    let n = 0;
    const id = setInterval(() => {
      n += 1;
      if (n > 14) { setShown(target); clearInterval(id); return; }
      setShown(target.split("").map((ch, i) => (ch === " " || n > i + 3 ? ch : glyphs[Math.floor(Math.random() * glyphs.length)])).join(""));
    }, 42);
    return () => clearInterval(id);
  }, [target]);
  return shown;
}

function Flaps({ text }: { text: string }) {
  const shown = useFlap(text.padEnd(14, " ").slice(0, 14));
  return (
    <span className="inline-flex gap-px" aria-hidden>
      {shown.split("").map((ch, i) => (
        <span key={`${i}-${ch}`} className="flap-char inline-grid h-8 w-5 place-items-center bg-[#12171c] font-mono text-[11px] text-[#f5d76e] shadow-[inset_0_-6px_0_#07090b] md:h-10 md:w-6 md:text-sm">{ch}</span>
      ))}
    </span>
  );
}

export function FlapsLanding({ signedIn }: { signedIn: boolean }) {
  const [names, setNames] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState("MINA");
  const [row, setRow] = useState("a");
  const [hold, setHold] = useState("");

  function assign(id: string) {
    const value = draft.trim().toUpperCase();
    if (!value) return;
    const addr = ROWS.find((r) => r.id === id)?.addr ?? "";
    const twin = ROWS.find((r) => r.id !== id && names[r.id] === value && near(r.addr, addr));
    if (twin) { setHold(`${twin.no} already carries ${value}.`); return; }
    setHold("");
    setNames((n) => ({ ...n, [id]: value }));
  }

  return (
    <main className="min-h-screen pb-28" style={{ background: "#07090b", color: "#f4efe4" }}>
      <header className="flex items-center justify-between px-4 py-4 md:px-6">
        <Link href="/" aria-label="TagAWallet home"><Logo className="text-lg" /></Link>
        <p className="font-mono text-[10px] tracking-[0.28em] text-[#f5d76e]">DEPARTURES</p>
      </header>

      <section className="px-4 pb-8 pt-2 md:px-6">
        <p className="font-mono text-[10px] tracking-[0.22em] text-[#f5d76e]">ACT I · THE BOARD</p>
        <h1 className="mt-3 max-w-4xl text-4xl leading-[0.95] md:text-6xl">Give the flight a callsign.</h1>
        <div className="mt-6 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="font-mono text-[10px] tracking-[0.16em] text-[#9aa4b2]">CALLSIGN</span>
            <input value={draft} maxLength={14} onChange={(e) => setDraft(e.target.value.toUpperCase())} className="mt-1 block w-48 border border-[#f5d76e]/40 bg-transparent px-2 py-2 font-mono uppercase outline-none" />
          </label>
          <button type="button" onClick={() => assign(row)} className="bg-[#f5d76e] px-4 py-2 font-mono text-sm font-medium text-[#14180c]">Flip it</button>
        </div>
        <div className="mt-6 overflow-x-auto border border-[#222830]">
          <table className="w-full min-w-[640px] text-left">
            <tbody>
              {ROWS.filter((r) => r.id !== "x").map((r) => (
                <tr key={r.id} className={row === r.id ? "bg-[#12171c]" : ""}>
                  <td className="px-3 py-3"><button type="button" onClick={() => setRow(r.id)} className="font-mono text-[#f5d76e]">{r.no}</button></td>
                  <td className="px-3 py-3 font-mono text-xs text-[#9aa4b2]">{r.to}</td>
                  <td className="px-3 py-3"><Flaps text={names[r.id] || r.addr} /></td>
                  <td className="px-3 py-3 font-mono text-xs text-[#f5d76e]">{names[r.id] ? "NAMED" : "OPEN"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="border-y border-[#222830] bg-[#0c1014]">
        <div className="mx-auto w-full max-w-5xl px-4 py-16 md:px-6 md:py-24">
          <p className="font-mono text-[10px] tracking-[0.22em] text-[#f5d76e]">ACT II · ONE PASSENGER</p>
          <h2 className="mt-3 max-w-2xl text-4xl leading-tight md:text-5xl">The same person may board on every chain.</h2>
          <p className="mt-4 max-w-lg text-[#9aa4b2]">Flip TA 91AA and TA 7KQP onto Mina's callsign. Different flights, one passenger, one name on the passport.</p>
          <p className="mt-6 font-mono text-sm text-[#f5d76e]">{Object.keys(names).length} named · passport reads {names.a || "—"}</p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 py-16 md:px-6 md:py-24">
        <p className="font-mono text-[10px] tracking-[0.22em] text-[#ff8d7a]">ACT III · GATE CHANGE</p>
        <h2 className="mt-3 text-4xl md:text-5xl">TA 4C1G is a different aircraft.</h2>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Flaps text={names.x || ROWS[3].addr} />
          <button type="button" onClick={() => assign("x")} className="border border-[#ff8d7a] px-3 py-2 font-mono text-sm text-[#ff8d7a]">Assign {draft || "callsign"}</button>
        </div>
        <p className="mt-4 min-h-6 font-mono text-sm text-[#ff8d7a]" role="status">{hold || (names.x ? `${names.x} is its own callsign.` : "")}</p>
        <Link href={signedIn ? "/dashboard" : "/signup"} className="mt-8 inline-flex bg-[#f5d76e] px-4 py-2.5 font-medium text-[#14180c]">{signedIn ? "Open dashboard" : "Name a flight. It's free."}</Link>
      </section>
    </main>
  );
}
