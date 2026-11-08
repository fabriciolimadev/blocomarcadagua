"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createPhotoZip,
  createThumbnail,
  DEFAULT_SETTINGS,
  downloadBlob,
  outputFileName,
  processPhoto,
  validatePhoto,
  type WatermarkSettings,
} from "@/lib/image-processing";

export type PhotoItem = {
  id: string;
  file: File;
  name: string;
  previewUrl: string;
  width: number;
  height: number;
};

type Progress = { current: number; total: number; label: string };

const MAX_PHOTOS = 50;
const MAX_TOTAL_BYTES = 300 * 1024 * 1024;

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

export function usePhotoEditor() {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [settings, setSettings] = useState<WatermarkSettings>({ ...DEFAULT_SETTINGS });
  const [importing, setImporting] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [preparedZip, setPreparedZip] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Refs also guard actions that occur before React has rendered a busy state.
  const photosRef = useRef<PhotoItem[]>([]);
  const activeIdRef = useRef<string | null>(null);
  const settingsRef = useRef<WatermarkSettings>({ ...DEFAULT_SETTINGS });
  const preparedZipRef = useRef<Blob | null>(null);
  const mountedRef = useRef(false);
  const operationRef = useRef<symbol | null>(null);
  const nextPhotoIdRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      operationRef.current = null;
      for (const photo of photosRef.current) URL.revokeObjectURL(photo.previewUrl);
      photosRef.current = [];
      preparedZipRef.current = null;
    };
  }, []);

  const isCurrentOperation = useCallback((operation: symbol) => (
    mountedRef.current && operationRef.current === operation
  ), []);

  const invalidateZip = useCallback(() => {
    preparedZipRef.current = null;
    setPreparedZip(null);
  }, []);

  const selectPhoto = useCallback((id: string) => {
    if (!mountedRef.current || operationRef.current) return;
    if (!photosRef.current.some((photo) => photo.id === id)) return;
    activeIdRef.current = id;
    setActiveId(id);
  }, []);

  const updateSettings = useCallback((partial: Partial<WatermarkSettings>) => {
    if (!mountedRef.current || operationRef.current) return;
    const previous = settingsRef.current;
    const next = { ...previous };
    for (const key of ["size", "margin", "opacity"] as const) {
      const value = partial[key];
      if (typeof value === "number" && Number.isFinite(value)) next[key] = value;
    }
    if (partial.format === "image/jpeg" || partial.format === "image/png") {
      next.format = partial.format;
    }
    if (next.size === previous.size && next.margin === previous.margin
      && next.opacity === previous.opacity && next.format === previous.format) return;
    settingsRef.current = next;
    setSettings(next);
    invalidateZip();
    setError(null);
  }, [invalidateZip]);

  const addFiles = useCallback(async (files: File[]) => {
    if (!mountedRef.current || operationRef.current || files.length === 0) return;
    const operation = Symbol("import");
    operationRef.current = operation;
    setImporting(true);
    setError(null);
    const failures: string[] = [];
    let totalBytes = photosRef.current.reduce((sum, photo) => sum + photo.file.size, 0);

    try {
      for (let index = 0; index < files.length; index += 1) {
        if (!isCurrentOperation(operation)) return;
        const file = files[index];
        setProgress({ current: index, total: files.length, label: `Abrindo ${file.name}…` });
        const validationError = validatePhoto(file);
        if (validationError) {
          failures.push(`${file.name}: ${validationError}`);
          continue;
        }
        if (photosRef.current.length >= MAX_PHOTOS) {
          failures.push(`${file.name}: o limite é de 50 fotos por lote. Remova uma foto antes de adicionar outra.`);
          continue;
        }
        if (totalBytes + file.size > MAX_TOTAL_BYTES) {
          failures.push(`${file.name}: as fotos do lote podem somar até 300 MB. Remova algumas fotos ou escolha arquivos menores.`);
          continue;
        }

        try {
          const thumbnail = await createThumbnail(file);
          // A decode may complete after unmount or after a Strict Mode cleanup.
          if (!isCurrentOperation(operation)) {
            URL.revokeObjectURL(thumbnail.url);
            return;
          }
          const photo: PhotoItem = {
            id: `photo-${++nextPhotoIdRef.current}`,
            file,
            name: file.name,
            previewUrl: thumbnail.url,
            width: thumbnail.width,
            height: thumbnail.height,
          };
          photosRef.current = [...photosRef.current, photo];
          totalBytes += file.size;
          setPhotos(photosRef.current);
          invalidateZip();
          if (activeIdRef.current === null) {
            activeIdRef.current = photo.id;
            setActiveId(photo.id);
          }
        } catch (cause) {
          if (!isCurrentOperation(operation)) return;
          failures.push(`${file.name}: ${errorMessage(cause, "Não foi possível abrir esta foto. Tente uma versão menor.")}`);
        }
      }
      if (isCurrentOperation(operation) && failures.length > 0) {
        setError(`Não foi possível adicionar ${failures.length === 1 ? "1 arquivo" : `${failures.length} arquivos`}. ${failures.join("\n")}`);
      }
    } finally {
      if (isCurrentOperation(operation)) {
        operationRef.current = null;
        setImporting(false);
        setProgress(null);
      }
    }
  }, [invalidateZip, isCurrentOperation]);

  const removePhoto = useCallback((id: string) => {
    if (!mountedRef.current || operationRef.current) return;
    const index = photosRef.current.findIndex((photo) => photo.id === id);
    if (index === -1) return;
    URL.revokeObjectURL(photosRef.current[index].previewUrl);
    const next = photosRef.current.filter((photo) => photo.id !== id);
    photosRef.current = next;
    setPhotos(next);
    if (activeIdRef.current === id) {
      const nextActiveId = next[Math.min(index, next.length - 1)]?.id ?? null;
      activeIdRef.current = nextActiveId;
      setActiveId(nextActiveId);
    }
    invalidateZip();
    setError(null);
  }, [invalidateZip]);

  const clearPhotos = useCallback(() => {
    if (!mountedRef.current || operationRef.current) return;
    for (const photo of photosRef.current) URL.revokeObjectURL(photo.previewUrl);
    photosRef.current = [];
    activeIdRef.current = null;
    setPhotos([]);
    setActiveId(null);
    invalidateZip();
    setError(null);
  }, [invalidateZip]);

  const prepareZip = useCallback(async () => {
    if (!mountedRef.current || operationRef.current || photosRef.current.length === 0) return;
    const operation = Symbol("export");
    operationRef.current = operation;
    setProcessing(true);
    setError(null);
    invalidateZip();
    const batch = [...photosRef.current];
    const batchSettings = { ...settingsRef.current };
    const outputs: { name: string; blob: Blob }[] = [];
    const failures: string[] = [];

    try {
      for (let index = 0; index < batch.length; index += 1) {
        if (!isCurrentOperation(operation)) return;
        const photo = batch[index];
        setProgress({ current: index, total: batch.length, label: `Assinando ${photo.name}…` });
        try {
          const result = await processPhoto(photo.file, batchSettings);
          if (!isCurrentOperation(operation)) return;
          outputs.push({
            name: `${String(index + 1).padStart(3, "0")}-${outputFileName(photo.name, batchSettings.format)}`,
            blob: result.blob,
          });
        } catch (cause) {
          if (!isCurrentOperation(operation)) return;
          failures.push(`${photo.name}: ${errorMessage(cause, "Não foi possível assinar esta foto. Tente uma versão menor.")}`);
        }
      }
      if (!isCurrentOperation(operation)) return;
      if (outputs.length === 0) {
        setError(`Nenhuma foto pôde ser exportada. Suas fotos e ajustes continuam aqui. ${failures.join("\n")}`);
        return;
      }

      setProgress({ current: batch.length, total: batch.length, label: "Criando o arquivo ZIP…" });
      const zip = await createPhotoZip(outputs, (percent) => {
        if (isCurrentOperation(operation)) {
          setProgress({
            current: batch.length,
            total: batch.length,
            label: `Criando o arquivo ZIP… ${Math.round(percent)}%`,
          });
        }
      });
      if (!isCurrentOperation(operation)) return;
      preparedZipRef.current = zip;
      setPreparedZip(zip);
      if (failures.length > 0) {
        setError(`ZIP pronto com ${outputs.length} de ${batch.length} fotos. As seguintes fotos ficaram fora do ZIP: ${failures.join("\n")}`);
      }
    } catch (cause) {
      if (isCurrentOperation(operation)) {
        setError(`Não foi possível criar o ZIP. Suas fotos e ajustes continuam aqui. ${errorMessage(cause, "Tente novamente com menos fotos por vez.")}${failures.length ? `\nFotos que não puderam ser processadas: ${failures.join("\n")}` : ""}`);
      }
    } finally {
      // The ZIP owns its bytes; individual exported blobs can now be collected.
      outputs.length = 0;
      if (isCurrentOperation(operation)) {
        operationRef.current = null;
        setProcessing(false);
        setProgress(null);
      }
    }
  }, [invalidateZip, isCurrentOperation]);

  const downloadZip = useCallback(() => {
    if (!mountedRef.current || operationRef.current || !preparedZipRef.current) return;
    try {
      // Keep the download in the click's synchronous call stack for mobile Safari.
      downloadBlob(preparedZipRef.current, "fotos-assinadas.zip");
    } catch (cause) {
      setError(`Não foi possível iniciar o download. O ZIP continua pronto para tentar novamente. ${errorMessage(cause, "Verifique as permissões de download do navegador.")}`);
    }
  }, []);

  const dismissError = useCallback(() => setError(null), []);

  return {
    photos,
    activeId,
    selectPhoto,
    settings,
    updateSettings,
    addFiles,
    removePhoto,
    clearPhotos,
    importing,
    processing,
    progress,
    preparedZip,
    prepareZip,
    downloadZip,
    error,
    dismissError,
  };
}
