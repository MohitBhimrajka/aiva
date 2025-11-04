# make_ingest.py

import sys
import subprocess
import shutil
import os


def generate_digest_cli(source, output_file="digest.txt", exclude_exts=None, is_frontend=False):
    # Build command arguments first (will be used whether we call via subprocess or entry point)
    use_entry_point = False
    
    # Try to find gitingest executable
    gitingest_cmd = shutil.which("gitingest")
    if gitingest_cmd:
        cmd = [gitingest_cmd]
    else:
        # Try to find it in Python Scripts directory
        python_dir = os.path.dirname(sys.executable)
        scripts_dir = os.path.join(os.path.dirname(python_dir), "Scripts")
        gitingest_exe = os.path.join(scripts_dir, "gitingest.exe")
        if os.path.exists(gitingest_exe):
            cmd = [gitingest_exe]
        else:
            # Use entry point approach
            use_entry_point = True
            cmd = None

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
        # Project-specific directories
        "ai_ap_manager",
        "ai_ap_manager/*",
        "invoices",
        "processed_documents",
        "sample_data",
        "sample_data/*",
        "sample_data/**",
        "sample_data/invoices",
        "sample_data/invoices/*",
        "sample_data/invoices/**",
        "sample_data/demo_inoices",
        "sample_data/demo_inoices/*",
        "sample_data/demo_inoices/**",
        "sample_data/GRNs",
        "sample_data/GRNs/*",
        "sample_data/GRNs/**",
        "sample_data/POs",
        "sample_data/POs/*",
        "sample_data/POs/**",
        "sample_data/pdf_templates.py",
        # Generated documents and output files
        "generated_documents",
        "generated_documents/*",
        "generated_documents/**",
        "*.pdf",
        "REGEN_*.pdf",
        # Database export files
        "database_export",
        "database_export/*",
        "database_export/**",
        "database_export/csv",
        "database_export/csv/*",
        "database_export/json",
        "database_export/json/*",
        "ap_database_master.csv",
        "ap_database_master.json",
        "database_summary.txt",
        "export_summary.json",
        "alembic",
        "alembic/*",
        "alembic/**",
        "alembic.ini",
        "alembic.ini/*",
        "alembic.ini/**",
        "scripts/",
        "scripts/alembic/*",
        "scripts/alembic/**",
        "scripts/alembic.ini",
        "scripts/alembic.ini/*",
        "scripts/alembic.ini/**",
        "alembic.ini.py",
        # Token usage and monitoring files
        "token_usage",
        "token_usage/*",
        "token_usage/**",
        "job_*.json",
        "jobs_summary.json",
        # Script conversion and processing files
        "scripts/converted",
        "scripts/converted/*",
        "scripts/converted/**",
        "scripts/to_convert",
        "scripts/to_convert/*",
        "scripts/to_convert/**",
        "scripts/to_convert/processed",
        "scripts/to_convert/processed/*",
        "scripts/to_convert/processed/**",
        # Utility and setup scripts (non-core business logic)
        "scripts/data_generator.py",
        "scripts/file_converter.py",
        "scripts/verify_test_data.py",
        "export_database.py",
        "make_ingest.py",
        "run_fresh.py",
        "run.py",
        "start_gunicorn.sh",
        # Database files
        "*.sqlite3",
        "*.sqlite",
        "*.db",
        "ap_data.db",
        "chroma.sqlite3",
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
        # Poetry and dependency management
        "poetry.lock",
        "*/poetry.lock",
        "ai_ap_manager/*/poetry.lock",
        # Database and vector store files (ai_ap_manager specific)
        "chroma_db",
        "chroma_db/*",
        "*/chroma_db",
        "*/chroma_db/*",
        "**/chroma_db/**",
        "ai_ap_manager/*/chroma_db",
        "ai_ap_manager/*/chroma_db/*",
        # Binary data files (vector store related)
        "*.bin",
        "data_level0.bin",
        "ai_ap_manager/",
        "ai_ap_manager/*",
        "header.bin",
        "length.bin",
        "link_lists.bin",
        # Version control
        ".git",
        ".gitignore",
        # System files
        ".DS_Store",
        "Thumbs.db",
        "desktop.ini",
        # Build and distribution
        "build",
        "dist",
        "*.egg",
        # Logs and temporary files
        "*.log",
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
        "*.png",
        "*.jpg",
        "*.jpeg",
        "*.gif",
        "DOCKER_GUIDE.md",
        "FEATURES.md",
        "*.svg",
        "*.ico",
        "favicon.png",
        "favicon.ico",
        # IDE and editor files
        ".vscode",
        ".idea",
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
        "pdf.worker.mjs",
        "pdf.worker.min.mjs",
        # Archives
        "*.zip",
        "*.tar",
        "*.tar.gz",
        "*.rar",
        "*.7z",
        # CSV and data files (non-core)
        "*.csv",
        "grns.csv",
        "pos.json",
        "GRN_Header.csv",
        "GRN_LineItem.csv",
        "PO_Header.csv",
        "PO_LineItem.csv",
        "QC_RangIndia.csv",
        "QC_mahawat.pdf",
        "contract_*.pdf",
        "invoice_*.pdf",
        "Sindri*.pdf",
    ]

    if exclude_exts:
        # Format extensions as "*.ext" and add to exclusions
        exclusions.extend(f"*{ext}" for ext in exclude_exts)

    # Build command arguments
    cmd_args = [source, "-o", output_file]
    
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
        cmd_args += ["-i", ",".join(include_patterns)]

    if exclusions:
        patterns = ",".join(exclusions)
        cmd_args += ["-e", patterns]

    if use_entry_point:
        # Use entry point approach
        try:
            import importlib.metadata
            dist = importlib.metadata.distribution("gitingest")
            for ep in dist.entry_points:
                if ep.name == "gitingest" and ep.group == "console_scripts":
                    ep_func = ep.load()
                    # Store original argv
                    original_argv = sys.argv.copy()
                    # Set up sys.argv for the CLI
                    sys.argv = ["gitingest"] + cmd_args
                    try:
                        print("Running: gitingest", " ".join(cmd_args))
                        ep_func()
                        print(f"Digest written to {output_file}")
                        return
                    finally:
                        sys.argv = original_argv
                    break
            else:
                raise RuntimeError("gitingest entry point not found")
        except Exception as e:
            print(f"Error using entry point: {e}")
            raise
    else:
        # Use subprocess with executable
        cmd = cmd + cmd_args
        print("Running:", " ".join(cmd))
        try:
            subprocess.run(cmd, check=True)
            print(f"Digest written to {output_file}")
        except subprocess.CalledProcessError as e:
            print(f"Error during gitingest execution: {e}")
            raise


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(
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
        print("Detected frontend directory, using frontend-specific processing...")

    generate_digest_cli(source, output_file, exclude_exts, is_frontend)