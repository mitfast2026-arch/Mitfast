import { createAdminClient } from '@/lib/supabase/admin';
import type { ServerResult } from '@/lib/server/auth/get-session';
import {
  deleteFromBucket,
} from '@/lib/server/storage/storage-service';
import { processAndUploadBusinessAsset } from '@/lib/server/storage/image-upload';
import { deferRevalidateHomepage } from '@/lib/server/homepage/revalidate-homepage';

export const MAX_HERO_SLIDES = 6;
export const MAX_CAROUSEL_PRODUCTS = 12;
export const HOMEPAGE_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
export const HOMEPAGE_ALLOWED_MIME = new Set([
  'image/webp',
  'image/png',
  'image/jpeg',
  'image/jpg',
]);

export const DEFAULT_HERO_IMAGE = '/images/homepage_banner_1.png';
export const DEFAULT_CONTAINERS_IMAGE = '/images/container.png';

export type HeroSlide = {
  id: string;
  sortOrder: number;
  isActive: boolean;
  imageUrl: string;
  storagePath: string | null;
  eyebrow: string;
  title: string;
  subtitle: string;
  cta1Label: string;
  cta1Href: string;
  cta2Label: string;
  cta2Href: string;
};

export type HomepageAssets = {
  containersImageUrl: string | null;
  containersStoragePath: string | null;
};

export type CarouselProductOption = {
  id: string;
  name: string;
  categoryName: string | null;
  thumbnailUrl: string | null;
};

export type CarouselSlot = {
  id: string;
  productId: string;
  sortOrder: number;
  isActive: boolean;
  overrideImageUrl: string | null;
  overrideStoragePath: string | null;
  productName: string;
  categoryName: string | null;
  thumbnailUrl: string | null;
};

export type HomepageAdminBundle = {
  heroSlides: HeroSlide[];
  assets: HomepageAssets;
  carouselSlots: CarouselSlot[];
  productOptions: CarouselProductOption[];
};

export type PublicHeroSlide = {
  id: string;
  imageUrl: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  cta1Label: string;
  cta1Href: string;
  cta2Label: string;
  cta2Href: string;
};

export type PublicCarouselProduct = {
  id: string;
  name: string;
  description: string | null;
  selling_price: number;
  discount: number;
  ribbon_label: string | null;
  category: { name?: string } | null;
  images: { image_url: string; is_primary?: boolean; sort_order?: number }[];
  specifications: { spec_name: string; spec_value: string; sort_order?: number }[];
};

export type HomepagePublicBundle = {
  heroSlides: PublicHeroSlide[];
  containersImageUrl: string;
  carouselProducts: PublicCarouselProduct[];
};

function mapHeroSlide(row: {
  id: string;
  sort_order: number;
  is_active: boolean;
  image_url: string;
  storage_path: string | null;
  eyebrow: string;
  title: string;
  subtitle: string;
  cta1_label: string;
  cta1_href: string;
  cta2_label: string;
  cta2_href: string;
}): HeroSlide {
  return {
    id: row.id,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    imageUrl: row.image_url,
    storagePath: row.storage_path,
    eyebrow: row.eyebrow,
    title: row.title,
    subtitle: row.subtitle,
    cta1Label: row.cta1_label,
    cta1Href: row.cta1_href,
    cta2Label: row.cta2_label,
    cta2Href: row.cta2_href,
  };
}

export function validateHomepageImageFile(file: File): ServerResult<true> {
  const mime = (file.type || '').toLowerCase();
  if (!HOMEPAGE_ALLOWED_MIME.has(mime)) {
    return {
      success: false,
      error: {
        message: 'Only WebP, PNG, or JPEG images are allowed',
        code: 'VALIDATION_ERROR',
      },
    };
  }
  if (file.size > HOMEPAGE_IMAGE_MAX_BYTES) {
    return {
      success: false,
      error: {
        message: 'Image must be 2 MB or smaller',
        code: 'VALIDATION_ERROR',
      },
    };
  }
  return { success: true, data: true };
}

async function deleteHomepageAsset(storagePath: string | null | undefined) {
  if (!storagePath) return;
  // Skip static public paths
  if (storagePath.startsWith('/images/')) return;
  await deleteFromBucket('business-assets', storagePath);
}

