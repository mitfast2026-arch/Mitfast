import { createAdminClient } from '@/lib/supabase/admin';
import { calculatePricing } from '@/lib/server/pricing/calculate-price';
import { getBusinessSettings } from '@/lib/server/settings/settings-service';
import {
  deleteProductImageFromStorage,
  storagePathFromPublicUrl,
} from '@/lib/server/storage/storage-service';
import {
  normalizeStorefrontSupplier,
  incrementProductView,
  getStorefrontProductDetail,
} from '@/lib/server/products/storefront-detail';
import {
  sanitizeIlikePattern,
  sanitizePostgrestSearch,
} from '@/lib/server/db/sanitize-search';
import {
  createProductSchema,
  createProductByAdminSchema,
  saveProductDraftSchema,
  updateProductBySupplierSchema,
  adminUpdateProductSchema,
  rejectProductSchema,
  requestChangesSchema,
} from '@/lib/validation/product.schema';
import type { ServerResult } from '@/lib/server/auth/get-session';
import type {
  ProductApprovalStatus,
  ProductPublicationStatus,
  ProductArchiveStatus,
  ProfitType,
} from '@/types/database';
import {
  allowedFrom,
  PRODUCT_APPROVAL_TRANSITIONS,
  PRODUCT_PUBLICATION_TRANSITIONS,
  transitionStatus,
} from '@/lib/server/db/conditional-update';
import { invalidateAdminCaches } from '@/lib/server/db/invalidate-caches';

export { getStorefrontProductDetail, incrementProductView, normalizeStorefrontSupplier };

async function getMaxProductImages(): Promise<number> {
  const settingsRes = await getBusinessSettings();
  return settingsRes.success && settingsRes.data ? settingsRes.data.maxProductImages : 8;
}

function buildImageRows(productId: string, imageUrls: string[], maxImages: number) {
  return imageUrls.slice(0, maxImages).map((url, idx) => ({
    product_id: productId,
    image_url: url,
    storage_path: storagePathFromPublicUrl(url, 'product-images'),
    sort_order: idx,
    is_primary: idx === 0,
  }));
}

type ReplaceImagesResult = { success: true } | { success: false; message: string };

/**
 * Align product_images rows with an ordered URL list.
 * Reuses existing rows when URLs match; only deletes orphaned storage objects.
 */
async function replaceProductImages(
  productId: string,
  imageUrls: string[]
): Promise<ReplaceImagesResult> {
  const adminClient = createAdminClient();
  const maxImages = await getMaxProductImages();
  const nextUrls = imageUrls.slice(0, maxImages);

  const { data: existingImages, error: fetchError } = await adminClient
    .from('product_images')
    .select('id, image_url, storage_path, sort_order')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true });

  if (fetchError) {
    return { success: false, message: fetchError.message };
  }

  const oldRows = existingImages || [];
  const currentUrls = oldRows.map((row) => row.image_url);

  if (
    nextUrls.length === currentUrls.length &&
    nextUrls.every((url, index) => url === currentUrls[index])
  ) {
    return { success: true };
  }

  const urlToRow = new Map(oldRows.map((row) => [row.image_url, row]));
  const reusedIds = new Set<string>();

  // Update sort_order / is_primary on rows we keep (same URL set, possibly reordered).
  if (nextUrls.length > 0 && nextUrls.every((url) => urlToRow.has(url))) {
    await adminClient
      .from('product_images')
      .update({ is_primary: false })
      .eq('product_id', productId);

    for (let idx = 0; idx < nextUrls.length; idx++) {
      const row = urlToRow.get(nextUrls[idx])!;
      reusedIds.add(row.id);
      const { error: updateError } = await adminClient
        .from('product_images')
        .update({ sort_order: idx, is_primary: idx === 0 })
        .eq('id', row.id)
        .eq('product_id', productId);

      if (updateError) {
        return { success: false, message: updateError.message };
      }
    }

    const removedRows = oldRows.filter((row) => !reusedIds.has(row.id));
    if (removedRows.length > 0) {
      const { error: deleteError } = await adminClient
        .from('product_images')
        .delete()
        .in(
          'id',
          removedRows.map((r) => r.id)
        );

      if (deleteError) {
        return { success: false, message: deleteError.message };
      }

      for (const row of removedRows) {
        if (row.storage_path) {
          await deleteProductImageFromStorage(row.storage_path);
        }
      }
    }

    return { success: true };
  }

  // URL set changed: delete all existing rows first, then insert (avoids dual-primary constraint).
  const oldPaths = oldRows
    .map((img) => img.storage_path)
    .filter((p): p is string => Boolean(p));

  if (oldRows.length > 0) {
    const { error: deleteError } = await adminClient
      .from('product_images')
      .delete()
      .eq('product_id', productId);

    if (deleteError) {
      return { success: false, message: deleteError.message };
    }
  }

  if (nextUrls.length > 0) {
    const { error: insertError } = await adminClient
      .from('product_images')
      .insert(buildImageRows(productId, nextUrls, maxImages));

    if (insertError) {
      return { success: false, message: insertError.message };
    }
  }

  const nextPathSet = new Set(
    nextUrls
      .map((url) => storagePathFromPublicUrl(url, 'product-images'))
      .filter((p): p is string => Boolean(p))
  );

  for (const storagePath of oldPaths) {
    if (!nextPathSet.has(storagePath)) {
      await deleteProductImageFromStorage(storagePath);
    }
  }

  return { success: true };
}

/** Keep open approval request snapshots aligned with live product_images (post-upload flow). */
export async function syncPendingApprovalImageUrls(productId: string): Promise<void> {
  const adminClient = createAdminClient();

  const { data: images } = await adminClient
    .from('product_images')
    .select('image_url')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true });

  const imageUrls = (images || []).map((img) => img.image_url).filter(Boolean);

  const { data: request } = await adminClient
    .from('product_approval_requests')
    .select('id, proposed_data, status')
    .eq('product_id', productId)
    .in('status', ['pending', 'update_pending'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!request) return;

  const proposed = ((request.proposed_data as Record<string, unknown>) || {}) as Record<string, unknown>;
  await adminClient
    .from('product_approval_requests')
    .update({
      proposed_data: { ...proposed, image_urls: imageUrls },
    })
    .eq('id', request.id);
}

/**
 * Supplier creates a new product.
 * Starts in approval_status='pending', publication_status='unpublished'.
 */
