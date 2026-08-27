'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Check,
  ImageIcon,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from 'lucide-react';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import {
  cachedApiGet,
  markPortalContentReady,
  peekPortalCache,
  setPortalCache,
} from '@/lib/client/portal-data-cache';

type HeroSlide = {
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

type ProductOption = {
  id: string;
  name: string;
  categoryName: string | null;
  thumbnailUrl: string | null;
};

type CarouselSlot = {
  id?: string;
  productId: string;
  sortOrder: number;
  isActive: boolean;
  overrideImageUrl: string | null;
  overrideStoragePath?: string | null;
  productName?: string;
  categoryName?: string | null;
  thumbnailUrl?: string | null;
};

type HomepageData = {
  heroSlides: HeroSlide[];
  assets: {
    containersImageUrl: string | null;
    containersStoragePath: string | null;
  };
  carouselSlots: CarouselSlot[];
  productOptions: ProductOption[];
};

const HERO_ACCEPT = 'image/webp,image/png,image/jpeg';
const MAX_HERO = 6;
const MAX_CAROUSEL = 12;

function emptyHeroSlide(sortOrder: number): HeroSlide {
  return {
    sortOrder,
    isActive: true,
    imageUrl: '',
    storagePath: null,
    eyebrow: 'B2B SOURCING. FACTORY-DIRECT PRICING.',
    title: '',
    subtitle: '',
    cta1Label: 'Explore Services',
    cta1Href: '/#services',
    cta2Label: 'Get a Quote',
    cta2Href: '/enquiry',
  };
}

function InstructionPanel({
  title,
  specs,
}: {
  title: string;
  specs: string[];
}) {
  return (
    <div className="rounded-xl border border-portal-border bg-portal-inset px-4 py-3">
      <p className="font-semibold text-[11px] text-portal-text mb-2">{title}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-1.5">
        {specs.map((spec) => (
          <p key={spec} className="text-[11px] text-portal-muted leading-snug">
            · {spec}
          </p>
        ))}
      </div>
    </div>
  );
}

async function readImageDimensions(
  file: File
): Promise<{ width: number; height: number } | null> {
  try {
    const url = URL.createObjectURL(file);
    const dims = await new Promise<{ width: number; height: number } | null>((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
        URL.revokeObjectURL(url);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
    return dims;
  } catch {
    return null;
  }
}

function aspectWarn(
  width: number,
  height: number,
  targetRatio: number,
  tolerance = 0.18
): string | null {
  if (!width || !height) return null;
  const ratio = width / height;
  if (Math.abs(ratio - targetRatio) > tolerance) {
    return `Uploaded ${width}×${height} (ratio ${ratio.toFixed(2)}). Expected ~${targetRatio.toFixed(2)} — may crop or letterbox.`;
  }
  return null;
}

export default function AdminHomepagePage() {
  const cached = peekPortalCache<HomepageData>('/api/admin/homepage');
  const [loading, setLoading] = useState(!cached);
  const [heroSlides, setHeroSlides] = useState<HeroSlide[]>(cached?.data.heroSlides || []);
  const [containersUrl, setContainersUrl] = useState(
    cached?.data.assets.containersImageUrl || ''
  );
  const [carouselSlots, setCarouselSlots] = useState<CarouselSlot[]>(
    cached?.data.carouselSlots || []
  );
  const [productOptions, setProductOptions] = useState<ProductOption[]>(
    cached?.data.productOptions || []
  );
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [savingHero, setSavingHero] = useState(false);
  const [savingCarousel, setSavingCarousel] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [warnMsg, setWarnMsg] = useState('');

  const flashSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const applyBundle = useCallback((data: HomepageData) => {
    setHeroSlides(
      (data.heroSlides || []).map((s, i) => ({
        ...s,
        sortOrder: s.sortOrder ?? i,
      }))
    );
    setContainersUrl(data.assets?.containersImageUrl || '');
    setCarouselSlots(
      (data.carouselSlots || []).map((s, i) => ({
        ...s,
        sortOrder: s.sortOrder ?? i,
      }))
    );
    setProductOptions(data.productOptions || []);
  }, []);

  async function loadHomepage(force = false) {
    const existing = peekPortalCache<HomepageData>('/api/admin/homepage');
    if (existing && !force) {
      applyBundle(existing.data);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setErrorMsg('');
    try {
      const result = await cachedApiGet<HomepageData>('/api/admin/homepage', {
        force: force || !existing,
      });
      if (result.ok && result.data) {
        applyBundle(result.data);
        markPortalContentReady('/admin/homepage');
      } else if (!result.ok) {
        setErrorMsg(result.message || 'Failed to load homepage CMS.');
      }
    } catch {
      setErrorMsg('Failed to load homepage CMS.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadHomepage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const usedProductIds = useMemo(
    () => new Set(carouselSlots.map((s) => s.productId).filter(Boolean)),
    [carouselSlots]
  );

  function optionsForSlot(slotIndex: number): ProductOption[] {
    const currentId = carouselSlots[slotIndex]?.productId;
    return productOptions.filter(
      (p) => p.id === currentId || !usedProductIds.has(p.id)
    );
  }

  async function saveHero() {
    setSavingHero(true);
    setErrorMsg('');
    try {
      const payload = heroSlides.map((s, i) => ({
        id: s.id,
        sortOrder: i,
        isActive: s.isActive,
        imageUrl: s.imageUrl,
        storagePath: s.storagePath ?? null,
        eyebrow: s.eyebrow,
        title: s.title,
        subtitle: s.subtitle,
        cta1Label: s.cta1Label,
        cta1Href: s.cta1Href,
        cta2Label: s.cta2Label,
        cta2Href: s.cta2Href,
      }));
      const res = await fetch('/api/admin/homepage/hero', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slides: payload }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMsg(json.error?.message || 'Failed to save hero slides.');
        return;
      }
      setHeroSlides(json.data.heroSlides);
      setPortalCache('/api/admin/homepage', {
        heroSlides: json.data.heroSlides,
        assets: { containersImageUrl: containersUrl, containersStoragePath: null },
        carouselSlots,
        productOptions,
      });
      flashSuccess('Hero slides saved. Homepage will refresh shortly.');
    } catch {
      setErrorMsg('Failed to save hero slides.');
    } finally {
      setSavingHero(false);
    }
  }

  async function uploadHeroImage(index: number, file: File) {
    setUploading(`hero-${index}`);
    setErrorMsg('');
    setWarnMsg('');
    const dims = await readImageDimensions(file);
    if (dims) {
      const warn = aspectWarn(dims.width, dims.height, 1920 / 900);
      if (warn) setWarnMsg(`Hero: ${warn}`);
    }

    try {
      const slide = heroSlides[index];
      const form = new FormData();
      form.set('file', file);
      if (slide?.id) form.set('slideId', slide.id);

      const res = await fetch('/api/admin/homepage/hero/image', {
        method: 'POST',
        body: form,
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMsg(json.error?.message || 'Hero image upload failed.');
        return;
      }

      setHeroSlides((prev) =>
        prev.map((s, i) =>
          i === index
            ? {
                ...s,
                imageUrl: json.data.url,
                storagePath: json.data.storagePath,
              }
            : s
        )
      );
      flashSuccess('Hero image uploaded. Click Save hero slides if other fields changed.');
    } catch {
      setErrorMsg('Hero image upload failed.');
    } finally {
      setUploading(null);
    }
  }

  async function removeHeroSlide(index: number) {
    const slide = heroSlides[index];
    if (slide?.id) {
      const res = await fetch(`/api/admin/homepage/hero/${slide.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMsg(json.error?.message || 'Failed to delete slide.');
        return;
      }
    }
    setHeroSlides((prev) => prev.filter((_, i) => i !== index));
    if (editingIndex === index) setEditingIndex(null);
    flashSuccess('Slide removed.');
  }

  async function uploadContainers(file: File) {
    setUploading('containers');
    setErrorMsg('');
    setWarnMsg('');
    const dims = await readImageDimensions(file);
    if (dims) {
      const warn = aspectWarn(dims.width, dims.height, 1560 / 920);
      if (warn) setWarnMsg(`Containers: ${warn}`);
    }

    try {
      const form = new FormData();
      form.set('file', file);
      const res = await fetch('/api/admin/homepage/containers', {
        method: 'POST',
        body: form,
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMsg(json.error?.message || 'Containers upload failed.');
        return;
      }
      setContainersUrl(json.data.url);
      flashSuccess('Containers cutout updated on homepage.');
    } catch {
      setErrorMsg('Containers upload failed.');
    } finally {
      setUploading(null);
    }
  }

  async function resetContainers() {
    setUploading('containers-reset');
    setErrorMsg('');
    try {
      const form = new FormData();
      form.set('action', 'reset');
      const res = await fetch('/api/admin/homepage/containers', {
        method: 'POST',
        body: form,
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMsg(json.error?.message || 'Reset failed.');
        return;
      }
      setContainersUrl(json.data.url);
      flashSuccess('Containers image reset to default cutout.');
    } catch {
      setErrorMsg('Reset failed.');
    } finally {
      setUploading(null);
    }
  }

  async function saveCarousel() {
    setSavingCarousel(true);
    setErrorMsg('');
    try {
      const payload = carouselSlots.map((s, i) => ({
        id: s.id,
        productId: s.productId,
        sortOrder: i,
        isActive: s.isActive,
        overrideImageUrl: s.overrideImageUrl,
        overrideStoragePath: s.overrideStoragePath ?? null,
      }));
      const res = await fetch('/api/admin/homepage/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slots: payload }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMsg(json.error?.message || 'Failed to save carousel products.');
        return;
      }
      setCarouselSlots(json.data.carouselSlots);
      flashSuccess('Product carousel saved. Homepage will refresh shortly.');
      await loadHomepage(true);
    } catch {
      setErrorMsg('Failed to save carousel products.');
    } finally {
      setSavingCarousel(false);
    }
  }

  async function uploadOverride(slotIndex: number, file: File) {
    const slot = carouselSlots[slotIndex];
    if (!slot?.id) {
      setErrorMsg('Save the carousel first, then upload an override image for that row.');
      return;
    }

    setUploading(`override-${slotIndex}`);
    setErrorMsg('');
    setWarnMsg('');
    const dims = await readImageDimensions(file);
    if (dims) {
      const warn = aspectWarn(dims.width, dims.height, 570 / 820);
      if (warn) setWarnMsg(`Product card: ${warn}`);
    }

    try {
      const form = new FormData();
      form.set('file', file);
      form.set('slotId', slot.id);
      const res = await fetch('/api/admin/homepage/products/image', {
        method: 'POST',
        body: form,
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMsg(json.error?.message || 'Override upload failed.');
        return;
      }
      setCarouselSlots((prev) =>
        prev.map((s, i) =>
          i === slotIndex
            ? {
                ...s,
                overrideImageUrl: json.data.url,
                overrideStoragePath: json.data.storagePath,
                thumbnailUrl: json.data.url,
              }
            : s
        )
      );
      flashSuccess('Override image uploaded for this carousel slot.');
    } catch {
      setErrorMsg('Override upload failed.');
    } finally {
      setUploading(null);
    }
  }

  function moveHero(index: number, dir: -1 | 1) {
    const next = index + dir;
    if (next < 0 || next >= heroSlides.length) return;
    setHeroSlides((prev) => {
      const copy = [...prev];
      const tmp = copy[index];
      copy[index] = copy[next];
      copy[next] = tmp;
      return copy.map((s, i) => ({ ...s, sortOrder: i }));
    });
  }

  function moveCarousel(index: number, dir: -1 | 1) {
    const next = index + dir;
    if (next < 0 || next >= carouselSlots.length) return;
    setCarouselSlots((prev) => {
      const copy = [...prev];
      const tmp = copy[index];
      copy[index] = copy[next];
      copy[next] = tmp;
      return copy.map((s, i) => ({ ...s, sortOrder: i }));
    });
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-portal-muted">
        <Loader2 className="w-6 h-6 animate-spin mb-2" />
        <span className="text-xs">Loading homepage CMS…</span>
      </div>
    );
  }

  const editing = editingIndex != null ? heroSlides[editingIndex] : null;

  return (
    <div className="space-y-6 w-full max-w-none">
      <AdminPageHeader
        title="Homepage"
        description="Live CMS for hero slides, containers cutout, and the 3D product carousel. Changes update the public homepage."
        actions={
          <button type="button" onClick={() => loadHomepage(true)} className="saas-btn-secondary gap-2">
            <RefreshCw className="w-4 h-4" />
            Reload
          </button>
        }
      />

      {successMsg && (
        <div className="p-3 rounded-xl bg-portal-success-soft text-xs text-portal-success flex items-center gap-2 font-medium">
          <Check className="w-4 h-4 shrink-0" />
          {successMsg}
        </div>
      )}
      {warnMsg && (
        <div className="p-3 rounded-xl bg-amber-50 text-xs text-amber-900 flex items-center gap-2 font-medium border border-amber-200">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {warnMsg}
        </div>
      )}
      {errorMsg && (
        <div className="p-3 rounded-xl bg-portal-danger-soft text-xs text-portal-danger flex items-center gap-2 font-medium">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {errorMsg}
        </div>
      )}

      {/* Hero slides — full width */}
      <section className="saas-panel p-5 sm:p-6 lg:p-7 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-portal-border pb-4">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-portal-text" />
            <h2 className="type-section text-sm">Hero slides</h2>
            <span className="text-[11px] text-portal-muted">
              {heroSlides.length}/{MAX_HERO}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={heroSlides.length >= MAX_HERO}
              onClick={() => {
                setHeroSlides((prev) => [...prev, emptyHeroSlide(prev.length)]);
                setEditingIndex(heroSlides.length);
              }}
              className="saas-btn-secondary text-xs gap-1.5 px-3 py-2 disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              Add slide
            </button>
            <button
              type="button"
              disabled={savingHero}
              onClick={saveHero}
              className="saas-btn-primary text-xs gap-1.5 px-4 py-2 disabled:opacity-50"
            >
              {savingHero ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save hero slides
            </button>
          </div>
        </div>

        <InstructionPanel
          title="Safe change — hero only (does not affect containers or product cards)"
          specs={[
            'WebP preferred (JPEG/PNG ok) · target 1920×900',
            'Keep focal subject in the right 55% — left is text',
            'Under 400 KB · no cutouts or tall portraits · not Settings banner',
          ]}
        />

        <div className="space-y-4">
          {heroSlides.map((slide, index) => (
            <div
              key={slide.id || `new-${index}`}
              className="rounded-xl border border-portal-border p-4 lg:p-5 grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)_auto] gap-4 lg:gap-6 items-start"
            >
              <div className="w-full h-36 lg:h-28 rounded-xl overflow-hidden bg-portal-panel border border-portal-border">
                {slide.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={slide.imageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[11px] text-portal-muted">
                    No image
                  </div>
                )}
              </div>

              <div className="min-w-0 space-y-2">
                <p className="text-sm font-semibold text-portal-text whitespace-pre-line">
                  {slide.title || 'Untitled slide'}
                </p>
                <p className="text-xs text-portal-muted leading-relaxed line-clamp-3 max-w-3xl">
                  {slide.subtitle}
                </p>
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <label className="saas-btn-secondary text-xs py-2 px-3.5 cursor-pointer inline-flex items-center gap-2">
                    {uploading === `hero-${index}` ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : null}
                    Upload image
                    <input
                      type="file"
                      accept={HERO_ACCEPT}
                      className="sr-only"
                      disabled={!!uploading}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadHeroImage(index, f);
                        e.target.value = '';
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className="saas-btn-secondary text-xs py-2 px-3.5"
                    onClick={() => setEditingIndex(index)}
                  >
                    Edit copy
                  </button>
                  <label className="inline-flex items-center gap-2 text-xs text-portal-muted px-1">
                    <input
                      type="checkbox"
                      className="rounded"
                      checked={slide.isActive}
                      onChange={(e) =>
                        setHeroSlides((prev) =>
                          prev.map((s, i) =>
                            i === index ? { ...s, isActive: e.target.checked } : s
                          )
                        )
                      }
                    />
                    Active on homepage
                  </label>
                </div>
              </div>

              <div className="flex lg:flex-col items-center gap-2 lg:gap-2.5 lg:pt-1">
                <button
                  type="button"
                  title="Move up"
                  className="saas-btn-secondary p-2.5 disabled:opacity-40"
                  onClick={() => moveHero(index, -1)}
                  disabled={index === 0}
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  title="Move down"
                  className="saas-btn-secondary p-2.5 disabled:opacity-40"
                  onClick={() => moveHero(index, 1)}
                  disabled={index === heroSlides.length - 1}
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  title="Delete slide"
                  className="saas-btn-secondary p-2.5 text-portal-danger hover:bg-portal-danger-soft"
                  onClick={() => removeHeroSlide(index)}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {heroSlides.length === 0 && (
            <p className="text-xs text-portal-muted py-6 text-center">
              No slides yet — add one to populate the hero.
            </p>
          )}
        </div>

        {editing && editingIndex != null && (
          <div className="rounded-xl border border-portal-border bg-portal-panel p-5 lg:p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">Edit slide #{editingIndex + 1}</p>
              <button
                type="button"
                className="saas-btn-secondary text-xs py-2 px-3"
                onClick={() => setEditingIndex(null)}
              >
                Done
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {(
                [
                  ['eyebrow', 'Eyebrow'],
                  ['title', 'Title (use line breaks)'],
                  ['subtitle', 'Subtitle'],
                  ['cta1Label', 'CTA 1 label'],
                  ['cta1Href', 'CTA 1 link'],
                  ['cta2Label', 'CTA 2 label'],
                  ['cta2Href', 'CTA 2 link'],
                ] as const
              ).map(([key, label]) => (
                <div
                  key={key}
                  className={
                    key === 'subtitle' || key === 'title'
                      ? 'md:col-span-2 xl:col-span-4'
                      : ''
                  }
                >
                  <label className="saas-label">{label}</label>
                  {key === 'subtitle' || key === 'title' ? (
                    <textarea
                      rows={key === 'title' ? 2 : 3}
                      value={editing[key]}
                      onChange={(e) =>
                        setHeroSlides((prev) =>
                          prev.map((s, i) =>
                            i === editingIndex ? { ...s, [key]: e.target.value } : s
                          )
                        )
                      }
                      className="saas-input text-xs min-h-[64px]"
                    />
                  ) : (
                    <input
                      type="text"
                      value={editing[key]}
                      onChange={(e) =>
                        setHeroSlides((prev) =>
                          prev.map((s, i) =>
                            i === editingIndex ? { ...s, [key]: e.target.value } : s
                          )
                        )
                      }
                      className="saas-input text-xs"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Containers + Carousel side by side on large screens */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Containers cutout */}
        <section className="saas-panel p-5 sm:p-6 lg:p-7 space-y-5 xl:col-span-5">
          <div className="flex items-center gap-2 border-b border-portal-border pb-4">
            <ImageIcon className="w-4 h-4 text-portal-text" />
            <h2 className="type-section text-sm">Containers cutout</h2>
          </div>

          <InstructionPanel
            title="Safe change — cutout only"
            specs={[
              'Transparent WebP/PNG · target 1560×920',
              '≥8% padding · object-contain (no crop)',
              'Under 250 KB · not full-bleed hero photos',
            ]}
          />

          <div
            className="rounded-xl border border-portal-border p-6 min-h-[220px] flex justify-center items-center"
            style={{
              backgroundImage:
                'linear-gradient(45deg,#e5e7eb 25%,transparent 25%),linear-gradient(-45deg,#e5e7eb 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e5e7eb 75%),linear-gradient(-45deg,transparent 75%,#e5e7eb 75%)',
              backgroundSize: '16px 16px',
              backgroundPosition: '0 0,0 8px,8px -8px,-8px 0',
              backgroundColor: '#f9fafb',
            }}
          >
            {containersUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={containersUrl}
                alt="Containers cutout preview"
                className="max-h-56 w-full object-contain"
              />
            ) : (
              <p className="text-xs text-portal-muted py-8">No cutout set</p>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <label className="saas-btn-secondary text-xs py-2.5 px-4 inline-flex items-center gap-2 cursor-pointer">
              {uploading === 'containers' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Upload cutout
              <input
                type="file"
                accept={HERO_ACCEPT}
                className="sr-only"
                disabled={!!uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadContainers(f);
                  e.target.value = '';
                }}
              />
            </label>
            <button
              type="button"
              className="saas-btn-secondary text-xs py-2.5 px-4"
              disabled={!!uploading}
              onClick={resetContainers}
            >
              {uploading === 'containers-reset' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : null}
              Reset to default
            </button>
          </div>
        </section>

        {/* Product carousel */}
        <section className="saas-panel p-5 sm:p-6 lg:p-7 space-y-5 xl:col-span-7">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-portal-border pb-4">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-portal-text" />
              <h2 className="type-section text-sm">3D product carousel</h2>
              <span className="text-[11px] text-portal-muted">
                {carouselSlots.length}/{MAX_CAROUSEL}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={carouselSlots.length >= MAX_CAROUSEL}
                onClick={() =>
                  setCarouselSlots((prev) => [
                    ...prev,
                    {
                      productId: '',
                      sortOrder: prev.length,
                      isActive: true,
                      overrideImageUrl: null,
                    },
                  ])
                }
                className="saas-btn-secondary text-xs gap-1.5 px-3 py-2 disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                Add product
              </button>
              <button
                type="button"
                disabled={savingCarousel}
                onClick={saveCarousel}
                className="saas-btn-primary text-xs gap-1.5 px-4 py-2 disabled:opacity-50"
              >
                {savingCarousel ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                Save carousel
              </button>
            </div>
          </div>

          <InstructionPanel
            title="Safe change — carousel products only"
            specs={[
              'Use the dropdown to pick or replace each product',
              'Override image: WebP · 570×820 (2:3) — not hero/cutout',
              'Save after dropdown changes · override upload after save',
            ]}
          />

          {carouselSlots.length === 0 ? (
            <p className="text-xs text-portal-muted py-8 text-center">
              No products in the carousel. Add products via dropdown.
            </p>
          ) : (
            <div className="space-y-3">
              {carouselSlots.map((slot, index) => {
                const opts = optionsForSlot(index);
                const thumb =
                  slot.overrideImageUrl ||
                  slot.thumbnailUrl ||
                  productOptions.find((p) => p.id === slot.productId)?.thumbnailUrl ||
                  null;
                return (
                  <div
                    key={slot.id || `slot-${index}`}
                    className="rounded-xl border border-portal-border p-4 grid grid-cols-1 sm:grid-cols-[72px_minmax(0,1fr)_auto] gap-4 items-center"
                  >
                    <div className="w-[72px] h-[96px] rounded-lg overflow-hidden bg-[#ECEEF0] border border-portal-border shrink-0 mx-auto sm:mx-0">
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumb} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] text-portal-muted">
                          —
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 space-y-2">
                      <label className="saas-label">Product #{index + 1}</label>
                      <select
                        className="saas-input text-xs"
                        value={slot.productId}
                        onChange={(e) => {
                          const productId = e.target.value;
                          const opt = productOptions.find((p) => p.id === productId);
                          setCarouselSlots((prev) =>
                            prev.map((s, i) =>
                              i === index
                                ? {
                                    ...s,
                                    productId,
                                    productName: opt?.name,
                                    categoryName: opt?.categoryName,
                                    thumbnailUrl: opt?.thumbnailUrl,
                                    overrideImageUrl: null,
                                    overrideStoragePath: null,
                                  }
                                : s
                            )
                          );
                        }}
                      >
                        <option value="">Select a published product…</option>
                        {opts.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                            {p.categoryName ? ` · ${p.categoryName}` : ''}
                          </option>
                        ))}
                      </select>
                      <div className="flex flex-wrap items-center gap-3 pt-1">
                        <label className="inline-flex items-center gap-2 text-xs text-portal-muted">
                          <input
                            type="checkbox"
                            className="rounded"
                            checked={slot.isActive}
                            onChange={(e) =>
                              setCarouselSlots((prev) =>
                                prev.map((s, i) =>
                                  i === index ? { ...s, isActive: e.target.checked } : s
                                )
                              )
                            }
                          />
                          Active
                        </label>
                        <label className="saas-btn-secondary text-xs py-2 px-3 cursor-pointer inline-flex items-center gap-2">
                          {uploading === `override-${index}` ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : null}
                          Override image
                          <input
                            type="file"
                            accept={HERO_ACCEPT}
                            className="sr-only"
                            disabled={!!uploading || !slot.id}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) uploadOverride(index, f);
                              e.target.value = '';
                            }}
                          />
                        </label>
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center justify-center gap-2">
                      <button
                        type="button"
                        title="Move up"
                        className="saas-btn-secondary p-2.5 disabled:opacity-40"
                        onClick={() => moveCarousel(index, -1)}
                        disabled={index === 0}
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        title="Move down"
                        className="saas-btn-secondary p-2.5 disabled:opacity-40"
                        onClick={() => moveCarousel(index, 1)}
                        disabled={index === carouselSlots.length - 1}
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        title="Remove"
                        className="saas-btn-secondary p-2.5 text-portal-danger hover:bg-portal-danger-soft"
                        onClick={() =>
                          setCarouselSlots((prev) => prev.filter((_, i) => i !== index))
                        }
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
