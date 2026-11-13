"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Link that highlights itself when the current path is inside `href`. */
export function NavLink({
  href,
  exact = false,
  children,
  className,
}: {
  href: string;
  exact?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-md px-3 py-1.5 text-sm whitespace-nowrap transition-colors",
        active ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      {children}
    </Link>
  );
}
