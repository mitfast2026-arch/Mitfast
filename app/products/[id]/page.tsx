"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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
  Truck,
  Weight,
  Zap,
} from "lucide-react";
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

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.id as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [selectedImage, setSelectedImage] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [addingToCart, setAddingToCart] = useState(false);
  const [cartSuccess, setCartSuccess] = useState(false);
  const [cartError, setCartError] = useState("");
  const [wishlisted, setWishlisted] = useState(false);
  const [wishlistBusy, setWishlistBusy] = useState(false);
  const [relatedTab, setRelatedTab] = useState<"recommended" | "recent">("recommended");
  const [recommended, setRecommended] = useState<RelatedProduct[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<RecentItem[]>([]);
  const thumbsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadProduct() {
      try {
        const res = await fetch(`/api/products/${productId}`);
        const json = await res.json();
        if (json.success && json.data.product) {
          const p = json.data.product as Product;
          setProduct(p);
          setQuantity(Math.max(p.moq || 1, 1));
          const sorted = [...(p.images || [])].sort(
            (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
          );
          const primary =
            sorted.find((img) => img.is_primary)?.image_url ||
            sorted[0]?.image_url ||
            "";
          setSelectedImage(primary);

          pushRecent({
            id: p.id,
            name: p.name,
            image: primary,
            price: unitPriceOf(p),
            viewedAt: Date.now(),
          });
          setRecentlyViewed(readRecent().filter((r) => r.id !== p.id));
        }
      } catch (err) {
        console.error("Error fetching product:", err);
      } finally {
        setLoading(false);
      }
    }

    if (productId) loadProduct();
  }, [productId]);

  useEffect(() => {
    if (!product) return;
    let cancelled = false;

    async function loadRecommended() {
      try {
        const qs = new URLSearchParams({ limit: "8" });
        if (product!.category?.id) qs.set("categoryId", product!.category.id);
        const res = await fetch(`/api/products?${qs.toString()}`);
        const json = await res.json();
        if (cancelled || !json.success) return;
        const list = ((json.data?.products || []) as RelatedProduct[]).filter(
          (p) => p.id !== product!.id,
        );
        setRecommended(list.slice(0, 8));
      } catch {
        if (!cancelled) setRecommended([]);
      }
    }

    loadRecommended();
    return () => {
      cancelled = true;
    };
  }, [product]);

  useEffect(() => {
    if (!productId) return;
    let cancelled = false;

    async function loadWishlistState() {
      try {
        const res = await fetch("/api/wishlist");
        const json = await res.json();
        if (cancelled || !json.success) return;
        const ids = (json.data?.items || []).map(
          (item: { productId: string }) => item.productId,
        );
        setWishlisted(ids.includes(productId));
      } catch {
        if (!cancelled) setWishlisted(false);
      }
    }

    loadWishlistState();
    return () => {
      cancelled = true;
    };
  }, [productId]);

  async function handleToggleWishlist() {
    if (!product) return;
    setWishlistBusy(true);
    try {
      if (wishlisted) {
        const res = await fetch(`/api/wishlist?productId=${product.id}`, {
          method: "DELETE",
        });
        const json = await res.json();
        if (res.ok && json.success) setWishlisted(false);
      } else {
        const res = await fetch("/api/wishlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId: product.id }),
        });
        const json = await res.json();
        if (res.ok && json.success) setWishlisted(true);
      }
    } catch {
      /* ignore */
    } finally {
      setWishlistBusy(false);
    }
  }

  async function handleAddToCart() {
    setCartError("");
    setAddingToCart(true);
    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product!.id,
          quantity,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setCartError(json.error?.message || "Failed to add to cart");
      } else {
        setCartSuccess(true);
        window.dispatchEvent(new Event("cart-updated"));
        setTimeout(() => setCartSuccess(false), 4000);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error updating cart";
      setCartError(message);
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
          <h1>Component Not Found</h1>
          <p>
            The component you are looking for does not exist or is currently
            archived.
          </p>
          <Link href="/products">Return to Catalog</Link>
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

            <p className="pdp-desc">
              {product.description?.trim() || "No description provided."}
            </p>

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
                  Added {quantity} to RFQ workspace
                </span>
                <Link href="/cart">
                  View RFQ workspace <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            )}

            <ul className="pdp-logistics">
              <li>
                <Truck aria-hidden />
                <span>
                  <strong>Estimated dispatch</strong>
                  3–5 working days
                </span>
              </li>
              <li>
                <Package aria-hidden />
                <span>
                  <strong>Freight & logistics</strong>
                  Quoted at RFQ acceptance
                </span>
              </li>
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

        {/* Recommended / Recently viewed */}
        <section className="pdp-related" aria-label="More products">
          <div className="pdp-related__tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={relatedTab === "recommended"}
              className={`pdp-related__tab ${
                relatedTab === "recommended" ? "is-active" : ""
              }`}
              onClick={() => setRelatedTab("recommended")}
            >
              Related components
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

          {relatedItems.length === 0 ? (
            <div className="pdp-related__empty">
              {relatedTab === "recommended"
                ? "No recommendations available yet. Browse the catalog for similar components."
                : "No recently viewed products yet. Explore the catalog and come back here."}
            </div>
          ) : (
            <div className="pdp-related__grid">
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
                        sizes="(max-width: 700px) 50vw, 25vw"
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

        {/* Full specifications */}
        <section className="pdp-full" id="full-specs" aria-labelledby="full-specs-heading">
          <h2 className="pdp-full__title" id="full-specs-heading">
            Full Specifications
          </h2>
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
        </section>
      </div>
    </div>
  );
}
