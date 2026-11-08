/**
 * The floating panel: the extension's panel page, framed over the site.
 * The frame is an extension page, so the site can't read or script it. The two talk over a private
 * MessageChannel handed only to the frame's origin, so the site can't move or close it either.
 */

import type { Route } from "../lib/messages";

const TAG = "tagawallet-panel";
const POS_KEY = "floatPanel";
const WIDTH = 384;
const MIN_HEIGHT = 360;
const GAP = 12;

type Pos = { right: number; top: number; height: number };

let host: HTMLElement | null = null;
let port: MessagePort | null = null;
/** What to show once the frame is ready, when a page action opened the panel. */
let pendingRoute: Route | null = null;
let pos: Pos = { right: 16, top: 16, height: 640 };

const CSS = `
  :host { all: initial; position: fixed; z-index: 2147483646; display: block; width: ${WIDTH}px; max-width: calc(100vw - ${GAP * 2}px);
    border-radius: 16px; overflow: hidden; background: #f6f4ee;
    box-shadow: 0 0 0 1px rgb(26 26 24 / .10), 0 24px 64px -16px rgb(0 0 0 / .45), 0 8px 20px -8px rgb(0 0 0 / .25);
    animation: in 180ms cubic-bezier(.2,.8,.2,1); }
  :host([data-theme=dark]) { background: #141412; box-shadow: 0 0 0 1px rgb(239 236 227 / .12), 0 24px 64px -16px rgb(0 0 0 / .6), 0 8px 20px -8px rgb(0 0 0 / .4); }
  :host([data-leaving]) { animation: out 140ms ease-in forwards; }
  iframe { display: block; width: 100%; height: 100%; border: 0; background: transparent; }
  .grip { position: absolute; left: 50%; bottom: 0; width: 56px; height: 12px; transform: translateX(-50%); cursor: ns-resize; touch-action: none; }
  .grip::after { content: ""; position: absolute; left: 50%; top: 5px; width: 32px; height: 3px; border-radius: 3px; transform: translateX(-50%); background: rgb(128 128 128 / .35); opacity: 0; transition: opacity 150ms; }
  :host(:hover) .grip::after { opacity: 1; }
  @keyframes in { from { opacity: 0; transform: translateY(8px) scale(.98); } }
  @keyframes out { to { opacity: 0; transform: translateY(8px) scale(.98); } }
  @media (prefers-reduced-motion: reduce) { :host, :host([data-leaving]) { animation: none; } }
`;

/** Whether the page reads as dark: its body background, or the OS when the page sets none. */
function pageIsDark() {
  for (const el of [document.body, document.documentElement]) {
    if (!el) continue;
    const m = getComputedStyle(el).backgroundColor.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/);
    if (!m || (m[4] !== undefined && Number(m[4]) < 0.4)) continue;
    return (0.2126 * Number(m[1]) + 0.7152 * Number(m[2]) + 0.0722 * Number(m[3])) / 255 < 0.42;
  }
  return matchMedia("(prefers-color-scheme: dark)").matches;
}

function clamp(p: Pos): Pos {
  const width = Math.min(WIDTH, innerWidth - GAP * 2);
  const height = Math.max(Math.min(MIN_HEIGHT, innerHeight - GAP * 2), Math.min(p.height, innerHeight - GAP * 2));
  return {
    height,
    top: Math.min(Math.max(GAP, p.top), Math.max(GAP, innerHeight - height - GAP)),
    right: Math.min(Math.max(GAP, p.right), Math.max(GAP, innerWidth - width - GAP)),
  };
}

function place() {
  if (!host) return;
  pos = clamp(pos);
  Object.assign(host.style, { top: `${pos.top}px`, right: `${pos.right}px`, height: `${pos.height}px` });
}

const save = () => void chrome.storage.local.set({ [POS_KEY]: pos }).catch(() => {});
// Saved shortly after the last move too, so the spot is kept even if the drag's end never arrives.
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const saveSoon = () => { if (saveTimer) clearTimeout(saveTimer); saveTimer = setTimeout(save, 250); };

