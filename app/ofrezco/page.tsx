"use client";

import Link from "next/link";
import { useState } from "react";
import AvisoEstafa from "@/components/AvisoEstafa";
import CategoryIcon from "@/components/CategoryIcon";
import ConnectionState from "@/components/ConnectionState";
import FirebaseGate from "@/components/FirebaseGate";
import { useAuth } from "@/lib/auth";
import { getCurrentPosition } from "@/lib/geo";
import {
  createOffer,
  MAX_OFFER_AMOUNT,
  MAX_OFFER_DESCRIPTION,
  MAX_OFFER_REFERENCE,
} from "@/lib/offers";
import {
  CATEGORIES,
  CATEGORY_LABEL,
  CATEGORY_SUMMARY,
  type Category,
  type GeoPoint,
} from "@/lib/types";
import { zoneFromText, zoneOf } from "@/lib/zones";

export default function Page() {
  return (
    <FirebaseGate>
      <OfrezcoPage />
    </FirebaseGate>
  );
}

function OfrezcoPage() {
  const { user } = useAuth();
  const [category, setCategory] = useState<Category | null>(null);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [point, setPoint] = useState<GeoPoint | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  const puedeEnviar =
    !!category &&
    description.trim().length >= 3 &&
    name.trim().length >= 2 &&
    phone.trim().length >= 6;

  async function publicar() {
    if (!category || !user || enviando) return;
    setEnviando(true);
    setError(null);
    try {
      await createOffer(user.uid, {
        category,
        description,
        reference,
        location: point,
        amount,
        contactName: name,
        contactPhone: phone,
        zone: (zoneOf(point) ?? zoneFromText(reference))?.id ?? "otra",
      });
      setListo(true);
    } catch {
      setError("No se pudo publicar. Revisa la conexión y vuelve a intentar.");
    } finally {
      setEnviando(false);
    }
  }

  if (listo) {
    return (
      <main className="shell stack" id="main">
        <div className="spacer" />
        <h1 className="title">Oferta publicada</h1>
        <p className="subtitle">
          Ya aparece para quien la necesite. Te van a llamar directamente al
          número que dejaste.
        </p>
        <p className="notice notice--signal">
          <span className="strong">Cuando se acabe, ciérrala.</span> Una oferta
          vieja que sigue publicada hace que alguien llame para nada, y en una
          emergencia eso es tiempo que no vuelve.
        </p>
        <Link className="btn btn--primary" href="/ofertas/">
          Ver las ofertas publicadas
        </Link>
        <Link className="btn btn--ghost" href="/">
          Volver al inicio
        </Link>
        <div className="spacer" />
      </main>
    );
  }

  return (
    <main className="shell" id="main">
      <Link className="backlink" href="/">
        ← Inicio
      </Link>

      <h1 className="title">Ofrezco ayuda</h1>
      <p className="subtitle">
        Lo que tengas y puedas dar: cosas, tiempo, un oficio, transporte.
      </p>

      <ConnectionState />

      {!category ? (
        <section className="stack">
          <p className="label">¿Qué puedes dar?</p>
          <div className="cats">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                className="cat"
                onClick={() => setCategory(c)}
              >
                <CategoryIcon category={c} />
                {CATEGORY_LABEL[c]}
                <span className="cat__hint">{CATEGORY_SUMMARY[c]}</span>
              </button>
            ))}
          </div>
        </section>
      ) : (
        <section className="stack">
          <h2 className="title">{CATEGORY_LABEL[category]}</h2>

          <div className="field">
            <label className="label" htmlFor="of-desc">
              ¿Qué ofreces? Una frase
            </label>
            <textarea
              id="of-desc"
              className="textarea"
              maxLength={MAX_OFFER_DESCRIPTION}
              value={description}
              autoFocus
              placeholder="Ej: cobijas nuevas para familias"
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="of-cant">
              ¿Cuánto? (opcional)
            </label>
            <input
              id="of-cant"
              className="input"
              maxLength={MAX_OFFER_AMOUNT}
              value={amount}
              placeholder="Ej: 200 unidades · un camión · sábados"
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="of-ref">
              ¿Dónde se recoge o desde dónde sale?
            </label>
            <input
              id="of-ref"
              className="input"
              maxLength={MAX_OFFER_REFERENCE}
              value={reference}
              placeholder="Ej: Bodega en Yumbo, Valle"
              onChange={(e) => setReference(e.target.value)}
            />
          </div>

          <button
            type="button"
            className="btn"
            onClick={async () => {
              const r = await getCurrentPosition();
              if (r.ok) setPoint(r.point);
            }}
          >
            {point ? "Ubicación tomada ✓" : "Marcar con mi ubicación actual"}
          </button>

          <div className="field">
            <label className="label" htmlFor="of-nombre">
              Tu nombre o el de tu organización
            </label>
            <input
              id="of-nombre"
              className="input"
              maxLength={60}
              value={name}
              placeholder="Ej: Carlos · Fundación X"
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="of-tel">
              Teléfono
            </label>
            <input
              id="of-tel"
              className="input"
              inputMode="tel"
              maxLength={25}
              value={phone}
              placeholder="Ej: 3001234567"
              onChange={(e) => setPhone(e.target.value)}
            />
            {/* Al revés que en una necesidad. Quien ofrece publica para que lo
                llamen, y quien lo necesita no debería tener que pedir permiso
                para hacerlo. Pero hay que decirlo antes, no después. */}
            <p className="meta">
              <span className="strong">Este número lo verá cualquiera.</span> Es
              así a propósito: quien necesite lo que ofreces tiene que poder
              llamarte sin intermediarios.
            </p>
          </div>

          {error && <p className="notice notice--error">{error}</p>}

          <button
            type="button"
            className="btn btn--primary"
            disabled={!puedeEnviar || enviando || !user}
            onClick={publicar}
          >
            {enviando ? "Publicando…" : "Publicar mi oferta"}
          </button>

          <AvisoEstafa />
        </section>
      )}
    </main>
  );
}
