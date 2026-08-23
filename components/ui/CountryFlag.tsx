import type { CountryOrigin } from "@/lib/country-origin";
import { flagImageSrcSet, flagImageUrl } from "@/lib/country-origin";

type CountryFlagProps = {
  origin: CountryOrigin | null;
  className?: string;
  imgClassName?: string;
  width?: number;
  height?: number;
};

/** Small flag badge for supplier manufacturing origin (from supplier profile country). */
export function CountryFlag({
  origin,
  className = "",
  imgClassName = "",
  width = 20,
  height = 15,
}: CountryFlagProps) {
  if (!origin) return null;

  const cdnWidth = width <= 20 ? 40 : 80;

  return (
    <span
      className={className}
      title={origin.label}
      aria-label={`Supplier country: ${origin.label}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- tiny CDN flag; emoji fails on Windows */}
      <img
        className={imgClassName}
        src={flagImageUrl(origin.code, cdnWidth)}
        srcSet={flagImageSrcSet(origin.code, cdnWidth)}
        width={width}
        height={height}
        alt=""
        loading="lazy"
        decoding="async"
      />
    </span>
  );
}
