import type { Metadata, Viewport } from "next";
import "@fontsource-variable/manrope";
import "./globals.css";

export const metadata: Metadata = {
  title: "Assina | Sua marca em cada foto",
  description: "Enquadre suas fotos para o Instagram, aplique a vinheta AE Carvalho e compartilhe pelo celular ou baixe em ZIP. Edição no seu aparelho.",
  applicationName: "Assina",
};

export const viewport: Viewport = { themeColor: "#f5f6fa" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