export async function createProductBySupplier(
  supplierId: string,
  formData: unknown
): Promise<ServerResult<{ productId: string }>> {
  try {
    const validated = createProductSchema.safeParse(formData);
    if (!validated.success) {
      return {
        success: false,
        error: { message: validated.error.errors[0].message, code: 'VALIDATION_ERROR' },
      };
    }

    const {
      categoryId,
      name,
      description,
      sku,
      stockQuantity,
      moq,
      suggestedMoq,
      supplierPrice,
      specifications,
      imageUrls,
      gstRate: payloadGstRate,
      gstIncluded,
      discount,
      minOrderValue,
    } = validated.data;
    const adminClient = createAdminClient();

    // Verify supplier is active
    const { data: supplier, error: supplierError } = await adminClient
      .from('suppliers')
      .select('id, status')
      .eq('id', supplierId)
      .single();

    if (supplierError || !supplier || supplier.status !== 'active') {
      return {
        success: false,
        error: { message: 'Only active suppliers can create products', code: 'UNAUTHORIZED_SUPPLIER' },
      };
    }

    const settingsRes = await getBusinessSettings();
    const settings = settingsRes.success ? settingsRes.data : null;
    const gstRate = payloadGstRate ?? settings?.defaultGstRate ?? 18;
    const gstInc = gstIncluded ?? false;
    const discountAmt = discount ?? 0;
    const maxImages = settings?.maxProductImages ?? 8;
    const resolvedSuggestedMoq = suggestedMoq ?? 100;
    // Supplier submissions only set suggested MOQ; catalog MOQ mirrors it until admin adjusts.
    const catalogMoq = resolvedSuggestedMoq;

    // Default profit & pricing computation (default 15% margin)
    const initialPricing = calculatePricing({
      supplier_price: supplierPrice,
      profit_type: 'percentage',
      profit_value: 15,
      discount: discountAmt,
      gst_rate: gstRate,
      gst_included: gstInc,
    });

    // 1. Insert product record
    const { data: product, error: prodError } = await adminClient
      .from('products')
      .insert({
        supplier_id: supplierId,
        category_id: categoryId,
        name,
        description: description || null,
        sku: sku ?? null,
        stock_quantity: stockQuantity ?? 0,
        moq: catalogMoq,
        suggested_moq: resolvedSuggestedMoq,
        supplier_price: supplierPrice,
        profit_type: 'percentage',
        profit_value: 15,
        selling_price: initialPricing.selling_price,
        discount: discountAmt,
        gst_rate: gstRate,
        gst_included: gstInc,
        min_order_value: minOrderValue ?? null,
        approval_status: 'pending',
        publication_status: 'unpublished',
        archive_status: 'active',
        is_draft: false,
      })
      .select()
      .single();

    if (prodError || !product) {
      return {
        success: false,
        error: { message: prodError?.message || 'Failed to create product', code: 'DATABASE_ERROR' },
      };
    }

    const productId = product.id;

    // 2. Insert specifications
    if (specifications && specifications.length > 0) {
      const specRows = specifications.map((s, idx) => ({
        product_id: productId,
        spec_name: s.spec_name,
        spec_value: s.spec_value,
        sort_order: s.sort_order ?? idx,
      }));
      await adminClient.from('product_specifications').insert(specRows);
    }

    // 3. Insert images
    if (imageUrls && imageUrls.length > 0) {
      await adminClient.from('product_images').insert(buildImageRows(productId, imageUrls, maxImages));
    }

    // 4. Create approval request log
    await adminClient.from('product_approval_requests').insert({
      product_id: productId,
      request_type: 'new_product',
      proposed_data: {
        name,
        description,
        sku,
        stock_quantity: stockQuantity ?? 0,
        suggested_moq: resolvedSuggestedMoq,
        supplier_price: supplierPrice,
        category_id: categoryId,
        specifications,
        image_urls: imageUrls,
      },
      status: 'pending',
    });

    return {
      success: true,
      data: { productId },
    };
  } catch (error) {
    console.error('[createProductBySupplier] Error:', error);
    return {
      success: false,
      error: { message: 'Unexpected error creating product', code: 'INTERNAL_ERROR' },
    };
  }
}

function normalizeSupplierId(raw: string | null | undefined): string | null {
  if (!raw || raw === '') return null;
  return raw;
}

async function insertProductRecord(params: {
  supplierId: string | null;
  categoryId: string;
  name: string;
  description?: string | null;
  sku?: string | null;
  stockQuantity?: number;
  moq: number;
  suggestedMoq?: number | null;
  supplierPrice: number;
  profitType?: ProfitType;
  profitValue?: number;
  discount?: number;
  gstRate: number;
  gstIncluded: boolean;
  minOrderValue?: number | null;
  ribbonLabel?: string | null;
  approvalStatus: ProductApprovalStatus;
  isDraft?: boolean;
}): Promise<ServerResult<{ productId: string; product: any }>> {
  const adminClient = createAdminClient();
  const profitType = params.profitType ?? 'percentage';
  const profitValue = params.profitValue ?? 15;
  const discountAmt = params.discount ?? 0;

  const pricing = calculatePricing({
    supplier_price: params.supplierPrice,
    profit_type: profitType,
    profit_value: profitValue,
    discount: discountAmt,
    gst_rate: params.gstRate,
    gst_included: params.gstIncluded,
  });

  const { data: product, error: prodError } = await adminClient
    .from('products')
    .insert({
      supplier_id: params.supplierId,
      category_id: params.categoryId,
      name: params.name,
      description: params.description || null,
      sku: params.sku ?? null,
      stock_quantity: params.stockQuantity ?? 0,
      moq: params.moq,
      suggested_moq: params.suggestedMoq ?? params.moq,
      supplier_price: params.supplierPrice,
      profit_type: profitType,
      profit_value: profitValue,
      selling_price: pricing.selling_price,
      discount: discountAmt,
      gst_rate: params.gstRate,
      gst_included: params.gstIncluded,
      min_order_value: params.minOrderValue ?? null,
      ribbon_label: params.ribbonLabel ?? null,
      approval_status: params.approvalStatus,
      publication_status: 'unpublished',
      archive_status: 'active',
      is_draft: params.isDraft ?? false,
    })
    .select()
    .single();

  if (prodError || !product) {
    return {
      success: false,
      error: { message: prodError?.message || 'Failed to create product', code: 'DATABASE_ERROR' },
    };
  }

  return { success: true, data: { productId: product.id, product } };
}

/**
 * Admin creates a product; supplier is optional (NULL = internal product).
 */
