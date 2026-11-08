/* Photo-editor previews use local blob and data URLs, without image optimization. */
/* eslint-disable @next/next/no-img-element */
"use client";

import type { CSSProperties } from "react";
import { calculateWatermarkPlacement } from "@/lib/geometry";
import type { WatermarkSettings } from "@/lib/image-processing";

export type LogoPreview = { url: string; width: number; height: number };

export function PhotoPreview({ src, width, height, name, logo, settings, original = false }: {
  src: string; width: number; height: number; name: string;
  logo: LogoPreview | null; settings: WatermarkSettings; original?: boolean;
}) {
  const placement = logo ? calculateWatermarkPlacement(width, height, logo.width, logo.height, settings) : null;
  return (
    <div className="photo-frame" style={{ "--photo-ratio": width / height, backgroundColor: !original && settings.format === "image/jpeg" ? "#fff" : "transparent" } as CSSProperties}>
      <img className="photo-image" src={src} alt={name} draggable={false} />
      {logo && placement && !original && (
        <img className="photo-watermark" src={logo.url} alt="Marca d’água AE Carvalho" draggable={false}
          style={{ left: `${placement.x / width * 100}%`, top: `${placement.y / height * 100}%`, width: `${placement.width / width * 100}%`, height: `${placement.height / height * 100}%`, opacity: settings.opacity / 100 }} />
      )}
    </div>
  );
}
