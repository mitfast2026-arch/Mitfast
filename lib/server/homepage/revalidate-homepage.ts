import { revalidatePath, revalidateTag } from 'next/cache';

export function revalidateHomepageCaches() {
  revalidateTag('homepage');
  revalidatePath('/');
}

export function deferRevalidateHomepage() {
  void Promise.resolve().then(() => {
    try {
      revalidateHomepageCaches();
    } catch (error) {
      console.error('[deferRevalidateHomepage]', error);
    }
  });
}
