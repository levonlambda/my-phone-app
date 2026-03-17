# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## CRITICAL: Live Database

The Firebase database is **live production data**. NEVER add, edit, or delete any data in Firestore, Authentication, or Cloud Storage — not via code changes, scripts, Firebase console commands, or any other means. This applies to all collections and documents without exception.

## Build & Development Commands

- **Dev server:** `npm run dev` (Vite with `--host` for network access)
- **Production build:** `npm run build`
- **Lint:** `npm run lint`
- **Preview build:** `npm run preview`

No test framework is configured.

## Architecture

This is a **React 18 + Vite** web application for phone inventory management ("Tech City Inventory System"). It uses **Firebase** (Firestore, Auth, Cloud Storage) as the backend and **Tailwind CSS** for styling.

### Path Alias

`@` is aliased to `./src` in `vite.config.js`.

### Navigation

There is no React Router. Navigation is handled via an `activeComponent` string in `GlobalStateContext`, with the `App` component conditionally rendering the active view. Tabs in the header switch between components.

### State Management

Two React Context providers wrap the app (in `main.jsx`):

- **AuthProvider** (`src/context/AuthContext.jsx`): Firebase email/password auth with role-based access control. Roles (`user`/`admin`) are stored in a Firestore `users` collection. Admin gets full access; regular users see a limited set of views.
- **GlobalStateProvider** (`src/context/GlobalStateContext.jsx`): Manages active view, items being edited (phone, inventory, procurement), and procurement mode flags.

### Service Layer

Domain logic lives in `src/services/` and `src/components/phone-selection/services/`. Services interact with Firestore directly using transactions and batch operations for data consistency. Common pattern: functions return `{ success, data/error }` objects.

### Component Organization

- `src/components/ui/` — Reusable Radix-based UI primitives (card, badge) using `class-variance-authority`
- `src/components/phone-list/` — Phone model browsing and detail views
- `src/components/phone-selection/` — Phone entry form with custom hooks (`usePhoneCache`, `usePhoneOptions`) and utilities
- `src/components/inventory/` — Inventory table, filters, editing, deletion
- Top-level components in `src/components/` — Major feature forms (procurement, suppliers, pricing, stock receiving, etc.)

### Firebase Configuration

Firebase config is in `src/firebase/config.js` (gitignored). Project ID: `tech-city-phone-information`. Services used: Authentication, Firestore, Cloud Storage.

### Key Firestore Collections

`phones`, `inventory`, `inventory_counts`, `price_configurations`, `suppliers`, `procurements`, `procurement_items`, `ledger`, `stock_transfers`, `users`

### Utility Helpers

`src/components/phone-selection/utils/phoneUtils.js` contains shared helpers: date formatting, IMEI validation, price formatting, inventory ID generation, markup/profit calculations.

`src/lib/utils.js` exports a `cn()` classname merging function (clsx + tailwind-merge).
