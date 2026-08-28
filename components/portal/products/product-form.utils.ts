import type { ProductFormProduct, ProductFormValues } from './product-form.types';
import { specsToRows } from '@/app/admin/products/types';
import { resolveLocationState } from '@/app/admin/products/ProductSupplierSection';

export function generateSku(name: string, categoryName?: string): string {
  const catPrefix = (categoryName || 'PRD')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 4)
    .toUpperCase();
  const namePart = name
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 6)
    .toUpperCase();
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${catPrefix || 'PRD'}-${namePart || 'ITEM'}-${suffix}`;
}

export function productToFormValues(product: ProductFormProduct): ProductFormValues {
  const country = product.supplier?.country || '';
  const loc = resolveLocationState(country);
  const proposed = product.pendingRequest?.proposed_data as Record<string, unknown> | undefined;
  const isUpdatePending = product.pendingRequest?.status === 'update_pending' && proposed;
  const discount =
    (isUpdatePending ? (proposed?.discount as number | undefined) : undefined) ??
    product.discount ??
    0;

  const proposedImageUrls =
    isUpdatePending && Array.isArray(proposed?.image_urls)
      ? (proposed.image_urls as string[])
      : null;

  const rawImages = proposedImageUrls
    ? proposedImageUrls.map((url, idx) => ({
        id: `proposed-${idx}`,
        image_url: url,
        sort_order: idx,
        is_primary: idx === 0,
      }))
    : (product.images || []);

  const sortedImages = [...rawImages].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  );

  return {
    name:
      (isUpdatePending ? (proposed?.name as string | undefined) : undefined) ??
      product.name ??
      '',
    categoryId:
      (isUpdatePending ? (proposed?.category_id as string | undefined) : undefined) ??
      product.category_id ??
      product.category?.id ??
      '',
    supplierId: product.supplier_id || product.supplier?.id || '',
    description:
      (isUpdatePending ? (proposed?.description as string | undefined) : undefined) ??
      product.description ??
      '',
    sku: (proposed?.sku as string) ?? product.sku ?? '',
    moq: product.moq ?? 100,
    suggestedMoq:
      (proposed?.suggested_moq as number) ??
      product.suggested_moq ??
      product.moq ??
      100,
    ribbon: product.ribbon_label || '',
    specRows: specsToRows(
      (proposed?.specifications as ProductFormProduct['specifications']) || product.specifications
    ),
    supplierPrice:
      (proposed?.supplier_price as number) ?? product.supplier_price ?? 0,
    profit: product.profit_value ?? 15,
    discount,
    discountEnabled: discount > 0,
    gst: (proposed?.gst_rate as number) ?? product.gst_rate ?? 18,
    gstIncluded: (proposed?.gst_included as boolean) ?? product.gst_included ?? false,
    minValue: (proposed?.min_order_value as number) ?? product.min_order_value ?? 0,
    locationMode: loc.mode,
    locationOther: loc.other,
    images: sortedImages.map((img) => ({
      id: img.id,
      image_url: img.image_url,
      sort_order: img.sort_order,
      is_primary: img.is_primary,
    })),
    pendingImageFiles: [],
  };
}

export function validateFormValues(
  values: ProductFormValues,
  mode: string,
  opts?: { draft?: boolean }
): Record<string, string> {
  const errors: Record<string, string> = {};
  const isSupplier = mode.includes('supplier');
  const isAdmin = mode.includes('admin');

  if (!values.name.trim() || values.name.trim().length < 2) {
    errors.name = 'Product name is required (min 2 characters)';
  }
  if (!opts?.draft && !values.categoryId) {
    errors.categoryId = 'Category is required';
  }
  if (!opts?.draft && values.supplierPrice < 0) {
    errors.supplierPrice = 'Factory price must be non-negative';
  }

  if (isSupplier && !opts?.draft && values.suggestedMoq < 1) {
    errors.suggestedMoq = 'Suggested MOQ must be at least 1';
  }
  if (isAdmin && !opts?.draft && values.moq < 1) {
    errors.moq = 'Catalog MOQ must be at least 1';
  }

  if (isAdmin) {
    if (values.profit < 0) {
      errors.profit = 'Margin must be non-negative';
    }
    if (values.gst < 0 || values.gst > 100) {
      errors.gst = 'GST must be between 0 and 100';
    }
    if (values.discountEnabled && values.discount < 0) {
      errors.discount = 'Discount cannot be negative';
    }
  }

  const incompleteSpec = values.specRows.some(
    (r) =>
      (r.spec_name.trim() && !r.spec_value.trim()) ||
      (!r.spec_name.trim() && r.spec_value.trim())
  );
  if (incompleteSpec) {
    errors.specRows = 'Each specification needs both name and value';
  }
  return errors;
}

export function buildPayload(
  values: ProductFormValues,
  _categories: { id: string; name: string }[],
  opts?: { isSupplier?: boolean }
) {
  const specifications = values.specRows
    .map((row, idx) => ({
      spec_name: row.spec_name.trim(),
      spec_value: row.spec_value.trim(),
      sort_order: idx,
    }))
    .filter((s) => s.spec_name && s.spec_value);

  const discount = values.discountEnabled ? values.discount : 0;

  const payload: Record<string, unknown> = {
    name: values.name.trim(),
    categoryId: values.categoryId,
    supplierId: values.supplierId || null,
    description: values.description.trim() || undefined,
    sku: values.sku.trim() || null,
    suggestedMoq: values.suggestedMoq,
    supplierPrice: values.supplierPrice,
    gstRate: values.gst,
    gstIncluded: values.gstIncluded,
    discount,
    minOrderValue: values.minValue > 0 ? values.minValue : null,
    profitType: 'percentage' as const,
    profitValue: values.profit,
    ribbonLabel: values.ribbon.trim() || null,
    specifications,
  };

  if (!opts?.isSupplier) {
    payload.moq = values.moq;
  }

  return payload;
}
