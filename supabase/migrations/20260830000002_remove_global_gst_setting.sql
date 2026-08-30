-- Migration: 20260830000002_remove_global_gst_setting.sql
-- Description: Remove the global default_gst_rate column from business_settings table.
-- Per-product GST (gst_rate and gst_included on products table) is the sole source of truth.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'business_settings' 
      AND column_name = 'default_gst_rate'
  ) THEN
    ALTER TABLE public.business_settings DROP COLUMN default_gst_rate;
  END IF;
END $$;
