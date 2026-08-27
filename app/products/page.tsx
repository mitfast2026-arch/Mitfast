"use client";

/*
 * MITFAST Products Catalog — B2B Marketplace
 * Design: Monochrome industrial catalog matching product mock
 */

import React, { useState, useEffect, Suspense, useMemo, useRef } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Package,
  ChevronRight,
  ChevronLeft,
  SlidersHorizontal,
  LayoutGrid,
  List,
  X,
  ShoppingCart,
  Star,
  Check,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { CountryFlag } from "@/components/ui/CountryFlag";
import { resolveSupplierCountry } from "@/lib/country-origin";
import { getSettings } from "@/lib/client/settings-cache";
import { prefetchStorefrontProduct } from "@/lib/client/storefront-nav-prefetch";
import "./products-catalog.css";

/* ── Types ──────────────────────────────────────────────── */

interface ProductSpec {
  id?: string;
  spec_name: string;
  spec_value: string;
}

interface ProductImage {
  id?: string;
  image_url: string;
  is_primary?: boolean;
}

interface Product {
  id: string;
  name: string;
  description?: string;
  category_id?: string;
  category?: { id: string; name: string };
  moq: number;
  selling_price: number;
  discount?: number;
  ribbon_label?: string;
  images?: ProductImage[];
  specifications?: ProductSpec[];
  supplier?: {
    company_name?: string;
    name?: string;
    country?: string;
    address?: string;
  };
  supplier_name?: string;
  supplier_country?: string;
  stock_quantity?: number;
  unit?: string;
  spec_line?: string;
  rating?: number;
}

interface Category {
  id: string;
  name: string;
  count?: number;
}

const MOQ_OPTIONS = [
  { id: "1-100", label: "1–100", min: 1, max: 100 },
  { id: "101-500", label: "101–500", min: 101, max: 500 },
  { id: "501-1000", label: "501–1000", min: 501, max: 1000 },
  { id: "1000+", label: "1000+", min: 1000, max: Infinity },
];

/* ── Helpers ────────────────────────────────────────────── */

function getProductImageUrl(product: Product): string {
  return (
    product.images?.find((img) => img.is_primary)?.image_url ||
    product.images?.[0]?.image_url ||
    ""
  );
}

