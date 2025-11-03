#!/bin/bash

# =============================================================================
# 🚀 HR Pinnacle - Quick Deployment Script
# =============================================================================
# This script provides easy commands to deploy your HR Pinnacle application
# to Google Cloud using Cloud Build.
# =============================================================================

set -e  # Exit on any error

# Colors for pretty output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID="supervity-witty"
REGION="us-central1"

# Function to print colored output
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

print_header() {
    echo -e "${PURPLE}==============================================================================${NC}"
    echo -e "${PURPLE}$1${NC}"
    echo -e "${PURPLE}==============================================================================${NC}"
}

# Function to check prerequisites
check_prerequisites() {
    print_header "🔍 Checking Prerequisites"
    
    # Check if gcloud is installed
    if ! command -v gcloud &> /dev/null; then
        print_error "gcloud CLI is not installed. Please install it first."
        exit 1
    fi
    
    # Check if logged in
    if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" &> /dev/null; then
        print_error "You are not logged in to gcloud. Please run 'gcloud auth login'"
        exit 1
    fi
    
    # Check project
    current_project=$(gcloud config get-value project 2>/dev/null)
    if [ "$current_project" != "$PROJECT_ID" ]; then
        print_warning "Current project is '$current_project', expected '$PROJECT_ID'"
        print_status "Setting project to $PROJECT_ID..."
        gcloud config set project $PROJECT_ID
    fi
    
    print_success "Prerequisites check passed!"
}

# Function to update secrets
update_secrets() {
    print_header "🔐 Updating Secrets"
    
    echo "This will help you update your secrets in Google Secret Manager."
    echo ""
    
    read -p "Do you want to update postgres-host? (y/N): " update_host
    if [[ $update_host =~ ^[Yy]$ ]]; then
        read -p "Enter PostgreSQL host: " postgres_host
        echo "$postgres_host" | gcloud secrets versions add postgres-host --data-file=-
        print_success "Updated postgres-host"
    fi
    
    read -p "Do you want to update postgres-user? (y/N): " update_user
    if [[ $update_user =~ ^[Yy]$ ]]; then
        read -p "Enter PostgreSQL username: " postgres_user
        echo "$postgres_user" | gcloud secrets versions add postgres-user --data-file=-
        print_success "Updated postgres-user"
    fi
    
    read -p "Do you want to update postgres-password? (y/N): " update_password
    if [[ $update_password =~ ^[Yy]$ ]]; then
        read -s -p "Enter PostgreSQL password: " postgres_password
        echo ""
        echo "$postgres_password" | gcloud secrets versions add postgres-password --data-file=-
        print_success "Updated postgres-password"
    fi
    
    read -p "Do you want to update jwt-secret-key? (y/N): " update_jwt
    if [[ $update_jwt =~ ^[Yy]$ ]]; then
        print_status "Generating a secure JWT secret key..."
        jwt_secret=$(openssl rand -base64 64)
        echo "$jwt_secret" | gcloud secrets versions add jwt-secret-key --data-file=-
        print_success "Updated jwt-secret-key with auto-generated secure key"
    fi
    
    read -p "Do you want to update gemini-api-key? (y/N): " update_gemini
    if [[ $update_gemini =~ ^[Yy]$ ]]; then
        read -s -p "Enter Gemini API key: " gemini_key
        echo ""
        echo "$gemini_key" | gcloud secrets versions add gemini-api-key --data-file=-
        print_success "Updated gemini-api-key"
    fi
    
    print_success "Secrets updated successfully!"
}

