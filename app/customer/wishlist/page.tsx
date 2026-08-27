'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Heart,
  ShoppingCart,
  Trash2,
  Package,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cachedApiGet } from '@/lib/client/portal-data-cache';
import { CustomerPageShell } from '@/components/customer/CustomerPageShell';
import { BuyerEmptyState } from '@/components/customer/BuyerEmptyState';

interface WishlistProduct {
  id: string;
  productId: string;
  name: string;
  sku?: string;
  price?: number;
  imageUrl?: string;
  category?: string;
  moq?: number;
}

export default function CustomerWishlistPage() {
  const [items, setItems] = useState<WishlistProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  async function loadWishlist() {
    setLoading(true);
    try {
      const res = await cachedApiGet<{ items: any[] }>('/api/wishlist');
      if (res.ok && res.data?.items) {
        setItems(
          res.data.items.map((item: any) => ({
            id: item.id || item.productId,
            productId: item.productId || item.product?.id,
            name: item.name || item.product?.name || 'Precision Component',
            sku: item.sku || item.product?.sku || '',
            price: item.price || item.product?.price || 0,
            imageUrl:
              item.imageUrl ||
              item.product?.primaryImage ||
              item.product?.image_url ||
              '/images/placeholder.png',
            category: item.category || item.product?.category?.name || 'Fasteners',
            moq: item.moq || item.product?.moq || 100,
          }))
        );
      }
    } catch (err) {
      console.error('Error loading wishlist:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWishlist();
  }, []);

  async function handleRemove(productId: string) {
    const prevItems = items;
    // 1. Optimistic removal
    setItems((prev) => prev.filter((i) => i.productId !== productId));
    toast.success('Item removed from wishlist');

    try {
      const res = await fetch(`/api/wishlist?productId=${productId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        // Rollback
        setItems(prevItems);
        toast.error(json.error?.message || 'Failed to remove item');
      }
    } catch (err) {
      setItems(prevItems);
      toast.error('Network error removing item');
    }
  }

  async function handleMoveToCart(item: WishlistProduct) {
    const prevItems = items;
    setMovingId(item.productId);

    // 1. Optimistic remove from wishlist
    setItems((prev) => prev.filter((i) => i.productId !== item.productId));

    // 2. Synchronous cart badge bump
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cart-updated', { detail: { delta: 1 } }));
    }

    // 3. Instant toast feedback
    toast.success(`Added "${item.name}" to your RFQ Cart!`, {
      action: {
        label: 'View Cart',
        onClick: () => {
          window.location.href = '/cart';
        },
      },
    });

    // 4. Background API sync
    try {
      const [cartRes, wishRes] = await Promise.all([
        fetch('/api/cart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId: item.productId,
            quantity: item.moq || 100,
          }),
        }),
        fetch(`/api/wishlist?productId=${item.productId}`, {
          method: 'DELETE',
        }),
      ]);

      const cartJson = await cartRes.json();
      if (!cartRes.ok || !cartJson.success) {
        // Rollback
        setItems(prevItems);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('cart-updated', { detail: { delta: -1 } }));
        }
        toast.error(cartJson.error?.message || 'Failed to add to cart');
      }
    } catch (err) {
      setItems(prevItems);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('cart-updated', { detail: { delta: -1 } }));
      }
      toast.error('Error moving item to cart');
    } finally {
      setMovingId(null);
    }
  }

  return (
    <CustomerPageShell
      title="Wishlist"
      subtitle="Saved products for later quotes."
      actions={
        <button type="button" onClick={loadWishlist} className="buyer-cta-ghost">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      }
    >

      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs font-medium flex items-center gap-2.5 ${
            feedback.type === 'success'
              ? 'bg-[#E8F5EC] text-[#15803D]'
              : 'bg-[#FDECEC] text-[#B91C1C]'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="buyer-surface h-64" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="buyer-flush">
          <BuyerEmptyState variant="wishlist" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {items.map((item, idx) => (
            <div
              key={item.productId}
              className={
                idx === 0
                  ? 'buyer-surface-grad buyer-surface-grad--warm p-5 flex flex-col justify-between group'
                  : 'buyer-surface p-5 flex flex-col justify-between group'
              }
            >
              <div className="space-y-3">
                <div className="aspect-[4/3] rounded-xl bg-[#E8EAED] border border-[#D9DCE1] overflow-hidden flex items-center justify-center relative p-3">
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500&auto=format&fit=crop&q=60';
                    }}
                  />
                  <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#F7F7F8] border border-[#D9DCE1] text-[#111315]">
                    {item.category}
                  </span>
                </div>

                <div className="space-y-1">
                  <Link
                    href={`/products/${item.productId}`}
                    className="text-sm font-bold text-[#111315] hover:underline line-clamp-2"
                  >
                    {item.name}
                  </Link>
                  {item.sku && (
                    <div className="text-[11px] font-mono text-[#6B7280]">SKU: {item.sku}</div>
                  )}
                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <span className="text-[10px] uppercase text-[#6B7280] font-semibold block">
                        Rate
                      </span>
                      <span className="text-base font-bold font-mono text-[#111315]">
                        ₹{item.price?.toLocaleString('en-IN')}
                        <span className="text-[11px] font-normal text-[#6B7280]"> / unit</span>
                      </span>
                    </div>
                    <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-md inline-flex items-center px-2.5 py-0.5 text-xs rounded-full bg-[#E8F5EC] text-[#15803D]">
                      MOQ: {item.moq}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-[#D9DCE1] mt-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleMoveToCart(item)}
                  disabled={movingId === item.productId}
                  className="flex-1 buyer-cta text-xs"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  {movingId === item.productId ? 'Moving…' : 'Move to cart'}
                </button>
                <button
                  type="button"
                  onClick={() => handleRemove(item.productId)}
                  disabled={removingId === item.productId}
                  className="p-2 rounded-full border border-[#D9DCE1] text-[#B91C1C] hover:bg-[#FDECEC] transition-colors disabled:opacity-50"
                  title="Remove"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </CustomerPageShell>
  );
}
