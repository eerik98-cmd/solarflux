# CLAUDE.md

## Project Overview
SolarFlux — a Next.js solar installation management system for contractors/installers. Manages clients, inventory, quotes, documents, and installer workflows.

## Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: Firebase / Firestore
- **Auth**: bcrypt + iron-session (encrypted cookies)
- **Rich Text**: TipTap
- **PDF**: jsPDF, pdfmake
- **Docs**: docxtemplater + pizzip
- **Charts**: Recharts

## Project Structure
```
app/
  (dashboard)/          # Dashboard routes (clients, inventory, quotes, settings, installer)
    installer/          # Installer-specific workspace (jobs, reports)
  actions/              # Server actions (database.ts)
  api/                  # API routes (auth, installer)
  login/                # Login page
components/             # React components (Login, Sidebar, modals, etc.)
contexts/               # React Context providers (AppProviders, DataContext)
lib/                    # Utilities (auth.ts, session.ts)
services/               # Firebase service layer
types.ts                # Shared TypeScript types
constants.ts            # App constants
middleware.ts           # Auth middleware for route protection
scripts/                # Migration scripts (migrate-passwords.ts)
docs/                   # Documentation (AUTHENTICATION.md, FEATURES.md, QUICKSTART-AUTH.md)
```

## Commands
- `npm run dev` — Start development server
- `npm run build` — Production build
- `npm run lint` — ESLint
- `npm run migrate-passwords` — Hash plain-text passwords in Firestore

## Authentication
- Bcrypt password hashing (10 salt rounds)
- Iron-session encrypted cookies (7-day sliding expiration)
- Server-side auth via API routes (`/api/auth/login`, `/api/auth/logout`, `/api/auth/session`)
- Middleware protects all `/api/*` routes except auth endpoints
- Roles: `SUPER_ADMIN`, `ADMIN`, `INSTALLER`
- Environment secrets in `.env.local` (never commit)

## Key Patterns
- **State management**: React Context API (AppProviders, DataContext)
- **Data persistence**: Firestore via server actions in `app/actions/database.ts`
- **Client-side state**: React hooks (`useState`, `useEffect`)
- **UI theme**: Dark (slate-900 background), amber accents
- **Responsive**: Desktop-first with tablet/mobile support
- **Role-based access**: INSTALLER role has restricted permissions (no client creation, limited deletion)

## Business Domain
- **Clients**: Private (individual) or Corporate, with statuses ACTIVE/LEAD/CLOSED
- **Quotes**: Line items with auto-calculated subtotal, VAT (21%), gross total
- **Mounting structure calculator**: Auto-calculates clamps, rails, combiners, attachments from panel config and roof type
- **Document generator**: Template placeholders (`{client_name}`, `{total_gross}`, `{#items}...{/items}`) filled from client/quote data
- **Installer workflow**: Job tracking, material consumption vs quoted, barcode scanning, extra items, cost variance, completion with notes
- **Reports**: Daily work, incident, time & attendance

## Important Notes
- Never commit `.env.local`
- Prices use RON currency
- Internal IDs use `SI_` prefix with auto-incrementing numbers
- VAT rate is 21%
- Session secret must be 32+ characters
