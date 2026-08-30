"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Box,
  Check,
  ChevronDown,
  ChevronRight,
  CreditCard,
  FileText,
  Gauge,
  Heart,
  Package,
  Ruler,
  ShieldCheck,
  ShoppingCart,
  Weight,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { createBrowserClient } from "@/lib/supabase/client";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { CountryFlag } from "@/components/ui/CountryFlag";
import { resolveSupplierCountry } from "@/lib/country-origin";
import "./product-detail.css";

type ProductImage = {
  id?: string;
  image_url: string;
  sort_order?: number;
  is_primary?: boolean;
};

type ProductSpec = {
  id?: string;
  spec_name: string;
  spec_value: string;
  sort_order?: number;
};

type Product = {
  id: string;
  name: string;
  description?: string | null;
  descriptionHtml?: string;
  moq?: number;
  selling_price?: number;
  discount?: number;
  gst_rate?: number;
  gst_included?: boolean;
  min_order_value?: number | null;
  ribbon_label?: string | null;
  sku?: string | null;
  stock_quantity?: number;
  category?: { id: string; name: string } | null;
  supplier?: { country?: string; address?: string } | null;
  supplier_country?: string | null;
  images?: ProductImage[];
  specifications?: ProductSpec[];
};

function formatINR(value: number): string {
  return value.toLocaleString("en-IN", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

const RECENT_KEY = "mitfast_recent_products";

type RecentItem = {
  id: string;
  name: string;
  image?: string;
  price: number;
  viewedAt: number;
};

type RelatedProduct = {
  id: string;
  name: string;
  selling_price?: number;
  discount?: number;
  images?: ProductImage[];
};

function readRecent(): RecentItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function pushRecent(item: RecentItem) {
  const next = [
    item,
    ...readRecent().filter((r) => r.id !== item.id),
  ].slice(0, 12);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

function getVisitorSessionId(): string {
  if (typeof window === "undefined") return "anon";
  try {
    let vid = localStorage.getItem("mitfast_vid");
    if (!vid) {
      vid =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `v_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      localStorage.setItem("mitfast_vid", vid);
    }
    return vid;
  } catch {
    return "anon";
  }
}

function productThumb(p: { images?: ProductImage[] }): string {
  return (
    p.images?.find((img) => img.is_primary)?.image_url ||
    p.images?.[0]?.image_url ||
    ""
  );
}

function unitPriceOf(p: { selling_price?: number; discount?: number }): number {
  return Math.max(
    0,
    Math.round(((p.selling_price || 0) - (p.discount || 0)) * 100) / 100,
  );
}

function specIcon(name: string) {
  const n = name.toLowerCase();
  if (n.includes("weight") || n.includes("mass")) return Weight;
  if (n.includes("thrust") || n.includes("force") || n.includes("torque")) return Gauge;
  if (n.includes("power") || n.includes("volt") || n.includes("kv") || n.includes("current"))
    return Zap;
  if (n.includes("dimen") || n.includes("diameter") || n.includes("shaft") || n.includes("size"))
    return Ruler;
  if (n.includes("material") || n.includes("grade") || n.includes("finish")) return ShieldCheck;
  if (n.includes("config") || n.includes("application") || n.includes("type")) return Package;
  return FileText;
}

export default function ProductDetailClient({
  initialProduct = null,
}: {
  initialProduct?: Product | null;
}) {
  const params = useParams();
  const productId = params.id as string;

  const [product, setProduct] = useState<Product | null>(initialProduct);
  const [selectedImage, setSelectedImage] = useState(() => {
    if (!initialProduct) return "";
    const sorted = [...(initialProduct.images || [])].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
    );
    return (
      sorted.find((img) => img.is_primary)?.image_url ||
      sorted[0]?.image_url ||
      ""
    );
  });
  const [quantity, setQuantity] = useState(Math.max(initialProduct?.moq || 1, 1));
  const [loading, setLoading] = useState(!initialProduct);
  const [addingToCart, setAddingToCart] = useState(false);
  const [cartSuccess, setCartSuccess] = useState(false);
  const [cartError, setCartError] = useState("");
  const [wishlisted, setWishlisted] = useState(false);
  const [wishlistBusy, setWishlistBusy] = useState(false);
  const [relatedTab, setRelatedTab] = useState<"recommended" | "recent">("recommended");
  const [recommended, setRecommended] = useState<RelatedProduct[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<RecentItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const thumbsRef = useRef<HTMLDivElement>(null);
  const viewTrackedRef = useRef<string | null>(null);

  // ── Track product detail view only on successful full page load ──────
  useEffect(() => {
    const activeProduct =
      product || (initialProduct && initialProduct.id === productId ? initialProduct : null);
    const activeId = activeProduct?.id;
    if (!activeId || loadError) return;

    // Prevent duplicate calls across React Strict Mode or state re-renders
    if (viewTrackedRef.current === activeId) return;
    viewTrackedRef.current = activeId;

    // Deduplication window: 30 minutes (1800000 ms) per product per session
    const DEDUP_WINDOW_MS = 30 * 60 * 1000;
    const storageKey = `mitfast_pv_${activeId}`;
    let shouldTrack = true;

    try {
      const lastViewedAt = sessionStorage.getItem(storageKey);
      const now = Date.now();
      if (lastViewedAt && now - Number(lastViewedAt) < DEDUP_WINDOW_MS) {
        shouldTrack = false;
      } else {
        sessionStorage.setItem(storageKey, String(now));
      }
    } catch {
      // Proceed to server rate-limit if sessionStorage is unavailable
    }

    if (shouldTrack) {
      const visitorId = getVisitorSessionId();
      void fetch(`/api/products/${activeId}/view`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-visitor-id': visitorId,
        },
        keepalive: true,
      }).catch(() => {
        // Non-blocking telemetry
      });
    }
  }, [product, initialProduct, productId, loadError]);

  const loadProduct = useCallback(async (opts?: { soft?: boolean }) => {
    setLoadError(null);
    if (!opts?.soft) setLoading(true);

    // Start product fetch + wishlist fetch IN PARALLEL — both are independent
    const [productRes, wishlistRes] = await Promise.allSettled([
      fetch(`/api/products/${productId}`),
      fetch('/api/wishlist'),
    ]);

    try {
      // ── Product ──────────────────────────────────────────────
      if (productRes.status === 'fulfilled') {
        const res = productRes.value;
        const json = await res.json();
        if (json.success && json.data.product) {
          const p = json.data.product as Product;
          setProduct(p);
          if (!opts?.soft) {
            setQuantity(Math.max(p.moq || 1, 1));
          }
          const sorted = [...(p.images || [])].sort(
            (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
          );
          const primary =
            sorted.find((img) => img.is_primary)?.image_url ||
            sorted[0]?.image_url ||
            '';
          setSelectedImage(primary);

          pushRecent({
            id: p.id,
            name: p.name,
            image: primary,
            price: unitPriceOf(p),
            viewedAt: Date.now(),
          });
          setRecentlyViewed(readRecent().filter((r) => r.id !== p.id));

          // Fire recommended AFTER we have the category (still fast — runs
          // concurrently with wishlist parse below, not blocking UI)
          void (async () => {
            try {
              const qs = new URLSearchParams({ limit: '8' });
              if (p.category?.id) qs.set('categoryId', p.category.id);
              const relRes = await fetch(`/api/products?${qs.toString()}`);
              const relJson = await relRes.json();
              if (relJson.success) {
                const list = ((relJson.data?.products || []) as RelatedProduct[]).filter(
                  (rp) => rp.id !== p.id,
                );
                setRecommended(list.slice(0, 8));
              }
            } catch {
              setRecommended([]);
            }
          })();
        } else if (!opts?.soft) {
          if (res.status === 404 || json.error?.code === 'NOT_FOUND') {
            setProduct(null);
          } else {
            setProduct(null);
            setLoadError(json.error?.message || 'Unable to load this product right now.');
          }
        }
      } else if (!opts?.soft) {
        setProduct(null);
        setLoadError('Network error while loading this product. Please try again.');
      }

      // ── Wishlist (resolved in parallel with product) ─────────
      if (wishlistRes.status === 'fulfilled') {
        try {
          const json = await wishlistRes.value.json();
          if (json.success) {
            const ids = (json.data?.items || []).map(
              (item: { productId: string }) => item.productId,
            );
            setWishlisted(ids.includes(productId));
          }
        } catch {
          setWishlisted(false);
        }
      }
    } catch (err) {
      console.error('Error fetching product:', err);
      if (!opts?.soft) {
        setProduct(null);
        setLoadError('Network error while loading this product. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    if (!productId) return;
    if (initialProduct && initialProduct.id === productId) {
      const primary =
        [...(initialProduct.images || [])]
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .find((img) => img.is_primary)?.image_url ||
        initialProduct.images?.[0]?.image_url ||
        "";
      pushRecent({
        id: initialProduct.id,
        name: initialProduct.name,
        image: primary,
        price: unitPriceOf(initialProduct),
        viewedAt: Date.now(),
      });
      setRecentlyViewed(readRecent().filter((r) => r.id !== initialProduct.id));
      void loadProduct({ soft: true });
      return;
    }
    void loadProduct();
  }, [productId, loadProduct, initialProduct]);

  async function handleToggleWishlist() {
    if (!product) return;
    const prevWishlisted = wishlisted;
    // 1. Instant optimistic UI flip
    setWishlisted(!prevWishlisted);
    setWishlistBusy(true);

    if (!prevWishlisted) {
      toast.success("Saved to your wishlist", { duration: 2000 });
    } else {
      toast.info("Removed from wishlist", { duration: 2000 });
    }

    try {
      if (prevWishlisted) {
        const res = await fetch(`/api/wishlist?productId=${product.id}`, {
          method: "DELETE",
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          // Rollback
          setWishlisted(true);
          toast.error(json.error?.message || "Failed to update wishlist");
        }
      } else {
        const res = await fetch("/api/wishlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId: product.id }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          // Rollback
          setWishlisted(false);
          toast.error(json.error?.message || "Failed to update wishlist");
        }
      }
    } catch {
      setWishlisted(prevWishlisted);
      toast.error("Network error updating wishlist");
    } finally {
      setWishlistBusy(false);
    }
  }

  async function handleAddToCart() {
    if (!product) return;
    setCartError("");
    setAddingToCart(true);

    // 1. Instant optimistic state on button & badge
    setCartSuccess(true);
    window.dispatchEvent(new CustomEvent("cart-updated", { detail: { delta: 1 } }));

    // 2. Instant Toast feedback
    toast.success(`Added ${quantity} pcs to RFQ Cart`, {
      action: {
        label: "View Cart",
        onClick: () => {
          window.location.href = "/cart";
        },
      },
    });

    setTimeout(() => setCartSuccess(false), 3000);

    // 3. Background API request
    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          quantity,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setCartSuccess(false);
        window.dispatchEvent(new CustomEvent("cart-updated", { detail: { delta: -1 } }));
        const errorMsg = json.error?.message || "Failed to add to cart";
        setCartError(errorMsg);
        toast.error(errorMsg);
      }
    } catch (err: unknown) {
      setCartSuccess(false);
      window.dispatchEvent(new CustomEvent("cart-updated", { detail: { delta: -1 } }));
      const message = err instanceof Error ? err.message : "Error updating cart";
      setCartError(message);
      toast.error(message);
    } finally {
      setAddingToCart(false);
    }
  }

  const images = useMemo(() => {
    const list = [...(product?.images || [])].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
    );
    return list;
  }, [product]);

  const keySpecs = useMemo(() => {
    return [...(product?.specifications || [])].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
    ).slice(0, 8);
  }, [product]);

  if (loading) {
    return (
      <div className="pdp-page">
        <div className="pdp-container pdp-skeleton">
          <div className="pdp-skeleton__bar" />
          <div className="pdp-skeleton__grid">
            <div className="pdp-skeleton__block" />
            <div className="pdp-skeleton__block" />
            <div className="pdp-skeleton__block" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="pdp-page">
        <div className="pdp-container pdp-empty">
          <AlertCircle className="w-10 h-10 text-[#6B7280] mx-auto" />
          <h1>{loadError ? 'Unable to Load Product' : 'Product Not Found'}</h1>
          <p>
            {loadError ||
              'The component you are looking for does not exist or is currently archived.'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {loadError ? (
              <button
                type="button"
                className="pdp-empty__secondary"
                onClick={() => void loadProduct()}
              >
                Try again
              </button>
            ) : null}
            <Link href="/products">Return to Catalog</Link>
          </div>
        </div>
      </div>
    );
  }

  const sellingPrice = product.selling_price || 0;
  const discountAmt = product.discount || 0;
  const unitPrice = Math.max(
    0,
    Math.round((sellingPrice - discountAmt) * 100) / 100,
  );
  const minLot = Math.max(1, product.moq || 1);
  const supplierOrigin = resolveSupplierCountry(product);
  const brand =
    product.ribbon_label ||
    product.category?.name?.split(" ")[0] ||
    "MITFAST";
  const realSku = product.sku?.trim() || null;

  const setQty = (next: number) => {
    setQuantity(Math.max(minLot, next));
  };

  const scrollThumbs = () => {
    thumbsRef.current?.scrollBy({ top: 72, behavior: "smooth" });
  };

  const relatedItems =
    relatedTab === "recommended"
      ? recommended.map((p) => ({
          id: p.id,
          name: p.name,
          image: productThumb(p),
          price: unitPriceOf(p),
        }))
      : recentlyViewed.map((p) => ({
          id: p.id,
          name: p.name,
          image: p.image || "",
          price: p.price,
        }));

  return (
    <div className="pdp-page">
      <div className="pdp-container">
        <nav className="pdp-breadcrumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <ChevronRight className="pdp-breadcrumb__sep w-3.5 h-3.5" aria-hidden />
          <Link href="/products">Products</Link>
          {product.category && (
            <>
              <ChevronRight className="pdp-breadcrumb__sep w-3.5 h-3.5" aria-hidden />
              <Link href={`/products?category=${product.category.id}`}>
                {product.category.name}
              </Link>
            </>
          )}
          <ChevronRight className="pdp-breadcrumb__sep w-3.5 h-3.5" aria-hidden />
          <span className="pdp-breadcrumb__current">{product.name}</span>
        </nav>

        <div className="pdp-layout">
          {/* ── Left: Gallery ─────────────────────────────── */}
          <section className="pdp-gallery" aria-label="Product media">
            <div className="pdp-gallery__stage">
              <div className="pdp-thumbs">
                <div className="pdp-thumbs__list" ref={thumbsRef}>
                  {(images.length > 0
                    ? images
                    : [{ image_url: "", id: "placeholder" }]
                  ).map((img, idx) => {
                    const url = img.image_url;
                    const active = (url && selectedImage === url) || (!url && idx === 0);
                    return (
                      <button
                        key={img.id || url || idx}
                        type="button"
                        className={`pdp-thumb ${active ? "is-active" : ""}`}
                        onClick={() => url && setSelectedImage(url)}
                        aria-label={`View image ${idx + 1}`}
                        aria-pressed={active}
                      >
                        {url ? (
                          <span className="pdp-thumb__img">
                            <RemoteImage src={url} alt="" sizes="56px" />
                          </span>
                        ) : (
                          <Package className="w-5 h-5 text-[#9ca3af] m-auto" />
                        )}
                      </button>
                    );
                  })}
                </div>
                {images.length > 4 && (
                  <button
                    type="button"
                    className="pdp-thumbs__more"
                    onClick={scrollThumbs}
                    aria-label="Show more images"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="pdp-main-media">
                <button
                  type="button"
                  className={`pdp-wishlist${wishlisted ? " is-active" : ""}`}
                  aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
                  aria-pressed={wishlisted}
                  disabled={wishlistBusy}
                  onClick={() => void handleToggleWishlist()}
                >
                  <Heart className={`w-5 h-5${wishlisted ? " fill-current" : ""}`} />
                </button>
                {selectedImage ? (
                  <span className="pdp-main-media__img">
                    <RemoteImage
                      src={selectedImage}
                      alt={product.name}
                      sizes="(max-width: 1024px) 90vw, 40vw"
                      priority
                      objectFit="contain"
                    />
                  </span>
                ) : (
                  <Package className="w-16 h-16 text-[#9ca3af] stroke-1" />
                )}
              </div>
            </div>

            <div className="pdp-trust">
              <div className="pdp-trust__item">
                <span className="pdp-trust__icon" aria-hidden>
                  <ShieldCheck className="w-4 h-4" />
                </span>
                100% Original
              </div>
              <div className="pdp-trust__item">
                <span className="pdp-trust__icon" aria-hidden>
                  <Box className="w-4 h-4" />
                </span>
                Secure Packaging
              </div>
              <div className="pdp-trust__item">
                <span className="pdp-trust__icon" aria-hidden>
                  <Check className="w-4 h-4" />
                </span>
                Quality Checked
              </div>
            </div>
          </section>

          {/* ── Middle: Info + key specs ──────────────────── */}
          <section className="pdp-info" aria-label="Product information">
            <span className="pdp-brand">{brand}</span>
            <h1 className="pdp-title">{product.name}</h1>

            <div className="pdp-meta">
              {product.category?.name && (
                <span className="pdp-sku">{product.category.name}</span>
              )}
              <span className="pdp-sku">MOQ: {minLot} pieces</span>
              {realSku && <span className="pdp-sku">SKU: {realSku}</span>}
              {supplierOrigin && (
                <span className="pdp-sku pdp-origin">
                  <CountryFlag
                    origin={supplierOrigin}
                    className="pdp-origin__flag"
                    imgClassName="pdp-origin__flag-img"
                  />
                  Origin: {supplierOrigin.label}
                </span>
              )}
            </div>

            {product.descriptionHtml?.trim() || product.description?.trim() ? (
              <div
                className="pdp-desc"
                dangerouslySetInnerHTML={{
                  __html: product.descriptionHtml || product.description || '',
                }}
              />
            ) : (
              <p className="pdp-desc">No description provided.</p>
            )}

            {keySpecs.length > 0 && (
              <>
                <ul className="pdp-specs">
                  {keySpecs.map((spec, idx) => {
                    const Icon = specIcon(spec.spec_name);
                    return (
                      <li key={spec.id || `${spec.spec_name}-${idx}`} className="pdp-spec">
                        <Icon className="pdp-spec__icon" aria-hidden strokeWidth={1.75} />
                        <span className="pdp-spec__label">{spec.spec_name}</span>
                        <span className="pdp-spec__value">{spec.spec_value}</span>
                      </li>
                    );
                  })}
                </ul>

                <a href="#full-specs" className="pdp-specs-link">
                  View full specifications
                  <ChevronRight className="w-3.5 h-3.5" />
                </a>
              </>
            )}
          </section>

          {/* ── Right: Buy box ────────────────────────────── */}
          <aside className="pdp-buy" aria-label="Pricing and RFQ actions">
            <div className="pdp-buy__price-row">
              <div>
                <div className="pdp-buy__price-label">Indicative unit price</div>
                <div className="pdp-buy__price">
                  ₹ {formatINR(unitPrice)}{" "}
                  <span className="pdp-buy__unit">/ piece</span>
                </div>
                {discountAmt > 0 && (
                  <div className="pdp-buy__was">₹ {formatINR(sellingPrice)}</div>
                )}
              </div>
            </div>

            <div className="pdp-moq">
              MOQ (Minimum Order Quantity): <strong>{minLot} pieces</strong>
            </div>

            <div className="pdp-actions">
              <div className="pdp-qty-cart">
                <div className="pdp-qty" aria-label="Required quantity">
                  <button
                    type="button"
                    onClick={() => setQty(quantity - 1)}
                    disabled={quantity <= minLot}
                    aria-label="Decrease quantity"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={minLot}
                    value={quantity}
                    onChange={(e) =>
                      setQty(parseInt(e.target.value, 10) || minLot)
                    }
                    aria-label="RFQ line quantity"
                  />
                  <button
                    type="button"
                    onClick={() => setQty(quantity + 1)}
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>

                <button
                  type="button"
                  className="pdp-btn-cart"
                  onClick={handleAddToCart}
                  disabled={addingToCart}
                >
                  <ShoppingCart className="w-4 h-4" />
                  {addingToCart ? "Adding…" : "Add to RFQ"}
                </button>
              </div>

              <div className="pdp-btn-row">
                <Link
                  href={`/enquiry?product=${product.id}`}
                  className="pdp-btn-secondary"
                >
                  Request a Quote
                </Link>
                <Link
                  href={`/rfq?product=${product.id}&qty=${quantity}`}
                  className="pdp-btn-ghost"
                >
                  Bulk Enquiry
                </Link>
              </div>
            </div>

            {cartError && (
              <div className="pdp-alert pdp-alert--error" role="alert">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{cartError}</span>
              </div>
            )}

            {cartSuccess && (
              <div className="pdp-alert pdp-alert--ok" role="status">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="w-4 h-4 shrink-0" />
                  Added {quantity} to RFQ cart
                </span>
                <Link href="/cart">
                  View RFQ cart <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            )}

            <ul className="pdp-logistics">
              <li>
                <FileText aria-hidden />
                <span>
                  <strong>GST Invoice</strong>
                  {product.gst_included
                    ? `Included (${product.gst_rate || 0}%)`
                    : `Available (+${product.gst_rate || 0}%)`}
                </span>
              </li>
              <li>
                <CreditCard aria-hidden />
                <span>
                  <strong>Commercial terms</strong>
                  PO & invoice workflow
                </span>
              </li>
            </ul>
          </aside>
        </div>

        {/* Full specifications */}
        <section className="pdp-full" id="full-specs" aria-labelledby="full-specs-heading">
          <h2 className="pdp-full__title" id="full-specs-heading">
            Full Specifications
          </h2>
          <div className="pdp-full__table-wrap">
          <table className="pdp-full__table">
            <tbody>
              <tr>
                <th scope="row">Product</th>
                <td>{product.name}</td>
              </tr>
              {realSku && (
                <tr>
                  <th scope="row">SKU</th>
                  <td>{realSku}</td>
                </tr>
              )}
              <tr>
                <th scope="row">Category</th>
                <td>{product.category?.name || "N/A"}</td>
              </tr>
              <tr>
                <th scope="row">Minimum Order Qty</th>
                <td>{minLot} pieces</td>
              </tr>
              {product.min_order_value ? (
                <tr>
                  <th scope="row">Min. Order Value</th>
                  <td>₹ {formatINR(Number(product.min_order_value))}</td>
                </tr>
              ) : null}
              <tr>
                <th scope="row">Country of Origin</th>
                <td>
                  {supplierOrigin ? (
                    <span className="pdp-origin pdp-origin--table">
                      <CountryFlag
                        origin={supplierOrigin}
                        className="pdp-origin__flag"
                        imgClassName="pdp-origin__flag-img"
                      />
                      {supplierOrigin.label}
                    </span>
                  ) : (
                    "N/A"
                  )}
                </td>
              </tr>
              <tr>
                <th scope="row">GST</th>
                <td>
                  {product.gst_rate ?? 0}% (
                  {product.gst_included ? "Included" : "Excluded"})
                </td>
              </tr>
              {(product.specifications || []).map((spec, idx) => (
                <tr key={spec.id || idx}>
                  <th scope="row">{spec.spec_name}</th>
                  <td>{spec.spec_value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </section>

        {/* Recommendations — full width, below specs (Amazon / Flipkart flow) */}
        <section className="pdp-related" aria-label="Product recommendations">
          <div className="pdp-related__head">
            <h2 className="pdp-related__title">
              {relatedTab === "recommended"
                ? "You may also like"
                : "Recently viewed"}
            </h2>
            <div className="pdp-related__tabs" role="tablist" aria-label="Recommendation type">
              <button
                type="button"
                role="tab"
                aria-selected={relatedTab === "recommended"}
                className={`pdp-related__tab ${
                  relatedTab === "recommended" ? "is-active" : ""
                }`}
                onClick={() => setRelatedTab("recommended")}
              >
                Similar products
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={relatedTab === "recent"}
                className={`pdp-related__tab ${
                  relatedTab === "recent" ? "is-active" : ""
                }`}
                onClick={() => setRelatedTab("recent")}
              >
                Recently viewed
              </button>
            </div>
          </div>

          {relatedItems.length === 0 ? (
            <div className="pdp-related__empty">
              {relatedTab === "recommended"
                ? "No similar products yet. Browse the catalog to discover more components."
                : "No recently viewed products. Explore the catalog and they will appear here."}
            </div>
          ) : (
            <div className="pdp-related__track">
              {relatedItems.map((item) => (
                <Link
                  key={item.id}
                  href={`/products/${item.id}`}
                  className="pdp-related-card"
                >
                  <div className="pdp-related-card__media">
                    {item.image ? (
                      <RemoteImage
                        src={item.image}
                        alt={item.name}
                        sizes="200px"
                        objectFit="contain"
                      />
                    ) : (
                      <Package className="w-8 h-8 text-[#9ca3af] absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />
                    )}
                  </div>
                  <div className="pdp-related-card__body">
                    <h3 className="pdp-related-card__name">{item.name}</h3>
                    <div className="pdp-related-card__meta">
                      <span className="pdp-related-card__price">
                        ₹ {formatINR(item.price)}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
