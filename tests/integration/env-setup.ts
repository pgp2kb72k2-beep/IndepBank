// Runs before every integration test file, before any app module is imported.
const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL is required for integration tests (see .env.example)");

process.env.DATABASE_URL = url;
process.env.BETTER_AUTH_SECRET ??= "integration-tests-secret-not-for-production";
