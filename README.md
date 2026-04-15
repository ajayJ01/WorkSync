
# WorkSync

WorkSync is a full-stack task management platform with role-based access for Admin and User, plus an AI assistant that can understand task commands in natural language (Hindi/English mix), return analytics, and trigger safe task actions with confirmation when needed.

## What This Project Includes

- Admin + user authentication using JWT
- Task lifecycle: `pending -> in_progress -> submitted -> verified/rejected/cancelled/due`
- Create, assign, edit, cancel, start, submit, verify, and reject tasks
- File attachments (PDF/images) stored on S3-compatible storage
- Filters, pagination, date ranges, and export to Excel/PDF
- Auto-refresh dashboards and task lists
- AI chat assistant with command routing, contextual task understanding, file input, and voice input on supported browsers
- Intent monitoring APIs and smart intent classifier with fallback chain (pattern -> local NLP -> LLM)

## Tech Stack

### Frontend
- Vue 3 + Vite
- Vue Router, Pinia
- Bootstrap 5
- Axios
- Flatpickr
- vue-multiselect
- vue-toast-notification
- jsPDF + xlsx for export

### Backend
- Fastify
- MongoDB + Mongoose
- JWT auth
- Fastify multipart + static + CORS
- Node Cron (due-task updater)
- AWS SDK S3 client (for file uploads)
- Node NLP + Groq API (AI classifier/assistant path)

## High-Level Architecture

```text
Frontend (Vue) -> Fastify API -> MongoDB
                      |
                      +-> S3 file upload (task attachments)
                      +-> AI routing (pattern/NLP/LLM)
                      +-> Cron: auto-mark overdue tasks as "due"
```

## Project Structure

```text
WorkSync/
|-- backend/
|   |-- config/              # DB connection
|   |-- controllers/         # auth, task, ai, intent monitor
|   |-- cron/                # due status updater
|   |-- middlewares/         # auth middleware
|   |-- models/              # User, Task
|   |-- routes/              # auth/user/task/intent routes
|   |-- utils/               # AI, upload, date parsing, helpers
|   |-- validations/         # Fastify schema validators
|   |-- server.js
|   `-- createAdmin.js
|-- frontend/
|   |-- src/components/      # chatbot, pagination, navbar
|   |-- src/views/           # dashboards, task screens, auth
|   |-- src/services/        # axios client + request wrapper
|   |-- src/router/
|   `-- src/composables/
|-- package.json             # root scripts (concurrently)
`-- README.md
```

## Setup

## 1) Install dependencies

From project root:

```bash
npm install
npm --prefix backend install
npm --prefix frontend install
```

## 2) Configure backend env

Create `backend/.env`:

```env
# Server
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://127.0.0.1:27017/worksync

# Auth
JWT_SECRET=replace_with_a_strong_secret

# AI
GROQ_API_KEY=your_groq_key
AI_CHAT_TASKS_LIMIT=200

# File Upload (S3)
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_S3_BUCKET=your_bucket_name
```

Notes:
- If `GROQ_API_KEY` is missing, AI flow still works with non-LLM fallbacks for many intents.
- S3 env vars are required when creating/updating/submitting tasks with file attachments.

## 3) Configure frontend env

Create `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:5000/
```

## 4) (Optional) Seed initial admin

```bash
node backend/createAdmin.js
```

Default seed in script:
- Email: `admin@worksync.com`
- Password: `admin@workSync`

Change these before using in production.

## Run The App

From project root:

```bash
npm run dev
```

This starts:
- Backend on `http://localhost:5000`
- Frontend on Vite default port (usually `http://localhost:5173`)

## Available Scripts

### Root

```bash
npm run dev
```

Runs backend + frontend together using concurrently.

### Backend (`backend/`)

```bash
npm run dev
npm start
```

### Frontend (`frontend/`)

```bash
npm run dev
npm run build
npm run preview
npm run lint
npm run format
```

## Core API Routes

All routes except `/` require auth where noted.

### Auth
- `POST /register`
- `POST /login`
- `POST /logout` (auth)

### User
- `GET /me` (auth)
- `GET /users` (auth)

### Tasks
- `POST /tasks/create` (auth, multipart)
- `PUT /tasks/:id/update` (auth, multipart)
- `GET /tasks` (auth)
- `GET /my-tasks` (auth)
- `POST /my-tasks/:id/start` (auth)
- `POST /my-tasks/:id/submit` (auth, multipart)
- `PUT /tasks/:id/cancel` (auth)
- `PUT /tasks/:id/admin-task-verify` (auth)

### AI Assistant
- `POST /ai/command` (auth, supports text + optional file + contextTaskIds)
- `POST /ai/confirm` (auth, for destructive/bulk confirmations)

### Intent Monitoring
- `GET /intent-stats` (auth)
- `POST /test-intent` (auth)
- `POST /reset-learning` (auth)

## Frontend Route Map

- `/login`
- `/dashboard` -> role-aware (admin dashboard or user dashboard)
- `/tasks` -> admin task management
- `/my-tasks` -> user task management
- `/user/create` -> admin-only user creation

## AI Assistant Highlights

- Natural language commands for task listing, filtering, and actions
- Confirmation gate for risky operations (e.g., bulk cancel/start)
- Maintains recent task context so follow-up commands like "iski file update karo" work better
- Supports chat file upload (`pdf/png/jpg/jpeg/webp`) and browser voice input where available
- Can drive export flows (Excel/PDF) from chat

## Task Status Automation

- Cron runs every minute in backend
- Tasks with past due date and status `pending` or `in_progress` are auto-marked as `due`

## Deployment Notes

- Set strong `JWT_SECRET`
- Use managed MongoDB and secure network rules
- Use production-grade S3 bucket policy and key management
- Set correct `VITE_API_BASE_URL` for frontend deployment
- Consider process manager (PM2/systemd) for backend uptime

## Health Check

```bash
GET /
```

Returns uptime, status, and timestamp from backend.

## Current Limitations

- No automated test suite committed yet
- Role checks are partly frontend-driven for some UI paths, so strict backend authorization hardening should be reviewed before production
- Seed admin credentials are hardcoded in script (should be replaced for secure environments)
