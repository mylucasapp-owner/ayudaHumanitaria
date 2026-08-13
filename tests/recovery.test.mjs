/**
 * Recuperación de un reporte cuando el dispositivo pierde la identidad.
 *
 * Es el escenario más silencioso de todos: nadie se entera de que perdió el
 * acceso hasta que necesita cerrar su necesidad y no puede. Requiere el
 * emulador de Functions además de Firestore y Auth.
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

import { anonActor, as, cleanup, denied, adminGet } from "./helpers.mjs";
import { createNeed, recoverNeed, fetchContact } from "../lib/needs.ts";

after(cleanup);

const REPORT = {
  category: "refugio",
  description: "Carpa para familia de 5",
  reference: "Vereda alta",
  location: { lat: 3.4372, lng: -76.5225 },
  peopleCount: 5,
  contact: { name: "Rosa", phone: "+573001112233" },
};

test("el vale de recuperación no lo puede leer ningún cliente", async () => {
  const rosa = await anonActor("rosa-vale");
  const { code } = await as(rosa, () => createNeed(rosa.uid, REPORT));

  // Ni siquiera quien lo creó: poder leer esta colección sería poder
  // adueñarse de cualquier reporte.
  assert.ok(await denied(() => getDoc(doc(rosa.db, "recovery", code))));

  const curioso = await anonActor("curioso-vale");
  assert.ok(await denied(() => getDoc(doc(curioso.db, "recovery", code))));
});

test("con el código, otro dispositivo recupera el reporte", async () => {
  const rosa = await anonActor("rosa-pierde");
  const { id, code } = await as(rosa, () => createNeed(rosa.uid, REPORT));

  // Rosa vuelve desde otro teléfono: identidad nueva, sin acceso.
  const rosaNueva = await anonActor("rosa-nueva");
  const antes = await as(rosaNueva, () => fetchContact(id));
  assert.equal(antes.state, "denied", "no debería alcanzar el contacto todavía");

  const recuperado = await as(rosaNueva, () => recoverNeed(code));
  assert.equal(recuperado, id);

  const need = await adminGet(`needs/${id}`);
  assert.equal(need.fields.ownerUid.stringValue, rosaNueva.uid);

  // Y ahora sí puede ver su propio contacto y cerrar su necesidad.
  const despues = await as(rosaNueva, () => fetchContact(id));
  assert.equal(despues.state, "ok");
  assert.equal(despues.contact.phone, REPORT.contact.phone);

  const contacto = await adminGet(`needs/${id}/private/contact`);
  assert.equal(contacto.fields.ownerUid.stringValue, rosaNueva.uid);
});

test("el código admite espacios, guiones y minúsculas", async () => {
  const rosa = await anonActor("rosa-formato");
  const { id, code } = await as(rosa, () => createNeed(rosa.uid, REPORT));

  const otro = await anonActor("otro-formato");
  const escritoAMano = ` ${code.slice(0, 4).toLowerCase()}-${code.slice(4).toLowerCase()} `;
  assert.equal(await as(otro, () => recoverNeed(escritoAMano)), id);
});

test("un código inventado no recupera nada", async () => {
  const nadie = await anonActor("inventor");
  await assert.rejects(() => as(nadie, () => recoverNeed("ZZZZ9999")));
});

test("registrar un vale apuntando al reporte de otro no sirve para robarlo", async () => {
  const rosa = await anonActor("rosa-victima");
  const { id } = await as(rosa, () => createNeed(rosa.uid, REPORT));

  // El atacante crea su propio vale señalando la necesidad de Rosa. Las reglas
  // se lo permiten —solo exigen que `createdBy` sea él mismo— y ahí está la
  // trampa: al canjear, la función comprueba que ese autor sea el real.
  const atacante = await anonActor("atacante-vale");
  const codigoFalso = "ROBOROBO";
  await setDoc(doc(atacante.db, "recovery", codigoFalso), {
    needId: id,
    createdBy: atacante.uid,
    at: serverTimestamp(),
  });

  await assert.rejects(() => as(atacante, () => recoverNeed(codigoFalso)));

  const need = await adminGet(`needs/${id}`);
  assert.equal(
    need.fields.ownerUid.stringValue,
    rosa.uid,
    "el reporte cambió de dueño: la defensa falló",
  );
});

test("los intentos de adivinar el código están limitados", async () => {
  const fuerzaBruta = await anonActor("fuerza-bruta");

  let rechazadoPorLimite = false;
  for (let i = 0; i < 8; i++) {
    try {
      await as(fuerzaBruta, () => recoverNeed(`AAAA${String(i).padStart(4, "2")}`));
    } catch (e) {
      if (/intentos/i.test(String(e?.message))) {
        rechazadoPorLimite = true;
        break;
      }
    }
  }

  assert.ok(
    rechazadoPorLimite,
    "debería cortar por exceso de intentos antes del octavo",
  );
});
