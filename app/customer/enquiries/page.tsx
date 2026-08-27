import { redirect } from 'next/navigation';

export default function CustomerEnquiriesRedirect() {
  redirect('/customer/quotes?tab=enquiries');
}
