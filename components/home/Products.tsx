'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { ArrowRight, Package, ArrowUpRight, ShieldCheck, CheckCircle2, SlidersHorizontal } from 'lucide-react';
import { RemoteImage } from '@/components/ui/RemoteImage';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface ProductItem {
  id: string;
  name: string;
  sku?: string;
  material?: string;
  standard?: string;
  category?: { name?: string };
  ribbon_label?: string;
  images?: { image_url: string }[];
  moq?: string;
}

export default function Products() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      try {
        setLoading(true);
        const res = await fetch('/api/products?limit=8');
        if (res.ok) {
          const json = await res.json();
          if (!cancelled && json.success) {
            setProducts(json.data?.products || []);
          }
        }
      } catch {
        if (!cancelled) setProducts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadCatalog();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    const ctx = gsap.context(() => {
      gsap.from('.product-grid-card', {
        y: 30,
        opacity: 0,
        duration: 0.7,
        stagger: 0.06,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: gridRef.current,
          start: 'top 80%',
          once: true,
        },
      });
    }, sectionRef);

    return () => ctx.revert();
  }, [products]);

  const categories = [
    { id: 'all', label: 'All Indexed Components' },
    { id: 'aerospace', label: 'Aerospace Fasteners' },
    { id: 'marine', label: 'Marine & Subsea' },
    { id: 'cnc', label: 'Custom CNC Turned' },
  ];

  return (
    <section
      id="catalog"
      ref={sectionRef}
      className="relative bg-[#f8f9fb] py-24 md:py-36 border-b border-slate-200/80"
      aria-label="Component Catalog and Inventory"
    >
      {/* Anchor for products hash */}
      <div id="products" className="absolute -top-20 left-0" />

      <div className="max-w-7xl mx-auto px-4 sm:px-8 space-y-12">
        {/* Header & Controls */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-slate-200">
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="home-badge-teal">02 / CATALOG INDEX</span>
              <span className="home-badge-mono">LIVE COMPONENT INVENTORY</span>
            </div>

            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#090e17]">
              Certified industrial catalog.
            </h2>
            <p className="text-base text-[#3f4f68] leading-relaxed">
              Standard fastener listings and custom machined hardware ready for high-volume RFQ contracting and lab inspection.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/products"
              className="home-btn-primary text-xs py-2.5 px-5 inline-flex items-center gap-2"
            >
              <span>Explore All 12,000+ SKUs</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Category Chips Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 hide-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`text-xs font-medium px-4 py-2 rounded-full transition-all shrink-0 ${ activeCategory === cat.id ? 'bg-[#090e17] text-white shadow-xs' : 'bg-white text-[#3f4f68] border border-slate-200 hover:border-slate-300' }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* 4-Column Dieter Rams / Apple Industrial Grid */}
        <div
          ref={gridRef}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {products.slice(0, 8).map((product) => {
            const imageUrl = product.images?.[0]?.image_url;
            const ribbon = product.ribbon_label || 'Direct Factory';
            const categoryName = product.category?.name || 'Fastener';
            const material = product.material || 'SS316L / Ti Grade 5';
            const standard = product.standard || 'DIN 912 / ISO 4762';
            const moq = product.moq || '1,000 PCS';

            return (
              <div
                key={product.id}
                className="product-grid-card home-card-soft p-5 flex flex-col justify-between group overflow-hidden bg-white"
              >
                <div>
                  {/* Visual Frame */}
                  <div className="relative h-44 w-full rounded-2xl overflow-hidden bg-slate-50 border border-slate-100 flex items-center justify-center mb-4">
                    {imageUrl ? (
                      <RemoteImage
                        src={imageUrl}
                        alt={product.name}
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-400 gap-1.5 p-4 text-center">
                        <div className="h-12 w-12 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center shadow-xs">
                          <Package className="w-6 h-6 text-[#0d9488]" strokeWidth={1.5} />
                        </div>
                        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                          CAD Model Verified
                        </span>
                      </div>
                    )}

                    {/* Ribbon Tag */}
                    <span className="absolute top-3 left-3 bg-white/95 backdrop-blur-md border border-slate-200 text-[10px] font-bold text-[#0f766e] px-2.5 py-0.5 rounded-full shadow-xs">
                      {ribbon}
                    </span>
                  </div>

                  {/* Product Metadata */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-[#718096]">
                      <span>{categoryName}</span>
                      <span className="font-mono font-medium text-slate-900">{moq}</span>
                    </div>

                    <h3 className="font-display font-bold text-base text-[#090e17] leading-snug line-clamp-2 group-hover:text-[#0d9488] transition-colors">
                      {product.name}
                    </h3>

                    <div className="pt-2 space-y-1 text-[11px] text-[#3f4f68] border-t border-slate-100">
                      <div className="flex justify-between">
                        <span className="text-slate-400">SPEC</span>
                        <span className="font-semibold">{standard}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">ALLOY</span>
                        <span className="font-semibold text-slate-900">{material}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Action Button */}
                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-1 text-[11px] text-[#0d9488] font-semibold">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>EN 10204 3.1</span>
                  </div>

                  <Link
                    href={`/products/${product.id}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#090e17] group-hover:text-[#0d9488] transition-colors"
                  >
                    <span>Configure RFQ</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
