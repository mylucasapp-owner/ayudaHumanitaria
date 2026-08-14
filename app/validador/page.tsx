"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ConnectionState from "@/components/ConnectionState";
import FirebaseGate from "@/components/FirebaseGate";
import NeedCard from "@/components/NeedCard";
import { authMessage, signInValidator, signOutValidator, useAuth } from "@/lib/auth";
import { subscribeToFlags, subscribeToOpenNeeds } from "@/lib/needs";
import {
  FLAG_LABEL,
  isClaimExpired,
  isStale,
  STALE_DAYS,
  type Flag,
  type Need,
} from "@/lib/types";

type Filter =
  | "denunciadas"
  | "por-confirmar"
  | "sin-verificar"
  | "vencidas"
  | "sin-noticias"
  | "pendientes";

const FILTER_LABEL: Record<Filter, string> = {
  denunciadas: "Denunciadas",
  "por-confirmar": "Entregas por confirmar",
  "sin-verificar": "Sin verificar",
  vencidas: "Compromisos vencidos",
  "sin-noticias": `Sin noticias +${STALE_DAYS} días`,
  pendientes: "Todas",
};

export default function Page() {
  return (
    <FirebaseGate>
      <ValidadorPage />
    </FirebaseGate>
  );
}

function ValidadorPage() {
  const { user, validator, loading } = useAuth();

  if (loading) return <main className="shell">Cargando…</main>;
  if (!validator) return <SignIn signedIn={!!user && !user.isAnonymous} />;
  return <Panel name={validator.name} zone={validator.zone} />;
}

