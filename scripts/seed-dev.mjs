/**
 * Siembra necesidades de prueba en los emuladores para revisar la app con datos
 * realistas. Escribe con credencial de administrador del emulador, así puede
 * dejar necesidades ya verificadas o comprometidas, que por reglas ningún
 * cliente podría crear directamente.
 *
 * Nunca toca producción: aborta si no encuentra el emulador.
 *
 *   node scripts/seed-dev.mjs
 */
const PROJECT = "ayuda-humanitaria-89e72";
const HOST = "127.0.0.1:8181";
const BASE = `http://${HOST}/v1/projects/${PROJECT}/databases/(default)/documents`;

const vivo = await fetch(`http://${HOST}/`).catch(() => null);
if (!vivo) {
  console.error("No hay emulador de Firestore en 8181. Aborto para no tocar producción.");
  process.exit(1);
}

const ahora = new Date().toISOString();

// Cali, Pereira y Quibdó: los tres focos, separados por cientos de kilómetros.
const NEEDS = [
  ["medico", "Insulina para 2 adultos mayores", "Barrio El Poblado, casa esquinera", 3.4516, -76.532, 2, true],
  ["agua", "Agua potable para 12 personas, 2 bebés", "Albergue de la escuela", 3.4372, -76.5225, 12, true],
  ["refugio", "Carpas para 3 familias que perdieron el techo", "Cancha del barrio", 3.4201, -76.5411, 14, false],
  ["rescate", "Vecino atrapado en casa colapsada", "Calle 9 con carrera 15", 3.4489, -76.5099, 1, true],
  ["transporte", "Traslado de paciente de diálisis a la clínica", "Vía principal, kilómetro 4", 4.8087, -75.6906, 1, false],
  ["agua", "Tanque de agua para 40 personas", "Vereda La Suiza", 4.8231, -75.7012, 40, true],
  ["medico", "Medicamentos para hipertensión y diabetes", "Puesto de salud", 5.6947, -76.6611, 6, false],
  ["refugio", "Cobijas y colchonetas, familias durmiendo afuera", "Corregimiento sobre el río", 5.7102, -76.6489, 9, true],
  ["agua", "Purificadores, el río bajó turbio", "Junto a la iglesia", 5.6801, -76.6702, 25, false],
];

function campos(n) {
  const [category, description, reference, lat, lng, peopleCount, verified] = n;
  return {
    category: { stringValue: category },
    description: { stringValue: description },
    reference: { stringValue: reference },
    location: {
      mapValue: {
        fields: { lat: { doubleValue: lat }, lng: { doubleValue: lng } },
      },
    },
    peopleCount: { integerValue: String(peopleCount) },
    status: { stringValue: "abierta" },
    active: { booleanValue: true },
    ownerUid: { stringValue: "seed-owner" },
    verified: { booleanValue: verified },
    verifiedByName: verified
      ? { stringValue: "Defensa Civil" }
      : { nullValue: null },
    verifiedByUid: verified ? { stringValue: "seed-validator" } : { nullValue: null },
    claim: { nullValue: null },
    createdAt: { timestampValue: ahora },
    updatedAt: { timestampValue: ahora },
  };
}

let n = 0;
for (const need of NEEDS) {
  const res = await fetch(`${BASE}/needs`, {
    method: "POST",
    headers: { Authorization: "Bearer owner", "Content-Type": "application/json" },
    body: JSON.stringify({ fields: campos(need) }),
  });
  if (!res.ok) {
    console.error("falló", need[1], await res.text());
    continue;
  }
  const id = (await res.json()).name.split("/").pop();
  await fetch(`${BASE}/needs/${id}/private/contact?documentId=contact`, {
    method: "PATCH",
    headers: { Authorization: "Bearer owner", "Content-Type": "application/json" },
    body: JSON.stringify({
      fields: {
        name: { stringValue: "Contacto de prueba" },
        phone: { stringValue: "+573000000000" },
        ownerUid: { stringValue: "seed-owner" },
      },
    }),
  });
  n++;
}

console.log(`sembradas ${n} necesidades en Cali, Pereira y Quibdó`);
