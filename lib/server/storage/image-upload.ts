import sharp from 'sharp';
import type { ServerResult } from '@/lib/server/auth/get-session';
import {
  uploadBusinessAsset,
  uploadCategoryImage,
  uploadProductImage,
} from '@/lib/server/storage/storage-service';

export type ImageUploadProfile =
  | 'product'
  | 'category'
  | 'hero'
  | 'containers'
  | 'carousel'
  | 'logo'
  | 'banner';

export type ProcessedImage = {
  buffer: Buffer;
  contentType: 'image/webp';
  fileName: string;
  width: number;
  height: number;
  bytes: number;
  passThrough: boolean;
  processingMs: number;
};

const ALLOWED_INPUT_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

type ProfileConfig = {
  maxInputBytes: number;
  maxStoredBytes: number;
  maxDimension: number;
  quality: number;
  fit: 'inside' | 'cover' | 'contain';
  width?: number;
  height?: number;
};

const PROFILE_CONFIG: Record<ImageUploadProfile, ProfileConfig> = {
  product: {
    maxInputBytes: 5 * 1024 * 1024,
    maxStoredBytes: 500 * 1024,
    maxDimension: 1600,
    quality: 82,
    fit: 'inside',
  },
  category: {
    maxInputBytes: 3 * 1024 * 1024,
    maxStoredBytes: 150 * 1024,
    maxDimension: 800,
    quality: 85,
    fit: 'inside',
  },
  hero: {
    maxInputBytes: 4 * 1024 * 1024,
    maxStoredBytes: 400 * 1024,
    maxDimension: 1920,
    quality: 85,
    fit: 'cover',
    width: 1920,
    height: 900,
  },
  containers: {
    maxInputBytes: 2 * 1024 * 1024,
    maxStoredBytes: 350 * 1024,
    maxDimension: 1560,
    quality: 85,
    fit: 'contain',
    width: 1560,
    height: 920,
  },
  carousel: {
    maxInputBytes: 2 * 1024 * 1024,
    maxStoredBytes: 120 * 1024,
    maxDimension: 820,
    quality: 85,
    fit: 'cover',
    width: 570,
    height: 820,
  },
  logo: {
    maxInputBytes: 1 * 1024 * 1024,
    maxStoredBytes: 80 * 1024,
    maxDimension: 512,
    quality: 90,
    fit: 'inside',
  },
  banner: {
    maxInputBytes: 3 * 1024 * 1024,
    maxStoredBytes: 350 * 1024,
    maxDimension: 1920,
    quality: 85,
    fit: 'inside',
    width: 1920,
  },
};

function normalizeMime(mime: string): string {
  return (mime || '').toLowerCase().split(';')[0].trim();
}

function webpFileName(originalName: string): string {
  const base = originalName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9.-]/g, '_') || 'image';
  return `${base}.webp`;
}

function dimensionsWithinLimits(
  width: number,
  height: number,
  config: ProfileConfig
): boolean {
  const longest = Math.max(width, height);
  if (longest > config.maxDimension) return false;
  if (config.width && width > config.width) return false;
  if (config.height && height > config.height) return false;
  return true;
}

async function encodeWebp(
  pipeline: ReturnType<typeof sharp>,
  quality: number,
  /** Lower effort = faster encode under concurrency spikes (product uploads). */
  effort = 2
): Promise<{ buffer: Buffer; width: number; height: number }> {
  const { data, info } = await pipeline
    .webp({ quality, effort })
    .toBuffer({ resolveWithObject: true });
  return { buffer: data, width: info.width, height: info.height };
}

