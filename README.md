# HerBody Frontend

HerBody is a privacy-focused femtech education and health-journey web application. It gives users a calm, accessible interface for learning about their bodies, exploring a 3D-inspired anatomical atlas, and managing an authenticated health journey.

This repository contains the HerBody frontend. Login, AI chat, and personal medical documents use the configured backend API. Registration, email verification, and password recovery remain unavailable until their backend endpoints are implemented.

The app does not seed health records or use fabricated user data. The documents page retrieves the authenticated user's records from the backend and uploads files through its medical-documents API.

## Product experience

### Public experience

- Branded HerBody sign-in screen
- Login through the backend API
- Registration, email verification, and password recovery pages that report their unavailable backend support
- Anonymous exploration links to the educational areas
- Responsive layout for desktop, tablet, and mobile screens

### Authenticated experience

- Interactive Body dashboard
- Curriculum sidebar with:
  - Interactive Body
  - Organ Details
  - AI Companion
- Cycle status indicator
- Whole Body, Pelvic System, and Neuroendocrine atlas tabs
- Anatomical model visual with heart and uterus focus points
- Uterus detail card with cycle and lining information
- Logout that clears the local profile session
- Personal medical document upload, listing, preview, download, and deletion

The dashboard provides educational anatomy content and interactive atlas controls. User health records are not pre-populated.

## Technology

- Next.js `16.4.5`
- React `19.3.0`
- TypeScript `5`
- Tailwind CSS `4`
- ESLint
- Next.js App Router
- Backend API integration for login, AI chat, and medical documents; no API proxy

## Routes

| Frontend route | Description |
| --- | --- |
| `/` | Login screen |
| `/login` | Login screen |
| `/register` | Unavailable until the registration API is implemented |
| `/verify-email` | Unavailable until the verification API is implemented |
| `/forgot-password` | Unavailable until the recovery API is implemented |
| `/reset-password` | Unavailable until the reset API is implemented |
| `/health-journey` | Authenticated-style body atlas dashboard |
| `/healthy-life` | Healthy Life educational topics |
| `/documents` | Authenticated personal medical documents |

## Project structure

```text
frontend/
├── public/
│   └── body.png                  # Anatomical illustration used in auth UI
├── src/
│   ├── app/
│   │   ├── forgot-password/      # Password recovery request
│   │   ├── documents/            # Personal medical document management
│   │   ├── health-journey/       # Logged-in body atlas dashboard
│   │   ├── healthy-life/         # Educational topic cards
│   │   ├── login/                # Login page
│   │   ├── register/             # Registration page
│   │   ├── reset-password/       # Password reset page
│   │   ├── verify-email/         # Email verification page
│   │   ├── globals.css           # Theme and responsive UI styles
│   │   ├── layout.tsx            # Root metadata and font configuration
│   │   └── page.tsx              # Home/login entry screen
│   ├── components/
│   │   ├── auth/
│   │   │   ├── AuthForm.tsx      # Shared authentication form logic
│   │   │   └── AuthShell.tsx     # Shared authentication layout
│   │   ├── layout/               # Legacy shared navigation/footer components
│   │   └── ui/                   # Reusable UI components
│   ├── lib/
│   │   ├── api/                  # Authenticated backend API clients
│   │   ├── organs.ts             # Shared organ catalogue
│   │   └── navigation.ts         # Navigation configuration
│   └── types/                    # Shared TypeScript types
├── next.config.ts                # Next.js and Turbopack configuration
├── package.json
└── tsconfig.json
```

## Requirements

- Node.js 20 or newer is recommended
- npm

## Local development

From the repository root:

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:3000>.

## Available scripts

Run these commands from `frontend/`:

```bash
npm run dev       # Start the development server
npm run lint      # Run ESLint
npm run build     # Create a production build
npm run start     # Serve the production build locally
```

Before opening a pull request, run:

```bash
npm run lint
npm run build
```

## Deploying to Vercel

1. Import `herbody-team/herbody-frontend` into Vercel.
2. Set **Root Directory** to `frontend`.
3. Use the **Next.js** framework preset.
4. Use `npm run build` as the build command.
5. Leave the output directory at its default.
6. Deploy.

Set `NEXT_PUBLIC_API_URL` to the backend base URL to enable login, AI chat, and medical documents.

After deployment, verify:

- Login and registration
- Email verification and OTP resend
- Password recovery and reset
- Dashboard navigation
- Medical document upload, list, preview, download, and deletion
- Logout
- Mobile layout

## Design and accessibility notes

- The interface uses a blush, cream, and berry color palette.
- Authentication layouts are responsive and collapse into a mobile-friendly single-column design.
- Form controls include browser validation, disabled loading states, and visible error/success messages.
- Images include descriptive alternative text where they convey information.
- Health content is educational and does not replace professional medical advice.

## Privacy and security notes

- The frontend does not contain database credentials or backend secrets.
- User-provided profile values are kept only in browser `sessionStorage`.
- Do not commit credentials, API keys, or private user data.
- The frontend does not diagnose medical conditions or replace a healthcare professional.

## Scope and future work

The frontend provides login and AI chat integrations. Future work may include:

- Registration, email verification, and password recovery API integrations
- Protected route middleware
- Persistent cycle and health data
- Interactive 3D anatomy controls
- Organ detail pages
- User preferences and settings
- Automated frontend tests

