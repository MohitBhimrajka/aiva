# Development Tools

This directory contains development utilities, debug scripts, and documentation that are not part of the main production application.

## Directory Structure

### debug/
Development and debugging utilities:
- `debug_startup.py` - Debug script for troubleshooting startup issues
- `minimal_debug_startup.sh` - Minimal startup script for debugging

### scripts/
Development and utility scripts:
- `export_database.py` - Database export utility
- `make_ingest.py` - Data ingestion script
- `discover_all_resources.py` - Resource discovery utility
- `seed_10_users.py` - Script to seed 10 test users

### docs/
Development documentation and assets:
- `markdown/` - Development documentation in markdown format
- `pdf/` - PDF documentation and assets

## Usage

These tools are intended for development and debugging purposes only. They are not part of the production deployment and should not be used in production environments.

## Note

Files in this directory are excluded from production builds and deployments via `.gitignore` patterns.
