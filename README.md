# Emailutskick

Standalone email campaign system built with:

- Express API
- React/Vite frontend
- Prisma + PostgreSQL
- Postmark
- `pg-boss`
- optional OpenAI-powered email assistance

## Local development

Use the current local workflow exactly as before:

```bash
npm install
npm run db:start
npm run db:push
npx prisma generate
npm run dev
```

Important local scripts:

- `npm run dev` starts API + Vite
- `npm run dev:api` starts only Express
- `npm run dev:web` starts only Vite
- `npm run start:local` starts the project-local PostgreSQL helper and then the API

## Production build

Production build now does three things:

1. builds the React frontend into `frontend/dist`
2. runs `prisma generate`
3. leaves the Express backend ready to serve the built frontend

Run:

```bash
npm run build
```

Useful production checks:

```bash
npm run deploy:check
```

## Production start

In production, Express serves the built frontend directly from `frontend/dist`.

Run:

```bash
npm run start
```

The app expects `NODE_ENV=production` and a real PostgreSQL database connection in the environment.

## Production environment

Copy:

```bash
cp .env.production.example .env
```

or on Windows:

```powershell
Copy-Item .env.production.example .env
```

Set at least:

- `DATABASE_URL`
- `SESSION_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `APP_URL`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `NODE_ENV=production`
- `POSTMARK_SERVER_TOKEN`
- `POSTMARK_MESSAGE_STREAM`
- `POSTMARK_FROM_EMAIL`

## Linux server deployment

### 1. Install Node.js

Ubuntu example:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v
npm -v
```

### 2. Install PostgreSQL or use an external database

Option A: local PostgreSQL

```bash
sudo apt update
sudo apt install -y postgresql postgresql-contrib
```

Option B: use an external managed PostgreSQL instance and only set `DATABASE_URL`.

### 3. Upload or clone the project

```bash
git clone <your-repo-url> emailutskick
cd emailutskick
```

### 4. Install dependencies

```bash
npm install
cd frontend && npm install && cd ..
```

### 5. Configure environment

```bash
cp .env.production.example .env
nano .env
```

### 6. Build the app

```bash
npm run build
```

### 7. Run database migrations

```bash
npx prisma migrate deploy
```

### 8. Start the app

```bash
npm run start
```

## PM2 setup

Install PM2:

```bash
sudo npm install -g pm2
```

Start the app:

```bash
pm2 start npm --name emailutskick -- run start
```

Persist it:

```bash
pm2 save
pm2 startup
```

After `pm2 startup`, run the command PM2 prints.

Useful PM2 commands:

```bash
pm2 status
pm2 logs emailutskick
pm2 restart emailutskick
pm2 stop emailutskick
```

## Nginx reverse proxy example

Example server block:

```nginx
server {
    listen 80;
    server_name mail.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Enable SSL with Certbot:

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
sudo certbot --nginx -d mail.example.com
```

## Safe deploy checklist

Whenever you deploy updates:

```bash
cd /path/to/emailutskick
git pull
npm install
cd frontend && npm install && cd ..
npm run build
npx prisma migrate deploy
pm2 restart emailutskick
```

## Notes

- `npm run start` is now production-oriented.
- `npm run start:local` keeps the old local helper-based startup path.
- React build output is served by Express automatically when `frontend/dist/index.html` exists.
- Local dev mode is unchanged.
