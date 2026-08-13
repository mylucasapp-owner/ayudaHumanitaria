import { ImageResponse } from "next/og";

/**
 * Imagen de previsualización para enlaces compartidos.
 *
 * Existe por alcance, no por estética: en WhatsApp —que es como esto se va a
 * difundir— un enlace sin previsualización se ve como texto pelado y mucha
 * gente no lo abre por miedo a una estafa. Con tarjeta, se ve como lo que es.
 *
 * Se genera al compilar, así que no añade nada al peso que descarga el usuario.
 */
// La app se exporta como sitio estático: sin esto Next intenta generar la
// imagen por petición, que en un export no existe.
export const dynamic = "force-static";

export const alt =
  "Ayuda Humanitaria — necesidades reales, ubicadas y verificadas";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#000",
          color: "#fff",
          padding: 72,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div
            style={{
              width: 64,
              height: 64,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "4px solid #fff",
              fontSize: 44,
              fontWeight: 700,
            }}
          >
            +
          </div>
          <div
            style={{
              fontSize: 30,
              letterSpacing: 6,
              textTransform: "uppercase",
              color: "#9a9a9a",
            }}
          >
            Ayuda Humanitaria
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", fontSize: 82, fontWeight: 800 }}>
            Necesidades reales,
          </div>
          <div style={{ display: "flex", fontSize: 82, fontWeight: 800 }}>
            ubicadas y verificadas.
          </div>
          <div
            style={{ display: "flex", fontSize: 38, color: "#ffb000", marginTop: 16 }}
          >
            Sin registro. Funciona sin conexión.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 26,
            color: "#9a9a9a",
            borderTop: "2px solid #333",
            paddingTop: 24,
          }}
        >
          <span>Zonas afectadas de Colombia</span>
          <span>El Errante Coding Labs</span>
        </div>
      </div>
    ),
    size,
  );
}
