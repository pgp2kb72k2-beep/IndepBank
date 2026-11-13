# IndepBank

> Tu banco te muestra cuánto dinero tenés; IndepBank te ayuda a saber cuánto podés usar.

Plataforma SaaS B2B para pymes. Esta versión construye el **Plan Básico**: Financial Map, Smart Allocation, Safe-to-Spend, obligaciones y alertas.

## Stack

| Capa          | Elección                                                  |
| ------------- | --------------------------------------------------------- |
| Framework     | Next.js 16 (App Router) + TypeScript strict               |
| Base de datos | PostgreSQL 16                                             |
| ORM           | Drizzle ORM + drizzle-kit (migraciones SQL versionadas)   |
| Auth          | Better Auth (email + contraseña, 2FA) — etapa 3           |
| UI            | Tailwind CSS 4 + shadcn/ui, tipografía Geist              |
| Validación    | Zod                                                       |
| Tests         | Vitest (lógica, cobertura v8) · Playwright (E2E, etapa 8) |
| Formato       | Locale `es-UY`, zona horaria `America/Montevideo`         |

## Requisitos

- Node.js 22 o superior
- pnpm 10 (`corepack enable` lo activa)
- PostgreSQL 16 (local, Docker o una base gestionada como Neon/Supabase)

## Correrlo en local

```bash
# 1. Dependencias
pnpm install

# 2. Base de datos (opción Docker)
docker run --name indepbank-db -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16
docker exec indepbank-db createdb -U postgres indepbank_dev
docker exec indepbank-db createdb -U postgres indepbank_test

# 3. Variables de entorno
cp .env.example .env.local     # completá los valores
export $(grep -v '^#' .env.local | xargs)   # o usá direnv / dotenv-cli

# 4. Verificar conexión y aplicar migraciones
pnpm db:check
pnpm db:migrate               # crea las tablas en indepbank_dev

# 5. Levantar la app
pnpm dev                      # http://localhost:3000
```

El seed de desarrollo (caso Distribuidora Sur) se agrega en la etapa 8: `pnpm db:seed`.

## Scripts

| Comando              | Qué hace                                                   |
| -------------------- | ---------------------------------------------------------- |
| `pnpm dev`           | Servidor de desarrollo                                     |
| `pnpm build`         | Build de producción                                        |
| `pnpm typecheck`     | Chequeo de tipos (TS strict)                               |
| `pnpm lint`          | ESLint                                                     |
| `pnpm format`        | Formatea todo con Prettier                                 |
| `pnpm test`          | Tests unitarios (Vitest)                                   |
| `pnpm test:coverage` | Tests + cobertura (el motor exige 100%)                    |
| `pnpm check`         | Tipos + lint + formato + tests: correlo antes de commitear |
| `pnpm db:generate`   | Genera una migración a partir de `src/db/schema.ts`        |
| `pnpm db:migrate`    | Aplica migraciones pendientes                              |
| `pnpm db:check`      | Verifica la conexión a la base                             |

## Publicar (Vercel + Neon)

1. Creá una base en [neon.tech](https://neon.tech) y copiá la connection string.
2. En [vercel.com](https://vercel.com), importá este repositorio y cargá las variables `DATABASE_URL`, `BETTER_AUTH_SECRET` (32+ caracteres al azar) y `APP_URL` (la URL pública).
3. Deploy. Vercel corre `pnpm vercel-build`, que **aplica las migraciones pendientes** y después hace el build. Cada rama genera su propio link de prueba.

## Seguridad (cómo está armada)

- **Login:** Better Auth con email + contraseña (mínimo 10 caracteres, guardada con hash) y 2FA opcional por app de autenticación. Bloqueo tras 5 intentos por minuto en login, registro y 2FA.
- **Cookies:** `HttpOnly`, `SameSite=Lax` y `Secure` en producción.
- **Aislamiento entre empresas:** todo acceso a datos pasa por `src/server/scoped.ts`, que filtra por `organizationId`, controla el rol y registra auditoría en la misma transacción. Una regla de ESLint impide importar la base de datos fuera de `src/server`. Además, la base usa claves foráneas compuestas `(organization_id, id)`: aunque alguien se salteara la app, Postgres no deja vincular datos de dos empresas.
- **Roles:** `owner` (todo), `admin` (todo menos dueños y borrar la empresa), `viewer` (solo lectura). Siempre queda al menos un dueño.
- **Rutas protegidas:** `src/proxy.ts` redirige rápido si no hay cookie; la verificación real (sesión en base + membresía + rol) se hace en el servidor en cada página y acción.

## Estructura

```
src/
  app/            Rutas (App Router). UI en español rioplatense.
  components/ui/  Componentes shadcn/ui
  db/             Esquema y cliente Drizzle (solo servidor)
  server/         Capa de datos con aislamiento por empresa, permisos, auditoría y sesión
  lib/engine/     Motor de cálculo: TypeScript puro, sin DB ni React (etapa 2)
  env.ts          Variables de entorno validadas con Zod
drizzle/          Migraciones SQL generadas
tests/integration Tests contra una base Postgres real
scripts/          Utilidades de línea de comandos
```

## Convenciones

- Código, tablas, variables y commits en inglés; interfaz en español rioplatense.
- Dinero siempre en enteros de unidades menores (centésimos, `bigint`). Nunca `float`.
- Toda consulta se filtra por `organizationId`.
- Nada de datos financieros en logs.
- Decisiones abiertas marcadas en el código con `// DECISION:`.
