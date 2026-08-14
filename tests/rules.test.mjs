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
