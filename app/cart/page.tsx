"use client";

import React, { useState, useEffect, Suspense } from "react";
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
} from "lucide-react";
import { createBrowserClient } from "@/lib/supabase/client";
import { RemoteImage } from "@/components/ui/RemoteImage";
import AuthOrGuestGate from "@/components/commerce/AuthOrGuestGate";

function CartRFQPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [cart, setCart] = useState<any>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>("");
  const [customAddress, setCustomAddress] = useState({
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "India",
  });
  const [customerNotes, setCustomerNotes] = useState("");
  const [minimumRfqValue, setMinimumRfqValue] = useState<number>(500000);
  const [currency, setCurrency] = useState<string>("INR");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [gateOpen, setGateOpen] = useState(false);

  useEffect(() => {
    async function initCart() {
      const supabase = createBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (profile && (profile.role === "customer" || profile.role === "buyer")) {
          setCustomer(profile);
          try {
            await fetch("/api/guest/merge", { method: "POST" });
          } catch {
            /* best-effort */
          }

          try {
            const addrRes = await fetch("/api/customer/addresses");
            const addrJson = await addrRes.json();
            if (addrRes.ok && addrJson.success) {
              setAddresses(addrJson.data?.addresses || []);
              const primary = (addrJson.data?.addresses || [])[0];
              if (primary) setSelectedAddressId(primary.id);
            }
          } catch {
            /* optional */
          }
        }
      }

      const prefillProduct = searchParams.get("product");
      const prefillQty = Number(searchParams.get("qty") || "1");
      if (prefillProduct) {
        await fetch("/api/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId: prefillProduct,
            quantity: Number.isFinite(prefillQty) && prefillQty > 0 ? prefillQty : 1,
          }),
        });
      }

      try {
        const settingsRes = await fetch("/api/settings");
        const settingsJson = await settingsRes.json();
        if (settingsRes.ok && settingsJson.success) {
          if (typeof settingsJson.data?.minimumRfqValue === "number") {
            setMinimumRfqValue(settingsJson.data.minimumRfqValue);
          }
          if (settingsJson.data?.currency) setCurrency(settingsJson.data.currency);
        }
      } catch {
        /* defaults */
      }

      const cartRes = await fetch("/api/cart");
      const cartJson = await cartRes.json();
      if (cartRes.ok && cartJson.success) {
        setCart(cartJson.data);
      } else {
        setErrorMsg(cartJson.error?.message || "Could not load cart");
      }
      setLoading(false);
    }

    initCart();
  }, [router, searchParams]);

  async function handleUpdateQuantity(
    cartItemId: string,
    newQty: number,
    moq?: number,
  ) {
    const minQty = moq && moq > 0 ? moq : 1;
    if (newQty < minQty) {
      setErrorMsg(`Minimum order quantity is ${minQty}.`);
      return;
    }
    try {
      const res = await fetch("/api/cart", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cartItemId, quantity: newQty }),
      });
      const json = await res.json();
      if (json.success) {
        const cartRes = await fetch("/api/cart");
        const cartJson = await cartRes.json();
        if (cartJson.success) setCart(cartJson.data);
      }
    } catch (err) {
      console.error("Update qty error:", err);
    }
  }

  async function handleRemoveItem(cartItemId: string) {
    try {
      const res = await fetch(`/api/cart?cartItemId=${cartItemId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        const cartRes = await fetch("/api/cart");
        const cartJson = await cartRes.json();
        if (cartJson.success) setCart(cartJson.data);
      }
    } catch (err) {
      console.error("Remove item error:", err);
    }
  }

  async function handleSubmitRfq(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");

    if (!cart || !cart.items || cart.items.length === 0) {
      setErrorMsg("Your cart is empty.");
      return;
    }

    if (!customer?.id) {
      setGateOpen(true);
      return;
    }

    const cartTotal = cart.subtotal ?? cart.cart_total ?? 0;
    if (cartTotal < minimumRfqValue) {
      setErrorMsg(
        `RFQ subtotal is ₹${cartTotal.toLocaleString("en-IN")}. Minimum RFQ value is ₹${minimumRfqValue.toLocaleString("en-IN")}.`,
      );
      return;
    }

    setSubmitting(true);

    try {
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
      } else {
        if (
          !customAddress.addressLine1 ||
          !customAddress.city ||
          !customAddress.state ||
          !customAddress.postalCode
        ) {
          setErrorMsg("Please complete all required delivery address fields.");
          setSubmitting(false);
          return;
        }
        deliveryAddress = {
          address_line_1: customAddress.addressLine1,
          address_line_2: customAddress.addressLine2,
          city: customAddress.city,
          state: customAddress.state,
          postal_code: customAddress.postalCode,
          country: customAddress.country,
        };
      }

      const res = await fetch("/api/rfqs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customer.id,
          deliveryAddress,
          customerMessage: customerNotes.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMsg(json.error?.message || "Failed to submit RFQ");
        setSubmitting(false);
      } else {
        router.push("/customer/rfqs");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Server error while submitting RFQ");
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="container-custom py-12 space-y-4">
        <div className="h-6 w-48 bg-[#ECEEF0] rounded" />
        <div className="h-64 bg-[#ECEEF0] rounded-xl border border-[#E2E4E8] animate-pulse" />
      </div>
    );
  }

  const items = cart?.items || [];
  const cartTotal = cart?.subtotal ?? cart?.cart_total ?? 0;
  const meetsMinimum = cartTotal >= minimumRfqValue;

  return (
    <div className="container-custom py-10 space-y-8">
      {/* Title */}
      <div className="space-y-1 border-b border-[#E2E4E8] pb-4">
        <div className="flex items-center gap-2 text-xs font-mono text-[#6B7280]">
          <Link href="/" className="hover:text-[#111315]">
            Home
          </Link>
          <span>/</span>
          <span className="text-[#111315] font-semibold">RFQ Workspace</span>
        </div>
        <h1 className="type-page">
          Request for Quote (RFQ) Workspace
        </h1>
        <p className="type-subtitle">
          Consolidate component line items, review volume pricing thresholds,
          and submit for factory pricing.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="saas-panel p-12 text-center space-y-3">
          <ShoppingCart className="w-10 h-10 text-[#6B7280] mx-auto stroke-1" />
          <h3 className="text-base font-semibold text-[#111315]">
            Your RFQ workspace is empty
          </h3>
          <p className="text-xs text-[#6B7280] max-w-sm mx-auto">
            Browse our catalog to add precision components or submit a custom
            drawing enquiry.
          </p>
          <Link
            href="/products"
            className="saas-btn-primary text-xs mt-2 inline-block"
          >
            Browse Components Catalog
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Items List (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            <div className="saas-panel overflow-hidden">
              <div className="p-3.5 border-b border-[#E2E4E8] bg-[#D7D9DC]/35 flex items-center justify-between text-xs font-mono font-semibold text-[#6B7280]">
                <span>COMPONENT SPECIFICATION</span>
                <span>LINE TOTAL</span>
              </div>

              <div className="divide-y divide-[#E2E4E8]">
                {items.map((item: any) => {
                  const p = item.product;
                  const unitPrice =
                    p?.actualUnitPrice ??
                    p?.sellingPrice ??
                    p?.selling_price ??
                    0;
                  const listPrice =
                    p?.sellingPrice ?? p?.selling_price ?? unitPrice;
                  const lineTotal = item.itemTotal ?? unitPrice * item.quantity;
                  const minQty = p?.moq || 1;

                  return (
                    <div
                      key={item.id}
                      className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="relative h-14 w-14 rounded-lg bg-[#ECEEF0] border border-[#E2E4E8] overflow-hidden shrink-0 flex items-center justify-center">
                          {p?.primaryImage || p?.images?.[0]?.image_url ? (
                            <RemoteImage
                              src={p.primaryImage || p.images[0].image_url}
                              alt={p?.name || ""}
                              sizes="56px"
                            />
                          ) : (
                            <Package className="w-6 h-6 text-[#6B7280] stroke-1" />
                          )}
                        </div>
                        <div className="space-y-0.5">
                          <div className="text-[10px] font-mono text-[#6B7280] uppercase">
                            {p?.categoryName || p?.category?.name || "Fastener"}
                          </div>
                          <Link
                            href={`/products/${p?.id}`}
                            className="font-semibold text-xs sm:text-sm text-[#111315] hover:underline block"
                          >
                            {p?.name}
                          </Link>
                          <div className="text-xs font-mono text-[#6B7280]">
                            ₹{unitPrice.toLocaleString("en-IN")} / unit (MOQ:{" "}
                            {p?.moq})
                            {p?.discount > 0
                              ? ` · list ₹${Number(listPrice).toLocaleString("en-IN")}`
                              : ""}
                          </div>
                        </div>
                      </div>

                      {/* Quantity & Actions */}
                      <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                        <div className="flex items-center gap-1.5 font-mono">
                          <label className="text-xs text-[#6B7280]">Qty:</label>
                          <input
                            type="number"
                            min={p?.moq || 1}
                            value={item.quantity}
                            onChange={(e) =>
                              handleUpdateQuantity(
                                item.id,
                                parseInt(e.target.value) || minQty,
                                p?.moq,
                              )
                            }
                            className="saas-input w-20 py-1 px-2 text-xs font-mono font-bold"
                          />
                        </div>

                        <div className="text-right min-w-[90px]">
                          <div className="text-sm font-bold font-mono text-[#111315]">
                            ₹{lineTotal.toLocaleString("en-IN")}
                          </div>
                        </div>

                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#B91C1C] hover:bg-[#FEF2F2] transition-colors"
                          title="Remove line item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Threshold Banner */}
            <div
              className={`p-3.5 rounded-xl border flex items-start gap-2.5 text-xs font-mono ${meetsMinimum
                ? "bg-[#F0FDF4] border-[#BBF7D0] text-[#15803D]"
                : "bg-[#FEF3C7] border-[#FDE68A] text-[#B45309]"
                }`}
            >
              {meetsMinimum ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <div>
                <div className="font-semibold">
                  {meetsMinimum
                    ? "Minimum Order Threshold Met"
                    : `Minimum RFQ Value: ₹${minimumRfqValue.toLocaleString("en-IN")}`}
                </div>
                <div className="text-[11px] opacity-90 mt-0.5 font-sans">
                  {meetsMinimum
                    ? "Your RFQ subtotal meets the minimum volume requirement and is ready for submission."
                    : `Current subtotal is ₹${cartTotal.toLocaleString("en-IN")}. Please adjust quantities to reach the ₹${minimumRfqValue.toLocaleString("en-IN")} minimum.`}
                </div>
              </div>
            </div>
          </div>

          {/* Delivery & Summary (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <form
              onSubmit={handleSubmitRfq}
              className="saas-panel p-5 space-y-4"
            >
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#111315] border-b border-[#E2E4E8] pb-2">
                {customer?.id ? "Delivery & Submission" : "Request a quote"}
              </h3>

              {!customer?.id && (
                <p className="text-xs text-[#6B7280] leading-relaxed">
                  Browse and edit your cart without signing in. To submit an official RFQ, log in — or
                  continue as guest to send a cart enquiry with your contact details.
                </p>
              )}

              {customer?.id && (
              <>
              {/* Delivery Address */}
              <div className="space-y-2">
                <label className="saas-label flex items-center gap-1 font-mono">
                  <MapPin className="w-3.5 h-3.5 text-[#111315]" />
                  <span>Delivery Address</span>
                </label>

                {addresses.length > 0 && (
                  <div className="space-y-1.5">
                    {addresses.map((addr) => (
                      <label
                        key={addr.id}
                        className={`block p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${selectedAddressId === addr.id
                          ? "border-[#111315] ring-2 ring-[#111315]/10 font-medium"
                          : "border-[#E2E4E8] /60 text-[#6B7280] hover:"
                          }`}
                      >
                        <input
                          type="radio"
                          name="addressOption"
                          value={addr.id}
                          checked={selectedAddressId === addr.id}
                          onChange={() => setSelectedAddressId(addr.id)}
                          className="sr-only"
                        />
                        <div className="text-[#111315]">
                          {addr.address_line_1}
                        </div>
                        <div className="text-[11px] text-[#6B7280] font-mono">
                          {addr.city}, {addr.state} - {addr.postal_code}
                        </div>
                      </label>
                    ))}
                    <label
                      className={`block p-2.5 rounded-lg border text-xs cursor-pointer ${selectedAddressId === "custom"
                        ? "border-[#111315] "
                        : "border-[#E2E4E8] /60"
                        }`}
                    >
                      <input
                        type="radio"
                        name="addressOption"
                        checked={selectedAddressId === "custom"}
                        onChange={() => setSelectedAddressId("custom")}
                        className="sr-only"
                      />
                      Use another address
                    </label>
                  </div>
                )}

                {(addresses.length === 0 || selectedAddressId === "custom") && (
                  <div className="space-y-2 pt-1">
                    <input
                      className="saas-input"
                      placeholder="Address line 1"
                      value={customAddress.addressLine1}
                      onChange={(e) =>
                        setCustomAddress({
                          ...customAddress,
                          addressLine1: e.target.value,
                        })
                      }
                    />
                    <input
                      className="saas-input"
                      placeholder="Address line 2 (optional)"
                      value={customAddress.addressLine2}
                      onChange={(e) =>
                        setCustomAddress({
                          ...customAddress,
                          addressLine2: e.target.value,
                        })
                      }
                    />
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <input
                        className="saas-input"
                        placeholder="City"
                        value={customAddress.city}
                        onChange={(e) =>
                          setCustomAddress({
                            ...customAddress,
                            city: e.target.value,
                          })
                        }
                      />
                      <input
                        className="saas-input"
                        placeholder="State"
                        value={customAddress.state}
                        onChange={(e) =>
                          setCustomAddress({
                            ...customAddress,
                            state: e.target.value,
                          })
                        }
                      />
                      <input
                        className="saas-input"
                        placeholder="PIN"
                        value={customAddress.postalCode}
                        onChange={(e) =>
                          setCustomAddress({
                            ...customAddress,
                            postalCode: e.target.value,
                          })
                        }
                      />
                      <input
                        className="saas-input"
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
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="saas-label font-mono">
                  Delivery Instructions (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Special packaging, delivery timeline, or inspection notes..."
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  className="saas-input resize-none"
                />
              </div>
              </>
              )}

              {/* Summary calculation */}
              <div className="space-y-1.5 pt-3 border-t border-[#E2E4E8] text-xs font-mono">
                <div className="flex justify-between text-[#6B7280]">
                  <span>Subtotal</span>
                  <span className="text-[#111315]">
                    ₹{cartTotal.toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="flex justify-between text-[#6B7280]">
                  <span>Minimum Threshold</span>
                  <span>₹{minimumRfqValue.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between text-sm font-bold pt-2 border-t border-[#E2E4E8] text-[#111315]">
                  <span>Estimated Total</span>
                  <span>₹{cartTotal.toLocaleString("en-IN")}</span>
                </div>
              </div>

              {errorMsg && (
                <div className="p-2.5 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#B91C1C] font-mono">
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || (customer?.id ? !meetsMinimum : false)}
                className="saas-btn-primary w-full py-2.5 text-xs flex items-center justify-center gap-1.5 font-mono shadow-xs disabled:opacity-50"
              >
                <span>
                  {submitting
                    ? "Submitting…"
                    : customer?.id
                      ? "Submit Official RFQ"
                      : "Request quote"}
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      )}

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
        <div className="min-h-[60vh] flex items-center justify-center text-xs font-mono text-[#6B7280]">
          Loading RFQ workspace…
        </div>
      }
    >
      <CartRFQPageInner />
    </Suspense>
  );
}

