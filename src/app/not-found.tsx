import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-6 py-24">
      <p className="text-brand-cyan text-sm font-medium">Error 404</p>
      <h1 className="text-2xl font-semibold tracking-tight">No encontramos esta página</h1>
      <p className="text-muted-foreground">
        Puede que el enlace esté mal o que la página ya no exista.
      </p>
      <div>
        <Button asChild>
          <Link href="/app">Ir al inicio</Link>
        </Button>
      </div>
    </main>
  );
}
