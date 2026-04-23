# MedBook — Hospital Appointment Management System

A full-stack healthcare appointment management platform with predictive no-show analytics, built as part of a Harvard thesis research project.

## Architecture

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React + TypeScript + Tailwind CSS | Patient & staff web portal |
| Backend API | Node.js + Express + TypeScript | REST API, business logic, RBAC |
| Database | MongoDB 7 | Persistent data storage |
| ML Service | Python + FastAPI + scikit-learn | No-show prediction (Gradient Boosting) |
| Orchestration | Docker Compose | One-command deployment |

## Features

- **Multi-role access**: Admin, Doctor, Receptionist, Nurse, Patient, Data Analyst, Manager
- **Appointment management**: Online booking, receptionist booking, walk-in queue
- **Department & specialty structure**: Configurable departments with sub-specialties
- **No-show prediction**: ML model scores each appointment at booking time
- **Automated reconfirmation**: High-risk patients notified 2 days before, 24hr to confirm
- **Slot reallocation**: Unconfirmed slots offered to next-day patients automatically
- **Dashboards & reports**: No-show rates, prediction accuracy, department analytics
- **Audit logging**: All critical actions tracked for compliance

## Quick Start

### Prerequisites
- Docker & Docker Compose installed

### 1. Clone and start
```bash
cd hospital-app
docker-compose up --build
```

### 2. Seed demo data
```bash
# In a new terminal
docker exec -it hospital-backend npm run seed
```

### 3. Access the application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000/api
- **ML Service**: http://localhost:8000/docs

### 4. Train the ML model
```bash
curl -X POST http://localhost:8000/train
```

## Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@hospital.com | Admin123! |
| Doctor | dr.smith@hospital.com | Doctor123! |
| Receptionist | reception@hospital.com | Reception123! |
| Nurse | nurse@hospital.com | Nurse123! |
| Data Analyst | analyst@hospital.com | Analyst123! |
| Manager | manager@hospital.com | Manager123! |
| Patient | john.doe@email.com | Patient123! |

## Local Development (without Docker)

### Backend
```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

### ML Service
```bash
cd ml-service
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## No-Show Prediction Workflow

1. **At booking**: ML model scores the appointment (0-1 probability)
2. **Risk classification**: Low (<0.3), Medium (0.3-0.6), High (>0.6)
3. **2 days before**: High-risk patients receive notification to confirm
4. **24hr deadline**: Patient must confirm via web app login
5. **If no confirmation**: Slot reallocated to next-day patients who confirm
6. **Original patient**: Notified their appointment was moved, can rebook

## ML Model Features

The Gradient Boosting classifier uses these features:
- `lead_time_days`: Days between booking and appointment
- `hour_of_day`, `day_of_week`: Temporal patterns
- `no_show_rate`, `no_show_count`: Patient history (strongest predictor)
- `total_appointments`, `attended_count`: Engagement history
- `age`, `gender`: Demographics
- `appointment_type`: Visit category
- `is_new_patient`: First-time flag

## API Endpoints

### Auth
- `POST /api/auth/login` — Login
- `POST /api/auth/register` — Patient registration
- `GET /api/auth/profile` — Get profile

### Appointments
- `GET /api/appointments` — List (role-filtered)
- `POST /api/appointments` — Create
- `GET /api/appointments/slots` — Available slots
- `POST /api/appointments/:id/confirm` — Patient confirms
- `GET /api/appointments/dashboard` — Dashboard stats

### Departments
- `GET /api/departments` — List all
- `GET /api/departments/:id` — With doctors
- `GET /api/departments/specialties/all` — Specialties

### Patients
- `GET /api/patients` — List (searchable)
- `GET /api/patients/:id/history` — Full history

### Walk-In Queue
- `POST /api/walk-in` — Add to queue
- `GET /api/walk-in/:departmentId` — Current queue
- `POST /api/walk-in/:departmentId/call-next` — Call next

### Reports
- `GET /api/reports/overview` — System overview
- `GET /api/reports/no-shows` — No-show analytics
- `GET /api/reports/reminders` — Reminder effectiveness

## Project Structure

```
hospital-app/
├── docker-compose.yml
├── backend/
│   ├── src/
│   │   ├── models/          # MongoDB schemas
│   │   ├── controllers/     # Route handlers
│   │   ├── routes/          # Express routes
│   │   ├── middleware/      # Auth, audit logging
│   │   ├── config/          # DB, permissions
│   │   ├── jobs/            # Cron: no-show checks, reallocation
│   │   ├── utils/           # Logger
│   │   └── server.ts        # Entry point
│   └── Dockerfile
├── ml-service/
│   ├── app/
│   │   └── main.py          # FastAPI + scikit-learn model
│   └── Dockerfile
└── frontend/
    ├── src/
    │   ├── pages/            # Dashboard, Appointments, Book, etc.
    │   ├── components/       # Layout, Sidebar, Header
    │   ├── context/          # Auth provider
    │   ├── services/         # API client
    │   ├── types/            # TypeScript interfaces
    │   └── styles/           # Tailwind + custom CSS
    └── Dockerfile
```

## License

This project was developed as part of a thesis at Harvard University.
