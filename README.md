# AIVA - AI Virtual Interview Assistant

An interactive, AI-powered platform designed to help users practice for technical and behavioral interviews. This application provides a realistic interview experience with an AI assistant, delivering real-time, actionable feedback on not just *what* you say, but *how* you say it.

This project is built on a modern, production-ready, full-stack architecture using FastAPI for the backend and Next.js for the frontend, fully containerized with Docker.

---

## 🚀 Project Status & Roadmap

This project is being developed in distinct phases.

### ✅ **Phase 0: Foundation & Setup** `(Completed)`
- [x] Integrated PostgreSQL with SQLAlchemy ORM.
- [x] Implemented a secure, JWT-based user authentication system.
- [x] Defined core database schemas for Users, Roles, and Sessions.
- [x] Established the frontend structure with protected routes.

### ✅ **Phase 1: The Core Interview Loop (MVP)** `(Completed)`
- [x] **Role Selection:** Users can select an interview role and difficulty.
- [x] **Text-Based Interview:** A focused UI for answering questions via text.
- [x] **AI Content Analysis:** Integration with the Google Gemini API to analyze answer content, providing a score and detailed feedback.
- [x] **Static Avatar:** A visual placeholder for the AI interviewer.
- [x] **Post-Interview Report:** A detailed summary of performance, question by question.
- [x] **UI/UX Polish:** A dedicated "polish sprint" was completed to refine animations, add a distinct visual identity, and improve the overall user experience.

### ⏳ **Phase 2: Voice & Avatar Interactivity** `(Up Next)`
- [ ] **HeyGen Integration:** Bring the avatar to life by having it speak the questions in real-time.
- [ ] **Speech-to-Text:** Implement voice input for a hands-free, natural interview experience.
- [ ] **Session History:** Enhance the user dashboard to show a history of past interviews.

### ⏳ **Phase 3 & 4: Advanced Analytics & Scaling** `(Future Work)`
- [ ] **Facial & Vocal Analysis:** Integrate in-browser analysis of confidence, speaking pace, and filler words.
- [ ] **Dynamic Question Engine:** Implement a Retrieval-Augmented Generation (RAG) system for unique, adaptive interviews.
- [ ] **Cloud Deployment:** Finalize deployment configurations for scaling on GCP Cloud Run.

---

## 🏗️ Tech Stack

**Backend:**
- **FastAPI:** High-performance Python web framework.
- **SQLAlchemy:** Python SQL toolkit and Object Relational Mapper.
- **PostgreSQL:** Powerful, open-source object-relational database system.
- **Gunicorn & Uvicorn:** Production-grade web and ASGI servers.

**Frontend:**
- **Next.js 15 & React 19:** For building a modern, performant user interface.
- **TypeScript:** For type safety and a better developer experience.
- **Tailwind CSS & shadcn/ui:** For a utility-first, component-based design system.
- **Framer Motion:** For fluid and meaningful animations.

**AI & Services:**
- **Google Gemini API:** For all language model tasks, including answer analysis and feedback generation.

**Infrastructure:**
- **Docker & Docker Compose:** For containerization and local development orchestration.
- **Alembic:** For database schema migrations.

