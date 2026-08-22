import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/server/auth/get-session";

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

export default async function RfqPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getServerSession();
  const cartTarget = cartRedirectWithPrefill(searchParams);

  if (session?.profile.role === "customer") {
    redirect(cartTarget);
  }

  if (session?.profile.role === "admin") {
    redirect("/admin/rfqs");
  }

  if (session?.profile.role === "supplier") {
    redirect("/supplier/rfqs");
  }

  redirect(
    `/auth?role=buyer&mode=signin&redirect=${encodeURIComponent(cartTarget)}`,
  );
}
