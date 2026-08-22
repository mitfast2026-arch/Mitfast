import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/server/auth/get-session';
import {
  uploadCategoryImage,
  deleteFromBucket,
} from '@/lib/server/storage/storage-service';

/**
 * POST multipart: upload category card image
 * DELETE: remove category image
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const categoryId = params.id;
    const adminClient = createAdminClient();
    const { data: category, error } = await adminClient
      .from('categories')
      .select('id, image_storage_path')
      .eq('id', categoryId)
      .single();

    if (error || !category) {
      return NextResponse.json(
        { success: false, error: { message: 'Category not found', code: 'NOT_FOUND' } },
        { status: 404 }
      );
    }

    const form = await request.formData();
    const file = form.get('file');
    if (!file || typeof file !== 'object' || !('arrayBuffer' in file)) {
      return NextResponse.json(
        { success: false, error: { message: 'file is required', code: 'VALIDATION_ERROR' } },
        { status: 400 }
      );
    }

    const f = file as File;
    const buffer = Buffer.from(await f.arrayBuffer());
    const uploaded = await uploadCategoryImage(
      categoryId,
      f.name || 'category.jpg',
      buffer,
      f.type || 'image/jpeg'
    );

    if (!uploaded.success) {
      return NextResponse.json(uploaded, { status: 400 });
    }

    if (category.image_storage_path) {
      await deleteFromBucket('category-images', category.image_storage_path);
    }

    const { error: updateError } = await adminClient
      .from('categories')
      .update({
        image_url: uploaded.data.publicUrl,
        image_storage_path: uploaded.data.storagePath,
      })
      .eq('id', categoryId);

    if (updateError) {
      return NextResponse.json(
        { success: false, error: { message: updateError.message, code: 'DATABASE_ERROR' } },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        imageUrl: uploaded.data.publicUrl,
        storagePath: uploaded.data.storagePath,
      },
    });
  } catch (error) {
    console.error('[POST /api/categories/[id]/image]', error);
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const adminClient = createAdminClient();
    const { data: category } = await adminClient
      .from('categories')
      .select('id, image_storage_path')
      .eq('id', params.id)
      .single();

    if (!category) {
      return NextResponse.json(
        { success: false, error: { message: 'Category not found', code: 'NOT_FOUND' } },
        { status: 404 }
      );
    }

    if (category.image_storage_path) {
      await deleteFromBucket('category-images', category.image_storage_path);
    }

    await adminClient
      .from('categories')
      .update({ image_url: null, image_storage_path: null })
      .eq('id', params.id);

    return NextResponse.json({ success: true, data: { deleted: true } });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
