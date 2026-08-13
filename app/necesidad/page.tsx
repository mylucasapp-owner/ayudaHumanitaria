"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import CategoryIcon from "@/components/CategoryIcon";
import ConnectionState from "@/components/ConnectionState";
import FirebaseGate from "@/components/FirebaseGate";
import StatusTags from "@/components/StatusTags";
import { useAuth } from "@/lib/auth";
import { distanceKm, formatAgo, formatDistance, getCurrentPosition } from "@/lib/geo";
import {
  ClaimQuotaError,
  ClaimTakenError,
  blockUser,
  claimNeed,
  discardNeed,
  fetchContact,
  flagNeed,
  markDelivered,
  releaseNeed,
  resolveNeed,
  subscribeToMyFlag,
  subscribeToNeed,
  verifyNeed,
} from "@/lib/needs";
import {
  CATEGORY_LABEL,
  FLAG_LABEL,
  FLAG_REASONS,
  isClaimExpired,
  type FlagReason,
  type GeoPoint,
  type Need,
  type NeedContact,
} from "@/lib/types";

const CONTACT_KEY = "ah.contacto";

export default function Page() {
  return (
    <Suspense fallback={<main className="shell">Cargando…</main>}>
      <FirebaseGate>
        <NeedDetail />
      </FirebaseGate>
    </Suspense>
  );
}