export async function createProductByAdmin(
  formData: unknown
): Promise<ServerResult<{ productId: string }>> {
  try {
    const validated = createProductByAdminSchema.safeParse(formData);
    if (!validated.success) {
      return {
        success: false,
        error: { message: validated.error.errors[0].message, code: 'VALIDATION_ERROR' },
      };
    }

    const {
      supplierId: rawSupplierId,
      categoryId,
      name,
      description,
      sku,
      stockQuantity,
      moq,
      suggestedMoq,
      supplierPrice,
      specifications,
      imageUrls,
      gstRate: payloadGstRate,
      gstIncluded,
      discount,
      minOrderValue,
      profitType,
      profitValue,
      ribbonLabel,
      isDraft,
    } = validated.data;

    const supplierId = normalizeSupplierId(rawSupplierId);
    const adminClient = createAdminClient();

    if (supplierId) {
      const { data: supplier, error: supplierError } = await adminClient
        .from('suppliers')
        .select('id, status')
        .eq('id', supplierId)
        .single();

      if (supplierError || !supplier || supplier.status !== 'active') {
        return {
          success: false,
          error: { message: 'Selected supplier is not active', code: 'UNAUTHORIZED_SUPPLIER' },
        };
      }
    }

    const settingsRes = await getBusinessSettings();
    const settings = settingsRes.success ? settingsRes.data : null;
    const gstRate = payloadGstRate ?? settings?.defaultGstRate ?? 18;
    const gstInc = gstIncluded ?? false;
    const maxImages = settings?.maxProductImages ?? 8;
    const catalogMoq = moq ?? suggestedMoq ?? 100;

    const insertResult = await insertProductRecord({
      supplierId,
      categoryId,
      name,
      description,
      sku,
      stockQuantity,
      moq: catalogMoq,
      suggestedMoq: suggestedMoq ?? catalogMoq,
      supplierPrice,
      profitType: profitType as ProfitType | undefined,
      profitValue,
      discount,
      gstRate,
      gstIncluded: gstInc,
      minOrderValue,
      ribbonLabel,
      approvalStatus: isDraft ? 'pending' : 'approved',
      isDraft: isDraft ?? false,
    });

    if (!insertResult.success) return insertResult;

    const productId = insertResult.data.productId;

    if (specifications && specifications.length > 0) {
      const specRows = specifications.map((s, idx) => ({
        product_id: productId,
        spec_name: s.spec_name,
        spec_value: s.spec_value,
        sort_order: s.sort_order ?? idx,
      }));
      await adminClient.from('product_specifications').insert(specRows);
    }

    if (imageUrls && imageUrls.length > 0) {
      await adminClient.from('product_images').insert(buildImageRows(productId, imageUrls, maxImages));
    }

    return { success: true, data: { productId } };
  } catch (error) {
    console.error('[createProductByAdmin] Error:', error);
    return {
      success: false,
      error: { message: 'Unexpected error creating product', code: 'INTERNAL_ERROR' },
    };
  }
}

/**
 * Admin saves or updates a draft product (partial validation).
 */
export async function saveProductDraft(
  formData: unknown
): Promise<ServerResult<{ productId: string }>> {
  try {
    const validated = saveProductDraftSchema.safeParse(formData);
    if (!validated.success) {
      return {
        success: false,
        error: { message: validated.error.errors[0].message, code: 'VALIDATION_ERROR' },
      };
    }

    const data = validated.data;
    const adminClient = createAdminClient();
    const supplierId = normalizeSupplierId(data.supplierId);

    if (data.productId) {
      const updateResult = await adminDirectUpdateProduct({
        productId: data.productId,
        name: data.name,
        categoryId: data.categoryId,
        supplierId: supplierId ?? undefined,
        description: data.description,
        sku: data.sku,
        stockQuantity: data.stockQuantity,
        moq: data.moq,
        suggestedMoq: data.suggestedMoq,
        supplierPrice: data.supplierPrice,
        profitType: data.profitType,
        profitValue: data.profitValue,
        discount: data.discount,
        gstRate: data.gstRate,
        gstIncluded: data.gstIncluded,
        minOrderValue: data.minOrderValue,
        ribbonLabel: data.ribbonLabel,
        specifications: data.specifications,
        imageUrls: data.imageUrls,
        isDraft: true,
      });
      if (!updateResult.success) return updateResult as ServerResult<{ productId: string }>;
      return { success: true, data: { productId: data.productId } };
    }

    if (!data.categoryId) {
      return {
        success: false,
        error: { message: 'Category is required to save a new draft', code: 'VALIDATION_ERROR' },
      };
    }

    const settingsRes = await getBusinessSettings();
    const settings = settingsRes.success ? settingsRes.data : null;

    const insertResult = await insertProductRecord({
      supplierId,
      categoryId: data.categoryId,
      name: data.name,
      description: data.description,
      sku: data.sku,
      stockQuantity: data.stockQuantity,
      moq: data.moq ?? 100,
      suggestedMoq: data.suggestedMoq ?? data.moq ?? 100,
      supplierPrice: data.supplierPrice ?? 0,
      profitType: data.profitType as ProfitType | undefined,
      profitValue: data.profitValue,
      discount: data.discount,
      gstRate: data.gstRate ?? settings?.defaultGstRate ?? 18,
      gstIncluded: data.gstIncluded ?? false,
      minOrderValue: data.minOrderValue,
      ribbonLabel: data.ribbonLabel,
      approvalStatus: 'pending',
      isDraft: true,
    });

    if (!insertResult.success) return insertResult;

    const productId = insertResult.data.productId;
    const maxImages = settings?.maxProductImages ?? 8;

    if (data.specifications?.length) {
      await adminClient.from('product_specifications').insert(
        data.specifications.map((s, idx) => ({
          product_id: productId,
          spec_name: s.spec_name,
          spec_value: s.spec_value,
          sort_order: s.sort_order ?? idx,
        }))
      );
    }

    if (data.imageUrls?.length) {
      await adminClient.from('product_images').insert(buildImageRows(productId, data.imageUrls, maxImages));
    }

    return { success: true, data: { productId } };
  } catch (error) {
    console.error('[saveProductDraft] Error:', error);
    return {
      success: false,
      error: { message: 'Failed to save draft', code: 'INTERNAL_ERROR' },
    };
  }
}

/**
 * Supplier submits an update to an existing product.
 * Queues proposed_data without changing live product approval_status (listing stays visible).
 */
