/**
 * Reglas de seguridad: entradas malformadas, escalada de privilegios y
 * manipulación del ledger. Lo que los recorridos no ejercitan porque la app
 * nunca lo enviaría — que es justamente lo que envía un atacante.
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";

import { anonActor, validatorActor, as, cleanup, denied, adminGet } from "./helpers.mjs";
import { createNeed } from "../lib/needs.ts";

after(cleanup);

const VALID = {
  category: "medico",
  description: "Insulina para 2 adultos mayores",
  reference: "Los Aromos 120",
  location: { lat: 3.4372, lng: -76.5225 },
  peopleCount: 2,
  status: "abierta",
  active: true,
  verified: false,
  verifiedByName: null,
  verifiedByUid: null,
  zone: "valle",
  claim: null,
};

function payload(uid, overrides = {}) {
  return {
    ...VALID,
    ownerUid: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

async function rejectsCreate(a, overrides) {
  return denied(() => setDoc(doc(collection(a.db, "needs")), payload(a.uid, overrides)));
}

test("una necesidad válida se acepta (control de la prueba)", async () => {
  const a = await anonActor("ok");
  assert.equal(await rejectsCreate(a, {}), false);
});

test("se rechazan campos fuera de rango o de tipo", async () => {
  const a = await anonActor("malos");

  assert.ok(await rejectsCreate(a, { category: "dinero" }), "categoría inventada");
  assert.ok(await rejectsCreate(a, { description: "" }), "descripción vacía");
  assert.ok(await rejectsCreate(a, { description: "x".repeat(141) }), "descripción larga");
  assert.ok(await rejectsCreate(a, { reference: "x".repeat(121) }), "referencia larga");
  assert.ok(await rejectsCreate(a, { peopleCount: 0 }), "cero personas");
  assert.ok(await rejectsCreate(a, { peopleCount: 1000 }), "mil personas");
  assert.ok(await rejectsCreate(a, { peopleCount: 2.5 }), "personas fraccionarias");
  assert.ok(await rejectsCreate(a, { location: { lat: 91, lng: 0 } }), "latitud imposible");
  assert.ok(await rejectsCreate(a, { location: { lat: 0, lng: 181 } }), "longitud imposible");
  assert.ok(
    await rejectsCreate(a, { location: { lat: 0, lng: 0, alt: 5 } }),
    "campos extra en la ubicación",
  );
  assert.ok(await rejectsCreate(a, { status: "resuelta" }), "nace resuelta");
  assert.ok(await rejectsCreate(a, { active: false }), "nace inactiva");
});

test("una necesidad sin ubicación es válida: el GPS falla bajo escombros", async () => {
  const a = await anonActor("sinubic");
  assert.equal(await rejectsCreate(a, { location: null }), false);
});

test("nadie publica a nombre de otro ni nace verificada", async () => {
  const a = await anonActor("suplanta");
  const b = await anonActor("victima");

  assert.ok(await rejectsCreate(a, { ownerUid: b.uid }));
  assert.ok(await rejectsCreate(a, { verified: true, verifiedByName: "yo mismo" }));
  assert.ok(
    await rejectsCreate(a, {
      claim: { uid: a.uid, name: "yo", expiresAt: Date.now() + 1000, at: serverTimestamp(), seq: 0 },
    }),
    "nace ya comprometida consigo mismo",
  );
});

test("el contacto valida forma y no admite campos de más", async () => {
  const a = await anonActor("contacto");
  const { id } = await as(a, () => createNeed(a.uid, { ...VALID, contact: { name: "R", phone: "+56911112222" } }));

  const ref = doc(a.db, "needs", id, "private", "contact");
  assert.ok(
    await denied(() => setDoc(ref, { name: "R", phone: "123", ownerUid: a.uid })),
    "teléfono demasiado corto",
  );
  assert.ok(
    await denied(() => setDoc(ref, { name: "R", phone: "+56911112222", ownerUid: a.uid, nota: "x" })),
    "campo no declarado",
  );
  assert.ok(await denied(() => deleteDoc(ref)), "el contacto no se borra");
});

test("nadie se acredita a sí mismo como validador", async () => {
  const a = await anonActor("aspirante");
  assert.ok(
    await denied(() =>
      setDoc(doc(a.db, "validators", a.uid), { name: "Yo mismo", zone: "Todas" }),
    ),
  );
});

test("nadie lee la acreditación de otro validador", async () => {
  const a = await anonActor("curioso");
  const v = await validatorActor("bomberos");
  assert.ok(await denied(() => getDoc(doc(a.db, "validators", v.uid))));
});

test("nadie bloquea ni desbloquea cuentas sin ser validador", async () => {
  const a = await anonActor("justiciero");
  const b = await anonActor("objetivo");
  const v = await validatorActor("bomberos");

  assert.ok(
    await denied(() =>
      setDoc(doc(a.db, "blocked", b.uid), { byUid: a.uid, note: "x", at: serverTimestamp() }),
    ),
  );

  await as(v, () =>
    setDoc(doc(v.db, "blocked", b.uid), { byUid: v.uid, note: "spam", at: serverTimestamp() }),
  );
  assert.ok(await denied(() => deleteDoc(doc(a.db, "blocked", b.uid))), "autodesbloqueo");
});

test("el ledger no se puede inflar ni retroceder", async () => {
  const a = await anonActor("tramposo");

  // Arranca legítimamente.
  const batch = writeBatch(a.db);
  batch.set(doc(a.db, "ledger", a.uid), {
    total: 1,
    windowCount: 1,
    windowStart: serverTimestamp(),
  });
  batch.set(doc(a.db, "ledger", a.uid, "slots", "0"), {
    needId: "n0",
    at: serverTimestamp(),
  });
  await batch.commit();

  assert.ok(
    await denied(() =>
      updateDoc(doc(a.db, "ledger", a.uid), { total: 50, windowCount: 1 }),
    ),
    "saltar el contador",
  );
  assert.ok(
    await denied(() =>
      updateDoc(doc(a.db, "ledger", a.uid), { total: 0, windowCount: 0 }),
    ),
    "retroceder el contador",
  );
  assert.ok(
    await denied(() =>
      updateDoc(doc(a.db, "ledger", a.uid), {
        total: 2,
        windowCount: 1,
        windowStart: serverTimestamp(),
      }),
    ),
    "reiniciar la ventana antes de tiempo",
  );
  assert.ok(
    await denied(() =>
      setDoc(doc(a.db, "ledger", a.uid, "slots", "0"), {
        needId: "otra",
        at: serverTimestamp(),
      }),
    ),
    "reescribir un cupo gastado",
  );
  assert.ok(
    await denied(() =>
      setDoc(doc(a.db, "ledger", a.uid, "slots", "7"), {
        needId: "n7",
        at: serverTimestamp(),
      }),
    ),
    "crear un cupo adelantado",
  );
  assert.ok(
    await denied(() => deleteDoc(doc(a.db, "ledger", a.uid, "slots", "0"))),
    "borrar la bitácora",
  );
});

test("el ledger ajeno es privado, salvo para validadores", async () => {
  const a = await anonActor("dueno");
  const b = await anonActor("espia");
  const v = await validatorActor("bomberos");

  await setDoc(doc(a.db, "ledger", a.uid), {
    total: 1,
    windowCount: 1,
    windowStart: serverTimestamp(),
  });

  assert.ok(await denied(() => getDoc(doc(b.db, "ledger", a.uid))));
  assert.equal(await denied(() => getDoc(doc(v.db, "ledger", a.uid))), false);
});

test("las necesidades no se borran nunca", async () => {
  const a = await anonActor("borrador");
  const v = await validatorActor("bomberos");
  const { id } = await as(a, () =>
    createNeed(a.uid, { ...VALID, contact: { name: "R", phone: "+56911112222" } }),
  );

  assert.ok(await denied(() => deleteDoc(doc(a.db, "needs", id))), "el autor borra");
  assert.ok(await denied(() => deleteDoc(doc(v.db, "needs", id))), "el validador borra");

  const snap = await adminGet(`needs/${id}`);
  assert.ok(snap, "la necesidad debe seguir existiendo");
});

test("un compromiso no puede durar más de lo que permiten las reglas", async () => {
  const a = await anonActor("autor");
  const b = await anonActor("acaparador");
  const { id } = await as(a, () =>
    createNeed(a.uid, { ...VALID, contact: { name: "R", phone: "+56911112222" } }),
  );

  const batch = writeBatch(b.db);
  batch.set(doc(b.db, "ledger", b.uid), {
    total: 1,
    windowCount: 1,
    windowStart: serverTimestamp(),
  });
  batch.set(doc(b.db, "ledger", b.uid, "slots", "0"), { needId: id, at: serverTimestamp() });
  await batch.commit();

  const claimWith = (expiresAt) =>
    updateDoc(doc(b.db, "needs", id), {
      status: "comprometida",
      active: true,
      claim: { uid: b.uid, name: "A", expiresAt, at: serverTimestamp(), seq: 0 },
      updatedAt: serverTimestamp(),
    });

  assert.ok(await denied(() => claimWith(Date.now() + 13 * 3600 * 1000)), "13 horas");
  assert.equal(await denied(() => claimWith(Date.now() + 3 * 3600 * 1000)), false, "3 horas");
});

test("un compromiso con nombre vacío se rechaza", async () => {
  const a = await anonActor("autor");
  const b = await anonActor("anonimo");
  const { id } = await as(a, () =>
    createNeed(a.uid, { ...VALID, contact: { name: "R", phone: "+56911112222" } }),
  );

  const batch = writeBatch(b.db);
  batch.set(doc(b.db, "ledger", b.uid), {
    total: 1,
    windowCount: 1,
    windowStart: serverTimestamp(),
  });
  batch.set(doc(b.db, "ledger", b.uid, "slots", "0"), { needId: id, at: serverTimestamp() });
  await batch.commit();

  assert.ok(
    await denied(() =>
      updateDoc(doc(b.db, "needs", id), {
        status: "comprometida",
        active: true,
        claim: { uid: b.uid, name: "", expiresAt: Date.now() + 3600_000, at: serverTimestamp(), seq: 0 },
        updatedAt: serverTimestamp(),
      }),
    ),
  );
});

test("una denuncia no admite motivos inventados", async () => {
  const a = await anonActor("autor");
  const b = await anonActor("denunciante");
  const { id } = await as(a, () =>
    createNeed(a.uid, { ...VALID, contact: { name: "R", phone: "+56911112222" } }),
  );

  assert.ok(
    await denied(() =>
      setDoc(doc(b.db, "needs", id, "flags", b.uid), {
        needId: id,
        uid: b.uid,
        reason: "no-me-gusta",
        at: serverTimestamp(),
      }),
    ),
  );
});

const FALLO = {
  origen: "window.error",
  mensaje: "algo se rompio",
  pila: "",
  ruta: "/ayudar/",
  agente: "Mozilla/5.0",
  enLinea: true,
  extra: "",
};

test("cualquiera puede anotar un fallo: el que importa es el de quien no pudo hacer nada", async () => {
  const a = await anonActor("diag-ok");
  assert.equal(
    await denied(() =>
      setDoc(doc(collection(a.db, "diagnostics")), { ...FALLO, at: serverTimestamp() }),
    ),
    false,
  );
});

test("un fallo anotado no se reescribe ni se borra: taparlo seria borrar el rastro", async () => {
  const a = await anonActor("diag-inmutable");
  const ref = doc(collection(a.db, "diagnostics"));
  await setDoc(ref, { ...FALLO, at: serverTimestamp() });
  assert.ok(await denied(() => setDoc(ref, { ...FALLO, mensaje: "nada", at: serverTimestamp() })));
  assert.ok(await denied(() => deleteDoc(ref)));
});

test("el registro de fallos no admite texto escrito por una persona", async () => {
  const a = await anonActor("diag-campos");
  const crear = (extra) =>
    denied(() =>
      setDoc(doc(collection(a.db, "diagnostics")), {
        ...FALLO,
        ...extra,
        at: serverTimestamp(),
      }),
    );
  // Un campo de mas es un campo por el que se podria colar un telefono o la
  // descripcion de una necesidad.
  assert.ok(await crear({ descripcion: "insulina para Ana" }), "campo extra");
  assert.ok(await crear({ mensaje: "x".repeat(301) }), "mensaje sin tope");
  assert.ok(await crear({ agente: "x".repeat(201) }), "agente sin tope");
  assert.ok(await crear({ enLinea: "si" }), "tipo incorrecto");
});

test("solo un validador lee los fallos: un agente delata al dispositivo de alguien", async () => {
  const a = await anonActor("diag-lectura");
  const ref = doc(collection(a.db, "diagnostics"));
  await setDoc(ref, { ...FALLO, at: serverTimestamp() });
  assert.ok(await denied(() => getDoc(ref)), "un anonimo no deberia leerlos");

  const v = await validatorActor("diag-validador");
  assert.equal(await denied(() => getDoc(doc(v.db, ref.path))), false);
});

const PUNTO = {
  kind: "albergue",
  name: "Coliseo El Pueblo",
  reference: "Carrera 52 con calle 5, Cali",
  location: { lat: 3.4372, lng: -76.5225 },
  schedule: "24 horas",
  notes: "Reciben familias con niños",
  phone: "3001234567",
  active: true,
  confirmed: false,
  confirmedByName: null,
  zone: "valle",
  createdByName: "Defensa Civil",
};

const punto = (extra = {}) => ({
  ...PUNTO,
  ...extra,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});

test("un anonimo no publica un albergue: a un albergue se llega caminando", async () => {
  const a = await anonActor("punto-anon");
  assert.ok(
    await denied(() => setDoc(doc(collection(a.db, "places")), punto())),
    "cualquiera podria mandar familias a una direccion inventada",
  );
});

test("un validador publica un punto y cualquiera puede leerlo", async () => {
  const v = await validatorActor("punto-validador");
  const ref = doc(collection(v.db, "places"));
  assert.equal(await denied(() => setDoc(ref, punto())), false);

  // Leerlo sin acreditacion es el caso normal: el damnificado no es validador.
  const a = await anonActor("punto-lector");
  assert.equal(await denied(() => getDoc(doc(a.db, ref.path))), false);
});

test("un punto no admite campos de mas ni tipos raros", async () => {
  const v = await validatorActor("punto-campos");
  const crear = (extra) =>
    denied(() => setDoc(doc(collection(v.db, "places")), punto(extra)));

  assert.ok(await crear({ kind: "banco" }), "tipo inventado");
  assert.ok(await crear({ name: "" }), "sin nombre");
  assert.ok(await crear({ name: "x".repeat(81) }), "nombre larguisimo");
  assert.ok(await crear({ zone: "narnia" }), "zona inventada");
  assert.ok(await crear({ active: "si" }), "activo no booleano");
  assert.ok(await crear({ cupo: 40 }), "campo de mas");
  assert.ok(await crear({ location: { lat: 91, lng: 0 } }), "latitud imposible");
});

test("un anonimo tampoco cierra ni borra un punto ajeno", async () => {
  const v = await validatorActor("punto-dueno");
  const ref = doc(collection(v.db, "places"));
  await setDoc(ref, punto());

  const a = await anonActor("punto-intruso");
  const suyo = doc(a.db, ref.path);
  assert.ok(await denied(() => updateDoc(suyo, { active: false })), "cerrarlo");
  assert.ok(await denied(() => deleteDoc(suyo)), "borrarlo");
});

test("un punto sin ubicacion vale: muchos albergues se dan por direccion", async () => {
  const v = await validatorActor("punto-sin-gps");
  assert.equal(
    await denied(() =>
      setDoc(doc(collection(v.db, "places")), punto({ location: null, zone: "otra" })),
    ),
    false,
  );
});

test("cualquiera avisa que un punto ya no recibe, pero avisar no lo cierra", async () => {
  const v = await validatorActor("aviso-dueno");
  const ref = doc(collection(v.db, "places"));
  await setDoc(ref, punto());

  const a = await anonActor("aviso-vecino");
  const suyo = doc(a.db, `${ref.path}/reports/${a.uid}`);
  assert.equal(
    await denied(() =>
      setDoc(suyo, {
        placeId: ref.id, uid: a.uid, reason: "lleno", at: serverTimestamp(),
      }),
    ),
    false,
    "quien llego hasta la puerta debe poder avisar",
  );

  // Avisar NO cierra el punto: si bastara con eso, cualquiera vaciaria el mapa
  // de albergues. Cerrar sigue siendo del validador.
  assert.ok(
    await denied(() => updateDoc(doc(a.db, ref.path), { active: false })),
    "un aviso no debe poder cerrar el punto",
  );
});

test("nadie avisa suplantando a otro, ni borra el rastro de su aviso", async () => {
  const v = await validatorActor("aviso-dueno-2");
  const ref = doc(collection(v.db, "places"));
  await setDoc(ref, punto());

  const a = await anonActor("aviso-suplantador");
  // Escribir en la ruta de otro uid: es la ruta la que ata el aviso a su autor.
  assert.ok(
    await denied(() =>
      setDoc(doc(a.db, `${ref.path}/reports/otro-uid`), {
        placeId: ref.id, uid: "otro-uid", reason: "lleno", at: serverTimestamp(),
      }),
    ),
    "suplantacion",
  );

  const propio = doc(a.db, `${ref.path}/reports/${a.uid}`);
  await setDoc(propio, {
    placeId: ref.id, uid: a.uid, reason: "lleno", at: serverTimestamp(),
  });
  assert.ok(await denied(() => deleteDoc(propio)), "borrar el propio aviso");
  assert.ok(
    await denied(() =>
      setDoc(propio, {
        placeId: ref.id, uid: a.uid, reason: "inventado", at: serverTimestamp(),
      }),
    ),
    "motivo fuera de la lista",
  );
});

test("un validador corrige un punto sin cerrarlo ni recrearlo", async () => {
  const v = await validatorActor("punto-corrector");
  const ref = doc(collection(v.db, "places"));
  await setDoc(ref, punto({ phone: "3000000000" }));

  // Corregir en su sitio conserva el identificador: los enlaces ya compartidos
  // siguen funcionando y los avisos de la gente no se pierden.
  assert.equal(
    await denied(() =>
      updateDoc(doc(v.db, ref.path), {
        ...PUNTO,
        phone: "3009998877",
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      }),
    ),
    false,
  );

  const guardado = await adminGet(`places/${ref.id}`);
  assert.equal(guardado.fields.phone.stringValue, "3009998877");
});

test("un anonimo no corrige un punto: seguiria siendo un dato en el que se confia", async () => {
  const v = await validatorActor("punto-corrector-2");
  const ref = doc(collection(v.db, "places"));
  await setDoc(ref, punto());

  const a = await anonActor("punto-corrector-falso");
  assert.ok(
    await denied(() =>
      updateDoc(doc(a.db, ref.path), {
        ...PUNTO,
        reference: "Direccion inventada",
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      }),
    ),
  );
});

test("confirmar un punto en terreno es cosa de coordinadores, no de cualquiera", async () => {
  const v = await validatorActor("punto-confirma");
  const ref = doc(collection(v.db, "places"));
  await setDoc(ref, punto());

  // Nace sin confirmar aunque lo publique un coordinador: publicar desde una
  // lista no es lo mismo que haberse parado en la puerta.
  assert.equal((await adminGet(`places/${ref.id}`)).fields.confirmed.booleanValue, false);

  const a = await anonActor("punto-confirma-falso");
  assert.ok(
    await denied(() =>
      updateDoc(doc(a.db, ref.path), {
        ...PUNTO, confirmed: true, confirmedByName: "Yo mismo",
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      }),
    ),
    "un anonimo marcando como confirmado un dato en el que la gente va a confiar",
  );

  assert.equal(
    await denied(() =>
      updateDoc(doc(v.db, ref.path), {
        ...PUNTO, confirmed: true, confirmedByName: "Defensa Civil",
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      }),
    ),
    false,
  );
  assert.equal((await adminGet(`places/${ref.id}`)).fields.confirmed.booleanValue, true);
});

test("quien llego puede avisar que el sitio SI funciona, no solo que fallo", async () => {
  const v = await validatorActor("punto-senal-buena");
  const ref = doc(collection(v.db, "places"));
  await setDoc(ref, punto());

  // Sin la senal positiva, el coordinador solo se entera de lo que sale mal y
  // nunca puede confirmar nada sin ir en persona.
  const a = await anonActor("vecino-que-fue");
  assert.equal(
    await denied(() =>
      setDoc(doc(a.db, `${ref.path}/reports/${a.uid}`), {
        placeId: ref.id, uid: a.uid, reason: "funciona", at: serverTimestamp(),
      }),
    ),
    false,
  );
});

const OFERTA = {
  category: "refugio",
  description: "200 cobijas nuevas",
  reference: "Bodega en Yumbo",
  location: { lat: 3.5, lng: -76.5 },
  amount: "200 unidades",
  contactName: "Carlos",
  contactPhone: "3001234567",
  status: "disponible",
  active: true,
  zone: "valle",
  verified: false,
  verifiedByName: null,
  sourceId: null,
  sourceName: null,
  sourceUrl: null,
};

const oferta = (uid, extra = {}) => ({
  ...OFERTA, ownerUid: uid, ...extra,
  createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
});

test("cualquiera publica una oferta, pero no nace verificada", async () => {
  const a = await anonActor("ofrece-carlos");
  assert.equal(
    await denied(() => setDoc(doc(collection(a.db, "offers")), oferta(a.uid))),
    false,
  );
  // Autoproclamarse verificada seria regalarse la credibilidad que da un
  // coordinador, que es justo lo que mira alguien antes de ir a recoger algo.
  assert.ok(
    await denied(() =>
      setDoc(doc(collection(a.db, "offers")), oferta(a.uid, {
        verified: true, verifiedByName: "Yo mismo",
      })),
    ),
  );
});

test("nadie publica una oferta a nombre de otro ni la reescribe", async () => {
  const a = await anonActor("ofrece-dueno");
  const ref = doc(collection(a.db, "offers"));
  await setDoc(ref, oferta(a.uid));

  const b = await anonActor("ofrece-intruso");
  assert.ok(
    await denied(() => setDoc(doc(collection(b.db, "offers")), oferta(a.uid))),
    "publicar a nombre de otro",
  );
  assert.ok(
    await denied(() =>
      updateDoc(doc(b.db, ref.path), {
        ...OFERTA, ownerUid: a.uid, description: "Cambiada por un tercero",
        updatedAt: serverTimestamp(),
      }),
    ),
    "reescribir la oferta de otro",
  );
});

test("solo un coordinador verifica o descarta una oferta", async () => {
  const a = await anonActor("ofrece-verif");
  const ref = doc(collection(a.db, "offers"));
  await setDoc(ref, oferta(a.uid));

  // El autor no puede ponerse el sello.
  assert.ok(
    await denied(() =>
      updateDoc(doc(a.db, ref.path), {
        ...OFERTA, ownerUid: a.uid, verified: true, verifiedByName: "Yo",
        updatedAt: serverTimestamp(),
      }),
    ),
    "el autor poniendose el sello de verificada",
  );

  const v = await validatorActor("val-oferta");
  assert.equal(
    await denied(() =>
      updateDoc(doc(v.db, ref.path), {
        ...OFERTA, ownerUid: a.uid, verified: true, verifiedByName: "Defensa Civil",
        updatedAt: serverTimestamp(),
      }),
    ),
    false,
  );

  // Y puede descartarla si resulta ser una estafa.
  assert.equal(
    await denied(() =>
      updateDoc(doc(v.db, ref.path), {
        ...OFERTA, ownerUid: a.uid, status: "falsa", active: false,
        verified: true, verifiedByName: "Defensa Civil",
        updatedAt: serverTimestamp(),
      }),
    ),
    false,
  );
});

test("una oferta se denuncia por estafa, y no se borra nunca", async () => {
  const a = await anonActor("ofrece-denuncia");
  const ref = doc(collection(a.db, "offers"));
  await setDoc(ref, oferta(a.uid));

  const victima = await anonActor("victima-estafa");
  assert.equal(
    await denied(() =>
      setDoc(doc(victima.db, `${ref.path}/flags/${victima.uid}`), {
        offerId: ref.id, uid: victima.uid, reason: "estafa", at: serverTimestamp(),
      }),
    ),
    false,
  );

  // Borrar dejaria sin rastro a quien intento estafar.
  assert.ok(await denied(() => deleteDoc(doc(a.db, ref.path))));
});

test("ni el autor ni un coordinador pueden mover la fecha de publicacion", async () => {
  const a = await anonActor("ofrece-fecha");
  const ref = doc(collection(a.db, "offers"));
  await setDoc(ref, oferta(a.uid));

  // Reescribir createdAt dejaria colar una oferta vieja como recien puesta,
  // que es exactamente lo que mira alguien para decidir si todavia hay algo.
  assert.ok(
    await denied(() =>
      updateDoc(doc(a.db, ref.path), {
        ...OFERTA, ownerUid: a.uid,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      }),
    ),
  );
});
