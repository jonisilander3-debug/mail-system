# Postmark Campaign Admin

Standalone mass email campaign web app built with Node.js, Express, PostgreSQL, Prisma, EJS, and Postmark.

## Features

- Admin-only login with session auth
- CSV upload with email validation, deduplication, invalid email reporting, and unsubscribe filtering
- Campaign drafting with HTML/text bodies and personalization tokens
- Mandatory test email before campaign start
- Postmark broadcast stream delivery through a PostgreSQL-backed `pg-boss` queue
- Batch sending controls with pause, resume, stop, progress tracking, and CSV result export
- Public unsubscribe endpoint with tokenized links
- Rate limiting and per-recipient send attempt logging

## Stack

- Backend: Express
- Database: PostgreSQL with Prisma ORM
- Queue/worker: `pg-boss`
- Frontend: Server-rendered EJS admin UI
- Email provider: Postmark API

## Required environment

Copy `.env.example` to `.env` and update:

- `DATABASE_URL`
- `SESSION_SECRET`
- `POSTMARK_SERVER_TOKEN`
- `POSTMARK_MESSAGE_STREAM`
- `POSTMARK_FROM_EMAIL`
- `POSTMARK_FROM_NAME`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

## Local setup

```bash
npm install
npm run db:start
npm run db:push
npx prisma generate
npm start
```

Optional dedicated worker:

```bash
npm run worker
```

## Default flow

1. Sign in with `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
2. Save sender and Postmark defaults in Settings.
3. Create a campaign.
4. Upload a CSV with `email` and optional `name`.
5. Send a test email.
6. Start the campaign after confirming the recipient count.

## Notes

- This app is intentionally standalone and does not depend on any chat platform code.
- The server can process jobs itself, or you can run the separate worker process.
- In production, prefer storing `POSTMARK_SERVER_TOKEN` in environment variables rather than only in the admin settings UI.
- For this workspace, the app can use the project-local PostgreSQL cluster in `.postgres-data` on `127.0.0.1:5433`.
