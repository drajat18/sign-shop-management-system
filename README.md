# Sign Shop Management System

Cloud-hosted system for a sign shop with two synced workflows — front desk (order intake) and production (job fulfillment) — sharing one backend so status updates sync in real time.

See [sign-shop-system-design.md](./sign-shop-system-design.md) for the full design doc (roles, data model, order lifecycle, file storage strategy, tech stack, cost estimate).

## Project structure

```
sign-shop-app/
├── frontend/   React + TypeScript app (Vite), role-based views
└── backend/    Node.js/Express API, MongoDB, Socket.io
```

## Tech stack

- **Frontend:** React + TypeScript, deployed to Vercel/Netlify
- **Backend:** Node.js/Express API, deployed to Render/Railway
- **Database:** MongoDB Atlas
- **Real-time sync:** Socket.io
- **File storage:** Internal (S3/R2) by default, optional shop-level Dropbox connection
- **Auth:** JWT with role claims (Owner/Admin, Manager, Front desk/Sales, Production)

## Getting started

Each app has its own `package.json` and `README`-equivalent setup notes inline. From the repo root:

```bash
# Backend
cd backend
cp .env.example .env   # fill in MongoDB URI, JWT secret, etc.
npm install
npm run dev

# Frontend (in a separate terminal)
cd frontend
cp .env.example .env   # set VITE_API_URL to the backend URL
npm install
npm run dev
```

## Build order (suggested)

1. Auth + roles/permissions
2. Customer & order data model + API
3. Front desk app (create/manage orders)
4. Production app (view/update jobs) + real-time sync between the two
5. File uploads to internal storage
6. Dropbox connection (Settings) + save-location checkbox
7. Deploy to staging, then production
