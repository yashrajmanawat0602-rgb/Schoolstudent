# GitHub & Cloud Deployment Guide

## 1. GitHub Repository Workflow
Recommended branches:
- `main`: Production-ready releases
- `development`: Integration branch
- `feature/*`: Feature branches (e.g. `feature/marks-csv-import`, `feature/attendance-calendar`)

```bash
git init
git add .
git commit -m "feat: initial SchoolConnect full-stack platform"
git branch -M main
git remote add origin https://github.com/<your-org>/schoolconnect.git
git push -u origin main
```

## 2. Environment Variables
Configure the following in your cloud hosting environment (never commit secrets):
- `SQL_HOST`, `SQL_DB_NAME`, `SQL_USER`, `SQL_PASSWORD`
- `SQL_ADMIN_USER`, `SQL_ADMIN_PASSWORD` (for Drizzle migrations)
- `AUTH_SECRET` (optional override for HMAC session signing)
- `APP_URL`

## 3. Build & Production Launch
```bash
npm install
npm run build
npm run start
```

## 4. Deploying on Render (Blueprint)
This repository includes a `render.yaml` Blueprint at the repository root that automatically provisions:
- A managed PostgreSQL database (`schoolstudent-db`)
- The Node.js web service (`schoolstudent`) with Vite production build, automatic Drizzle schema push (`npm run db:push`), health check (`/api/health`), and auto-generated `AUTH_SECRET`.

Push `render.yaml` (and your latest code) to your GitHub `main` branch, then click **Retry** / **Apply** in the Render Blueprint dashboard.

## 5. Production Checklist
- [ ] `DATABASE_URL` or `SQL_*` environment variables configured via Secrets Manager / Render Blueprint
- [ ] HTTPS enforced by cloud load balancer / Render / Cloud Run
- [ ] Database schema applied via Drizzle Kit (`npm run db:push`)
- [ ] Automated tests passing (`npm test`) and TypeScript clean (`npm run lint`)
- [ ] Demo accounts replaced or disabled before onboarding live student records

