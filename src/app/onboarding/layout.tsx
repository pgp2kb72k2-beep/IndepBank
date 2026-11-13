import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 pt-6">
        <Link href="/" className="text-brand-cyan text-sm font-medium tracking-wide">
          IndepBank
        </Link>
        <SignOutButton />
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">{children}</main>
    </div>
  );
}
