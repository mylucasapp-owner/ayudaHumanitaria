/**
 * Comportamiento sin señal.
 *
 * Esta es la prueba que más importa para Chocó: si reportar no funciona con la
 * red caída, la app no sirve donde más se necesita. Firestore persiste la
 * escritura localmente, pero su promesa de confirmación no resuelve hasta que
 * el servidor responde — y una pantalla que dice "Enviando…" para siempre hace
 * que la gente reenvíe el mismo reporte una y otra vez.
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { disableNetwork, enableNetwork } from "firebase/firestore";

import { anonActor, as, cleanup, adminGet } from "./helpers.mjs";
import { createNeed, claimNeed, OfflineError } from "../lib/needs.ts";

after(cleanup);

const REPORT = {
  category: "agua",
  description: "Agua potable para 12 personas",
  reference: "Vereda sin señal",
  location: { lat: 5.6947, lng: -76.6611 },
  peopleCount: 12,
  contact: { name: "Ana", phone: "+573000000000" },
};

/** Falla si la promesa no resuelve dentro del plazo. */
function conPlazo(promise, ms, mensaje) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(mensaje)), ms)),
  ]);
}

test("reportar sin señal devuelve el ticket en vez de colgarse", async () => {
  const rosa = await anonActor("rosa-offline");
  await disableNetwork(rosa.db);

  try {
    const resultado = await conPlazo(
      as(rosa, () => createNeed(rosa.uid, REPORT)),
      6000,
      "createNeed se colgó sin señal: el usuario vería 'Enviando…' para siempre",
    );

    assert.ok(resultado.id, "debe entregar un identificador igual");
    assert.equal(resultado.pending, true, "debe avisar que quedó en cola");
  } finally {
    await enableNetwork(rosa.db);
  }
});

test("lo reportado sin señal llega al servidor al reconectar", async () => {
  const rosa = await anonActor("rosa-sync");
  await disableNetwork(rosa.db);

  const { id } = await as(rosa, () => createNeed(rosa.uid, REPORT));
  assert.equal(await adminGet(`needs/${id}`), null, "aún no debería estar en el servidor");

  await enableNetwork(rosa.db);

  // Espera activa corta: la sincronización es casi inmediata al reconectar.
  let guardada = null;
  for (let i = 0; i < 30 && !guardada; i++) {
    guardada = await adminGet(`needs/${id}`);
    if (!guardada) await new Promise((r) => setTimeout(r, 200));
  }

  assert.ok(guardada, "la necesidad encolada nunca llegó al servidor");
  assert.equal(guardada.fields.description.stringValue, REPORT.description);

  const contacto = await adminGet(`needs/${id}/private/contact`);
  assert.ok(contacto, "el contacto debe viajar junto con la necesidad");
});

test("comprometerse sin señal falla rápido y lo dice claro", async () => {
  const rosa = await anonActor("rosa-claim");
  const { id } = await as(rosa, () => createNeed(rosa.uid, REPORT));

  const carlos = await anonActor("carlos-offline");
  await disableNetwork(carlos.db);

  try {
    // Tomar una necesidad exige saber si alguien llegó antes, y eso no se puede
    // resolver sin red. Lo que no puede pasar es que se quede colgado.
    await assert.rejects(
      () =>
        conPlazo(
          as(carlos, () => claimNeed(id, carlos.uid, "Carlos")),
          6000,
          "claimNeed se colgó sin señal",
        ),
      (e) => e instanceof OfflineError,
    );
  } finally {
    await enableNetwork(carlos.db);
  }
});