function onPortMessage(e: MessageEvent) {
  const m = e.data as { type?: string; dx?: number; dy?: number; theme?: string };
  if (m?.type === "move") { pos.right -= m.dx ?? 0; pos.top += m.dy ?? 0; place(); saveSoon(); }
  if (m?.type === "moveEnd") { if (saveTimer) clearTimeout(saveTimer); save(); }
  if (m?.type === "close") closePanel();
  if (m?.type === "theme" && host) host.setAttribute("data-theme", m.theme === "dark" ? "dark" : "light");
}

export const panelOpen = () => !!host;

let opening = false;
/** Opens the floating panel, or brings an open one to `route`. */
export async function openPanel(route?: Route) {
  if (route) {
    if (port) port.postMessage({ type: "route", route });
    else pendingRoute = route;
  }
  if (host || opening) return;
  opening = true;
  try { await mount(); } finally { opening = false; }
}

/**
 * A card or right-click action: show it where the person keeps the panel.
 * The side panel if that's their choice and Chrome lets us open it from here, otherwise floating over the page.
 * The message goes first, before any await, so the click still counts as a user gesture.
 */
export async function routeTo(route: Route) {
  const r = await chrome.runtime.sendMessage({ type: "openRoute", route }).catch(() => null) as { opened?: boolean } | null;
  if (r?.opened) return;
  await openPanel(route);
}

async function mount() {
  const saved = (await chrome.storage.local.get(POS_KEY).catch(() => ({})) as Record<string, Pos | undefined>)[POS_KEY];
  pos = saved ?? { right: 16, top: 16, height: Math.min(680, innerHeight - GAP * 2) };

  host = document.createElement(TAG);
  const shadow = host.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  style.textContent = CSS;
  const frame = document.createElement("iframe");
  frame.title = "TagAWallet";
  // Copy buttons inside the frame need this. Nothing else is granted.
  frame.allow = "clipboard-write";
  // Any site could frame panel.html, so the panel only draws for a frame we placed: the background
  // holds this one-time nonce for this tab, and the panel checks it before showing anything.
  const nonce = crypto.randomUUID();
  await chrome.runtime.sendMessage({ type: "floatNonce", nonce }).catch(() => {});
  // With the "system" theme the panel matches the page under it, like the chips and card do: dark on a dark site.
  frame.src = chrome.runtime.getURL(`panel.html?host=float&n=${nonce}&page=${pageIsDark() ? "dark" : "light"}`);
  frame.addEventListener("load", () => {
    const channel = new MessageChannel();
    port = channel.port1;
    port.onmessage = onPortMessage;
    frame.contentWindow?.postMessage({ type: "taw:port" }, new URL(frame.src).origin, [channel.port2]);
    if (pendingRoute) { port.postMessage({ type: "route", route: pendingRoute }); pendingRoute = null; }
  });

  // Height is resized from the bottom edge. Width stays put, so the layout inside never reflows sideways.
  const grip = document.createElement("div");
  grip.className = "grip";
  grip.title = "Drag to resize";
  grip.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    grip.setPointerCapture(e.pointerId);
    const startY = e.clientY, startH = pos.height;
    frame.style.pointerEvents = "none";
    const move = (ev: PointerEvent) => { pos.height = startH + (ev.clientY - startY); place(); };
    const up = () => {
      frame.style.pointerEvents = "";
      grip.removeEventListener("pointermove", move);
      grip.removeEventListener("pointerup", up);
      save();
    };
    grip.addEventListener("pointermove", move);
    grip.addEventListener("pointerup", up);
  });

  shadow.append(style, frame, grip);
  document.documentElement.append(host);
  place();
  addEventListener("resize", place);
}

export function closePanel() {
  const leaving = host;
  if (!leaving) return;
  host = null;
  port?.close();
  port = null;
  pendingRoute = null;
  removeEventListener("resize", place);
  leaving.setAttribute("data-leaving", "");
  setTimeout(() => leaving.remove(), 150);
}

export function togglePanel() {
  if (host) closePanel();
  else void openPanel();
}

// Escape closes it even while focus is on the page rather than inside the panel.
addEventListener("keydown", (e) => { if (e.key === "Escape" && host && !e.defaultPrevented) closePanel(); });
