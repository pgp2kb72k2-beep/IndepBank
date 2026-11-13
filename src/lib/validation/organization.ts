import { z } from "zod";

export const currencySchema = z.enum(["UYU", "USD"]);
export const roleSchema = z.enum(["owner", "admin", "viewer"]);

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(2).max(100),
  baseCurrency: currencySchema,
});

export const organizationSettingsSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    openingIncomeEnabled: z.boolean(),
    horizonDays: z.int().min(1).max(365),
    upcomingDueDays: z.int().min(0).max(60),
    highUsageThresholdBp: z.int().min(1).max(10_000),
    importFileRetention: z.enum(["discard", "encrypted_30d"]),
  })
  .partial();

export const addMemberSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  role: roleSchema,
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type OrganizationSettingsInput = z.infer<typeof organizationSettingsSchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
