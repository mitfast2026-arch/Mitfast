'use client';

import Image from 'next/image';
import { isLikelyImageUrl, isNextImageHost } from '@/lib/image-url';

type RemoteImageProps = {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  objectFit?: 'cover' | 'contain';
};

export function RemoteImage({
  src,
  alt,
  className = '',
  sizes = '100vw',
  priority = false,
  objectFit = 'cover',
}: RemoteImageProps) {
  if (!isLikelyImageUrl(src)) return null;

  const fitClass = objectFit === 'contain' ? 'object-contain' : 'object-cover';

  if (!isNextImageHost(src)) {
    return (
      <div className="relative h-full w-full min-h-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className={`absolute inset-0 h-full w-full ${fitClass} ${className}`.trim()}
          loading={priority ? 'eager' : 'lazy'}
        />
      </div>
    );
  }

  return (
    <div className="relative h-full w-full min-h-0">
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className={`${fitClass} ${className}`.trim()}
      />
    </div>
  );
}
