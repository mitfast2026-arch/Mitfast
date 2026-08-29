import { revalidatePath, revalidateTag } from 'next/cache';

export function revalidateHomepageCaches() {
  revalidateTag('homepage', { expire: 0 });
  revalidatePath('/');
}

export function deferRevalidateHomepage() {
  try {
    revalidateHomepageCaches();
  } catch (error) {
    console.error('[deferRevalidateHomepage]', error);
  }
}
