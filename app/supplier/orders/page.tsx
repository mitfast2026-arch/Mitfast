'use client';

import React, { useState, useEffect } from 'react';
import { 
  ShoppingCart, 
  Search, 
  RefreshCw, 
  Calendar
} from 'lucide-react';

export default function SupplierOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  async function loadOrders() {
    setLoading(true);
    try {
      const res = await fetch(`/api/supplier/orders?search=${encodeURIComponent(searchTerm)}`);
      const json = await res.json();
      if (json.success) {
        setOrders(json.data.orders || []);
        if (json.data.orders && json.data.orders.length > 0 && !selectedOrder) {
          setSelectedOrder(json.data.orders[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load supplier orders:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrders();
  }, [searchTerm]);

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="type-page">
            Production Orders
          </h1>
          <p className="type-subtitle">
            Confirmed commercial orders requiring machining, quality inspection, packing, and dispatch.
          </p>
        </div>

        <button 
          onClick={loadOrders} 
          className="saas-neu-button text-xs py-2 px-3.5 flex items-center gap-2 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#6B7280] ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Orders</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Orders List (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="saas-panel p-3">
            <div className="relative">
              <input 
                type="text"
                placeholder="Search orders by number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="saas-input pl-8 text-xs"
              />
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6B7280]" />
            </div>
          </div>

          <div className="space-y-2.5 max-h-[700px] overflow-y-auto pr-1">
            {loading ? (
              <div className="saas-panel p-12 text-center text-xs text-[#6B7280]">
                Loading orders…
              </div>
            ) : orders.length === 0 ? (
              <div className="saas-panel p-12 text-center text-xs text-[#6B7280]">
                No production orders found for your facility.
              </div>
            ) : (
              orders.map((o) => {
                const isSelected = selectedOrder?.id === o.id;
                return (
                  <div
                    key={o.id}
                    onClick={() => setSelectedOrder(o)}
                    className={`saas-panel p-4 cursor-pointer transition-all space-y-2 ${
                      isSelected 
                        ? 'ring-2 ring-amber-500 shadow-md' 
                        : 'hover:bg-[#F7F7F8]/70'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="type-id text-[#111315]">{o.order_number}</span>
                      <span className={
                        o.status === 'dispatched' 
                          ? 'saas-badge-success' 
                          : o.status === 'cancelled' 
                          ? 'saas-badge-danger' 
                          : 'saas-badge-gold'
                      }>
                        {o.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="text-xs text-[#6B7280]">
                      Your SKU lines to fulfill
                    </div>

                    <div className="flex items-center justify-between text-xs pt-2 border-t border-[#E2E4E8]">
                      <span className="text-[#6B7280]">{o.items?.length || 0} component line(s)</span>
                      <span className="text-[#6B7280] flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-[#6B7280]" />
                        <span>{new Date(o.created_at).toLocaleDateString()}</span>
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Selected Order Detail (7 cols) */}
        <div className="lg:col-span-7">
          {selectedOrder ? (
            <div className="saas-panel p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E2E4E8] pb-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="type-section type-id">
                      {selectedOrder.order_number}
                    </h2>
                    <span className="saas-badge-cyan">{selectedOrder.status.toUpperCase()}</span>
                  </div>
                  <div className="text-xs text-[#6B7280] mt-1">
                    Confirmed on {new Date(selectedOrder.created_at).toLocaleDateString()}
                  </div>
                </div>

                <div className="text-right">
                  <div className="type-meta text-[#6B7280]">Fulfillment status</div>
                  <span className="saas-badge-gold mt-0.5">{selectedOrder.status.toUpperCase()}</span>
                </div>
              </div>

              {/* Items Table */}
              <div className="space-y-2">
                <div className="type-section text-[#6B7280]">
                  Your Components to Fulfill
                </div>

                <div className="saas-table-container">
                  <table className="saas-table text-xs">
                    <thead>
                      <tr>
                        <th>Component</th>
                        <th className="text-right">Quantity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedOrder.items?.map((item: any) => {
                        return (
                          <tr key={item.id}>
                            <td className="font-medium text-[#111315] text-xs">
                              {item.product_name_snapshot}
                              {item.sku ? <span className="block text-[#6B7280] font-normal">SKU {item.sku}</span> : null}
                            </td>
                            <td className="text-right text-[#111315] type-metric">{item.quantity} Units</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <p className="text-xs text-[#6B7280]">
                Buyer identity, ship-to address, and selling prices are withheld.
              </p>
            </div>
          ) : (
            <div className="saas-panel p-16 text-center text-xs text-[#6B7280]">
              Select an order from the list to view fulfillment details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
