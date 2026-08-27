"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import CategoryCard, { type CategoryCardData } from "@/components/categories/CategoryCard";
import styles from "@/components/categories/categories.module.css";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryCardData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadCategories() {
      try {
        const res = await fetch("/api/categories");
        const json = await res.json();
        if (!cancelled && json.success) {
          setCategories(json.data.categories || []);
        }
      } catch (err) {
        console.error("Failed to load categories:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadCategories();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={styles.pageShell}>
      <div className={styles.decorative} aria-hidden="true">
        <Image
          src="/IMAGE/sourcing_development.jpg"
          alt=""
          fill
          sizes="100vw"
          className="object-cover"
          priority={false}
        />
      </div>

      <div className={styles.page}>
        <section className={styles.intro} aria-labelledby="categories-heading">
          <nav className={styles.breadcrumb} aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span className={styles.breadcrumbSep} aria-hidden="true">
              &gt;
            </span>
            <span className={styles.breadcrumbCurrent}>Categories</span>
          </nav>

          <h1 id="categories-heading" className={styles.title}>
            Product Categories
          </h1>
          <p className={styles.description}>
            Browse product categories and industrial standards.
          </p>
        </section>

        {loading ? (
          <div className={styles.grid} aria-hidden="true">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={styles.skeleton} />
            ))}
          </div>
        ) : categories.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <p className="text-sm font-medium text-[#111315]">No categories yet</p>
            <p className="text-xs text-[#6B7280]">
              Categories will appear here once they are published in the catalog.
            </p>
            <Link href="/products" className="saas-btn-ghost text-xs inline-flex mt-2">
              Browse products
            </Link>
          </div>
        ) : (
          <div className={styles.grid}>
            {categories.map((cat, idx) => (
              <CategoryCard key={cat.id} category={cat} index={idx} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
