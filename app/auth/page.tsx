export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const params = await searchParams;
  const redirect =
    params.redirect?.startsWith("/") && !params.redirect.startsWith("//")
      ? params.redirect
      : "/";
  const loginHref = `/api/auth/google?redirect=${encodeURIComponent(redirect)}`;

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">育てるAI ログイン</h1>
      <p className="text-sm text-gray-600">tomidah.com の Google アカウントでログインしてください。</p>
      <a className="rounded bg-blue-600 px-4 py-2 text-white" href={loginHref}>Google でログイン</a>
    </main>
  );
}
