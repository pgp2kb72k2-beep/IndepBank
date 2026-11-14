import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "IndepBank", template: "%s · IndepBank" },
  description: "Sabé cuánto de tu dinero podés usar de verdad.",
};

export const viewport: Viewport = {
  themeColor: "#020318",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-UY" className={`dark ${GeistSans.variable} ${GeistMono.variable} h-full`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
