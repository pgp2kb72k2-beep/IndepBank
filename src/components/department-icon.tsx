import {
  Briefcase,
  Building2,
  Landmark,
  Laptop,
  Megaphone,
  Package,
  PiggyBank,
  Shield,
  Store,
  Truck,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  briefcase: Briefcase,
  package: Package,
  landmark: Landmark,
  truck: Truck,
  megaphone: Megaphone,
  shield: Shield,
  store: Store,
  users: Users,
  wrench: Wrench,
  laptop: Laptop,
  building: Building2,
  "piggy-bank": PiggyBank,
};

export function DepartmentIcon({
  icon,
  color,
  className,
}: {
  icon: string;
  color: string;
  className?: string;
}) {
  const Icon = ICONS[icon] ?? Briefcase;
  return (
    <span
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-md",
        className,
      )}
      style={{ backgroundColor: `${color}22`, color }}
      aria-hidden
    >
      <Icon className="size-4" />
    </span>
  );
}
