import type { CategoryStatus } from '@/types/database';

export type CategoryListItem = {
  id: string;
  name: string;
  status: CategoryStatus;
  archived_at: string | null;
  created_at: string;
  image_url: string | null;
  image_storage_path: string | null;
  productCount: number;
  imageUrl: string | null;
};
