import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/server/auth/get-session";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

function cartRedirectWithPrefill(searchParams: SearchParams): string {
  const product = firstParam(searchParams.product);
  const qty = firstParam(searchParams.qty) || firstParam(searchParams.quantity);
  const params = new URLSearchParams();
  if (product) params.set("product", product);
  if (qty) params.set("qty", qty);
  const qs = params.toString();
  return qs ? `/cart?${qs}` : "/cart";
}

/** RFQ entry: customers go to cart; guests go to cart (submit gated). */
export default async function RfqPage(
  props: {
    searchParams: Promise<SearchParams>;
  }
) {
  const searchParams = await props.searchParams;
  const session = await getServerSession();
  const cartTarget = cartRedirectWithPrefill(searchParams);

  if (session?.profile.role === "admin") {
    redirect("/admin/rfqs");
  }

  if (session?.profile.role === "supplier") {
    redirect("/supplier/orders");
  }

  redirect(cartTarget);
}
