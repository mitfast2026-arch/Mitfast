"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createBrowserClient } from "@/lib/supabase/client";
import { getCountryOptions, matchCountryLabel } from "@/lib/country-origin";
import "./enquiry.css";

const COUNTRY_OPTIONS = getCountryOptions();
const OTHER_COUNTRY_VALUE = "__other__";

const ENQUIRY_TYPE_COPY: Record<
  string,
  { heading: string; metaLabel: string; metaValue: string; message: string }
> = {
  sourcing: {
    heading: "Sourcing development enquiry",
    metaLabel: "Sourcing Development",
    metaValue: "Bespoke CNC & precision tooling, parts development, alloys, and certified mills.",
    message:
      "Sourcing request: describe the parts, materials, target volumes, and any preferred origin or certification requirements.",
  },
  procurement: {
    heading: "Off-catalog procurement enquiry",
    metaLabel: "Off-Catalog Procurement",
    metaValue: "Off-catalog procurement requests, specialized materials, and factory-direct terms.",
    message:
      "Procurement request: describe required SKUs, quantity, and any quality or packing requirements.",
  },
  product: {
    heading: "Quote for product enquiry",
    metaLabel: "Catalog Pricing",
    metaValue: "High-volume competitive pricing, locked production batches, and catalog RFQs.",
    message:
      "Product quote request: specify target part numbers/SKUs, required quantity/batches, and delivery timeline.",
  },
  dispatch: {
    heading: "Delivery & shipping quote",
    metaLabel: "Delivery & Shipping",
    metaValue: "Bulk orders, export deliveries, freight schedules, and shipping quotes.",
    message:
      "Shipping/delivery quote request: describe shipment destination, target volume/weight, delivery timeline, and incoterms.",
  },
  low_moq: {
    heading: "Low MOQ & small batch enquiry",
    metaLabel: "Low MOQ / Lower Value",
    metaValue: "Small batch runs, prototype quantities, lower order values, and trial orders.",
    message:
      "Low MOQ enquiry: describe the required quantity, budget/value target, and whether this is a sample/prototype or recurring small batch.",
  },
  custom: {
    heading: "Custom specification enquiry",
    metaLabel: "Custom Specification",
    metaValue: "Custom specification, CNC machining, drawings, and bespoke manufacturing quotes.",
    message: "",
  },
  cart: {
    heading: "Cart quote enquiry",
    metaLabel: "Cart RFQ",
    metaValue: "Guest quote request from your RFQ cart — our team will follow up with pricing.",
    message:
      "Cart quote request: please confirm quantities and any packaging or inspection requirements.",
  },
};

const SERVICE_OPTIONS = [
  { value: "sourcing", label: "01. Sourcing Development (CNC & Tooling)" },
  { value: "procurement", label: "02. Off-Catalog Procurement" },
  { value: "product", label: "03. Quote for Product (Catalog Pricing)" },
  { value: "dispatch", label: "04. Delivery & Shipping Quote" },
  { value: "low_moq", label: "Low MOQ / Lower Order Value Inquiry" },
  { value: "custom", label: "Custom Specification & Engineering Drawing" },
] as const;

type ServiceValue = (typeof SERVICE_OPTIONS)[number]["value"];

type CartLinePreview = {
  productId: string;
  name: string;
  quantity: number;
};

function formatCartMessage(lines: CartLinePreview[]): string {
  const header =
    "Cart quote request: please confirm quantities and any packaging or inspection requirements.";
  if (!lines.length) return header;
  const list = lines
    .map((line, idx) => `${idx + 1}. ${line.name} — qty ${line.quantity}`)
    .join("\n");
  return `${header}\n\nSelected products:\n${list}`;
}

function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" "),
  };
}

