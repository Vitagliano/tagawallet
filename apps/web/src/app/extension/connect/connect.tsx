"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import { AuthFrame } from "@/components/auth-forms";
import { Button, ErrorNote } from "@/components/ui";

export function ConnectExtension() {
  const ext = useSearchParams().get("ext") ?? "";
  const [state, setState] = useState<"idle" | "done">("idle"), [error, setError] = useState("");
  async function connect() {
    setError("");
    try {
      const chrome = (window as any).chrome;
      if (!chrome?.runtime?.sendMessage || !/^[a-p]{32}$/.test(ext)) throw new Error("Open this page from the extension's popup, in the browser where it's installed.");
      const { token } = await api("/api/extension/connect", { method: "POST" });
      // Handed straight to the extension over Chrome messaging, so it never appears in a URL or page.
      await new Promise<void>((resolve, reject) => {
        chrome.runtime.sendMessage(ext, { type: "tagawallet:connect", token }, (res: { ok?: boolean } | undefined) => {
          if (chrome.runtime.lastError || !res?.ok) reject(new Error("The extension didn't respond. Check that it's installed and enabled."));
          else resolve();
        });
      });
      setState("done");
    } catch (e) { setError((e as Error).message); }
  }
  return (
    <AuthFrame title="Connect the extension">
      {state === "done" ? (
        <p role="status" className="text-sm text-good">Connected. You can close this tab and start tagging.</p>
      ) : (
        <div className="space-y-4 text-sm">
          <p className="text-muted">The extension will be able to:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>look up labels you&apos;re allowed to see for addresses it finds</li>
            <li>save tags to your lists</li>
          </ul>
          <p className="text-muted">It never sends page content or browsing history, and it can&apos;t sign transactions.</p>
          <ErrorNote>{error}</ErrorNote>
          <Button variant="primary" className="w-full" onClick={connect}>Connect this browser</Button>
        </div>
      )}
    </AuthFrame>
  );
}