async function loadPublishedProductOptions(): Promise<CarouselProductOption[]> {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from('products')
    .select(
      `
      id,
      name,
      category:categories(name),
      images:product_images(image_url, is_primary, sort_order)
    `
    )
    .eq('publication_status', 'published')
    .eq('archive_status', 'active')
    .eq('approval_status', 'approved')
    .order('name', { ascending: true })
    .order('is_primary', { ascending: false, foreignTable: 'product_images' })
    .order('sort_order', { ascending: true, foreignTable: 'product_images' })
    .limit(1, { foreignTable: 'product_images' });

  if (error || !data) return [];

  return data.map((p) => {
    const images = (p.images || []) as {
      image_url: string;
      is_primary?: boolean;
      sort_order?: number;
    }[];
    const sorted = [...images].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const thumb =
      sorted.find((img) => img.is_primary)?.image_url || sorted[0]?.image_url || null;
    const categoryRaw = p.category as { name?: string } | { name?: string }[] | null;
    const category = Array.isArray(categoryRaw) ? categoryRaw[0] : categoryRaw;
    return {
      id: p.id,
      name: p.name,
      categoryName: category?.name ?? null,
      thumbnailUrl: thumb,
    };
  });
}

export async function getHomepageAdminBundle(): Promise<ServerResult<HomepageAdminBundle>> {
  try {
    const adminClient = createAdminClient();

    const [slidesRes, assetsRes, slotsRes, productOptions] = await Promise.all([
      adminClient
        .from('homepage_hero_slides')
        .select(
          'id, sort_order, is_active, image_url, storage_path, eyebrow, title, subtitle, cta1_label, cta1_href, cta2_label, cta2_href'
        )
        .order('sort_order', { ascending: true }),
      adminClient
        .from('homepage_assets')
        .select('containers_image_url, containers_storage_path')
        .eq('id', 1)
        .maybeSingle(),
      adminClient
        .from('homepage_carousel_products')
        .select(
          `
          id,
          product_id,
          sort_order,
          is_active,
          override_image_url,
          override_storage_path,
          product:products(
            id,
            name,
            category:categories(name),
            images:product_images(image_url, is_primary, sort_order)
          )
        `
        )
        .order('sort_order', { ascending: true }),
      loadPublishedProductOptions(),
    ]);

    if (slidesRes.error) {
      return {
        success: false,
        error: { message: slidesRes.error.message, code: 'DB_ERROR' },
      };
    }

    const heroSlides = (slidesRes.data || []).map(mapHeroSlide);

    const assets: HomepageAssets = {
      containersImageUrl: assetsRes.data?.containers_image_url ?? null,
      containersStoragePath: assetsRes.data?.containers_storage_path ?? null,
    };

    const carouselSlots: CarouselSlot[] = (slotsRes.data || []).map((row) => {
      const productRaw = row.product as
        | {
            id: string;
            name: string;
            category: { name?: string } | { name?: string }[] | null;
            images: { image_url: string; is_primary?: boolean; sort_order?: number }[];
          }
        | {
            id: string;
            name: string;
            category: { name?: string } | { name?: string }[] | null;
            images: { image_url: string; is_primary?: boolean; sort_order?: number }[];
          }[]
        | null;
      const product = Array.isArray(productRaw) ? productRaw[0] : productRaw;
      const images = product?.images || [];
      const sorted = [...images].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      const thumb =
        row.override_image_url ||
        sorted.find((img) => img.is_primary)?.image_url ||
        sorted[0]?.image_url ||
        null;
      const categoryRaw = product?.category;
      const category = Array.isArray(categoryRaw) ? categoryRaw[0] : categoryRaw;
      return {
        id: row.id,
        productId: row.product_id,
        sortOrder: row.sort_order,
        isActive: row.is_active,
        overrideImageUrl: row.override_image_url,
        overrideStoragePath: row.override_storage_path,
        productName: product?.name || 'Unknown product',
        categoryName: category?.name ?? null,
        thumbnailUrl: thumb,
      };
    });

    return {
      success: true,
      data: {
        heroSlides,
        assets,
        carouselSlots,
        productOptions,
      },
    };
  } catch (error) {
    console.error('[getHomepageAdminBundle]', error);
    return {
      success: false,
      error: { message: 'Failed to load homepage CMS', code: 'INTERNAL_ERROR' },
    };
  }
}

