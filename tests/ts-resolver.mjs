/**
 * Gancho de resolución, solo para pruebas.
 *
 * El código de la app importa sin extensión (`./firebase`, `@/lib/types`)
 * porque el bundler de Next lo resuelve. Node ESM no. Este gancho completa la
 * extensión y traduce el alias `@/`, de modo que las pruebas puedan ejecutar
 * los módulos reales sin obligar a la app a adoptar un estilo de import
 * distinto solo para poder testearla.
 */
const ROOT = new URL("../", import.meta.url);
const EXTENSIONS = [".ts", ".tsx", ".mjs", ".js"];

export async function resolve(specifier, context, next) {
  let target = specifier;

  if (target.startsWith("@/")) {
    target = new URL(target.slice(2), ROOT).href;
  }

  const isPath = target.startsWith(".") || target.startsWith("file:");
  if (isPath && !/\.[a-z]+$/i.test(target)) {
    const base = target.startsWith("file:")
      ? target
      : new URL(target, context.parentURL).href;
    for (const ext of EXTENSIONS) {
      try {
        return await next(base + ext, context);
      } catch {
        // Prueba la siguiente extensión.
      }
    }
  }

  return next(target, context);
}
