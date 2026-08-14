import type { Metadata, Viewport } from "next";
import "./globals.css";
import Diagnostics from "@/components/Diagnostics";
import ServiceWorker from "@/components/ServiceWorker";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: "Ayuda Humanitaria",
  description:
    "Conecta necesidades urgentes de damnificados con quienes pueden cubrirlas.",
  manifest: "/manifest.webmanifest",
  applicationName: "Ayuda Humanitaria",
  authors: [{ name: SITE.authorFull }],
  creator: SITE.authorFull,
  publisher: SITE.org,
  openGraph: {
    title: "Ayuda Humanitaria",
    description:
      "Necesidades reales, ubicadas y verificadas. Sin registro. Funciona sin conexión.",
    url: SITE.url,
    siteName: "Ayuda Humanitaria",
    locale: "es_CO",
    type: "website",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Ayuda",
  },
  formatDetection: { telephone: true },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <a className="skip-link" href="#main">
          Saltar al contenido
        </a>
        {children}
        <ServiceWorker />
        <Diagnostics />
      </body>
    </html>
  );
}
