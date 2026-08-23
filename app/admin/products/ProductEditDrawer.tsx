'use client';

import React, { useEffect, useRef } from 'react';
import { X, Loader2 } from 'lucide-react';
import { RemoteImage } from '@/components/ui/RemoteImage';
import ProductDetailsSection from './ProductDetailsSection';
import ProductSupplierSection from './ProductSupplierSection';
import ProductStatusSection from './ProductStatusSection';
import ProductPricingSection from './ProductPricingSection';
import { parseImageUrls } from './types';
import type { AdminProduct, SpecRow } from './types';

const SECTIONS = [
  { id: 'panel-details', label: 'Details' },
  { id: 'panel-supplier', label: 'Supplier' },
  { id: 'panel-status', label: 'Status' },
  { id: 'panel-pricing', label: 'Pricing' },
  { id: 'panel-images', label: 'Images' },
] as const;

export type EditFormState = {
  name: string;
  categoryId: string;
  supplierId: string;
  description: string;
  sku: string;
  moq: number;
  ribbon: string;
  specRows: SpecRow[];
  supplierPrice: number;
  profit: number;
  discount: number;
  gst: number;
  gstIncluded: boolean;
  minValue: number;
  imageUrls: string;
  locationMode: string;
  locationOther: string;
  originalCountry: string;
};

type ProductEditDrawerProps = {
  open: boolean;
  product: AdminProduct | null;
  form: EditFormState;
  categories: { id: string; name: string }[];
  suppliers: { id: string; company_name: string; country?: string }[];
  supplierName: string;
  detailLoading: boolean;
  saving: boolean;
  formError: string;
  copied: boolean;
  isPending: (key: string) => boolean;
  mutationKey: (id: string, action: string) => string;
  onFormChange: (patch: Partial<EditFormState>) => void;
  onCopyId: () => void;
  onClose: () => void;
  onSave: (e: React.FormEvent) => void;
  onApprove: () => void;
  onTogglePublish: () => void;
  onToggleArchive: () => void;
};

