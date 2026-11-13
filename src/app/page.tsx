import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-8 px-6 py-24">
      <span className="text-brand-cyan text-sm font-medium tracking-wide">IndepBank</span>
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
        Tu banco te muestra cuánto dinero tenés.
        <br />
        <span className="text-muted-foreground">Nosotros, cuánto podés usar.</span>
      </h1>
      <p className="text-muted-foreground max-w-xl text-lg">
        Estamos construyendo el Plan Básico. Pronto vas a poder crear tu empresa desde acá.
      </p>
      <div>
        <Button size="lg" disabled>
          Crear mi empresa
        </Button>
      </div>
    </main>
  );
}
