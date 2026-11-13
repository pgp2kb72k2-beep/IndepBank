import type { Metadata } from "next";
import { Suspense } from "react";
import { DepartmentIcon } from "@/components/department-icon";
import { ReadOnlyNotice } from "@/components/form-status";
import { Card, CardHeader } from "@/components/ui/card";
import { listRules } from "@/server/classification-rules";
import { getAllocationState } from "@/server/departments";
import { can } from "@/server/permissions";
import { requireAppContext } from "@/server/session";
import { DeleteRuleButton, NewRuleForm } from "./rule-forms";

export const metadata: Metadata = { title: "Reglas de clasificación" };

export default function RulesPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground text-sm">Cargando…</p>}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const ctx = await requireAppContext();
  const [rules, state] = await Promise.all([listRules(ctx), getAllocationState(ctx)]);
  const writable = can(ctx.role, "write");
  const departments = new Map(state.departments.map((d) => [d.id, d]));

  return (
    <Card>
      <CardHeader
        title="Reglas de clasificación"
        description="Cuando importes movimientos, cada egreso cuya descripción contenga el texto se asigna automáticamente al departamento. Siempre podés corregirlo a mano."
      />
      <div className="space-y-6">
        {writable ? (
          <NewRuleForm departments={state.departments.map((d) => ({ id: d.id, name: d.name }))} />
        ) : (
          <ReadOnlyNotice />
        )}
        {rules.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Todavía no hay reglas. Ejemplo: si la descripción contiene &quot;DGI&quot; → Impuestos.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {rules.map((rule) => {
              const dept = departments.get(rule.departmentId);
              return (
                <li key={rule.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                  <span className="text-muted-foreground">Si contiene</span>
                  <code className="bg-muted rounded px-1.5 py-0.5">{rule.matchText}</code>
                  <span className="text-muted-foreground">→</span>
                  {dept ? (
                    <span className="flex items-center gap-2">
                      <DepartmentIcon icon={dept.icon} color={dept.color} className="size-6" />
                      {dept.name}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Departamento inactivo</span>
                  )}
                  {rule.priority > 0 && (
                    <span className="text-muted-foreground text-xs">prioridad {rule.priority}</span>
                  )}
                  {writable && <DeleteRuleButton id={rule.id} />}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}
