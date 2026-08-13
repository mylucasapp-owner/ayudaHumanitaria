"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import CategoryIcon from "@/components/CategoryIcon";
import ConnectionState from "@/components/ConnectionState";
import FirebaseGate from "@/components/FirebaseGate";
import { useAuth } from "@/lib/auth";
import { getCurrentPosition } from "@/lib/geo";
import {
  createNeed,
  findSimilarNeeds,
  formatRecoveryCode,
  MAX_DESCRIPTION,
  MAX_REFERENCE,
} from "@/lib/needs";
import { SITE } from "@/lib/site";
import { zoneLabel } from "@/lib/zones";
import {
  CATEGORIES,
  CATEGORY_HINT,
  CATEGORY_LABEL,
  OTHER_EXAMPLES,
  type Category,
  type GeoPoint,
  type Need,
} from "@/lib/types";

const PointPicker = dynamic(() => import("@/components/map/PointPicker"), {
  ssr: false,
  loading: () => <div className="map map--picker" />,
});

const CONTACT_KEY = "ah.contacto";

type Step = 0 | 1 | 2 | 3;

export default function Page() {
  return (
    <FirebaseGate>
      <NecesitoFlow />
    </FirebaseGate>
  );
}

function NecesitoFlow() {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>(0);

  const [category, setCategory] = useState<Category | null>(null);
  const [description, setDescription] = useState("");
  const [peopleCount, setPeopleCount] = useState(1);
  const [reference, setReference] = useState("");
  const [location, setLocation] = useState<GeoPoint | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const [showPicker, setShowPicker] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geoMessage, setGeoMessage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [queued, setQueued] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [parecidas, setParecidas] = useState<Need[]>([]);

  // Quien reporta una vez suele reportar otra: no le pedimos sus datos de nuevo.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(CONTACT_KEY) ?? "null");
      if (saved?.name) setName(saved.name);
      if (saved?.phone) setPhone(saved.phone);
    } catch {
      /* almacenamiento no disponible: seguimos sin prefijar nada */
    }
  }, []);

  async function locate() {
    setLocating(true);
    setGeoMessage(null);
    const result = await getCurrentPosition();
    setLocating(false);
    if (result.ok) {
      setLocation(result.point);
      setGeoMessage(`Ubicación tomada (precisión ${Math.round(result.accuracy)} m).`);
    } else {
      setGeoMessage(result.message);
      setShowPicker(true);
    }
  }

  // Se consulta en segundo plano mientras la persona llena el resto. Si falla o
  // tarda, no pasa nada: es una ayuda para no ahogar a los validadores, no un
  // requisito para publicar.
  useEffect(() => {
    if (!location || !category || step !== 2) return;
    let vigente = true;
    findSimilarNeeds(location, category).then((lista) => {
      if (vigente) setParecidas(lista);
    });
    return () => {
      vigente = false;
    };
  }, [location, category, step]);

  const canSubmit =
    !!category &&
    description.trim().length >= 3 &&
    phone.trim().length >= 6 &&
    (!!location || reference.trim().length >= 4);

  async function submit() {
    if (!category || !user || sending) return;
    setSending(true);
    setError(null);
    try {
      try {
        localStorage.setItem(CONTACT_KEY, JSON.stringify({ name, phone }));
      } catch {
        /* sin almacenamiento no pasa nada: el reporte se envía igual */
      }
      const creada = await createNeed(user.uid, {
        category,
        description,
        reference,
        location,
        peopleCount,
        contact: { name, phone },
      });
      setCreatedId(creada.id);
      setQueued(creada.pending);
      setRecoveryCode(creada.code);
      setStep(3);
    } catch {
      setError(
        "No se pudo enviar el reporte. Revisa la conexión y vuelve a intentar.",
      );
    } finally {
      setSending(false);
    }
  }

  if (step === 3 && createdId && category) {
    return (
      <Ticket
        id={createdId}
        queued={queued}
        code={recoveryCode}
        category={category}
        description={description}
        reference={reference}
        point={location}
      />
    );
  }

  return (
    <main className="shell" id="main">
      <Header step={step} onBack={() => setStep((s) => (s - 1) as Step)} />
      <ConnectionState />

      {step === 0 && (
        <section className="stack">
          <h1 className="title">¿Qué necesitas?</h1>
          <p className="subtitle">Toca una opción.</p>
          <div className="cats">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                className="cat"
                aria-pressed={category === c}
                onClick={() => {
                  setCategory(c);
                  setStep(1);
                }}
              >
                <CategoryIcon category={c} />
                {CATEGORY_LABEL[c]}
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 1 && category && (
        <section className="stack">
          <h1 className="title">{CATEGORY_LABEL[category]}</h1>
          <div className="field">
            <label className="label" htmlFor="desc">
              Describe la necesidad en una frase
            </label>
            <textarea
              id="desc"
              className="textarea"
              maxLength={MAX_DESCRIPTION}
              value={description}
              autoFocus
              placeholder={CATEGORY_HINT[category]}
              onChange={(e) => setDescription(e.target.value)}
            />
            <div className="counter">
              {description.length}/{MAX_DESCRIPTION}
            </div>
            {/* "OTRA AYUDA" no dice por sí sola qué cabe dentro. Sin los
                ejemplos, quien necesita peritar su casa o enterrar a alguien
                asume que la plataforma no es para eso y no reporta. */}
            {category === "otro" && (
              <p className="meta">
                Por ejemplo: {OTHER_EXAMPLES.join(" · ").toLowerCase()}.
              </p>
            )}
          </div>

          <div className="field">
            <span className="label">¿Cuántas personas?</span>
            <div className="row">
              <button
                type="button"
                className="btn"
                style={{ width: 72 }}
                aria-label="Menos personas"
                onClick={() => setPeopleCount((n) => Math.max(1, n - 1))}
              >
                −
              </button>
              <div
                className="grow center strong"
                style={{ fontSize: 30 }}
                aria-live="polite"
              >
                {peopleCount}
              </div>
              <button
                type="button"
                className="btn"
                style={{ width: 72 }}
                aria-label="Más personas"
                onClick={() => setPeopleCount((n) => Math.min(999, n + 1))}
              >
                +
              </button>
            </div>
          </div>

          <button
            type="button"
            className="btn btn--primary"
            disabled={description.trim().length < 3}
            onClick={() => setStep(2)}
          >
            Continuar
          </button>
        </section>
      )}

      {step === 2 && (
        <section className="stack">
          <h1 className="title">¿Dónde y con quién?</h1>

          <button
            type="button"
            className="btn btn--primary"
            onClick={locate}
            disabled={locating}
          >
            {locating ? "Buscando señal…" : "Usar mi ubicación actual"}
          </button>

          {location && (
            <p className="notice">
              Punto guardado:{" "}
              <span className="mono">
                {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
              </span>
            </p>
          )}
          {geoMessage && !location && (
            <p className="notice notice--signal">{geoMessage}</p>
          )}

          {!showPicker ? (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setShowPicker(true)}
            >
              Marcar el punto en el mapa
            </button>
          ) : (
            <div className="stack" style={{ gap: 8 }}>
              <span className="label">Toca el mapa para mover el punto</span>
              <PointPicker value={location} onChange={setLocation} />
            </div>
          )}

          <div className="field">
            <label className="label" htmlFor="ref">
              Referencia escrita (calle, sector, seña)
            </label>
            <input
              id="ref"
              className="input"
              maxLength={MAX_REFERENCE}
              value={reference}
              placeholder="Ej: Carrera 12 #4-30, frente a la cancha"
              onChange={(e) => setReference(e.target.value)}
            />
          </div>

          <hr className="hr" />

          <div className="field">
            <label className="label" htmlFor="name">
              Nombre de contacto
            </label>
            <input
              id="name"
              className="input"
              autoComplete="name"
              maxLength={60}
              value={name}
              placeholder="Ej: Rosa"
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="phone">
              Teléfono
            </label>
            <input
              id="phone"
              className="input"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              maxLength={25}
              value={phone}
              placeholder="+57 300 123 4567"
              onChange={(e) => setPhone(e.target.value)}
            />
            <p className="meta">
              Solo lo ve quien se comprometa a ayudarte y los validadores. No
              aparece en el mapa público.
            </p>
          </div>

          {error && <p className="notice notice--error">{error}</p>}

          <button
            type="button"
            className="btn btn--primary"
            disabled={!canSubmit || sending || !user}
            onClick={submit}
          >
            {sending ? "Enviando…" : "Publicar necesidad"}
          </button>
          {parecidas.length > 0 && (
            <div className="notice notice--signal stack" style={{ gap: 8 }}>
              <span className="strong">
                {parecidas.length === 1
                  ? "Ya hay una necesidad parecida muy cerca"
                  : `Ya hay ${parecidas.length} necesidades parecidas muy cerca`}
              </span>
              {parecidas.slice(0, 3).map((n) => (
                <Link
                  key={n.id}
                  className="meta strong"
                  href={`/necesidad/?id=${n.id}`}
                  style={{ display: "block" }}
                >
                  · {n.description}
                </Link>
              ))}
              <span className="meta">
                Si es la misma, no la publiques de nuevo: repetirla hace que los
                coordinadores revisen lo mismo dos veces. Si la tuya es distinta
                —otra familia, otra cosa— publícala sin problema.
              </span>
            </div>
          )}

          {!canSubmit && (
            <p className="meta center">
              Falta el teléfono y una ubicación (GPS, punto en el mapa o
              referencia escrita).
            </p>
          )}
        </section>
      )}
    </main>
  );
}