export async function getHomepagePublicBundle(): Promise<ServerResult<HomepagePublicBundle>> {
  try {
    const adminClient = createAdminClient();

    const [slidesRes, assetsRes, slotsRes] = await Promise.all([
      adminClient
        .from('homepage_hero_slides')
        .select(
          'id, image_url, eyebrow, title, subtitle, cta1_label, cta1_href, cta2_label, cta2_href, sort_order'
        )
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
      adminClient
        .from('homepage_assets')
        .select('containers_image_url')
        .eq('id', 1)
        .maybeSingle(),
      adminClient
        .from('homepage_carousel_products')
        .select('product_id, sort_order, override_image_url')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .limit(MAX_CAROUSEL_PRODUCTS),
    ]);

    let heroSlides: PublicHeroSlide[] = (slidesRes.data || []).map((s) => ({
      id: s.id,
      imageUrl: s.image_url,
      eyebrow: s.eyebrow,
      title: s.title,
      subtitle: s.subtitle,
      cta1Label: s.cta1_label,
      cta1Href: s.cta1_href,
      cta2Label: s.cta2_label,
      cta2Href: s.cta2_href,
    }));

    if (heroSlides.length === 0) {
      heroSlides = [
        {
          id: 'fallback',
          imageUrl: DEFAULT_HERO_IMAGE,
          eyebrow: 'B2B SOURCING. FACTORY-DIRECT PRICING.',
          title: 'B2B Procurement.\nMade Simple.',
          subtitle:
            'Buy precision components, request quotes, and place orders from verified suppliers — all in one B2B marketplace.',
          cta1Label: 'Explore Services',
          cta1Href: '/#services',
          cta2Label: 'Get a Quote',
          cta2Href: '/enquiry',
        },
      ];
    }

    const containersImageUrl =
      assetsRes.data?.containers_image_url || DEFAULT_CONTAINERS_IMAGE;

    const slotRows = slotsRes.data || [];
    let carouselProducts: PublicCarouselProduct[] = [];

    if (slotRows.length > 0) {
      const productIds = slotRows.map((s) => s.product_id);
      const { data: products } = await adminClient
        .from('products')
        .select(
          `
          id,
          name,
          description,
          selling_price,
          discount,
          ribbon_label,
          category:categories(name),
          images:product_images(image_url, is_primary, sort_order),
          specifications:product_specifications(spec_name, spec_value, sort_order)
        `
        )
        .in('id', productIds)
        .eq('publication_status', 'published')
        .eq('archive_status', 'active')
        .eq('approval_status', 'approved');

      const byId = new Map((products || []).map((p) => [p.id, p]));
      const hydrated: PublicCarouselProduct[] = [];
      for (const slot of slotRows) {
        const p = byId.get(slot.product_id);
        if (!p) continue;
        const images = [...(p.images || [])]
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .map((img) => ({
            image_url: img.image_url,
            is_primary: Boolean(img.is_primary),
            sort_order: img.sort_order ?? 0,
          }));
        const override = slot.override_image_url;
        const mappedImages = override
          ? [{ image_url: override, is_primary: true, sort_order: 0 }, ...images]
          : images;
        const categoryRaw = p.category as { name?: string } | { name?: string }[] | null;
        const category = Array.isArray(categoryRaw)
          ? categoryRaw[0] ?? null
          : categoryRaw;
        hydrated.push({
          id: p.id,
          name: p.name,
          description: p.description,
          selling_price: Number(p.selling_price) || 0,
          discount: Number(p.discount) || 0,
          ribbon_label: p.ribbon_label,
          category,
          images: mappedImages,
          specifications: ((p.specifications || []) as {
            spec_name: string;
            spec_value: string;
            sort_order?: number;
          }[]).map((s) => ({
            spec_name: s.spec_name,
            spec_value: s.spec_value,
            sort_order: s.sort_order,
          })),
        });
      }
      carouselProducts = hydrated;
    }

    return {
      success: true,
      data: {
        heroSlides,
        containersImageUrl,
        carouselProducts,
      },
    };
  } catch (error) {
    console.error('[getHomepagePublicBundle]', error);
    return {
      success: false,
      error: { message: 'Failed to load homepage content', code: 'INTERNAL_ERROR' },
    };
  }
}

export type HeroSlideInput = {
  id?: string;
  sortOrder: number;
  isActive: boolean;
  imageUrl: string;
  storagePath?: string | null;
  eyebrow: string;
  title: string;
  subtitle: string;
  cta1Label: string;
  cta1Href: string;
  cta2Label: string;
  cta2Href: string;
};

