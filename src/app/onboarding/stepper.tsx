import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = ["Tu empresa", "Departamentos", "Reservas"];

export function Stepper({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="flex items-center gap-2 text-sm" aria-label="Pasos">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={cn(
                "flex size-6 items-center justify-center rounded-full border text-xs",
                done && "border-primary bg-primary text-primary-foreground",
                active && "border-brand-cyan text-brand-cyan",
                !done && !active && "text-muted-foreground",
              )}
              aria-current={active ? "step" : undefined}
            >
              {done ? <Check className="size-3.5" /> : n}
            </span>
            <span className={cn("hidden sm:inline", !active && "text-muted-foreground")}>
              {label}
            </span>
            {n < STEPS.length && <span className="bg-border h-px w-6 sm:w-10" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}
