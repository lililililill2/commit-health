import Link from 'next/link';

export function MenuPlaceholderPage({ title }: { title: string }) {
  return (
    <main className="mx-auto w-full max-w-6xl">
      <Link
        href="/"
        className="inline-flex min-h-11 cursor-pointer items-center text-sm text-white/70 transition-colors hover:text-[#7db8ff] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7db8ff]"
      >
        ← 메인으로
      </Link>
      <h1 className="mt-8 text-2xl font-medium">{title}</h1>
    </main>
  );
}
