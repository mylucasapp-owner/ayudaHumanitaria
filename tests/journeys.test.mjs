/**
 * Recorridos completos, actor por actor, ejecutando el mismo código que corre
 * en el navegador. Cada prueba es una historia que puede pasar en terreno.
 *
 * Requiere emuladores: `npm test` los levanta y los apaga solo.
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { getDoc, doc, setDoc, serverTimestamp } from "firebase/firestore";

import {
  actor,
  anonActor,
  validatorActor,
  as,
  cleanup,
  denied,
  expireClaim,
  ageLedgerWindow,
  adminGet,
} from "./helpers.mjs";

import {
  createNeed,
  claimNeed,
  markDelivered,
  resolveNeed,
  releaseNeed,
  discardNeed,
  verifyNeed,
  flagNeed,
  fetchContact,
  blockUser,
  subscribeToOpenNeeds,
  findSimilarNeeds,
  ClaimTakenError,
  ClaimQuotaError,
  BlockedError,
  locateNeed,
  registerInterest,
} from "../lib/needs.ts";

after(cleanup);

const REPORT = {
  category: "medico",
  description: "Insulina para 2 adultos mayores",
  reference: "Los Aromos 120",
  location: { lat: 3.4372, lng: -76.5225 },
  peopleCount: 2,
  contact: { name: "Rosa", phone: "+56911112222" },
};

async function publish(owner, overrides = {}) {
  const creada = await as(owner, () => createNeed(owner.uid, { ...REPORT, ...overrides }));
  return creada.id;
}

async function statusOf(needId) {
  const snap = await adminGet(`needs/${needId}`);
  return snap?.fields?.status?.stringValue ?? null;
}

test("recorrido feliz: se pide, se cubre, se entrega y se confirma", async () => {
  const rosa = await anonActor("rosa");
  const carlos = await anonActor("carlos");
  const id = await publish(rosa);

  assert.equal(await statusOf(id), "abierta");

  await as(carlos, () => claimNeed(id, carlos.uid, "Carlos"));
  assert.equal(await statusOf(id), "comprometida");

  // Recién ahora Carlos alcanza el teléfono.
  const visto = await as(carlos, () => fetchContact(id));
  assert.equal(visto.state, "ok");
  assert.equal(visto.contact.phone, "+56911112222");

  await as(carlos, () => markDelivered(id));
  assert.equal(await statusOf(id), "entregada");

  // La necesidad NO desapareció: sigue activa esperando confirmación.
  const trasEntrega = await adminGet(`needs/${id}`);
  assert.equal(trasEntrega.fields.active.booleanValue, true);

  await as(rosa, () => resolveNeed(id));
  assert.equal(await statusOf(id), "resuelta");
});

test("quien entrega no puede cerrar: no se vacía el mapa declarando entregas", async () => {
  const rosa = await anonActor("rosa");
  const atacante = await anonActor("atacante");
  const id = await publish(rosa);

  await as(atacante, () => claimNeed(id, atacante.uid, "Falso"));
  assert.ok(await denied(() => as(atacante, () => resolveNeed(id))));

  // Lo máximo que consigue es dejarla esperando confirmación, bien visible.
  await as(atacante, () => markDelivered(id));
  assert.equal(await statusOf(id), "entregada");
  const snap = await adminGet(`needs/${id}`);
  assert.equal(snap.fields.active.booleanValue, true);
});

test("carrera entre dos oferentes: solo uno se lleva la necesidad", async () => {
  const rosa = await anonActor("rosa");
  const carlos = await anonActor("carlos");
  const ana = await anonActor("ana");
  const id = await publish(rosa);

  await as(carlos, () => claimNeed(id, carlos.uid, "Carlos"));

  await assert.rejects(
    () => as(ana, () => claimNeed(id, ana.uid, "Ana")),
    (e) => e instanceof ClaimTakenError,
  );

  const contactoAna = await as(ana, () => fetchContact(id));
  assert.equal(contactoAna.state, "denied");
});

test("compromiso abandonado: al vencer, otro voluntario puede retomarla", async () => {
  const rosa = await anonActor("rosa");
  const carlos = await anonActor("carlos");
  const ana = await anonActor("ana");
  const id = await publish(rosa);

  await as(carlos, () => claimNeed(id, carlos.uid, "Carlos"));
  await expireClaim(id);

  // Vencido el plazo, Carlos pierde el acceso al teléfono.
  const contactoCarlos = await as(carlos, () => fetchContact(id));
  assert.equal(contactoCarlos.state, "denied");

  await as(ana, () => claimNeed(id, ana.uid, "Ana"));
  const snap = await adminGet(`needs/${id}`);
  assert.equal(snap.fields.claim.mapValue.fields.uid.stringValue, ana.uid);

  const contactoAna = await as(ana, () => fetchContact(id));
  assert.equal(contactoAna.state, "ok");
});

test("el voluntario que no puede cumplir la libera y vuelve al feed", async () => {
  const rosa = await anonActor("rosa");
  const carlos = await anonActor("carlos");
  const id = await publish(rosa);

  await as(carlos, () => claimNeed(id, carlos.uid, "Carlos"));
  await as(carlos, () => releaseNeed(id));

  assert.equal(await statusOf(id), "abierta");
  const contacto = await as(carlos, () => fetchContact(id));
  assert.equal(contacto.state, "denied");
});

test("entrega que no ocurrió: un validador la reabre", async () => {
  const rosa = await anonActor("rosa");
  const falso = await anonActor("falso");
  const bomberos = await validatorActor("bomberos");
  const id = await publish(rosa);

  await as(falso, () => claimNeed(id, falso.uid, "Falso"));
  await as(falso, () => markDelivered(id));

  await as(bomberos, () => releaseNeed(id));
  assert.equal(await statusOf(id), "abierta");
});

test("reporte falso: la comunidad lo denuncia y un validador lo descarta", async () => {
  const mentiroso = await anonActor("mentiroso");
  const vecino = await anonActor("vecino");
  const bomberos = await validatorActor("bomberos");
  const id = await publish(mentiroso, { description: "Necesito 20 notebooks" });

  await as(vecino, () => flagNeed(id, vecino.uid, "no-existe"));

  const flag = await adminGet(`needs/${id}/flags/${vecino.uid}`);
  assert.equal(flag.fields.reason.stringValue, "no-existe");

  await as(bomberos, () => discardNeed(id));
  assert.equal(await statusOf(id), "falsa");

  const snap = await adminGet(`needs/${id}`);
  assert.equal(snap.fields.active.booleanValue, false);
});

test("verificar deja constancia de quién lo hizo, no solo del nombre", async () => {
  const rosa = await anonActor("rosa");
  const bomberos = await validatorActor("bomberos", "Bomberos 3a");
  const id = await publish(rosa);

  await as(bomberos, () => verifyNeed(id, "Bomberos 3a", bomberos.uid));

  const snap = await adminGet(`needs/${id}`);
  assert.equal(snap.fields.verified.booleanValue, true);
  assert.equal(snap.fields.verifiedByUid.stringValue, bomberos.uid);
});

test("el cupo frena la cosecha de teléfonos y se renueva con la ventana", async () => {
  const rosa = await anonActor("rosa");
  const cosechador = await anonActor("cosechador");

  const ids = [];
  for (let i = 0; i < 9; i++) ids.push(await publish(rosa));

  for (let i = 0; i < 8; i++) {
    await as(cosechador, () => claimNeed(ids[i], cosechador.uid, "C"));
  }

  await assert.rejects(
    () => as(cosechador, () => claimNeed(ids[8], cosechador.uid, "C")),
    (e) => e instanceof ClaimQuotaError,
  );

  // Pasada la ventana, el voluntario legítimo puede seguir trabajando.
  await ageLedgerWindow(cosechador.uid, 7);
  await as(cosechador, () => claimNeed(ids[8], cosechador.uid, "C"));
  assert.equal(await statusOf(ids[8]), "comprometida");
});

test("una cuenta bloqueada deja de poder publicar, tomar y denunciar", async () => {
  const rosa = await anonActor("rosa");
  const abusivo = await anonActor("abusivo");
  const bomberos = await validatorActor("bomberos");
  const id = await publish(rosa);

  await as(bomberos, () => blockUser(abusivo.uid, bomberos.uid, "spam"));

  assert.ok(await denied(() => publish(abusivo)));
  assert.ok(await denied(() => as(abusivo, () => flagNeed(id, abusivo.uid, "estafa"))));

  // Y el mensaje debe decir la verdad: bloqueado, no "espera un momento".
  await assert.rejects(
    () => as(abusivo, () => claimNeed(id, abusivo.uid, "X")),
    (e) => e instanceof BlockedError,
  );

  // Pero sigue pudiendo leer: el mapa es información de emergencia.
  const snap = await as(abusivo, () => getDoc(doc(abusivo.db, "needs", id)));
  assert.ok(snap.exists());
});

test("el autor puede cerrar su necesidad sin que nadie la haya tomado", async () => {
  const rosa = await anonActor("rosa");
  const id = await publish(rosa);
  await as(rosa, () => resolveNeed(id));
  assert.equal(await statusOf(id), "resuelta");
});

test("el teléfono nunca viaja en el documento público", async () => {
  const rosa = await anonActor("rosa");
  const curioso = await anonActor("curioso");
  const id = await publish(rosa);

  const snap = await as(curioso, () => getDoc(doc(curioso.db, "needs", id)));
  const data = snap.data();
  const serializado = JSON.stringify(data);

  assert.ok(!serializado.includes("+56911112222"), "el teléfono se filtró al documento público");
  assert.ok(!serializado.includes("Rosa"), "el nombre de contacto se filtró al documento público");
  // Lo que sí debe estar, para que el mapa sirva.
  assert.equal(data.description, REPORT.description);
  assert.ok(data.location);
});

test("un validador alcanza el teléfono sin gastar cupo", async () => {
  const rosa = await anonActor("rosa");
  const bomberos = await validatorActor("bomberos");
  const id = await publish(rosa);

  const contacto = await as(bomberos, () => fetchContact(id));
  assert.equal(contacto.state, "ok");

  const ledger = await adminGet(`ledger/${bomberos.uid}`);
  assert.equal(ledger, null, "el validador no debería consumir cupo");
});

test("la bitácora registra a qué damnificados accedió cada cuenta", async () => {
  const rosa = await anonActor("rosa");
  const carlos = await anonActor("carlos");
  const a = await publish(rosa);
  const b = await publish(rosa);

  await as(carlos, () => claimNeed(a, carlos.uid, "Carlos"));
  await as(carlos, () => claimNeed(b, carlos.uid, "Carlos"));

  const slot0 = await adminGet(`ledger/${carlos.uid}/slots/0`);
  const slot1 = await adminGet(`ledger/${carlos.uid}/slots/1`);
  const registrados = [slot0.fields.needId.stringValue, slot1.fields.needId.stringValue];

  assert.deepEqual(registrados.sort(), [a, b].sort());
});

test("la zona se guarda al publicar y el feed filtra por ella en el servidor", async () => {
  const rosa = await anonActor("rosa-zonas");

  const enValle = await publish(rosa);
  const enChoco = await publish(rosa, {
    description: "Cobijas, familias durmiendo afuera",
    location: { lat: 5.6947, lng: -76.6611 },
  });

  assert.equal((await adminGet(`needs/${enValle}`)).fields.zone.stringValue, "valle");
  assert.equal((await adminGet(`needs/${enChoco}`)).fields.zone.stringValue, "choco");

  // Filtrar en la consulta, y no después de traer las más recientes, es lo que
  // impide que una zona con mucho volumen tape a las demás.
  // La consulta se arma con `db()` en el momento de llamar, así que basta con
  // que la inyección esté activa durante la llamada, no durante la espera.
  const soloChoco = await new Promise((resolve, reject) => {
    as(rosa, async () => {
      const stop = subscribeToOpenNeeds(
        (lista) => {
          stop();
          resolve(lista);
        },
        reject,
        "choco",
      );
    });
  });

  const ids = soloChoco.map((n) => n.id);
  assert.ok(ids.includes(enChoco), "falta la necesidad de Chocó");
  assert.ok(!ids.includes(enValle), "se coló una necesidad del Valle");
  assert.ok(soloChoco.every((n) => n.zone === "choco"));
});

test("una necesidad sin ubicación queda fuera de los focos, no perdida", async () => {
  const rosa = await anonActor("rosa-sinubic");
  const id = await publish(rosa, { location: null, reference: "Frente a la iglesia" });
  assert.equal((await adminGet(`needs/${id}`)).fields.zone.stringValue, "otra");
});

test("el reporte queda congelado: nadie reescribe lo que otro pidió", async () => {
  const rosa = await anonActor("rosa");
  const ana = await anonActor("ana");
  const id = await publish(rosa);

  const { updateDoc, serverTimestamp } = await import("firebase/firestore");
  assert.ok(
    await denied(() =>
      updateDoc(doc(ana.db, "needs", id), {
        description: "Necesito dinero en efectivo",
        updatedAt: serverTimestamp(),
      }),
    ),
  );

  const snap = await adminGet(`needs/${id}`);
  assert.equal(snap.fields.description.stringValue, REPORT.description);
});

test("se avisa de un duplicado cercano, pero solo del mismo tipo y de verdad cerca", async () => {
  const vecino = await anonActor("vecino-dup");
  // Lejos del punto que usan las demás pruebas: comparten emulador y sus
  // necesidades caerían dentro del radio, falseando el resultado.
  const cancha = { lat: 3.39, lng: -76.58 };

  await publish(vecino, {
    category: "agua",
    description: "Agua potable para el albergue",
    location: cancha,
  });

  // A media cuadra y de lo mismo: es el caso que ahoga a los validadores.
  const aMediaCuadra = { lat: cancha.lat + 0.0015, lng: cancha.lng };
  const parecidas = await as(vecino, () => findSimilarNeeds(aMediaCuadra, "agua"));
  assert.equal(parecidas.length, 1);
  assert.match(parecidas[0].description, /Agua potable/);

  // Misma cuadra pero otra necesidad: no es duplicado.
  const otraCosa = await as(vecino, () => findSimilarNeeds(aMediaCuadra, "medico"));
  assert.equal(otraCosa.length, 0);

  // Lo mismo, pero a dos kilómetros: tampoco.
  const lejos = { lat: cancha.lat + 0.02, lng: cancha.lng };
  const aLoLejos = await as(vecino, () => findSimilarNeeds(lejos, "agua"));
  assert.equal(aLoLejos.length, 0);
});

test("una necesidad ya cerrada no se cuenta como duplicado", async () => {
  const rosa = await anonActor("rosa-cerrada");
  const punto = { lat: 4.8087, lng: -75.6906 };

  const id = await publish(rosa, {
    category: "refugio",
    description: "Colchonetas para tres familias",
    location: punto,
  });
  await as(rosa, () => resolveNeed(id));

  const parecidas = await as(rosa, () => findSimilarNeeds(punto, "refugio"));
  assert.equal(parecidas.length, 0, "una necesidad resuelta no debe frenar un pedido nuevo");
});

test("un validador pone el punto que faltaba, pero no reescribe el que ya habia", async () => {
  const rosa = await anonActor("rosa-ubicar");

  // Reporte sin coordenadas: el caso de 4 de cada 10 reales.
  const sinPunto = await publish(rosa, {
    description: "Agua, no pude dar ubicacion",
    location: null,
  });
  assert.equal((await adminGet(`needs/${sinPunto}`)).fields.location.nullValue, null);

  const v = await validatorActor("val-ubicar");
  await as(v, () => locateNeed(sinPunto, { lat: 3.4372, lng: -76.5225 }));

  const doc = await adminGet(`needs/${sinPunto}`);
  assert.equal(doc.fields.location.mapValue.fields.lat.doubleValue, 3.4372);
  // La zona se recalcula con el punto nuevo: de "otra" pasa a la real.
  assert.equal(doc.fields.zone.stringValue, "valle");

  // Sobre uno que YA tenia punto no puede: eso seria reescribir lo que la
  // persona reporto, no rellenar un hueco.
  const conPunto = await publish(rosa, {
    description: "Esta si traia ubicacion",
    location: { lat: 5.6947, lng: -76.6611 },
  });
  assert.ok(
    await denied(() => as(v, () => locateNeed(conPunto, { lat: 3.4372, lng: -76.5225 }))),
    "un validador no debe poder mover el punto que dio el damnificado",
  );
});

test("un anonimo no puede ubicar un reporte ajeno", async () => {
  const rosa = await anonActor("rosa-ubicar-2");
  const sinPunto = await publish(rosa, { location: null });

  const intruso = await anonActor("intruso-ubicar");
  assert.ok(
    await denied(() => as(intruso, () => locateNeed(sinPunto, { lat: 3.4, lng: -76.5 }))),
    "sin acreditacion nadie clava un pin en el reporte de otro",
  );
});

test("en una busqueda de personas varios acceden al contacto sin bloquearse", async () => {
  const maria = await anonActor("maria-busca");
  const needId = await publish(maria, {
    category: "personas",
    description: "Busco a mi papa, 72 anios, visto en el puente",
  });

  // Carlos lo vio a las 8 y avisa.
  const carlos = await anonActor("carlos-testigo");
  await as(carlos, () => registerInterest(needId, carlos.uid));
  assert.ok((await as(carlos, () => fetchContact(needId))).contact, "Carlos alcanza el contacto");

  // La necesidad NO queda bloqueada: sigue abierta y sin claim.
  const doc = await adminGet(`needs/${needId}`);
  assert.equal(doc.fields.status.stringValue, "abierta");
  assert.equal(doc.fields.claim.nullValue, null);

  // Ana la vio a las 11, hacia otro lado. Antes se quedaba fuera tres horas.
  const ana = await anonActor("ana-testigo");
  await as(ana, () => registerInterest(needId, ana.uid));
  assert.ok((await as(ana, () => fetchContact(needId))).contact, "Ana tambien alcanza el contacto");
});

test("la puerta de las busquedas no sirve para una necesidad material", async () => {
  const rosa = await anonActor("rosa-material");
  const needId = await publish(rosa, { category: "agua" });

  const colado = await anonActor("colado");
  assert.ok(
    await denied(() => as(colado, () => registerInterest(needId, colado.uid))),
    "en una necesidad material el compromiso exclusivo si tiene sentido",
  );
});

test("el acceso a una busqueda se paga: sin cupo no hay telefono", async () => {
  const maria = await anonActor("maria-busca-2");
  const needId = await publish(maria, { category: "personas" });

  const vivo = await anonActor("sin-pagar");
  // Escribir el acceso a mano, senalando un slot que nunca se reservo.
  assert.ok(
    await denied(() =>
      setDoc(doc(vivo.db, `needs/${needId}/access/${vivo.uid}`), {
        needId, uid: vivo.uid, seq: 99, at: serverTimestamp(),
      }),
    ),
    "sin cupo pagado no se alcanza el telefono de una familia",
  );
});
