import { formatCountdown } from "@/lib/geo";
import { isClaimExpired, STATUS_LABEL, type Need } from "@/lib/types";

/** Traduce el estado real de una necesidad en etiquetas legibles de un vistazo. */
export default function StatusTags({ need }: { need: Need }) {
  const expired = isClaimExpired(need);
  return (
    <span className="tags">
      {need.verified && <span className="tag tag--solid">VERIFICADA</span>}

      {need.status === "abierta" && <span className="tag">ABIERTA</span>}

      {need.status === "comprometida" &&
        (expired ? (
          <span className="tag tag--dim">COMPROMISO VENCIDO</span>
        ) : (
          <span className="tag tag--signal">
            TOMADA · {formatCountdown(need.claim!.expiresAt)}
          </span>
        ))}

      {need.status === "entregada" && (
        <span className="tag tag--signal">{STATUS_LABEL.entregada}</span>
      )}

      {need.status === "resuelta" && (
        <span className="tag tag--dim">{STATUS_LABEL.resuelta}</span>
      )}

      {need.status === "falsa" && (
        <span className="tag tag--danger">{STATUS_LABEL.falsa}</span>
      )}
    </span>
  );
}