export async function processImageForUpload(
  input: Buffer,
  originalFileName: string,
  contentType: string,
  profile: ImageUploadProfile
): Promise<ServerResult<ProcessedImage>> {
  const started = Date.now();
  const config = PROFILE_CONFIG[profile];
  const mime = normalizeMime(contentType);

  if (!ALLOWED_INPUT_MIME.has(mime)) {
    return {
      success: false,
      error: {
        message: 'Only JPEG, PNG, WebP, or GIF images are allowed',
        code: 'VALIDATION_ERROR',
      },
    };
  }

  if (input.byteLength > config.maxInputBytes) {
    const maxMb = (config.maxInputBytes / (1024 * 1024)).toFixed(1);
    return {
      success: false,
      error: {
        message: `Image must be ${maxMb} MB or smaller`,
        code: 'VALIDATION_ERROR',
      },
    };
  }

  try {
    const meta = await sharp(input, { animated: false }).metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;

    if (!width || !height) {
      return {
        success: false,
        error: { message: 'Invalid or corrupt image file', code: 'VALIDATION_ERROR' },
      };
    }

    const isWebP = mime === 'image/webp';
    const withinDims = dimensionsWithinLimits(width, height, config);
    const withinStored = input.byteLength <= config.maxStoredBytes;

    if (isWebP && withinDims && withinStored) {
      const processingMs = Date.now() - started;
      return {
        success: true,
        data: {
          buffer: input,
          contentType: 'image/webp',
          fileName: webpFileName(originalFileName),
          width,
          height,
          bytes: input.byteLength,
          passThrough: true,
          processingMs,
        },
      };
    }

    let pipeline = sharp(input, { animated: false }).rotate();

    if (config.width && config.height) {
      pipeline = pipeline.resize(config.width, config.height, {
        fit: config.fit,
        withoutEnlargement: true,
      });
    } else if (config.width && profile === 'banner') {
      pipeline = pipeline.resize(config.width, undefined, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    } else {
      pipeline = pipeline.resize(config.maxDimension, config.maxDimension, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    const encodeEffort = profile === 'product' ? 2 : 4;
    let encoded = await encodeWebp(pipeline, config.quality, encodeEffort);

    if (encoded.buffer.byteLength > config.maxStoredBytes) {
      encoded = await encodeWebp(
        sharp(input, { animated: false }).rotate().resize(config.maxDimension, config.maxDimension, {
          fit: 'inside',
          withoutEnlargement: true,
        }),
        Math.max(60, config.quality - 15),
        encodeEffort
      );
    }

    const hardCap = profile === 'product' ? 500 * 1024 : 2 * 1024 * 1024;
    if (encoded.buffer.byteLength > hardCap) {
      return {
        success: false,
        error: {
          message: 'Image too large after optimization; use a smaller source file',
          code: 'PAYLOAD_TOO_LARGE',
        },
      };
    }

    const processingMs = Date.now() - started;
    return {
      success: true,
      data: {
        buffer: encoded.buffer,
        contentType: 'image/webp',
        fileName: webpFileName(originalFileName),
        width: encoded.width,
        height: encoded.height,
        bytes: encoded.buffer.byteLength,
        passThrough: false,
        processingMs,
      },
    };
  } catch (error) {
    console.error('[processImageForUpload]', profile, error);
    return {
      success: false,
      error: {
        message: 'Failed to process image',
        code: 'VALIDATION_ERROR',
      },
    };
  }
}

export function imageProfileConfig(profile: ImageUploadProfile): ProfileConfig {
  return PROFILE_CONFIG[profile];
}

export async function processAndUploadProductImage(
  supplierId: string,
  productId: string,
  input: Buffer,
  originalFileName: string,
  contentType: string
): Promise<ServerResult<ProcessedImage & { publicUrl: string; storagePath: string }>> {
  const processed = await processImageForUpload(input, originalFileName, contentType, 'product');
  if (!processed.success) return processed;
  const uploaded = await uploadProductImage(
    supplierId,
    productId,
    processed.data.fileName,
    processed.data.buffer,
    processed.data.contentType
  );
  if (!uploaded.success) return uploaded;
  return {
    success: true,
    data: { ...processed.data, ...uploaded.data },
  };
}

export async function processAndUploadCategoryImage(
  categoryId: string,
  input: Buffer,
  originalFileName: string,
  contentType: string
): Promise<ServerResult<ProcessedImage & { publicUrl: string; storagePath: string }>> {
  const processed = await processImageForUpload(input, originalFileName, contentType, 'category');
  if (!processed.success) return processed;
  const uploaded = await uploadCategoryImage(
    categoryId,
    processed.data.fileName,
    processed.data.buffer,
    processed.data.contentType
  );
  if (!uploaded.success) return uploaded;
  return {
    success: true,
    data: { ...processed.data, ...uploaded.data },
  };
}

export async function processAndUploadBusinessAsset(
  folder: string,
  profile: Extract<ImageUploadProfile, 'hero' | 'containers' | 'carousel' | 'logo' | 'banner'>,
  input: Buffer,
  originalFileName: string,
  contentType: string
): Promise<ServerResult<ProcessedImage & { publicUrl: string; storagePath: string }>> {
  const processed = await processImageForUpload(input, originalFileName, contentType, profile);
  if (!processed.success) return processed;
  const uploaded = await uploadBusinessAsset(
    folder,
    processed.data.fileName,
    processed.data.buffer,
    processed.data.contentType
  );
  if (!uploaded.success) return uploaded;
  return {
    success: true,
    data: { ...processed.data, ...uploaded.data },
  };
}