function Header({ step, onBack }: { step: Step; onBack: () => void }) {
  return (
    <header className="stack" style={{ gap: 10 }}>
      {step === 0 ? (
        <Link className="backlink" href="/">
          ← Inicio
        </Link>
      ) : (
        <button type="button" className="backlink" onClick={onBack}>
          ← Atrás
        </button>
      )}
      <div className="steps" aria-label={`Paso ${step + 1} de 3`}>
        {[0, 1, 2].map((i) => (
          <span key={i} className={`step${i <= step ? " step--on" : ""}`} />
        ))}
      </div>
    </header>
  );
}

function Ticket({
  id,
  queued,
  code,
  category,
  description,
  reference,
  point,
}: {
  id: string;
  queued: boolean;
  category: Category;
  description: string;
  reference: string;
  point: GeoPoint | null;
  code: string;
}) {
  const shown = useMemo(() => formatRecoveryCode(code), [code]);
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const mensaje = `Reporté una necesidad en Ayuda Humanitaria.\nMi código de recuperación es ${shown}\nSirve para recuperar el reporte si pierdo el teléfono: ${SITE.url}/recuperar/`;

  const enlace = `${SITE.url}/necesidad/?id=${id}`;
  // Mismo formato que el de la ficha: quien lo recibe debe entender de qué se
  // trata sin abrir nada, porque muchos leen WhatsApp con datos contados.
  const mensajeNecesidad =
    `${CATEGORY_LABEL[category]} en ${zoneLabel(point) ?? "zona afectada"}: ` +
    `${description}\n${reference || ""}\n` +
    `¿Puedes cubrirla o conoces a alguien? ${enlace}`;

  return (
    <main className="shell" id="main">
      <div className="spacer" />
      <section className="stack center" style={{ gap: 16 }}>
        <h1 className="title">
          {queued ? "Reporte guardado" : "Necesidad publicada"}
        </h1>
        {queued ? (
          <p className="notice notice--signal">
            No hay señal ahora mismo. Tu reporte quedó guardado en el teléfono y
            se enviará solo apenas vuelva la conexión.{" "}
            <span className="strong">No lo escribas de nuevo.</span>
          </p>
        ) : (
          <p className="subtitle">
            Ya está en el mapa. Un validador puede llamarte para confirmarla.
          </p>
        )}
        <div className="card">
          <div className="label">Tu código de recuperación</div>
          <div className="mono strong" style={{ fontSize: 34, letterSpacing: 3 }}>
            {shown}
          </div>
        </div>

        <p className="notice notice--signal">
          <span className="strong">Guárdalo fuera de este teléfono.</span> Si lo
          pierdes o el navegador borra sus datos, este código es lo único que te
          permite recuperar el reporte desde otro aparato.
        </p>

        {/* Los dos envíos van separados y rotulados a propósito. El del código
            es privado: quien lo tenga puede apropiarse del reporte desde
            /recuperar/. El de la necesidad es público y se manda a grupos. Un
            solo botón ambiguo aquí terminaría con códigos de recuperación
            pegados en cadenas de WhatsApp. */}
        <div className="stack" style={{ gap: 10, width: "100%" }}>
          <p className="meta">
            <span className="strong">Solo para ti.</span> No lo mandes a grupos:
            quien tenga este código puede tomar el control del reporte.
          </p>
          <a
            className="btn"
            href={`https://wa.me/?text=${encodeURIComponent(mensaje)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Enviarme el código por WhatsApp
          </a>
          <button
            type="button"
            className="btn"
            onClick={async () => {
              try {
                if (navigator.share) {
                  await navigator.share({ text: mensaje });
                } else {
                  await navigator.clipboard.writeText(shown);
                  setCopied(true);
                }
              } catch {
                /* el usuario canceló el diálogo */
              }
            }}
          >
            {copied ? "Código copiado" : "Copiar el código"}
          </button>
        </div>

        {/* Difundir es lo que hace que la necesidad encuentre a quien puede
            cubrirla, y el momento de hacerlo es este: después ya se fue de la
            pantalla. Estando sin señal no se ofrece, porque la necesidad aún no
            llegó al servidor y el enlace le daría "no existe" a quien lo abra. */}
        {!queued && (
          <div className="stack" style={{ gap: 10, width: "100%" }}>
            <hr className="hr" />
            <p className="meta">
              <span className="strong">Para difundir.</span> Cuantos más lo vean,
              antes llega la ayuda. Este enlace no muestra tu teléfono.
            </p>
            <a
              className="btn btn--primary"
              href={`https://wa.me/?text=${encodeURIComponent(mensajeNecesidad)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Compartir mi necesidad
            </a>
            <button
              type="button"
              className="btn"
              onClick={async () => {
                try {
                  if (navigator.share) {
                    await navigator.share({ title: description, url: enlace });
                  } else {
                    await navigator.clipboard.writeText(enlace);
                    setLinkCopied(true);
                  }
                } catch {
                  /* el usuario canceló el diálogo */
                }
              }}
            >
              {linkCopied ? "Enlace copiado" : "Copiar el enlace"}
            </button>
          </div>
        )}
      </section>
      <div className="spacer" />
      <div className="stack">
        <Link className="btn btn--ghost" href={`/necesidad/?id=${id}`}>
          Ver mi reporte
        </Link>
        <Link className="btn btn--ghost" href="/">
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}