export async function submitProductUpdateBySupplier(
  supplierId: string,
  formData: unknown
): Promise<ServerResult<{ requestId: string }>> {
  try {
    const validated = updateProductBySupplierSchema.safeParse(formData);
    if (!validated.success) {
      return {
        success: false,
        error: { message: validated.error.errors[0].message, code: 'VALIDATION_ERROR' },
      };
    }

    const { productId, name, categoryId, description, sku, suggestedMoq, supplierPrice, specifications, imageUrls } = validated.data;
    const adminClient = createAdminClient();

    // Verify ownership
    const { data: existingProd, error: fetchError } = await adminClient
      .from('products')
      .select('id, supplier_id, publication_status, updated_at')
      .eq('id', productId)
      .eq('supplier_id', supplierId)
      .single();

    if (fetchError || !existingProd) {
      return {
        success: false,
        error: { message: 'Product not found or does not belong to this supplier', code: 'NOT_FOUND' },
      };
    }

    // Supersede any open request for this product
    await adminClient
      .from('product_approval_requests')
      .update({
        status: 'rejected',
        rejection_reason: 'Superseded by newer submission',
        reviewed_at: new Date().toISOString(),
      })
      .eq('product_id', productId)
      .in('status', ['pending', 'update_pending']);

    // Keep live product approved/published during review — pending state lives on the request row.
    await adminClient
      .from('products')
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId);

    // Queue the proposed update (supplier cannot change catalog MOQ / margin / discount)
    const { data: request, error: reqError } = await adminClient
      .from('product_approval_requests')
      .insert({
        product_id: productId,
        request_type: 'update',
        proposed_data: {
          name,
          category_id: categoryId,
          description,
          sku,
          suggested_moq: suggestedMoq,
          supplier_price: supplierPrice,
          specifications,
          image_urls: imageUrls,
        },
        status: 'update_pending',
        base_product_updated_at: existingProd.updated_at,
      } as any)
      .select()
      .single();

    if (reqError || !request) {
      return {
        success: false,
        error: { message: 'Failed to submit update request', code: 'DATABASE_ERROR' },
      };
    }

    return {
      success: true,
      data: { requestId: request.id },
    };
  } catch (error) {
    console.error('[submitProductUpdateBySupplier] Error:', error);
    return {
      success: false,
      error: { message: 'Failed to submit update', code: 'INTERNAL_ERROR' },
    };
  }
}

/**
 * Admin directly updates any product attribute (profit, discount, pricing, specs, ribbon, etc.).
 * Calculates and updates selling_price immediately.
 */
