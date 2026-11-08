/* Previews use local blob/data URLs and the same source crop as the export. */
/* eslint-disable @next/next/no-img-element */
"use client";

import { useRef, type CSSProperties, type PointerEvent } from "react";
import { calculateCoverCrop, DEFAULT_FRAMING, INSTAGRAM_HEIGHT, INSTAGRAM_WIDTH, type PhotoFraming } from "@/lib/geometry";
import type { WatermarkSettings } from "@/lib/image-processing";

export type LogoPreview = { url: string; width: number; height: number };

type Props = {
  src: string; width: number; height: number; name: string;
  logo: LogoPreview | null; settings: WatermarkSettings; original?: boolean;
  framing?: PhotoFraming;
  onFramingChange?: (framing: Partial<PhotoFraming>) => void;
  disabled?: boolean;
};

const clampPosition = (value: number) => Math.min(100, Math.max(0, value));

export function PhotoPreview({ src, width, height, name, logo, settings, original = false, framing = DEFAULT_FRAMING, onFramingChange, disabled = false }: Props) {
  const crop = calculateCoverCrop(width, height, INSTAGRAM_WIDTH, INSTAGRAM_HEIGHT, framing);
  const drag = useRef<{ pointerId: number; clientX: number; clientY: number; framing: PhotoFraming; scale: number; horizontalSpace: number; verticalSpace: number } | null>(null);
  const editable = Boolean(onFramingChange) && !disabled;

  function beginDrag(event: PointerEvent<HTMLDivElement>) {
    if (!editable || event.button !== 0) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    drag.current = {
      pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY,
      framing: { ...framing }, scale: crop.width / bounds.width,
      horizontalSpace: width - crop.width, verticalSpace: height - crop.height,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus({ preventScroll: true });
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    if (!start || !editable || start.pointerId !== event.pointerId) return;
    const x = start.horizontalSpace > 0.01
      ? start.framing.x - (event.clientX - start.clientX) * start.scale / start.horizontalSpace * 100 : start.framing.x;
    const y = start.verticalSpace > 0.01
      ? start.framing.y - (event.clientY - start.clientY) * start.scale / start.verticalSpace * 100 : start.framing.y;
    onFramingChange?.({ x: clampPosition(x), y: clampPosition(y) });
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return (
    <div className={`photo-frame ${editable ? "crop-editable" : ""}`} data-testid="crop-frame"
      style={{ "--photo-ratio": INSTAGRAM_WIDTH / INSTAGRAM_HEIGHT, backgroundColor: settings.format === "image/jpeg" ? "#fff" : "transparent" } as CSSProperties}
      role={editable ? "group" : undefined} tabIndex={editable ? 0 : undefined}
      aria-label={editable ? "Área de corte da foto. Arraste para enquadrar ou use as setas do teclado." : undefined}
      onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}
      onLostPointerCapture={() => { drag.current = null; }}
      onKeyDown={(event) => {
        if (!editable || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
        event.preventDefault();
        const step = event.shiftKey ? 5 : 1;
        if (event.key === "ArrowLeft") onFramingChange?.({ x: clampPosition(framing.x + step) });
        if (event.key === "ArrowRight") onFramingChange?.({ x: clampPosition(framing.x - step) });
        if (event.key === "ArrowUp") onFramingChange?.({ y: clampPosition(framing.y + step) });
        if (event.key === "ArrowDown") onFramingChange?.({ y: clampPosition(framing.y - step) });
      }}>
      <img className="photo-image" src={src} alt={name} draggable={false}
        style={{ left: `${-crop.x / crop.width * 100}%`, top: `${-crop.y / crop.height * 100}%`, width: `${width / crop.width * 100}%`, height: `${height / crop.height * 100}%`, maxWidth: "none" }} />
      {logo && !original && <img className="photo-watermark" src={logo.url} alt="Vinheta e assinatura AE Carvalho" draggable={false}
        style={{ inset: 0, width: "100%", height: "100%", opacity: settings.opacity / 100 }} />}
      {editable && <span className="crop-grid" aria-hidden="true" />}
    </div>
  );
}
