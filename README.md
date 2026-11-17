# UrbanReport

UrbanReport is a bilingual (English and Tamil) civic issue reporting and work management app. Residents can submit and track reports; administrators can review and route them; employees can update assigned work. The app uses Express, EJS, MongoDB, Bootstrap, and Cloudinary for optional photo storage.

## Requirements

- Node.js 20 or newer
- MongoDB (local or hosted)
- Cloudinary credentials to enable report photo uploads
- SMTP credentials to enable account verification and complaint resolution codes

## Run locally

1. Install packages with `npm install`.
2. Copy `.env.example` to `.env`.
3. Set `MONGODB_URI` and `SESSION_SECRET` in `.env`. Use a randomly generated session secret with at least 32 characters.
4. Add `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and optionally `SMTP_FROM` to send verification codes by email.
5. To enable photos, add `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`.
6. Start the app with `npm run dev` and visit <http://localhost:3000>.

The server connects to MongoDB before listening. `/health` reports whether the web process and database are available.

## First administrator

Set `URBANREPORT_INITIAL_ADMIN_NAME`, `URBANREPORT_INITIAL_ADMIN_EMAIL`, and `URBANREPORT_INITIAL_ADMIN_PASSWORD` in `.env`, then run `npm run seed:admin`. The seed script creates an administrator only when there is no administrator already. Remove the password from `.env` after seeding. Administrators can create and disable employee accounts in Team Members.

Residents create their own accounts at `/register`. Staff access is provisioned by an administrator.

## Features

- User portal with verified registration, profile, complaint lodging/tracking, and email-confirmed complaint closure
- Admin portal with live MongoDB counts, complaint filters and pagination, review decisions, department and employee management, and charts
- Department portal with department-only complaint assignment, employee account management, and performance summaries
- Employee portal with assigned complaints, status updates, profile management, and resident-confirmed resolution
- English/Tamil selector saved in the session
- Role-based authorization, request validation, CSRF protection, secure session storage, rate-limited authentication, and upload type/size checks

## Useful commands

- `npm run dev` — start with Node watch mode
- `npm start` — start the production server
- `npm run check` — check JavaScript syntax and compile EJS templates
- `npm run test:e2e` — exercise resident, admin, employee, and Tamil flows against a running local server and configured MongoDB
- `npm run seed:admin` — create the first administrator from `.env`
- `npm run seed:demo` — add repeatable sample departments, staff accounts, complaints, timelines, messages, and notifications for local development

Demo accounts use the shared `URBANREPORT_DEMO_PASSWORD` from `.env`. These seed records and credentials are for local development only; never seed them in production. The demo seeder does not send email.
