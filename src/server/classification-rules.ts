import "server-only";
import { db } from "@/db/client";
import { classificationRule, department } from "@/db/schema";
import {
  classificationRuleSchema,
  type ClassificationRuleInput,
} from "@/lib/validation/departments";
import type { Db } from "./db-types";
import { scoped, type OrgContext } from "./scoped";

export async function listRules(ctx: OrgContext, database: Db = db) {
  const rules = await scoped(ctx, database).findMany(classificationRule);
  return rules.sort(
    (a, b) => b.priority - a.priority || a.createdAt.getTime() - b.createdAt.getTime(),
  );
}

export async function createRule(
  ctx: OrgContext,
  input: ClassificationRuleInput,
  database: Db = db,
) {
  const data = classificationRuleSchema.parse(input);
  const scope = scoped(ctx, database);
  // The department must belong to this organization (NotFound otherwise).
  await scope.findById(department, "department", data.departmentId);
  return scope.create(classificationRule, "classification_rule", data);
}

export async function updateRule(
  ctx: OrgContext,
  id: string,
  input: ClassificationRuleInput,
  database: Db = db,
) {
  const data = classificationRuleSchema.parse(input);
  const scope = scoped(ctx, database);
  await scope.findById(department, "department", data.departmentId);
  return scope.update(classificationRule, "classification_rule", id, data);
}

export async function deleteRule(ctx: OrgContext, id: string, database: Db = db) {
  await scoped(ctx, database).remove(classificationRule, "classification_rule", id);
}
