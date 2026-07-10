# PathshalaPro v2 — MySQL Backend (Redesign)

New MySQL + Sequelize layer lives in `backend/src/`. The legacy MongoDB API in `backend/server.js` still runs on port 5000 until the Angular app is fully migrated.

## Prerequisites

- MySQL 8+ running locally
- `CREATE DATABASE scholify CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`

## Setup

```bash
cd backend
npm install
cp .env.example .env   # set MYSQL_* credentials

npm run db:sync        # create / alter tables
npm run db:seed        # super admin + blank school shells
npm run dev:mysql      # http://localhost:5001
```

## Seed credentials

| Role | Email | Password |
|------|-------|----------|
| Super Admin | `super_admin@scholify.com` | `Admin@123` |

Reset: `npm run db:seed:force`

## API overview

### Auth
| Method | Path |
|--------|------|
| POST | `/api/auth/login` |
| GET | `/api/auth/me` |
| POST | `/api/auth/refresh` |
| POST | `/api/auth/logout` |

### Tenant resolution (public)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/tenant/resolve?subdomain=greenwood` | Subdomain → school |
| GET | `/api/tenant/schools` | Active schools for login picker |

Send tenant on school routes via:
- Header `X-School-Id: 1`
- Header `X-School-Code: SCH-001`
- Subdomain in `Host` (e.g. `greenwood.localhost:5001`)
- JWT user's `schoolId` (school users)

### Super Admin
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/super-admin/analytics` | Platform KPIs |
| GET | `/api/super-admin/schools` | All tenants |
| POST | `/api/super-admin/schools` | **Provision school + admin invite** |
| POST | `/api/super-admin/schools/:id/invite-admin` | Reset admin password |
| PATCH | `/api/super-admin/schools/:id` | Update plan / status |

### School modules (tenant-scoped CRUD)
All support `GET/POST` list/create and `GET/PUT/PATCH/DELETE /:id`:

`/api/students`, `/teachers`, `/classes`, `/sections`, `/attendance`,
`/fee-structures`, `/fee-payments`, `/exams`, `/exam-results`, `/notices`,
`/homework`, `/books`, `/book-issues`, `/transport-routes`,
`/transport-assignments`, `/broadcasts`, `/notifications`

`GET /api/dashboard/summary` — school dashboard KPIs

## Provision new school (example)

```bash
curl -X POST http://localhost:5001/api/super-admin/schools \
  -H "Authorization: Bearer <super_admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sunrise Academy",
    "code": "SCH-SUN",
    "subdomain": "sunrise",
    "city": "Mumbai",
    "plan": "pro",
    "adminName": "Sunrise Admin",
    "adminEmail": "admin@sunrise.scholify.com"
  }'
```

Response includes `invite.temporaryPassword` when you provision or reset a school admin.

## Subdomain dev

Add to `hosts` or use `*.localhost`:
- `greenwood.localhost:5001` → resolves tenant `greenwood` (after seed)

Set `SAAS_BASE_DOMAIN=scholify.local` in `.env` for production-style hosts.


