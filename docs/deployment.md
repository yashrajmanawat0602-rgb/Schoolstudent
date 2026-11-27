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

## 4. Production Checklist
- [ ] All `SQL_*` environment variables configured via Secrets Manager
- [ ] HTTPS enforced by cloud load balancer / Cloud Run
- [ ] Database schema applied via Drizzle Kit
- [ ] Automated tests passing (`npm test`) and TypeScript clean (`npm run lint`)
- [ ] Demo accounts replaced or disabled before onboarding live student records