export async function saveHeroSlides(
  slides: HeroSlideInput[]
): Promise<ServerResult<{ heroSlides: HeroSlide[] }>> {
  try {
    if (slides.length > MAX_HERO_SLIDES) {
      return {
        success: false,
        error: {
          message: `Maximum ${MAX_HERO_SLIDES} hero slides allowed`,
          code: 'VALIDATION_ERROR',
        },
      };
    }

    for (const s of slides) {
      if (!s.imageUrl?.trim()) {
        return {
          success: false,
          error: { message: 'Each slide needs an image', code: 'VALIDATION_ERROR' },
        };
      }
      if (!s.title?.trim()) {
        return {
          success: false,
          error: { message: 'Each slide needs a title', code: 'VALIDATION_ERROR' },
        };
      }
    }

    const adminClient = createAdminClient();
    const { data: existing } = await adminClient
      .from('homepage_hero_slides')
      .select('id, storage_path');

    const keepIds = new Set(slides.filter((s) => s.id).map((s) => s.id as string));
    const toDelete = (existing || []).filter((row) => !keepIds.has(row.id));

    for (const row of toDelete) {
      await deleteHomepageAsset(row.storage_path);
      await adminClient.from('homepage_hero_slides').delete().eq('id', row.id);
    }

    for (const s of slides) {
      const payload = {
        sort_order: s.sortOrder,
        is_active: s.isActive,
        image_url: s.imageUrl.trim(),
        storage_path: s.storagePath ?? null,
        eyebrow: s.eyebrow?.trim() || '',
        title: s.title.trim(),
        subtitle: s.subtitle?.trim() || '',
        cta1_label: s.cta1Label?.trim() || '',
        cta1_href: s.cta1Href?.trim() || '',
        cta2_label: s.cta2Label?.trim() || '',
        cta2_href: s.cta2Href?.trim() || '',
      };

      if (s.id) {
        const { error } = await adminClient
          .from('homepage_hero_slides')
          .update(payload)
          .eq('id', s.id);
        if (error) {
          return {
            success: false,
            error: { message: error.message, code: 'DB_ERROR' },
          };
        }
      } else {
        const { error } = await adminClient.from('homepage_hero_slides').insert(payload);
        if (error) {
          return {
            success: false,
            error: { message: error.message, code: 'DB_ERROR' },
          };
        }
      }
    }

    deferRevalidateHomepage();
    const bundle = await getHomepageAdminBundle();
    if (!bundle.success) return bundle;
    return { success: true, data: { heroSlides: bundle.data.heroSlides } };
  } catch (error) {
    console.error('[saveHeroSlides]', error);
    return {
      success: false,
      error: { message: 'Failed to save hero slides', code: 'INTERNAL_ERROR' },
    };
  }
}

export async function deleteHeroSlide(
  slideId: string
): Promise<ServerResult<{ deleted: boolean }>> {
  try {
    const adminClient = createAdminClient();
    const { data: row } = await adminClient
      .from('homepage_hero_slides')
      .select('id, storage_path')
      .eq('id', slideId)
      .maybeSingle();

    if (!row) {
      return { success: false, error: { message: 'Slide not found', code: 'NOT_FOUND' } };
    }

    await deleteHomepageAsset(row.storage_path);
    const { error } = await adminClient.from('homepage_hero_slides').delete().eq('id', slideId);
    if (error) {
      return { success: false, error: { message: error.message, code: 'DB_ERROR' } };
    }

    deferRevalidateHomepage();
    return { success: true, data: { deleted: true } };
  } catch (error) {
    console.error('[deleteHeroSlide]', error);
    return {
      success: false,
      error: { message: 'Failed to delete slide', code: 'INTERNAL_ERROR' },
    };
  }
}