function NeedDetail() {
  const id = useSearchParams().get("id") ?? "";
  const { user, validator } = useAuth();
  const [need, setNeed] = useState<Need | null>(null);
  const [loading, setLoading] = useState(true);
  const [contact, setContact] = useState<NeedContact | null>(null);
  const [me, setMe] = useState<GeoPoint | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claimName, setClaimName] = useState("");
  const [flagged, setFlagged] = useState(false);
  const [showFlagReasons, setShowFlagReasons] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(CONTACT_KEY) ?? "null");
      if (saved?.name) setClaimName(saved.name);
    } catch {
      /* sin almacenamiento pedimos el nombre en blanco */
    }
  }, []);

  useEffect(() => {
    if (!id || !user) return;
    return subscribeToNeed(
      id,
      (n) => {
        setNeed(n);
        setLoading(false);
      },
      () => {
        setError("No se pudo cargar la necesidad.");
        setLoading(false);
      },
    );
  }, [id, user]);

  useEffect(() => {
    getCurrentPosition(10000).then((r) => {
      if (r.ok) setMe(r.point);
    });
  }, []);

  useEffect(() => {
    if (!id || !user) return;
    return subscribeToMyFlag(id, user.uid, setFlagged);
  }, [id, user]);

  const isOwner = !!user && !!need && need.ownerUid === user.uid;
  const isClaimer =
    !!user && !!need?.claim && need.claim.uid === user.uid && !isClaimExpired(need);
  const isValidator = !!validator;
  const canSeeContact = isOwner || isClaimer || isValidator;

  // El contacto vive en un documento aparte; se pide solo cuando corresponde.
  useEffect(() => {
    if (!id || !canSeeContact) {
      setContact(null);
      return;
    }
    let alive = true;
    fetchContact(id).then((c) => {
      if (alive) setContact(c);
    });
    return () => {
      alive = false;
    };
  }, [id, canSeeContact, need?.status]);

  const run = useCallback(async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(
        e instanceof ClaimTakenError || e instanceof ClaimQuotaError
          ? e.message
          : "No se pudo completar la acción. Revisa la conexión.",
      );
    } finally {
      setBusy(false);
    }
  }, []);

  if (!id) return <NotFound message="Falta el identificador de la necesidad." />;
  if (loading) return <main className="shell">Cargando…</main>;
  if (!need) return <NotFound message="Esta necesidad ya no existe." />;

  const expired = isClaimExpired(need);
  const takenByOther =
    need.status === "comprometida" && !expired && !isClaimer;
  const delivered = need.status === "entregada";
  const closed = need.status === "resuelta" || need.status === "falsa";
  const canClaim =
    !closed && !delivered && !takenByOther && !isClaimer && !isOwner;
  const km = me && need.location ? distanceKm(me, need.location) : null;

  return (
    <main className="shell" id="main">
      <Link className="backlink" href="/ayudar/">
        ← Necesidades
      </Link>
      <ConnectionState />

      <section className="stack">
        <div className="row">
          <CategoryIcon category={need.category} size={36} />
          <span className="label">{CATEGORY_LABEL[need.category]}</span>
        </div>
        <h1 className="title" style={{ textTransform: "none" }}>
          {need.description}
        </h1>
        <StatusTags need={need} />
        <p className="meta">
          {need.peopleCount} {need.peopleCount === 1 ? "persona" : "personas"} ·
          publicada {formatAgo(need.createdAt)}
          {km !== null && ` · a ${formatDistance(km)}`}
        </p>
      </section>

      <hr className="hr" />

      <section className="stack" style={{ gap: 8 }}>
        <span className="label">Ubicación</span>
        <p>{need.reference || "Sin referencia escrita."}</p>
        {need.location && (
          <a
            className="btn btn--ghost"
            href={`https://www.google.com/maps/dir/?api=1&destination=${need.location.lat},${need.location.lng}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Abrir ruta en el mapa
          </a>
        )}
      </section>

      {need.verified && need.verifiedByName && (
        <p className="notice">
          Verificada en terreno por{" "}
          <span className="strong">{need.verifiedByName}</span>.
        </p>
      )}

      {takenByOther && need.claim && (
        <p className="notice notice--signal">
          {need.claim.name} se comprometió a cubrirla. Si no se concreta, vuelve
          a quedar disponible automáticamente.
        </p>
      )}

      {error && <p className="notice notice--error">{error}</p>}

      {canSeeContact && (
        <section className="stack" style={{ gap: 10 }}>
          <hr className="hr" />
          <span className="label">Contacto</span>
          {contact ? (
            <>
              <p className="strong" style={{ fontSize: 20 }}>
                {contact.name || "Sin nombre"} ·{" "}
                <span className="mono">{contact.phone}</span>
              </p>
              <div className="btn-row">
                <a className="btn btn--primary" href={`tel:${contact.phone}`}>
                  Llamar
                </a>
                <a
                  className="btn"
                  href={`https://wa.me/${contact.phone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  WhatsApp
                </a>
              </div>
            </>
          ) : (
            <p className="meta">Cargando contacto…</p>
          )}
        </section>
      )}

      <div className="spacer" />

      <section className="stack">
        {canClaim && (
          <>
            <div className="field">
              <label className="label" htmlFor="claim-name">
                Tu nombre (lo verá quien pidió ayuda)
              </label>
              <input
                id="claim-name"
                className="input"
                maxLength={60}
                value={claimName}
                placeholder="Ej: Carlos"
                onChange={(e) => setClaimName(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="btn btn--primary"
              disabled={busy || !user || claimName.trim().length < 2}
              onClick={() =>
                run(async () => {
                  await claimNeed(need.id, user!.uid, claimName, isValidator);
                  try {
                    const prev = JSON.parse(
                      localStorage.getItem(CONTACT_KEY) ?? "{}",
                    );
                    localStorage.setItem(
                      CONTACT_KEY,
                      JSON.stringify({ ...prev, name: claimName }),
                    );
                  } catch {
                    /* opcional */
                  }
                })
              }
            >
              {busy ? "Reservando…" : "Yo lo cubro"}
            </button>
            <p className="meta center">
              Queda bloqueada 3 horas para que nadie duplique el esfuerzo.
            </p>
          </>
        )}

        {isClaimer && !delivered && (
          <>
            <p className="notice notice--signal">
              Tú tienes esta necesidad comprometida. Coordina por teléfono y
              márcala como entregada cuando llegues.
            </p>
            <button
              type="button"
              className="btn btn--primary"
              disabled={busy}
              onClick={() => run(() => markDelivered(need.id))}
            >
              Ya la entregué
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              disabled={busy}
              onClick={() => run(() => releaseNeed(need.id))}
            >
              No puedo cubrirla, liberar
            </button>
          </>
        )}

        {isClaimer && delivered && (
          <p className="notice notice--signal">
            Registramos tu entrega. La necesidad se cierra cuando quien la pidió
            —o un validador— lo confirme. Nadie puede cerrarla por su cuenta:
            así una entrega que no ocurrió no borra el pedido.
          </p>
        )}

        {isOwner && !closed && (
          <>
            {delivered && (
              <p className="notice notice--signal">
                {need.claim?.name ?? "Un voluntario"} declaró haber entregado la
                ayuda. Confírmalo solo si la recibiste de verdad.
              </p>
            )}
            <button
              type="button"
              className={delivered ? "btn btn--primary" : "btn"}
              disabled={busy}
              onClick={() => run(() => resolveNeed(need.id))}
            >
              {delivered ? "Confirmo que la recibí" : "Ya recibí esta ayuda"}
            </button>
          </>
        )}

        {delivered && !isOwner && !isClaimer && !isValidator && (
          <p className="notice">
            Un voluntario declaró haber entregado esta ayuda. Sigue visible
            hasta que quien la pidió lo confirme.
          </p>
        )}

        {isValidator && (
          <>
            <hr className="hr" />
            <span className="label">Panel de validador · {validator!.name}</span>
            {!need.verified && (
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() =>
                  run(() => verifyNeed(need.id, validator!.name, user!.uid))
                }
              >
                Confirmar que es real
              </button>
            )}
            {delivered && (
              <button
                type="button"
                className="btn btn--primary"
                disabled={busy}
                onClick={() => run(() => resolveNeed(need.id))}
              >
                Confirmar la entrega y cerrar
              </button>
            )}
            {(need.status === "comprometida" || delivered) && (
              <button
                type="button"
                className="btn btn--ghost"
                disabled={busy}
                onClick={() => run(() => releaseNeed(need.id))}
              >
                {delivered
                  ? "La entrega no ocurrió, reabrir"
                  : "Liberar compromiso"}
              </button>
            )}
            {!closed && (
              <button
                type="button"
                className="btn btn--danger"
                disabled={busy}
                onClick={() => run(() => discardNeed(need.id))}
              >
                Descartar reporte
              </button>
            )}
            {need.claim && need.claim.uid !== user!.uid && (
              <button
                type="button"
                className="btn btn--danger"
                disabled={busy}
                onClick={() =>
                  run(() =>
                    blockUser(
                      need.claim!.uid,
                      user!.uid,
                      `Bloqueado desde la necesidad ${need.id}`,
                    ),
                  )
                }
              >
                Bloquear a quien la tomó
              </button>
            )}
          </>
        )}

        {closed && (
          <p className="empty">
            {need.status === "resuelta"
              ? "Esta necesidad está cerrada. Gracias a quien la cubrió."
              : "Este reporte fue descartado por un validador."}
          </p>
        )}

        {!isOwner && !closed && (
          <>
            <hr className="hr" />
            {flagged ? (
              <p className="meta center">
                Ya avisaste sobre esta necesidad. Un validador la revisará.
              </p>
            ) : !showFlagReasons ? (
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setShowFlagReasons(true)}
              >
                Algo no cuadra aquí
              </button>
            ) : (
              <div className="stack" style={{ gap: 8 }}>
                <span className="label">¿Qué pasa con esta necesidad?</span>
                {FLAG_REASONS.map((reason: FlagReason) => (
                  <button
                    key={reason}
                    type="button"
                    className="btn btn--ghost"
                    disabled={busy || !user}
                    onClick={() =>
                      run(() => flagNeed(need.id, user!.uid, reason))
                    }
                  >
                    {FLAG_LABEL[reason]}
                  </button>
                ))}
                <p className="meta center">
                  Quien fue al lugar y no encontró nada es la fuente más
                  confiable que tiene la plataforma.
                </p>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}

function NotFound({ message }: { message: string }) {
  return (
    <main className="shell" id="main">
      <Link className="backlink" href="/ayudar/">
        ← Necesidades
      </Link>
      <p className="empty">{message}</p>
    </main>
  );
}
