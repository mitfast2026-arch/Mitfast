import { redirect } from 'next/navigation';

export default function CustomerRfqsRedirect() {
  redirect('/customer/quotes?tab=rfqs');
}
