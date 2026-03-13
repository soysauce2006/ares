# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Full-stack roster management application (A.R.E.S. - Advanced Roster Execution System).

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite, Tailwind CSS, shadcn/ui, React Query, Wouter routing
- **Auth**: Session-based (httpOnly cookies), bcrypt password hashing, speakeasy TOTP MFA, QR codes via qrcode
- **Charts**: Recharts

## Application Features

- **Hierarchical Rank System**: Customizable rank levels with names, abbreviations, and ordering
- **3-Tier Org Hierarchy**: Division → Company → Squad (all tier names fully customizable by admin)
- **Roster Management**: Member profiles with username, display name, rank, squad, status, notes
- **User Accounts**: Role-based (admin/manager/viewer) with session auth; admins can change user roles
- **MFA**: TOTP-based two-factor authentication with QR codes and backup codes
- **Activity Logs**: Full audit trail of all actions
- **Dashboard**: Stats cards, bar charts for rank/squad distribution, recent activity feed
- **Site Settings** (admin only): Rename any organizational tier (e.g., "Squad" → "Fire Team", "Division" → "Battalion"), change site name/subtitle — reflected everywhere in the UI
- **Mobile Friendly**: Responsive sidebar with collapsible mobile menu

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server
│   └── roster-app/         # React + Vite frontend (A.R.E.S.)
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Database Schema

- `users` - Login accounts (username, email, passwordHash, role, mfaEnabled, mfaSecret, backupCodes, mustChangePassword)
- `ranks` - Rank levels (name, abbreviation, level/order, description)
- `org_level1` - Top-tier org units (e.g., Divisions/Battalions)
- `org_level2` - Mid-tier org units (e.g., Companies/Platoons), FK → org_level1
- `squads` - Bottom-tier org units (e.g., Squads/Teams), FK → org_level2
- `site_settings` - Key-value store for admin-configurable labels and site identity
- `roster` - Roster members (username, displayName, rankId, squadId, status, notes)
- `activity_logs` - Audit log (userId, action, entityType, entityId, details, ipAddress)
- `sessions` - Auth sessions (sessionId, userId, mfaVerified, expiresAt)
- `mfa_pending` - Temp MFA tokens during login (token, userId, expiresAt)

## API Routes

All routes under `/api/`:
- `POST /auth/register` - Create first account (auto-admin)
- `POST /auth/login` - Login
- `POST /auth/verify-mfa` - Verify MFA during login
- `POST /auth/setup-mfa` - Get MFA setup QR code
- `POST /auth/confirm-mfa` - Enable MFA
- `POST /auth/logout` - Logout
- `GET /auth/me` - Current user
- `GET/POST /users` - User management (admin only)
- `GET/PUT/DELETE /users/:id`
- `GET/POST /ranks`
- `PUT/DELETE /ranks/:id`
- `GET/POST /squads`
- `PUT/DELETE /squads/:id`
- `GET/POST /roster`
- `GET/PUT/DELETE /roster/:id`
- `GET /activity` - Activity logs (admin only)
- `GET /dashboard/stats` - Dashboard statistics

## User Roles

- `admin` - Full access to everything including user management
- `manager` - Can manage roster, ranks, squads but not user accounts
- `viewer` - Read-only access

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API client/types from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes
