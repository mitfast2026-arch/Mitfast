"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ShoppingCart,
  ArrowLeft,
  RefreshCw,
  ShieldCheck,
  Package,
  Truck,
  CheckCircle2,
  Clock,
  FileCheck,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  MapPin,
  FileText,
} from "lucide-react";
import { createBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface OrderItem {
  id: string;
  product_name_snapshot: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface Order {
  id: string;
  order_number: string;
  status:
    | "pending_payment"
    | "accepted"
    | "packing"
    | "dispatched"
    | "completed"
    | "cancelled";
  payment_status: "pending" | "payment_done" | "refunded";
  total: number;
  created_at: string;
  delivery_address_snapshot: any;
  items: OrderItem[];
}

export default function CustomerOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>(
    {},
  );

  async function loadOrders() {
    setLoading(true);
    try {
      const supabase = createBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth?role=buyer&mode=signin");
        return;
      }

      const { data: prof } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (prof) {
        const res = await fetch(`/api/orders?customerId=${prof.id}`);
        const json = await res.json();
        if (json.success) setOrders(json.data.orders || []);
      }
    } catch (err) {
      console.error("Failed to load customer orders:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrders();
  }, [router]);

  function toggleExpand(id: string) {
    setExpandedOrders((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function getStepIndex(status: string, paymentStatus: string) {
    if (status === "completed") return 5;
    if (status === "dispatched") return 4;
    if (status === "packing") return 3;
    if (status === "accepted" || paymentStatus === "payment_done") return 2;
    return 1; // pending_payment
  }

  const stages = [
    { label: "1. Commercial Agreement", desc: "Order Snapshot Finalized" },
    { label: "2. Payment Confirmed", desc: "Material Production Active" },
    { label: "3. QA & Crating", desc: "CMM Inspection & Packaging" },
    { label: "4. In Transit", desc: "Dispatched via Freight" },
    { label: "5. Delivered", desc: "Consignment Received" },
  ];

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 ">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-[#6B7280] mb-1">
            <Link
              href="/customer/dashboard"
              className="hover:text-[#111315] flex items-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Dashboard</span>
            </Link>
            <span>/</span>
            <span className="text-[#111315] font-semibold">
              Orders & Tracking
            </span>
          </div>
          <h1 className="type-page">Production Orders & Batch Tracking</h1>
          <p className="type-subtitle">
            Real-time milestone visibility for aerospace and precision
            components from contract to inward delivery.
          </p>
        </div>

        <button
          onClick={loadOrders}
          className="saas-btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 self-start sm:self-auto"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
          />
          <span>Refresh Tracking</span>
        </button>
      </div>

      <div className="space-y-6">
        {orders.length === 0 ? (
          <div className="saas-panel p-12 text-center border-[#E2E4E8] space-y-3">
            <ShoppingCart className="w-10 h-10 text-[#6B7280] mx-auto stroke-1" />
            <h3 className="text-base font-semibold text-[#111315]">
              No Active Production Orders
            </h3>
            <p className="text-xs text-[#6B7280]">
              Your negotiated RFQ quotations can be approved and converted into
              active production batches.
            </p>
            <Link
              href="/customer/rfqs"
              className="saas-btn-primary text-xs mt-2 inline-block"
            >
              Review RFQ Quotations
            </Link>
          </div>
        ) : (
          orders.map((o) => {
            const currentStep = getStepIndex(o.status, o.payment_status);
            const isCancelled = o.status === "cancelled";
            const isExpanded = !!expandedOrders[o.id];

            return (
              <div
                key={o.id}
                className="rounded-3xl border border-[#E2E4E8] shadow-xs overflow-hidden"
              >
                {/* Header Card Bar */}
                <div className="p-5 border-b border-[#E2E4E8] flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#FAFAFA]">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-bold text-base text-[#111315]">
                        {o.order_number}
                      </span>
                      <span
                        className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-semibold ${
                          o.status === "completed"
                            ? "bg-[#DCFCE7] text-[#15803D]"
                            : o.status === "dispatched"
                              ? "bg-[#E0E7FF] text-[#4338CA]"
                              : isCancelled
                                ? "bg-[#FEF2F2] text-[#B91C1C]"
                                : "bg-[#FEF3C7] text-[#B45309]"
                        }`}
                      >
                        {o.status.replace("_", " ")}
                      </span>

                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                          o.payment_status === "payment_done"
                            ? "bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0]"
                            : "bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A]"
                        }`}
                      >
                        {o.payment_status === "payment_done"
                          ? "✓ Commercial Payment Confirmed"
                          : "⏱ Payment Pending Invoice"}
                      </span>
                    </div>

                    <div className="text-xs font-mono text-[#6B7280] flex flex-wrap gap-4">
                      <span>
                        PO / order date:{" "}
                        {new Date(o.created_at).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                      <span>•</span>
                      <span>
                        Destination:{" "}
                        {o.delivery_address_snapshot?.city || "India"},{" "}
                        {o.delivery_address_snapshot?.state || ""}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between lg:justify-end gap-6">
                    <div className="text-right">
                      <div className="text-[10px] font-mono uppercase text-[#6B7280]">
                        Contract Value
                      </div>
                      <div className="text-xl font-bold font-mono text-[#111315]">
                        ₹{o.total?.toLocaleString("en-IN")}
                      </div>
                    </div>

                    <button
                      onClick={() => toggleExpand(o.id)}
                      className="saas-btn-ghost text-xs font-mono flex items-center gap-1"
                    >
                      <span>
                        {isExpanded ? "Hide Details" : "View Details"}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Stepper Progress Bar */}
                {!isCancelled ? (
                  <div className="p-6 border-b border-[#E2E4E8] ">
                    <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                      {stages.map((st, idx) => {
                        const stepNum = idx + 1;
                        const isDone = stepNum < currentStep;
                        const isCurrent = stepNum === currentStep;

                        return (
                          <div
                            key={idx}
                            className={`p-3 rounded-3xl border transition-all ${
                              isDone
                                ? "bg-[#F0FDF4] border-[#BBF7D0] text-[#15803D]"
                                : isCurrent
                                  ? "bg-[#111315] border-[#111315] text-white shadow-xs"
                                  : "bg-white/40 border-[#E2E4E8] text-[#6B7280]"
                            }`}
                          >
                            <div className="flex items-center justify-between text-xs font-mono mb-1">
                              <span className="font-bold">{st.label}</span>
                              {isDone ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-[#15803D]" />
                              ) : isCurrent ? (
                                <Clock className="w-3.5 h-3.5 text-white animate-pulse" />
                              ) : null}
                            </div>
                            <div
                              className={`text-[10px] font-sans ${isCurrent ? "text-[#ECEEF0]" : "text-[#6B7280]"}`}
                            >
                              {st.desc}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-[#FEF2F2] border-b border-[#FECACA] text-xs text-[#B91C1C] flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>
                      This production order was cancelled. Please contact your
                      procurement manager for details.
                    </span>
                  </div>
                )}

                {/* Line items & dispatch details expandable area */}
                {isExpanded && (
                  <div className="p-6 space-y-6 bg-[#FAFAFA]">
                    {/* Line Items Table */}
                    <div className="space-y-2">
                      <div className="text-xs font-mono font-bold text-[#111315] uppercase tracking-wider">
                        Manufactured Components & Batch Breakdown
                      </div>
                      <div className="saas-panel overflow-hidden">
                        <table className="saas-table">
                          <thead className="font-mono text-[#6B7280] border-b border-[#E2E4E8]">
                            <tr>
                              <th className="py-2.5 px-4">
                                COMPONENT SPECIFICATION
                              </th>
                              <th className="py-2.5 px-4 text-center">
                                ORDERED LOT
                              </th>
                              <th className="py-2.5 px-4 text-right">
                                UNIT CONTRACT PRICE
                              </th>
                              <th className="py-2.5 px-4 text-right">
                                LINE TOTAL
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#EEEEEE] font-mono">
                            {o.items?.map((itm) => (
                              <tr key={itm.id} className="hover:bg-[#FAFAFA]">
                                <td className="py-3 px-4 font-semibold text-[#111315]">
                                  {itm.product_name_snapshot}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  {itm.quantity} Units
                                </td>
                                <td className="py-3 px-4 text-right">
                                  ₹{itm.unit_price?.toLocaleString("en-IN")}
                                </td>
                                <td className="py-3 px-4 text-right font-bold text-[#111315]">
                                  ₹{itm.total?.toLocaleString("en-IN")}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Delivery & QA Info Bar */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                      <div className="p-4 rounded-3xl border border-[#E2E4E8] space-y-1.5">
                        <div className="flex items-center gap-1.5 font-bold text-[#111315]">
                          <MapPin className="w-3.5 h-3.5 text-[#111315]" />
                          <span>Delivery Consignment Snapshot</span>
                        </div>
                        <div className="text-[#555555] leading-relaxed text-[11px]">
                          {o.delivery_address_snapshot?.address_line_1 ||
                            "Registered Destination"}
                          <br />
                          {o.delivery_address_snapshot?.address_line_2 && (
                            <>
                              {o.delivery_address_snapshot.address_line_2}
                              <br />
                            </>
                          )}
                          {o.delivery_address_snapshot?.city},{" "}
                          {o.delivery_address_snapshot?.state} -{" "}
                          {o.delivery_address_snapshot?.postal_code}
                          <br />
                          {o.delivery_address_snapshot?.country || "India"}
                        </div>
                      </div>

                      <div className="p-4 rounded-3xl border border-[#E2E4E8] space-y-1.5">
                        <div className="flex items-center gap-1.5 font-bold text-[#15803D]">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Quality & Compliance Credentials</span>
                        </div>
                        <p className="text-[#555555] text-[11px] leading-relaxed">
                          All lots include ISO/IEC 17025 accredited material
                          test certificates (MTC), raw alloy spectroscopic
                          reports, and dimensional coordinate measuring machine
                          (CMM) inspection data.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
