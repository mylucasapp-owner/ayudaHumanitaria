/**
 * Verifica el modelo de seguridad contra los emuladores. Cada caso describe una
 * situación real de terreno, no una regla abstracta.
 *
 *   npm run emulators        # en otra terminal
 *   node scripts/test-rules.mjs
 */
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, connectAuthEmulator, signInAnonymously, signInWithEmailAndPassword } from "firebase/auth";
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  runTransaction,
  serverTimestamp,
  collection,
  writeBatch,
} from "firebase/firestore";

const PROJECT = "ayuda-humanitaria-89e72";
const FS = "127.0.0.1:8181";
const CONFIG = { apiKey: "fake-api-key", projectId: PROJECT };

let pass = 0;
let fail = 0;

async function expect(label, shouldSucceed, fn) {
  let ok, detail = "";
  try {
    await fn();
    ok = shouldSucceed;
    if (!ok) detail = "se permitió algo que debía bloquearse";
  } catch (e) {
    ok = !shouldSucceed;
    detail = ok ? "" : `${e.code ?? e.name}: ${e.message}`;
  }
  if (ok) {
    pass++;
    console.log(`  ok    ${label}`);
  } else {
    fail++;
    console.log(`  FALLA ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

/** Cada usuario necesita su propia app: son sesiones independientes. */
async function session(name) {
  const app = initializeApp(CONFIG, name);
  const auth = getAuth(app);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, "127.0.0.1", 8181);
  return { app, auth, db };
}

async function adminWrite(path, fields) {
  const res = await fetch(
    `http://${FS}/v1/projects/${PROJECT}/databases/(default)/documents/${path}`,
    {
      method: "PATCH",
      headers: { Authorization: "Bearer owner", "Content-Type": "application/json" },
      body: JSON.stringify({ fields }),
    },
  );
  if (!res.ok) throw new Error(`admin write ${path}: ${res.status}`);
}

async function createValidatorAccount(email, password) {
  const res = await fetch(
    `http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const body = await res.json();
  if (!body.localId) throw new Error(`no se pudo crear la cuenta: ${JSON.stringify(body)}`);
  return body.localId;
}

const run = async () => {
  const rosa = await session("rosa");      // solicitante
  const carlos = await session("carlos");  // primer oferente
  const ana = await session("ana");        // segundo oferente
  const bomberos = await session("bomberos"); // validador

  await signInAnonymously(rosa.auth);
  await signInAnonymously(carlos.auth);
  await signInAnonymously(ana.auth);

  // Correo único por corrida: así la suite se puede repetir sin reiniciar
  // el emulador, que es como se va a usar de verdad.
  const email = `bomberos-${Date.now()}@test.cl`;
  const validatorUid = await createValidatorAccount(email, "clave-larga-123");
  await adminWrite(`validators/${validatorUid}`, {
    name: { stringValue: "Bomberos 3a" },
    zone: { stringValue: "Norte" },
  });
  await signInWithEmailAndPassword(bomberos.auth, email, "clave-larga-123");

  // --- Rosa publica una necesidad ---
  const ref = doc(collection(rosa.db, "needs"));
  const id = ref.id;
  const base = {
    category: "medico",
    description: "Insulina para 2 adultos mayores",
    reference: "Los Aromos 120",
    location: { lat: -33.45, lng: -70.66 },
    peopleCount: 2,
    status: "abierta",
    active: true,
    ownerUid: rosa.auth.currentUser.uid,
    verified: false,
    verifiedByName: null,
    verifiedByUid: null,
    claim: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  console.log("\nPublicación");
  await expect("Rosa publica su necesidad", true, () => setDoc(ref, base));
  await expect("Rosa guarda su contacto", true, () =>
    setDoc(doc(rosa.db, "needs", id, "private", "contact"), {
      name: "Rosa",
      phone: "+56911112222",
      ownerUid: rosa.auth.currentUser.uid,
    }),
  );
  await expect("Carlos no puede publicar a nombre de Rosa", false, () =>
    setDoc(doc(collection(carlos.db, "needs")), { ...base }),
  );
  await expect("nadie publica ya verificada", false, () =>
    setDoc(doc(collection(carlos.db, "needs")), {
      ...base,
      ownerUid: carlos.auth.currentUser.uid,
      verified: true,
      verifiedByName: "yo mismo",
    }),
  );

  console.log("\nPrivacidad del teléfono");
  const contactOf = (s) => getDoc(doc(s.db, "needs", id, "private", "contact"));
  await expect("Rosa ve su propio contacto", true, () => contactOf(rosa));
  await expect("Carlos NO ve el teléfono antes de comprometerse", false, () => contactOf(carlos));
  await expect("Bomberos ve el teléfono (es validador)", true, () => contactOf(bomberos));
  await expect("Carlos sí ve la necesidad pública", true, () =>
    getDoc(doc(carlos.db, "needs", id)),
  );

  console.log("\nCupo: sin ledger no hay compromiso");

  /** Consume una posición del registro personal, como hace la app. */
  const reserve = async (s, needId) => {
    const ledgerRef = doc(s.db, "ledger", s.auth.currentUser.uid);
    const snap = await getDoc(ledgerRef);
    const batch = writeBatch(s.db);
    let seq;
    if (!snap.exists()) {
      seq = 0;
      batch.set(ledgerRef, { total: 1, windowCount: 1, windowStart: serverTimestamp() });
    } else {
      seq = snap.data().total;
      batch.update(ledgerRef, {
        total: seq + 1,
        windowCount: snap.data().windowCount + 1,
      });
    }
    batch.set(doc(s.db, "ledger", s.auth.currentUser.uid, "slots", String(seq)), {
      needId,
      at: serverTimestamp(),
    });
    await batch.commit();
    return seq;
  };

  const claimWith = (s, name, seq) =>
    runTransaction(s.db, async (tx) => {
      const snap = await tx.get(doc(s.db, "needs", id));
      const d = snap.data();
      if (d.status === "comprometida" && d.claim?.expiresAt > Date.now()) {
        throw new Error("ya tomada");
      }
      tx.update(doc(s.db, "needs", id), {
        status: "comprometida",
        active: true,
        claim: {
          uid: s.auth.currentUser.uid,
          name,
          expiresAt: Date.now() + 3 * 60 * 60 * 1000,
          at: serverTimestamp(),
          seq,
        },
        updatedAt: serverTimestamp(),
      });
    });

  await expect("sin cupo reservado no se puede tomar", false, () =>
    claimWith(carlos, "Carlos", 0),
  );

  const carlosSeq = await reserve(carlos, id);
  await expect("con cupo, Carlos la toma", true, () =>
    claimWith(carlos, "Carlos", carlosSeq),
  );

  // Ana reserva cupo para OTRA necesidad y trata de usarlo en esta.
  const anaOtherSeq = await reserve(ana, "otra-necesidad-cualquiera");
  await expect("un cupo de otra necesidad no sirve aquí", false, () =>
    claimWith(ana, "Ana", anaOtherSeq),
  );

  await expect("no se puede reescribir un cupo ya gastado", false, () =>
    setDoc(doc(ana.db, "ledger", ana.auth.currentUser.uid, "slots", String(anaOtherSeq)), {
      needId: id,
      at: serverTimestamp(),
    }),
  );

  await expect("el contador no puede saltarse", false, () =>
    updateDoc(doc(ana.db, "ledger", ana.auth.currentUser.uid), {
      total: 99,
      windowCount: 1,
    }),
  );

  console.log("\nCompromiso exclusivo");
  await expect("Ana ya no puede tomarla", false, async () => {
    const seq = await reserve(ana, id);
    await claimWith(ana, "Ana", seq);
  });
  await expect("Carlos ahora sí ve el teléfono", true, () => contactOf(carlos));
  await expect("Ana sigue sin ver el teléfono", false, () => contactOf(ana));

  await expect("Ana no puede robar el compromiso poniendo su uid", false, () =>
    updateDoc(doc(ana.db, "needs", id), {
      claim: {
        uid: ana.auth.currentUser.uid,
        name: "Ana",
        expiresAt: Date.now() + 3600000,
        at: serverTimestamp(),
        seq: 0,
      },
      updatedAt: serverTimestamp(),
    }),
  );
  await expect("nadie puede bloquearla un mes", false, () =>
    updateDoc(doc(ana.db, "needs", id), {
      status: "comprometida",
      active: true,
      claim: {
        uid: ana.auth.currentUser.uid,
        name: "Ana",
        expiresAt: Date.now() + 30 * 24 * 3600 * 1000,
        at: serverTimestamp(),
        seq: 0,
      },
      updatedAt: serverTimestamp(),
    }),
  );

  console.log("\nIntegridad del reporte");
  await expect("Ana no puede reescribir la descripción", false, () =>
    updateDoc(doc(ana.db, "needs", id), {
      description: "texto suplantado",
      updatedAt: serverTimestamp(),
    }),
  );
  await expect("Ana no puede autoverificar", false, () =>
    updateDoc(doc(ana.db, "needs", id), {
      verified: true,
      verifiedByName: "Ana",
      updatedAt: serverTimestamp(),
    }),
  );
  await expect("Ana no puede descartar el reporte", false, () =>
    updateDoc(doc(ana.db, "needs", id), {
      status: "falsa",
      active: false,
      updatedAt: serverTimestamp(),
    }),
  );
  await expect("Ana no puede firmar la verificación con el uid de otro", false, () =>
    updateDoc(doc(ana.db, "needs", id), {
      verified: true,
      verifiedByName: "Bomberos 3a",
      verifiedByUid: validatorUid,
      updatedAt: serverTimestamp(),
    }),
  );
  await expect("Bomberos sí verifica", true, () =>
    updateDoc(doc(bomberos.db, "needs", id), {
      verified: true,
      verifiedByName: "Bomberos 3a",
      verifiedByUid: validatorUid,
      updatedAt: serverTimestamp(),
    }),
  );
  await expect("nadie borra necesidades", false, () =>
    updateDoc(doc(bomberos.db, "needs", id), { ownerUid: validatorUid, updatedAt: serverTimestamp() }),
  );

  console.log("\nEntrega en dos pasos");
  await expect("quien entrega NO puede cerrar la necesidad", false, () =>
    updateDoc(doc(carlos.db, "needs", id), {
      status: "resuelta",
      active: false,
      updatedAt: serverTimestamp(),
    }),
  );
  await expect("Carlos declara la entrega", true, () =>
    updateDoc(doc(carlos.db, "needs", id), {
      status: "entregada",
      active: true,
      updatedAt: serverTimestamp(),
    }),
  );
  await expect("la necesidad sigue visible tras la entrega", true, async () => {
    const snap = await getDoc(doc(ana.db, "needs", id));
    if (snap.data().active !== true) throw new Error("desapareció del feed");
  });
  await expect("Ana no puede confirmar una entrega ajena", false, () =>
    updateDoc(doc(ana.db, "needs", id), {
      status: "resuelta",
      active: false,
      updatedAt: serverTimestamp(),
    }),
  );

  console.log("\nDenuncias de la comunidad");
  await expect("Ana denuncia la necesidad", true, () =>
    setDoc(doc(ana.db, "needs", id, "flags", ana.auth.currentUser.uid), {
      needId: id,
      uid: ana.auth.currentUser.uid,
      reason: "no-existe",
      at: serverTimestamp(),
    }),
  );
  await expect("no se puede denunciar en nombre de otro", false, () =>
    setDoc(doc(ana.db, "needs", id, "flags", carlos.auth.currentUser.uid), {
      needId: id,
      uid: carlos.auth.currentUser.uid,
      reason: "estafa",
      at: serverTimestamp(),
    }),
  );
  await expect("no se puede inflar el conteo repitiendo la denuncia", false, () =>
    setDoc(doc(ana.db, "needs", id, "flags", ana.auth.currentUser.uid), {
      needId: id,
      uid: ana.auth.currentUser.uid,
      reason: "estafa",
      at: serverTimestamp(),
    }),
  );
  await expect("Bomberos lee las denuncias", true, () =>
    getDoc(doc(bomberos.db, "needs", id, "flags", ana.auth.currentUser.uid)),
  );
  await expect("Carlos no lee denuncias ajenas", false, () =>
    getDoc(doc(carlos.db, "needs", id, "flags", ana.auth.currentUser.uid)),
  );

  console.log("\nExpulsión");
  await expect("Ana no puede bloquear a nadie", false, () =>
    setDoc(doc(ana.db, "blocked", carlos.auth.currentUser.uid), {
      byUid: ana.auth.currentUser.uid,
      note: "porque sí",
      at: serverTimestamp(),
    }),
  );
  await expect("Bomberos bloquea a Ana", true, () =>
    setDoc(doc(bomberos.db, "blocked", ana.auth.currentUser.uid), {
      byUid: validatorUid,
      note: "reportes falsos reiterados",
      at: serverTimestamp(),
    }),
  );
  await expect("Ana ya no puede publicar", false, () =>
    setDoc(doc(collection(ana.db, "needs")), {
      ...base,
      ownerUid: ana.auth.currentUser.uid,
    }),
  );
  await expect("Ana ya no puede reservar cupo", false, () =>
    reserve(ana, "cualquier-cosa"),
  );
  await expect("Ana ya no puede denunciar", false, () =>
    setDoc(doc(ana.db, "needs", id, "flags", ana.auth.currentUser.uid), {
      needId: id,
      uid: ana.auth.currentUser.uid,
      reason: "estafa",
      at: serverTimestamp(),
    }),
  );
  await expect("Ana sí puede saber que está bloqueada", true, () =>
    getDoc(doc(ana.db, "blocked", ana.auth.currentUser.uid)),
  );

  console.log("\nTope de cupo por ventana");
  // Una cuenta nueva: agota el cupo tomando necesidades distintas.
  const cosechador = await session("cosechador");
  await signInAnonymously(cosechador.auth);
  for (let i = 0; i < 8; i++) {
    await expect(`cupo ${i + 1} de 8`, true, () =>
      reserve(cosechador, `necesidad-${i}`),
    );
  }
  await expect("el cupo 9 se rechaza en la misma ventana", false, () =>
    reserve(cosechador, "necesidad-9"),
  );
  await deleteApp(cosechador.app);

  console.log("\nCierre");
  await expect("Rosa confirma que recibió la ayuda", true, () =>
    updateDoc(doc(rosa.db, "needs", id), {
      status: "resuelta",
      active: false,
      updatedAt: serverTimestamp(),
    }),
  );

  for (const s of [rosa, carlos, ana, bomberos]) await deleteApp(s.app);

  console.log(`\n${pass} ok, ${fail} fallas`);
  process.exit(fail === 0 ? 0 : 1);
};

run().catch((e) => {
  console.error("error inesperado:", e);
  process.exit(1);
});
