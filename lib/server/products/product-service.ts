import { createAdminClient } from '@/lib/supabase/admin';
import { calculatePricing } from '@/lib/server/pricing/calculate-price';
import {
  deleteProductImageFromStorage,
  storagePathFromPublicUrl,
} from '@/lib/server/storage/storage-service';
import {
  createProductSchema,
  createProductByAdminSchema,
  updateProductBySupplierSchema,
  adminUpdateProductSchema,
  rejectProductSchema,
} from '@/lib/validation/product.schema';
import type { ServerResult } from '@/lib/server/auth/get-session';
import type {
  ProductApprovalStatus,
  ProductPublicationStatus,
  ProductArchiveStatus,
  ProfitType,
} from '@/types/database';

async function getMaxProductImages(): Promise<number> {
  const adminClient = createAdminClient();
  const { data: settings } = await adminClient
    .from('business_settings')
    .select('max_product_images')
    .limit(1)
    .maybeSingle();
  return settings?.max_product_images ?? 8;
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

async function replaceProductImages(
  productId: string,
  imageUrls: string[]
): Promise<void> {
  const adminClient = createAdminClient();
  const maxImages = await getMaxProductImages();

  const { data: existingImages } = await adminClient
    .from('product_images')
    .select('storage_path')
    .eq('product_id', productId);

  for (const img of existingImages || []) {
    if (img.storage_path) {
      await deleteProductImageFromStorage(img.storage_path);
    }
  }

  await adminClient.from('product_images').delete().eq('product_id', productId);

  if (imageUrls.length > 0) {
    await adminClient.from('product_images').insert(buildImageRows(productId, imageUrls, maxImages));
  }
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

    const { data: settings } = await adminClient
      .from('business_settings')
      .select('default_gst_rate, max_product_images')
      .limit(1)
      .maybeSingle();
    const gstRate = payloadGstRate ?? settings?.default_gst_rate ?? 18;
    const gstInc = gstIncluded ?? false;
    const discountAmt = discount ?? 0;
    const maxImages = settings?.max_product_images ?? 8;

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
        moq,
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
        moq,
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

/**
 * Admin creates a product assigned to an existing active supplier.
 * Mirrors supplier create (pending approval, unpublished) but requires supplierId.
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

    const { supplierId, ...productFields } = validated.data;
    return createProductBySupplier(supplierId, productFields);
  } catch (error) {
    console.error('[createProductByAdmin] Error:', error);
    return {
      success: false,
      error: { message: 'Unexpected error creating product', code: 'INTERNAL_ERROR' },
    };
  }
}

/**
 * Supplier submits an update to an existing product.
 * Sets approval_status='update_pending' and queues proposed_data without immediately overwriting live product.
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

    const { productId, name, categoryId, description, sku, stockQuantity, moq, supplierPrice, specifications, imageUrls, gstRate, gstIncluded, discount, minOrderValue } = validated.data;
    const adminClient = createAdminClient();

    // Verify ownership
    const { data: existingProd, error: fetchError } = await adminClient
      .from('products')
      .select('id, supplier_id, publication_status')
      .eq('id', productId)
      .eq('supplier_id', supplierId)
      .single();

    if (fetchError || !existingProd) {
      return {
        success: false,
        error: { message: 'Product not found or does not belong to this supplier', code: 'NOT_FOUND' },
      };
    }

    // Mark product as update_pending
    await adminClient
      .from('products')
      .update({
        approval_status: 'update_pending',
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId);

    // Queue the proposed update
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
          stock_quantity: stockQuantity,
          moq,
          supplier_price: supplierPrice,
          gst_rate: gstRate,
          gst_included: gstIncluded,
          discount,
          min_order_value: minOrderValue,
          specifications,
          image_urls: imageUrls,
        },
        status: 'update_pending',
      })
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

    const { productId, specifications, imageUrls, ...directFields } = validated.data;
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
    if (directFields.supplierId) updatePayload.supplier_id = directFields.supplierId;
    if (directFields.description !== undefined) updatePayload.description = directFields.description;
    if (directFields.sku !== undefined) updatePayload.sku = directFields.sku;
    if (directFields.stockQuantity !== undefined) updatePayload.stock_quantity = directFields.stockQuantity;
    if (directFields.moq !== undefined) updatePayload.moq = directFields.moq;
    if (directFields.supplierPrice !== undefined) updatePayload.supplier_price = supplierPrice;
    if (directFields.profitType !== undefined) updatePayload.profit_type = profitType;
    if (directFields.profitValue !== undefined) updatePayload.profit_value = profitValue;
    if (directFields.discount !== undefined) updatePayload.discount = discount;
    if (directFields.gstRate !== undefined) updatePayload.gst_rate = gstRate;
    if (directFields.gstIncluded !== undefined) updatePayload.gst_included = gstIncluded;
    if (directFields.minOrderValue !== undefined) updatePayload.min_order_value = directFields.minOrderValue;
    if (directFields.ribbonLabel !== undefined) updatePayload.ribbon_label = directFields.ribbonLabel;

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

    await (adminClient as any).from('products').update(updatePayload).eq('id', productId);

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

    // Update images if provided
    if (imageUrls) {
      await replaceProductImages(productId, imageUrls);
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

    // 3. Recalculate selling price with proposed supplier price if updated
    const supplierPrice = proposed.supplier_price ?? currentProduct.supplier_price;
    const discount = proposed.discount ?? currentProduct.discount;
    const gstRate = proposed.gst_rate ?? currentProduct.gst_rate;
    const gstIncluded = proposed.gst_included ?? currentProduct.gst_included;
    const pricing = calculatePricing({
      supplier_price: supplierPrice,
      profit_type: currentProduct.profit_type as ProfitType,
      profit_value: currentProduct.profit_value,
      discount,
      gst_rate: gstRate,
      gst_included: gstIncluded,
    });

    // 4. Update the live product with proposed fields
    const productUpdate: Record<string, any> = {
      approval_status: 'approved',
      rejection_reason: null,
      supplier_price: supplierPrice,
      selling_price: pricing.selling_price,
      discount,
      gst_rate: gstRate,
      gst_included: gstIncluded,
      updated_at: new Date().toISOString(),
    };

    if (proposed.name) productUpdate.name = proposed.name;
    if (proposed.category_id) productUpdate.category_id = proposed.category_id;
    if (proposed.description !== undefined) productUpdate.description = proposed.description;
    if (proposed.sku !== undefined) productUpdate.sku = proposed.sku;
    if (proposed.stock_quantity !== undefined) productUpdate.stock_quantity = proposed.stock_quantity;
    if (proposed.moq !== undefined) productUpdate.moq = proposed.moq;
    if (proposed.min_order_value !== undefined) productUpdate.min_order_value = proposed.min_order_value;

    await (adminClient as any).from('products').update(productUpdate).eq('id', productId);

    // 5. Update specifications if included in proposal
    if (proposed.specifications && Array.isArray(proposed.specifications)) {
      await adminClient.from('product_specifications').delete().eq('product_id', productId);
      if (proposed.specifications.length > 0) {
        const specRows = proposed.specifications.map((s: any, idx: number) => ({
          product_id: productId,
          spec_name: s.spec_name,
          spec_value: s.spec_value,
          sort_order: s.sort_order ?? idx,
        }));
        await adminClient.from('product_specifications').insert(specRows);
      }
    }

    // 6. Update images if included in proposal
    if (proposed.image_urls && Array.isArray(proposed.image_urls)) {
      await replaceProductImages(productId, proposed.image_urls);
    }

    // 7. Mark request as approved
    await adminClient
      .from('product_approval_requests')
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminUserId || null,
      })
      .eq('id', requestId);

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
      .select('product_id')
      .eq('id', requestId)
      .single();

    if (reqError || !request) {
      return {
        success: false,
        error: { message: 'Approval request not found', code: 'NOT_FOUND' },
      };
    }

    // Mark product as rejected
    await adminClient
      .from('products')
      .update({
        approval_status: 'rejected',
        rejection_reason: rejectionReason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', request.product_id);

    // Mark request as rejected
    await adminClient
      .from('product_approval_requests')
      .update({
        status: 'rejected',
        rejection_reason: rejectionReason,
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminUserId || null,
      })
      .eq('id', requestId);

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
      .eq('id', productId);

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
    await adminClient
      .from('products')
      .update({
        publication_status: 'unpublished',
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId);

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

    return { success: true, data: { restored: true } };
  } catch (error) {
    console.error('[restoreProduct] Error:', error);
    return { success: false, error: { message: 'Failed to restore product', code: 'INTERNAL_ERROR' } };
  }
}

/**
 * Storefront: Increments the atomic view count of a published product.
 */
export async function incrementProductView(productId: string): Promise<void> {
  try {
    const adminClient = createAdminClient();
    const { data: prod } = await adminClient
      .from('products')
      .select('view_count')
      .eq('id', productId)
      .single();

    if (prod) {
      await adminClient
        .from('products')
        .update({ view_count: (prod.view_count || 0) + 1 })
        .eq('id', productId);
    }
  } catch {
    // Non-blocking background view counter
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
  inStockOnly?: boolean;
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
        images:product_images(id, image_url, sort_order, is_primary, storage_path),
        specifications:product_specifications(id, spec_name, spec_value, sort_order),
        supplier:suppliers(country, address)
      `, { count: 'exact' })
      .eq('publication_status', 'published')
      .eq('archive_status', 'active')
      .eq('approval_status', 'approved');

    if (params.categoryId) {
      query = query.eq('category_id', params.categoryId);
    }

    if (params.search) {
      const q = params.search.trim();
      if (q) {
        query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%,description.ilike.%${q}%`);
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
    if (params.inStockOnly) {
      query = query.gt('stock_quantity', 0);
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

    return {
      success: true,
      data: {
        products: products || [],
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
 * Storefront Product Detail.
 * Returns product, images, and specifications without supplier information.
 */
export async function getStorefrontProductDetail(productId: string): Promise<ServerResult<any>> {
  try {
    const adminClient = createAdminClient();

    const { data: product, error } = await adminClient
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
        specifications:product_specifications(id, spec_name, spec_value, sort_order),
        supplier:suppliers(country, address)
      `)
      .eq('id', productId)
      .eq('publication_status', 'published')
      .eq('archive_status', 'active')
      .eq('approval_status', 'approved')
      .single();

    if (error || !product) {
      return {
        success: false,
        error: { message: 'Product not found or unavailable', code: 'NOT_FOUND' },
      };
    }

    // Increment view count in background
    incrementProductView(productId);

    return {
      success: true,
      data: { product },
    };
  } catch (error) {
    console.error('[getStorefrontProductDetail] Error:', error);
    return {
      success: false,
      error: { message: 'Failed to load product detail', code: 'INTERNAL_ERROR' },
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
        supplier:suppliers(id, company_name, contact_person)
      `,
        { count: 'exact' }
      );

    if (params.categoryId) query = query.eq('category_id', params.categoryId);
    if (params.supplierId) query = query.eq('supplier_id', params.supplierId);
    if (params.approvalStatus) query = query.eq('approval_status', params.approvalStatus);
    if (params.publicationStatus) query = query.eq('publication_status', params.publicationStatus);
    if (params.archiveStatus) query = query.eq('archive_status', params.archiveStatus);
    if (params.search) query = query.ilike('name', `%${params.search}%`);

    if (params.sortBy === 'oldest') {
      query = query.order('created_at', { ascending: true });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    const { data: products, count, error } = await query.range(offset, offset + limit - 1);

    if (error) {
      return { success: false, error: { message: error.message, code: 'DATABASE_ERROR' } };
    }

    return {
      success: true,
      data: {
        products: products || [],
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

    const { data: product, error } = await adminClient
      .from('products')
      .select(
        `
        *,
        category:categories(id, name),
        supplier:suppliers(id, company_name, contact_person),
        images:product_images(id, image_url, sort_order, is_primary),
        specifications:product_specifications(id, spec_name, spec_value, sort_order)
      `
      )
      .eq('id', productId)
      .single();

    if (error || !product) {
      return { success: false, error: { message: 'Product not found', code: 'NOT_FOUND' } };
    }

    return { success: true, data: { product } };
  } catch (error) {
    console.error('[getProductForAdminDetail] Error:', error);
    return { success: false, error: { message: 'Failed to load product', code: 'INTERNAL_ERROR' } };
  }
}
