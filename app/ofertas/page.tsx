"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AvisoEstafa from "@/components/AvisoEstafa";
import CategoryIcon from "@/components/CategoryIcon";
import ConnectionState from "@/components/ConnectionState";
import FirebaseGate from "@/components/FirebaseGate";
import { useAuth } from "@/lib/auth";
import { distanceKm, formatAgo, formatDistance, getCurrentPosition } from "@/lib/geo";
import {
  closeOffer,
  OFFER_CATEGORIES,
  OFFER_CATEGORY_SUMMARY,
  offerLabel,
  discardOffer,
  subscribeToOffers,
  verifyOffer,
  type Offer,
} from "@/lib/offers";
import { CATEGORY_LABEL, type Category, type GeoPoint } from "@/lib/types";
import { zoneLabel } from "@/lib/zones";

export default function Page() {
  return (
    <FirebaseGate>
      <OfertasPage />
    </FirebaseGate>
  );
}

function OfertasPage() {
  const { user, validator } = useAuth();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<Category | "todas">("todas");
  const [me, setMe] = useState<GeoPoint | null>(null);

  useEffect(() => {
    if (!user) return;
    return subscribeToOffers(
      (list) => {
        setOffers(list);
        setLoading(false);
      },
      () => {
        setError("No se pudo cargar la lista. Revisa la conexión.");
        setLoading(false);
      },
    );
  }, [user]);

  useEffect(() => {
    getCurrentPosition(10000).then((r) => {
      if (r.ok) setMe(r.point);
    });
  }, []);

  const visible = useMemo(() => {
    return offers
      .filter((o) => category === "todas" || o.category === category)
      .map((o) => ({
        offer: o,
        km: me && o.location ? distanceKm(me, o.location) : null,
      }))
      .sort((a, b) => {
        // Verificadas primero: alguien fue y confirmó que existe.
        if (a.offer.verified !== b.offer.verified) return a.offer.verified ? -1 : 1;
        if (a.km !== null && b.km !== null) return a.km - b.km;
        if (a.km !== null) return -1;
        if (b.km !== null) return 1;
        return (b.offer.createdAt ?? 0) - (a.offer.createdAt ?? 0);
      });
  }, [offers, category, me]);

  return (
    <main className="shell" id="main">
      <Link className="backlink" href="/">
        ← Inicio
      </Link>

      <h1 className="title">Ayuda disponible</h1>
      <p className="subtitle">
        Lo que personas y organizaciones están ofreciendo ahora mismo.
      </p>

      <ConnectionState />
      <AvisoEstafa />

      <div className="chips" role="group" aria-label="Filtrar por tipo">
        <button
          type="button"
          className="chip"
          aria-pressed={category === "todas"}
          onClick={() => setCategory("todas")}
        >
          Todas
        </button>
        {OFFER_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            className="chip"
            aria-pressed={category === c}
            onClick={() => setCategory(c)}
          >
            {offerLabel(c, CATEGORY_LABEL[c])}
          </button>
        ))}
      </div>

      {error && <p className="notice notice--error">{error}</p>}

      {loading ? (
        <p className="empty">Cargando…</p>
      ) : visible.length === 0 ? (
        <p className="empty">
          {offers.length === 0
            ? "Todavía nadie ha publicado ofertas. Si tienes algo que dar, puedes ser el primero."
            : "No hay ofertas de este tipo. Prueba con “Todas”."}
        </p>
      ) : (
        <ul className="stack">
          {visible.map(({ offer, km }) => (
            <li key={offer.id}>
              <FichaOferta
                offer={offer}
                km={km}
                soyAutor={offer.ownerUid === user?.uid}
                validador={validator?.name ?? null}
              />
            </li>
          ))}
        </ul>
      )}

      <div className="spacer" />
      <hr className="hr" />
      {/* Quien mira esto necesita algo. Si no lo encuentra entre lo ofrecido,
          la salida no es irse: es pedirlo, que es para lo que existe la app. */}
      <p className="meta center">
        ¿No está lo que necesitas? Publícalo y alguien cerca lo verá.
      </p>
      <Link className="btn" href="/necesito/">
        Pedir lo que necesito
      </Link>
      <Link className="btn btn--ghost" href="/ofrezco/">
        Yo tengo algo que ofrecer
      </Link>
    </main>
  );
}

function FichaOferta({
  offer,
  km,
  soyAutor,
  validador,
}: {
  offer: Offer;
  km: number | null;
  soyAutor: boolean;
  validador: string | null;
}) {
  const zona = zoneLabel(offer.location);
  return (
    <div className="card stack" style={{ gap: 10 }}>
      <div className="row" style={{ alignItems: "flex-start" }}>
        <CategoryIcon category={offer.category} size={30} />
        <div className="grow stack" style={{ gap: 6 }}>
          <span className="label">{offerLabel(offer.category, CATEGORY_LABEL[offer.category])}</span>
          <span className="card__desc">{offer.description}</span>
          <span className="tags">
            {offer.verified && <span className="tag tag--solid">VERIFICADA</span>}
            {offer.amount && <span className="tag">{offer.amount}</span>}
          </span>
        </div>
      </div>

      <div className="meta row row--between" style={{ gap: 8 }}>
        <span className="grow">{offer.reference || "Sin punto de recogida"}</span>
        <span className="strong" style={{ whiteSpace: "nowrap" }}>
          {zona && <span className="tag tag--zone">{zona}</span>}
          {/* Las dos, igual que en las necesidades: una oferta de hace días
              puede estar agotada aunque nadie la haya cerrado. */}
          {typeof km === "number" && <>{formatDistance(km)} · </>}
          {formatAgo(offer.createdAt)}
        </span>
      </div>

      {/* De dónde salió, cuando vino de otra plataforma. Republicar sin decir
          la procedencia convierte un intercambio en una apropiación, y además
          le quita a quien lee la posibilidad de preguntarle a la fuente. */}
      {offer.sourceName && (
        <p className="meta">
          Publicado por <span className="strong">{offer.sourceName}</span>
        </p>
      )}

      {/* El teléfono es público a propósito: quien ofrece publicó para que lo
          llamen, y poner un peaje aquí sería cobrárselo a quien lo necesita. */}
      <a className="btn" href={`tel:${offer.contactPhone}`}>
        Llamar a {offer.contactName}
      </a>

      {offer.sourceUrl && (
        <a
          className="btn btn--ghost"
          href={offer.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Más información
        </a>
      )}

      {soyAutor && (
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => closeOffer(offer.id)}
        >
          Ya no tengo esto disponible
        </button>
      )}

      {validador && (
        <div className="btn-row">
          {!offer.verified && (
            <button
              type="button"
              className="btn"
              onClick={() => verifyOffer(offer.id, validador)}
            >
              Confirmar
            </button>
          )}
          <button
            type="button"
            className="btn btn--danger"
            onClick={() => discardOffer(offer.id)}
          >
            Descartar
          </button>
        </div>
      )}
    </div>
  );
}
