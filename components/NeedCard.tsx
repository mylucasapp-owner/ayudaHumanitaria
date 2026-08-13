import Link from "next/link";
import CategoryIcon from "./CategoryIcon";
import StatusTags from "./StatusTags";
import { formatAgo, formatDistance } from "@/lib/geo";
import { CATEGORY_LABEL, type Need } from "@/lib/types";

export default function NeedCard({
  need,
  distanceKm,
  href,
}: {
  need: Need;
  distanceKm?: number | null;
  href?: string;
}) {
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
        <span className="strong" style={{ whiteSpace: "nowrap" }}>
          {typeof distanceKm === "number"
            ? formatDistance(distanceKm)
            : formatAgo(need.createdAt)}
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
