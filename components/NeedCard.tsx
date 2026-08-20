import Link from "next/link";
import CategoryIcon from "./CategoryIcon";
import StatusTags from "./StatusTags";
import { formatAgo, formatDistance } from "@/lib/geo";
import { CATEGORY_LABEL, type Need } from "@/lib/types";
import { zoneLabel } from "@/lib/zones";

export default function NeedCard({
  need,
  distanceKm,
  href,
}: {
  need: Need;
  distanceKm?: number | null;
  href?: string;
}) {
  const zona = zoneLabel(need.location);

  const body = (
    <>
      <div className="row" style={{ alignItems: "flex-start" }}>
        <CategoryIcon category={need.category} size={30} />
        <div className="grow stack" style={{ gap: 8 }}>
          <div className="label">
            {CATEGORY_LABEL[need.category]}
            {need.peopleCount > 1 && ` · ${need.peopleCount} personas`}
          </div>
          <div className="card__desc">{need.description}</div>
          <StatusTags need={need} />
        </div>
      </div>
      <div
        className="meta row row--between"
        style={{ marginTop: 12, gap: 8 }}
      >
        <span className="grow">{need.reference || "Sin referencia escrita"}</span>
        {/* Distancia y antigüedad son dos cosas distintas —cuán lejos está y
            cuánto lleva esperando— y antes se mostraba una U otra según hubiera
            coordenadas. Eso hacía que ninguna se pudiera comparar entre fichas:
            en una lista mezclada, "193 km" y "hace 5 d" no se pueden sopesar.

            La antigüedad va siempre, porque siempre existe y es la que dice si
            vale la pena ir: algo de hace cinco días probablemente ya se
            resolvió por fuera. La distancia se suma cuando se sabe. */}
        <span className="strong" style={{ whiteSpace: "nowrap" }}>
          {/* La zona va primero porque sin ella una referencia como "Vereda La
              Suiza" no le dice nada a quien no es de allí, y el voluntario no
              puede saber si le queda cerca o a 250 km. */}
          {zona && <span className="tag tag--zone">{zona}</span>}
          {typeof distanceKm === "number" && (
            <>{formatDistance(distanceKm)} · </>
          )}
          {formatAgo(need.createdAt)}
        </span>
      </div>
    </>
  );

  const className = `card${need.verified ? " card--verified" : ""}`;

  return href ? (
    <Link className={className} href={href}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
