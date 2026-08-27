import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const target = join(process.cwd(), 'types', 'database.ts');
const marker = '// Convenience aliases (preserved across types:gen';
const block = `
// Convenience aliases (preserved across types:gen — see scripts/append-database-enums.ts)
export type UserRole = Enums<'user_role'>;
export type SupplierStatus = Enums<'supplier_status'>;
export type ProductApprovalStatus = Enums<'product_approval_status'>;
export type ProductPublicationStatus = Enums<'product_publication_status'>;
export type ProductArchiveStatus = Enums<'product_archive_status'>;
export type CategoryStatus = Enums<'category_status'>;
export type ProfitType = Enums<'profit_type'>;
export type EnquiryStatus = Enums<'enquiry_status'>;
export type RfqStatus = Enums<'rfq_status'>;
export type OrderStatus = Enums<'order_status'>;
export type PaymentStatus = Enums<'payment_status'>;
`;

let contents = readFileSync(target, 'utf8');
const idx = contents.indexOf(marker);
if (idx !== -1) {
  contents = contents.slice(0, idx).replace(/\s*$/, '');
}
writeFileSync(target, contents.replace(/\s*$/, '') + block);
