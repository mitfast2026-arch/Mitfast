"use client";

/*
 * MITFAST B2B Industrial Marketplace — RFQ & Cart Workspace
 * Large Desktop Fluid Layout (1440px / 1600px / 1920px)
 * Dynamic Dual-Pathway:
 *  - Cart >= ₹5,00,000 + MOQ satisfied -> Submit Official Production RFQ
 *  - Cart < ₹5,00,000 or below MOQ -> Submit Commercial / Small-Batch Enquiry
 */

import React, { useState, useEffect, useMemo, useRef, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ShoppingCart,
  Trash2,
  ArrowRight,
  CheckCircle2,
  Package,
  AlertTriangle,
  MapPin,
  Plus,
  Minus,
  RefreshCw,
  X,
  Edit3,
  Building2,
  ShieldCheck,
  Send,
  FileText,
  Info,
  Loader2,
} from "lucide-react";
import gsap from "gsap";
import { toast } from "sonner";
import { createBrowserClient } from "@/lib/supabase/client";
import { RemoteImage } from "@/components/ui/RemoteImage";
import AuthOrGuestGate from "@/components/commerce/AuthOrGuestGate";
import { getSettings } from "@/lib/client/settings-cache";
import { mergeGuestStateOnce } from "@/lib/client/guest-merge";
import "./cart.css";

interface SampleProduct {
  id: string;
  name: string;
  category?: { name: string };
  categoryName?: string;
  selling_price?: number;
  sellingPrice?: number;
  moq: number;
  stock_quantity?: number;
  ribbon_label?: string;
  primaryImage?: string | null;
  images?: { image_url: string }[];
  supplier?: { company_name?: string; country?: string };
  supplier_country?: string;
}

function CartRFQPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const containerRef = useRef<HTMLDivElement>(null);

  const [cart, setCart] = useState<any>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>("");
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [customAddress, setCustomAddress] = useState({
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "India",
  });

  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [gstin, setGstin] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");

  const [minimumRfqValue, setMinimumRfqValue] = useState<number>(500000);
  const [currency, setCurrency] = useState<string>("INR");

  // Sample catalog suggestions for empty state & quick additions
  const [sampleProducts, setSampleProducts] = useState<SampleProduct[]>([]);
  const [addingSampleId, setAddingSampleId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [successToast, setSuccessToast] = useState("");
  const [gateOpen, setGateOpen] = useState(false);
  const [enquirySuccessModal, setEnquirySuccessModal] = useState<{
    open: boolean;
    trackingToken?: string;
    isEnquiry: boolean;
  }>({ open: false, isEnquiry: true });

  const notifyCartUpdated = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("cart-updated"));
    }
  };

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => {
      setSuccessToast("");
    }, 3500);
  };

  useEffect(() => {
    async function initCart() {
      const supabase = createBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      let isBuyer = false;

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select(
            "id, role, full_name, email, phone, company_name, gstin"
          )
          .eq("user_id", user.id)
          .single();

        if (profile && (profile.role === "customer" || profile.role === "buyer")) {
          isBuyer = true;
          setCustomer(profile);
          setContactName((profile.full_name || "").trim());
          setContactEmail((profile.email || "").trim());
          setContactPhone((profile.phone || "").trim());
          setCompanyName((profile.company_name || "").trim());
          setGstin((profile.gstin || "").trim());
        }
      }

      const prefillProduct = searchParams.get("product");
      const prefillQty = Number(searchParams.get("qty") || "1");

      // Independent work in parallel (merge + addresses + settings).
      // Prefill POST must finish before cart GET when present.
      const sideWork: Promise<unknown>[] = [getSettings()];
      if (isBuyer) {
        sideWork.push(mergeGuestStateOnce());
        sideWork.push(
          (async () => {
            try {
              const addrRes = await fetch("/api/customer/addresses");
              const addrJson = await addrRes.json();
              if (addrRes.ok && addrJson.success) {
                const addrs = addrJson.data?.addresses || [];
                setAddresses(addrs);
                const primary = addrs[0];
                if (primary) setSelectedAddressId(primary.id);
              }
            } catch {
              /* optional */
            }
          })()
        );
      }

      if (prefillProduct) {
        try {
          await fetch("/api/cart", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              productId: prefillProduct,
              quantity: Number.isFinite(prefillQty) && prefillQty > 0 ? prefillQty : 1,
            }),
          });
          notifyCartUpdated();
        } catch (e) {
          console.error("Prefill add error:", e);
        }
      }

      const [s, cartRes] = await Promise.allSettled([
        Promise.allSettled(sideWork).then((results) => {
          const settingsResult = results[0];
          return settingsResult.status === "fulfilled" ? settingsResult.value : null;
        }),
        fetch("/api/cart"),
      ]);

      // Apply settings (getSettings return value)
      if (s.status === "fulfilled" && s.value) {
        const settings = s.value as Awaited<ReturnType<typeof getSettings>>;
        if (settings) {
          if (typeof settings.minimumRfqValue === "number")
            setMinimumRfqValue(settings.minimumRfqValue);
          if (settings.currency) setCurrency(settings.currency);
        }
      }

      // Apply cart
      if (cartRes.status === "fulfilled") {
        try {
          const cartJson = await cartRes.value.json();
          if (cartRes.value.ok && cartJson.success) {
            setCart(cartJson.data);
          } else {
            setErrorMsg(cartJson.error?.message || "Could not load cart");
          }
        } catch (err: any) {
          setErrorMsg(err.message || "Failed to load cart");
        }
      } else {
        setErrorMsg("Failed to load cart");
      }

      // Sample products in parallel with nothing critical left
      try {
        const sampleRes = await fetch("/api/products?limit=6");
        const sampleJson = await sampleRes.json();
        if (sampleRes.ok && sampleJson.success) {
          setSampleProducts(sampleJson.data?.products || []);
        }
      } catch {
        /* non-critical */
      }

      setLoading(false);
    }

    initCart();
  }, [router, searchParams]);

  const items = cart?.items || [];
  const cartTotal = cart?.subtotal ?? cart?.cart_total ?? 0;
  
  const itemsBelowMoq = useMemo(() => {
    return items.filter((item: any) => (item.quantity || 0) < (item.product?.moq || 1));
  }, [items]);

  const totalMoqPiecesRemaining = useMemo(() => {
    return items.reduce((acc: number, curr: any) => {
      const moq = curr.product?.moq || 1;
      const diff = Math.max(0, moq - (curr.quantity || 0));
      return acc + diff;
    }, 0);
  }, [items]);

  // Dual pathway evaluation:
  // Cart meets official RFQ threshold if total >= ₹5,00,000 AND all item MOQs are satisfied
  const meetsRfqThreshold = cartTotal >= minimumRfqValue && itemsBelowMoq.length === 0;
  const isCommercialEnquiryMode = !meetsRfqThreshold;

  const progressPercent = Math.min(100, Math.round((cartTotal / Math.max(1, minimumRfqValue)) * 100));
  const amountNeeded = Math.max(0, minimumRfqValue - cartTotal);

  const totalQuantity = useMemo(() => {
    return items.reduce((acc: number, curr: any) => acc + (curr.quantity || 0), 0);
  }, [items]);

  const selectedAddress = useMemo(() => {
    if (selectedAddressId && selectedAddressId !== "custom") {
      return addresses.find((a) => a.id === selectedAddressId) || null;
    }
    return null;
  }, [selectedAddressId, addresses]);

  // GSAP entrance animation
  useEffect(() => {
    if (!containerRef.current) return;
    const isReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (isReduced) return;

    const ctx = gsap.context(() => {
      gsap.from(".b2b-anim", {
        opacity: 0,
        y: 12,
        duration: 0.35,
        stagger: 0.06,
        ease: "power2.out",
      });
    }, containerRef);

    return () => ctx.revert();
  }, [items.length]);

  async function handleUpdateQuantity(
    cartItemId: string,
    newQty: number,
    moq: number = 1,
  ) {
    if (newQty < 1 || !cart?.items) return;
    setErrorMsg("");

    const prevCart = cart;

    // 1. Optimistic instant in-memory update
    const updatedItems = cart.items.map((it: any) => {
      if (it.id === cartItemId) {
        const unitPrice =
          it.product?.actualUnitPrice ??
          it.product?.sellingPrice ??
          it.unit_price ??
          0;
        const itemTotal = unitPrice * newQty;
        return { ...it, quantity: newQty, itemTotal };
      }
      return it;
    });

    const newSubtotal = updatedItems.reduce(
      (acc: number, it: any) => acc + (it.itemTotal || 0),
      0
    );

    setCart({
      ...cart,
      items: updatedItems,
      subtotal: newSubtotal,
      itemCount: updatedItems.length,
    });

    // Synchronously notify listeners
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("cart-updated", {
          detail: { exactCount: updatedItems.length },
        })
      );
    }

    // 2. Background API sync
    try {
      const res = await fetch("/api/cart", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cartItemId, quantity: newQty }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        // Rollback
        setCart(prevCart);
        const errMsg = json.error?.message || "Could not update quantity.";
        setErrorMsg(errMsg);
        toast.error(errMsg);
      }
    } catch (err: any) {
      setCart(prevCart);
      const errMsg = err.message || "Failed to update quantity";
      setErrorMsg(errMsg);
      toast.error(errMsg);
    }
  }

  async function handleRemoveItem(cartItemId: string, productName?: string) {
    if (!cart?.items) return;
    const prevCart = cart;

    // 1. Optimistic removal
    const updatedItems = cart.items.filter((it: any) => it.id !== cartItemId);
    const newSubtotal = updatedItems.reduce(
      (acc: number, it: any) => acc + (it.itemTotal || 0),
      0
    );

    setCart({
      ...cart,
      items: updatedItems,
      subtotal: newSubtotal,
      itemCount: updatedItems.length,
    });

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("cart-updated", {
          detail: { exactCount: updatedItems.length, delta: -1 },
        })
      );
    }

    const toastMsg = productName
      ? `Removed "${productName}"`
      : "Item removed from cart";
    toast.success(toastMsg, { duration: 2500 });

    // 2. Background sync
    try {
      const res = await fetch(`/api/cart?cartItemId=${cartItemId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setCart(prevCart);
        toast.error(json.error?.message || "Failed to remove item");
      }
    } catch (err) {
      setCart(prevCart);
      toast.error("Network error removing item");
    }
  }

  async function handleClearCart() {
    if (!window.confirm("Remove all items from your RFQ cart?")) return;
    const prevCart = cart;

    // 1. Optimistic clear
    setCart({ items: [], subtotal: 0, itemCount: 0 });
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("cart-updated", { detail: { exactCount: 0 } })
      );
    }
    toast.success("Cart cleared", { duration: 2500 });

    // 2. Background sync
    try {
      const res = await fetch("/api/cart?clear=true", { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setCart(prevCart);
        toast.error("Failed to clear cart");
      }
    } catch {
      setCart(prevCart);
      toast.error("Network error clearing cart");
    }
  }

  async function handleAddSampleToCart(product: SampleProduct) {
    setAddingSampleId(product.id);
    setErrorMsg("");
    const qty = product.moq && product.moq > 0 ? product.moq : 100;

    // Optimistic badge bump
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("cart-updated", { detail: { delta: 1 } })
      );
    }

    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          quantity: qty,
        }),
      });
      const json = await res.json();
      if (json.success) {
        const cartRes = await fetch("/api/cart");
        const cartJson = await cartRes.json();
        if (cartJson.success) {
          setCart(cartJson.data);
        }
        toast.success(`Added ${qty} pcs of ${product.name}`);
      } else {
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("cart-updated", { detail: { delta: -1 } })
          );
        }
        const errMsg = json.error?.message || "Could not add product to cart";
        setErrorMsg(errMsg);
        toast.error(errMsg);
      }
    } catch (err: any) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("cart-updated", { detail: { delta: -1 } })
        );
      }
      const errMsg = err.message || "Failed to add product";
      setErrorMsg(errMsg);
      toast.error(errMsg);
    } finally {
      setAddingSampleId(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");

    if (!cart || !cart.items || cart.items.length === 0) {
      setErrorMsg("Your cart is empty. Add products to proceed.");
      return;
    }

    const trimmedName = contactName.trim();
    const trimmedEmail = contactEmail.trim();
    const trimmedPhone = contactPhone.trim();

    if (
      trimmedName.length < 2 ||
      !trimmedEmail.includes("@") ||
      trimmedPhone.length < 7
    ) {
      setErrorMsg("Please provide your full name, work email, and phone number.");
      return;
    }

    setSubmitting(true);

    // If logged in, save/update buyer contact profile
    if (customer?.id) {
      try {
        await fetch("/api/auth/complete-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName: trimmedName,
            email: trimmedEmail,
            phone: trimmedPhone,
            companyName: companyName.trim() || undefined,
            gstin: gstin.trim() || undefined,
            intendedRole: "customer",
          }),
        });
      } catch {
        /* best-effort */
      }
    }

    // Resolve delivery address
    let deliveryAddress: any = null;
    if (selectedAddressId && selectedAddressId !== "custom") {
      const addr = addresses.find((a) => a.id === selectedAddressId);
      if (addr) {
        deliveryAddress = {
          address_line_1: addr.address_line_1,
          address_line_2: addr.address_line_2,
          city: addr.city,
          state: addr.state,
          postal_code: addr.postal_code,
          country: addr.country,
        };
      }
    } else if (customAddress.addressLine1) {
      deliveryAddress = {
        address_line_1: customAddress.addressLine1,
        address_line_2: customAddress.addressLine2,
        city: customAddress.city,
        state: customAddress.state,
        postal_code: customAddress.postalCode,
        country: customAddress.country,
      };
    }

    /* ── PATHWAY 1: Official Factory RFQ (>= ₹5,00,000 & MOQ met) ── */
    if (meetsRfqThreshold) {
      if (!customer?.id) {
        setGateOpen(true);
        setSubmitting(false);
        return;
      }

      try {
        const res = await fetch("/api/rfqs", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key":
              typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
                ? crypto.randomUUID()
                : `rfq-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
          },
          body: JSON.stringify({
            customerId: customer.id,
            deliveryAddress,
            customerMessage: customerNotes.trim() || undefined,
            contact: {
              fullName: trimmedName,
              email: trimmedEmail,
              phone: trimmedPhone,
            },
          }),
        });

        const json = await res.json();
        if (!res.ok || !json.success) {
          setErrorMsg(json.error?.message || "Failed to submit official RFQ");
          setSubmitting(false);
        } else {
          const count = Array.isArray(json.data?.rfqs) ? json.data.rfqs.length : 1;
          notifyCartUpdated();
          if (count > 1) {
            // Multi-supplier cart → one RFQ per supplier
            router.push(`/customer/rfqs?created=${count}`);
          } else {
            router.push("/customer/rfqs");
          }
        }
      } catch (err: any) {
        setErrorMsg(err.message || "Server error while submitting RFQ");
        setSubmitting(false);
      }
      return;
    }

    /* ── PATHWAY 2: Commercial / Small-Batch Enquiry (< ₹5,00,000 or below MOQ) ── */
    try {
      const lineItemsPayload = items.map((i: any) => ({
        productId: i.productId,
        name: i.product?.name || "Product",
        quantity: i.quantity,
      }));

      const destCity = deliveryAddress ? `${deliveryAddress.city}, ${deliveryAddress.state}` : "India";
      const messageText = `Commercial Cart Enquiry\nTotal Cart Value: ₹${cartTotal.toLocaleString("en-IN")}\nTotal Volume: ${totalQuantity.toLocaleString("en-IN")} pcs\nDelivery Location: ${destCity}\nBuyer Notes: ${customerNotes.trim() || "Standard stock check and commercial quotation requested."}`;

      const enquiryRes = await fetch("/api/enquiries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key":
            typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
              ? crypto.randomUUID()
              : `enq-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        },
        body: JSON.stringify({
          name: trimmedName,
          email: trimmedEmail,
          phone: trimmedPhone,
          companyName: companyName.trim() || undefined,
          country: deliveryAddress?.country || "India",
          enquiryType: "cart_enquiry",
          message: messageText,
          lineItems: lineItemsPayload,
        }),
      });

      const enquiryJson = await enquiryRes.json();
      if (!enquiryRes.ok || !enquiryJson.success) {
        setErrorMsg(enquiryJson.error?.message || "Failed to submit commercial enquiry");
        setSubmitting(false);
        return;
      }

      // Clear the cart on successful enquiry submission
      try {
        await fetch("/api/cart?clear=true", { method: "DELETE" });
      } catch {
        /* best-effort */
      }
      setCart((prev: any) =>
        prev
          ? { ...prev, items: [], itemCount: 0, subtotal: 0 }
          : { cartId: "guest", items: [], itemCount: 0, subtotal: 0 }
      );
      notifyCartUpdated();

      const trackingToken = enquiryJson.data?.trackingToken || enquiryJson.data?.enquiryId;
      if (customer?.id) {
        router.push(`/customer/enquiries?submitted=true`);
      } else {
        setEnquirySuccessModal({
          open: true,
          trackingToken,
          isEnquiry: true,
        });
        setSubmitting(false);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Server error while submitting enquiry");
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="b2b-cart-container min-h-[60vh] space-y-6">
        <div className="h-7 w-56 bg-[#F0F2F5] rounded animate-pulse" />
        <div className="h-12 w-96 bg-[#F0F2F5] rounded animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_440px] gap-8">
          <div className="h-96 bg-white rounded-2xl border border-[#E2E4E8] animate-pulse" />
          <div className="h-96 bg-white rounded-2xl border border-[#E2E4E8] animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="b2b-cart-container">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 bg-[#111315] text-white rounded-xl shadow-2xl text-sm font-semibold animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="b2b-cart-header b2b-anim">
        <div className="b2b-cart-breadcrumb">
          <Link href="/">Home</Link>
          <span>/</span>
          <span className="text-[#111315] font-semibold">
            {meetsRfqThreshold ? "RFQ Cart" : "Enquiry & Cart"} ({items.length})
          </span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3 mt-1">
          <h1 className="b2b-cart-title">
            {meetsRfqThreshold ? "Request for Quote (RFQ)" : "Cart & Commercial Enquiry"}
          </h1>
          {items.length > 0 && (
            <button
              type="button"
              onClick={handleClearCart}
              disabled={actionInProgress === "clear-all"}
              className="text-sm font-semibold text-[#6B7280] hover:text-[#B91C1C] transition-colors"
            >
              Clear Cart
            </button>
          )}
        </div>
        <p className="b2b-cart-subtitle">
          {meetsRfqThreshold
            ? "Your volume qualifies for direct factory RFQ pricing. Review batch items and submit for engineering quotation."
            : "Review batch items, verify MOQ compliance, and submit as a Commercial Enquiry to our sales desk."}
        </p>
      </div>

      {/* ── Empty State ───────────────────────── */}
      {items.length === 0 ? (
        <div className="space-y-10 b2b-anim">
          <div className="b2b-empty-card">
            <div className="b2b-empty-icon-box">
              <ShoppingCart className="w-10 h-10 stroke-[1.5]" />
            </div>
            <h2 className="b2b-empty-title">Your cart is empty!</h2>
            <p className="b2b-empty-sub">
              Explore our industrial catalog of high-tensile bolts, CNC turned components, titanium aerospace fasteners, and hydraulic couplings.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/products"
                className="inline-flex items-center gap-2.5 px-8 py-3.5 bg-[#111315] text-white rounded-xl font-bold text-base hover:bg-[#1F2429] transition-all shadow-sm hover:shadow-md"
              >
                <span>Browse Product Catalog</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/enquiry?type=custom_manufacturing"
                className="inline-flex items-center gap-2.5 px-8 py-3.5 bg-[#F7F7F8] border border-[#E2E4E8] text-[#111315] rounded-xl font-bold text-base hover:bg-[#ECEEF0] transition-colors"
              >
                <span>Upload Custom CAD Drawing</span>
              </Link>
            </div>
          </div>

          {/* Recommended Products Grid */}
          {sampleProducts.length > 0 && (
            <div className="space-y-6 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-[#111315]">
                    Popular Industrial Fasteners
                  </h3>
                  <p className="text-sm text-[#6B7280] mt-0.5">
                    Click to add standard batch quantities directly to your cart.
                  </p>
                </div>
                <Link
                  href="/products"
                  className="text-sm font-bold text-[#111315] hover:underline inline-flex items-center gap-1.5"
                >
                  <span>View All</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              <div className="b2b-rec-grid">
                {sampleProducts.map((p) => {
                  const price = p.selling_price ?? p.sellingPrice ?? 0;
                  const moq = p.moq || 100;
                  const isAdding = addingSampleId === p.id;
                  const img =
                    p.primaryImage ||
                    p.images?.[0]?.image_url ||
                    "";

                  return (
                    <div key={p.id} className="b2b-rec-card group">
                      <div className="flex items-start gap-4">
                        <div className="w-20 h-20 rounded-xl bg-[#F7F7F8] border border-[#E2E4E8] overflow-hidden flex items-center justify-center shrink-0">
                          {img ? (
                            <RemoteImage src={img} alt={p.name} sizes="80px" />
                          ) : (
                            <Package className="w-8 h-8 text-[#9CA3AF]" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-xs font-semibold uppercase text-[#6B7280] block truncate tracking-wide">
                            {p.category?.name || p.categoryName || "Fastener"}
                          </span>
                          <Link
                            href={`/products/${p.id}`}
                            className="text-base font-bold text-[#111315] line-clamp-1 group-hover:underline block mt-0.5"
                          >
                            {p.name}
                          </Link>
                          <div className="mt-1.5 flex items-baseline gap-2">
                            <span className="text-base font-bold text-[#111315]">
                              ₹{price.toLocaleString("en-IN")}
                            </span>
                            <span className="text-xs text-[#6B7280]">/ pc</span>
                            <span className="text-xs font-semibold text-[#6B7280] ml-auto">
                              MOQ: {moq}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 pt-3.5 border-t border-[#E2E4E8] flex items-center justify-between">
                        <span className="text-sm text-[#6B7280]">
                          Batch Total: <strong className="text-[#111315] font-bold">₹{(price * moq).toLocaleString("en-IN")}</strong>
                        </span>

                        <button
                          type="button"
                          onClick={() => handleAddSampleToCart(p)}
                          disabled={isAdding}
                          className="b2b-rec-add-btn"
                        >
                          {isAdding ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>Adding…</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-4 h-4" />
                              <span>Add to Cart</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ── Populated Cart & RFQ Workspace ───────────────────────── */
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] xl:grid-cols-[1fr_460px] gap-8 xl:gap-9 items-start b2b-anim">
          {/* Left Column: Delivery Address + Items */}
          <div className="space-y-5">
            {/* Delivery Address Banner */}
            <div className="b2b-address-strip">
              <div className="b2b-address-info">
                <MapPin className="b2b-address-pin-icon" />
                <div>
                  <div className="b2b-address-text-main">
                    {selectedAddress
                      ? `Deliver to: ${contactName || "Buyer"}, ${selectedAddress.postal_code}`
                      : customAddress.postalCode
                      ? `Deliver to: ${contactName || "Buyer"}, ${customAddress.postalCode}`
                      : "Delivery Address"}
                  </div>
                  <div className="b2b-address-text-sub">
                    {selectedAddress
                      ? `${selectedAddress.address_line_1}, ${selectedAddress.city}, ${selectedAddress.state}`
                      : customAddress.addressLine1
                      ? `${customAddress.addressLine1}, ${customAddress.city}, ${customAddress.state}`
                      : "Set consignee delivery address for accurate freight & tax calculation"}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setAddressModalOpen(true)}
                className="b2b-address-change-btn"
              >
                <Edit3 className="w-4 h-4" />
                <span>{selectedAddress || customAddress.addressLine1 ? "Change" : "Add Address"}</span>
              </button>
            </div>

            {/* Threshold & Pathway Banner */}
            <div
              className={`b2b-threshold-banner ${
                meetsRfqThreshold
                  ? "b2b-threshold-banner--met"
                  : "b2b-threshold-banner--pending"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  {meetsRfqThreshold ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="b2b-threshold-title">
                      {meetsRfqThreshold ? (
                        <span>Volume Threshold Qualified (₹{cartTotal.toLocaleString("en-IN")} / ₹{minimumRfqValue.toLocaleString("en-IN")}) — Official RFQ Mode</span>
                      ) : (
                        <span>
                          ₹{amountNeeded.toLocaleString("en-IN")} remaining for Official RFQ • Ready to Submit as Commercial Enquiry
                        </span>
                      )}
                    </div>
                    <div className="b2b-threshold-sub">
                      {meetsRfqThreshold ? (
                        <span>Your order volume qualifies for direct factory pricing and official RFQ quotation.</span>
                      ) : (
                        <span>
                          Current total: <strong>₹{cartTotal.toLocaleString("en-IN")}</strong> ({progressPercent}% of RFQ threshold).
                          Orders below ₹{minimumRfqValue.toLocaleString("en-IN")} can be sent directly as a <strong>Commercial Enquiry</strong> for quick sales desk review and stock check.
                          {itemsBelowMoq.length > 0 && (
                            <span className="text-amber-800 font-semibold ml-1 block mt-0.5">
                              • Note: {itemsBelowMoq.length} {itemsBelowMoq.length === 1 ? "item is" : "items are"} below standard production MOQ ({totalMoqPiecesRemaining.toLocaleString("en-IN")} pcs needed).
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Status Indicator */}
                <div className="shrink-0 flex items-center gap-3">
                  {!meetsRfqThreshold ? (
                    <div className="px-3.5 py-1.5 bg-amber-100/90 border border-amber-200 rounded-lg text-xs font-bold text-amber-900">
                      Commercial Enquiry
                    </div>
                  ) : (
                    <div className="px-3.5 py-1.5 bg-emerald-100 border border-emerald-200 rounded-lg text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Official RFQ</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="b2b-threshold-progress-bar">
                <div
                  className={`b2b-threshold-progress-fill ${
                    meetsRfqThreshold
                      ? "b2b-threshold-progress-fill--met"
                      : "b2b-threshold-progress-fill--pending"
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Cart Items Box */}
            <div className="b2b-items-box">
              <div className="b2b-items-header">
                <span>Cart Items ({items.length})</span>
                <span className="text-sm font-semibold text-[#6B7280]">
                  Total Quantity: {totalQuantity.toLocaleString("en-IN")} units
                </span>
              </div>

              <div>
                {items.map((item: any) => {
                  const p = item.product;
                  const unitPrice =
                    p?.actualUnitPrice ??
                    p?.sellingPrice ??
                    p?.selling_price ??
                    0;
                  const lineTotal = item.itemTotal ?? unitPrice * item.quantity;
                  const minQty = p?.moq || 1;
                  const isUpdating = actionInProgress === item.id;
                  const img = p?.primaryImage || p?.images?.[0]?.image_url;
                  const moqShortage = Math.max(0, minQty - item.quantity);

                  return (
                    <div key={item.id} className="b2b-item-row">
                      {/* Top: Image + Info */}
                      <div className="b2b-item-main">
                        <div className="b2b-item-image-box">
                          {img ? (
                            <RemoteImage
                              src={img}
                              alt={p?.name || "Product"}
                              sizes="144px"
                            />
                          ) : (
                            <Package className="w-10 h-10 text-[#9CA3AF] stroke-[1.5]" />
                          )}
                        </div>

                        <div className="b2b-item-details">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="b2b-item-category">
                              {p?.categoryName || p?.category?.name || "Industrial Fastener"}
                            </span>
                            {p?.ribbonLabel && (
                              <span className="px-2.5 py-0.5 text-xs font-bold uppercase bg-[#111315] text-white rounded-md">
                                {p.ribbonLabel}
                              </span>
                            )}
                          </div>

                          <Link
                            href={`/products/${p?.id}`}
                            className="b2b-item-title"
                          >
                            {p?.name}
                          </Link>

                          <div className="b2b-item-meta">
                            <span className="b2b-item-badge-moq">
                              MOQ: {minQty.toLocaleString("en-IN")} pcs
                            </span>

                            {/* Informative MOQ status badge per item */}
                            {moqShortage > 0 ? (
                              <span className="px-2.5 py-0.5 text-xs font-bold bg-amber-50 border border-amber-200 text-amber-800 rounded-md flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                {moqShortage.toLocaleString("en-IN")} pcs left to reach MOQ (Enquiry allowed)
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-md flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                MOQ Satisfied ({item.quantity.toLocaleString("en-IN")} pcs)
                              </span>
                            )}

                            <span>•</span>
                            <span className="text-emerald-700 font-semibold flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" />
                              In Stock
                            </span>
                          </div>

                          {/* Price */}
                          <div className="b2b-item-price-block">
                            <span className="b2b-item-unit-price">
                              ₹{unitPrice.toLocaleString("en-IN")}
                            </span>
                            <span className="b2b-item-unit-label">/ piece</span>
                            {p?.discount > 0 && (
                              <span className="b2b-item-discount">
                                (Save ₹{p.discount.toLocaleString("en-IN")})
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Bottom Action Bar: Stepper + Total + Remove */}
                      <div className="b2b-item-actions-bar">
                        <div className="b2b-stepper-wrap">
                          <span className="b2b-stepper-label">Quantity:</span>
                          <div className="b2b-stepper-control">
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateQuantity(
                                  item.id,
                                  Math.max(1, item.quantity - (minQty >= 50 ? 50 : 10)),
                                  1,
                                )
                              }
                              disabled={isUpdating || item.quantity <= 1}
                              className="b2b-stepper-btn"
                              aria-label="Decrease quantity"
                            >
                              <Minus className="w-4 h-4" />
                            </button>

                            <input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                if (!isNaN(val) && val > 0) {
                                  handleUpdateQuantity(item.id, val, 1);
                                }
                              }}
                              className="b2b-stepper-input"
                              aria-label="Quantity"
                            />

                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateQuantity(
                                  item.id,
                                  item.quantity + (minQty >= 50 ? 50 : 10),
                                  1,
                                )
                              }
                              disabled={isUpdating}
                              className="b2b-stepper-btn"
                              aria-label="Increase quantity"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center gap-8">
                          <div className="text-right">
                            <div className="text-xs text-[#6B7280] font-medium">Line Total</div>
                            <div className="b2b-item-line-total">
                              ₹{lineTotal.toLocaleString("en-IN")}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id, p?.name)}
                            disabled={isUpdating}
                            className="b2b-remove-btn"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>Remove</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Notes Field */}
            <div className="p-5 bg-white border border-[#E2E4E8] rounded-2xl space-y-2.5">
              <label className="block text-sm font-bold uppercase tracking-wider text-[#111315]">
                Order & Technical Notes (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="Specify delivery timeline, custom surface coating, tolerance notes, or inspection requests..."
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                className="w-full p-3.5 text-base text-[#111315] bg-[#F7F7F8] border border-[#E2E4E8] rounded-xl outline-none focus:bg-white focus:border-[#111315] transition-colors resize-none"
              />
            </div>
          </div>

          {/* Right Column: Price Details & Dual-Pathway Submit */}
          <div>
            <form onSubmit={handleSubmit} className="b2b-summary-card">
              <div className="b2b-summary-head flex items-center justify-between">
                <span>Price Details</span>
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${meetsRfqThreshold ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                  {meetsRfqThreshold ? "Direct RFQ" : "Commercial Enquiry"}
                </span>
              </div>

              <div className="b2b-summary-body space-y-3.5">
                <div className="b2b-summary-line">
                  <span>Price ({items.length} {items.length === 1 ? "item" : "items"})</span>
                  <span>₹{cartTotal.toLocaleString("en-IN")}</span>
                </div>

                <div className="b2b-summary-line">
                  <span>Total Volume</span>
                  <span>{totalQuantity.toLocaleString("en-IN")} pcs</span>
                </div>

                <div className="b2b-summary-line">
                  <span>Estimated GST (18% B2B)</span>
                  <span>₹{Math.round(cartTotal * 0.18).toLocaleString("en-IN")}</span>
                </div>

                <div className="b2b-summary-line">
                  <span>Delivery Charges</span>
                  <span className="text-emerald-700 font-semibold">Calculated on Quote</span>
                </div>

                <div className="b2b-summary-grand-total">
                  <span>Total Amount</span>
                  <span>₹{Math.round(cartTotal * 1.18).toLocaleString("en-IN")}</span>
                </div>

                {/* Submission Pathway Explanation Notice */}
                {!meetsRfqThreshold ? (
                  <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl text-xs text-amber-900 leading-relaxed flex items-start gap-2">
                    <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <strong>Commercial Enquiry:</strong> Cart total is under the ₹5,00,000 threshold. You can submit this as an inquiry to our sales team for custom pricing and stock confirmation.
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-emerald-50/80 border border-emerald-200/80 rounded-xl text-xs text-emerald-900 leading-relaxed flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                    <div>
                      <strong>Official RFQ Qualified:</strong> Your order meets all volume and MOQ criteria for direct factory bidding and formal quote dispatch.
                    </div>
                  </div>
                )}

                {/* Buyer / Contact Details Summary */}
                <div className="pt-4 border-t border-[#E2E4E8] space-y-2.5">
                  <div className="font-bold text-sm text-[#111315] uppercase tracking-wider">
                    Buyer Details
                  </div>
                  {customer?.id ? (
                    <div className="space-y-1 text-sm text-[#6B7280]">
                      <div className="font-bold text-base text-[#111315]">{contactName || "Verified Buyer"}</div>
                      <div>{contactEmail} • {contactPhone}</div>
                      {companyName && <div className="font-medium text-[#111315]">Company: {companyName}</div>}
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      <input
                        className="b2b-input"
                        placeholder="Full Name *"
                        required
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                      />
                      <input
                        className="b2b-input"
                        type="email"
                        placeholder="Corporate Email *"
                        required
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                      />
                      <input
                        className="b2b-input"
                        type="tel"
                        placeholder="Phone Number *"
                        required
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                      />
                    </div>
                  )}
                </div>

                {/* Error Banner */}
                {errorMsg && (
                  <div className="p-3.5 bg-[#FEF2F2] border border-[#FECACA] rounded-xl text-sm text-[#B91C1C] flex items-start gap-2.5">
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Dual Pathway Submit Button */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="b2b-submit-cta"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>{meetsRfqThreshold ? "Submitting Official RFQ…" : "Submitting Commercial Enquiry…"}</span>
                    </>
                  ) : meetsRfqThreshold ? (
                    <>
                      <span>Submit Request for Quote</span>
                      <ArrowRight className="w-5 h-5" />
                    </>
                  ) : (
                    <>
                      <span>Submit as Commercial Enquiry</span>
                      <Send className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="pt-2 text-center text-xs text-[#6B7280] flex items-center justify-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Safe and Secure B2B Procurement</span>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Guest Enquiry Confirmation Modal */}
      {enquirySuccessModal.open && (
        <div className="b2b-modal-overlay">
          <div className="b2b-modal-content space-y-6 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div>
              <h3 className="text-2xl font-bold text-[#111315]">
                Commercial Enquiry Submitted!
              </h3>
              <p className="text-sm text-[#6B7280] mt-2 max-width-md mx-auto leading-relaxed">
                Thank you, <strong>{contactName}</strong>. Our sales and engineering desk has received your item list and will reach out to <strong>{contactEmail}</strong> within 4 business hours.
              </p>
            </div>

            {enquirySuccessModal.trackingToken && (
              <div className="p-4 bg-[#F7F7F8] border border-[#E2E4E8] rounded-xl text-left space-y-1">
                <div className="text-xs text-[#6B7280] font-semibold uppercase">Enquiry Reference ID</div>
                <div className="text-base font-bold text-[#111315] select-all">
                  {enquirySuccessModal.trackingToken}
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Link
                href="/products"
                onClick={() => setEnquirySuccessModal({ open: false, isEnquiry: true })}
                className="flex-1 h-12 bg-[#111315] text-white rounded-xl font-bold text-sm flex items-center justify-center hover:bg-[#1F2429] transition-colors"
              >
                Continue Browsing Catalog
              </Link>
              <Link
                href="/"
                onClick={() => setEnquirySuccessModal({ open: false, isEnquiry: true })}
                className="flex-1 h-12 bg-[#F7F7F8] border border-[#E2E4E8] text-[#111315] rounded-xl font-bold text-sm flex items-center justify-center hover:bg-[#ECEEF0] transition-colors"
              >
                Go to Home
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Address Selection Modal */}
      {addressModalOpen && (
        <div className="b2b-modal-overlay">
          <div className="b2b-modal-content space-y-5">
            <div className="flex items-center justify-between pb-3.5 border-b border-[#E2E4E8]">
              <h3 className="text-lg font-bold text-[#111315]">
                Select Delivery Address
              </h3>
              <button
                type="button"
                onClick={() => setAddressModalOpen(false)}
                className="p-1 text-[#6B7280] hover:text-[#111315]"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {addresses.length > 0 && (
              <div className="space-y-3">
                {addresses.map((addr) => (
                  <label
                    key={addr.id}
                    className={`block p-4 rounded-xl border cursor-pointer transition-all ${
                      selectedAddressId === addr.id
                        ? "border-[#111315] bg-[#FAFAFA] ring-2 ring-black/5"
                        : "border-[#E2E4E8] hover:bg-[#F7F7F8]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="addrRadio"
                      value={addr.id}
                      checked={selectedAddressId === addr.id}
                      onChange={() => setSelectedAddressId(addr.id)}
                      className="sr-only"
                    />
                    <div className="text-base font-bold text-[#111315]">
                      {addr.address_line_1}
                    </div>
                    <div className="text-sm text-[#6B7280] mt-1">
                      {addr.city}, {addr.state} — {addr.postal_code}
                    </div>
                  </label>
                ))}

                <label
                  className={`block p-4 rounded-xl border cursor-pointer transition-all ${
                    selectedAddressId === "custom"
                      ? "border-[#111315] bg-[#FAFAFA] ring-2 ring-black/5"
                      : "border-[#E2E4E8] hover:bg-[#F7F7F8]"
                  }`}
                >
                  <input
                    type="radio"
                    name="addrRadio"
                    checked={selectedAddressId === "custom"}
                    onChange={() => setSelectedAddressId("custom")}
                    className="sr-only"
                  />
                  <div className="text-base font-semibold text-[#111315]">
                    + Enter New Delivery Address
                  </div>
                </label>
              </div>
            )}

            {(addresses.length === 0 || selectedAddressId === "custom") && (
              <div className="space-y-3.5 pt-2">
                <input
                  className="b2b-input"
                  placeholder="Address Line 1 *"
                  value={customAddress.addressLine1}
                  onChange={(e) =>
                    setCustomAddress({
                      ...customAddress,
                      addressLine1: e.target.value,
                    })
                  }
                />
                <input
                  className="b2b-input"
                  placeholder="Address Line 2 (Optional)"
                  value={customAddress.addressLine2}
                  onChange={(e) =>
                    setCustomAddress({
                      ...customAddress,
                      addressLine2: e.target.value,
                    })
                  }
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    className="b2b-input"
                    placeholder="City *"
                    value={customAddress.city}
                    onChange={(e) =>
                      setCustomAddress({
                        ...customAddress,
                        city: e.target.value,
                      })
                    }
                  />
                  <input
                    className="b2b-input"
                    placeholder="State *"
                    value={customAddress.state}
                    onChange={(e) =>
                      setCustomAddress({
                        ...customAddress,
                        state: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    className="b2b-input"
                    placeholder="PIN Code *"
                    value={customAddress.postalCode}
                    onChange={(e) =>
                      setCustomAddress({
                        ...customAddress,
                        postalCode: e.target.value,
                      })
                    }
                  />
                  <input
                    className="b2b-input"
                    placeholder="Country"
                    value={customAddress.country}
                    onChange={(e) =>
                      setCustomAddress({
                        ...customAddress,
                        country: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setAddressModalOpen(false)}
              className="w-full h-12 bg-[#111315] text-white rounded-xl font-bold text-base hover:bg-[#1F2429] transition-colors"
            >
              Confirm Address
            </button>
          </div>
        </div>
      )}

      {/* Guest / Auth Gate Modal */}
      <AuthOrGuestGate
        open={gateOpen}
        onClose={() => setGateOpen(false)}
        loginRedirect="/cart"
        guestEnquiryHref="/enquiry?type=cart"
      />
    </div>
  );
}

export default function CartRFQPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center text-sm font-medium text-[#6B7280]">
          Loading RFQ cart…
        </div>
      }
    >
      <CartRFQPageInner />
    </Suspense>
  );
}