---

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Make (optional, for convenient commands)
- Google Gemini API key ([Get one here](https://makersuite.google.com/app/apikey))

### Initial Setup

1.  **Clone the repository:**
    ```bash
    git clone <your-repo-url>
    cd aiva  # or your project directory name
    ```

2.  **Configure environment variables:**
    ```bash
    # Copy the example environment file
    cp .env.example .env
    ```
    
    Then edit `.env` and fill in your actual values:
    - **Required:** `GEMINI_API_KEY` - Your Google Gemini API key
    - **Required:** `JWT_SECRET_KEY` - Generate a secure random key (see below)
    - **Optional:** Adjust `LOG_LEVEL`, `POSTGRES_PASSWORD`, etc. as needed
    
    **Generate a secure JWT secret key:**
    ```bash
    openssl rand -hex 64
    ```
    Copy the output and set it as `JWT_SECRET_KEY` in your `.env` file.

### Local Development

1.  **Start Services:**
    ```bash
    make up
    ```
    This command builds the Docker images and starts all services in detached mode.

2.  **Prepare the Database:**
    On the first run, you need to set up the database schema and add the sample data.
    ```bash
    # Apply all database migrations
    make migrate-up

    # Seed the database with roles and questions
    make seed-db
    ```

3.  **Access Your Application:**
    - **Frontend:** http://localhost:3000
    - **Backend API:** http://localhost:8000
    - **Health Check:** http://localhost:8000/api/health

---

## ⚙️ Configuration

### Environment Variables

All configuration is done through environment variables. Copy `.env.example` to `.env` and customize the values for your environment.

#### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `GEMINI_API_KEY` | Your Google Gemini API key | Get from [Google AI Studio](https://makersuite.google.com/app/apikey) |
| `JWT_SECRET_KEY` | Secret key for JWT token signing | Generate with: `openssl rand -hex 64` |

#### Database Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `POSTGRES_DB` | Database name | `aiva_database` |
| `POSTGRES_USER` | Database user | `aiva_user` |
| `POSTGRES_PASSWORD` | Database password | **Change in production!** |
| `POSTGRES_HOST` | Database host | `postgres` (for Docker) |
| `POSTGRES_PORT` | Database port | `5432` |

#### Application Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Node.js environment | `production` |
| `FRONTEND_URL` | Frontend application URL | `http://localhost:3000` |
| `API_URL` | Backend API URL | `http://localhost:8000` |

#### JWT Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `JWT_SECRET_KEY` | Secret key for signing JWT tokens | **Required - generate securely** |
| `JWT_ALGORITHM` | JWT signing algorithm | `HS256` |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | Token expiration time | `30` |

#### Logging Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `LOG_LEVEL` | Application log verbosity | `INFO` |

**Valid values:** `DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL`

- `DEBUG` - Detailed diagnostic information (development)
- `INFO` - General informational messages (default)
- `WARNING` - Warning messages only
- `ERROR` - Error messages only (production)
- `CRITICAL` - Critical errors only

**Example:**
```bash
# In your .env file
LOG_LEVEL=DEBUG  # For development
LOG_LEVEL=ERROR  # For production
```

---

## 💻 Development Workflow

This project is configured for a seamless development experience with hot-reloading for both the frontend and backend.

1.  **Start the services:**
    ```bash
    make up
    ```
2.  **Make code changes:**
    -   Any changes made inside the `./app/` directory will cause the FastAPI backend server to automatically restart.
    -   Any changes made inside the `./frontend/src/` directory will be reflected instantly in your browser via Next.js Fast Refresh.
3.  **View logs:**
    -   To see backend output (API requests, errors, logging statements), run `make logs-be`.
    -   To see frontend output, run `make logs-fe`.
    -   **Control log verbosity:** Set `LOG_LEVEL` in your `.env` file (e.g., `LOG_LEVEL=DEBUG` for detailed logs, `LOG_LEVEL=ERROR` for errors only).
4.  **Stop services:**
    ```bash
    make down
    ```
    The `-v` flag is included in the `make down` command to remove the database volume, ensuring a clean slate the next time you run `make up`. If you wish to preserve your database state between sessions, remove the `-v` from the `Makefile`.

---

## 🛠️ Available `make` Commands

The Makefile provides convenient shortcuts for common development tasks:

| Command                               | Description                                             |
| ------------------------------------- | ------------------------------------------------------- |
| `make help`                           | Show all available commands.                            |
| `make up`                             | Start all services.                                     |
| `make down`                           | Stop all services and remove containers.                |
| `make logs-be`                        | View real-time logs for the backend.                    |
| `make logs-fe`                        | View real-time logs for the frontend.                   |
| **Database Commands**                 |                                                         |
| `make migrate-create MSG='desc'`      | Create a new database migration.                        |
| `make migrate-up`                     | Apply all pending migrations to the database.           |
| `make migrate-down`                   | Rollback the database by one migration.                 |
| `make seed-db`                        | Populate the database with sample roles and questions.  |

---

## 🧪 Running Tests `(Placeholder)`

While a full test suite is under development, the framework is in place to run tests using `pytest` for the backend and `Jest`/`React Testing Library` for the frontend.

**Backend Tests:**
```bash
# (Example) Run all backend tests
docker-compose exec backend pytest
```

**Frontend Tests:**
```bash
# (Example) Run all frontend tests
docker-compose exec frontend npm test
```

---

## 📁 Project Structure

```
├── app/                    # FastAPI backend application
│   ├── routers/            # API route handlers
│   ├── services/           # Business logic (AI analyzer, TTS, etc.)
│   ├── models.py           # SQLAlchemy database models
│   ├── schemas.py          # Pydantic data schemas
│   └── main.py             # FastAPI application entry point
├── frontend/               # Next.js frontend application
│   ├── src/
│   │   ├── app/            # Next.js app router pages
│   │   ├── components/     # React components
│   │   └── hooks/          # Custom React hooks
├── alembic/                # Database migration scripts
├── scripts/                # Standalone Python scripts
│   ├── seed_data.py        # Database seeding script
│   └── check_db.py         # Database health check
├── gunicorn/               # Gunicorn server configurations
├── .env.example            # Environment variables template
├── docker-compose.yml      # Multi-container orchestration
├── Dockerfile              # Backend container configuration
├── start_gunicorn.sh       # Application startup script
└── Makefile                # Development workflow automation
```

---

## 🔒 Security Notes

- **Never commit your `.env` file** - it contains sensitive credentials
- **Generate secure JWT secrets** - Use `openssl rand -hex 64` for production
- **Change default passwords** - Update `POSTGRES_PASSWORD` for production deployments
- **Rotate API keys regularly** - Keep your `GEMINI_API_KEY` secure and rotate periodically

---