import Link from 'next/link';
import { ArrowRight, Package } from 'lucide-react';
import { RemoteImage } from '@/components/ui/RemoteImage';
import styles from './categories.module.css';

export type CategoryCardData = {
  id: string;
  name: string;
  productCount?: number;
  imageUrl?: string | null;
};

function formatIndex(index: number): string {
  return String(index + 1).padStart(2, '0');
}

type CategoryCardProps = {
  category: CategoryCardData;
  index: number;
};

export default function CategoryCard({ category, index }: CategoryCardProps) {
  const count = category.productCount ?? 0;
  const imageSrc = category.imageUrl?.trim() || null;

  return (
    <Link
      href={`/products?category=${category.id}`}
      className={styles.card}
      aria-label={`Browse ${category.name}`}
    >
      <div className={styles.index}>{formatIndex(index)}</div>

      <div className={styles.copy}>
        <h2 className={styles.categoryTitle}>{category.name}</h2>
        <span className={styles.rule} aria-hidden="true" />
      </div>

      <div className={styles.media}>
        {imageSrc ? (
          <RemoteImage
            src={imageSrc}
            alt={category.name}
            sizes="(max-width: 768px) 100vw, 33vw"
            objectFit="contain"
          />
        ) : (
          <div className="flex h-full min-h-[160px] w-full items-center justify-center bg-[#F3F4F6] text-[#9CA3AF]">
            <Package className="h-10 w-10" aria-hidden />
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <span className={styles.count}>
          {count} {count === 1 ? 'product' : 'products'}
        </span>
        <span className={styles.cta}>
          Browse <ArrowRight className="inline h-3.5 w-3.5" aria-hidden />
        </span>
      </div>
    </Link>
  );
}
