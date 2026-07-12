# Sign Shop Management System — Design Doc

## Overview
A cloud-hosted system for a sign shop with two main workflows: front desk (order intake) and production (job fulfillment). Both are clients of one shared backend, so status updates sync in real time — no double entry between stations. Accessible from any device's mobile or desktop browser.

## Roles & permissions
Each employee has an individual account and one role:

- **Owner/Admin** — full access: employees, pricing, reports, integrations settings
- **Manager** — front desk + production visibility, can reassign jobs, cannot manage employees/billing
- **Front desk / Sales** — create/edit orders, take payments, view schedule
- **Production** — view assigned jobs, update job status, log materials, cannot edit pricing/customer info

Admin can deactivate any employee to instantly revoke access.

## Core data model
- **Users/Employees** — name, role, login credentials, active/inactive
- **Customers** — contact info, order history
- **Orders** — customer, line items, due date, status, total, payment status
- **Order items** — sign type, size, material, artwork file reference, quantity, price
- **Production jobs** — linked to order item, status, assigned employee, notes
- **Status log / audit trail** — who changed what, when
- **File records** — `storage_provider` (`internal` or `dropbox`), file ID/path, linked order

## Order lifecycle
`New → Design/Approval → In Production → Ready for Pickup → Completed/Invoiced`

## Design file storage
- Shop-level (not customer-level) Dropbox connection, set up once in Settings by an Admin (OAuth)
- At file save time, a checkbox lets staff choose: save to internal storage (default) or to the shop's connected Dropbox
- All file access goes through one internal "file storage" interface so the rest of the app doesn't care which provider holds a given file
- Settings shows connected/disconnected status clearly to avoid silent failures

## Tech stack
- **Frontend:** React + TypeScript (role-based views), deployed to Vercel or Netlify
- **Backend:** Node.js/Express API, deployed to Render or Railway
- **Database:** MongoDB Atlas
- **Real-time sync:** Socket.io (or similar) for live order/job status updates
- **File storage:** AWS S3 or Cloudflare R2 (internal), Dropbox API (shop-connected, optional)
- **Auth:** JWT with role claims, checked on every API route

## Deployment path
Browser (any device) → Frontend hosting (CDN) → Backend API (auth, sockets) → Database + File storage

## Rough cost estimate (grows with usage, not raw customer count)
- Starting out: ~$0–50/month
- Growing (thousands of orders/month): ~$100–150/month
- High volume / multiple locations: ~$300–600/month

## Build order (suggested)
1. Auth + roles/permissions
2. Customer & order data model + API
3. Front desk app (create/manage orders)
4. Production app (view/update jobs) + real-time sync between the two
5. File uploads to internal storage
6. Dropbox connection (Settings) + save-location checkbox
7. Deploy to staging, then production
