import type { Metadata, Viewport } from "next";
import "./globals.css";
import ServiceWorker from "@/components/ServiceWorker";

export const metadata: Metadata = {
  title: "Ayuda Humanitaria",
  description:
    "Conecta necesidades urgentes de damnificados con quienes pueden cubrirlas.",
  manifest: "/manifest.webmanifest",
  applicationName: "Ayuda Humanitaria",
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
      </body>
    </html>
  );
}