function SignIn({ signedIn }: { signedIn: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signInValidator(email, password);
    } catch (err) {
      setError(authMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell" id="main">
      <Link className="backlink" href="/">
        ← Inicio
      </Link>
      <h1 className="title">Acceso validadores</h1>
      <p className="subtitle">
        Solo para coordinadores en terreno: ONG, bomberos y líderes
        comunitarios acreditados.
      </p>
      <ConnectionState />

      {signedIn && (
        <p className="notice notice--signal">
          Tu cuenta no está acreditada como validadora. Pide a la coordinación
          que te habilite.
        </p>
      )}

      <form className="stack" onSubmit={submit}>
        <div className="field">
          <label className="label" htmlFor="email">
            Correo
          </label>
          <input
            id="email"
            className="input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="password">
            Contraseña
          </label>
          <input
            id="password"
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p className="notice notice--error">{error}</p>}
        <button className="btn btn--primary" type="submit" disabled={busy}>
          {busy ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}

function Panel({ name, zone }: { name: string; zone: string }) {
  const [needs, setNeeds] = useState<Need[]>([]);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("denunciadas");

  useEffect(() => {
    const stopNeeds = subscribeToOpenNeeds(
      (list) => {
        setNeeds(list);
        setLoading(false);
      },
      () => {
        setError("No se pudo cargar el feed.");
        setLoading(false);
      },
    );
    const stopFlags = subscribeToFlags(setFlags, () =>
      setError(
        "No se pudieron cargar las denuncias. Puede faltar el índice de grupo.",
      ),
    );
    return () => {
      stopNeeds();
      stopFlags();
    };
  }, []);

  /** Denuncias agrupadas por necesidad: cuántas y por qué motivos. */
  const flagsByNeed = useMemo(() => {
    const map = new Map<string, Flag[]>();
    for (const f of flags) {
      map.set(f.needId, [...(map.get(f.needId) ?? []), f]);
    }
    return map;
  }, [flags]);

  const visible = useMemo(() => {
    switch (filter) {
      case "denunciadas":
        // Lo primero que debe mirar un validador: alguien fue y algo no cuadra.
        return needs
          .filter((n) => flagsByNeed.has(n.id))
          .sort(
            (a, b) =>
              (flagsByNeed.get(b.id)?.length ?? 0) -
              (flagsByNeed.get(a.id)?.length ?? 0),
          );
      case "por-confirmar":
        return needs.filter((n) => n.status === "entregada");
      case "sin-verificar":
        return needs.filter((n) => !n.verified);
      case "vencidas":
        // Compromisos caducados: alguien dijo que iba y no cerró el ciclo.
        return needs.filter((n) => n.status === "comprometida" && isClaimExpired(n));
      case "sin-noticias":
        // Abiertas que nadie ha tocado en más de una semana. Casi siempre se
        // resolvieron por fuera y nadie las cerró; basta una llamada para
        // saberlo. Las más viejas primero, que son las menos fiables.
        return needs
          .filter((n) => isStale(n))
          .sort((a, b) => (a.updatedAt ?? 0) - (b.updatedAt ?? 0));
      default:
        return needs;
    }
  }, [needs, filter, flagsByNeed]);

  const stats = useMemo(
    () => ({
      total: needs.length,
      denunciadas: needs.filter((n) => flagsByNeed.has(n.id)).length,
      porConfirmar: needs.filter((n) => n.status === "entregada").length,
      sinNoticias: needs.filter((n) => isStale(n)).length,
    }),
    [needs, flagsByNeed],
  );

  return (
    <main className="shell shell--wide" id="main">
      <header className="row row--between">
        <Link className="backlink" href="/">
          ← Inicio
        </Link>
        <button
          type="button"
          className="backlink"
          onClick={() => signOutValidator()}
        >
          Salir
        </button>
      </header>

      <div className="stack" style={{ gap: 4 }}>
        <h1 className="title">Panel de validación</h1>
        <p className="subtitle">
          {name} · zona {zone}
        </p>
      </div>

      <ConnectionState />
      {error && <p className="notice notice--error">{error}</p>}

      {/* Lo que más piden los damnificados no es una necesidad: es saber a
          dónde ir. Publicar esos puntos solo lo puede hacer un coordinador. */}
      <Link className="btn" href="/validador/puntos/">
        Publicar puntos a donde ir
      </Link>

      <div className="card">
        <div className="stats">
          <Stat label="Pendientes" value={stats.total} />
          <Stat label="Denunciadas" value={stats.denunciadas} />
          <Stat label="Por confirmar" value={stats.porConfirmar} />
          <Stat label="Sin noticias" value={stats.sinNoticias} />
        </div>
      </div>

      <div className="chips" role="group" aria-label="Filtrar">
        {(
          [
            "denunciadas",
            "por-confirmar",
            "sin-verificar",
            "sin-noticias",
            "vencidas",
            "pendientes",
          ] as Filter[]
        ).map((f) => (
          <button
            key={f}
            type="button"
            className="chip"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
          >
            {FILTER_LABEL[f]}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="empty">Cargando…</p>
      ) : visible.length === 0 ? (
        <p className="empty">Nada pendiente con este filtro.</p>
      ) : (
        <ul className="stack">
          {visible.map((n) => (
            <li key={n.id} className="stack" style={{ gap: 4 }}>
              <NeedCard need={n} href={`/necesidad/?id=${n.id}`} />
              {flagsByNeed.has(n.id) && (
                <p className="notice notice--signal" style={{ fontSize: 14 }}>
                  {flagsByNeed.get(n.id)!.length} denuncia
                  {flagsByNeed.get(n.id)!.length > 1 ? "s" : ""}:{" "}
                  {[
                    ...new Set(
                      flagsByNeed.get(n.id)!.map((f) => FLAG_LABEL[f.reason]),
                    ),
                  ].join(" · ")}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="meta center">
        Entra a cada ficha para confirmar, liberar o descartar. Verificar una
        necesidad la sube al principio de la lista de los oferentes.
      </p>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="center">
      <div className="strong" style={{ fontSize: 30 }}>
        {value}
      </div>
      <div className="label">{label}</div>
    </div>
  );
}
