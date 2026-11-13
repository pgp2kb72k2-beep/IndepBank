import Link from "next/link";
import { Suspense } from "react";
import { NavLink } from "@/components/nav-link";
import { SignOutButton } from "@/components/sign-out-button";
import { getOrganization } from "@/server/organizations";
import { requireAppContext } from "@/server/session";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
          <Link href="/app" className="text-brand-cyan text-sm font-medium tracking-wide">
            IndepBank
          </Link>
          <nav className="-mx-1 flex flex-1 gap-1 overflow-x-auto" aria-label="Principal">
            <NavLink href="/app" exact>
              Inicio
            </NavLink>
            <NavLink href="/app/configuracion">Configuración</NavLink>
          </nav>
          <Suspense fallback={null}>
            <OrgName />
          </Suspense>
          <SignOutButton />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}

async function OrgName() {
  const ctx = await requireAppContext();
  const org = await getOrganization(ctx);
  return (
    <span className="text-muted-foreground hidden max-w-48 truncate text-sm md:inline">
      {org.name}
    </span>
  );
}
