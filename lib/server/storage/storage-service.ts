import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type ObjectCannedACL,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ServerResult } from '@/lib/server/auth/get-session';

export type StorageBucket =
  | 'product-images'
  | 'category-images'
  | 'business-assets'
  | 'documents';

const LOGICAL_BUCKETS: readonly StorageBucket[] = [
  'product-images',
  'category-images',
  'business-assets',
  'documents',
] as const;

declare global {
  // eslint-disable-next-line no-var
  var __mitfastTigrisS3: S3Client | undefined;
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
}

function requireTigrisConfig(): {
  bucket: string;
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicUrlBase: string;
} {
  const bucket = process.env.TIGRIS_BUCKET_NAME?.trim();
  const endpoint = (process.env.AWS_ENDPOINT_URL_S3 || 'https://t3.storage.dev').trim();
  const region = (process.env.AWS_REGION || 'auto').trim();
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();

  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'Missing Tigris config: TIGRIS_BUCKET_NAME, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY'
    );
  }

  const publicUrlBase = (
    process.env.TIGRIS_PUBLIC_URL_BASE?.trim() || `https://${bucket}.t3.tigrisfiles.io`
  ).replace(/\/$/, '');

  return { bucket, endpoint, region, accessKeyId, secretAccessKey, publicUrlBase };
}

function getS3Client(): S3Client {
  if (globalThis.__mitfastTigrisS3) {
    return globalThis.__mitfastTigrisS3;
  }

  const { endpoint, region, accessKeyId, secretAccessKey } = requireTigrisConfig();

  const client = new S3Client({
    region,
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    forcePathStyle: false,
  });

  globalThis.__mitfastTigrisS3 = client;
  return client;
}

function objectKey(logicalBucket: StorageBucket, path: string): string {
  const clean = path.replace(/^\/+/, '');
  if (clean.startsWith(`${logicalBucket}/`)) {
    return clean;
  }
  return `${logicalBucket}/${clean}`;
}

