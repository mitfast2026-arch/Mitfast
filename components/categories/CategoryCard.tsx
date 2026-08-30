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
      <div className={styles.leftCol}>
        <div className={styles.topInfo}>
          <span className={styles.index}>{formatIndex(index)}</span>
          <h2 className={styles.categoryTitle} title={category.name}>
            {category.name}
          </h2>
          <span className={styles.rule} aria-hidden="true" />
        </div>

        <div className={styles.count}>
          {count} {count === 1 ? 'product' : 'products'}
        </div>
      </div>

      <div className={styles.rightCol}>
        <div className={styles.imageFrame}>
          {imageSrc ? (
            <div className={styles.imageWrapper}>
              <RemoteImage
                src={imageSrc}
                alt={category.name}
                sizes="(max-width: 640px) 120px, (max-width: 1024px) 140px, 160px"
                objectFit="contain"
              />
            </div>
          ) : (
            <div className={styles.placeholder}>
              <Package className={styles.placeholderIcon} aria-hidden="true" />
            </div>
          )}
        </div>

        <div className={styles.arrow} aria-hidden="true">
          <ArrowRight className={styles.arrowIcon} />
        </div>
      </div>
    </Link>
  );
}
