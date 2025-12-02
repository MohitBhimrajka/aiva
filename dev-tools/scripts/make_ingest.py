# make_ingest.py

import sys
import os
import subprocess
import logging

# Configure logging
def get_log_level():
    """Get log level from environment variable, defaulting to INFO"""
    log_level_str = os.getenv("LOG_LEVEL", "INFO").upper()
    log_levels = {
        "DEBUG": logging.DEBUG,
        "INFO": logging.INFO,
        "WARNING": logging.WARNING,
        "ERROR": logging.ERROR,
        "CRITICAL": logging.CRITICAL,
    }
    return log_levels.get(log_level_str, logging.INFO)

logging.basicConfig(
    level=get_log_level(),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def generate_digest_cli(source, output_file="digest.txt", exclude_exts=None, is_frontend=False):
    cmd = ["gitingest", source, "-o", output_file]

    # Frontend-specific exclusions when processing frontend folder
    if is_frontend:
        exclusions = [
            # Documentation directories
            "docs",
            "docs/*",
            "docs/**",
            # Build and cache directories
            "node_modules",
            "node_modules/*",
            ".next",
            ".next/*",
            ".next/**",
            "out",
            "out/*",
            "build",
            "build/*", 
            "dist",
            "dist/*",
            ".cache",
            # Generated files and manifests
            "package-lock.json",
            "yarn.lock",
            "pnpm-lock.yaml", 
            ".tsbuildinfo",
            "*.tsbuildinfo",
            # All manifest files
            "*-manifest.json",
            "*-manifest.js",
            "BUILD_ID",
            "trace",
            "transform.js",
            "transform.js.map",
            # Build chunks and generated JS files
            "chunks",
            "chunks/*",
            "chunks/**",
            # Generated JS files with hash patterns
            "*__*._.js",
            "*_*._.js", 
            "*._.js",
            # Static build files
            "static", 
            "static/*",
            "static/**",
            # Server build files
            "server",
            "server/*",
            "server/**", 
            # Development build files
            "development",
            "development/*",
            "_buildManifest.js",
            "_clientMiddlewareManifest.json",
            "_ssgManifest.js",
            # Cache files
            "cache",
            "cache/*",
            ".rscinfo",
            # Types directory (generated)
            "types",
            "types/*",
            # Test and coverage
            "coverage",
            "__tests__/coverage",
            ".nyc_output",
            # Static assets (keep essential ones, exclude bulk assets)
            "public/images",
            "public/fonts", 
            # IDE and system files
            ".vscode",
            ".idea",
            ".DS_Store",
            # Storybook
            "storybook-static",
            ".storybook-build",
            # Environment files
            ".env",
            ".env.*",
            ".env.example",
            # Docker files
            ".dockerignore",
            "*.dockerignore",
            # Font files (binary assets)
            "*.ttf",
            "*.woff",
            "*.woff2",
            "*.otf",
            "*.eot",
            # Digest output file (prevent recursive ingestion)
            "digest.txt",
            # Temporary files
            "*.log",
            "npm-debug.log*",
            "yarn-debug.log*",
            "yarn-error.log*"
        ]
    else:
        # Default exclusions for non-frontend directories
        exclusions = [
        # Documentation directories
        "docs",
        "docs/*",
        "docs/**",
        "*/docs",
        "*/docs/*",
        "*/docs/**",
        # Next.js build artifacts (these should be excluded everywhere)
        ".next",
        ".next/*",
        ".next/**",
        "frontend/.next",
        "frontend/.next/*",
        "frontend/.next/**",
        "*/.next",
        "*/.next/*",
        "*/.next/**",
        # Build manifests and generated files
        "*-build-manifest.json",
        "*-manifest.json",
        "*-manifest.js",
        "BUILD_ID",
        "trace",
        "transform.js",
        "transform.js.map",
        "*.tsbuildinfo",
        # Build directories and artifacts
        "build",
        "build/*",
        "build/**",
        "dist",
        "dist/*", 
        "dist/**",
        "out",
        "out/*",
        "out/**",
        # System and IDE files
        ".DS_Store",
        "*/.DS_Store",
        "**/.DS_Store",
        ".vscode",
        ".idea",
        # Alembic migrations (keep for reference but exclude from digest)
        "alembic",
        "alembic/*",
        "alembic/**",
        "alembic.ini",
        # Utility and setup scripts (non-core business logic)
        "export_database.py",
        "make_ingest.py",
        "start_gunicorn.sh",
        # Database files
        "*.sqlite3",
        "*.sqlite",
        "*.db",
        # Python-related
        "__pycache__",
        "__pycache__/*",
        "*/__pycache__",
        "*/__pycache__/*",
        "**/__pycache__/**",
        "*.pyc",
        "*.pyo",
        "*.egg-info",
        ".pytest_cache",
        "venv",
        "venv/*",
        ".venv",
        "env",
        ".env",
        ".env.example",
        "*.env.example",
        # Docker files
        ".dockerignore",
        "*.dockerignore",
        "docker-compose.override.yml",
        # Font files (binary assets)
        "*.ttf",
        "*.woff",
        "*.woff2",
        "*.otf",
        "*.eot",
        # Credentials and sensitive files
        "gcp-credentials.json",
        "*credentials*.json",
        "*.pem",
        "*.key",
        # Digest output file (prevent recursive ingestion)
        "digest.txt",
        # Poetry and dependency management
        "poetry.lock",
        "*/poetry.lock",
        # Version control
        ".git",
        # System files
        "Thumbs.db",
        "desktop.ini",
        # Build and distribution
        "*.egg",
        # Logs and temporary files
        "*.tmp",
        "*.temp",
        "logs",
        # Documentation and media files
        "*.doc",
        "*.docx",
        "*.xls",
        "*.xlsx",
        "*.ppt",
        "*.pptx",
        "*.swp",
        "*.swo",
        # Node.js and React/Next.js related - comprehensive exclusions
        "node_modules",
        "node_modules/*",
        "*/node_modules",
        "*/node_modules/*",
        "**/node_modules/**",
        "frontend/node_modules",
        "frontend/node_modules/*",
        "frontend/package-lock.json",
        "frontend/yarn.lock", 
        "frontend/pnpm-lock.yaml",
        # Lock files (keep main package.json but exclude locks)
        "package-lock.json",
        "yarn.lock",
        "pnpm-lock.yaml",
        "npm-debug.log",
        "yarn-error.log",
        # Cache directories
        ".cache",
        ".parcel-cache",
        ".vercel",
        ".netlify",
        ".turbo",
        ".swc",
        # Test coverage
        "coverage",
        ".nyc_output",
        # Storybook
        ".storybook-build", 
        "storybook-static",
        # Frontend build artifacts and static files
        "build-manifest.json",
        "app-build-manifest.json", 
        "fallback-build-manifest.json",
        "next-minimal-server.js.nft.json",
        "next-server.js.nft.json",
        "export-marker.json",
        "images-manifest.json",
        "prerender-manifest.json",
        "routes-manifest.json",
        "required-server-files.json",
        "app-path-routes-manifest.json",
        "app-paths-manifest.json",
        "react-loadable-manifest.json",
        "server-reference-manifest.json",
        "server-reference-manifest.js",
        "pages-manifest.json",
        "next-font-manifest.json",
        "next-font-manifest.js",
        "middleware-manifest.json",
        "middleware-build-manifest.js",
        "interception-route-rewrite-manifest.js",
        "BUILD_ID",
        "trace",
        "transform.js",
        "transform.js.map",
        # Build chunks and generated JS files
        "chunks",
        "chunks/*",
        "chunks/**",
        "*/chunks",
        "*/chunks/*",
        "*/chunks/**",
        "**/chunks/**",
        # Generated JS files with hash patterns
        "*__*._.js",
        "*_*._.js", 
        "*._.js",
        # Static build files
        "static",
        "static/*",
        "static/**",
        "*/static",
        "*/static/*",
        "*/static/**",
        # Server build files
        "server",
        "server/*", 
        "server/**",
        "*/server",
        "*/server/*",
        "*/server/**",
        # Development build files
        "development",
        "development/*",
        "*/development",
        "*/development/*",
        "_buildManifest.js",
        "_clientMiddlewareManifest.json", 
        "_ssgManifest.js",
        # Cache files
        "cache",
        "cache/*",
        "*/cache",
        "*/cache/*",
        ".rscinfo",
        # Types directory (generated)
        "types",
        "types/*",
        "*/types",
        "*/types/*",
        # Archives
        "*.zip",
        "*.tar",
        "*.tar.gz",
        "*.rar",
        "*.7z",
        # CSV and data files (non-core)
        "*.csv",
        "*.pdf",
    ]

    if exclude_exts:
        # Format extensions as "*.ext" and add to exclusions
        exclusions.extend(f"*{ext}" for ext in exclude_exts)

    if is_frontend:
        # Include only relevant frontend code files
        include_patterns = [
            "*.tsx",
            "*.ts",
            "*.jsx",
            "*.js",
            "*.css",
            "*.scss",
            "*.sass",
            "*.less",
            "*.module.css",
            "*.module.scss",
            "*.module.sass",
            "*.module.less",
            "*.json",  # For configuration files
            "*.html",
            "*.md"  # For documentation
        ]
        cmd += ["-i", ",".join(include_patterns)]

    if exclusions:
        patterns = ",".join(exclusions)
        cmd += ["-e", patterns]

    logger.info(f"Running: {' '.join(cmd)}")

    try:
        subprocess.run(cmd, check=True)
        logger.info(f"✅ Digest written to {output_file}")
    except subprocess.CalledProcessError as e:
        logger.error(f"❌ Error during gitingest execution: {e}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        logger.error(
            "Usage: python make_ingest.py <path_or_url> [output_file] [--frontend] [excluded_exts...]"
        )
        sys.exit(1)

    source = sys.argv[1]
    output_file = "digest.txt"
    exclude_exts = []
    is_frontend = False

    # Process arguments
    args = sys.argv[2:]
    while args:
        arg = args.pop(0)
        if arg == "--frontend":
            is_frontend = True
        elif arg.startswith("."):
            exclude_exts.append(arg)
        else:
            output_file = arg

    # Check if the source path contains 'frontend' and automatically set is_frontend
    if not is_frontend and ("frontend" in source.lower() or "front-end" in source.lower()):
        is_frontend = True
        logger.info("Detected frontend directory, using frontend-specific processing...")

    generate_digest_cli(source, output_file, exclude_exts, is_frontend)