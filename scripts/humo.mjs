#!/usr/bin/env node
/**
 * Prueba de humo: abre cada pantalla en un navegador real y falla si alguna
 * muere.
 *
 * Existe por un incidente concreto. Un useState quedó debajo de un `return`
 * temprano y TODAS las fichas de necesidad murieron en la pantalla de error, en
 * producción, hasta que lo reportó un usuario. Ni los tipos ni las 84 pruebas
 * de reglas lo vieron: ninguna monta una pantalla. ESLint ya atrapa ese caso
 * concreto, pero solo ese; esto atrapa cualquier cosa que reviente al abrir.
 *
 * Usa el Chrome ya instalado en el equipo en vez de bajar otro navegador.
 *
 *   npm run humo              # contra el sitio publicado
 *   BASE=http://localhost:3000 npm run humo
 */
import { chromium } from "playwright-core";
import { existsSync } from "node:fs";

const BASE = process.env.BASE ?? "https://ayuda-humanitaria-89e72.web.app";

const CANDIDATOS = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
];

/**
 * Rutas que debe poder abrir cualquiera. La ficha de necesidad va con un id
 * real tomado del feed: sin id la pantalla no ejerce el camino que fallaba.
 */
const RUTAS = [
  "/",
  "/necesito/",
  "/ayudar/",
  "/donde-ir/",
  "/mis-reportes/",
  "/recuperar/",
  "/como-usar/",
  "/legal/",
  "/validador/",
  "/clave/",
  "/aliados/",
];

const ejecutable = CANDIDATOS.find((p) => existsSync(p));
if (!ejecutable) {
  console.error(
    "No se encontró Chrome ni Chromium en este equipo.\n" +
      "La prueba de humo necesita un navegador real; instala Chrome o define\n" +
      "la ruta en CANDIDATOS.",
  );
  process.exit(1);
}

const navegador = await chromium.launch({ executablePath: ejecutable });
const contexto = await navegador.newContext();
const fallos = [];

/** Busca un id real para ejercer la ficha de detalle, que es la que se rompió. */
async function idDeAlgunaNecesidad(pagina) {
  try {
    await pagina.goto(`${BASE}/ayudar/`, { waitUntil: "domcontentloaded" });
    // El servidor de desarrollo compila bajo demanda y tarda bastante más que
    // el sitio publicado; se espera al enlace, no a un tiempo fijo.
    await pagina.waitForSelector('a[href*="/necesidad/?id="]', {
      timeout: 40000,
    });
    const href = await pagina
      .locator('a[href*="/necesidad/?id="]')
      .first()
      .getAttribute("href");
    return href?.match(/id=([^&]+)/)?.[1] ?? null;
  } catch {
    return null;
  }
}

async function revisar(ruta) {
  const pagina = await contexto.newPage();
  const errores = [];
  pagina.on("pageerror", (e) => errores.push(String(e.message).slice(0, 160)));

  try {
    // No se espera a "networkidle": Firestore mantiene abierta su conexión a
    // propósito —es lo que da el tiempo real— y ese estado no llega nunca.
    const respuesta = await pagina.goto(`${BASE}${ruta}`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    if (!respuesta || respuesta.status() >= 400) {
      fallos.push(`${ruta}: HTTP ${respuesta?.status() ?? "sin respuesta"}`);
      return;
    }

    // Margen para que React monte y, si va a caerse, se caiga.
    await pagina.waitForTimeout(4000);

    // La pantalla de error de React es el sintoma que importa: la app no murio
    // del todo, pero para la persona esa pantalla es la app rota.
    const texto = await pagina.locator("body").innerText();
    if (/Algo falló/i.test(texto)) {
      fallos.push(`${ruta}: cayó en la pantalla de error`);
    } else if (errores.length > 0) {
      fallos.push(`${ruta}: excepción sin capturar — ${errores[0]}`);
    } else {
      console.log(`  ok  ${ruta}`);
    }
  } catch (e) {
    fallos.push(`${ruta}: no cargó — ${String(e.message).slice(0, 120)}`);
  } finally {
    await pagina.close();
  }
}

console.log(`Prueba de humo contra ${BASE}\n`);
for (const ruta of RUTAS) await revisar(ruta);

const sonda = await contexto.newPage();
const id = await idDeAlgunaNecesidad(sonda);
await sonda.close();
if (id) {
  await revisar(`/necesidad/?id=${id}`);
} else {
  // Saltársela en silencio seria lo peor posible: la ficha de necesidad es
  // justo la pantalla que se rompio, y un verde que en realidad no la probo
  // deja pasar el fallo con la conciencia tranquila.
  fallos.push(
    "/necesidad/: no se pudo probar — no se halló ninguna necesidad en el feed",
  );
}

// Las teselas se autentican por dominio. Al estrenar uno nuevo es el fallo mas
// facil de pasar por alto: la app funciona, nada peta, y el mapa queda gris.
//
// Se pide con <img crossOrigin> y no con fetch, porque asi es como las pide
// Leaflet: con fetch el navegador manda otra cabecera Referer y el proveedor
// responde 401 hasta en el dominio que si funciona. La prueba tiene que hacer
// exactamente lo que hace la app, o mide otra cosa.
//
// Responde a "¿vera mapa quien entre por aqui?", que es lo unico que importa.
// No sirve como prueba de la configuracion de Stadia: su politica no es una
// lista blanca estricta —dominios ajenos reciben 200— asi que un verde aqui no
// dice que el dominio este bien dado de alta, solo que hoy sirve teselas.
{
  const pagina = await contexto.newPage();
  try {
    await pagina.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    const ok = await pagina.evaluate(
      () =>
        new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => resolve(img.naturalWidth > 0);
          img.onerror = () => resolve(false);
          img.src =
            "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/12/1150/2050.png?humo=" +
            Date.now();
          setTimeout(() => resolve(false), 15000);
        }),
    );
    if (ok) console.log("  ok  teselas del mapa");
    else
      fallos.push(
        `teselas del mapa: no cargan desde ${BASE} — el mapa se vera gris. ` +
          "Falta autorizar este dominio en Stadia Maps.",
      );
  } catch (e) {
    fallos.push(
      `teselas del mapa: no se pudieron probar — ${String(e.message).slice(0, 80)}`,
    );
  } finally {
    await pagina.close();
  }
}

await navegador.close();

if (fallos.length > 0) {
  console.error(`\n${fallos.length} pantalla(s) rota(s):`);
  for (const f of fallos) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log("\nTodas las pantallas abren.");
