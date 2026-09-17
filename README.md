<div align="center">

# 🎓 Nexora

### The Operating System for Engineering Placements

An industrial-grade placement-preparation platform engineered for engineering students, career coaches, and university placement cells. Nexora evaluates technical foundations, diagnoses concept vulnerabilities under timed conditions, tracks application pipelines, runs multi-round mock hiring simulations, and provides deterministic ATS resume intelligence with end-to-end placement outcome analytics.

<br />

<!-- Technology Badges -->
[![Next.js](https://img.shields.io/badge/Next.js-16.3-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x_Strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4.0-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle_ORM-0.45-C5F74F?style=for-the-badge&logo=drizzle&logoColor=black)](https://orm.drizzle.team/)
[![Auth.js](https://img.shields.io/badge/Auth.js-v5_Beta-7928CA?style=for-the-badge&logo=auth0&logoColor=white)](https://authjs.dev/)
[![License](https://img.shields.io/badge/License-MIT-emerald?style=for-the-badge)](LICENSE)

<!-- Quality & Verification Badges -->
[![Build](https://img.shields.io/badge/Build-50%2F50_Routes_Passing-22c55e?style=flat-square&logo=githubactions&logoColor=white)](https://github.com/Jarjis-Alam/nexora)
[![Type_Checking](https://img.shields.io/badge/Type_Safety-Strict_TS-blue?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![ESLint](https://img.shields.io/badge/Linter-ESLint_9-4B32C3?style=flat-square&logo=eslint&logoColor=white)](https://eslint.org/)
[![Database](https://img.shields.io/badge/Database-18_Migrations_Applied-0284c7?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Security](https://img.shields.io/badge/Security-Strict_CSP_&_RBAC-f43f5e?style=flat-square&logo=securityscorecard&logoColor=white)](#-security-model--compliance)

<br />

[Value Proposition](#-value-proposition) • [Key Features](#-key-features) • [Platform Architecture](#-platform-architecture) • [Database Architecture](#-database-schema) • [Project Structure](#-project-structure) • [Quick Start](#-quick-start) • [API Reference](#-api-routes-reference) • [Verification Suite](#-verification--quality-assurance)

---

</div>

## 🎯 Value Proposition

Placement preparation is often fragmented: students practice generic coding quizzes, receive superficial percentage scores with zero diagnosis of root concept weaknesses, upload resumes without deterministic keyword feedback, track applications in ad-hoc spreadsheets, and lack visibility into offer compensations.

**Nexora solves this by delivering a closed-loop placement operating system:**

```
Assess & Diagnose ──► Target Roles & Companies ──► Execution OS & Roadmap ──► Mock Hiring Simulation ──► ATS Resume Intelligence ──► Application Tracker ──► Outcome Analytics
```

- **Zero Hallucinated Metrics**: Fresh student accounts start completely uncalibrated. No vanity progress bars or placeholder metrics appear until genuine diagnostic tests are completed.
- **Server-Evaluated Integrity**: Correct answers, options, and scoring algorithms are kept strictly server-side. Payloads sent to candidates are stripped of solutions, with snapshot hardening for question integrity.
- **Explainable Diagnostics**: Students receive actionable, weighted recommendations showing *what* to study, *why* it matters, and *which* company/role targets are impacted.
- **End-to-End Pipeline**: From foundational learning and timed simulations to ATS tailoring, interview scheduling, and offer comparison.

---

## ✨ Key Features

### 1. ⚡ High-Stakes Diagnostic Exam Engine
- **Multi-Section Assessments**: Create tests with independent sections (Quantitative Aptitude, CS Fundamentals, Core Coding Concepts) with per-section time limits.
- **Negative Marking**: Configurable penalty rates per test or section (`-0.25`, `-0.33`, `-0.50`, or custom values) with complete audit breakdowns.
- **Randomization & Integrity**: Per-student question ordering and option shuffling seeded deterministically to eliminate collusion.
- **Dynamic Question Pools**: Assemble tests dynamically from curated pools filtered by subject, topic, and difficulty.
- **Snapshot Hardening**: Questions and options are snapshotted at attempt creation, preserving attempt integrity even if the Question Bank is modified later.
- **Tamper-Resistant Timers**: Authoritative server-side remaining time calculation resilient to browser tab suspension or clock manipulation.

### 2. 🧠 Student Intelligence & 7 Core Disciplines
- **7 Core Technical Disciplines**: Real-time competency tracking across **Aptitude, Data Structures & Algorithms, DBMS, Operating Systems, Computer Networks, Object-Oriented Programming, and SQL**.
- **Next Best Action Engine**: Deterministic algorithm evaluating recent performance, error frequency, and topic weights to prescribe the single highest-value next step.
- **Topic Weak-Spot Radar**: Automatic detection of critical vulnerability areas based on accuracy thresholds under timed conditions.
- **Placement Readiness Score**: Multidimensional weighted formula factoring syllabus coverage, speed under pressure, error rates, and target alignment.

### 3. 🎯 Company & Role Intelligence
- **Target Role Configuration**: Configure career tracks (Frontend, Backend, Full Stack, SRE/DevOps, Data/ML Engineer, QA Automation).
- **Target Company Tiers**: Track preparation against Tier 1 (FAANG/MAMAA), Tier 2 (Unicorns), Mass Recruiters, Product Firms, and High-Growth Startups.
- **Custom Preparation Focus**: Tag specialized focus areas (System Design, Concurrency, Low-Level Design) directly in candidate profiles.
- **Company Target Summary**: Live target summary directly accessible on the student dashboard.

### 4. 🗺️ Placement Roadmap & Execution OS
- **Personalized Engineering Placement Roadmap**: Visual progression tracking across foundational, intermediate, and advanced engineering topics.
- **Execution OS Agenda**: Structured daily and weekly tasks aligned with student career targets and deadlines.
- **Milestone Checkpoints**: Clear progress indicators showing readiness percentages for specific hiring drives.

### 5. 🕹️ Placement Readiness Simulation Engine
- **End-to-End Mock Hiring Loops**: Simulates real corporate placement recruitment cycles:
  - **Round 1**: Online Assessment (OA) / Timed Coding & Aptitude
  - **Round 2**: Technical Screening & Computer Science Core
  - **Round 3**: System Design / Architecture & Case Study
  - **Round 4**: Behavioral / HR Cultural Alignment
- **Dynamic Adaptive Difficulty**: Adjusts question challenge dynamically based on candidate performance.
- **Round-by-Round Advancement**: Configurable pass/fail thresholds determine whether candidates unlock subsequent rounds.
- **Simulation Debrief**: Detailed candidate post-mortem analyzing round-level performance, stress response, and hiring probability.

### 6. 📄 ATS Resume Intelligence & Builder
- **Direct PDF/Text Ingestion**: Server-side parsing and text extraction with format validation.
- **Deterministic Skill Extraction**: Deep taxonomy matching against 60+ computer science competencies and tools.
- **ATS Score Breakdown**: Granular scoring factoring keyword density, section hygiene, structural format, and action verbs.
- **Job Description (JD) Gap Analysis**: Side-by-side comparison against target job descriptions highlighting missing keywords and skills.
- **Resume Variant & Version Control**: Maintain multiple targeted resumes (e.g., Backend vs. Data Engineering) with full version history and rollback.
- **Suggestion Diff Acceptance Flow**: Intelligent inline recommendations with single-click accept/reject diffing.

### 7. 📋 Application Intelligence & Lifecycle Tracker
- **Kanban Application Pipeline**: Track jobs across stages: `Wishlist` → `Applied` → `OA` → `Technical Round` → `Final Round` → `Offer` → `Rejected`.
- **Interview Log & Calendar**: Schedule interview dates, log interviewer details, and track follow-up deadlines.
- **Post-Interview Reflections**: Structured logs for capturing questions asked, self-assessed performance, and areas for improvement.
- **Pipeline Conversion Funnel**: Visual metrics showing stage-by-stage drop-off rates and active pipeline health.

### 8. 💼 Placement Outcome Intelligence & Offer Evaluation
- **Comprehensive Offer Analyzer**: Break down Cost-to-Company (CTC), base salary, joining bonuses, stock grants (ESOPs/RSUs), and benefits.
- **Decision Engine**: Formalize decision logs with status tracking (`Offer Accepted`, `Offer Declined`, `Withdrawn`).
- **Rejection Post-Mortem Diagnostics**: Structured root-cause tagging (coding speed, DSA depth, system design, cultural fit) to refine preparation loops.
- **Cohort Benchmarking**: Compare offers and compensation packages against cohort averages and industry standards.

### 9. 📊 Admin & Placement Cell Analytics
- **Live Monitoring Drawer**: Real-time visibility into students taking active tests with heartbeat tracking.
- **Question Discrimination Index**: Diagnostic metrics identifying questions that are too easy, excessively difficult, or statistically non-discriminating.
- **Subject & Topic Performance Matrix**: Granular drop-off and error heatmaps across cohorts.
- **Cohort Comparison Modal**: Compare test metrics side-by-side (mean score, standard deviation, pass rate, completion rate).
- **Scheduled Test Lifecycle**: Full test lifecycle control (`draft` → `scheduled` → `published` → `closed` → `archived`).

---

## 🏛 Platform Architecture

```mermaid
flowchart TD
    subgraph Client["Presentation Layer (React 19 / Next.js 16.3 App Router)"]
        Landing["Landing & Auth (/auth)"]
        Dash["Student Dashboard (/dashboard)"]
        Exam["Diagnostic Engine (/tests/[id]/attempt)"]
        RoadmapUI["Placement Roadmap (/roadmap)"]
        SimUI["Hiring Simulation (/simulation)"]
        ResumeUI["ATS Resume Builder (/resume)"]
        AppsUI["Application Pipeline (/applications)"]
        OutcomeUI["Outcome Analytics (/outcomes)"]
        AdminUI["Admin & Analytics Suite (/admin/*)"]
    end

    subgraph Security["Security & Middleware Layer"]
        Proxy["Next.js Proxy & Strict CSP Headers"]
        Auth["Auth.js (NextAuth v5 JWT Session)"]
        RBAC["Role-Based Access Control (Admin vs Candidate)"]
        RateLimit["Sliding-Window Rate Limiter"]
    end

    subgraph Services["Core Business Logic Layer"]
        ExamSvc["Exam & Attempt State Machine"]
        GradingSvc["Deterministic Grading & Penalties"]
        ReadinessSvc["Placement Readiness Engine (7 Pillars)"]
        SimSvc["Placement Simulation & Round Controller"]
        ResumeSvc["ATS Resume & Keyword Match Engine"]
        AppSvc["Application Lifecycle & Event Tracker"]
        OutcomeSvc["Outcome & Compensation Analyzer"]
        AdminAnalyticsSvc["Cohort Analytics & Item Discrimination"]
    end

    subgraph Data["Persistence Layer (PostgreSQL 16)"]
        Drizzle["Drizzle ORM (31 Normalized Tables)"]
        Postgres[(PostgreSQL Relational Store)]
    end

    Client --> Proxy --> Auth --> RBAC --> RateLimit
    RateLimit --> Services
    ExamSvc --> Drizzle
    GradingSvc --> Drizzle
    ReadinessSvc --> Drizzle
    SimSvc --> Drizzle
    ResumeSvc --> Drizzle
    AppSvc --> Drizzle
    OutcomeSvc --> Drizzle
    AdminAnalyticsSvc --> Drizzle
    Drizzle --> Postgres
```

---

## 🛠 Tech Stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| **Framework** | Next.js (App Router, Turbopack) | `16.3.1` | Full-stack server rendering and dynamic routing (50 routes) |
| **UI Library** | React | `19.2.8` | Component architecture & modern concurrent features |
| **Language** | TypeScript | `5.x (Strict)` | End-to-end type safety across client and server |
| **Styling** | Tailwind CSS | `v4.0` | Modern utility-first CSS design system |
| **Database** | PostgreSQL | `16+` | Relational data persistence with strict foreign keys |
| **ORM** | Drizzle ORM | `0.45.2` | Type-safe query builder, schema definition, and migrations |
| **Validation** | Zod | `4.4.3` | Contract and schema payload validation |
| **Authentication** | Auth.js (NextAuth.js) | `5.0.0-beta.32` | JWT session management & HTTP-only cookies |
| **PDF Extraction** | pdf-parse / native | Built-in | Text parsing and extraction for candidate resumes |
| **Cryptography** | bcryptjs | `3.0.3` | Password hashing & salt rounds |
| **Data Viz** | Recharts | `3.10.1` | Diagnostic radar charts, bar charts, and trends |
| **Icons** | Lucide React | `1.33.0` | Accessible vector icon library |

---

## 🗄 Database Schema

The database uses a normalized PostgreSQL architecture with **31 core tables** organized across 8 logical domains with 17 applied migrations:

```
├── 1. Identity & Access
│   ├── users                         # Core authentication records (email, password hash, role)
│   └── profiles                      # Student academic profile (college, branch, graduation year)
│
├── 2. Curricular Catalogs
│   ├── subjects                      # 7 core academic disciplines
│   ├── topics                        # 60 syllabus topics categorized under subjects
│   ├── questions                     # Question bank items (options, correct answer, explanation)
│   ├── companies                     # Canonical target companies (name, category, tier, website)
│   └── roles                         # Standard job roles (title, department, required skills)
│
├── 3. Assessment Authoring & Pools
│   ├── tests                         # Test definitions (duration, negative marking, attempt limits)
│   ├── test_sections                 # Test sections with per-section time limits & instructions
│   ├── test_questions                # Ordered association of questions to tests
│   ├── question_pools                # Curated question pools for dynamic assembly
│   └── question_pool_questions       # Questions mapped to pools with sampling weights
│
├── 4. Test Execution & Results
│   ├── attempts                      # Student attempts (status, scores, timestamps, duration)
│   ├── attempt_questions             # Per-attempt snapshotted question and option order
│   ├── answers                       # Candidate responses, review flags, and time spent per item
│   └── skill_scores                  # Derived subject and topic accuracy metrics per attempt
│
├── 5. Student Targets & Strategy
│   ├── student_target_roles          # Student target career roles (primary vs secondary)
│   └── student_target_companies      # Target companies prioritized by the student
│
├── 6. Placement Readiness Simulation (Phase 17)
│   ├── placement_simulations         # Multi-round simulation sessions (role, company, overall status)
│   └── placement_simulation_rounds   # Round records (OA, Tech, System Design, HR, score, feedback)
│
├── 7. ATS Resume Intelligence (Phase 18)
│   ├── resume_files                  # Raw uploaded resume files (PDF text, metadata)
│   ├── resume_variants               # Role-specific tailored resume variants
│   ├── resume_analyses               # ATS score breakdown (keyword density, formatting, structure)
│   ├── resume_suggestions            # Actionable suggestions with accept/reject states
│   └── resume_versions               # Immutable revision history for resume variants
│
└── 8. Applications & Placement Outcomes (Phases 19 & 20)
    ├── applications                  # Student job applications (company, role, stage, status)
    ├── application_events            # Audit timeline of stage transitions & events
    ├── application_interviews        # Interview rounds (type, date, interviewer, questions)
    ├── application_assessments       # OA assessment tracking and scores
    ├── application_offers            # Detailed offer metrics (base, bonus, equity, total CTC)
    └── application_reflections       # Candidate post-interview reflection logs
```

---

## 📁 Project Structure

```
nexora/
├── README.md                              # Comprehensive project documentation
├── LICENSE                                # MIT license
├── phase-18-implementation-report.md      # Resume Intelligence verification report
├── phase-19-implementation-report.md      # Application Intelligence verification report
├── phase-20-implementation-report.md      # Outcome Intelligence verification report
└── frontend/                              # Main Next.js 16 Application
    ├── package.json                       # Scripts and dependencies
    ├── next.config.ts                     # Next.js configuration & CSP security headers
    ├── drizzle.config.ts                  # Drizzle Kit migration configuration
    ├── .env.example                       # Environment variable template
    ├── .env.local                         # Local environment secrets (git-ignored)
    └── src/
        ├── app/                           # 50 App Router routes & API handlers
        │   ├── (public)/                  # Landing page & authentication
        │   ├── (protected)/
        │   │   ├── dashboard/             # Executive Placement OS Dashboard
        │   │   ├── tests/                 # Diagnostic exam engine & review
        │   │   ├── analytics/             # Student competency radar
        │   │   ├── profile/               # Student academic & target preferences
        │   │   ├── roadmap/               # Placement preparation roadmap
        │   │   ├── target/                # Company and role target explorer
        │   │   ├── simulation/            # Multi-round hiring simulation engine
        │   │   ├── resume/                # ATS resume builder & keyword auditor
        │   │   ├── applications/          # Kanban application lifecycle pipeline
        │   │   ├── outcomes/              # Placement offer & outcome analytics
        │   │   └── admin/
        │   │       ├── analytics/         # Cohort metrics, drop-offs, item discrimination
        │   │       ├── questions/         # Question Bank authoring
        │   │       ├── tests/             # Test Builder & dynamic pool configuration
        │   │       ├── companies/         # Canonical company directory
        │   │       └── roles/             # Career role directory
        │   └── api/                       # REST API route handlers
        ├── components/                    # Reusable React component library
        │   ├── admin/                     # Analytics dashboards, test builders, question forms
        │   ├── applications/              # Kanban board, application dialogs, actions
        │   ├── assessment/                # Exam engine, question palette, review table
        │   ├── layout/                    # Responsive sidebar, navigation
        │   ├── resume/                    # ATS score card, keyword matcher, suggestion editor
        │   ├── simulation/                # Simulation runner & round controllers
        │   └── ui/                        # Accessible core primitives (buttons, modals, badges)
        ├── db/                            # Database infrastructure
        │   ├── schema.ts                  # Drizzle ORM schema (31 tables)
        │   ├── migrations/                # Drizzle migration files (0000 - 0017)
        │   ├── index.ts                   # PostgreSQL connection pool with fail-fast
        │   ├── bootstrap.ts               # Idempotent canonical seed & admin bootstrapper
        │   └── seed.ts                    # Development demo dataset generator
        ├── lib/                           # Shared utility libraries & domain models
        │   ├── applications/              # Application intelligence helpers & statuses
        │   ├── resume/                    # ATS parser, skill taxonomy, suggestion engine
        │   └── validations/               # Zod validation contracts
        ├── server/                        # Backend service layer
        │   ├── actions.ts                 # Next.js Server Actions
        │   ├── grading.ts                 # Server-side grading & negative marking
        │   ├── readiness.ts               # Placement readiness score calculator
        │   ├── student-intelligence.ts    # Next best action & personalized diagnostics
        │   ├── placement-execution.ts     # Execution OS & daily agenda service
        │   ├── placement-simulation.ts    # Mock hiring loop simulation engine
        │   ├── resume-intelligence.ts     # ATS resume analysis & variant management
        │   ├── application-intelligence.ts # Application pipeline & interview scheduler
        │   ├── outcome-intelligence.ts    # Offer comparison & rejection analytics
        │   └── admin-analytics.ts         # Instructor analytics & discrimination index
        └── test/                          # Automated verification suites (Phases 1-20)
```

---

## 🚀 Quick Start

### Prerequisites
- **Node.js**: `v20.x` or `v22.x`
- **PostgreSQL**: `v15+` or `v16+` running on `localhost:5432`

### 1. Clone & Install
```bash
git clone https://github.com/Jarjis-Alam/nexora.git
cd nexora/frontend
npm install
```

### 2. Configure Environment
Create `frontend/.env.local` using `.env.example`:
```bash
cp .env.example .env.local
```

Configure your local database credentials:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/placement_os"
AUTH_SECRET="generate_with_openssl_rand_base64_32"
AUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 3. Run Migrations & Bootstrap Data
Apply all 18 database migrations (`0000_violet_kid_colt` through `0017_phase_17_simulation_schema`) and bootstrap canonical reference data:
```bash
# Execute Drizzle migrations
npm run db:migrate

# Bootstrap canonical reference data (subjects, topics, roles, companies, admin)
npm run db:bootstrap
```

*(Optional) Seed mock tests, questions, and demo student records:*
```bash
npm run db:seed
```

### 4. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

#### Demo Credentials (from bootstrap/seed):
- **Admin**: `admin@placementos.dev` / `admin123`
- **Student**: `alex.chen@placementos.dev` / `alex123`

---

## 📡 API Routes Reference

### Diagnostic Engine & Assessments
| Endpoint | Method | Role | Description |
|---|---|---|---|
| `/api/auth/[...nextauth]` | `GET`, `POST` | Public | Auth.js session handshake, sign-in, and sign-out |
| `/api/auth/register` | `POST` | Public | Register new candidate account with password hashing |
| `/api/profile` | `GET`, `PUT` | Student | Manage academic metadata, primary role, and preferences |
| `/api/student/execution` | `GET`, `POST` | Student | Execution OS daily tasks and completion checkmarks |
| `/api/student/roadmap` | `GET` | Student | Personalized engineering syllabus roadmap progression |
| `/api/student/targets` | `GET`, `PUT` | Student | Fetch and update candidate target roles and companies |
| `/api/student/intelligence` | `GET` | Student | Retrieve next best actions and vulnerability weak-spots |

### Simulation Engine (Phase 17)
| Endpoint | Method | Role | Description |
|---|---|---|---|
| `/api/student/simulation` | `GET`, `POST` | Student | List active simulations or initiate new multi-round loop |
| `/api/student/simulation/[id]` | `GET` | Student | Fetch simulation status, current round, and overall score |
| `/api/student/simulation/[id]/round/[roundNumber]` | `POST` | Student | Submit round responses, advance rounds, or complete loop |

### ATS Resume Intelligence (Phase 18)
| Endpoint | Method | Role | Description |
|---|---|---|---|
| `/api/student/resume/upload` | `POST` | Student | Upload resume PDF/text for server-side parsing |
| `/api/student/resume/variants` | `GET`, `POST` | Student | List or create role-specific resume variants |
| `/api/student/resume/variants/[id]` | `GET`, `DELETE` | Student | Retrieve or delete specific resume variant |
| `/api/student/resume/variants/[id]/analyze` | `POST` | Student | Run deterministic ATS score & keyword match analysis |
| `/api/student/resume/variants/[id]/job-description` | `POST` | Student | Audit resume variant against target Job Description |
| `/api/student/resume/variants/[id]/content` | `PUT` | Student | Update resume content and save working draft |
| `/api/student/resume/suggestions/[id]/decision` | `POST` | Student | Accept or reject suggested ATS optimization diffs |
| `/api/student/resume/variants/[id]/versions` | `GET`, `POST` | Student | List version snapshots or create tagged revision |
| `/api/student/resume/variants/[id]/export` | `GET` | Student | Export sanitized ATS-friendly formatted resume |

### Applications & Outcomes (Phases 19 & 20)
| Endpoint | Method | Role | Description |
|---|---|---|---|
| `/api/student/applications` | `GET`, `POST` | Student | List Kanban applications or create new job tracker |
| `/api/student/applications/[id]` | `GET`, `PATCH`, `DELETE` | Student | Application details, stage updates, and deletion |
| `/api/student/applications/[id]/events` | `GET`, `POST` | Student | Audit log of stage transitions and status events |
| `/api/student/applications/[id]/interviews` | `GET`, `POST` | Student | Log interview rounds, interviewer details, and dates |
| `/api/student/applications/[id]/reflection` | `POST` | Student | Record post-interview candidate reflection |
| `/api/student/applications/calendar` | `GET` | Student | Unified calendar feed of interviews and deadlines |
| `/api/student/outcomes` | `GET`, `POST` | Student | Record final placement offer or rejection post-mortem |
| `/api/student/outcomes/[applicationId]` | `GET` | Student | Retrieve offer details, compensation, and decisions |
| `/api/student/outcomes/analytics` | `GET` | Student | Placement outcome metrics, CTC stats, and benchmarks |

### Admin & Placement Cell Suite
| Endpoint | Method | Role | Description |
|---|---|---|---|
| `/api/admin/tests` | `GET`, `POST` | Admin | Multi-section assessment authoring and pool mapping |
| `/api/admin/questions` | `GET`, `POST` | Admin | Question Bank authoring with taxonomy filters |
| `/api/admin/questions/[id]` | `GET`, `PUT`, `DELETE` | Admin | Question inspection, updates, and archival |
| `/api/admin/analytics` | `GET` | Admin | Cohort overview, pass rates, and active attempts |
| `/api/admin/analytics/tests/[id]` | `GET` | Admin | Test-specific metrics, item discrimination, drop-offs |
| `/api/admin/companies` | `GET`, `POST` | Admin | Company directory and hiring tier management |
| `/api/admin/roles` | `GET`, `POST` | Admin | Career tracks and required skill taxonomy management |

---

## 🔒 Security Model & Compliance

- **Strict Content Security Policy (CSP)**: Nonce-based script execution, frame protection (`X-Frame-Options: DENY`), MIME sniffing prevention (`X-Content-Type-Options: nosniff`), and HSTS configured in `next.config.ts`.
- **Server-Side Answer Stripping**: Diagnostic tests and simulation payloads permanently strip correct answers, solutions, and explanations from client payloads.
- **Session Verification & Immutability**: All student actions verify database identity on every call. Submitted attempts, completed simulations, and sealed offers reject further mutations permanently.
- **Isolated Multi-Tenant Architecture**: Candidates can only access their own attempts, simulation runs, resume variants, applications, and offers.
- **Sliding-Window Rate Limiting**: Protection against brute-force authentication, API spam, and high-frequency grading requests.

---

## 🧪 Verification & Quality Assurance

Run the comprehensive suite of automated verification tests to validate all 20 phases:

```bash
# Validate strict TypeScript type compliance (0 errors)
npm run build --prefix frontend

# Execute ESLint across all components and routes (0 errors)
npm run lint --prefix frontend

# Phase 1-10 Core Exam Engine & Deterministic Grading Suite
npx tsx frontend/src/test/suite.ts

# Phase 11A Company & Role Intelligence Suite
npx tsx frontend/src/test/phase-11a-company-role-intelligence.ts

# Phase 11B Multiple Target Roles & Student Targeting Audit
npx tsx frontend/src/test/phase-11b-student-targeting-audit.ts

# Phase 12-16 Execution OS, Roadmap, & Target Strategy
npx tsx frontend/src/test/phase-15-placement-execution.ts
npx tsx frontend/src/test/phase-16-placement-target-strategy.ts

# Phase 17 Placement Readiness Simulation Suite
npx tsx frontend/src/test/phase-17-placement-readiness-simulation.ts

# Phase 18 ATS Resume Intelligence & PDF Extraction Suite
npx tsx frontend/src/test/phase-18-ats-resume-intelligence.ts
npx tsx frontend/src/test/phase-18-pdf-extraction-http.ts

# Phase 19 Application Intelligence & Interview Tracker Suite
npx tsx frontend/src/test/phase-19-applications.ts
npx tsx frontend/src/test/phase-19-applications-http.ts

# Phase 20 Placement Outcome Intelligence Suite
npx tsx frontend/src/test/phase-20-placement-outcome-intelligence.ts

# End-to-End Security & Session Regression
npx tsx frontend/src/test/security-regression.ts
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE) © 2026 Munshi Jarjis Alam.
