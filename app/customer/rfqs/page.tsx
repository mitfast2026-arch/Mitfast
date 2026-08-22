"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  FileText,
  ArrowLeft,
  RefreshCw,
  ShoppingCart,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { createBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function CustomerRfqsPage() {
  const router = useRouter();
  const [rfqs, setRfqs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  async function loadRfqs() {
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
        const res = await fetch(`/api/rfqs?customerId=${prof.id}`);
        const json = await res.json();
        if (json.success) setRfqs(json.data.rfqs || []);
      }
    } catch (err) {
      console.error("Failed to load RFQs:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRfqs();
  }, [router]);

  async function handleConvertToOrder(rfqId: string) {
    setConvertingId(rfqId);
    try {
      const res = await fetch(`/api/rfqs/${rfqId}/convert-to-order`, {
        method: "POST",
      });
      const json = await res.json();
      if (json.success) {
        router.push("/customer/orders");
      } else {
        alert(json.error?.message || "Failed to convert RFQ to order");
      }
    } catch (err) {
      console.error("Convert RFQ error:", err);
    } finally {
      setConvertingId(null);
    }
  }

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 ">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-[#6B7280] mb-1">
            <Link
              href="/customer/dashboard"
              className="hover:text-[#111315] flex items-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Back to Dashboard</span>
            </Link>
            <span>/</span>
            <span className="text-[#111315] font-semibold">RFQ Quotations</span>
          </div>
          <h1 className="type-page">
            My RFQ Quotations & Commercial Proposals
          </h1>
          <p className="type-subtitle">
            Track official volume quotation requests, reviewed price margins,
            and convert accepted quotes into production orders.
          </p>
        </div>

        <button
          onClick={loadRfqs}
          className="saas-btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 self-start sm:self-auto"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
          />
          <span>Refresh List</span>
        </button>
      </div>

      <div className="space-y-6">
        {rfqs.length === 0 ? (
          <div className="saas-panel p-12 text-center border-[#E2E4E8] space-y-3">
            <FileText className="w-10 h-10 text-[#6B7280] mx-auto stroke-1" />
            <h3 className="text-base font-semibold text-[#111315]">
              No RFQs on Record
            </h3>
            <p className="text-xs text-[#6B7280]">
              Add components to your RFQ workspace and submit for volume
              quotation.
            </p>
            <Link
              href="/products"
              className="saas-btn-primary text-xs mt-2 inline-block"
            >
              Browse Component Catalog
            </Link>
          </div>
        ) : (
          rfqs.map((r) => (
            <div key={r.id} className="saas-panel p-6 space-y-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2E4E8] pb-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-mono font-bold text-base text-[#111315]">
                    {r.rfq_number}
                  </span>
                  <span
                    className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-semibold ${
                      r.status === "accepted"
                        ? "bg-[#DCFCE7] text-[#15803D]"
                        : r.status === "converted_to_order"
                          ? "bg-[#E0E7FF] text-[#4338CA]"
                          : r.status === "rejected"
                            ? "bg-[#FEE2E2] text-[#B91C1C]"
                            : "bg-[#FEF3C7] text-[#B45309]"
                    }`}
                  >
                    {r.status.replace(/_/g, " ")}
                  </span>
                </div>

                <div className="text-xs font-mono text-[#6B7280]">
                  Submitted:{" "}
                  {new Date(r.created_at).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </div>
              </div>

              {r.status === "rejected" && r.rejection_reason && (
                <div className="text-xs text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] p-3 rounded">
                  Rejected: {r.rejection_reason}
                </div>
              )}

              {/* Items Table */}
              <div className="saas-panel overflow-hidden">
                <table className="saas-table">
                  <thead className="font-mono text-[#6B7280] border-b border-[#E2E4E8]">
                    <tr>
                      <th className="py-2.5 px-3">COMPONENT SPECIFICATION</th>
                      <th className="py-2.5 px-3 text-center">REQUESTED LOT</th>
                      <th className="py-2.5 px-3 text-right">
                        AGREED UNIT PRICE
                      </th>
                      <th className="py-2.5 px-3 text-right">TOTAL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEEEEE] font-mono">
                    {r.items?.map((itm: any) => {
                      const finalPrice =
                        itm.final_unit_price ?? itm.original_unit_price;
                      const lineTotal =
                        (itm.final_quantity ?? itm.original_quantity) *
                        finalPrice;

                      return (
                        <tr key={itm.id} className="hover:bg-white/30">
                          <td className="py-3 px-3 font-semibold text-[#111315]">
                            {itm.product_name_snapshot}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {itm.final_quantity ?? itm.original_quantity} Units
                          </td>
                          <td className="py-3 px-3 text-right">
                            ₹{finalPrice?.toLocaleString("en-IN")}
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-[#111315]">
                            ₹{lineTotal.toLocaleString("en-IN")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Summary and Conversion Actions */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-2 border-t border-[#E2E4E8]">
                <div className="text-xs font-mono text-[#6B7280] space-y-0.5">
                  <div>
                    Consignment Destination: {r.delivery_address_snapshot?.city}
                    , {r.delivery_address_snapshot?.state}
                  </div>
                  <div className="text-[10px] text-[#6B7280]">
                    Includes standard MTC & Certificate of Conformity
                  </div>
                </div>

                <div className="flex items-center gap-4 self-end sm:self-auto">
                  <div className="text-right">
                    <span className="text-[10px] font-mono text-[#6B7280] uppercase block">
                      Final Proposal Total
                    </span>
                    <span className="text-lg font-bold font-mono text-[#111315]">
                      ₹
                      {(r.final_total ?? r.original_total)?.toLocaleString(
                        "en-IN",
                      )}
                    </span>
                  </div>

                  {r.status === "accepted" && (
                    <button
                      onClick={() => handleConvertToOrder(r.id)}
                      disabled={convertingId === r.id}
                      className="px-4 py-2.5 rounded bg-[#15803D] hover:bg-[#166534] text-white text-xs font-mono font-semibold transition-all flex items-center gap-2 shadow-xs disabled:opacity-50"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      <span>
                        {convertingId === r.id
                          ? "Confirming..."
                          : "Place Production Order"}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {r.status === "converted_to_order" && (
                    <Link
                      href="/customer/orders"
                      className="saas-btn-secondary text-xs font-mono font-semibold text-[#111315] flex items-center gap-1.5"
                    >
                      <span>Track Batch Order</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
