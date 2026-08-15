import parser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";

/**
 * Configuración deliberadamente mínima.
 *
 * No está aquí para imponer estilo —de eso ya se ocupa quien escribe— sino para
 * atrapar la clase de fallo que no se ve leyendo y sí tumba la app entera.
 *
 * `rules-of-hooks` existe por un incidente real: un useState quedó debajo de un
 * `return` temprano y todas las fichas de necesidad murieron en la pantalla de
 * error, en producción, durante horas. Ningún tipo ni ninguna prueba de las que
 * había lo habría visto; esta regla lo ve sin ejecutar nada.
 */
export default [
  {
    files: ["**/*.ts", "**/*.tsx"],
    ignores: [".next/**", "out/**", "node_modules/**"],
    languageOptions: {
      parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      // Error, no aviso: es exactamente el fallo que ya nos costó una caída.
      "react-hooks/rules-of-hooks": "error",
      // Aviso: las dependencias mal puestas causan datos rancios, no caídas.
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];
