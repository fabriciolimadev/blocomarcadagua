"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createPhotoZip,
  createThumbnail,
  DEFAULT_FRAMING,
  DEFAULT_SETTINGS,
  downloadBlob,
  outputFileName,
  processPhoto,
  validatePhoto,
  type PhotoFraming,
  type WatermarkSettings,
} from "@/lib/image-processing";
import { getShareUnavailableReason, isShareCancellation, shareImageFiles } from "@/lib/sharing";

export type PhotoItem = {
  id: string;
  file: File;
  name: string;
  previewUrl: string;
  width: number;
  height: number;
  framing: PhotoFraming;
};

type Progress = { current: number; total: number; label: string };

const MAX_PHOTOS = 50;
const MAX_TOTAL_BYTES = 300 * 1024 * 1024;

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

function clampSetting(value: number | undefined, fallback: number, min: number, max: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
}

export function usePhotoEditor() {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [settings, setSettings] = useState<WatermarkSettings>({ ...DEFAULT_SETTINGS });
  const [importing, setImporting] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [preparedZip, setPreparedZip] = useState<Blob | null>(null);
  const [preparedFiles, setPreparedFiles] = useState<File[]>([]);
  const [shareUnavailableReason, setShareUnavailableReason] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Refs also guard actions that occur before React has rendered a busy state.
  const photosRef = useRef<PhotoItem[]>([]);
  const activeIdRef = useRef<string | null>(null);
  const settingsRef = useRef<WatermarkSettings>({ ...DEFAULT_SETTINGS });
  const preparedZipRef = useRef<Blob | null>(null);
  const preparedFilesRef = useRef<File[]>([]);
  const preparedWarningRef = useRef<string | null>(null);
  const partialExportWarningRef = useRef<string | null>(null);
  const mountedRef = useRef(false);
  const operationRef = useRef<symbol | null>(null);
  const nextPhotoIdRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    // Browser capabilities are only available after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShareUnavailableReason(getShareUnavailableReason());
    return () => {
      mountedRef.current = false;
      operationRef.current = null;
      for (const photo of photosRef.current) URL.revokeObjectURL(photo.previewUrl);
      photosRef.current = [];
      preparedZipRef.current = null;
      preparedFilesRef.current = [];
      preparedWarningRef.current = null;
      partialExportWarningRef.current = null;
    };
  }, []);

  const isCurrentOperation = useCallback((operation: symbol) => (
    mountedRef.current && operationRef.current === operation
  ), []);

  const invalidateOutputs = useCallback(() => {
    preparedZipRef.current = null;
    preparedFilesRef.current = [];
    preparedWarningRef.current = null;
    partialExportWarningRef.current = null;
    setPreparedZip(null);
    setPreparedFiles([]);
    setShareStatus(null);
    setShareUnavailableReason(getShareUnavailableReason());
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
    next.opacity = clampSetting(partial.opacity, previous.opacity, 0, 100);
    if (partial.format === "image/jpeg" || partial.format === "image/png") {
      next.format = partial.format;
    }
    if (next.opacity === previous.opacity && next.format === previous.format) return;
    settingsRef.current = next;
    setSettings(next);
    invalidateOutputs();
    setError(null);
  }, [invalidateOutputs]);

  const updatePhotoFraming = useCallback((id: string, partial: Partial<PhotoFraming>) => {
    if (!mountedRef.current || operationRef.current) return;
    const photo = photosRef.current.find((item) => item.id === id);
    if (!photo) return;
    const framing: PhotoFraming = {
      x: clampSetting(partial.x, photo.framing.x, 0, 100),
      y: clampSetting(partial.y, photo.framing.y, 0, 100),
      zoom: clampSetting(partial.zoom, photo.framing.zoom, 1, 3),
    };
    if (framing.x === photo.framing.x && framing.y === photo.framing.y && framing.zoom === photo.framing.zoom) return;
    photosRef.current = photosRef.current.map((item) => item.id === id ? { ...item, framing } : item);
    setPhotos(photosRef.current);
    invalidateOutputs();
    setError(null);
  }, [invalidateOutputs]);

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
            framing: { ...DEFAULT_FRAMING },
          };
          photosRef.current = [...photosRef.current, photo];
          totalBytes += file.size;
          setPhotos(photosRef.current);
          invalidateOutputs();
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
  }, [invalidateOutputs, isCurrentOperation]);

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
    invalidateOutputs();
    setError(null);
  }, [invalidateOutputs]);

  const clearPhotos = useCallback(() => {
    if (!mountedRef.current || operationRef.current) return;
    for (const photo of photosRef.current) URL.revokeObjectURL(photo.previewUrl);
    photosRef.current = [];
    activeIdRef.current = null;
    setPhotos([]);
    setActiveId(null);
    invalidateOutputs();
    setError(null);
  }, [invalidateOutputs]);

  const prepareZip = useCallback(async () => {
    if (!mountedRef.current || operationRef.current || photosRef.current.length === 0) return;
    const operation = Symbol("export");
    operationRef.current = operation;
    setProcessing(true);
    setError(null);
    invalidateOutputs();
    const batch = photosRef.current.map((photo) => ({ ...photo, framing: { ...photo.framing } }));
    const batchSettings = { ...settingsRef.current };
    const outputs: File[] = [];
    const failures: string[] = [];

    try {
      for (let index = 0; index < batch.length; index += 1) {
        if (!isCurrentOperation(operation)) return;
        const photo = batch[index];
        setProgress({ current: index, total: batch.length, label: `Assinando ${photo.name}…` });
        try {
          const result = await processPhoto(photo.file, batchSettings, photo.framing);
          if (!isCurrentOperation(operation)) return;
          outputs.push(new File(
            [result.blob],
            `${String(index + 1).padStart(3, "0")}-${outputFileName(photo.name, batchSettings.format)}`,
            { type: batchSettings.format },
          ));
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

      // Keep valid images available for sharing even if ZIP generation fails.
      preparedFilesRef.current = [...outputs];
      setPreparedFiles(preparedFilesRef.current);
      setShareUnavailableReason(getShareUnavailableReason(preparedFilesRef.current));
      const partialWarning = failures.length > 0
        ? `${outputs.length} de ${batch.length} fotos prontas. As seguintes fotos ficaram fora do compartilhamento e do ZIP: ${failures.join("\n")}`
        : null;
      preparedWarningRef.current = partialWarning;
      partialExportWarningRef.current = partialWarning;
      setError(partialWarning);

      setProgress({ current: batch.length, total: batch.length, label: "Criando o arquivo ZIP…" });
      const zip = await createPhotoZip(outputs.map((file) => ({ name: file.name, blob: file })), (percent) => {
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
    } catch (cause) {
      if (isCurrentOperation(operation)) {
        const retainedFilesMessage = preparedFilesRef.current.length > 0
          ? `${preparedFilesRef.current.length} fotos estão prontas para compartilhar, se o aparelho permitir.`
          : "Suas fotos e ajustes continuam aqui.";
        const warning = `Não foi possível criar o ZIP. ${retainedFilesMessage} ${errorMessage(cause, "Tente novamente com menos fotos por vez.")}${failures.length ? `\nFotos que não puderam ser processadas: ${failures.join("\n")}` : ""}`;
        preparedWarningRef.current = warning;
        setError(warning);
      }
    } finally {
      // Prepared files retain only the outputs needed for the next share click.
      outputs.length = 0;
      if (isCurrentOperation(operation)) {
        operationRef.current = null;
        setProcessing(false);
        setProgress(null);
      }
    }
  }, [invalidateOutputs, isCurrentOperation]);

  const retryZip = useCallback(async () => {
    if (!mountedRef.current || operationRef.current || preparedZipRef.current || preparedFilesRef.current.length === 0) return;
    const operation = Symbol("retry-zip");
    operationRef.current = operation;
    const files = [...preparedFilesRef.current];
    setProcessing(true);
    setProgress({ current: files.length, total: files.length, label: "Criando o arquivo ZIP novamente…" });
    preparedWarningRef.current = partialExportWarningRef.current;
    setError(partialExportWarningRef.current);

    try {
      const zip = await createPhotoZip(files.map((file) => ({ name: file.name, blob: file })), (percent) => {
        if (isCurrentOperation(operation)) {
          setProgress({
            current: files.length,
            total: files.length,
            label: `Criando o arquivo ZIP novamente… ${Math.round(percent)}%`,
          });
        }
      });
      if (!isCurrentOperation(operation)) return;
      preparedZipRef.current = zip;
      setPreparedZip(zip);
      preparedWarningRef.current = partialExportWarningRef.current;
      setError(partialExportWarningRef.current);
    } catch (cause) {
      if (isCurrentOperation(operation)) {
        const warning = [
          partialExportWarningRef.current,
          `Não foi possível criar o ZIP. As ${files.length} fotos preparadas continuam disponíveis para compartilhar, se o aparelho permitir. ${errorMessage(cause, "Tente novamente com menos fotos por vez.")}`,
        ].filter(Boolean).join("\n");
        preparedWarningRef.current = warning;
        setError(warning);
      }
    } finally {
      if (isCurrentOperation(operation)) {
        operationRef.current = null;
        setProcessing(false);
        setProgress(null);
      }
    }
  }, [isCurrentOperation]);

  const sharePhotos = useCallback(async () => {
    if (!mountedRef.current || operationRef.current || preparedFilesRef.current.length === 0) return;
    const files = preparedFilesRef.current;
    const unavailableReason = getShareUnavailableReason(files);
    setShareUnavailableReason(unavailableReason);
    if (unavailableReason) {
      setError([preparedWarningRef.current, unavailableReason].filter(Boolean).join("\n"));
      return;
    }

    const operation = Symbol("share");
    operationRef.current = operation;
    setSharing(true);
    setShareStatus(null);
    setError(preparedWarningRef.current);
    try {
      // This calls navigator.share synchronously, before the first await.
      const sharePromise = shareImageFiles(files);
      await sharePromise;
      if (isCurrentOperation(operation)) setShareStatus("Menu de compartilhamento aberto.");
    } catch (cause) {
      if (isCurrentOperation(operation) && !isShareCancellation(cause)) {
        const fallback = preparedZipRef.current
          ? "Baixe o ZIP, extraia as imagens e envie pelo WhatsApp."
          : "Tente novamente com menos fotos ou prepare o lote de novo para baixar o ZIP.";
        setError([preparedWarningRef.current, `Não foi possível compartilhar as fotos. Toque novamente no botão para tentar outra vez. ${fallback}`].filter(Boolean).join("\n"));
      }
    } finally {
      if (isCurrentOperation(operation)) {
        operationRef.current = null;
        setSharing(false);
      }
    }
  }, [isCurrentOperation]);

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
    updatePhotoFraming,
    addFiles,
    removePhoto,
    clearPhotos,
    importing,
    processing,
    sharing,
    progress,
    preparedZip,
    preparedFiles,
    prepareZip,
    retryZip,
    downloadZip,
    sharePhotos,
    shareUnavailableReason,
    shareStatus,
    error,
    dismissError,
  };
}