export default function ProductEditDrawer({
  open,
  product,
  form,
  categories,
  suppliers,
  supplierName,
  detailLoading,
  saving,
  formError,
  copied,
  isPending,
  mutationKey,
  onFormChange,
  onCopyId,
  onClose,
  onSave,
  onApprove,
  onTogglePublish,
  onToggleArchive,
}: ProductEditDrawerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = React.useState<string>(SECTIONS[0].id);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !product) return null;

  const previewUrls = parseImageUrls(form.imageUrls);

  function scrollToSection(id: string) {
    setActiveSection(id);
    const el = scrollRef.current?.querySelector(`#${id}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close panel"
        className="absolute inset-0 bg-portal-hero/40 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-2xl bg-portal-panel shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-portal-border shrink-0">
          <div>
            <h3 className="text-base font-medium text-portal-text line-clamp-1">
              {detailLoading ? 'Loading…' : form.name || 'Edit product'}
            </h3>
            <p className="text-[11px] text-portal-muted mt-0.5">Product management panel</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-portal-muted hover:text-portal-text hover:bg-portal-hover"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-1 px-5 py-2 border-b border-portal-border overflow-x-auto shrink-0">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => scrollToSection(s.id)}
              className={`text-[11px] py-1.5 px-3 rounded-full whitespace-nowrap transition-colors ${
                activeSection === s.id
                  ? 'bg-portal-hero text-portal-hero-text'
                  : 'bg-portal-inset text-portal-muted hover:text-portal-text'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {formError && (
          <div className="mx-5 mt-3 text-xs text-portal-danger bg-portal-danger-soft rounded-lg p-2.5 shrink-0">
            {formError}
          </div>
        )}

        <form onSubmit={onSave} className="flex flex-col flex-1 min-h-0">
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-8">
            {detailLoading ? (
              <div className="flex flex-col items-center justify-center py-16 text-portal-muted">
                <Loader2 className="w-6 h-6 animate-spin mb-2" />
                <span className="text-xs">Loading product details…</span>
              </div>
            ) : (
              <>
                <ProductDetailsSection
                  name={form.name}
                  categoryId={form.categoryId}
                  description={form.description}
                  sku={form.sku}
                  moq={form.moq}
                  ribbon={form.ribbon}
                  specRows={form.specRows}
                  categories={categories}
                  onNameChange={(v) => onFormChange({ name: v })}
                  onCategoryChange={(v) => onFormChange({ categoryId: v })}
                  onDescriptionChange={(v) => onFormChange({ description: v })}
                  onSkuChange={(v) => onFormChange({ sku: v })}
                  onMoqChange={(v) => onFormChange({ moq: v })}
                  onRibbonChange={(v) => onFormChange({ ribbon: v })}
                  onSpecRowsChange={(rows) => onFormChange({ specRows: rows })}
                />

                <ProductSupplierSection
                  supplierId={form.supplierId}
                  supplierName={supplierName}
                  locationMode={form.locationMode}
                  locationOther={form.locationOther}
                  suppliers={suppliers}
                  copied={copied}
                  onSupplierChange={(id) => onFormChange({ supplierId: id })}
                  onLocationModeChange={(mode) => onFormChange({ locationMode: mode })}
                  onLocationOtherChange={(v) => onFormChange({ locationOther: v })}
                  onCopyId={onCopyId}
                />

                <ProductStatusSection
                  product={product}
                  categoryId={form.categoryId}
                  supplierId={form.supplierId}
                  categories={categories}
                  suppliers={suppliers}
                  isPending={isPending}
                  mutationKey={mutationKey}
                  onCategoryChange={(v) => onFormChange({ categoryId: v })}
                  onSupplierChange={(id) => onFormChange({ supplierId: id })}
                  onApprove={onApprove}
                  onTogglePublish={onTogglePublish}
                  onToggleArchive={onToggleArchive}
                />

                <ProductPricingSection
                  supplierPrice={form.supplierPrice}
                  profit={form.profit}
                  discount={form.discount}
                  gst={form.gst}
                  gstIncluded={form.gstIncluded}
                  minValue={form.minValue}
                  onSupplierPriceChange={(v) => onFormChange({ supplierPrice: v })}
                  onProfitChange={(v) => onFormChange({ profit: v })}
                  onDiscountChange={(v) => onFormChange({ discount: v })}
                  onGstChange={(v) => onFormChange({ gst: v })}
                  onGstIncludedChange={(v) => onFormChange({ gstIncluded: v })}
                  onMinValueChange={(v) => onFormChange({ minValue: v })}
                />

                <section id="panel-images" className="space-y-3 scroll-mt-4">
                  <h4 className="type-section text-sm border-b border-portal-border pb-2">Images</h4>
                  <div>
                    <label className="saas-label">Image URLs (one per line, max 8)</label>
                    <textarea
                      rows={3}
                      placeholder="https://…"
                      value={form.imageUrls}
                      onChange={(e) => onFormChange({ imageUrls: e.target.value })}
                      className="saas-input text-xs resize-y font-mono"
                    />
                  </div>
                  {previewUrls.length > 0 && (
                    <div className="grid grid-cols-4 gap-2">
                      {previewUrls.map((url, i) => (
                        <div key={i} className="relative aspect-square rounded-lg bg-portal-inset overflow-hidden">
                          <RemoteImage src={url} alt={`Preview ${i + 1}`} sizes="80px" />
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}
          </div>

          <div className="flex justify-end gap-2 px-5 py-4 border-t border-portal-border bg-portal-panel shrink-0">
            <button type="button" onClick={onClose} className="saas-btn-secondary text-xs py-2 px-3">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || detailLoading}
              className="saas-btn-primary text-xs py-2 px-4 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
