"use client";
import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/ui";

/* A night telephone exchange. Cords are private tags. A lookalike shorts the board. */

const TRUNKS = [
  { id: "a", addr: "0x4c1f…c2a8", city: "Ethereum" },
  { id: "b", addr: "0x91aa…10e4", city: "Base" },
  { id: "c", addr: "7KqP…m2nR", city: "Solana" },
];
const WRONG = { id: "x", addr: "0x4c1f…c2a9", city: "Ethereum" };
const ALL = [...TRUNKS, WRONG];
const PRESET = ["Mina", "Northwind", "Rio"];

const near = (a: string, b: string) => a.slice(0, 6) === b.slice(0, 6) && a !== b;

export function OperatorLanding({ signedIn }: { signedIn: boolean }) {
  const [cord, setCord] = useState<Record<string, string>>({});
  const [lifted, setLifted] = useState<string | null>("a");
  const [custom, setCustom] = useState("");
  const [shorted, setShorted] = useState("");
  const pegs = [...PRESET, custom.trim()].filter((p, i, arr) => p && arr.indexOf(p) === i);

  function seat(id: string, addr: string, peg: string) {
    const twin = ALL.find((t) => t.id !== id && cord[t.id] === peg && near(t.addr, addr));
    if (twin) {
      setShorted(`${peg} is already holding ${twin.addr}.`);
      return;
    }
    setShorted("");
    setCord((c) => ({ ...c, [id]: peg }));
    setLifted(null);
  }

  const seated = Object.entries(cord);

  return (
    <main className="min-h-screen pb-28" style={{ background: "#140e0a", color: "#f3e6d0" }}>
      <header className="flex items-center justify-between px-5 py-4">
        <Link href="/" aria-label="TagAWallet home"><Logo className="text-lg" /></Link>
        <p className="text-[10px] uppercase tracking-[0.28em] text-[#d7b56d]">Night exchange</p>
      </header>

      <section className="mx-auto grid w-full max-w-5xl gap-10 px-5 pb-16 pt-6 md:grid-cols-[1.15fr_.85fr] md:pt-12">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[#d7b56d]">Act I · The board</p>
          <h1 className="mt-3 text-5xl leading-[0.92] tracking-tight md:text-7xl" style={{ fontFamily: "Iowan Old Style, Palatino, Georgia, serif" }}>Lift a trunk. Seat the cord.</h1>
          <ul className="mt-8 space-y-3">
            {TRUNKS.map((t) => {
              const name = cord[t.id];
              const hot = lifted === t.id;
              return (
                <li key={t.id}>
                  <button type="button" onClick={() => setLifted(t.id)} aria-pressed={hot} className={`flex w-full items-center gap-3 rounded-full border px-4 py-3 text-left ${hot ? "border-[#d7b56d] bg-[#2a1c14]" : "border-[#3a2c22]"}`}>
                    <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: name ? "#b6f2a0" : "#3a2c22", boxShadow: name ? "0 0 14px #b6f2a0" : undefined }} />
                    <span className="min-w-0 flex-1">
                      <span className="addr block">{t.addr}</span>
                      <span className="text-[10px] uppercase tracking-[0.16em] text-[#a89078]">{t.city}</span>
                    </span>
                    <span className="text-sm text-[#d7b56d]">{name ?? (hot ? "In hand" : "Lift")}</span>
                  </button>
                  {name && <span className="cord-draw mt-1 block h-px bg-[#d7b56d]" />}
                </li>
              );
            })}
          </ul>
        </div>
        <div className="md:pt-16">
          <p className="text-xs uppercase tracking-[0.18em] text-[#a89078]">Peg board</p>
          <label htmlFor="new-peg" className="mt-4 block text-sm text-[#cbbba4]">Cut a peg</label>
          <input id="new-peg" value={custom} maxLength={24} onChange={(e) => setCustom(e.target.value)} placeholder="People I pay" className="mt-1 w-full border-b border-[#d7b56d]/50 bg-transparent py-2 outline-none placeholder:text-[#6d5c4e]" />
          <div className="mt-4 flex flex-col gap-2">
            {pegs.map((p) => (
              <button key={p} type="button" disabled={!lifted} onClick={() => { const t = TRUNKS.find((x) => x.id === lifted); if (t) seat(t.id, t.addr, p); }} className="rounded-md border border-[#d7b56d]/40 px-4 py-3 text-left disabled:opacity-35">
                <span className="block text-xl" style={{ fontFamily: "Iowan Old Style, Palatino, Georgia, serif" }}>{p}</span>
                <span className="text-xs text-[#a89078]">{lifted ? "Seat the cord" : "Lift a trunk first"}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section style={{ background: "#1c1410" }}>
        <div className="mx-auto w-full max-w-5xl px-5 py-16 md:py-24">
          <p className="text-xs uppercase tracking-[0.22em] text-[#d7b56d]">Act II · Three cities, one cord</p>
          <h2 className="mt-3 max-w-2xl text-4xl leading-[1.05] md:text-5xl" style={{ fontFamily: "Iowan Old Style, Palatino, Georgia, serif" }}>Whatever you seated is already on the street.</h2>
          <div className="mt-8 grid gap-3 md:grid-cols-3">
            {["Etherscan", "X", "A site you turned on"].map((site) => (
              <article key={site} className="min-h-44 border border-[#3a2c22] p-4" style={{ background: "#140e0a" }}>
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#a89078]">{site}</p>
                <ul className="mt-4 space-y-3">
                  {seated.length === 0 && <li className="text-sm text-[#6d5c4e]">Lamps dark.</li>}
                  {seated.map(([id, name]) => {
                    const t = ALL.find((x) => x.id === id);
                    return <li key={site + id}><span className="addr text-sm text-[#a89078]">{t?.addr}</span><span className="mt-1 block text-[#b6f2a0]">{name}</span></li>;
                  })}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-5 py-16 md:py-24">
        <p className="text-xs uppercase tracking-[0.22em] text-[#ff8d7a]">Act III · Crossed line</p>
        <h2 className="mt-3 max-w-3xl text-4xl leading-[1.02] md:text-6xl" style={{ fontFamily: "Iowan Old Style, Palatino, Georgia, serif" }}>{WRONG.addr} is not the trunk you think it is.</h2>
        <p className="mt-4 max-w-lg text-[#cbbba4]">Same first digits. A different wallet. A peg may hold many chains when they are the same person. It will not hold a twin.</p>
        <div className={`mt-8 flex flex-wrap gap-2 ${shorted ? "shake" : ""}`}>
          {pegs.map((p) => (
            <button key={p} type="button" onClick={() => seat(WRONG.id, WRONG.addr, p)} className="rounded-full border border-[#ff8d7a]/60 px-3 py-2 text-sm">{cord[WRONG.id] === p ? `Seated · ${p}` : `Try ${p}`}</button>
          ))}
        </div>
        <p className="mt-4 min-h-6 text-sm" role="status" style={{ color: shorted ? "#ff8d7a" : "#b6f2a0" }}>{shorted || (cord[WRONG.id] ? `Seated on ${cord[WRONG.id]}. The twin keeps its own peg.` : "")}</p>
        <Link href={signedIn ? "/dashboard" : "/signup"} className="mt-8 inline-flex bg-[#d7b56d] px-4 py-2.5 font-medium text-[#140e0a]">{signedIn ? "Open dashboard" : "Take a peg. It's free."}</Link>
        <p className="mt-4 max-w-md text-xs text-[#a89078]">The exchange holds no funds and never asks for a key.</p>
      </section>
    </main>
  );
}
