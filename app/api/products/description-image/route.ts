import { NextResponse, type NextRequest } from 'next/server';
import { getServerSession, unauthorizedResponse, forbiddenResponse } from '@/lib/server/auth/get-session';
import { uploadBusinessAsset } from '@/lib/server/storage/storage-service';
import sharp from 'sharp';

export const runtime = 'nodejs';
export const maxDuration = 60;

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) return unauthorizedResponse();

    const role = session.profile.role;
    if (role !== 'admin' && !(role === 'supplier' && session.supplier?.status === 'active')) {
      return forbiddenResponse();
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: { message: 'Image file is required', code: 'VALIDATION_ERROR' } },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: { message: 'Only JPEG, PNG, WebP, and GIF images are allowed', code: 'INVALID_FILE_TYPE' },
        },
        { status: 400 }
      );
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: { message: 'Image size must be 5MB or less', code: 'PAYLOAD_TOO_LARGE' } },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let finalBuffer: Buffer = buffer;
    let finalContentType = file.type;
    let fileName = file.name || 'image.webp';

    // Optimize raster images (except animated GIFs)
    if (file.type !== 'image/gif') {
      try {
        finalBuffer = await sharp(buffer)
          .resize(1400, 1400, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 82 })
          .toBuffer();
        finalContentType = 'image/webp';
        fileName = fileName.replace(/\.[^.]+$/, '') + '.webp';
      } catch (err) {
        console.warn('Sharp optimization failed, using original buffer:', err);
        finalBuffer = buffer;
      }
    }

    const uploadRes = await uploadBusinessAsset(
      'description-images',
      fileName,
      finalBuffer,
      finalContentType
    );

    if (!uploadRes.success) {
      return NextResponse.json(uploadRes, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        url: uploadRes.data.publicUrl,
        storagePath: uploadRes.data.storagePath,
      },
    });
  } catch (error) {
    console.error('[POST /api/products/description-image] Error:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to upload image', code: 'UPLOAD_FAILED' } },
      { status: 500 }
    );
  }
}
