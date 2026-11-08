import type { Metadata, Viewport } from "next";
import "@fontsource-variable/manrope";
import "./globals.css";

export const metadata: Metadata = {
  title: "Assina | Sua marca em cada foto",
  description: "Adicione a assinatura AE Carvalho às suas fotos, ajuste a marca d’água e baixe tudo em ZIP. Simples, privado e direto no seu aparelho.",
  applicationName: "Assina",
};

export const viewport: Viewport = { themeColor: "#f5f6fa" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
