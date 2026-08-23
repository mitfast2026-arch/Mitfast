-- Allow internal (admin-owned) products without a supplier assignment.
ALTER TABLE products ALTER COLUMN supplier_id DROP NOT NULL;

COMMENT ON COLUMN products.supplier_id IS 'Optional supplier owner; NULL = internal/admin product.';
