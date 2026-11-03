"use client";

import { Maximize, ZoomIn, ZoomOut } from "lucide-react";
import {
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { Button } from "@/shared/ui/button";

const MIN_ZOOM = 1;
const MAX_ZOOM = 6;
const PAN_STEP = 40;

const clampZoom = (zoom: number) =>
  Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

/** The plan image with zoom and pan: buttons, Ctrl+wheel, drag, or arrow keys when focused. */
export function PlanViewport({ alt, src }: { alt: string; src: string }) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);

  const zoomTo = (next: number) => {
    const clamped = clampZoom(next);
    setZoom(clamped);
    if (clamped === MIN_ZOOM) setPan({ x: 0, y: 0 });
  };

  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    // React's wheel listener is passive. A plain wheel stays with the page, so it can scroll.
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      setZoom((z) => {
        const next = clampZoom(z * (event.deltaY < 0 ? 1.15 : 0.87));
        if (next === MIN_ZOOM) setPan({ x: 0, y: 0 });
        return next;
      });
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, []);

  const onKeyDown = (event: KeyboardEvent) => {
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [PAN_STEP, 0],
      ArrowRight: [-PAN_STEP, 0],
      ArrowUp: [0, PAN_STEP],
      ArrowDown: [0, -PAN_STEP],
    };
    const move = moves[event.key];
    if (!move || zoom === MIN_ZOOM) return;
    event.preventDefault();
    setPan((p) => ({ x: p.x + move[0], y: p.y + move[1] }));
  };

  const onPointerDown = (event: PointerEvent) => {
    if (zoom === MIN_ZOOM) return;
    drag.current = { x: event.clientX - pan.x, y: event.clientY - pan.y };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent) => {
    if (drag.current) {
      setPan({
        x: event.clientX - drag.current.x,
        y: event.clientY - drag.current.y,
      });
    }
  };

  return (
    <div className="space-y-2">
      <div
        ref={frame}
        role="group"
        aria-label="Floor plan viewer"
        tabIndex={0}
        data-zoom={zoom}
        data-pan={`${pan.x},${pan.y}`}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        className={`border-border overflow-hidden rounded-lg border ${zoom > 1 ? "cursor-grab touch-none" : ""}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- a data URL isolates the SVG's styles */}
        <img
          alt={alt}
          src={src}
          draggable={false}
          className="block h-auto w-full origin-center select-none"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        />
      </div>
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="sm"
          aria-label="Zoom in"
          onClick={() => zoomTo(zoom * 1.5)}
        >
          <ZoomIn aria-hidden className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Zoom out"
          onClick={() => zoomTo(zoom / 1.5)}
        >
          <ZoomOut aria-hidden className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Reset view"
          onClick={() => zoomTo(MIN_ZOOM)}
        >
          <Maximize aria-hidden className="size-4" />
        </Button>
      </div>
    </div>
  );
}
