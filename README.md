# Full-Stack Development Template

A production-ready template for building modern web applications with FastAPI backend and Next.js frontend, containerized with Docker for seamless local development and production deployment.

## 🏗️ Tech Stack

**Backend:**
- FastAPI (Python web framework)
- Gunicorn (WSGI server for production)
- Uvicorn (ASGI server)

**Frontend:**
- Next.js 15 with React 19
- TypeScript
- Tailwind CSS
- Radix UI components

**Infrastructure:**
- Docker & Docker Compose
- Multi-stage Docker builds for optimized production images

## 📁 Project Structure

```
├── app/                    # FastAPI backend application
│   └── main.py            # Main FastAPI app with health checks & CORS
├── frontend/              # Next.js frontend application
│   ├── src/               # Source code
│   ├── Dockerfile         # Frontend container config
│   └── package.json       # Dependencies & scripts
├── gunicorn/              # Gunicorn server configurations
│   ├── dev.py             # Development settings (hot reload)
│   └── prod.py            # Production settings (optimized)
├── packages/              # Python dependencies
│   └── requirements.txt   # Backend package requirements
├── docker-compose.yml     # Multi-container orchestration
├── Dockerfile             # Backend container config (multi-stage)
├── Makefile              # Development workflow automation
└── README.md             # This file
```

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Make (optional, for convenient commands)

### Local Development

1. **Clone and start services:**
   ```bash
   git clone <your-repo-url>
   cd <project-directory>
   make up
   ```
   
   Or without Make:
   ```bash
   docker-compose up --build -d
   ```

2. **Access your application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - Health check: http://localhost:8000/api/health

3. **View logs:**
   ```bash
   make logs-fe    # Frontend logs
   make logs-be    # Backend logs
   ```

4. **Stop services:**
   ```bash
   make down
   ```

## 🛠️ Available Commands

The Makefile provides convenient shortcuts for common development tasks:

```bash
make help           # Show all available commands
make up             # Start all services
make down           # Stop all services
make logs-be        # View backend logs
make logs-fe        # View frontend logs
```

### Database Migration Commands (when database is configured)
```bash
make migrate-create MSG='description'   # Create new migration
make migrate-up                         # Apply pending migrations
make migrate-down                       # Rollback one migration
make migrate-history                    # Show migration history
make reset-db                           # Clean & reinitialize database
```

## 🌐 Environment Configuration

### Development
The template works out-of-the-box for local development with sensible defaults.

### Production
Configure environment variables in `docker-compose.yml` or use a `.env` file:

```bash
# Example production environment variables
NODE_ENV=production
FRONTEND_URL=https://your-domain.com
GUNICORN_LOG_LEVEL=info
WEB_CONCURRENCY=2
WORKER_CONNECTIONS=1000
GUNICORN_TIMEOUT=120

# Database (uncomment in docker-compose.yml when ready)
# PG_USER=your_db_user
# PG_PASSWORD=your_db_password
# PG_HOST=your_db_host
# PG_PORT=5432
# PG_DB_NAME=your_db_name

# Add other service-specific variables as needed
```

## 🚢 Deployment

### Local Production Testing
```bash
# Use production gunicorn config
docker-compose up --build -d
# Backend will use gunicorn/dev.py by default
# For production testing, modify docker-compose.yml to use gunicorn/prod.py
```

### Production Deployment
1. Set environment variables for your production environment
2. Use the production Gunicorn configuration
3. Configure reverse proxy (nginx/traefik) if needed
4. Set up SSL certificates
5. Configure monitoring and logging

## 🔧 Customization

### Adding Dependencies

**Backend:**
```bash
# Add to packages/requirements.txt
echo "new-package==1.0.0" >> packages/requirements.txt
# Rebuild containers
make down && make up
```

**Frontend:**
```bash
# Add to frontend/package.json or run:
docker-compose exec frontend npm install new-package
# Rebuild containers
make down && make up
```

### Extending the API
- Add new routes in `app/main.py` or create separate router files
- The FastAPI app includes CORS middleware configured for frontend communication
- Health check endpoint (`/api/health`) is required for Docker health checks

### Frontend Configuration
- Modify `frontend/src/app/page.tsx` to customize the home page
- Add new pages in `frontend/src/app/`
- Configure API base URL via `NEXT_PUBLIC_API_URL` environment variable

## 🔍 Key Features

- **Hot Reload**: Backend code changes trigger automatic reloads in development
- **Health Checks**: Docker health checks ensure services are running correctly
- **CORS Configuration**: Pre-configured for frontend-backend communication
- **Multi-stage Builds**: Optimized Docker images for production
- **Flexible Configuration**: Environment-based settings for different deployment scenarios
- **Development Tools**: Comprehensive Makefile for common tasks

## 📝 Development Notes

- The backend runs on port 8000, frontend on port 3000
- CORS is configured to allow frontend communication
- Database configuration is commented out but ready to uncomment when needed
- Migration tools are set up for future database schema management
- Both services restart automatically unless stopped

## 🆘 Troubleshooting

**Services won't start:**
- Ensure ports 3000 and 8000 are available
- Check Docker daemon is running
- View logs: `make logs-be` or `make logs-fe`

**CORS errors:**
- Verify `FRONTEND_URL` environment variable matches your frontend URL
- Check browser network tab for actual request URLs

**Database connection issues:**
- Uncomment and configure database settings in `docker-compose.yml`
- Ensure database service is running and accessible

---

Happy coding! 🎉 This template is designed to get you up and running quickly while providing a solid foundation for scaling your application.
