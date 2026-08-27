'use client';

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import Link from 'next/link';
import { ArrowRight, Package } from 'lucide-react';
import { RemoteImage } from '@/components/ui/RemoteImage';
import type { CurvedProduct } from './productData';
import './curved-products.css';

const CONFIG = {
  radius: 820,
  cardWidth: 285,
  cardHeight: 410,
  cardGap: 24,
  perspective: 1100,
  damping: 0.93,
  fogStrength: 0.90,
  autoDrift: true,
  driftSpeed: 0.0035,
};

type CurvedProductCarouselProps = {
  products: CurvedProduct[];
};

export default function CurvedProductCarousel({ products }: CurvedProductCarouselProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const fogRefs = useRef<(HTMLDivElement | null)[]>([]);

  const scrollOffsetRef = useRef<number>(0);
  const velocityRef = useRef<number>(0);
  const isPointerDownRef = useRef<boolean>(false);
  const pointerStartXRef = useRef<number>(0);
  const pointerStartYRef = useRef<number>(0);
  const lastPointerXRef = useRef<number>(0);
  const lastTimestampRef = useRef<number>(0);
  const totalDragDistanceRef = useRef<number>(0);
  const isHorizontalDragRef = useRef<boolean>(false);
  const animFrameIdRef = useRef<number>(0);
  const isHoveredRef = useRef<boolean>(false);
  const isIntersectingRef = useRef<boolean>(true);

  const productList = products;
  const totalItems = productList.length;
  const arcStepRad = totalItems > 0 ? (CONFIG.cardWidth + CONFIG.cardGap) / CONFIG.radius : 0;
  const angleStepDeg = arcStepRad * (180 / Math.PI);
  const halfTotal = totalItems / 2;

  const updateFanTransform = useCallback(() => {
    if (totalItems === 0) return;

    const offset = scrollOffsetRef.current;
    const { radius, fogStrength } = CONFIG;
    const v = velocityRef.current;
    const stretch = 1 + Math.min(0.03, Math.abs(v) * 0.08);
    const lean = Math.max(-1.5, Math.min(1.5, -v * 5.0));

    for (let i = 0; i < totalItems; i++) {
      const cardEl = cardRefs.current[i];
      if (!cardEl) continue;

      let diff = (i - offset) % totalItems;
      if (diff > halfTotal) diff -= totalItems;
      if (diff < -halfTotal) diff += totalItems;

      const absDiff = Math.abs(diff);

      if (absDiff > 4.6) {
        cardEl.style.visibility = 'hidden';
        continue;
      }

      cardEl.style.visibility = 'visible';

      const angleDeg = diff * angleStepDeg;
      const angleRad = angleDeg * (Math.PI / 180);
      const x = radius * Math.sin(angleRad);
      const z = radius * (1 - Math.cos(angleRad));
      const rotY = -angleDeg;

      cardEl.style.transform = `translate3d(${x.toFixed(1)}px, 0px, ${z.toFixed(1)}px) rotateY(${rotY.toFixed(1)}deg) scaleX(${stretch.toFixed(3)}) skewY(${lean.toFixed(2)}deg)`;
      cardEl.style.zIndex = String(Math.round(100 - absDiff * 10));

      const fogEl = fogRefs.current[i];
      if (fogEl) {
        let fog = 0;
        if (absDiff > 1.25) {
          fog = Math.min(1, (absDiff - 1.25) / 2.4) * fogStrength;
        }
        fogEl.style.opacity = String(Math.max(0, Math.min(0.92, fog)));
      }
    }
  }, [totalItems, angleStepDeg, halfTotal]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        isIntersectingRef.current = entry.isIntersecting;
      },
      { threshold: 0.05, rootMargin: '100px 0px' }
    );

    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (totalItems === 0) return;

    let prevTime = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(32, Math.max(1, now - prevTime));
      prevTime = now;
      const dtFactor = dt / 16.67;

      if (isIntersectingRef.current) {
        if (!isPointerDownRef.current) {
          if (Math.abs(velocityRef.current) > 0.0001) {
            scrollOffsetRef.current =
              (scrollOffsetRef.current + velocityRef.current * dtFactor + totalItems * 100) % totalItems;
            velocityRef.current *= Math.pow(CONFIG.damping, dtFactor);
          } else {
            velocityRef.current = 0;
            if (CONFIG.autoDrift && !isHoveredRef.current) {
              scrollOffsetRef.current =
                (scrollOffsetRef.current + CONFIG.driftSpeed * dtFactor + totalItems * 100) % totalItems;
            }
          }
        }

        updateFanTransform();
      }

      animFrameIdRef.current = requestAnimationFrame(loop);
    };

    animFrameIdRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animFrameIdRef.current);
    };
  }, [totalItems, updateFanTransform]);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    isPointerDownRef.current = true;
    isHorizontalDragRef.current = false;
    pointerStartXRef.current = e.clientX;
    pointerStartYRef.current = e.clientY;
    lastPointerXRef.current = e.clientX;
    lastTimestampRef.current = performance.now();
    totalDragDistanceRef.current = 0;
    velocityRef.current = 0;

    if (stageRef.current && e.pointerType === 'mouse') {
      stageRef.current.setPointerCapture(e.pointerId);
    }
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPointerDownRef.current) return;

    const dx = e.clientX - lastPointerXRef.current;
    const dy = e.clientY - pointerStartYRef.current;
    const totalDx = Math.abs(e.clientX - pointerStartXRef.current);
    const now = performance.now();
    const dt = Math.max(1, now - lastTimestampRef.current);

    if (!isHorizontalDragRef.current) {
      if (totalDx > 8 && totalDx > Math.abs(dy) * 1.2) {
        isHorizontalDragRef.current = true;
        setIsDragging(true);
        setHasInteracted(true);
        if (stageRef.current && e.pointerType === 'touch') {
          stageRef.current.setPointerCapture(e.pointerId);
        }
      } else if (Math.abs(dy) > 10 && Math.abs(dy) > totalDx) {
        isPointerDownRef.current = false;
        setIsDragging(false);
        return;
      }
    }

    if (!isHorizontalDragRef.current && e.pointerType === 'touch') return;

    lastPointerXRef.current = e.clientX;
    lastTimestampRef.current = now;
    totalDragDistanceRef.current += Math.abs(dx);

    const cardStepPixels = (CONFIG.cardWidth + CONFIG.cardGap) * 0.95;
    const deltaIndex = -(dx / cardStepPixels);

    scrollOffsetRef.current =
      (scrollOffsetRef.current + deltaIndex + totalItems * 100) % totalItems;

    const instantVelocity = (deltaIndex / dt) * 16.67;
    velocityRef.current = velocityRef.current * 0.45 + instantVelocity * 0.55;

    updateFanTransform();
  }, [totalItems, updateFanTransform]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPointerDownRef.current) return;

    isPointerDownRef.current = false;
    setIsDragging(false);
    isHorizontalDragRef.current = false;

    if (stageRef.current) {
      try {
        stageRef.current.releasePointerCapture(e.pointerId);
      } catch {
        // already released
      }
    }

    velocityRef.current = Math.max(-0.25, Math.min(0.25, velocityRef.current));
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    const absX = Math.abs(e.deltaX);
    const absY = Math.abs(e.deltaY);

    if (absX > 6 && absX > absY * 1.8) {
      setHasInteracted(true);
      const speed = 0.0015;
      velocityRef.current += (e.deltaX > 0 ? 1 : -1) * Math.min(0.05, absX * speed);
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft') {
        velocityRef.current -= 0.08;
        setHasInteracted(true);
      } else if (e.key === 'ArrowRight') {
        velocityRef.current += 0.08;
        setHasInteracted(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (totalItems === 0) {
    return (
      <div className="arc-fan-root relative w-full py-16 text-center">
        <Package className="w-10 h-10 text-[#9ca3af] mx-auto mb-4" strokeWidth={1.5} />
        <p className="text-sm text-[#6B7280] mb-4">No products in the homepage carousel yet</p>
        <Link
          href="/products"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#111315] text-white text-xs font-semibold"
        >
          Browse catalog
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="arc-fan-root relative w-full overflow-visible">
      <div className="arc-fan-stage-wrapper relative w-full overflow-visible">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-20 sm:w-36 bg-gradient-to-r from-[#F7F7F8] via-[#F7F7F8]/80 to-transparent z-20" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-20 sm:w-36 bg-gradient-to-l from-[#F7F7F8] via-[#F7F7F8]/80 to-transparent z-20" />

        <div
          ref={stageRef}
          className={`arc-fan-stage ${isDragging ? 'is-dragging' : ''}`}
          style={{
            perspective: `${CONFIG.perspective}px`,
            WebkitPerspective: `${CONFIG.perspective}px`,
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={handleWheel}
          onMouseEnter={() => {
            isHoveredRef.current = true;
          }}
          onMouseLeave={() => {
            isHoveredRef.current = false;
          }}
          aria-label="Inward 3D Curved Product Carousel — Drag horizontally to rotate"
          role="region"
          tabIndex={0}
        >
          <div className="arc-fan-center-anchor">
            {productList.map((product, i) => (
              <div
                key={product.id}
                ref={(el) => {
                  cardRefs.current[i] = el;
                }}
                className="arc-fan-card"
              >
                <Link
                  href={product.href}
                  onClick={(e) => {
                    if (totalDragDistanceRef.current > 6) {
                      e.preventDefault();
                    }
                  }}
                  className="block w-full h-full"
                  tabIndex={0}
                >
                  <div className="arc-fan-card-inner group">
                    <div className="arc-fan-image-wrap">
                      {product.image ? (
                        <RemoteImage
                          src={product.image}
                          alt={product.title}
                          sizes="360px"
                          priority={i < 4}
                          className="arc-fan-image"
                        />
                      ) : (
                        <div className="flex items-center justify-center w-full h-full bg-[#ECEEF0]">
                          <Package className="w-12 h-12 text-[#9ca3af]" strokeWidth={1.25} />
                        </div>
                      )}
                    </div>

                    <div
                      ref={(el) => {
                        fogRefs.current[i] = el;
                      }}
                      className="arc-fan-fog-shield"
                    />

                    <div className="arc-fan-card-meta">
                      {product.badge ? (
                        <span className="arc-fan-badge">{product.badge}</span>
                      ) : (
                        <span />
                      )}

                      <div className="arc-fan-info-bottom">
                        <span className="arc-fan-category">{product.category}</span>
                        <h3 className="arc-fan-title">{product.title}</h3>
                        <div className="arc-fan-spec-row">
                          <span className="arc-fan-price">
                            {product.price > 0
                              ? `₹${product.price.toLocaleString('en-IN')}`
                              : 'Quote on request'}
                          </span>
                          <span className="arc-fan-action">
                            <span>Inspect</span>
                            <ArrowRight className="w-3 h-3" />
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>

          <div className="arc-fan-shadow-floor" />
        </div>
      </div>
    </div>
  );
}