# Function to deploy
deploy() {
    print_header "🚀 Deploying HR Pinnacle"
    
    print_status "Starting Cloud Build deployment..."
    print_status "This will take about 10-15 minutes..."
    
    # Submit the build
    gcloud builds submit --config cloudbuild.yaml .
    
    print_success "Deployment completed!"
    
    # Get service URLs
    backend_url=$(gcloud run services describe hr-backend --region=$REGION --format="value(status.url)" 2>/dev/null || echo "Not deployed")
    frontend_url=$(gcloud run services describe hr-frontend --region=$REGION --format="value(status.url)" 2>/dev/null || echo "Not deployed")
    
    print_header "🎉 Deployment Results"
    echo -e "${CYAN}📱 Frontend:${NC} $frontend_url"
    echo -e "${CYAN}🔧 Backend:${NC}  $backend_url"
    echo -e "${CYAN}📚 API Docs:${NC} $backend_url/docs"
    echo ""
    print_success "HR Pinnacle is now live on Google Cloud!"
}

# Function to show logs
show_logs() {
    print_header "📋 Recent Build Logs"
    
    # Get the latest build
    latest_build=$(gcloud builds list --limit=1 --format="value(id)")
    
    if [ -z "$latest_build" ]; then
        print_warning "No builds found"
        return
    fi
    
    print_status "Showing logs for build: $latest_build"
    gcloud builds log $latest_build
}

# Function to show status
show_status() {
    print_header "📊 Deployment Status"
    
    # Check Cloud Run services
    print_status "Checking Cloud Run services..."
    
    backend_status=$(gcloud run services describe hr-backend --region=$REGION --format="value(status.conditions[0].type)" 2>/dev/null || echo "NOT_FOUND")
    frontend_status=$(gcloud run services describe hr-frontend --region=$REGION --format="value(status.conditions[0].type)" 2>/dev/null || echo "NOT_FOUND")
    
    echo -e "${CYAN}Backend Status:${NC}  $backend_status"
    echo -e "${CYAN}Frontend Status:${NC} $frontend_status"
    
    if [ "$backend_status" = "Ready" ] && [ "$frontend_status" = "Ready" ]; then
        backend_url=$(gcloud run services describe hr-backend --region=$REGION --format="value(status.url)")
        frontend_url=$(gcloud run services describe hr-frontend --region=$REGION --format="value(status.url)")
        
        echo ""
        echo -e "${GREEN}✅ Both services are running!${NC}"
        echo -e "${CYAN}📱 Frontend:${NC} $frontend_url"
        echo -e "${CYAN}🔧 Backend:${NC}  $backend_url"
    else
        echo ""
        print_warning "Some services are not ready. Check the logs for details."
    fi
}

# Function to cleanup
cleanup() {
    print_header "🧹 Cleanup Resources"
    
    print_warning "This will delete your Cloud Run services. Are you sure?"
    read -p "Type 'yes' to confirm: " confirm
    
    if [ "$confirm" != "yes" ]; then
        print_status "Cleanup cancelled."
        return
    fi
    
    print_status "Deleting Cloud Run services..."
    
    gcloud run services delete hr-backend --region=$REGION --quiet 2>/dev/null || print_warning "Backend service not found"
    gcloud run services delete hr-frontend --region=$REGION --quiet 2>/dev/null || print_warning "Frontend service not found"
    
    print_success "Cleanup completed!"
}

# Function to show help
show_help() {
    echo -e "${PURPLE}🚀 HR Pinnacle Deployment Script${NC}"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  deploy      Deploy the application to Google Cloud"
    echo "  secrets     Update secrets in Google Secret Manager"
    echo "  status      Show current deployment status"
    echo "  logs        Show recent build logs"
    echo "  cleanup     Delete all deployed resources"
    echo "  help        Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 deploy         # Deploy the app"
    echo "  $0 secrets        # Update secrets"
    echo "  $0 status         # Check deployment status"
    echo ""
}

# Main script logic
case "${1:-help}" in
    "deploy")
        check_prerequisites
        deploy
        ;;
    "secrets")
        check_prerequisites
        update_secrets
        ;;
    "status")
        check_prerequisites
        show_status
        ;;
    "logs")
        check_prerequisites
        show_logs
        ;;
    "cleanup")
        check_prerequisites
        cleanup
        ;;
    "help"|*)
        show_help
        ;;
esac