function formatPrice(value: number) {
  return `₹${value.toLocaleString("en-IN", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function getSpecLine(product: Product): string {
  if (product.spec_line) return product.spec_line;
  if (product.specifications?.length) {
    return product.specifications
      .slice(0, 3)
      .map((s) => s.spec_value || s.spec_name)
      .filter(Boolean)
      .join(" | ");
  }
  if (product.description) {
    const short = product.description.split(/[.\n]/)[0]?.trim();
    if (short) return short;
  }
  return "";
}

function getPriceDisplay(product: Product): {
  current: string;
  old?: string;
  unit: string;
} {
  const unit = product.unit || "piece";
  const selling = product.selling_price || 0;
  const discount = product.discount || 0;
  const finalPrice = Math.max(0, selling - discount);

  if (finalPrice <= 0 && selling <= 0) {
    return { current: "Quote on request", unit };
  }

  if (discount > 0 && selling > finalPrice) {
    return {
      old: formatPrice(selling),
      current: formatPrice(finalPrice),
      unit,
    };
  }

  return { current: formatPrice(finalPrice), unit };
}

function computeMoqBounds(selectedMoqIds: string[]): {
  moqMin?: number;
  moqMax?: number;
} {
  if (selectedMoqIds.length === 0) return {};
  const ranges = MOQ_OPTIONS.filter((o) => selectedMoqIds.includes(o.id));
  const moqMin = Math.min(...ranges.map((r) => r.min));
  const finiteMaxes = ranges.map((r) => r.max).filter((m) => Number.isFinite(m));
  const moqMax = finiteMaxes.length ? Math.max(...finiteMaxes) : undefined;
  return { moqMin, moqMax };
}

function getProductRating(product: Product): number | null {
  if (typeof product.rating === "number" && product.rating > 0) {
    return Math.min(5, Math.max(0, product.rating));
  }
  return null;
}

/* ── Filter panel ───────────────────────────────────────── */

type FilterPanelProps = {
  categories: Category[];
  categoriesExpanded: boolean;
  setCategoriesExpanded: (v: boolean) => void;
  selectedCategories: string[];
  onToggleCategory: (id: string) => void;
  minPriceInput: string;
  maxPriceInput: string;
  setMinPriceInput: (v: string) => void;
  setMaxPriceInput: (v: string) => void;
  selectedMoq: string[];
  onToggleMoq: (id: string) => void;
  onClear: () => void;
  onApply: () => void;
};

function FilterPanel({
  categories,
  categoriesExpanded,
  setCategoriesExpanded,
  selectedCategories,
  onToggleCategory,
  minPriceInput,
  maxPriceInput,
  setMinPriceInput,
  setMaxPriceInput,
  selectedMoq,
  onToggleMoq,
  onClear,
  onApply,
}: FilterPanelProps) {
  const visibleCats = categoriesExpanded ? categories : categories.slice(0, 4);

  return (
    <div className="pc-filters">
      <div className="pc-filter-panel">
        {/* Categories */}
        <div className="pc-filter-block">
          <h3 className="pc-filter-title">Categories</h3>
          {visibleCats.map((cat) => (
            <label key={cat.id} className="pc-check-row" title={cat.name}>
              <input
                type="checkbox"
                checked={selectedCategories.includes(cat.id)}
                onChange={() => onToggleCategory(cat.id)}
              />
              <span className="label" title={cat.name}>
                {cat.name}
              </span>
              <span className="count">
                {cat.count ?? (cat as any).productCount ?? "—"}
              </span>
            </label>
          ))}
          {categories.length > 4 && (
            <button
              type="button"
              className="pc-view-more"
              onClick={() => setCategoriesExpanded(!categoriesExpanded)}
            >
              {categoriesExpanded ? "− View less" : "+ View more"}
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="pc-filter-block">
          <div className="pc-filter-title-row">
            <h3 className="pc-filter-title">Filters</h3>
            <button type="button" className="pc-clear-link" onClick={onClear}>
              Clear all
            </button>
          </div>

          <div className="pc-filter-label">Unit price range (₹)</div>
          <div className="pc-price-inputs">
            <input
              type="number"
              min={0}
              placeholder="Min"
              value={minPriceInput}
              onChange={(e) => setMinPriceInput(e.target.value)}
              aria-label="Minimum unit price"
            />
            <span className="pc-price-sep">–</span>
            <input
              type="number"
              min={0}
              placeholder="Max"
              value={maxPriceInput}
              onChange={(e) => setMaxPriceInput(e.target.value)}
              aria-label="Maximum unit price"
            />
          </div>
        </div>

        <div className="pc-filter-block">
          <div className="pc-filter-label">MOQ</div>
          {MOQ_OPTIONS.map((opt) => (
            <label key={opt.id} className="pc-check-row">
              <input
                type="checkbox"
                checked={selectedMoq.includes(opt.id)}
                onChange={() => onToggleMoq(opt.id)}
              />
              <span className="label">{opt.label}</span>
            </label>
          ))}
        </div>

        <button type="button" className="pc-apply-btn" onClick={onApply}>
          Apply Filters
        </button>
      </div>
    </div>
  );
}

/* ── Main catalog ───────────────────────────────────────── */

function ProductsCatalogContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const quickRowRef = useRef<HTMLDivElement>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Record<string, boolean>>({});
  const [cartError, setCartError] = useState("");

  const currentCategory = searchParams.get("category") || "";
  const currentSort = searchParams.get("sort") || "relevance";
  const currentPage = parseInt(searchParams.get("page") || "1", 10);
  const currentSearch = searchParams.get("search") || "";
  const currentMinPrice = searchParams.get("minPrice") || "";
  const currentMaxPrice = searchParams.get("maxPrice") || "";
  const currentMoq = searchParams.get("moq") || "";
  const currentCats = searchParams.get("cats") || "";

  const [minPriceInput, setMinPriceInput] = useState(currentMinPrice);
  const [maxPriceInput, setMaxPriceInput] = useState(currentMaxPrice);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const DEFAULT_CATALOG_BANNER = "/images/product-page.png";
  const [bannerUrl, setBannerUrl] = useState<string>(DEFAULT_CATALOG_BANNER);
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);
  const [draftMoq, setDraftMoq] = useState<string[]>([]);
  const [draftCategories, setDraftCategories] = useState<string[]>([]);

  const selectedMoq = useMemo(
    () => (currentMoq ? currentMoq.split(",").filter(Boolean) : []),
    [currentMoq]
  );
  const selectedCategories = useMemo(() => {
    if (currentCats) return currentCats.split(",").filter(Boolean);
    if (currentCategory) return [currentCategory];
    return [];
  }, [currentCats, currentCategory]);

  useEffect(() => {
    setMinPriceInput(currentMinPrice);
    setMaxPriceInput(currentMaxPrice);
    setDraftMoq(selectedMoq);
    setDraftCategories(selectedCategories);
  }, [
    currentMinPrice,
    currentMaxPrice,
    selectedMoq,
    selectedCategories,
  ]);

  useEffect(() => {
    document.body.style.overflow = mobileFilterOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileFilterOpen]);

  useEffect(() => {
    let cancelled = false;
    // Use shared settings-cache — deduped with Navbar and Footer fetches
    getSettings().then((s) => {
      if (cancelled) return;
      const url = s?.productsBannerUrl;
      if (typeof url === "string" && url.trim()) setBannerUrl(url.trim());
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    async function loadCatalog() {
      setLoading(true);
      try {
        const query = new URLSearchParams();
        const primaryCat = selectedCategories[0] || currentCategory;
        if (primaryCat) {
          query.set("categoryId", primaryCat);
        }

        if (currentSearch.trim()) {
          query.set("search", currentSearch.trim());
        }

        if (currentMinPrice) {
          query.set("minPrice", currentMinPrice);
        }
        if (currentMaxPrice) {
          query.set("maxPrice", currentMaxPrice);
        }

        const { moqMin, moqMax } = computeMoqBounds(selectedMoq);
        if (moqMin != null) query.set("moqMin", String(moqMin));
        if (moqMax != null) query.set("moqMax", String(moqMax));

        let apiSort = currentSort;
        if (currentSort === "price_asc") apiSort = "price_asc";
        else if (currentSort === "price_desc") apiSort = "price_desc";
        else if (currentSort === "name_asc") apiSort = "name_asc";
        else apiSort = "";
        if (apiSort) query.set("sortBy", apiSort);

        query.set("page", currentPage.toString());
        query.set("limit", "12");

        const [prodRes, catRes] = await Promise.all([
          fetch(`/api/products?${query.toString()}`),
          fetch("/api/categories"),
        ]);

        let list: Product[] = [];
        let total = 0;
        let page = currentPage;
        let limit = 12;

        if (prodRes.ok) {
          const json = await prodRes.json();
          if (json.success) {
            list = (json.data.products || []).map((p: Product) => ({
              ...p,
              supplier_country: p.supplier_country || p.supplier?.country || undefined,
            }));
            total = json.data.pagination?.total ?? json.data.total ?? list.length;
            page = json.data.pagination?.page ?? json.data.page ?? currentPage;
            limit = json.data.pagination?.limit ?? json.data.limit ?? 12;
          }
        }

        setProducts(list);
        setPagination({
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        });

        if (catRes.ok) {
          const json = await catRes.json();
          if (json.success) {
            const apiCats: Category[] = json.data.categories || [];
            if (apiCats.length > 0) {
              setCategories(
                apiCats.map((c: any) => ({
                  ...c,
                  count: c.count ?? c.productCount ?? 0,
                }))
              );
            } else {
              setCategories([]);
            }
          }
        }
      } catch (error) {
        console.error("Failed to load products catalog:", error);
        setProducts([]);
        setPagination({
          page: 1,
          limit: 12,
          total: 0,
          totalPages: 1,
        });
      } finally {
        setLoading(false);
      }
    }

    loadCatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentCategory,
    currentSort,
    currentPage,
    currentSearch,
    currentMinPrice,
    currentMaxPrice,
    selectedMoq,
    selectedCategories,
  ]);

  /* ── URL helpers ─────────────────────────────────── */

  function pushParams(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    router.push(`/products?${params.toString()}`, { scroll: false });
  }

  function toggleInList(list: string[], id: string) {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  }

  function handleApplyFilters() {
    pushParams((params) => {
      const minV = parseInt(minPriceInput, 10);
      const maxV = parseInt(maxPriceInput, 10);
      if (!Number.isNaN(minV) && minV >= 0 && minPriceInput !== "")
        params.set("minPrice", String(minV));
      else params.delete("minPrice");
      if (!Number.isNaN(maxV) && maxV > 0 && maxPriceInput !== "")
        params.set("maxPrice", String(maxV));
      else params.delete("maxPrice");

      if (draftMoq.length) params.set("moq", draftMoq.join(","));
      else params.delete("moq");

      if (draftCategories.length) {
        params.set("cats", draftCategories.join(","));
        params.set("category", draftCategories[0]);
      } else {
        params.delete("cats");
        params.delete("category");
      }

      params.set("page", "1");
    });
    setMobileFilterOpen(false);
  }

  function handleResetFilters() {
    setMinPriceInput("");
    setMaxPriceInput("");
    setDraftMoq([]);
    setDraftCategories([]);
    setMobileFilterOpen(false);
    router.push("/products", { scroll: false });
  }

  function handleQuickCategory(catId: string) {
    pushParams((params) => {
      if (selectedCategories.includes(catId) && currentCategory === catId) {
        params.delete("category");
        params.delete("cats");
      } else {
        params.set("category", catId);
        params.set("cats", catId);
      }
      params.set("page", "1");
    });
  }

  function scrollQuickNext() {
    quickRowRef.current?.scrollBy({ left: 240, behavior: "smooth" });
  }

  async function handleAddToCart(product: Product) {
    const qty = product.moq && product.moq > 0 ? product.moq : 1;
    setAddingId(product.id);
    setCartError("");

    // 1. Instant optimistic visual state
    setAddedIds((prev) => ({ ...prev, [product.id]: true }));
    setTimeout(() => {
      setAddedIds((prev) => {
        const next = { ...prev };
        delete next[product.id];
        return next;
      });
    }, 2000);

    // 2. Synchronously bump Navbar cart badge
    window.dispatchEvent(new CustomEvent("cart-updated", { detail: { delta: 1 } }));

    // 3. Instant toast feedback with direct CTA
    toast.success(`Added ${product.name} to RFQ cart`, {
      action: {
        label: "View Cart",
        onClick: () => router.push("/cart"),
      },
    });

    // 4. Background network synchronization
    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, quantity: qty }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        // Rollback optimistic badge
        window.dispatchEvent(new CustomEvent("cart-updated", { detail: { delta: -1 } }));
        toast.error(json.error?.message || "Failed to add to cart");
      }
    } catch {
      window.dispatchEvent(new CustomEvent("cart-updated", { detail: { delta: -1 } }));
      toast.error("Network error adding to cart");
    } finally {
      setAddingId(null);
    }
  }

  const activeFilterCount =
    selectedCategories.length +
    (currentMinPrice || currentMaxPrice ? 1 : 0) +
    selectedMoq.length;

  const filterProps: FilterPanelProps = {
    categories,
    categoriesExpanded,
    setCategoriesExpanded,
    selectedCategories: draftCategories,
    onToggleCategory: (id) => setDraftCategories((prev) => toggleInList(prev, id)),
    minPriceInput,
    maxPriceInput,
    setMinPriceInput,
    setMaxPriceInput,
    selectedMoq: draftMoq,
    onToggleMoq: (id) => setDraftMoq((prev) => toggleInList(prev, id)),
    onClear: handleResetFilters,
    onApply: handleApplyFilters,
  };

  /* ── Cards ───────────────────────────────────────── */

  function renderProductCard(product: Product) {
    const unit = product.unit || "piece";
    const price = getPriceDisplay(product);
    const spec = getSpecLine(product);
    const rating = getProductRating(product);
    const origin = resolveSupplierCountry(product);
    const imageUrl = getProductImageUrl(product);
    const rfqHref = `/rfq?product=${product.id}&qty=${product.moq && product.moq > 0 ? product.moq : 1}`;

    return (
      <article
        key={product.id}
        className="pc-card"
        onMouseEnter={() => prefetchStorefrontProduct(product.id)}
        onFocusCapture={() => prefetchStorefrontProduct(product.id)}
      >
        <div className="pc-card__media">
          <Link
            href={`/products/${product.id}`}
            className="pc-card__media-link"
            aria-label={product.name}
          >
            <span className="pc-card__img-wrap">
              {imageUrl ? (
                <RemoteImage
                  src={imageUrl}
                  alt={product.name}
                  sizes="240px"
                  className="pc-card__img"
                  objectFit="contain"
                />
              ) : (
                <Package className="w-10 h-10 text-[#9ca3af] m-auto" strokeWidth={1.5} />
              )}
            </span>
          </Link>
        </div>

        <div className="pc-card__body">
          <Link
            href={`/products/${product.id}`}
            className="pc-card__name"
            title={product.name}
          >
            {product.name}
          </Link>

          <div className="pc-card__spec" title={spec || undefined}>
            {spec || "\u00A0"}
          </div>

          <div className="pc-card__price-row">
            {price.old ? (
              <>
                <span className="pc-card__price-old">{price.old}</span>
                <span className="pc-card__price-new">{price.current}</span>
                <span className="pc-card__price-unit">/ {price.unit}</span>
              </>
            ) : price.current === "Quote on request" ? (
              <span className="pc-card__price-new">{price.current}</span>
            ) : (
              <>
                <span className="pc-card__price-new">{price.current}</span>
                <span className="pc-card__price-unit">/ {price.unit}</span>
              </>
            )}
          </div>

          <div className="pc-card__moq">
            MOQ: {product.moq} {unit}
          </div>

          <div className="pc-card__meta">
            {rating != null ? (
              <span className="pc-card__rating" title={`${rating.toFixed(1)} out of 5`}>
                <Star className="pc-card__star" fill="currentColor" strokeWidth={0} />
                <span className="pc-card__rating-val">{rating.toFixed(1)}</span>
              </span>
            ) : (
              <span className="pc-card__rating pc-card__rating--empty" aria-hidden>
                {"\u00A0"}
              </span>
            )}

            <span
              className={`pc-card__flag-slot ${origin ? "has-flag" : ""}`}
            >
              <CountryFlag
                origin={origin}
                className="pc-card__flag-slot-inner"
                imgClassName="pc-card__flag-img"
              />
            </span>
          </div>
        </div>

        <div className="pc-card__actions">
          <Link href={rfqHref} className="pc-card__rfq">
            Add to RFQ
          </Link>
          <button
            type="button"
            className={`pc-card__cart ${addedIds[product.id] ? "is-added bg-emerald-50 text-emerald-600 border-emerald-300" : ""}`}
            aria-label={`Add ${product.name} to RFQ cart`}
            title={addedIds[product.id] ? "Added to RFQ cart" : "Add to RFQ cart"}
            disabled={addingId === product.id}
            onClick={() => handleAddToCart(product)}
          >
            {addedIds[product.id] ? (
              <Check className="w-4 h-4 text-emerald-600 animate-in zoom-in duration-200" />
            ) : addingId === product.id ? (
              <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />
            ) : (
              <ShoppingCart strokeWidth={1.75} />
            )}
          </button>
        </div>
      </article>
    );
  }

  function renderListRow(product: Product) {
    const unit = product.unit || "piece";
    const imageUrl = getProductImageUrl(product);
    const origin = resolveSupplierCountry(product);
    const rfqHref = `/rfq?product=${product.id}&qty=${product.moq && product.moq > 0 ? product.moq : 1}`;
    return (
      <div key={product.id} className="pc-list-row">
        <Link href={`/products/${product.id}`} className="pc-list-row__thumb">
          {imageUrl ? (
            <RemoteImage
              src={imageUrl}
              alt={product.name}
              sizes="72px"
              objectFit="contain"
            />
          ) : (
            <Package className="w-6 h-6 text-[#9ca3af] m-auto" strokeWidth={1.5} />
          )}
        </Link>
        <div className="pc-list-row__meta">
          <Link href={`/products/${product.id}`} className="pc-list-row__name">
            {product.name}
          </Link>
          <div className="pc-list-row__spec">{getSpecLine(product)}</div>
          <div className="pc-card__moq">
            MOQ: {product.moq} {unit}
          </div>
          {origin ? (
            <div className="pc-list-row__origin">
              <CountryFlag
                origin={origin}
                imgClassName="pc-card__flag-img"
              />
              <span>{origin.label}</span>
            </div>
          ) : null}
        </div>
        <div className="pc-list-row__actions">
          {(() => {
            const price = getPriceDisplay(product);
            return (
              <span className="pc-list-row__price">
                {price.old ? (
                  <>
                    <span className="pc-card__price-old">{price.old}</span>{" "}
                    <span className="pc-card__price-new">{price.current}</span>
                  </>
                ) : (
                  <span className="pc-card__price-new">{price.current}</span>
                )}
                {price.current !== "Quote on request" && (
                  <span className="pc-card__price-unit"> / {price.unit}</span>
                )}
              </span>
            );
          })()}
          <Link href={rfqHref} className="pc-card__rfq" style={{ flex: "none", padding: "8px 14px", height: 36 }}>
            Add to RFQ
          </Link>
          <button
            type="button"
            className={`pc-card__cart ${addedIds[product.id] ? "is-added bg-emerald-50 text-emerald-600 border-emerald-300" : ""}`}
            aria-label="Add to RFQ cart"
            disabled={addingId === product.id}
            onClick={() => handleAddToCart(product)}
          >
            {addedIds[product.id] ? (
              <Check className="w-4 h-4 text-emerald-600 animate-in zoom-in duration-200" />
            ) : addingId === product.id ? (
              <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />
            ) : (
              <ShoppingCart className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    );
  }

  const displayTotal = pagination.total || products.length;

  return (
    <div className="pc-page">
      <section className="pc-catalog">
        {bannerUrl ? (
          <div className="pc-catalog__media" aria-hidden="true">
            <RemoteImage
              src={bannerUrl}
              alt=""
              sizes="100vw"
              className="pc-catalog__img"
              objectFit="cover"
              priority
            />
            <div className="pc-catalog__fade" />
          </div>
        ) : null}

        <div className="pc-container pc-catalog__inner">
          <header className="pc-header">
            <h1 className="pc-header__title">Products</h1>
            <p className="pc-header__subtitle">
              Discover our wide range of industrial products
            </p>
          </header>

          <div className="pc-quick-row" ref={quickRowRef}>
            {categories.slice(0, 8).map((cat) => {
              const isActive = selectedCategories.includes(cat.id);
              const initial = cat.name.trim().charAt(0).toUpperCase() || "?";
              return (
                <button
                  key={cat.id}
                  type="button"
                  className={`pc-quick-card ${isActive ? "is-active" : ""}`}
                  onClick={() => handleQuickCategory(cat.id)}
                  title={cat.name}
                >
                  <span className="pc-quick-card__icon">
                    {initial !== "?" ? (
                      <span className="text-xs font-bold">{initial}</span>
                    ) : (
                      <Package className="w-4 h-4" strokeWidth={1.75} />
                    )}
                  </span>
                  <span className="pc-quick-card__text">
                    <span className="pc-quick-card__name">{cat.name}</span>
                    <span className="pc-quick-card__count">
                      {`${cat.count ?? (cat as { productCount?: number }).productCount ?? 0} Products`}
                    </span>
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              className="pc-quick-next"
              onClick={scrollQuickNext}
              aria-label="Next categories"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="pc-layout">
            <aside className="pc-sidebar pc-sidebar--desktop" aria-label="Product filters">
              <div className="pc-sidebar__sticky">
                <FilterPanel {...filterProps} />
              </div>
            </aside>

            <main className="pc-main">
              {cartError && (
                <div
                  className="pc-toolbar"
                  style={{
                    marginBottom: 8,
                    padding: "10px 14px",
                    background: "#FEF2F2",
                    borderRadius: 8,
                    color: "#B91C1C",
                    fontSize: 13,
                  }}
                  role="alert"
                >
                  {cartError}
                </div>
              )}
              <div className="pc-toolbar">
                <div className="pc-toolbar__count">
                  {loading
                    ? "Loading…"
                    : `${displayTotal.toLocaleString("en-IN")} Products found`}
                </div>

              <div className="pc-toolbar__right">
                <button
                  type="button"
                  className="pc-filters-mobile"
                  onClick={() => setMobileFilterOpen(true)}
                  aria-label="Open filters"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  Filters
                  {activeFilterCount > 0 && (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        background: "#111111",
                        color: "#FFFFFF",
                        fontSize: 10,
                        fontWeight: 700,
                        marginLeft: 2,
                      }}
                    >
                      {activeFilterCount}
                    </span>
                  )}
                </button>

                <div className="pc-view-toggle" role="group" aria-label="View mode">
                  <button
                    type="button"
                    className={viewMode === "grid" ? "is-active" : ""}
                    onClick={() => setViewMode("grid")}
                    aria-pressed={viewMode === "grid"}
                    title="Grid view"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    className={viewMode === "list" ? "is-active" : ""}
                    onClick={() => setViewMode("list")}
                    aria-pressed={viewMode === "list"}
                    title="List view"
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>

                <select
                  className="pc-sort"
                  value={currentSort}
                  onChange={(e) =>
                    pushParams((params) => {
                      params.set("sort", e.target.value);
                      params.set("page", "1");
                    })
                  }
                  aria-label="Sort products"
                >
                  <option value="relevance">Sort by: Relevance</option>
                  <option value="price_asc">Unit price: low → high</option>
                  <option value="price_desc">Unit price: high → low</option>
                  <option value="name_asc">Name: A → Z</option>
                </select>
              </div>
            </div>

            {/* Results */}
            {loading ? (
              <div className="pc-skeleton-grid">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="pc-skeleton-card">
                    <div className="pc-skeleton-card__media" />
                    <div className="pc-skeleton-card__body">
                      <div className="pc-skeleton-line" style={{ width: "70%" }} />
                      <div className="pc-skeleton-line" style={{ width: "90%" }} />
                      <div className="pc-skeleton-line" style={{ width: "50%" }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="pc-empty">
                <div className="pc-empty__icon">
                  <Package className="w-5 h-5" />
                </div>
                <h3 className="pc-empty__title">No products found</h3>
                <p className="pc-empty__desc">
                  Try adjusting your filters or clearing them to see all available
                  products.
                </p>
                <button
                  type="button"
                  className="pc-apply-btn"
                  style={{ maxWidth: 200, margin: "0 auto", display: "block" }}
                  onClick={handleResetFilters}
                >
                  Clear Filters
                </button>
              </div>
            ) : viewMode === "grid" ? (
              <div className="pc-grid">
                {products.map((product) => renderProductCard(product))}
              </div>
            ) : (
              <div className="pc-list">
                {products.map((product) => renderListRow(product))}
              </div>
            )}

            {/* Pagination */}
            {!loading && products.length > 0 && (
              <nav className="pc-pagination" aria-label="Pagination">
                <button
                  type="button"
                  className="pc-page-btn is-nav"
                  disabled={pagination.page <= 1}
                  onClick={() =>
                    pushParams((params) => {
                      params.set("page", String(pagination.page - 1));
                    })
                  }
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {(pagination.totalPages <= 1
                  ? [1]
                  : Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                      .filter((pageNum) => {
                        if (pagination.totalPages <= 7) return true;
                        if (pageNum === 1 || pageNum === pagination.totalPages)
                          return true;
                        if (Math.abs(pageNum - pagination.page) <= 1) return true;
                        return false;
                      })
                      .reduce<(number | "ellipsis")[]>((acc, pageNum, idx, arr) => {
                        if (
                          idx > 0 &&
                          typeof arr[idx - 1] === "number" &&
                          pageNum - (arr[idx - 1] as number) > 1
                        ) {
                          acc.push("ellipsis");
                        }
                        acc.push(pageNum);
                        return acc;
                      }, [])
                ).map((item, idx) =>
                  item === "ellipsis" ? (
                    <span key={`ellipsis-${idx}`} className="pc-page-ellipsis">
                      …
                    </span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      className={`pc-page-btn ${
                        pagination.page === item ? "is-active" : ""
                      }`}
                      onClick={() =>
                        pushParams((params) => {
                          params.set("page", String(item));
                        })
                      }
                      aria-current={pagination.page === item ? "page" : undefined}
                    >
                      {item}
                    </button>
                  )
                )}

                <button
                  type="button"
                  className="pc-page-btn is-nav"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() =>
                    pushParams((params) => {
                      params.set("page", String(pagination.page + 1));
                    })
                  }
                  aria-label="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </nav>
            )}
            </main>
          </div>
        </div>
      </section>

      {/* Mobile filter drawer */}
      {mobileFilterOpen && (
        <div
          className="pc-drawer-overlay"
          onClick={() => setMobileFilterOpen(false)}
          aria-hidden
        />
      )}
      <div
        className={`pc-drawer ${mobileFilterOpen ? "is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Product Filters"
      >
        <div className="pc-drawer__header">
          <h2 className="pc-drawer__title">
            Filters
            {activeFilterCount > 0 && (
              <span
                style={{
                  marginLeft: 8,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: "#111111",
                  color: "#FFFFFF",
                  fontSize: 11,
                  fontWeight: 700,
                  verticalAlign: "middle",
                }}
              >
                {activeFilterCount}
              </span>
            )}
          </h2>
          <button
            type="button"
            onClick={() => setMobileFilterOpen(false)}
            className="pc-drawer__close"
            aria-label="Close filters"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="pc-drawer__body">
          <FilterPanel {...filterProps} />
        </div>
      </div>
    </div>
  );
}

export default function ProductsCatalogPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            background: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-inter), system-ui, sans-serif",
            fontSize: 14,
            color: "#6B7280",
          }}
        >
          Loading catalog…
        </div>
      }
    >
      <ProductsCatalogContent />
    </Suspense>
  );
}
