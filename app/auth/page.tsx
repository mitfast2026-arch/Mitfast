import AuthPageClient, { type AuthSearchParams } from './AuthPageClient';

export const dynamic = 'force-dynamic';

type AuthPageProps = {
  searchParams?: AuthSearchParams;
};

export default function AuthPage({ searchParams = {} }: AuthPageProps) {
  return <AuthPageClient searchParams={searchParams} />;
}
