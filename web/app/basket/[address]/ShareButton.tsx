"use client";

import {useState} from "react";

/**
 * Copies the basket's public link.
 *
 * A basket is only worth deploying if other people can find it, so sharing is a
 * first-class action rather than something buried in the address bar.
 */
export default function ShareButton({name, theme}: {name: string; theme: string}) {
  const [state, setState] = useState<"idle" | "copied" | "shared">("idle");

  async function share() {
    const url = typeof window === "undefined" ? "" : window.location.href;
    const text = `${name} — "${theme}". A fully backed basket of tokenized equities on X Layer.`;

    // Use the native sheet where there is one; fall back to the clipboard.
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({title: name, text, url});
        setState("shared");
        return;
      } catch {
        // Dismissed, or unsupported in this context: fall through to copying.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setState("copied");
      setTimeout(() => setState("idle"), 2200);
    } catch {
      setState("idle");
    }
  }

  return (
    <button className="ghost small" onClick={share}>
      {state === "copied" ? "Link copied" : state === "shared" ? "Shared" : "Share basket"}
    </button>
  );
}
