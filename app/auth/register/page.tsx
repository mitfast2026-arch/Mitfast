import { redirect } from 'next/navigation';

export default function RegisterCustomerPage() {
  redirect('/auth?role=buyer&mode=register');
}
