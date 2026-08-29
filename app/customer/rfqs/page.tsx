import { redirect } from 'next/navigation';

export default async function CustomerRfqsRedirect(
  props: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
  }
) {
  const searchParams = await props.searchParams;
  const qs = new URLSearchParams();
  qs.set('tab', 'rfqs');
  for (const [key, value] of Object.entries(searchParams)) {
    if (key === 'tab') continue;
    if (Array.isArray(value)) {
      value.forEach((v) => qs.append(key, v));
    } else if (value) {
      qs.set(key, value);
    }
  }
  redirect(`/customer/quotes?${qs.toString()}`);
}
