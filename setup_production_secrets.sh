#!/bin/bash

# =============================================================================
# 🔐 HR Pinnacle - Production Secrets Setup
# =============================================================================
# This script sets up all required secrets in Google Cloud Secret Manager
# for production deployment with fresh Google Cloud SQL database.
# =============================================================================

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

echo -e "${GREEN}🔐 Setting up Production Secrets for HR Pinnacle${NC}"
echo "=================================================="
echo ""

# Check if gcloud is set to correct project
current_project=$(gcloud config get-value project 2>/dev/null)
expected_project="supervity-witty"

if [ "$current_project" != "$expected_project" ]; then
    print_warning "Current project: $current_project, expected: $expected_project"
    print_status "Setting project to $expected_project..."
    gcloud config set project $expected_project
fi

print_status "Project: $(gcloud config get-value project)"
echo ""

# Database secrets for fresh Google Cloud SQL instance
print_status "🗄️ Setting up database secrets for fresh Cloud SQL instance..."
echo "/cloudsql/supervity-witty:us-central1:hr-pinnacle-final" | gcloud secrets create postgres-host --data-file=- 2>/dev/null || \
echo "/cloudsql/supervity-witty:us-central1:hr-pinnacle-final" | gcloud secrets versions add postgres-host --data-file=-
print_success "Set postgres-host"

echo "postgres" | gcloud secrets create postgres-user --data-file=- 2>/dev/null || \
echo "postgres" | gcloud secrets versions add postgres-user --data-file=-
print_success "Set postgres-user" 

echo "postgres" | gcloud secrets create postgres-db --data-file=- 2>/dev/null || \
echo "postgres" | gcloud secrets versions add postgres-db --data-file=-
print_success "Set postgres-db"

echo "Hrpinnaclefinal99$" | gcloud secrets create postgres-password --data-file=- 2>/dev/null || \
echo "Hrpinnaclefinal99$" | gcloud secrets versions add postgres-password --data-file=-
print_success "Set postgres-password"

# JWT secret
jwt_secret="68ac3d39ce7fefbaccfbcc99a4a407c2250585c9cec1f8048bd3a75da97ba31d423c4aa62aaf5e2931dea9a1d625b76115ce70388d5891294121c25eb26d5c51"
echo "$jwt_secret" | gcloud secrets create jwt-secret-key --data-file=- 2>/dev/null || \
echo "$jwt_secret" | gcloud secrets versions add jwt-secret-key --data-file=-
print_success "Set jwt-secret-key"

# AI API keys
echo "AIzaSyCxH8L-GIR6ZXVWIzzmaGhPIjJqb4JFrE8" | gcloud secrets create gemini-api-key --data-file=- 2>/dev/null || \
echo "AIzaSyCxH8L-GIR6ZXVWIzzmaGhPIjJqb4JFrE8" | gcloud secrets versions add gemini-api-key --data-file=-
print_success "Set gemini-api-key"

# HeyGen API keys (primary + 8 additional)
print_status "🎬 Setting up HeyGen API keys (9 total)..."

echo "sk_V2_hgu_REDACTED" | gcloud secrets create heygen-api-key --data-file=- 2>/dev/null || \
echo "sk_V2_hgu_REDACTED" | gcloud secrets versions add heygen-api-key --data-file=-
print_success "Set heygen-api-key (primary)"

echo "sk_V2_hgu_REDACTED" | gcloud secrets create heygen-api-key-1 --data-file=- 2>/dev/null || \
echo "sk_V2_hgu_REDACTED" | gcloud secrets versions add heygen-api-key-1 --data-file=-
print_success "Set heygen-api-key-1"

echo "sk_V2_hgu_REDACTED" | gcloud secrets create heygen-api-key-2 --data-file=- 2>/dev/null || \
echo "sk_V2_hgu_REDACTED" | gcloud secrets versions add heygen-api-key-2 --data-file=-
print_success "Set heygen-api-key-2"

echo "sk_V2_hgu_REDACTED" | gcloud secrets create heygen-api-key-3 --data-file=- 2>/dev/null || \
echo "sk_V2_hgu_REDACTED" | gcloud secrets versions add heygen-api-key-3 --data-file=-
print_success "Set heygen-api-key-3"

echo "sk_V2_hgu_REDACTED" | gcloud secrets create heygen-api-key-4 --data-file=- 2>/dev/null || \
echo "sk_V2_hgu_REDACTED" | gcloud secrets versions add heygen-api-key-4 --data-file=-
print_success "Set heygen-api-key-4"

echo "sk_V2_hgu_REDACTED" | gcloud secrets create heygen-api-key-5 --data-file=- 2>/dev/null || \
echo "sk_V2_hgu_REDACTED" | gcloud secrets versions add heygen-api-key-5 --data-file=-
print_success "Set heygen-api-key-5"

echo "sk_V2_hgu_REDACTED" | gcloud secrets create heygen-api-key-6 --data-file=- 2>/dev/null || \
echo "sk_V2_hgu_REDACTED" | gcloud secrets versions add heygen-api-key-6 --data-file=-
print_success "Set heygen-api-key-6"

echo "sk_V2_hgu_REDACTED" | gcloud secrets create heygen-api-key-7 --data-file=- 2>/dev/null || \
echo "sk_V2_hgu_REDACTED" | gcloud secrets versions add heygen-api-key-7 --data-file=-
print_success "Set heygen-api-key-7"

echo "sk_V2_hgu_REDACTED" | gcloud secrets create heygen-api-key-8 --data-file=- 2>/dev/null || \
echo "sk_V2_hgu_REDACTED" | gcloud secrets versions add heygen-api-key-8 --data-file=-
print_success "Set heygen-api-key-8"

# Other secrets
echo "webhook_secret_placeholder" | gcloud secrets create heygen-webhook-secret --data-file=- 2>/dev/null || \
echo "webhook_secret_placeholder" | gcloud secrets versions add heygen-webhook-secret --data-file=-
print_success "Set heygen-webhook-secret"

echo "aiva-heygen-videos" | gcloud secrets create google-cloud-storage-bucket --data-file=- 2>/dev/null || \
echo "aiva-heygen-videos" | gcloud secrets versions add google-cloud-storage-bucket --data-file=-
print_success "Set google-cloud-storage-bucket"

echo ""
echo -e "${GREEN}🎉 All secrets configured successfully!${NC}"
echo ""
echo "✅ Database: Fresh Google Cloud SQL instance configured"  
echo "✅ AI APIs: Gemini API key configured"
echo "✅ HeyGen: 9 API keys configured for high-volume generation"
echo "✅ Storage: aiva-heygen-videos bucket configured"
echo ""
echo "🚀 Ready to run: ./deploy.sh deploy"
