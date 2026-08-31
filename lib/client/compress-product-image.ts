'use client';

/**
 * Client-side WebP compressor for product images.
 *
 * Target: 300–400 KB WebP with starting quality ~85%.
 * Preserves native dimensions, aspect ratio, and EXIF orientation.
 * High safety ceiling (4096px) prevents browser tab crashes on massive (>50MP) raw inputs.
 */

const TARGET_MAX_BYTES = 400 * 1024; // 400 KB
const HARD_CEILING_BYTES = 450 * 1024; // 450 KB
const MAX_SAFETY_DIMENSION = 4096; // Purely for memory crash prevention
const MAX_INPUT_FILE_BYTES = 30 * 1024 * 1024; // 30 MB source limit

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const QUALITY_STEPS = [0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.55];

export type CompressionProgressCallback = (stage: 'loading' | 'compressing' | 'done') => void;

function sanitizeWebpFileName(originalName: string): string {
  const base = originalName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '_') || 'product_image';
  return `${base}.webp`;
}

type DrawableSource = {
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, dw: number, dh: number) => void;
  cleanup: () => void;
};

async function loadDrawableSource(file: File): Promise<DrawableSource> {
  // Try createImageBitmap first for optimal performance and automatic EXIF orientation
  if (typeof window !== 'undefined' && typeof window.createImageBitmap === 'function') {
    try {
      const bitmap = await window.createImageBitmap(file, { imageOrientation: 'from-image' });
      return {
        width: bitmap.width,
        height: bitmap.height,
        draw: (ctx, dw, dh) => {
          ctx.drawImage(bitmap, 0, 0, dw, dh);
        },
        cleanup: () => {
          bitmap.close();
        },
      };
    } catch {
      // Fallback to HTMLImageElement below if createImageBitmap fails
    }
  }

  return new Promise<DrawableSource>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;

      if (!width || !height) {
        URL.revokeObjectURL(url);
        reject(new Error('Invalid or corrupted image: missing dimensions.'));
        return;
      }

      resolve({
        width,
        height,
        draw: (ctx, dw, dh) => {
          ctx.drawImage(img, 0, 0, dw, dh);
        },
        cleanup: () => {
          URL.revokeObjectURL(url);
        },
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to load "${file.name}". Please ensure it is a valid image.`));
    };

    img.src = url;
  });
}

async function renderCanvasToWebpBlob(
  source: DrawableSource,
  targetWidth: number,
  targetHeight: number,
  quality: number
): Promise<Blob> {
  if (typeof OffscreenCanvas !== 'undefined') {
    try {
      const offscreen = new OffscreenCanvas(targetWidth, targetHeight);
      const ctx = offscreen.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        source.draw(ctx, targetWidth, targetHeight);
        return await offscreen.convertToBlob({ type: 'image/webp', quality });
      }
    } catch {
      // Fallback to HTMLCanvasElement
    }
  }

  return new Promise<Blob>((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Canvas 2D context is not supported in this browser.'));
      return;
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    source.draw(ctx, targetWidth, targetHeight);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to encode image to WebP in browser.'));
          return;
        }
        resolve(blob);
      },
      'image/webp',
      quality
    );
  });
}

/**
 * Compress a product image file in the browser to WebP format targeting 300–400 KB.
 */
export async function compressProductImageInBrowser(
  file: File,
  onProgress?: CompressionProgressCallback
): Promise<File> {
  const mime = (file.type || '').toLowerCase();

  if (file.size > MAX_INPUT_FILE_BYTES) {
    throw new Error(
      `"${file.name}" is ${(file.size / (1024 * 1024)).toFixed(1)} MB. Maximum allowed source file size is 30 MB.`
    );
  }

  if (mime && !ALLOWED_MIME_TYPES.has(mime)) {
    throw new Error(
      `"${file.name}" has an unsupported format (${file.type}). Please select a JPEG, PNG, or WebP image.`
    );
  }

  onProgress?.('loading');
  const source = await loadDrawableSource(file);

  try {
    onProgress?.('compressing');

    let currentWidth = source.width;
    let currentHeight = source.height;

    // Safety handling for extreme massive dimensions (>4096px) to protect browser memory
    const maxDim = Math.max(currentWidth, currentHeight);
    if (maxDim > MAX_SAFETY_DIMENSION) {
      const scale = MAX_SAFETY_DIMENSION / maxDim;
      currentWidth = Math.round(currentWidth * scale);
      currentHeight = Math.round(currentHeight * scale);
    }

    // Step 1: Iterate through progressive quality steps at native dimensions
    let bestBlob: Blob | null = null;

    for (const quality of QUALITY_STEPS) {
      const blob = await renderCanvasToWebpBlob(source, currentWidth, currentHeight, quality);
      bestBlob = blob;

      // If within target 300–400 KB (or <= 400 KB), stop early to preserve maximum fidelity
      if (blob.size <= TARGET_MAX_BYTES) {
        break;
      }
    }

    // Step 2: If still above HARD_CEILING_BYTES (450 KB) after quality reduction (e.g. high-frequency noise),
    // apply slight dimension scaling steps to safely satisfy the hard cap without severe compression artifacts.
    if (bestBlob && bestBlob.size > HARD_CEILING_BYTES) {
      let scaleDown = 0.9;
      for (let attempt = 0; attempt < 3; attempt++) {
        const scaledWidth = Math.round(currentWidth * scaleDown);
        const scaledHeight = Math.round(currentHeight * scaleDown);
        const blob = await renderCanvasToWebpBlob(source, scaledWidth, scaledHeight, 0.75);
        bestBlob = blob;
        if (blob.size <= TARGET_MAX_BYTES) {
          break;
        }
        scaleDown -= 0.1;
      }
    }

    if (!bestBlob) {
      throw new Error(`Failed to compress "${file.name}".`);
    }

    onProgress?.('done');

    const outputFileName = sanitizeWebpFileName(file.name);
    return new File([bestBlob], outputFileName, {
      type: 'image/webp',
      lastModified: Date.now(),
    });
  } finally {
    source.cleanup();
  }
}

export { TARGET_MAX_BYTES, HARD_CEILING_BYTES, MAX_SAFETY_DIMENSION };
