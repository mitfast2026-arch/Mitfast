import { createAdminClient } from '@/lib/supabase/admin';
import type { ServerResult } from '@/lib/server/auth/get-session';
import type { UserRole } from '@/types/database';
import {
  uploadProductImage,
  deleteProductImageFromStorage,
} from '@/lib/server/storage/storage-service';
import { processImageForUpload } from '@/lib/server/storage/image-upload';

export type ProductImageActor = {
  role: UserRole;
  supplierId?: string;
};

type ProductRow = {
  id: string;
  supplier_id: string | null;
  approval_status?: string;
  publication_status?: string;
};

async function getMaxProductImages(): Promise<number> {
  const { getBusinessSettings } = await import('@/lib/server/settings/settings-service');
  const settingsRes = await getBusinessSettings();
  return settingsRes.success && settingsRes.data ? settingsRes.data.maxProductImages : 8;
}

async function verifyProductAccess(
  productId: string,
  actor: ProductImageActor
): Promise<ServerResult<{ product: ProductRow }>> {
  const adminClient = createAdminClient();
  const { data: product, error } = await adminClient
    .from('products')
    .select('id, supplier_id, approval_status, publication_status')
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
    if (product.publication_status === 'published') {
      const { data: openRequest } = await adminClient
        .from('product_approval_requests')
        .select('id')
        .eq('product_id', productId)
        .eq('status', 'update_pending')
        .maybeSingle();

      if (!openRequest) {
        return {
          success: false,
          error: {
            message:
              'Image changes on published products require an admin-approved update. Submit a product update request first.',
            code: 'PUBLISHED_PRODUCT_LOCKED',
          },
        };
      }
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

async function reserveImageSlot(
  productId: string,
  maxImages: number
): Promise<ServerResult<{ imageId: string | null; sortOrder: number }>> {
  const adminClient = createAdminClient();
  const { data, error } = await (adminClient as any).rpc('reserve_product_image_slot', {
    p_product_id: productId,
    p_max: maxImages,
  });

  // RETURNS TABLE → array of { image_id, sort_order }
  const row = Array.isArray(data) ? data[0] : data;
  if (!error && row && (row.image_id || row.sort_order !== undefined)) {
    return {
      success: true,
      data: {
        imageId: (row.image_id as string) || null,
        sortOrder: Number(row.sort_order ?? 0),
      },
    };
  }

  const { isRpcMissing, allowUnsafeDbFallback, databaseMisconfiguredError } = await import(
    '@/lib/server/db/production-guards'
  );
  const { mapRpcError } = await import('@/lib/server/db/rpc-errors');

  if (error && !isRpcMissing(error, 'reserve_product_image_slot')) {
    return { success: false, error: mapRpcError(error) };
  }

  if (!allowUnsafeDbFallback()) {
    return databaseMisconfiguredError('Product image upload');
  }

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

  return { success: true, data: { imageId: null, sortOrder: existingCount ?? 0 } };
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
  let reservedImageId: string | null = null;
  try {
    const access = await verifyProductAccess(productId, actor);
    if (!access.success) return access;

    const { product } = access.data;
    const adminClient = createAdminClient();
    const maxImages = await getMaxProductImages();

    // If product is published and supplier is updating, stage image URL into proposed_data without mutating live product_images
    if (actor.role === 'supplier' && product.publication_status === 'published') {
      const rawBuffer = Buffer.isBuffer(input.buffer) ? input.buffer : Buffer.from(input.buffer);
      const processed = await processImageForUpload(
        rawBuffer,
        input.fileName,
        input.contentType,
        'product'
      );
      if (!processed.success) return processed;

      const uploadResult = await uploadProductImage(
        product.supplier_id ?? 'internal',
        productId,
        processed.data.fileName,
        processed.data.buffer,
        processed.data.contentType
      );
      if (!uploadResult.success) return uploadResult;

      const { publicUrl, storagePath } = uploadResult.data;

      const { data: openRequest } = await adminClient
        .from('product_approval_requests')
        .select('id, proposed_data')
        .eq('product_id', productId)
        .eq('status', 'update_pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (openRequest) {
        const proposed = ((openRequest.proposed_data as Record<string, unknown>) || {}) as Record<string, unknown>;
        let currentUrls: string[] = Array.isArray(proposed.image_urls) ? [...(proposed.image_urls as string[])] : [];
        if (currentUrls.length === 0) {
          const { data: liveImages } = await adminClient
            .from('product_images')
            .select('image_url')
            .eq('product_id', productId)
            .neq('image_url', 'pending://reserve')
            .order('sort_order', { ascending: true });
          currentUrls = (liveImages || []).map((img) => img.image_url).filter(Boolean);
        }
        if (!currentUrls.includes(publicUrl)) {
          currentUrls.push(publicUrl);
        }
        await adminClient
          .from('product_approval_requests')
          .update({
            proposed_data: { ...proposed, image_urls: currentUrls.slice(0, maxImages) },
          })
          .eq('id', openRequest.id);

        return {
          success: true,
          data: {
            imageId: `proposed-${currentUrls.length - 1}`,
            imageUrl: publicUrl,
            storagePath,
          },
        };
      }

      return {
        success: true,
        data: {
          imageId: `staged-${Date.now()}`,
          imageUrl: publicUrl,
          storagePath,
        },
      };
    }

    const slot = await reserveImageSlot(productId, maxImages);
    if (!slot.success) return slot;
    reservedImageId = slot.data.imageId;

    const rawBuffer = Buffer.isBuffer(input.buffer) ? input.buffer : Buffer.from(input.buffer);
    const processed = await processImageForUpload(
      rawBuffer,
      input.fileName,
      input.contentType,
      'product'
    );
    if (!processed.success) {
      if (reservedImageId) {
        await adminClient.from('product_images').delete().eq('id', reservedImageId);
      }
      return processed;
    }

    const uploadResult = await uploadProductImage(
      product.supplier_id ?? 'internal',
      productId,
      processed.data.fileName,
      processed.data.buffer,
      processed.data.contentType
    );

    if (!uploadResult.success) {
      if (reservedImageId) {
        await adminClient.from('product_images').delete().eq('id', reservedImageId);
      }
      return uploadResult;
    }

    const { publicUrl, storagePath } = uploadResult.data;
    const sortOrder = input.sortOrder ?? slot.data.sortOrder;
    // Only claim primary when this is the first slot — avoids concurrent unique-index fights
    const makePrimary = (input.isPrimary ?? slot.data.sortOrder === 0) && slot.data.sortOrder === 0;

    if (reservedImageId) {
      // Finalize reserved row without primary first (safe under concurrency)
      const { data: image, error: updateError } = await adminClient
        .from('product_images')
        .update({
          image_url: publicUrl,
          storage_path: storagePath,
          sort_order: sortOrder,
          is_primary: false,
        })
        .eq('id', reservedImageId)
        .select('id')
        .single();

      if (updateError || !image) {
        await deleteProductImageFromStorage(storagePath);
        await adminClient.from('product_images').delete().eq('id', reservedImageId);
        return {
          success: false,
          error: {
            message: updateError?.message || 'Failed to save image record',
            code: 'DATABASE_ERROR',
          },
        };
      }

      if (makePrimary) {
        await clearPrimaryFlags(productId);
        const { error: primaryError } = await adminClient
          .from('product_images')
          .update({ is_primary: true })
          .eq('id', image.id);
        // Unique partial index race: another upload may have claimed primary — non-fatal
        if (primaryError) {
          const { isUniqueViolation } = await import('@/lib/server/db/rpc-errors');
          if (!isUniqueViolation(primaryError)) {
            console.warn('[addProductImage] primary flag update:', primaryError.message);
          }
        }
      } else {
        // Promote if no primary exists yet (first successful finalize after failed primary attempts)
        const { count } = await adminClient
          .from('product_images')
          .select('id', { count: 'exact', head: true })
          .eq('product_id', productId)
          .eq('is_primary', true);
        if ((count ?? 0) === 0) {
          await adminClient
            .from('product_images')
            .update({ is_primary: true })
            .eq('id', image.id);
        }
      }

      return {
        success: true,
        data: { imageId: image.id, imageUrl: publicUrl, storagePath },
      };
    }

    const { data: image, error: insertError } = await adminClient
      .from('product_images')
      .insert({
        product_id: productId,
        image_url: publicUrl,
        storage_path: storagePath,
        sort_order: sortOrder,
        is_primary: false,
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

    if (makePrimary) {
      await clearPrimaryFlags(productId);
      const { error: primaryError } = await adminClient
        .from('product_images')
        .update({ is_primary: true })
        .eq('id', image.id);
      if (primaryError) {
        const { isUniqueViolation } = await import('@/lib/server/db/rpc-errors');
        if (!isUniqueViolation(primaryError)) {
          console.warn('[addProductImage] primary flag update:', primaryError.message);
        }
      }
    } else {
      const { count } = await adminClient
        .from('product_images')
        .select('id', { count: 'exact', head: true })
        .eq('product_id', productId)
        .eq('is_primary', true);
      if ((count ?? 0) === 0) {
        await adminClient.from('product_images').update({ is_primary: true }).eq('id', image.id);
      }
    }

    return {
      success: true,
      data: { imageId: image.id, imageUrl: publicUrl, storagePath },
    };
  } catch (error) {
    console.error('[addProductImage] Error:', error);
    if (reservedImageId) {
      try {
        await createAdminClient().from('product_images').delete().eq('id', reservedImageId);
      } catch {
        /* best-effort */
      }
    }
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
    const { data: ok, error: rpcError } = await (adminClient as any).rpc(
      'reorder_product_images_atomic',
      {
        p_product_id: productId,
        p_ordered_ids: orderedImageIds,
      }
    );

    if (!rpcError && ok) {
      return { success: true, data: { reordered: true } };
    }

    const { isRpcMissing, allowUnsafeDbFallback, databaseMisconfiguredError } = await import(
      '@/lib/server/db/production-guards'
    );
    const { mapRpcError } = await import('@/lib/server/db/rpc-errors');

    if (rpcError && !isRpcMissing(rpcError, 'reorder_product_images_atomic')) {
      return { success: false, error: mapRpcError(rpcError) };
    }

    if (!allowUnsafeDbFallback()) {
      return databaseMisconfiguredError('Product image reorder');
    }

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
        error: {
          message: 'orderedImageIds must include every image for this product',
          code: 'VALIDATION_ERROR',
        },
      };
    }

    for (const id of orderedImageIds) {
      if (!existingIds.has(id)) {
        return {
          success: false,
          error: {
            message: 'One or more image IDs do not belong to this product',
            code: 'VALIDATION_ERROR',
          },
        };
      }
    }

    await clearPrimaryFlags(productId);

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
