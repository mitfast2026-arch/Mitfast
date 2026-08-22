import { redirect } from 'next/navigation';

export default function SupplierRegisterPage() {
  redirect('/auth?role=supplier&mode=register');
}
