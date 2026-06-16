# Airport Transfer Booking System

Production-shaped chauffeur booking platform split into:

- `backend`: Node.js, Express, PostgreSQL/Neon, admin auth, quote API, bookings, invoices.
- `frontend`: React/Vite public booking website with hidden admin portal.

## Local Backend

```bash
cd backend
npm install
npm run migrate
npm start
```

The API runs at `http://127.0.0.1:4000`.

## Local Frontend

```bash
cd frontend
npm install
npm run dev
```

The website runs at `http://127.0.0.1:5173`.

## Admin

Hidden route:

```text
/#/staff-login
```

Temporary credentials:

```text
admin / admin123
```

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md).
