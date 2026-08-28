"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  RefreshCw,
  ShieldCheck,
  Package,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  MapPin,
  Search,
  ArrowRight,
} from "lucide-react";
import { createBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { cachedApiGet } from "@/lib/client/portal-data-cache";
import { CustomerPageShell } from "@/components/customer/CustomerPageShell";
import { BuyerEmptyState } from "@/components/customer/BuyerEmptyState";

interface OrderItem {
  id: string;
  product_id?: string;
  product_name_snapshot: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface Order {
  id: string;
  order_number: string;
  status: 'accepted' | 'packing' | 'dispatched' | 'cancelled';
  payment_status: 'payment_required' | 'payment_done';
  total: number;
  created_at: string;
  delivery_address_snapshot: any;
  items: OrderItem[];
}

export default function CustomerOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
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

      if (!prof) {
        router.push("/auth?role=buyer&mode=signin");
        return;
      }

      const res = await cachedApiGet<{ orders: Order[] }>(
        `/api/orders?customerId=${prof.id}`,
      );
      if (res.ok && res.data?.orders) {
        setOrders(res.data.orders);
      }
    } catch (err) {
      console.error("Error loading orders:", err);
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

  function getStepIndex(status: Order["status"], paymentStatus: string) {
    if (status === "cancelled") return 0;
    if (status === "dispatched") return 5;
    if (status === "packing") return 4;
    if (status === "accepted" && paymentStatus === "payment_done") return 3;
    if (status === "accepted") return 2;
    return 1;
  }

  const stages = [
    { label: "1. Order Confirmed", desc: "PO details verified" },
    { label: "2. Payment Processed", desc: "Production underway" },
    { label: "3. QA & Packaging", desc: "Batch & CMM check" },
    { label: "4. Dispatched", desc: "Inward transit" },
    { label: "5. Delivered", desc: "Consignment received" },
  ];

  // Filtering
  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      !searchQuery ||
      o.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.items?.some((i) =>
        i.product_name_snapshot?.toLowerCase().includes(searchQuery.toLowerCase())
      );

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && o.status !== "dispatched" && o.status !== "cancelled") ||
      (statusFilter === "completed" && o.status === "dispatched") ||
      (statusFilter === "cancelled" && o.status === "cancelled");

    return matchesSearch && matchesStatus;
  });

  return (
    <CustomerPageShell
      title="Orders"
      subtitle="Track manufacturing progress and deliveries."
      actions={
        <button type="button" onClick={loadOrders} className="buyer-cta-ghost">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      }
    >
      <div className="buyer-flush flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="relative w-full flex-1 max-w-2xl">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF] pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by order number or part…"
            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-[#D9DCE1] bg-[#F7F7F8] text-[#111315] focus:outline-none focus:border-[#111315]"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {[
            { key: 'all', label: 'All' },
            { key: 'active', label: 'Active' },
            { key: 'completed', label: 'Delivered' },
            { key: 'cancelled', label: 'Cancelled' },
          ].map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setStatusFilter(f.key)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                statusFilter === f.key
                  ? 'bg-[#111315] text-white'
                  : 'bg-white/70 text-[#6B7280] hover:text-[#111315] shadow-[var(--buyer-shadow-sm)]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="space-y-4 animate-pulse">
            {[1, 2].map((i) => (
              <div key={i} className="buyer-surface h-56" />
            ))}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="buyer-surface-grad buyer-surface-grad--sky buyer-fill-panel min-h-[min(48vh,480px)]">
            <BuyerEmptyState
              variant={searchQuery || statusFilter !== 'all' ? 'search' : 'orders'}
              title={
                searchQuery || statusFilter !== 'all' ? 'No matching orders' : undefined
              }
              description={
                searchQuery || statusFilter !== 'all'
                  ? 'Try clearing search or filters.'
                  : undefined
              }
              actionLabel={searchQuery || statusFilter !== 'all' ? undefined : 'Browse catalog'}
              actionHref={searchQuery || statusFilter !== 'all' ? undefined : '/products'}
            />
          </div>
        ) : (
          filteredOrders.map((o, idx) => {
            const currentStep = getStepIndex(o.status, o.payment_status);
            const isCancelled = o.status === 'cancelled';
            const isExpanded = !!expandedOrders[o.id];

            return (
              <div
                key={o.id}
                className={
                  idx === 0
                    ? 'buyer-surface-grad buyer-surface-grad--sky overflow-hidden'
                    : 'buyer-surface overflow-hidden'
                }
              >
                <div className="p-5 border-b border-[#D9DCE1] flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#E8EAED]/40">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-bold text-base text-[#111315]">
                        {o.order_number}
                      </span>
                      <span
                        className={`text-[11px] font-mono uppercase px-2.5 py-0.5 rounded-full font-semibold ${
                          o.status === 'dispatched'
                            ? 'inline-flex items-center px-2.5 py-0.5 text-xs rounded-full bg-[#E8F5EC] text-[#15803D]'
                            : o.status === 'packing'
                              ? 'inline-flex items-center px-2.5 py-0.5 text-xs rounded-full bg-[#EEF2FF] text-[#3730A3]'
                              : isCancelled
                                ? 'inline-flex items-center px-2.5 py-0.5 text-xs rounded-full bg-[#FDECEC] text-[#B91C1C]'
                                : 'inline-flex items-center px-2.5 py-0.5 text-xs rounded-full bg-[#FEF6E7] text-[#B45309]'
                        }`}
                      >
                        {o.status === 'dispatched' ? 'delivered' : o.status.replace('_', ' ')}
                      </span>
                      <span
                        className={`text-[11px] font-mono px-2.5 py-0.5 rounded-full ${
                          o.payment_status === 'payment_done'
                            ? 'inline-flex items-center px-2.5 py-0.5 text-xs rounded-full bg-[#E8F5EC] text-[#15803D]'
                            : 'inline-flex items-center px-2.5 py-0.5 text-xs rounded-full bg-[#FEF6E7] text-[#B45309]'
                        }`}
                      >
                        {o.payment_status === 'payment_done' ? 'Payment confirmed' : 'Payment pending'}
                      </span>
                    </div>
                    <div className="text-xs text-[#6B7280] flex flex-wrap gap-3">
                      <span>
                        Placed:{' '}
                        <strong className="text-[#111315]">
                          {new Date(o.created_at).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </strong>
                      </span>
                      <span>•</span>
                      <span>
                        Ship to:{' '}
                        <strong className="text-[#111315]">
                          {o.delivery_address_snapshot?.city || 'India'}
                          {o.delivery_address_snapshot?.state
                            ? `, ${o.delivery_address_snapshot.state}`
                            : ''}
                        </strong>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between lg:justify-end gap-6">
                    <div className="text-right">
                      <div className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider">
                        Total
                      </div>
                      <div className="text-xl font-bold font-mono text-[#111315]">
                        ₹{o.total?.toLocaleString('en-IN')}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleExpand(o.id)}
                      className="buyer-cta-ghost !px-3 !py-1.5 text-xs"
                    >
                      {isExpanded ? 'Hide' : 'Details'}
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {!isCancelled ? (
                  <div className="p-5 border-b border-[#D9DCE1]">
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                      {stages.map((st, idx) => {
                        const stepNum = idx + 1;
                        const isDone = stepNum < currentStep;
                        const isCurrent = stepNum === currentStep;
                        return (
                          <div
                            key={idx}
                            className={`p-3 rounded-xl border transition-all ${
                              isDone
                                ? 'bg-[#E8F5EC] border-[#D9DCE1] text-[#15803D]'
                                : isCurrent
                                  ? 'bg-[#111315] border-[#111315] text-white'
                                  : 'bg-[#E8EAED] border-[#D9DCE1] text-[#6B7280]'
                            }`}
                          >
                            <div className="flex items-center justify-between text-xs font-semibold mb-1">
                              <span>{st.label}</span>
                              {isDone ? (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              ) : isCurrent ? (
                                <Clock className="w-3.5 h-3.5 animate-pulse" />
                              ) : null}
                            </div>
                            <div
                              className={`text-[11px] ${isCurrent ? 'opacity-80' : 'text-[#6B7280]'}`}
                            >
                              {st.desc}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-[#FDECEC] border-b border-[#D9DCE1] text-xs text-[#B91C1C] flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>This order was cancelled. Contact support if you need help.</span>
                  </div>
                )}

                {isExpanded ? (
                  <div className="p-5 sm:p-6 space-y-6 bg-[#E8EAED]/30">
                    <div className="space-y-2">
                      <div className="text-xs font-bold text-[#111315] uppercase tracking-wider">
                        Line items
                      </div>
                      <div className="overflow-x-auto rounded-xl border border-[#D9DCE1] bg-[#F7F7F8]">
                        <table className="w-full text-left text-sm">
                          <thead>
                            <tr>
                              <th>Component</th>
                              <th className="text-center">Qty</th>
                              <th className="text-right">Unit</th>
                              <th className="text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {o.items?.map((itm) => (
                              <tr key={itm.id}>
                                <td className="font-semibold font-sans">{itm.product_name_snapshot}</td>
                                <td className="text-center font-mono">{itm.quantity}</td>
                                <td className="text-right font-mono">
                                  ₹{itm.unit_price?.toLocaleString('en-IN')}
                                </td>
                                <td className="text-right font-mono font-bold">
                                  ₹{itm.total?.toLocaleString('en-IN')}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="p-4 rounded-xl border border-[#D9DCE1] bg-[#F7F7F8] space-y-1.5">
                        <div className="flex items-center gap-1.5 font-bold text-[#111315]">
                          <MapPin className="w-3.5 h-3.5" />
                          Delivery address
                        </div>
                        <div className="text-[#6B7280] leading-relaxed">
                          {o.delivery_address_snapshot?.address_line_1 || 'Registered destination'}
                          {o.delivery_address_snapshot?.address_line_2 ? (
                            <>
                              <br />
                              {o.delivery_address_snapshot.address_line_2}
                            </>
                          ) : null}
                          <br />
                          {o.delivery_address_snapshot?.city}, {o.delivery_address_snapshot?.state} —{' '}
                          {o.delivery_address_snapshot?.postal_code}
                          <br />
                          {o.delivery_address_snapshot?.country || 'India'}
                        </div>
                      </div>
                      <div className="p-4 rounded-xl border border-[#D9DCE1] bg-[#F7F7F8] space-y-1.5">
                        <div className="flex items-center gap-1.5 font-bold text-[#15803D]">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Quality
                        </div>
                        <p className="text-[#6B7280] leading-relaxed">
                          Lots include material test certificates and dimensional inspection as applicable.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </CustomerPageShell>
  );
}