export async function adminDirectUpdateProduct(formData: unknown): Promise<ServerResult<{ updated: boolean }>> {
  try {
    const validated = adminUpdateProductSchema.safeParse(formData);
    if (!validated.success) {
      return {
        success: false,
        error: { message: validated.error.errors[0].message, code: 'VALIDATION_ERROR' },
      };
    }

    const { productId, specifications, imageUrls, forceApply, isDraft, ...directFields } = validated.data;
    const adminClient = createAdminClient();

    // Fetch existing product to resolve pricing params
    const { data: currentProduct, error: fetchError } = await adminClient
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();

    if (fetchError || !currentProduct) {
      return {
        success: false,
        error: { message: 'Product not found', code: 'NOT_FOUND' },
      };
    }

    if (
      directFields.supplierPrice !== undefined &&
      !forceApply
    ) {
      const { data: pendingReq } = await adminClient
        .from('product_approval_requests')
        .select('id')
        .eq('product_id', productId)
        .in('status', ['pending', 'update_pending'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pendingReq) {
        return {
          success: false,
          error: {
            message:
              'A supplier price proposal is pending approval. Approve or reject it before changing the live factory price, or use force apply.',
            code: 'PENDING_PROPOSAL_EXISTS',
          },
        };
      }
    }

    const supplierPrice = directFields.supplierPrice ?? currentProduct.supplier_price;
    const profitType = (directFields.profitType ?? currentProduct.profit_type) as ProfitType;
    const profitValue = directFields.profitValue ?? currentProduct.profit_value;
    const discount = directFields.discount ?? currentProduct.discount;
    const gstRate = directFields.gstRate ?? currentProduct.gst_rate;
    const gstIncluded = directFields.gstIncluded ?? currentProduct.gst_included;

    const pricing = calculatePricing({
      supplier_price: supplierPrice,
      profit_type: profitType,
      profit_value: profitValue,
      discount,
      gst_rate: gstRate,
      gst_included: gstIncluded,
    });

    const updatePayload: Record<string, any> = {
      selling_price: pricing.selling_price,
      updated_at: new Date().toISOString(),
    };

    if (directFields.name) updatePayload.name = directFields.name;
    if (directFields.categoryId) updatePayload.category_id = directFields.categoryId;
    if (directFields.supplierId !== undefined) {
      updatePayload.supplier_id = normalizeSupplierId(directFields.supplierId);
    }
    if (directFields.description !== undefined) updatePayload.description = directFields.description;
    if (directFields.sku !== undefined) updatePayload.sku = directFields.sku;
    if (directFields.stockQuantity !== undefined) updatePayload.stock_quantity = directFields.stockQuantity;
    if (directFields.moq !== undefined) updatePayload.moq = directFields.moq;
    if (directFields.suggestedMoq !== undefined) updatePayload.suggested_moq = directFields.suggestedMoq;
    if (directFields.supplierPrice !== undefined) updatePayload.supplier_price = supplierPrice;
    if (directFields.profitType !== undefined) updatePayload.profit_type = profitType;
    if (directFields.profitValue !== undefined) updatePayload.profit_value = profitValue;
    if (directFields.discount !== undefined) updatePayload.discount = discount;
    if (directFields.gstRate !== undefined) updatePayload.gst_rate = gstRate;
    if (directFields.gstIncluded !== undefined) updatePayload.gst_included = gstIncluded;
    if (directFields.minOrderValue !== undefined) updatePayload.min_order_value = directFields.minOrderValue;
    if (directFields.ribbonLabel !== undefined) updatePayload.ribbon_label = directFields.ribbonLabel;
    if (isDraft !== undefined) updatePayload.is_draft = isDraft;

    await (adminClient as any).from('product_versions').insert({
      product_id: productId,
      snapshot: {
        before: {
          supplier_price: currentProduct.supplier_price,
          selling_price: currentProduct.selling_price,
          moq: currentProduct.moq,
          discount: currentProduct.discount,
          gst_rate: currentProduct.gst_rate,
        },
        after: updatePayload,
      },
    }).then(() => undefined).catch(() => undefined);

    const { error: updateError } = await adminClient
      .from('products')
      .update(updatePayload as any)
      .eq('id', productId);

    if (updateError) {
      return {
        success: false,
        error: { message: updateError.message, code: 'DATABASE_ERROR' },
      };
    }

    // Update specs if provided
    if (specifications) {
      await adminClient.from('product_specifications').delete().eq('product_id', productId);
      if (specifications.length > 0) {
        const specRows = specifications.map((s, idx) => ({
          product_id: productId,
          spec_name: s.spec_name,
          spec_value: s.spec_value,
          sort_order: s.sort_order ?? idx,
        }));
        await adminClient.from('product_specifications').insert(specRows);
      }
    }

    if (imageUrls) {
      const imageResult = await replaceProductImages(productId, imageUrls);
      if (!imageResult.success) {
        return {
          success: false,
          error: { message: imageResult.message, code: 'IMAGE_UPDATE_FAILED' },
        };
      }
    }

    return {
      success: true,
      data: { updated: true },
    };
  } catch (error) {
    console.error('[adminDirectUpdateProduct] Error:', error);
    return {
      success: false,
      error: { message: 'Failed to update product', code: 'INTERNAL_ERROR' },
    };
  }
}

/**
 * Admin approves a product (either new submission or update request).
 * Approval sets approval_status='approved' but does NOT automatically change publication state.
 */
export async function approveProduct(requestId: string, adminUserId?: string): Promise<ServerResult<{ approved: boolean }>> {
  try {
    const adminClient = createAdminClient();

    // 1. Fetch the request
    const { data: request, error: reqError } = await adminClient
      .from('product_approval_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (reqError || !request) {
      return {
        success: false,
        error: { message: 'Approval request not found', code: 'NOT_FOUND' },
      };
    }

    const productId = request.product_id;
    const proposed = request.proposed_data as any;

    // 2. Fetch current product
    const { data: currentProduct } = await adminClient
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();

    if (!currentProduct) {
      return {
        success: false,
        error: { message: 'Target product not found', code: 'NOT_FOUND' },
      };
    }

    const baseline = (request as any).base_product_updated_at as string | null | undefined;
    if (
      baseline &&
      currentProduct.updated_at &&
      new Date(currentProduct.updated_at).getTime() !== new Date(baseline).getTime()
    ) {
      return {
        success: false,
        error: {
          message:
            'This proposal is stale because an admin edited the live product. Ask the supplier to resubmit.',
          code: 'STALE_PROPOSAL',
        },
      };
    }

    const supplierPrice = proposed.supplier_price ?? currentProduct.supplier_price;
    const discount = currentProduct.discount;
    const gstRate = currentProduct.gst_rate;
    const gstIncluded = currentProduct.gst_included;
    const pricing = calculatePricing({
      supplier_price: supplierPrice,
      profit_type: currentProduct.profit_type as ProfitType,
      profit_value: currentProduct.profit_value,
      discount,
      gst_rate: gstRate,
      gst_included: gstIncluded,
    });

    const productUpdate: Record<string, any> = {
      approval_status: 'approved',
      supplier_price: supplierPrice,
      selling_price: pricing.selling_price,
    };
    if (proposed.name) productUpdate.name = proposed.name;
    if (proposed.category_id) productUpdate.category_id = proposed.category_id;
    if (proposed.description !== undefined) productUpdate.description = proposed.description;
    if (proposed.sku !== undefined) productUpdate.sku = proposed.sku;
    if (proposed.suggested_moq !== undefined) {
      productUpdate.suggested_moq = proposed.suggested_moq;
      productUpdate.moq = proposed.suggested_moq;
    }

    const { error: approveRpcError } = await (adminClient as any).rpc('approve_product_core_atomic', {
      p_request_id: requestId,
      p_admin_user_id: adminUserId || null,
      p_product_update: productUpdate,
    });

    if (approveRpcError) {
      const { isRpcMissing, allowUnsafeDbFallback, databaseMisconfiguredError } = await import(
        '@/lib/server/db/production-guards'
      );
      if (isRpcMissing(approveRpcError, 'approve_product_core_atomic')) {
        if (!allowUnsafeDbFallback()) {
          return databaseMisconfiguredError('Product approve');
        }
      } else if (approveRpcError.message?.includes('STALE_PROPOSAL')) {
        return {
          success: false,
          error: {
            message:
              'This proposal is stale because an admin edited the live product. Ask the supplier to resubmit.',
            code: 'STALE_PROPOSAL',
          },
        };
      } else if (
        approveRpcError.message?.includes('no longer open') ||
        approveRpcError.code === 'check_violation'
      ) {
        return {
          success: false,
          error: { message: 'Approval request is no longer open', code: 'INVALID_STATUS' },
        };
      } else if (!isRpcMissing(approveRpcError, 'approve_product_core_atomic')) {
        return { success: false, error: { message: approveRpcError.message, code: 'DATABASE_ERROR' } };
      }

      // Dev fallback: previous multi-step path
      const reqTransition = await transitionStatus(
        adminClient,
        'product_approval_requests',
        requestId,
        'status',
        'approved',
        allowedFrom(PRODUCT_APPROVAL_TRANSITIONS, 'approved'),
        {
          reviewed_at: new Date().toISOString(),
          reviewed_by: adminUserId || null,
        }
      );

      if (!reqTransition.ok) {
        return {
          success: false,
          error: { message: 'Approval request is no longer open', code: 'INVALID_STATUS' },
        };
      }

      await (adminClient as any)
        .from('products')
        .update({
          ...productUpdate,
          rejection_reason: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', productId);
    }

    // Specs / images after core approve — failures surface to caller (core status already committed).
    if (proposed.specifications !== undefined && Array.isArray(proposed.specifications)) {
      const { error: specDeleteError } = await adminClient
        .from('product_specifications')
        .delete()
        .eq('product_id', productId);

      if (specDeleteError) {
        return {
          success: false,
          error: {
            message: `Product approved but specifications update failed: ${specDeleteError.message}`,
            code: 'SPEC_UPDATE_FAILED',
          },
        };
      }

      if (proposed.specifications.length > 0) {
        const specRows = proposed.specifications.map((s: any, idx: number) => ({
          product_id: productId,
          spec_name: s.spec_name,
          spec_value: s.spec_value,
          sort_order: s.sort_order ?? idx,
        }));
        const { error: specInsertError } = await adminClient
          .from('product_specifications')
          .insert(specRows);

        if (specInsertError) {
          return {
            success: false,
            error: {
              message: `Product approved but specifications update failed: ${specInsertError.message}`,
              code: 'SPEC_UPDATE_FAILED',
            },
          };
        }
      }
    }

    if (Array.isArray(proposed.image_urls)) {
      const imageResult = await replaceProductImages(productId, proposed.image_urls);
      if (!imageResult.success) {
        return {
          success: false,
          error: {
            message: `Product approved but image update failed: ${imageResult.message}`,
            code: 'IMAGE_UPDATE_FAILED',
          },
        };
      }
    }

    invalidateAdminCaches();

    return {
      success: true,
      data: { approved: true },
    };
  } catch (error) {
    console.error('[approveProduct] Error:', error);
    return {
      success: false,
      error: { message: 'Failed to approve product', code: 'INTERNAL_ERROR' },
    };
  }
}

/**
 * Admin rejects a product submission or update request (requires reason).
 */
export async function rejectProduct(formData: unknown, adminUserId?: string): Promise<ServerResult<{ rejected: boolean }>> {
  try {
    const validated = rejectProductSchema.safeParse(formData);
    if (!validated.success) {
      return {
        success: false,
        error: { message: validated.error.errors[0].message, code: 'VALIDATION_ERROR' },
      };
    }

    const { requestId, rejectionReason } = validated.data;
    const adminClient = createAdminClient();

    const { data: request, error: reqError } = await adminClient
      .from('product_approval_requests')
      .select('product_id, request_type, status')
      .eq('id', requestId)
      .single();

    if (reqError || !request) {
      return {
        success: false,
        error: { message: 'Approval request not found', code: 'NOT_FOUND' },
      };
    }

    const reqTransition = await transitionStatus(
      adminClient,
      'product_approval_requests',
      requestId,
      'status',
      'rejected',
      allowedFrom(PRODUCT_APPROVAL_TRANSITIONS, 'rejected'),
      {
        rejection_reason: rejectionReason,
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminUserId || null,
      }
    );

    if (!reqTransition.ok) {
      return {
        success: false,
        error: { message: 'Approval request is no longer open', code: 'INVALID_STATUS' },
      };
    }

    if (request.request_type === 'update') {
      // Update rejection: keep live product approved; only close the request
      await adminClient
        .from('products')
        .update({
          approval_status: 'approved',
          rejection_reason: rejectionReason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', request.product_id);
    } else {
      await adminClient
        .from('products')
        .update({
          approval_status: 'rejected',
          rejection_reason: rejectionReason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', request.product_id);
    }

    invalidateAdminCaches();

    return {
      success: true,
      data: { rejected: true },
    };
  } catch (error) {
    console.error('[rejectProduct] Error:', error);
    return {
      success: false,
      error: { message: 'Failed to reject product', code: 'INTERNAL_ERROR' },
    };
  }
}

/**
 * Admin requests changes on a pending update without rejecting the live product.
 */
export async function requestProductChanges(
  formData: unknown,
  adminUserId?: string
): Promise<ServerResult<{ noted: boolean }>> {
  try {
    const validated = requestChangesSchema.safeParse(formData);
    if (!validated.success) {
      return {
        success: false,
        error: { message: validated.error.errors[0].message, code: 'VALIDATION_ERROR' },
      };
    }

    const { requestId, reviewNote } = validated.data;
    const adminClient = createAdminClient();

    const { data: request, error: reqError } = await adminClient
      .from('product_approval_requests')
      .select('product_id, request_type')
      .eq('id', requestId)
      .single();

    if (reqError || !request) {
      return {
        success: false,
        error: { message: 'Approval request not found', code: 'NOT_FOUND' },
      };
    }

    await adminClient
      .from('product_approval_requests')
      .update({
        status: 'rejected',
        rejection_reason: reviewNote,
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminUserId || null,
      })
      .eq('id', requestId)
      .in('status', ['pending', 'update_pending']);

    if (request.request_type === 'update') {
      await adminClient
        .from('products')
        .update({
          approval_status: 'approved',
          rejection_reason: reviewNote,
          updated_at: new Date().toISOString(),
        })
        .eq('id', request.product_id);
    } else {
      await adminClient
        .from('products')
        .update({
          approval_status: 'rejected',
          rejection_reason: reviewNote,
          updated_at: new Date().toISOString(),
        })
        .eq('id', request.product_id);
    }

    return { success: true, data: { noted: true } };
  } catch (error) {
    console.error('[requestProductChanges] Error:', error);
    return {
      success: false,
      error: { message: 'Failed to request changes', code: 'INTERNAL_ERROR' },
    };
  }
}

/**
 * Admin publishes an approved product.
 */
export async function publishProduct(productId: string): Promise<ServerResult<{ published: boolean }>> {
  try {
    const adminClient = createAdminClient();

    // Guard: product must have approval_status = 'approved' and archive_status = 'active'
    const { data: product, error: fetchError } = await adminClient
      .from('products')
      .select('id, approval_status, archive_status')
      .eq('id', productId)
      .single();

    if (fetchError || !product) {
      return { success: false, error: { message: 'Product not found', code: 'NOT_FOUND' } };
    }

    if (product.approval_status !== 'approved') {
      return {
        success: false,
        error: { message: 'Only approved products can be published', code: 'NOT_APPROVED' },
      };
    }

    if (product.archive_status === 'archived') {
      return {
        success: false,
        error: { message: 'Archived products cannot be published directly. Restore first.', code: 'ARCHIVED' },
      };
    }

    await adminClient
      .from('products')
      .update({
        publication_status: 'published',
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId)
      .eq('approval_status', 'approved')
      .eq('archive_status', 'active')
      .eq('publication_status', 'unpublished');

    const { data: published } = await adminClient
      .from('products')
      .select('id')
      .eq('id', productId)
      .eq('publication_status', 'published')
      .maybeSingle();

    if (!published) {
      return {
        success: false,
        error: { message: 'Product cannot be published in its current state', code: 'INVALID_STATUS' },
      };
    }

    invalidateAdminCaches();
    return { success: true, data: { published: true } };
  } catch (error) {
    console.error('[publishProduct] Error:', error);
    return { success: false, error: { message: 'Failed to publish product', code: 'INTERNAL_ERROR' } };
  }
}

/**
 * Admin unpublishes an active product.
 */
export async function unpublishProduct(productId: string): Promise<ServerResult<{ unpublished: boolean }>> {
  try {
    const adminClient = createAdminClient();
    const result = await transitionStatus(
      adminClient,
      'products',
      productId,
      'publication_status',
      'unpublished',
      allowedFrom(PRODUCT_PUBLICATION_TRANSITIONS, 'unpublished')
    );

    if (!result.ok) {
      return {
        success: false,
        error: { message: 'Product is not published', code: 'INVALID_STATUS' },
      };
    }

    invalidateAdminCaches();
    return { success: true, data: { unpublished: true } };
  } catch (error) {
    console.error('[unpublishProduct] Error:', error);
    return { success: false, error: { message: 'Failed to unpublish product', code: 'INTERNAL_ERROR' } };
  }
}

/**
 * Admin archives a product (reversible, saves pre_archive_publication_status).
 */
export async function archiveProduct(productId: string): Promise<ServerResult<{ archived: boolean }>> {
  try {
    const adminClient = createAdminClient();
    const { data: prod } = await adminClient
      .from('products')
      .select('publication_status')
      .eq('id', productId)
      .single();

    if (!prod) {
      return { success: false, error: { message: 'Product not found', code: 'NOT_FOUND' } };
    }

    await adminClient
      .from('products')
      .update({
        archive_status: 'archived',
        pre_archive_publication_status: prod.publication_status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId);

    invalidateAdminCaches();

    return { success: true, data: { archived: true } };
  } catch (error) {
    console.error('[archiveProduct] Error:', error);
    return { success: false, error: { message: 'Failed to archive product', code: 'INTERNAL_ERROR' } };
  }
}

/**
 * Admin restores an archived product.
 */
export async function restoreProduct(productId: string): Promise<ServerResult<{ restored: boolean }>> {
  try {
    const adminClient = createAdminClient();
    const { data: prod } = await adminClient
      .from('products')
      .select('pre_archive_publication_status')
      .eq('id', productId)
      .single();

    if (!prod) {
      return { success: false, error: { message: 'Product not found', code: 'NOT_FOUND' } };
    }

    const restoredPubStatus = prod.pre_archive_publication_status || 'unpublished';

    await adminClient
      .from('products')
      .update({
        archive_status: 'active',
        publication_status: restoredPubStatus,
        pre_archive_publication_status: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId);

    invalidateAdminCaches();

    return { success: true, data: { restored: true } };
  } catch (error) {
    console.error('[restoreProduct] Error:', error);
    return { success: false, error: { message: 'Failed to restore product', code: 'INTERNAL_ERROR' } };
  }
}

/**
 * Storefront Product Listing (published, active, approved).
 * Supplier company identity is not exposed — country/address only for origin flag.
 */
export async function getStorefrontProducts(params: {
  categoryId?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  minPrice?: number;
  maxPrice?: number;
  moqMin?: number;
  moqMax?: number;
}): Promise<ServerResult<{ products: any[]; total: number; page: number; limit: number }>> {
  try {
    const adminClient = createAdminClient();
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(60, Math.max(1, params.limit || 20));
    const offset = (page - 1) * limit;

    let query = adminClient
      .from('products')
      .select(`
        id,
        category_id,
        name,
        description,
        sku,
        stock_quantity,
        moq,
        selling_price,
        discount,
        gst_rate,
        gst_included,
        min_order_value,
        ribbon_label,
        created_at,
        category:categories(id, name),
        images:product_images(id, image_url, sort_order, is_primary),
        supplier:suppliers(country, address)
      `, { count: 'exact' })
      .eq('publication_status', 'published')
      .eq('archive_status', 'active')
      .eq('approval_status', 'approved')
      // Prefer a single primary (or first by sort) image — avoids transferring full galleries
      .order('is_primary', { ascending: false, foreignTable: 'product_images' })
      .order('sort_order', { ascending: true, foreignTable: 'product_images' })
      .limit(1, { foreignTable: 'product_images' });

    if (params.categoryId) {
      query = query.eq('category_id', params.categoryId);
    }

    if (params.search) {
      const q = sanitizePostgrestSearch(params.search);
      if (q) {
        query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%`);
      }
    }

    if (params.minPrice != null && !Number.isNaN(params.minPrice)) {
      query = query.gte('selling_price', params.minPrice);
    }
    if (params.maxPrice != null && !Number.isNaN(params.maxPrice)) {
      query = query.lte('selling_price', params.maxPrice);
    }
    if (params.moqMin != null && !Number.isNaN(params.moqMin)) {
      query = query.gte('moq', params.moqMin);
    }
    if (params.moqMax != null && !Number.isNaN(params.moqMax) && Number.isFinite(params.moqMax)) {
      query = query.lte('moq', params.moqMax);
    }

    switch (params.sortBy) {
      case 'oldest':
        query = query.order('created_at', { ascending: true });
        break;
      case 'price_low':
      case 'price_asc':
        query = query.order('selling_price', { ascending: true });
        break;
      case 'price_high':
      case 'price_desc':
        query = query.order('selling_price', { ascending: false });
        break;
      case 'name_asc':
        query = query.order('name', { ascending: true });
        break;
      case 'name_desc':
        query = query.order('name', { ascending: false });
        break;
      case 'popular':
        query = query.order('view_count', { ascending: false });
        break;
      case 'newest':
      default:
        query = query.order('created_at', { ascending: false });
        break;
    }

    const { data: products, count, error } = await query.range(offset, offset + limit - 1);

    if (error) {
      return {
        success: false,
        error: { message: error.message, code: 'DATABASE_ERROR' },
      };
    }

    // Slim list payload: primary image only + truncated description for cards
    const slimProducts = (products || []).map((raw: any) => {
      const p = normalizeStorefrontSupplier(raw);
      const images = Array.isArray(p.images) ? p.images : [];
      const primary =
        images.find((img: any) => img.is_primary) ||
        [...images].sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0] ||
        null;
      const fullDesc = typeof p.description === 'string' ? p.description : '';
      return {
        ...p,
        description: fullDesc.length > 120 ? `${fullDesc.slice(0, 120).trim()}…` : fullDesc,
        images: primary
          ? [{ id: primary.id, image_url: primary.image_url, sort_order: primary.sort_order ?? 0, is_primary: true }]
          : [],
      };
    });

    return {
      success: true,
      data: {
        products: slimProducts,
        total: count || 0,
        page,
        limit,
      },
    };
  } catch (error) {
    console.error('[getStorefrontProducts] Error:', error);
    return {
      success: false,
      error: { message: 'Failed to fetch catalog', code: 'INTERNAL_ERROR' },
    };
  }
}

/**
 * Admin: product list (table columns only — no images/specs).
 */
export async function getProductsForAdmin(params: {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  supplierId?: string;
  approvalStatus?: ProductApprovalStatus;
  publicationStatus?: ProductPublicationStatus;
  archiveStatus?: ProductArchiveStatus;
  sortBy?: 'newest' | 'oldest';
}): Promise<ServerResult<{ products: any[]; total: number; page: number; limit: number }>> {
  try {
    const adminClient = createAdminClient();
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const offset = (page - 1) * limit;

    let query = adminClient
      .from('products')
      .select(
        `
        id,
        name,
        description,
        category_id,
        supplier_id,
        sku,
        stock_quantity,
        moq,
        supplier_price,
        selling_price,
        discount,
        gst_rate,
        profit_type,
        profit_value,
        min_order_value,
        ribbon_label,
        approval_status,
        publication_status,
        archive_status,
        rejection_reason,
        created_at,
        updated_at,
        category:categories(id, name),
        supplier:suppliers(id, company_name, contact_person),
        images:product_images(id, image_url, sort_order, is_primary)
      `,
        { count: 'exact' }
      )
      .order('is_primary', { ascending: false, foreignTable: 'product_images' })
      .order('sort_order', { ascending: true, foreignTable: 'product_images' })
      .limit(1, { foreignTable: 'product_images' });

    if (params.categoryId) query = query.eq('category_id', params.categoryId);
    if (params.supplierId) query = query.eq('supplier_id', params.supplierId);
    if (params.approvalStatus) query = query.eq('approval_status', params.approvalStatus);
    if (params.publicationStatus) query = query.eq('publication_status', params.publicationStatus);
    if (params.archiveStatus) query = query.eq('archive_status', params.archiveStatus);
    if (params.search) {
      const q = sanitizeIlikePattern(params.search.trim());
      if (q) query = query.ilike('name', `%${q}%`);
    }

    if (params.sortBy === 'oldest') {
      query = query.order('created_at', { ascending: true });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    const { data: products, count, error } = await query.range(offset, offset + limit - 1);

    if (error) {
      return { success: false, error: { message: error.message, code: 'DATABASE_ERROR' } };
    }

    const productIds = (products || []).map((p) => p.id as string);
    let openRequestByProduct = new Map<string, { status: string; request_type: string }>();

    if (productIds.length > 0) {
      const { data: openRequests } = await adminClient
        .from('product_approval_requests')
        .select('product_id, status, request_type')
        .in('product_id', productIds)
        .in('status', ['pending', 'update_pending']);

      openRequestByProduct = new Map(
        (openRequests || []).map((r) => [
          r.product_id as string,
          { status: r.status as string, request_type: r.request_type as string },
        ])
      );
    }

    const enrichedProducts = (products || []).map((p) => {
      const open = openRequestByProduct.get(p.id as string);
      return {
        ...p,
        has_open_new_request: open?.status === 'pending',
        has_open_update_request: open?.status === 'update_pending',
      };
    });

    return {
      success: true,
      data: {
        products: enrichedProducts,
        total: count || 0,
        page,
        limit,
      },
    };
  } catch (error) {
    console.error('[getProductsForAdmin] Error:', error);
    return { success: false, error: { message: 'Failed to fetch admin products', code: 'INTERNAL_ERROR' } };
  }
}

/**
 * Admin: full product detail for edit modals (includes images + specifications).
 */
export async function getProductForAdminDetail(
  productId: string
): Promise<ServerResult<{ product: any }>> {
  try {
    const adminClient = createAdminClient();

    const [productRes, pendingReqRes, priceHistRes] = await Promise.all([
      adminClient
        .from('products')
        .select(
          `
          *,
          category:categories(id, name),
          supplier:suppliers(id, company_name, country, address, contact_person),
          images:product_images(id, image_url, sort_order, is_primary),
          specifications:product_specifications(id, spec_name, spec_value, sort_order)
        `
        )
        .eq('id', productId)
        .single(),
      adminClient
        .from('product_approval_requests')
        .select('id, request_type, status, proposed_data, created_at, reviewed_at, reviewed_by, rejection_reason')
        .eq('product_id', productId)
        .in('status', ['pending', 'update_pending'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      (adminClient as any)
        .from('product_versions')
        .select('id, snapshot, created_at')
        .eq('product_id', productId)
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

    const product = productRes.data;
    const error = productRes.error;

    if (error || !product) {
      return { success: false, error: { message: 'Product not found', code: 'NOT_FOUND' } };
    }

    const pendingRequest = pendingReqRes.data;
    const priceHistory = priceHistRes.data;

    const sortedImages = [...(product.images || [])].sort(
      (a: { sort_order?: number }, b: { sort_order?: number }) =>
        (a.sort_order ?? 0) - (b.sort_order ?? 0)
    );

    return {
      success: true,
      data: {
        product: {
          ...product,
          images: sortedImages,
          pendingRequest: pendingRequest ?? null,
          priceHistory: priceHistory ?? [],
        },
      },
    };
  } catch (error) {
    console.error('[getProductForAdminDetail] Error:', error);
    return { success: false, error: { message: 'Failed to load product', code: 'INTERNAL_ERROR' } };
  }
}

/**
 * Admin permanently deletes a product.
 * Requires unpublished + archived; deletes Tigris objects before DB row.
 */
export async function deleteProduct(productId: string): Promise<ServerResult<{ deleted: boolean }>> {
  try {
    const adminClient = createAdminClient();

    const { data: product, error: fetchError } = await adminClient
      .from('products')
      .select('id, publication_status, archive_status')
      .eq('id', productId)
      .single();

    if (fetchError || !product) {
      return { success: false, error: { message: 'Product not found', code: 'NOT_FOUND' } };
    }

    if (product.publication_status === 'published') {
      return {
        success: false,
        error: {
          message: 'Unpublish this product before deleting it',
          code: 'PUBLISHED',
        },
      };
    }

    if (product.archive_status !== 'archived') {
      return {
        success: false,
        error: {
          message: 'Archive this product before deleting it',
          code: 'NOT_ARCHIVED',
        },
      };
    }

    const { data: images } = await adminClient
      .from('product_images')
      .select('storage_path, image_url')
      .eq('product_id', productId);

    for (const img of images || []) {
      const path = img.storage_path;
      if (path) {
        try {
          await deleteProductImageFromStorage(path);
        } catch (err) {
          console.error('[deleteProduct] Tigris cleanup failed for', path, err);
        }
      }
    }

    const { error: deleteError } = await adminClient.from('products').delete().eq('id', productId);

    if (deleteError) {
      return { success: false, error: { message: deleteError.message, code: 'DATABASE_ERROR' } };
    }

    return { success: true, data: { deleted: true } };
  } catch (error) {
    console.error('[deleteProduct] Error:', error);
    return { success: false, error: { message: 'Failed to delete product', code: 'INTERNAL_ERROR' } };
  }
}
