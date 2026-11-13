import { NavLink } from "@/components/nav-link";

const SECTIONS = [
  { href: "/app/configuracion", label: "Empresa", exact: true },
  { href: "/app/configuracion/departamentos", label: "Departamentos y reservas" },
  { href: "/app/configuracion/reglas", label: "Reglas de clasificación" },
  { href: "/app/configuracion/usuarios", label: "Usuarios" },
  { href: "/app/configuracion/seguridad", label: "Seguridad" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Configuración</h1>
      <div className="grid gap-6 md:grid-cols-[13rem_1fr]">
        <nav
          className="-mx-1 flex gap-1 overflow-x-auto md:flex-col md:overflow-visible"
          aria-label="Configuración"
        >
          {SECTIONS.map((s) => (
            <NavLink key={s.href} href={s.href} exact={s.exact}>
              {s.label}
            </NavLink>
          ))}
        </nav>
        <div className="min-w-0 space-y-6">{children}</div>
      </div>
    </div>
  );
}
