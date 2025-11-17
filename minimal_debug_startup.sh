#!/bin/bash

# Minimal debug startup script - bypasses complex logic to isolate issues
echo "🔍 MINIMAL DEBUG STARTUP"
echo "======================="

# Test 1: Environment variables
echo "📋 Environment variables:"
echo "   PORT: $PORT"
echo "   POSTGRES_HOST: ${POSTGRES_HOST:0:20}..."
echo "   POSTGRES_USER: $POSTGRES_USER"
echo "   POSTGRES_DB: $POSTGRES_DB"
echo "   POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:0:4}***"

# Test 2: Basic Python
echo ""
echo "🐍 Testing Python:"
python --version || exit 1
echo "✅ Python working"

# Test 3: Critical imports
echo ""
echo "📦 Testing imports:"
python -c "
import sys
print('✅ Basic Python imports working')

try:
    import psycopg2
    print('✅ psycopg2 available')
except Exception as e:
    print(f'❌ psycopg2 failed: {e}')
    exit(1)

try:
    import fastapi
    print('✅ FastAPI available')
except Exception as e:
    print(f'❌ FastAPI failed: {e}')  
    exit(1)

try:
    import uvicorn
    print('✅ Uvicorn available')
except Exception as e:
    print(f'❌ Uvicorn failed: {e}')
    exit(1)
" || exit 1

# Test 4: Database connection (simplified)
echo ""
echo "🗄️ Testing database connection:"
python -c "
import os
import psycopg2

host = os.getenv('POSTGRES_HOST')
user = os.getenv('POSTGRES_USER', 'postgres')
password = os.getenv('POSTGRES_PASSWORD')
db = os.getenv('POSTGRES_DB', 'postgres')

print(f'Connecting to: {host} as {user} to {db}')

try:
    conn = psycopg2.connect(
        host=host,
        user=user,
        password=password,
        database=db
    )
    print('✅ Database connection successful!')
    conn.close()
except Exception as e:
    print(f'❌ Database connection failed: {e}')
    exit(1)
" || exit 1

# Test 5: Start minimal FastAPI
echo ""
echo "🚀 Starting minimal FastAPI on port $PORT:"
python -c "
import os
from fastapi import FastAPI
import uvicorn

app = FastAPI()

@app.get('/')
def root():
    return {'message': 'Debug API working'}

@app.get('/api/health')  
def health():
    return {'status': 'OK', 'debug': True}

port = int(os.getenv('PORT', '8000'))
print(f'Starting on port {port}...')

uvicorn.run(app, host='0.0.0.0', port=port, log_level='info')
"
