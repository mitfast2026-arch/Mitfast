import { createAdminClient } from '@/lib/supabase/admin';
import type { ServerResult } from '@/lib/server/auth/get-session';
import type { UserRole } from '@/types/database';
import {
  uploadProductImage,
  deleteProductImageFromStorage,
} from '@/lib/server/storage/storage-service';

export type ProductImageActor = {
  role: UserRole;
  supplierId?: string;
};

type ProductRow = {
  id: string;
  supplier_id: string | null;
};

async function getMaxProductImages(): Promise<number> {
  const adminClient = createAdminClient();
  const { data: settings } = await adminClient
    .from('business_settings')
    .select('max_product_images')
    .limit(1)
    .maybeSingle();
  return settings?.max_product_images ?? 8;
}

async function verifyProductAccess(
  productId: string,
  actor: ProductImageActor
): Promise<ServerResult<{ product: ProductRow }>> {
  const adminClient = createAdminClient();
  const { data: product, error } = await adminClient
    .from('products')
    .select('id, supplier_id')
    .eq('id', productId)
    .maybeSingle();

  if (error || !product) {
    return { success: false, error: { message: 'Product not found', code: 'NOT_FOUND' } };
  }

  if (actor.role === 'admin') {
    return { success: true, data: { product } };
  }

  if (actor.role === 'supplier') {
    if (!actor.supplierId || product.supplier_id !== actor.supplierId) {
      return { success: false, error: { message: 'Forbidden', code: 'FORBIDDEN' } };
    }
    return { success: true, data: { product } };
  }

  return { success: false, error: { message: 'Forbidden', code: 'FORBIDDEN' } };
}

async function clearPrimaryFlags(productId: string): Promise<void> {
  const adminClient = createAdminClient();
  await adminClient
    .from('product_images')
    .update({ is_primary: false })
    .eq('product_id', productId)
    .eq('is_primary', true);
}

async function promoteNextPrimary(productId: string): Promise<void> {
  const adminClient = createAdminClient();
  const { data: nextImage } = await adminClient
    .from('product_images')
    .select('id')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (nextImage) {
    await adminClient
      .from('product_images')
      .update({ is_primary: true })
      .eq('id', nextImage.id);
  }
}

export async function addProductImage(
  productId: string,
  input: {
    buffer: Buffer | Uint8Array;
    fileName: string;
    contentType: string;
    sortOrder?: number;
    isPrimary?: boolean;
  },
  actor: ProductImageActor
): Promise<ServerResult<{ imageId: string; imageUrl: string; storagePath: string }>> {
  try {
    const access = await verifyProductAccess(productId, actor);
    if (!access.success) return access;

    const { product } = access.data;
    const adminClient = createAdminClient();
    const maxImages = await getMaxProductImages();

    const { count: existingCount, error: countError } = await adminClient
      .from('product_images')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', productId);

    if (countError) {
      return { success: false, error: { message: countError.message, code: 'DATABASE_ERROR' } };
    }

    if ((existingCount ?? 0) >= maxImages) {
      return {
        success: false,
        error: { message: `Maximum ${maxImages} images allowed per product`, code: 'MAX_IMAGES' },
      };
    }

    const uploadResult = await uploadProductImage(
      product.supplier_id ?? 'internal',
      productId,
      input.fileName,
      input.buffer,
      input.contentType
    );

    if (!uploadResult.success) return uploadResult;

    const { publicUrl, storagePath } = uploadResult.data;
    const sortOrder = input.sortOrder ?? (existingCount ?? 0);
    const makePrimary = input.isPrimary ?? (existingCount ?? 0) === 0;

    if (makePrimary) {
      await clearPrimaryFlags(productId);
    }

    const { data: image, error: insertError } = await adminClient
      .from('product_images')
      .insert({
        product_id: productId,
        image_url: publicUrl,
        storage_path: storagePath,
        sort_order: sortOrder,
        is_primary: makePrimary,
      })
      .select('id')
      .single();

    if (insertError || !image) {
      await deleteProductImageFromStorage(storagePath);
      return {
        success: false,
        error: { message: insertError?.message || 'Failed to save image record', code: 'DATABASE_ERROR' },
      };
    }

    return {
      success: true,
      data: { imageId: image.id, imageUrl: publicUrl, storagePath },
    };
  } catch (error) {
    console.error('[addProductImage] Error:', error);
    return { success: false, error: { message: 'Failed to add product image', code: 'INTERNAL_ERROR' } };
  }
}

export async function deleteProductImage(
  productId: string,
  imageId: string,
  actor: ProductImageActor
): Promise<ServerResult<{ deleted: boolean }>> {
  try {
    const access = await verifyProductAccess(productId, actor);
    if (!access.success) return access;

    const adminClient = createAdminClient();
    const { data: image, error: fetchError } = await adminClient
      .from('product_images')
      .select('id, storage_path, is_primary')
      .eq('id', imageId)
      .eq('product_id', productId)
      .maybeSingle();

    if (fetchError || !image) {
      return { success: false, error: { message: 'Image not found', code: 'NOT_FOUND' } };
    }

    if (image.storage_path) {
      const storageResult = await deleteProductImageFromStorage(image.storage_path);
      if (!storageResult.success) return storageResult;
    }

    const { error: deleteError } = await adminClient
      .from('product_images')
      .delete()
      .eq('id', imageId);

    if (deleteError) {
      return { success: false, error: { message: deleteError.message, code: 'DATABASE_ERROR' } };
    }

    if (image.is_primary) {
      await promoteNextPrimary(productId);
    }

    return { success: true, data: { deleted: true } };
  } catch (error) {
    console.error('[deleteProductImage] Error:', error);
    return { success: false, error: { message: 'Failed to delete product image', code: 'INTERNAL_ERROR' } };
  }
}

export async function reorderProductImages(
  productId: string,
  orderedImageIds: string[],
  actor: ProductImageActor
): Promise<ServerResult<{ reordered: boolean }>> {
  try {
    const access = await verifyProductAccess(productId, actor);
    if (!access.success) return access;

    const adminClient = createAdminClient();
    const { data: existingImages, error: fetchError } = await adminClient
      .from('product_images')
      .select('id')
      .eq('product_id', productId);

    if (fetchError) {
      return { success: false, error: { message: fetchError.message, code: 'DATABASE_ERROR' } };
    }

    const existingIds = new Set((existingImages || []).map((img) => img.id));

    if (orderedImageIds.length !== existingIds.size) {
      return {
        success: false,
        error: { message: 'orderedImageIds must include every image for this product', code: 'VALIDATION_ERROR' },
      };
    }

    for (const id of orderedImageIds) {
      if (!existingIds.has(id)) {
        return {
          success: false,
          error: { message: 'One or more image IDs do not belong to this product', code: 'VALIDATION_ERROR' },
        };
      }
    }

    for (let idx = 0; idx < orderedImageIds.length; idx++) {
      const imageId = orderedImageIds[idx];
      const { error: updateError } = await adminClient
        .from('product_images')
        .update({
          sort_order: idx,
          is_primary: idx === 0,
        })
        .eq('id', imageId)
        .eq('product_id', productId);

      if (updateError) {
        return { success: false, error: { message: updateError.message, code: 'DATABASE_ERROR' } };
      }
    }

    return { success: true, data: { reordered: true } };
  } catch (error) {
    console.error('[reorderProductImages] Error:', error);
    return { success: false, error: { message: 'Failed to reorder product images', code: 'INTERNAL_ERROR' } };
  }
}
