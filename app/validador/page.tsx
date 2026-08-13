"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ConnectionState from "@/components/ConnectionState";
import FirebaseGate from "@/components/FirebaseGate";
import NeedCard from "@/components/NeedCard";
import { authMessage, signInValidator, signOutValidator, useAuth } from "@/lib/auth";
import { subscribeToOpenNeeds } from "@/lib/needs";
import { isClaimExpired, type Need } from "@/lib/types";

type Filter = "pendientes" | "sin-verificar" | "vencidas";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("sin-verificar");

  useEffect(() => {
    return subscribeToOpenNeeds(
      (list) => {
        setNeeds(list);
        setLoading(false);
      },
      () => {
        setError("No se pudo cargar el feed.");
        setLoading(false);
      },
    );
  }, []);

  const visible = useMemo(() => {
    switch (filter) {
      case "sin-verificar":
        return needs.filter((n) => !n.verified);
      case "vencidas":
        // Compromisos caducados: alguien dijo que iba y no cerró el ciclo.
        return needs.filter((n) => n.status === "comprometida" && isClaimExpired(n));
      default:
        return needs;
    }
  }, [needs, filter]);

  const stats = useMemo(
    () => ({
      total: needs.length,
      verificadas: needs.filter((n) => n.verified).length,
      tomadas: needs.filter(
        (n) => n.status === "comprometida" && !isClaimExpired(n),
      ).length,
    }),
    [needs],
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

      <div className="card">
        <div className="row row--between">
          <Stat label="Pendientes" value={stats.total} />
          <Stat label="Verificadas" value={stats.verificadas} />
          <Stat label="Tomadas" value={stats.tomadas} />
        </div>
      </div>

      <div className="chips" role="group" aria-label="Filtrar">
        {(["sin-verificar", "vencidas", "pendientes"] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            className="chip"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
          >
            {f === "sin-verificar"
              ? "Sin verificar"
              : f === "vencidas"
                ? "Compromisos vencidos"
                : "Todas"}
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
            <li key={n.id}>
              <NeedCard need={n} href={`/necesidad/?id=${n.id}`} />
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
