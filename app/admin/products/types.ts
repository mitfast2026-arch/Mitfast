export type SpecRow = {
  id: string;
  spec_name: string;
  spec_value: string;
};

export type AdminProduct = {
  id: string;
  name: string;
  description?: string;
  category_id?: string;
  supplier_id?: string;
  sku?: string | null;
  stock_quantity?: number;
  moq?: number;
  supplier_price?: number;
  selling_price?: number;
  discount?: number;
  gst_rate?: number;
  gst_included?: boolean;
  profit_type?: string;
  profit_value?: number;
  min_order_value?: number | null;
  ribbon_label?: string | null;
  approval_status?: string;
  publication_status?: string;
  archive_status?: string;
  category?: { id: string; name: string };
  supplier?: {
    id: string;
    company_name?: string;
    country?: string;
    address?: string;
    contact_person?: string;
  };
  images?: { id?: string; image_url: string; sort_order?: number; is_primary?: boolean }[];
  specifications?: { id?: string; spec_name: string; spec_value: string; sort_order?: number }[];
};

export function getProductImageUrl(product: AdminProduct): string {
  const imgs = product.images || [];
  return (
    imgs.find((img) => img.is_primary)?.image_url ||
    [...imgs].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0]?.image_url ||
    ''
  );
}

export function parseImageUrls(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 8);
}

export function imagesToText(images: AdminProduct['images']): string {
  if (!images?.length) return '';
  return [...images]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((img) => img.image_url)
    .filter(Boolean)
    .join('\n');
}

export function specsToRows(specs: AdminProduct['specifications']): SpecRow[] {
  if (!specs?.length) return [];
  return [...specs]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((s, idx) => ({
      id: s.id || `spec-${idx}`,
      spec_name: s.spec_name,
      spec_value: s.spec_value,
    }));
}

export function rowsToSpecs(rows: SpecRow[]): { spec_name: string; spec_value: string; sort_order: number }[] {
  return rows
    .map((row, idx) => ({
      spec_name: row.spec_name.trim(),
      spec_value: row.spec_value.trim(),
      sort_order: idx,
    }))
    .filter((s) => s.spec_name && s.spec_value);
}

export function shortId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

export function computeListPrice(supplierPrice: number, profitPct: number): number {
  return Math.round((supplierPrice + supplierPrice * (profitPct / 100)) * 100) / 100;
}

export function computeCustomerPrice(listPrice: number, discount: number): number {
  return Math.max(0, Math.round((listPrice - discount) * 100) / 100);
}
