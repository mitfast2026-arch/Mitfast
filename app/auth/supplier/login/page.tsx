import { redirect } from 'next/navigation';

export default function SupplierLoginPage() {
  redirect('/auth?role=supplier&mode=signin');
}
