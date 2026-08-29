import type { SpecRow } from '@/app/admin/products/types';

export type ProductFormMode =
  | 'create-admin'
  | 'create-supplier'
  | 'edit-admin'
  | 'edit-supplier'
  | 'review-admin';

export type ProductImageItem = {
  id?: string;
  image_url: string;
  sort_order?: number;
  is_primary?: boolean;
  file?: File;
  previewUrl?: string;
};

export type PendingRequest = {
  id: string;
  request_type: string;
  status: string;
  proposed_data?: Record<string, unknown>;
  created_at?: string;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  rejection_reason?: string | null;
};

export type ProductFormProduct = {
  id: string;
  name: string;
  description?: string | null;
  category_id?: string;
  supplier_id?: string | null;
  sku?: string | null;
  stock_quantity?: number;
  moq?: number;
  suggested_moq?: number | null;
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
  is_draft?: boolean;
  category?: { id: string; name: string };
  supplier?: {
    id: string;
    company_name?: string;
    country?: string;
    status?: string;
  } | null;
  images?: ProductImageItem[];
  specifications?: { id?: string; spec_name: string; spec_value: string; sort_order?: number }[];
  pendingRequest?: PendingRequest | null;
  priceHistory?: { id: string; snapshot: unknown; created_at: string }[];
};

export type ProductFormValues = {
  name: string;
  categoryId: string;
  supplierId: string;
  description: string;
  sku: string;
  moq: number;
  suggestedMoq: number;
  ribbon: string;
  specRows: SpecRow[];
  supplierPrice: number;
  profitType: 'percentage' | 'fixed';
  profit: number;
  discount: number;
  discountEnabled: boolean;
  gst: number;
  gstIncluded: boolean;
  minValue: number;
  locationMode: string;
  locationOther: string;
  images: ProductImageItem[];
  pendingImageFiles: File[];
};

export type CategoryOption = { id: string; name: string };
export type SupplierOption = { id: string; company_name: string; country?: string };

export const EMPTY_PRODUCT_FORM: ProductFormValues = {
  name: '',
  categoryId: '',
  supplierId: '',
  description: '',
  sku: '',
  moq: 100,
  suggestedMoq: 100,
  ribbon: '',
  specRows: [],
  supplierPrice: 0,
  profitType: 'percentage',
  profit: 15,
  discount: 0,
  discountEnabled: false,
  gst: 18,
  gstIncluded: false,
  minValue: 0,
  locationMode: '',
  locationOther: '',
  images: [],
  pendingImageFiles: [],
};
