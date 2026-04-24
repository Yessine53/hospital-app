# MedBook — Healthcare Appointment Management System

A full-stack healthcare appointment management platform with predictive no-show analytics, built with React, Node.js, MongoDB, and Python FastAPI.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start (Docker)](#quick-start-docker)
3. [Import Patient & Appointment Data](#import-patient--appointment-data)
4. [Train the ML Prediction Model](#train-the-ml-prediction-model)
5. [Access the Application](#access-the-application)
6. [Demo Accounts](#demo-accounts)
7. [Architecture](#architecture)
8. [Features](#features)
9. [No-Show Prediction Workflow](#no-show-prediction-workflow)
10. [API Endpoints](#api-endpoints)
11. [Project Structure](#project-structure)
12. [Local Development (without Docker)](#local-development-without-docker)
13. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- **Docker Desktop** installed and **running**
  - Windows: https://docs.docker.com/desktop/install/windows-install/
  - macOS: https://docs.docker.com/desktop/install/mac-install/
- At least **4 GB of free RAM** (MongoDB + Node + Python + React)
- Ports **3000**, **5000**, **8000**, and **27017** must be available

> **Important (Windows):** Make sure Docker Desktop is started before running any commands. If you see a "pipe" error, Docker Desktop is not running.

---

## Quick Start (Docker)

### Step 1: Open a terminal in the project folder

```bash
cd hospital-app
```

### Step 2: Build and start all services

```bash
docker-compose up --build -d
```

This starts four containers:

| Container | Port | Description |
|-----------|------|-------------|
| `hospital-frontend` | 3000 | React web application |
| `hospital-backend` | 5000 | Node.js REST API |
| `hospital-ml` | 8000 | Python ML prediction service |
| `hospital-mongodb` | 27017 | MongoDB database |

Wait approximately 60–90 seconds for all services to fully start.

### Step 3: Verify all containers are running

```bash
docker ps
```

You should see four containers with status `Up`. If any container shows `Restarting`, check the [Troubleshooting](#troubleshooting) section.

---

## Import Patient & Appointment Data

The `data/` folder contains a Kaggle dataset with 36,697 patients and 111,488 appointments. Import it to populate the system:

```bash
docker exec -it hospital-backend npx ts-node src/scripts/importKaggle.ts /data
```

This process takes 3–5 minutes and will:
- Create 7 demo staff accounts (admin, doctor, receptionist, nurse, analyst, manager)
- Create 6 clinical departments with specialties
- Import 36,697 patient records
- Import 111,488 historical appointments (2015–2024)
- Calculate no-show statistics for each patient

> **Windows PowerShell note:** Use the command exactly as shown above. If you get an error, try running it in **Command Prompt** instead of PowerShell.

---

## Train the ML Prediction Model

After importing data, train the Gradient Boosting model:

**On Windows (Command Prompt):**
```cmd
curl.exe -X POST http://localhost:8000/train
```

**On Windows (PowerShell):**
```powershell
Invoke-WebRequest -Method POST -Uri http://localhost:8000/train
```

**On macOS/Linux:**
```bash
curl -X POST http://localhost:8000/train
```

The response will include:
- Model accuracy
- AUC score
- Number of training samples
- Feature importance rankings

You can also train the model from within the application by logging in as Admin and navigating to **Analytics** → **Train Model**.

### Verify the model is loaded

```bash
curl http://localhost:8000/model/info
```

---

## Access the Application

Open your browser and go to:

| URL | Description |
|-----|-------------|
| http://localhost:3000 | MedBook web application |
| http://localhost:5000/api | Backend API |
| http://localhost:8000/docs | ML service API documentation (Swagger) |

---

## Demo Accounts

After running the data import, the following accounts are available:

| Role | Email | Password |
|------|-------|----------|
| Administrator | admin@hospital.com | Admin123! |
| Doctor | dr.smith@hospital.com | Doctor123! |
| Receptionist | reception@hospital.com | Reception123! |
| Nurse | nurse@hospital.com | Nurse123! |
| Data Analyst | analyst@hospital.com | Analyst123! |
| Manager | manager@hospital.com | Manager123! |
| Patient | john.doe@email.com | Patient123! |

Each role sees different menu items and has different permissions. Log in with the Admin account to see all features.

---

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   React +   │────▶│  Node.js +   │────▶│   MongoDB    │
│  TypeScript  │     │   Express    │     │              │
│  (Port 3000) │     │  (Port 5000) │     │ (Port 27017) │
└─────────────┘     └──────┬───────┘     └──────────────┘
                           │
                    ┌──────▼───────┐
                    │  Python +    │
                    │   FastAPI    │
                    │  (Port 8000) │
                    └──────────────┘
```

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 18, TypeScript, Tailwind CSS, Vite | Patient and staff web portal |
| Backend | Node.js 20, Express 4, TypeScript, Mongoose | REST API, business logic, RBAC |
| Database | MongoDB 7 | Document-based data persistence |
| ML Service | Python 3.11, FastAPI, scikit-learn | No-show prediction model |
| DevOps | Docker Compose | Container orchestration |

---

## Features

- **7 user roles** with role-based access control (Admin, Doctor, Receptionist, Nurse, Patient, Data Analyst, Manager)
- **14 application pages** including dashboard, appointment booking, patient management, and analytics
- **4-step booking wizard** — select department → doctor & date → time slot → confirm
- **Walk-in queue** — register walk-in patients with priority levels (normal, urgent, emergency)
- **ML no-show prediction** — Gradient Boosting model scores each appointment at booking time
- **Automated confirmation workflow** — high-risk patients notified 2 days before, 24 hours to confirm
- **Slot reallocation** — unconfirmed slots automatically offered to next-day patients
- **Reports & dashboards** — no-show rates, department breakdown, prediction accuracy, daily trends
- **System settings** — configurable risk thresholds, reminder timing, hospital info
- **Audit logging** — all critical actions tracked with user, timestamp, and details
- **43 REST API endpoints** across 9 route groups

---

## No-Show Prediction Workflow

1. **At booking**: The ML model scores the appointment with a probability between 0 and 1
2. **Risk classification**: Low (<30%), Medium (30–60%), High (>60%) — thresholds are configurable in Settings
3. **2 days before**: A daily cron job (6 AM) flags high-risk appointments and sets status to "pending confirmation"
4. **Patient notification**: Patient receives a reminder to confirm via the web application
5. **24-hour deadline**: If the patient does not confirm within 24 hours, the slot is marked for reallocation
6. **Reallocation**: An hourly cron job offers the freed slot to patients scheduled for the following day
7. **Original patient**: Notified that their appointment was moved and can rebook

### ML Model Features (15 total)

The Gradient Boosting classifier uses these features, all available at booking time:

| Feature | Description |
|---------|-------------|
| `no_show_rate` | Patient's historical no-show percentage (strongest predictor) |
| `no_show_count` | Total past no-shows |
| `total_appointments` | Total past appointments |
| `attended_count` | Total attended appointments |
| `cancelled_count` | Total cancellations |
| `lead_time_days` | Days between booking and appointment date |
| `hour_of_day` | Appointment hour (0–23) |
| `day_of_week` | Day of week (0=Monday, 6=Sunday) |
| `is_morning` | Boolean: appointment before 12:00 |
| `is_monday` | Boolean: Monday appointment |
| `is_friday` | Boolean: Friday appointment |
| `age` | Patient age in years |
| `gender` | Patient gender |
| `appointment_type` | Regular, follow-up, or emergency |
| `is_new_patient` | Boolean: patient has no previous appointments |

---

## API Endpoints

### Authentication
- `POST /api/auth/login` — Login and receive JWT token
- `POST /api/auth/register` — Patient self-registration
- `GET /api/auth/profile` — Get current user profile

### Appointments
- `GET /api/appointments` — List appointments (role-filtered, paginated)
- `POST /api/appointments` — Create new appointment
- `PUT /api/appointments/:id` — Update appointment
- `DELETE /api/appointments/:id` — Cancel appointment
- `POST /api/appointments/:id/confirm` — Patient confirms attendance
- `GET /api/appointments/slots` — Get available time slots
- `GET /api/appointments/dashboard` — Dashboard statistics

### Patients
- `GET /api/patients` — List patients (searchable, paginated)
- `POST /api/patients` — Create patient (staff only)
- `GET /api/patients/:id/history` — Full appointment history

### Departments
- `GET /api/departments` — List all departments
- `GET /api/departments/:id` — Department detail with doctors
- `GET /api/departments/specialties/all` — All specialties

### Walk-In Queue
- `POST /api/walk-in` — Add patient to queue
- `GET /api/walk-in/:departmentId` — Current department queue
- `POST /api/walk-in/:departmentId/call-next` — Call next patient
- `PUT /api/walk-in/:id/status` — Update queue entry status

### Reports
- `GET /api/reports/overview` — System overview statistics
- `GET /api/reports/no-shows` — No-show analytics with date range
- `GET /api/reports/reminders` — Reminder effectiveness metrics

### Users (Admin only)
- `GET /api/users` — List all users (searchable, filterable by role)
- `POST /api/users` — Create user with role
- `PUT /api/users/:id` — Update user
- `DELETE /api/users/:id` — Deactivate user

### Settings (Admin only)
- `GET /api/settings` — Get all system settings
- `PUT /api/settings/update` — Update a single setting
- `PUT /api/settings/bulk-update` — Update multiple settings
- `GET /api/settings/audit-logs` — View audit log entries

---

## Project Structure

```
hospital-app/
├── docker-compose.yml          # Orchestrates all 4 services
├── README.md                   # This file
├── data/                       # Kaggle CSV files for import
│   ├── patients.csv            # 36,697 patient records
│   ├── appointments.csv        # 111,488 appointment records
│   └── slots.csv               # Time slot definitions
│
├── backend/                    # Node.js + Express + TypeScript
│   ├── Dockerfile
│   ├── package.json
│   ├── .env.example            # Environment variable template
│   └── src/
│       ├── server.ts           # Entry point (9 route groups)
│       ├── models/             # 8 MongoDB schemas
│       ├── controllers/        # 8 request handlers
│       ├── routes/             # 8 Express routers
│       ├── middleware/         # auth.ts (JWT + RBAC), audit.ts
│       ├── config/             # database.ts, permissions.ts
│       ├── jobs/               # noShowJobs.ts (cron: daily + hourly)
│       ├── utils/              # logger.ts
│       └── scripts/            # seed.ts, importKaggle.ts
│
├── ml-service/                 # Python + FastAPI + scikit-learn
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       └── main.py             # /predict, /train, /model/info
│
└── frontend/                   # React + TypeScript + Tailwind CSS
    ├── Dockerfile
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.js
    └── src/
        ├── App.tsx             # Router with 14 routes
        ├── main.tsx            # React entry point
        ├── pages/              # 14 page components
        ├── components/         # AppointmentModal, Layout, Header, Sidebar
        ├── context/            # AuthContext (JWT state management)
        ├── services/           # api.ts (Axios with JWT interceptor)
        ├── types/              # TypeScript interfaces
        └── styles/             # Tailwind base + custom CSS
```

---

## Local Development (without Docker)

If you prefer to run services locally without Docker:

### 1. MongoDB

Install and start MongoDB locally, or use MongoDB Atlas.

### 2. Backend

```bash
cd backend
cp .env.example .env
# Edit .env with your MongoDB connection string
npm install
npm run dev
```

### 3. ML Service

```bash
cd ml-service
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## Troubleshooting

### Docker Desktop not running (Windows)

```
error during connect: Get "http://%2F%2F.%2Fpipe%2Fdocker_engine/...": open //./pipe/docker_engine: The system cannot find the file specified.
```

**Fix:** Open Docker Desktop and wait for it to fully start before running commands.

### Container keeps restarting

```bash
docker logs hospital-backend
```

Check the error output. Common causes:
- MongoDB not ready yet — wait 30 seconds and try again
- Port already in use — stop any other services on ports 3000/5000/8000/27017

### PowerShell curl error

PowerShell aliases `curl` to `Invoke-WebRequest`. Use one of:

```powershell
# Option 1: Use curl.exe explicitly
curl.exe -X POST http://localhost:8000/train

# Option 2: Use PowerShell native
Invoke-WebRequest -Method POST -Uri http://localhost:8000/train
```

### Import script TypeScript error

If you see a TypeScript compilation error during import:

```bash
docker exec -it hospital-backend npx ts-node --skipProject src/scripts/importKaggle.ts /data
```

### ML model not scoring appointments

1. Check if the model is trained: `curl http://localhost:8000/model/info`
2. If `model_loaded: false`, train it: `curl.exe -X POST http://localhost:8000/train`
3. If training fails, check the ML container logs: `docker logs hospital-ml`

### Rebuilding after code changes

```bash
docker-compose down
docker-compose up --build -d
```

### Full reset (delete all data)

```bash
docker-compose down -v
docker-compose up --build -d
# Then re-import data and retrain
```

---

## Stopping the Application

```bash
docker-compose down
```

To also remove the database volume (deletes all data):

```bash
docker-compose down -v
```
