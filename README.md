# Industrial Automation Quoter

Phase 1 MVP for creating professional quotes for PLC programming, HMI programming, electrical panel design, AutomationDirect components, sensors and actuators, installation, commissioning, and engineering services.

## Stack

- Frontend: Vue 3, Vite, TypeScript, Element Plus, Pinia, Vue Router, Axios, jsPDF, jspdf-autotable
- Backend: Node.js, Fastify, RethinkDB
- Database: RethinkDB tables with UUID primary keys

## Project Structure

```text
/frontend
/backend
/README.md
```

The corporate logo is located at:

```text
frontend/src/assets/brand/logo.png
```

The current logo was copied from:

```text
Manual De Imagen Sistemas Mecatronicosc/logo.png
```

## Setup

Install dependencies:

```bash
npm install
```

Start RethinkDB:

```bash
rethinkdb
```

Initialize the database and seed default service rates:

```bash
npm run init:db
```

Start the backend:

```bash
npm run dev:backend
```

Start the frontend in another terminal:

```bash
npm run dev:frontend
```

Reset the app services on this server:

```bash
./scripts/reset-server.sh
```

Useful variants:

```bash
./scripts/reset-server.sh --hard
./scripts/reset-server.sh --backend-only
./scripts/reset-server.sh --frontend-only
```

Open the frontend at:

```text
http://localhost:5173
```

The backend listens on:

```text
http://localhost:3000
```

## Environment

Backend defaults:

```text
RETHINKDB_HOST=localhost
RETHINKDB_PORT=28015
RETHINKDB_DB=automation_quotes
PORT=3000
HOST=0.0.0.0
```

## Phase 1 Features

- Dashboard with total quotes, draft quotes, approved quotes, total quoted amount, and recent quotes.
- Customer CRUD.
- Project CRUD.
- Quote CRUD, quote duplication, status changes, and PDF export.
- Guided quote assistant using Element Plus Steps.
- Manual bill of materials entry.
- Manual labor/service item entry.
- Service rate management.
- Reusable quote calculation engine.
- Local settings for company profile data used in PDF proposals.
- Placeholder AutomationDirect service architecture for future Product API or XLSX price-list imports.

## PDF Quotes

Create or edit a quote, then use **Export PDF**. The generated proposal includes:

- Corporate logo
- Company information
- Customer information
- Project information
- Scope of work
- Bill of materials
- Labor/services
- Commercial summary
- Delivery time
- Payment terms
- Quote validity
- Exclusions
- Notes
- Total price

## AutomationDirect Integration

The file `frontend/src/services/automationDirectService.js` contains placeholder functions:

- `searchProductByPartNumber(partNumber)`
- `getProductPrice(partNumber)`
- `getProductStock(partNumber)`
- `importPriceListFromXlsx(file)`

These functions are intentionally not connected to a live API in Phase 1.

## Phase 2 Additions

Phase 2 adds internal login and a supplier-agnostic product catalog for BOM creation.

Default seeded login after running `npm run init:db`:

```text
Email: admin@sistemasmecatronicos.com
Password: ChangeMe123!
```

For deployment, set these environment variables before initializing the database:

```text
INITIAL_USER_EMAIL=admin@sistemasmecatronicos.com
INITIAL_USER_PASSWORD=replace-with-a-strong-password
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=8h
```

Product catalog features:

- Manual product CRUD at `/products`.
- XLSX import from the Products page.
- Quote BOM rows can be populated from catalog products.
- Manual BOM entry remains available.

Accepted XLSX columns:

```text
partNumber, description, brand, supplier, category, unitCost, currency, stock, leadTime, datasheetUrl, notes
```

The import upserts by `supplier + partNumber` and returns created, updated, skipped, and row-level validation errors.

## Multi-contact customers and client email

Customers now support multiple contacts with one primary contact.

Quote emails use SMTP from the backend. Configure these environment variables outside git:

```text
APP_URL=https://cotizar.sistemasmecatronicos.com
SMTP_HOST=mail.sistemasmecatronicos.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=saulo.rdz@sistemasmecatronicos.com
SMTP_PASS=your-mail-password
SMTP_FROM_EMAIL=saulo.rdz@sistemasmecatronicos.com
SMTP_FROM_NAME=Sistemas Mecatronicos
```

After configuring the backend environment, restart the backend service:

```bash
./scripts/reset-server.sh --backend-only
```
