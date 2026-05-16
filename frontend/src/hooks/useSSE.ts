"use client";

import { useEffect } from "react";
import { usePriceStore } from "@/lib/store";
import type { PriceUpdate } from "@/lib/store";

/**
 * Connects a single EventSource to /api/stream/prices and populates the Zustand price store.
 * Call once at the app root. Cleans up on unmount.
 */
export function useSSE(): void {
  useEffect(() => {
    // In dev (port 3000) connect directly to the backend to bypass the
    // Next.js proxy, which buffers streaming responses and breaks SSE.
    // In production FastAPI serves both the static files and the API on
    // the same origin, so a relative URL is correct.
    const apiBase =
      typeof window !== "undefined" && window.location.port === "3000"
        ? "http://localhost:8000"
        : "";
    const source = new EventSource(`${apiBase}/api/stream/prices`);
    usePriceStore.getState().setStatus("CONNECTING");

    source.onopen = () => {
      usePriceStore.getState().setStatus("OPEN");
    };

    source.onmessage = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data) as Record<string, PriceUpdate>;
        usePriceStore.getState().setPrices(payload);
      } catch (err) {
        console.error("SSE parse error:", err);
      }
    };

    source.onerror = () => {
      usePriceStore.getState().setStatus("CLOSED");
      // EventSource has built-in retry — do not call source.close() here
    };

    return () => {
      source.close();
    };
  }, []);
}
