# SamadhanX — Frontend Client 🇮🇳
> **Smart India Hackathon 2026 (Problem Statement: SIH 26043)**  
> *Next-generation reactive interface built with React 18, TypeScript, Vite, and Tailwind CSS.*

---

## 🏗️ Architecture & Module Organization

The frontend codebase is organized by domain modules with role-based access control and decoupled API services.

```
frontend/src/
├── api/                   # Typed API clients (Axios instance with JWT interceptors)
│   ├── client.ts          # Base Axios client with correlation ID & token handling
│   ├── auth.ts            # Auth & registration API calls
│   ├── citizen.ts         # Citizen problems & real-time timeline calls
│   ├── student.ts         # Pod management & teammate invites
│   ├── faculty.ts         # Academic reviews & pod adoption
│   ├── industry.ts        # Vetted projects & CSR funding offers
│   ├── university.ts      # AISHE rosters & faculty invitations
│   └── admin.ts           # National governance & audit log queries
│
├── modules/               # Domain-Driven Feature Modules
│   ├── auth/              # Registration, Login, OTP Verification modals
│   ├── citizen/           # Citizen Dashboard, Problem Submission, ProblemTimeline
│   ├── student/           # Innovation Pod Hub, Roster Manager, Impact Reports
│   ├── faculty/           # Faculty Mentorship Hub, Academic Review Rubric
│   ├── industry/          # Vetted Solutions Catalog, CSR Offers, Funded Portfolios
│   ├── university/        # University Innovation Hub, Faculty Onboarding
│   └── admin/             # Verification Queues, AISHE Sync, Audit Logs
│
├── routes/                # Application Routing
│   └── AppRoutes.tsx      # Declarative path routing with Role Guards
│
├── store/                 # Global State
│   └── authStore.ts       # Zustand store with persistence for auth & profile
│
└── shared/                # Shared Components & Utilities
    ├── components/        # Layouts, Modals, Badges, Loaders, Toasts
    └── types/             # Shared TypeScript models & enums
```

---

## ⚡ Tech Stack & Libraries

- **UI Framework**: React 18 with TypeScript
- **Build Engine**: Vite 5
- **Styling**: Tailwind CSS with custom thematic design system
- **State Management**: Zustand (Auth & Session Persistence)
- **Data Fetching & Cache**: TanStack React Query v5
- **Icons**: Lucide React
- **Notifications**: Sonner / React Hot Toast

---

## 🚀 Development & Build Commands

```bash
# Install dependencies
npm install

# Start local Vite development server (Port 5173)
npm run dev

# Run TypeScript type check
npx tsc --noEmit

# Run ESLint validation
npm run lint

# Production compilation & asset optimization
npm run build

# Preview production build locally
npm run preview
```

---

## 🛡️ Route Guards & Role-Based UI

Routes are protected by user roles with automatic redirect logic in `AppRoutes.tsx`:

| Role | Accessible Route Prefix | Redirect if Unauthorized |
|---|---|---|
| **Citizen** | `/citizen/*`, `/problems/*` | `/login` |
| **Student** | `/student/*`, `/projects/*`, `/problems/*` | `/login` |
| **Faculty** | `/faculty/*`, `/reviews/*` | `/login` |
| **Industry** | `/industry/*`, `/partnerships/*` | `/login` or `/approval-pending` |
| **University**| `/university/*` | `/login` or `/approval-pending` |
| **Admin** | `/admin/*` | `/login` |
