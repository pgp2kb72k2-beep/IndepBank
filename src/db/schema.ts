/**
 * Database schema (Drizzle). Tables are added in stage 3 (data model & auth).
 *
 * Conventions:
 * - Money is stored as `bigint` in minor units (cents) together with a currency code.
 * - Calendar dates (transaction date, due date) use `date`, interpreted in America/Montevideo.
 * - Every business table carries `organization_id`; queries go through the org-scoped layer.
 */
export {};