export async function uploadHeroSlideImage(
  slideId: string | null,
  file: File
): Promise<ServerResult<{ url: string; storagePath: string; slideId: string | null }>> {
  const valid = validateHomepageImageFile(file);
  if (!valid.success) return valid;

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const uploaded = await processAndUploadBusinessAsset(
      'homepage/hero',
      'hero',
      buffer,
      file.name || 'hero.webp',
      file.type || 'image/webp'
    );
    if (!uploaded.success) return uploaded;

    const adminClient = createAdminClient();

    if (slideId) {
      const { data: existing } = await adminClient
        .from('homepage_hero_slides')
        .select('storage_path')
        .eq('id', slideId)
        .maybeSingle();

      const { error } = await adminClient
        .from('homepage_hero_slides')
        .update({
          image_url: uploaded.data.publicUrl,
          storage_path: uploaded.data.storagePath,
        })
        .eq('id', slideId);

      if (error) {
        return { success: false, error: { message: error.message, code: 'DB_ERROR' } };
      }

      if (existing?.storage_path && existing.storage_path !== uploaded.data.storagePath) {
        await deleteHomepageAsset(existing.storage_path);
      }

      deferRevalidateHomepage();
    }

    return {
      success: true,
      data: {
        url: uploaded.data.publicUrl,
        storagePath: uploaded.data.storagePath,
        slideId,
      },
    };
  } catch (error) {
    console.error('[uploadHeroSlideImage]', error);
    return {
      success: false,
      error: { message: 'Failed to upload hero image', code: 'INTERNAL_ERROR' },
    };
  }
}

export async function uploadContainersImage(
  file: File
): Promise<ServerResult<{ url: string; storagePath: string }>> {
  const valid = validateHomepageImageFile(file);
  if (!valid.success) return valid;

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const uploaded = await processAndUploadBusinessAsset(
      'homepage/containers',
      'containers',
      buffer,
      file.name || 'containers.webp',
      file.type || 'image/webp'
    );
    if (!uploaded.success) return uploaded;

    const adminClient = createAdminClient();
    const { data: existing } = await adminClient
      .from('homepage_assets')
      .select('containers_storage_path')
      .eq('id', 1)
      .maybeSingle();

    const { error } = await adminClient.from('homepage_assets').upsert({
      id: 1,
      containers_image_url: uploaded.data.publicUrl,
      containers_storage_path: uploaded.data.storagePath,
    });

    if (error) {
      return { success: false, error: { message: error.message, code: 'DB_ERROR' } };
    }

    if (
      existing?.containers_storage_path &&
      existing.containers_storage_path !== uploaded.data.storagePath
    ) {
      await deleteHomepageAsset(existing.containers_storage_path);
    }

    deferRevalidateHomepage();
    return {
      success: true,
      data: { url: uploaded.data.publicUrl, storagePath: uploaded.data.storagePath },
    };
  } catch (error) {
    console.error('[uploadContainersImage]', error);
    return {
      success: false,
      error: { message: 'Failed to upload containers image', code: 'INTERNAL_ERROR' },
    };
  }
}

export async function resetContainersImage(): Promise<
  ServerResult<{ url: string }>
> {
  try {
    const adminClient = createAdminClient();
    const { data: existing } = await adminClient
      .from('homepage_assets')
      .select('containers_storage_path')
      .eq('id', 1)
      .maybeSingle();

    const { error } = await adminClient.from('homepage_assets').upsert({
      id: 1,
      containers_image_url: DEFAULT_CONTAINERS_IMAGE,
      containers_storage_path: null,
    });

    if (error) {
      return { success: false, error: { message: error.message, code: 'DB_ERROR' } };
    }

    await deleteHomepageAsset(existing?.containers_storage_path);
    deferRevalidateHomepage();
    return { success: true, data: { url: DEFAULT_CONTAINERS_IMAGE } };
  } catch (error) {
    console.error('[resetContainersImage]', error);
    return {
      success: false,
      error: { message: 'Failed to reset containers image', code: 'INTERNAL_ERROR' },
    };
  }
}

export type CarouselSlotInput = {
  id?: string;
  productId: string;
  sortOrder: number;
  isActive: boolean;
  overrideImageUrl?: string | null;
  overrideStoragePath?: string | null;
};

