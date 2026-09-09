"use client";

import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { usePathname, useSearchParams } from "next/navigation";

export function NavigationLoadingOverlay() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pendingRoute, setPendingRoute] = useState<string | null>(null);
  const routeKey = `${pathname}?${searchParams.toString()}`;
  const pending = pendingRoute !== null && pendingRoute !== routeKey;

  useEffect(() => {
    function startLoading(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target.closest("a") : null;
      if (!(target instanceof HTMLAnchorElement) || target.hasAttribute("download")) return;
      if (target.target && target.target !== "_self") return;

      const destination = new URL(target.href, window.location.href);
      const current = new URL(window.location.href);
      if (destination.origin !== current.origin) return;
      if (destination.pathname === current.pathname && destination.search === current.search) return;

      const destinationKey = `${destination.pathname}?${destination.searchParams.toString()}`;
      flushSync(() => setPendingRoute(destinationKey));
    }

    document.addEventListener("click", startLoading, true);
    return () => document.removeEventListener("click", startLoading, true);
  }, []);

  useEffect(() => {
    if (!pending) return;
    const fallback = window.setTimeout(() => setPendingRoute(null), 20000);
    return () => window.clearTimeout(fallback);
  }, [pending]);

  if (!pending) return null;

  return (
    <div className="fixed inset-0 z-[100] grid cursor-wait place-items-center bg-[#080a09]/55 px-5 backdrop-blur-md" role="status" aria-live="assertive" aria-label="Cargando página">
      <div className="flex items-center gap-4 rounded-full border border-[#c6a86d]/35 bg-[#111513]/95 px-6 py-4 shadow-[0_24px_90px_rgba(0,0,0,.6)]">
        <span className="relative grid size-10 place-items-center rounded-full border border-[#c6a86d]/35 bg-[#c6a86d]/8">
          <span className="absolute size-3 animate-ping rounded-full bg-[#c6a86d]/45 motion-reduce:animate-none" />
          <span className="size-2 rounded-full bg-[#d7bb7e]" />
        </span>
        <span className="text-sm tracking-wide text-[#e5ded1]">Cargando…</span>
      </div>
    </div>
  );
}
