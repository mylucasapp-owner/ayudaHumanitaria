"use client";

/**
 * Red de seguridad de último recurso: cubre fallos en el propio layout, donde
 * `error.tsx` ya no alcanza. Por eso trae su propio <html> y estilos en línea,
 * sin depender de nada que pueda ser justamente lo que falló.
 */
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="es">
      <body
        style={{
          background: "#000",
          color: "#fff",
          fontFamily: "system-ui, sans-serif",
          padding: 24,
          margin: 0,
        }}
      >
        <h1 style={{ fontSize: 28, marginBottom: 12 }}>Algo falló</h1>
        <p style={{ color: "#9a9a9a", lineHeight: 1.5 }}>
          La aplicación no pudo cargar. Tus reportes no se perdieron.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: 20,
            width: "100%",
            padding: "18px 20px",
            background: "#fff",
            color: "#000",
            border: 0,
            fontSize: 17,
            fontWeight: 700,
          }}
        >
          Reintentar
        </button>
        <p style={{ marginTop: 28, color: "#9a9a9a" }}>
          Si necesitas ayuda urgente, llama al{" "}
          <a href="tel:123" style={{ color: "#ffb000" }}>
            123
          </a>
          .
        </p>
      </body>
    </html>
  );
}
