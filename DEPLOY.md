# Production Deployment

This project is a fullstack app with:

- Express backend in `src/`
- React + Vite frontend in `frontend/`
- Prisma + PostgreSQL
- Postmark sending
- `pg-boss` queue backed by PostgreSQL

The production Docker image builds the React frontend and serves it from the Express app, so only one public app port is needed: `3001`.

## 1. Local Git Prep (Windows)

From `C:\dev\emailutskick`:

```powershell
git status
git add .
git commit -m "Prepare Docker production deployment"
git push origin main
```

Adjust branch name if you use something other than `main`.

## 2. Server Paths

Recommended target:

- `/apps/mail-system`

Alternative:

- `/app/mail-system`

Examples below use `/apps/mail-system`.

## 3. Server Commands (Ubuntu)

```bash
mkdir -p /apps
cd /apps
git clone git@github.com:jonisilander3-debug/mail-system.git
cd mail-system
cp .env.production.example .env.production
nano .env.production
docker compose up -d --build
docker compose logs -f app
```

## 4. Prisma Migrations

Prisma migrations are applied automatically when the app container starts:

```bash
npx prisma migrate deploy
```

That is already included in the container startup command.

If you want to run it manually:

```bash
docker compose exec app npx prisma migrate deploy
```

## 5. Useful Server Commands

```bash
docker compose ps
docker compose logs -f app
docker compose logs -f db
docker compose restart app
docker compose down
docker compose up -d --build
```

## 6. Nginx Proxy Manager

Create a Proxy Host:

- Domain Names: `mail.jompalompa.com`
- Scheme: `http`
- Forward Hostname / IP: `127.0.0.1`
- Forward Port: `3001`
- Websockets Support: `on`
- Block Common Exploits: `on`

Then request/attach an SSL certificate in Nginx Proxy Manager and enable:

- `Force SSL`
- `HTTP/2 Support`

## 7. Required Environment Variables

At minimum, set these in `.env.production`:

- `NODE_ENV=production`
- `HOST=0.0.0.0`
- `PORT=3001`
- `APP_BASE_URL=https://mail.jompalompa.com`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `DATABASE_URL`
- `SESSION_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

Set these if you want default Postmark values at bootstrap:

- `POSTMARK_SERVER_TOKEN`
- `POSTMARK_MESSAGE_STREAM`
- `POSTMARK_FROM_EMAIL`
- `POSTMARK_FROM_NAME`

## 8. Notes

- Only the app container exposes a host port, and only on `127.0.0.1:3001`.
- PostgreSQL stays internal to Docker Compose.
- Local Windows development is unchanged: `npm run dev` still works separately from production Docker deployment.
