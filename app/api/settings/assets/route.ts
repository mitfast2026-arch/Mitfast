import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/server/auth/get-session';
import { updateBusinessSettings } from '@/lib/server/settings/settings-service';
import { uploadBusinessAsset } from '@/lib/server/storage/storage-service';

/**
 * POST multipart: upload logo or products banner into business-assets and persist URL.
 * Form fields: file, kind = "logo" | "banner"
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const form = await request.formData();
    const kind = String(form.get('kind') || '');
    const file = form.get('file');

    if (kind !== 'logo' && kind !== 'banner') {
      return NextResponse.json(
        { success: false, error: { message: 'kind must be logo or banner', code: 'VALIDATION_ERROR' } },
        { status: 400 }
      );
    }

    if (!file || typeof file !== 'object' || !('arrayBuffer' in file)) {
      return NextResponse.json(
        { success: false, error: { message: 'file is required', code: 'VALIDATION_ERROR' } },
        { status: 400 }
      );
    }

    const f = file as File;
    const buffer = Buffer.from(await f.arrayBuffer());
    const folder = kind === 'logo' ? 'branding' : 'catalog';
    const uploaded = await uploadBusinessAsset(
      folder,
      f.name || `${kind}.png`,
      buffer,
      f.type || 'image/png'
    );

    if (!uploaded.success) {
      return NextResponse.json(uploaded, { status: 400 });
    }

    const update =
      kind === 'logo'
        ? { logoUrl: uploaded.data.publicUrl }
        : { productsBannerUrl: uploaded.data.publicUrl };

    const result = await updateBusinessSettings(update);
    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: {
        kind,
        url: uploaded.data.publicUrl,
        storagePath: uploaded.data.storagePath,
      },
    });
  } catch (error) {
    console.error('[POST /api/settings/assets]', error);
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