function EnquiryContent() {
  const searchParams = useSearchParams();
  const preselectedProductId = searchParams.get("product");
  const initialType = (searchParams.get("type") || "").toLowerCase();
  const isCartEnquiry = initialType === "cart";
  const initialService: ServiceValue =
    initialType === "cart"
      ? "custom"
      : ENQUIRY_TYPE_COPY[initialType]
        ? (initialType as ServiceValue)
        : preselectedProductId
          ? "product"
          : "custom";

  const [product, setProduct] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [cartLines, setCartLines] = useState<CartLinePreview[]>([]);
  const [cartLoading, setCartLoading] = useState(isCartEnquiry);
  const [profile, setProfile] = useState<{ id: string; full_name?: string; country?: string } | null>(
    null,
  );

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [serviceType, setServiceType] = useState<ServiceValue>(initialService);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("India");
  const [countryMode, setCountryMode] = useState("India");
  const [customCountry, setCustomCountry] = useState("");
  const [message, setMessage] = useState(
    isCartEnquiry
      ? formatCartMessage([])
      : ENQUIRY_TYPE_COPY[initialService]?.message || "",
  );
  const [messageDirty, setMessageDirty] = useState(false);

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [trackingToken, setTrackingToken] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const typeCopy = isCartEnquiry
    ? ENQUIRY_TYPE_COPY.cart
    : ENQUIRY_TYPE_COPY[serviceType] || ENQUIRY_TYPE_COPY.custom;

  function handleCountrySelect(val: string) {
    setCountryMode(val);
    if (val === OTHER_COUNTRY_VALUE) {
      setCountry(customCountry.trim());
    } else {
      setCountry(val);
      setCustomCountry("");
    }
  }

  function handleCustomCountryChange(val: string) {
    setCustomCountry(val);
    setCountry(val.trim());
  }

  useEffect(() => {
    async function init() {
      const supabase = createBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", user.id)
          .single();
        if (prof) {
          setProfile(prof);
          const names = splitFullName(prof.full_name || "");
          setFirstName(names.firstName);
          setLastName(names.lastName);
          setEmail(prof.email || "");
          setPhone(prof.phone || "");
          if (prof.country) {
            const matched = matchCountryLabel(prof.country);
            if (matched) {
              setCountryMode(matched);
              setCountry(matched);
            } else {
              setCountryMode(OTHER_COUNTRY_VALUE);
              setCustomCountry(prof.country);
              setCountry(prof.country);
            }
          }
        }
      }

      if (isCartEnquiry) {
        setCartLoading(true);
        try {
          const cartRes = await fetch("/api/cart");
          const cartJson = await cartRes.json();
          if (cartJson.success && cartJson.data?.items?.length) {
            const lines: CartLinePreview[] = cartJson.data.items.map(
              (item: { productId: string; quantity: number; product?: { name?: string } }) => ({
                productId: item.productId,
                name: item.product?.name || "Product",
                quantity: item.quantity,
              }),
            );
            setCartLines(lines);
            if (!messageDirty) {
              setMessage(formatCartMessage(lines));
            }
            if (lines[0]) {
              setProduct({ id: lines[0].productId, name: lines[0].name });
            }
          }
        } catch {
          /* cart optional for enquiry */
        } finally {
          setCartLoading(false);
        }
      } else if (preselectedProductId) {
        const res = await fetch(`/api/products/${preselectedProductId}`);
        const json = await res.json();
        if (json.success && json.data.product) {
          setProduct(json.data.product);
        }
      }
    }

    init();
  }, [preselectedProductId, isCartEnquiry]);

  function handleServiceChange(next: ServiceValue) {
    setServiceType(next);
    if (!messageDirty) {
      setMessage(ENQUIRY_TYPE_COPY[next]?.message || "");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");

    const fullName = `${firstName} ${lastName}`.trim();

    if (!firstName.trim() || !email.trim() || !phone.trim()) {
      setErrorMsg("Name, email, and phone are required so we can follow up on your enquiry.");
      return;
    }

    if (!country.trim()) {
      setErrorMsg("Country is required so we can route your enquiry.");
      return;
    }

    if (!message.trim()) {
      setErrorMsg("Please enter your inquiry specifications.");
      return;
    }

    if (isCartEnquiry && cartLines.length === 0) {
      setErrorMsg(
        "Your cart is empty. Add products from the catalog or send a general enquiry.",
      );
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      const primaryProductId = isCartEnquiry
        ? cartLines[0]?.productId
        : product?.id;
      if (primaryProductId) formData.set("productId", primaryProductId);
      formData.set("message", message.trim());
      if (profile?.id) formData.set("customerId", profile.id);
      formData.set("name", fullName || profile?.full_name || "");
      formData.set("email", email.trim());
      formData.set("phone", phone.trim());
      formData.set("guestName", fullName);
      formData.set("guestEmail", email.trim());
      formData.set("guestPhone", phone.trim());
      formData.set("country", country.trim());
      formData.set("enquiryType", isCartEnquiry ? "cart" : serviceType);
      if (isCartEnquiry && cartLines.length) {
        formData.set(
          "lineItems",
          JSON.stringify(
            cartLines.map((line) => ({
              productId: line.productId,
              name: line.name,
              quantity: line.quantity,
            })),
          ),
        );
      }

      toast.loading("Sending enquiry...", { id: "enquiry-submit" });
      const res = await fetch("/api/enquiries", {
        method: "POST",
        headers: {
          "Idempotency-Key":
            typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
              ? crypto.randomUUID()
              : `enq-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        },
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        const msg = json.error?.message || "Failed to submit enquiry";
        setErrorMsg(msg);
        toast.error(msg, { id: "enquiry-submit" });
      } else {
        toast.success("Enquiry sent successfully!", { id: "enquiry-submit" });
        setSubmitted(true);
        setTrackingToken(json.data?.trackingToken || "");
      }
    } catch (err: unknown) {
      const fallback = "Server error";
      const msg = err instanceof Error ? err.message : fallback;
      setErrorMsg(msg);
      toast.error(msg, { id: "enquiry-submit" });
    } finally {
      setLoading(false);
    }
  }

  const trackingHref = trackingToken ? `/track/enquiry/${trackingToken}` : "";

  return (
    <section className="enquiry-page">
      <div className="contact-layout">
        <div className="contact-intro">
          <h1>{typeCopy.heading}</h1>
          <div className="contact-intro__meta">
            <div className="contact-meta">
              <p className="contact-meta__label">{typeCopy.metaLabel}</p>
              <p className="contact-meta__value">{typeCopy.metaValue}</p>
            </div>
            {product && (
              <div className="contact-meta">
                <p className="contact-meta__label">
                  {isCartEnquiry ? "Primary product" : "Referenced part"}
                </p>
                <p className="contact-meta__value">{product.name}</p>
              </div>
            )}
            {isCartEnquiry && cartLines.length > 0 && (
              <div className="contact-meta">
                <p className="contact-meta__label">Cart lines</p>
                <ul className="contact-meta__value" style={{ margin: 0, paddingLeft: "1.1rem" }}>
                  {cartLines.map((line) => (
                    <li key={line.productId}>
                      {line.name} × {line.quantity}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="contact-meta">
              <p className="contact-meta__label">Operations</p>
              <p className="contact-meta__value">
                <a href="mailto:support@mitfast.com">support@mitfast.com</a>
              </p>
            </div>
          </div>
        </div>

        {submitted ? (
          <div className="enquiry-success" role="status">
            <h2 className="enquiry-success__title">Enquiry received</h2>
            <p className="enquiry-success__body">
              Procurement will review the specifications and follow up at {email}.
            </p>
            {trackingToken && (
              <p className="enquiry-success__track">
                Track this enquiry without signing in:{" "}
                <Link href={trackingHref}>{trackingHref}</Link>
              </p>
            )}
            <div className="enquiry-success__actions">
              <Link href="/products" className="enquiry-success__action">
                Return to catalog
              </Link>
              <Link
                href="/auth?role=buyer&mode=register"
                className="enquiry-success__link"
              >
                Create procurement account
              </Link>
              <button
                type="button"
                className="enquiry-success__reset"
                onClick={() => {
                  setSubmitted(false);
                  setMessage(typeCopy.message || "");
                  setMessageDirty(false);
                }}
              >
                Submit another
              </button>
            </div>
          </div>
        ) : (
          <form className="contact-form" onSubmit={handleSubmit} noValidate>
            {isCartEnquiry && cartLoading && (
              <p className="contact-form__hint">Loading your cart…</p>
            )}
            {isCartEnquiry && !cartLoading && cartLines.length === 0 && (
              <p className="contact-form__hint">
                Your cart is empty.{" "}
                <Link href="/products">Browse products</Link> or continue with a general message.
              </p>
            )}

            <div className="contact-form__row contact-form__row--2">
              <div className="field">
                <label className="field__label" htmlFor="enquiry-first-name">
                  First name *
                </label>
                <input
                  id="enquiry-first-name"
                  className="field__input"
                  type="text"
                  name="firstName"
                  autoComplete="given-name"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="enquiry-last-name">
                  Last name
                </label>
                <input
                  id="enquiry-last-name"
                  className="field__input"
                  type="text"
                  name="lastName"
                  autoComplete="family-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>

            <div className="contact-form__row contact-form__row--2">
              <div className="field">
                <label className="field__label" htmlFor="enquiry-email">
                  Work email *
                </label>
                <input
                  id="enquiry-email"
                  className="field__input"
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="field">
                <label className="field__label" htmlFor="enquiry-phone">
                  Phone *
                </label>
                <input
                  id="enquiry-phone"
                  className="field__input"
                  type="tel"
                  name="phone"
                  autoComplete="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>

            <div className={`contact-form__row ${!isCartEnquiry ? "contact-form__row--2" : ""}`}>
              {!isCartEnquiry && (
                <div className="field">
                  <label className="field__label" htmlFor="enquiry-service">
                    Enquiry type
                  </label>
                  <div className="field__control">
                    <select
                      id="enquiry-service"
                      className="field__select"
                      name="service"
                      value={serviceType}
                      onChange={(e) =>
                        handleServiceChange(e.target.value as ServiceValue)
                      }
                    >
                      {SERVICE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="field__chevron" aria-hidden="true" />
                  </div>
                </div>
              )}

              <div className="field">
                <label className="field__label" htmlFor="enquiry-country">
                  Country *
                </label>
                <div className="field__control">
                  <select
                    id="enquiry-country"
                    className="field__select"
                    name="country"
                    autoComplete="country-name"
                    required={countryMode !== OTHER_COUNTRY_VALUE}
                    value={countryMode}
                    onChange={(e) => handleCountrySelect(e.target.value)}
                  >
                    <option value="">Select country…</option>
                    {COUNTRY_OPTIONS.map((option) => (
                      <option key={option.code} value={option.label}>
                        {option.label}
                      </option>
                    ))}
                    <option value={OTHER_COUNTRY_VALUE}>Other (custom region)</option>
                  </select>
                  <ChevronDown className="field__chevron" aria-hidden="true" />
                </div>
                {countryMode === OTHER_COUNTRY_VALUE && (
                  <input
                    type="text"
                    required
                    className="field__input"
                    style={{ marginTop: "8px" }}
                    placeholder="Enter country or region"
                    value={customCountry}
                    onChange={(e) => handleCustomCountryChange(e.target.value)}
                  />
                )}
              </div>
            </div>

            <div className="textarea-field">
              <label className="field__label" htmlFor="enquiry-message">
                Specifications *
              </label>
              <textarea
                id="enquiry-message"
                className="field__textarea"
                name="message"
                rows={3}
                required
                placeholder="Describe parts, specs, materials, quantities..."
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  setMessageDirty(true);
                }}
              />
            </div>

            {errorMsg && (
              <p className="contact-form__error" role="alert">
                {errorMsg}
              </p>
            )}

            <button
              type="submit"
              className="contact-form__submit flex items-center justify-center gap-2"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sending enquiry...</span>
                </>
              ) : (
                "Send enquiry"
              )}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

export default function EnquiryPage() {
  return (
    <Suspense
      fallback={
        <section className="enquiry-page">
          <div className="enquiry-fallback">Loading enquiry form</div>
        </section>
      }
    >
      <EnquiryContent />
    </Suspense>
  );
}
