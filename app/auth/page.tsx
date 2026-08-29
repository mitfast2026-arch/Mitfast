import AuthPageClient, { type AuthSearchParams } from './AuthPageClient';

export const dynamic = 'force-dynamic';

type AuthPageProps = {
  searchParams?: Promise<AuthSearchParams>;
};

export default async function AuthPage(props: AuthPageProps) {
  const searchParams = (await props.searchParams) ?? {};
  return <AuthPageClient searchParams={searchParams} />;
}
