import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm space-y-8">
        <Link href="/" className="text-brand-cyan block text-sm font-medium tracking-wide">
          IndepBank
        </Link>
        {children}
      </div>
    </main>
  );
}
