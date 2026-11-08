export type SharingEnvironment = {
  isSecureContext: boolean;
  navigator: {
    canShare?: (data: ShareData) => boolean;
    share?: (data: ShareData) => Promise<void>;
  };
};

function browserEnvironment(): SharingEnvironment {
  return {
    isSecureContext: typeof window !== "undefined" && window.isSecureContext,
    navigator: typeof navigator === "undefined" ? {} : navigator,
  };
}

/** Empty files checks browser support; a prepared batch checks the actual files. */
export function getShareUnavailableReason(
  files: File[] = [],
  environment: SharingEnvironment = browserEnvironment(),
): string | null {
  if (!environment.isSecureContext) {
    return "O compartilhamento precisa de HTTPS. Abra a versão HTTPS no celular ou baixe o ZIP e envie as fotos pelo WhatsApp.";
  }
  if (typeof environment.navigator.share !== "function" || typeof environment.navigator.canShare !== "function") {
    return "Este navegador não oferece compartilhamento de fotos. Baixe o ZIP, extraia as imagens e envie pelo WhatsApp.";
  }
  if (files.length > 0) {
    try {
      if (!environment.navigator.canShare({ files })) {
        return "O aparelho não aceita compartilhar este lote de fotos. Tente menos fotos ou baixe o ZIP e envie as imagens pelo WhatsApp.";
      }
    } catch {
      return "Não foi possível verificar o compartilhamento deste lote. Baixe o ZIP, extraia as imagens e envie pelo WhatsApp.";
    }
  }
  return null;
}

/** Do not make this async: navigator.share must run during the original click. */
export function shareImageFiles(
  files: File[],
  environment: SharingEnvironment = browserEnvironment(),
): Promise<void> {
  if (files.length === 0) throw new Error("Prepare as fotos antes de compartilhar.");
  const unavailableReason = getShareUnavailableReason(files, environment);
  if (unavailableReason) throw new Error(unavailableReason);
  return environment.navigator.share!({ files });
}

export function isShareCancellation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";
}
