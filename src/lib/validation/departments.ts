import { z } from "zod";

export const MAX_DEPARTMENTS = 20;

export const DEPARTMENT_ICONS = [
  "briefcase",
  "package",
  "landmark",
  "truck",
  "megaphone",
  "shield",
  "store",
  "users",
  "wrench",
  "laptop",
  "building",
  "piggy-bank",
] as const;

export const DEPARTMENT_COLORS = [
  "#1A5CFF",
  "#00D5F0",
  "#7C5CFF",
  "#2BC48A",
  "#F5A524",
  "#FF6B8B",
  "#9AA0C3",
  "#4FD1C5",
] as const;

const cents = z.bigint().min(0n).max(1_000_000_000_000n); // up to 10.000 million

export const departmentInputSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1).max(40),
  color: z.enum(DEPARTMENT_COLORS),
  icon: z.enum(DEPARTMENT_ICONS),
  percentBp: z.int().min(0).max(10_000),
  minimumReserve: cents,
});

/** Full list of active departments, in display order. Missing existing ones are deactivated. */
export const saveDepartmentsSchema = z
  .object({
    departments: z.array(departmentInputSchema).min(1).max(MAX_DEPARTMENTS),
    recalculateCurrentPeriod: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    const total = value.departments.reduce((sum, d) => sum + d.percentBp, 0);
    if (total !== 10_000) {
      ctx.addIssue({ code: "custom", path: ["departments"], message: "sum_not_100" });
    }
    const names = value.departments.map((d) => d.name.toLocaleLowerCase("es"));
    if (new Set(names).size !== names.length) {
      ctx.addIssue({ code: "custom", path: ["departments"], message: "duplicate_name" });
    }
  });

export const reservesSchema = z.record(z.uuid(), cents);

export const classificationRuleSchema = z.object({
  matchText: z.string().trim().min(2).max(100),
  departmentId: z.uuid(),
  priority: z.int().min(0).max(1000).default(0),
});

export type DepartmentInput = z.infer<typeof departmentInputSchema>;
export type SaveDepartmentsInput = z.input<typeof saveDepartmentsSchema>;
export type ClassificationRuleInput = z.input<typeof classificationRuleSchema>;

/** Suggested setup from the product brief. */
export const DEPARTMENT_TEMPLATE: Omit<DepartmentInput, "id">[] = [
  { name: "Operaciones", percentBp: 3500, icon: "briefcase", color: "#1A5CFF", minimumReserve: 0n },
  { name: "Inventario", percentBp: 2500, icon: "package", color: "#00D5F0", minimumReserve: 0n },
  { name: "Impuestos", percentBp: 2000, icon: "landmark", color: "#7C5CFF", minimumReserve: 0n },
  { name: "Logística", percentBp: 1000, icon: "truck", color: "#2BC48A", minimumReserve: 0n },
  { name: "Marketing", percentBp: 500, icon: "megaphone", color: "#F5A524", minimumReserve: 0n },
  { name: "Reservas", percentBp: 500, icon: "shield", color: "#9AA0C3", minimumReserve: 0n },
];

const payloadSchema = z.array(
  departmentInputSchema.extend({ minimumReserve: z.string().regex(/^\d+$/) }),
);

/** Parses the editor's hidden JSON payload (reserves travel as cent strings). */
export function parseDepartmentsPayload(json: string): DepartmentInput[] {
  return payloadSchema
    .parse(JSON.parse(json))
    .map((d) => ({ ...d, minimumReserve: BigInt(d.minimumReserve) }));
}
