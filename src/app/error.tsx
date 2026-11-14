"use client";

import { Button } from "@/components/ui/button";

/** Shown when a page fails unexpectedly. No technical details reach the user. */
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-6 py-24">
      <h1 className="text-2xl font-semibold tracking-tight">Algo salió mal</h1>
      <p className="text-muted-foreground">
        No pudimos cargar esta página. Probá de nuevo en unos segundos. Tus datos no se modificaron.
      </p>
      <div>
        <Button onClick={reset}>Reintentar</Button>
      </div>
    </main>
  );
}