function publicObjectUrl(key: string): string {
  const { publicUrlBase } = requireTigrisConfig();
  return `${publicUrlBase}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

function isSupabaseStorageUrl(value: string): boolean {
  return (
    value.includes('/storage/v1/object/public/') ||
    value.includes('/storage/v1/object/sign/') ||
    /\.supabase\.co\/storage\//i.test(value)
  );
}

function isTigrisPublicUrl(value: string): boolean {
  return (
    /\.t3\.tigrisfiles\.io\//i.test(value) ||
    /\.t3\.tigrisbucket\.io\//i.test(value) ||
    /\.t3\.tigrisblob\.io\//i.test(value) ||
    /\.t3\.storage\.dev\//i.test(value) ||
    /\.fly\.storage\.tigris\.dev\//i.test(value)
  );
}

function tigrisKeyFromPublicUrl(publicUrl: string): string | null {
  try {
    const url = new URL(publicUrl);
    const path = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
    if (!path) return null;
    // virtual-hosted: host is bucket.t3.tigrisfiles.io → path is the key
    if (
      /\.t3\.tigrisfiles\.io$/i.test(url.hostname) ||
      /\.t3\.tigrisbucket\.io$/i.test(url.hostname) ||
      /\.t3\.tigrisblob\.io$/i.test(url.hostname) ||
      /\.t3\.storage\.dev$/i.test(url.hostname) ||
      /\.fly\.storage\.tigris\.dev$/i.test(url.hostname)
    ) {
      return path;
    }
    // path-style fallback: /bucket/key
    const bucket = process.env.TIGRIS_BUCKET_NAME?.trim();
    if (bucket && path.startsWith(`${bucket}/`)) {
      return path.slice(bucket.length + 1);
    }
    return path;
  } catch {
    return null;
  }
}

function looksLikeTigrisKey(value: string): boolean {
  return LOGICAL_BUCKETS.some((b) => value === b || value.startsWith(`${b}/`));
}

/**
 * Uploads a file buffer to Tigris under a logical bucket prefix.
 * Public logical buckets use object ACL public-read; documents stay private.
 */
export async function uploadToBucket(
  bucket: StorageBucket,
  path: string,
  fileBuffer: Buffer | Uint8Array,
  contentType: string
): Promise<ServerResult<{ publicUrl: string; storagePath: string }>> {
  try {
    const { bucket: tigrisBucket } = requireTigrisConfig();
    const client = getS3Client();
    const key = objectKey(bucket, path);
    const body = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer);
    const isPrivateDoc = bucket === 'documents';

    await client.send(
      new PutObjectCommand({
        Bucket: tigrisBucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        ...(isPrivateDoc ? {} : { ACL: 'public-read' as ObjectCannedACL }),
      })
    );

    const publicUrl = isPrivateDoc
      ? // Placeholder until signed; callers that need a URL should use signedDocumentUrl
        publicObjectUrl(key)
      : publicObjectUrl(key);

    return {
      success: true,
      data: { publicUrl, storagePath: key },
    };
  } catch (error) {
    console.error('[uploadToBucket] Error:', error);
    const message =
      error instanceof Error && /Missing Tigris config/i.test(error.message)
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Unexpected storage error';
    return {
      success: false,
      error: {
        message,
        code: /Missing Tigris config/i.test(message) ? 'STORAGE_CONFIG_ERROR' : 'STORAGE_ERROR',
      },
    };
  }
}

/**
 * Uploads a product image buffer/blob to the product-images prefix.
 */
export async function uploadProductImage(
  supplierId: string,
  productId: string,
  fileName: string,
  fileBuffer: Buffer | Uint8Array,
  contentType: string
): Promise<ServerResult<{ publicUrl: string; storagePath: string }>> {
  const cleanFileName = sanitizeFileName(fileName);
  const path = `products/${supplierId}/${productId}/${Date.now()}_${cleanFileName}`;
  return uploadToBucket('product-images', path, fileBuffer, contentType);
}

export async function uploadCategoryImage(
  categoryId: string,
  fileName: string,
  fileBuffer: Buffer | Uint8Array,
  contentType: string
): Promise<ServerResult<{ publicUrl: string; storagePath: string }>> {
  const cleanFileName = sanitizeFileName(fileName);
  const path = `categories/${categoryId}/${Date.now()}_${cleanFileName}`;
  return uploadToBucket('category-images', path, fileBuffer, contentType);
}

export async function uploadBusinessAsset(
  folder: string,
  fileName: string,
  fileBuffer: Buffer | Uint8Array,
  contentType: string
): Promise<ServerResult<{ publicUrl: string; storagePath: string }>> {
  const cleanFolder = folder.replace(/[^a-zA-Z0-9/_-]/g, '') || 'misc';
  const cleanFileName = sanitizeFileName(fileName);
  const path = `${cleanFolder}/${Date.now()}_${cleanFileName}`;
  return uploadToBucket('business-assets', path, fileBuffer, contentType);
}

export async function uploadEnquiryDocument(
  enquiryId: string,
  fileName: string,
  fileBuffer: Buffer | Uint8Array,
  contentType: string
): Promise<ServerResult<{ publicUrl: string; storagePath: string }>> {
  const cleanFileName = sanitizeFileName(fileName);
  const path = `enquiries/${enquiryId}/${Date.now()}_${cleanFileName}`;
  const uploaded = await uploadToBucket('documents', path, fileBuffer, contentType);
  if (!uploaded.success) return uploaded;

  const signed = await signedDocumentUrl(uploaded.data.storagePath, 60 * 60 * 24 * 7);
  return {
    success: true,
    data: {
      publicUrl: signed || uploaded.data.publicUrl,
      storagePath: uploaded.data.storagePath,
    },
  };
}

async function signedTigrisUrl(key: string, expiresInSeconds: number): Promise<string | null> {
  try {
    const { bucket } = requireTigrisConfig();
    const client = getS3Client();
    return await getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
      { expiresIn: expiresInSeconds }
    );
  } catch (error) {
    console.error('[signedTigrisUrl] Error:', error);
    return null;
  }
}

async function signedSupabaseDocumentUrl(
  storagePath: string,
  expiresInSeconds: number
): Promise<string | null> {
  try {
    const adminClient = createAdminClient();
    const { data, error } = await adminClient.storage
      .from('documents')
      .createSignedUrl(storagePath, expiresInSeconds);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}

/**
 * Refresh a signed URL for a documents path (enquiry attachments).
 * Supports Tigris keys and legacy Supabase Storage paths/URLs.
 */
export async function signedDocumentUrl(
  storagePath: string,
  expiresInSeconds = 60 * 60 * 24 * 7
): Promise<string | null> {
  if (!storagePath) return null;

  if (isSupabaseStorageUrl(storagePath)) {
    const legacyPath =
      storagePathFromPublicUrl(storagePath, 'documents') ||
      storagePath.split('/documents/').pop() ||
      storagePath;
    return signedSupabaseDocumentUrl(legacyPath, expiresInSeconds);
  }

  if (isTigrisPublicUrl(storagePath)) {
    const key = tigrisKeyFromPublicUrl(storagePath);
    if (!key) return null;
    return signedTigrisUrl(key, expiresInSeconds);
  }

  if (looksLikeTigrisKey(storagePath) || storagePath.startsWith('documents/')) {
    const key = looksLikeTigrisKey(storagePath)
      ? storagePath
      : objectKey('documents', storagePath);
    return signedTigrisUrl(key, expiresInSeconds);
  }

  // Legacy relative path in Supabase documents bucket
  return signedSupabaseDocumentUrl(storagePath, expiresInSeconds);
}

async function deleteFromSupabase(
  bucket: StorageBucket,
  storagePath: string
): Promise<ServerResult<{ deleted: boolean }>> {
  try {
    const adminClient = createAdminClient();
    const { error } = await adminClient.storage.from(bucket).remove([storagePath]);
    if (error) {
      return { success: false, error: { message: error.message, code: 'STORAGE_ERROR' } };
    }
    return { success: true, data: { deleted: true } };
  } catch (error) {
    console.error('[deleteFromSupabase] Error:', error);
    return {
      success: false,
      error: { message: 'Failed to delete file from storage', code: 'INTERNAL_ERROR' },
    };
  }
}

async function deleteFromTigris(key: string): Promise<ServerResult<{ deleted: boolean }>> {
  try {
    const { bucket } = requireTigrisConfig();
    const client = getS3Client();
    await client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );
    return { success: true, data: { deleted: true } };
  } catch (error) {
    console.error('[deleteFromTigris] Error:', error);
    return {
      success: false,
      error: { message: 'Failed to delete file from storage', code: 'INTERNAL_ERROR' },
    };
  }
}

/**
 * Deletes a file from storage by path or URL (Tigris or legacy Supabase).
 */
export async function deleteFromBucket(
  bucket: StorageBucket,
  storagePath: string
): Promise<ServerResult<{ deleted: boolean }>> {
  try {
    if (!storagePath) {
      return { success: true, data: { deleted: true } };
    }

    if (isSupabaseStorageUrl(storagePath)) {
      const path =
        storagePathFromPublicUrl(storagePath, bucket) ||
        storagePath;
      return deleteFromSupabase(bucket, path);
    }

    if (isTigrisPublicUrl(storagePath)) {
      const key = tigrisKeyFromPublicUrl(storagePath);
      if (!key) {
        return { success: false, error: { message: 'Invalid Tigris URL', code: 'STORAGE_ERROR' } };
      }
      return deleteFromTigris(key);
    }

    if (looksLikeTigrisKey(storagePath)) {
      return deleteFromTigris(storagePath);
    }

    // Legacy relative path (no logical prefix) → Supabase Storage bucket
    return deleteFromSupabase(bucket, storagePath);
  } catch (error) {
    console.error('[deleteFromBucket] Error:', error);
    return {
      success: false,
      error: { message: 'Failed to delete file from storage', code: 'INTERNAL_ERROR' },
    };
  }
}

/**
 * Deletes a product image from storage.
 */
export async function deleteProductImageFromStorage(
  imagePath: string
): Promise<ServerResult<{ deleted: boolean }>> {
  return deleteFromBucket('product-images', imagePath);
}

/**
 * Extract storage path from a same-project public Storage URL (Supabase or Tigris), if possible.
 */
export function storagePathFromPublicUrl(
  publicUrl: string,
  bucket: StorageBucket
): string | null {
  try {
    if (isTigrisPublicUrl(publicUrl)) {
      return tigrisKeyFromPublicUrl(publicUrl);
    }

    const marker = `/storage/v1/object/public/${bucket}/`;
    const idx = publicUrl.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(publicUrl.slice(idx + marker.length));
  } catch {
    return null;
  }
}
