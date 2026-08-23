export type CountryOrigin = { code: string; label: string };

type CountryMatch = {
  code: string;
  label: string;
  aliases: string[];
};

/** Common manufacturing origins — matches supplier profile free-text country field. */
const COUNTRY_MATCHES: CountryMatch[] = [
  { code: "IN", label: "India", aliases: ["in", "ind", "india", "indian"] },
  { code: "CN", label: "China", aliases: ["cn", "chn", "china", "chinese", "prc"] },
  { code: "DE", label: "Germany", aliases: ["de", "deu", "germany", "german"] },
  { code: "US", label: "United States", aliases: ["us", "usa", "united states", "american"] },
  { code: "JP", label: "Japan", aliases: ["jp", "jpn", "japan", "japanese"] },
  { code: "KR", label: "South Korea", aliases: ["kr", "kor", "korea", "south korea", "korean"] },
  { code: "TW", label: "Taiwan", aliases: ["tw", "twn", "taiwan"] },
  { code: "GB", label: "United Kingdom", aliases: ["gb", "gbr", "uk", "united kingdom", "britain", "england"] },
  { code: "VN", label: "Vietnam", aliases: ["vn", "vnm", "vietnam"] },
  { code: "TH", label: "Thailand", aliases: ["th", "tha", "thailand"] },
  { code: "IT", label: "Italy", aliases: ["it", "ita", "italy", "italian"] },
  { code: "FR", label: "France", aliases: ["fr", "fra", "france", "french"] },
  { code: "MX", label: "Mexico", aliases: ["mx", "mex", "mexico"] },
  { code: "BR", label: "Brazil", aliases: ["br", "bra", "brazil"] },
  { code: "AE", label: "United Arab Emirates", aliases: ["ae", "are", "uae", "united arab emirates"] },
  { code: "SG", label: "Singapore", aliases: ["sg", "sgp", "singapore"] },
  { code: "MY", label: "Malaysia", aliases: ["my", "mys", "malaysia"] },
  { code: "ID", label: "Indonesia", aliases: ["id", "idn", "indonesia"] },
  { code: "PL", label: "Poland", aliases: ["pl", "pol", "poland"] },
  { code: "TR", label: "Turkey", aliases: ["tr", "tur", "turkey", "türkiye"] },
];

const ALIAS_TO_COUNTRY = new Map<string, CountryMatch>();
for (const entry of COUNTRY_MATCHES) {
  for (const alias of entry.aliases) {
    ALIAS_TO_COUNTRY.set(alias, entry);
  }
}

function normalizeCountryInput(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function matchCountryToken(token: string): CountryOrigin | null {
  const normalized = normalizeCountryInput(token);
  if (!normalized) return null;

  const exact = ALIAS_TO_COUNTRY.get(normalized);
  if (exact) {
    return { code: exact.code, label: exact.label };
  }

  if (/^[a-z]{2}$/.test(normalized)) {
    const iso = COUNTRY_MATCHES.find(
      (entry) => entry.code.toLowerCase() === normalized,
    );
    if (iso) {
      return { code: iso.code, label: iso.label };
    }
  }

  return null;
}

/** Resolve supplier profile country (and optional address hint) to ISO flag code. */
export function resolveSupplierCountry(input: {
  country?: string | null;
  address?: string | null;
  supplier_country?: string | null;
  supplier?: { country?: string | null; address?: string | null } | null;
}): CountryOrigin | null {
  const countryField = normalizeCountryInput(
    input.supplier_country ?? input.country ?? input.supplier?.country,
  );
  const addressField = normalizeCountryInput(
    input.address ?? input.supplier?.address,
  );

  const fromCountry = matchCountryToken(countryField);
  if (fromCountry) return fromCountry;

  if (!countryField && !addressField) return null;

  const raw = [countryField, addressField].filter(Boolean).join(" ");
  for (const entry of COUNTRY_MATCHES) {
    const pattern = new RegExp(
      `\\b(${entry.aliases.map((a) => a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`,
    );
    if (pattern.test(raw)) {
      return { code: entry.code, label: entry.label };
    }
  }

  return null;
}

/** Dropdown options for supplier location fields in admin panels. */
export function getCountryOptions(): CountryOrigin[] {
  return COUNTRY_MATCHES.map(({ code, label }) => ({ code, label }));
}

/** Match a stored country string to a known option label, or null if custom. */
export function matchCountryLabel(country: string | null | undefined): string | null {
  const resolved = resolveSupplierCountry({ country });
  return resolved?.label ?? null;
}

export function flagImageUrl(code: string, width = 40): string {
  return `https://flagcdn.com/w${width}/${code.toLowerCase()}.png`;
}

export function flagImageSrcSet(code: string, width = 40): string {
  return `${flagImageUrl(code, width * 2)} 2x`;
}
