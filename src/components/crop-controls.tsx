"use client";

import { Crop, Move, RotateCcw } from "lucide-react";
import { calculateCoverCrop, DEFAULT_FRAMING, INSTAGRAM_HEIGHT, INSTAGRAM_WIDTH, type PhotoFraming } from "@/lib/geometry";
import { RangeControl } from "./range-control";

export function CropControls({ width, height, framing, disabled, onChange }: {
  width: number; height: number; framing: PhotoFraming; disabled: boolean;
  onChange: (framing: Partial<PhotoFraming>) => void;
}) {
  const crop = calculateCoverCrop(width, height, INSTAGRAM_WIDTH, INSTAGRAM_HEIGHT, framing);
  return <div className="crop-controls">
    <div className="crop-heading"><div><Crop size={17}/><h3>Enquadre do seu jeito</h3></div>
      <button className="text-button" disabled={disabled} onClick={() => onChange(DEFAULT_FRAMING)}><RotateCcw size={14}/>Centralizar corte</button>
    </div>
    <p className="crop-instructions"><Move size={14}/> Arraste a foto ou ajuste abaixo. Este corte vale só para esta imagem.</p>
    <div className="crop-sliders">
      <RangeControl label="Zoom da foto" value={framing.zoom * 100} min={100} max={300} disabled={disabled} onChange={(zoom) => onChange({ zoom: zoom / 100 })}/>
      <RangeControl label="Posição horizontal" value={framing.x} min={0} max={100} disabled={disabled || width - crop.width < 0.01} onChange={(x) => onChange({ x })}/>
      <RangeControl label="Posição vertical" value={framing.y} min={0} max={100} disabled={disabled || height - crop.height < 0.01} onChange={(y) => onChange({ y })}/>
    </div>
  </div>;
}
