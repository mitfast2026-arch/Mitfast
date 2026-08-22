import { createAdminClient } from '@/lib/supabase/admin';
import type { ServerResult } from '@/lib/server/auth/get-session';

export type StorageBucket =
  | 'product-images'
  | 'category-images'
  | 'business-assets'
  | 'documents';

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
}

/**
 * Uploads a file buffer to a public (or private) storage bucket and returns URL + path.
 */
export async function uploadToBucket(
  bucket: StorageBucket,
  path: string,
  fileBuffer: Buffer | Uint8Array,
  contentType: string
): Promise<ServerResult<{ publicUrl: string; storagePath: string }>> {
  try {
    const adminClient = createAdminClient();
    const { data, error } = await adminClient.storage.from(bucket).upload(path, fileBuffer, {
      contentType,
      upsert: false,
    });

    if (error || !data) {
      return {
        success: false,
        error: { message: error?.message || 'Failed to upload file', code: 'STORAGE_ERROR' },
      };
    }

    const { data: urlData } = adminClient.storage.from(bucket).getPublicUrl(data.path);

    return {
      success: true,
      data: { publicUrl: urlData.publicUrl, storagePath: data.path },
    };
  } catch (error) {
    console.error('[uploadToBucket] Error:', error);
    return {
      success: false,
      error: { message: 'Unexpected storage error', code: 'INTERNAL_ERROR' },
    };
  }
}

/**
 * Uploads a product image buffer/blob to the product-images bucket.
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

  // documents bucket is private — store a long-lived signed URL for authorized UIs
  try {
    const adminClient = createAdminClient();
    const { data: signed, error } = await adminClient.storage
      .from('documents')
      .createSignedUrl(uploaded.data.storagePath, 60 * 60 * 24 * 365);

    if (!error && signed?.signedUrl) {
      return {
        success: true,
        data: { publicUrl: signed.signedUrl, storagePath: uploaded.data.storagePath },
      };
    }
  } catch {
    // fall through to path-based public URL shape
  }

  return uploaded;
}

/**
 * Refresh a signed URL for a documents-bucket path (enquiry attachments).
 */
export async function signedDocumentUrl(
  storagePath: string,
  expiresInSeconds = 60 * 60 * 24 * 7
): Promise<string | null> {
  if (!storagePath) return null;
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
 * Deletes a file from a storage bucket by path.
 */
export async function deleteFromBucket(
  bucket: StorageBucket,
  storagePath: string
): Promise<ServerResult<{ deleted: boolean }>> {
  try {
    if (!storagePath) {
      return { success: true, data: { deleted: true } };
    }
    const adminClient = createAdminClient();
    const { error } = await adminClient.storage.from(bucket).remove([storagePath]);

    if (error) {
      return { success: false, error: { message: error.message, code: 'STORAGE_ERROR' } };
    }

    return { success: true, data: { deleted: true } };
  } catch (error) {
    console.error('[deleteFromBucket] Error:', error);
    return { success: false, error: { message: 'Failed to delete file from storage', code: 'INTERNAL_ERROR' } };
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
 * Extract storage path from a same-project public Storage URL, if possible.
 */
export function storagePathFromPublicUrl(
  publicUrl: string,
  bucket: StorageBucket
): string | null {
  try {
    const marker = `/storage/v1/object/public/${bucket}/`;
    const idx = publicUrl.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(publicUrl.slice(idx + marker.length));
  } catch {
    return null;
  }
}
