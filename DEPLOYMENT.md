# Deployment Guide

This project is now split into two deployable apps:

- `backend`: Node.js + Express API connected to PostgreSQL/Neon.
- `frontend`: React + Vite public booking website and hidden admin portal.

## Backend on Vercel

Set the backend project root to `backend`.

Build command:

```bash
npm install
```

Local start command:

```bash
npm start
```

Vercel will use `backend/api/index.js` with `backend/vercel.json` for serverless deployment.

Required environment variables:

```bash
DATABASE_URL=your_neon_postgresql_url
JWT_SECRET=use-a-long-random-production-secret
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
FRONTEND_URL=https://your-frontend-domain.vercel.app
```

Optional:

```bash
GOOGLE_MAPS_API_KEY=your_google_maps_key
```

The backend runs migrations automatically on startup and can also be migrated manually with:

```bash
npm run migrate
```

## Frontend on Vercel

Set the frontend project root to `frontend`.

Build command:

```bash
npm run build
```

Output directory:

```bash
dist
```

Required environment variable:

```bash
VITE_API_URL=https://your-backend-domain.vercel.app
```

## Hidden Admin

The admin page is intentionally not shown in public navigation.

Open:

```text
/#/staff-login
```

Current temporary credentials:

```text
admin / admin123
```

Change these before public launch by updating backend environment variables and rotating the database admin password hash.
