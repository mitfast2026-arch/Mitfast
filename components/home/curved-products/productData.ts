export interface CurvedProduct {
  id: string;
  category: string;
  title: string;
  specification: string;
  material: string;
  price: number;
  image: string;
  href: string;
  badge?: string;
}

/** Empty default — home carousel loads published products from the API. */
export const curvedProducts: CurvedProduct[] = [];

export function mapApiProductToCurved(p: {
  id: string;
  name: string;
  description?: string | null;
  selling_price?: number;
  discount?: number;
  ribbon_label?: string | null;
  category?: { name?: string } | null;
  images?: { image_url: string; is_primary?: boolean; sort_order?: number }[];
  specifications?: { spec_name: string; spec_value: string; sort_order?: number }[];
}): CurvedProduct {
  const sortedImages = [...(p.images || [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  );
  const imageUrl =
    sortedImages.find((img) => img.is_primary)?.image_url ||
    sortedImages[0]?.image_url ||
    '';

  const sortedSpecs = [...(p.specifications || [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  );
  const specification =
    sortedSpecs.length > 0
      ? `${sortedSpecs[0].spec_name}: ${sortedSpecs[0].spec_value}`
      : (p.description || '').trim().slice(0, 80);

  const selling = p.selling_price || 0;
  const discount = p.discount || 0;
  const price = Math.max(0, selling - discount);

  return {
    id: p.id,
    category: p.category?.name || 'Product',
    title: p.name,
    specification,
    material: '',
    price,
    image: imageUrl,
    href: `/products/${p.id}`,
    badge: p.ribbon_label || undefined,
  };
}
