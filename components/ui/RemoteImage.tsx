'use client';

import Image from 'next/image';

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
  if (!src) return null;

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      className={className}
      style={{ objectFit }}
    />
  );
}