export async function saveCarouselSlots(
  slots: CarouselSlotInput[]
): Promise<ServerResult<{ carouselSlots: CarouselSlot[] }>> {
  try {
    if (slots.length > MAX_CAROUSEL_PRODUCTS) {
      return {
        success: false,
        error: {
          message: `Maximum ${MAX_CAROUSEL_PRODUCTS} carousel products allowed`,
          code: 'VALIDATION_ERROR',
        },
      };
    }

    const productIds = slots.map((s) => s.productId).filter(Boolean);
    if (productIds.length !== new Set(productIds).size) {
      return {
        success: false,
        error: {
          message: 'Each product can only appear once in the carousel',
          code: 'VALIDATION_ERROR',
        },
      };
    }

    for (const s of slots) {
      if (!s.productId) {
        return {
          success: false,
          error: {
            message: 'Select a product for every carousel slot',
            code: 'VALIDATION_ERROR',
          },
        };
      }
    }

    const adminClient = createAdminClient();

    if (productIds.length > 0) {
      const { data: published, error: pubErr } = await adminClient
        .from('products')
        .select('id')
        .in('id', productIds)
        .eq('publication_status', 'published')
        .eq('archive_status', 'active')
        .eq('approval_status', 'approved');

      if (pubErr) {
        return { success: false, error: { message: pubErr.message, code: 'DB_ERROR' } };
      }
      if ((published || []).length !== productIds.length) {
        return {
          success: false,
          error: {
            message: 'All carousel products must be published and approved',
            code: 'VALIDATION_ERROR',
          },
        };
      }
    }

    const { data: existing } = await adminClient
      .from('homepage_carousel_products')
      .select('id, override_storage_path, override_image_url, product_id');

    const keepIds = new Set(slots.filter((s) => s.id).map((s) => s.id as string));
    const existingById = new Map((existing || []).map((row) => [row.id, row]));

    // Replace-all avoids unique(product_id) conflicts when swapping dropdown selections
    const { error: clearErr } = await adminClient
      .from('homepage_carousel_products')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (clearErr) {
      return { success: false, error: { message: clearErr.message, code: 'DB_ERROR' } };
    }

    for (const row of existing || []) {
      if (!keepIds.has(row.id)) {
        await deleteHomepageAsset(row.override_storage_path);
      }
    }

    if (slots.length > 0) {
      const rows = slots.map((s) => {
        const prev = s.id ? existingById.get(s.id) : undefined;
        return {
          product_id: s.productId,
          sort_order: s.sortOrder,
          is_active: s.isActive,
          override_image_url:
            s.overrideImageUrl !== undefined
              ? s.overrideImageUrl
              : prev?.override_image_url ?? null,
          override_storage_path:
            s.overrideStoragePath !== undefined
              ? s.overrideStoragePath
              : prev?.override_storage_path ?? null,
        };
      });

      const { error } = await adminClient.from('homepage_carousel_products').insert(rows);
      if (error) {
        return { success: false, error: { message: error.message, code: 'DB_ERROR' } };
      }
    }

    deferRevalidateHomepage();
    const bundle = await getHomepageAdminBundle();
    if (!bundle.success) return bundle;
    return { success: true, data: { carouselSlots: bundle.data.carouselSlots } };
  } catch (error) {
    console.error('[saveCarouselSlots]', error);
    return {
      success: false,
      error: { message: 'Failed to save carousel products', code: 'INTERNAL_ERROR' },
    };
  }
}

export async function uploadCarouselOverrideImage(
  slotId: string,
  file: File
): Promise<ServerResult<{ url: string; storagePath: string }>> {
  const valid = validateHomepageImageFile(file);
  if (!valid.success) return valid;

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const uploaded = await processAndUploadBusinessAsset(
      'homepage/products',
      'carousel',
      buffer,
      file.name || 'product.webp',
      file.type || 'image/webp'
    );
    if (!uploaded.success) return uploaded;

    const adminClient = createAdminClient();
    const { data: existing } = await adminClient
      .from('homepage_carousel_products')
      .select('override_storage_path')
      .eq('id', slotId)
      .maybeSingle();

    if (!existing) {
      return { success: false, error: { message: 'Carousel slot not found', code: 'NOT_FOUND' } };
    }

    const { error } = await adminClient
      .from('homepage_carousel_products')
      .update({
        override_image_url: uploaded.data.publicUrl,
        override_storage_path: uploaded.data.storagePath,
      })
      .eq('id', slotId);

    if (error) {
      return { success: false, error: { message: error.message, code: 'DB_ERROR' } };
    }

    if (
      existing.override_storage_path &&
      existing.override_storage_path !== uploaded.data.storagePath
    ) {
      await deleteHomepageAsset(existing.override_storage_path);
    }

    deferRevalidateHomepage();
    return {
      success: true,
      data: { url: uploaded.data.publicUrl, storagePath: uploaded.data.storagePath },
    };
  } catch (error) {
    console.error('[uploadCarouselOverrideImage]', error);
    return {
      success: false,
      error: { message: 'Failed to upload override image', code: 'INTERNAL_ERROR' },
    };
  }
}
