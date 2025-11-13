# HeyGen Avatar Streaming Setup Instructions

## Step 1: Add HeyGen API Key to .env File

Add the following line to your `.env` file in the project root:

```env
# HeyGen API Key (for Avatar Streaming)
HEYGEN_API_KEY="sk_your_actual_heygen_api_key_here"
```

Replace `sk_your_actual_heygen_api_key_here` with your actual HeyGen API key.

## Step 2: Generate Database Migration

After updating the database model, you need to create and apply a migration:

```bash
# Activate your virtual environment first
# Then run:
alembic revision --autogenerate -m "Add HeyGen session fields to InterviewSession"
alembic upgrade head
```

## Step 3: Install Dependencies

### Backend
```bash
pip install -r packages/requirements.txt
```

### Frontend
```bash
cd frontend
npm install
```

## Step 4: Add HeyGen Secret to Google Secret Manager (For Production)

For production deployment, add your HeyGen API key to Google Secret Manager:

```bash
# Create the secret
gcloud secrets create heygen-api-key --replication-policy="automatic"

# Add your API key value
echo -n "sk_your_actual_heygen_api_key_here" | gcloud secrets versions add heygen-api-key --data-file=-
```

## Step 5: Test the Implementation

1. Start your backend server:
   ```bash
   uvicorn app.main:app --reload
   ```

2. Start your frontend dev server:
   ```bash
   cd frontend
   npm run dev
   ```

3. Create a new interview session and the HeyGen avatar should initialize automatically.

## Implementation Summary

The following changes have been made:

### Backend Changes:
- ✅ Added HeyGen session fields to `InterviewSession` model in `app/models.py`
- ✅ Added `httpx` to `packages/requirements.txt` for HTTP requests
- ✅ Implemented 5 new endpoints in `app/routers/interviews.py`:
  - `POST /api/sessions/{session_id}/avatar/initialize` - Initialize HeyGen session
  - `POST /api/sessions/{session_id}/avatar/start` - Start streaming
  - `POST /api/sessions/{session_id}/avatar/task` - Send text for avatar to speak
  - `POST /api/sessions/{session_id}/avatar/stop` - Close session

### Frontend Changes:
- ✅ Added `livekit-client` to `frontend/package.json`
- ✅ Replaced interview page with HeyGen implementation using LiveKit

### Production Deployment:
- ✅ Updated `cloudbuild.yaml` to include `HEYGEN_API_KEY` secret

## Security Notes

- ✅ API key is kept on the backend only (never exposed to frontend)
- ✅ All HeyGen API calls are proxied through your secure backend
- ✅ Frontend communicates only with your authenticated API endpoints

## Troubleshooting

If you encounter issues:

1. **HeyGen service not configured**: Make sure `HEYGEN_API_KEY` is set in your `.env` file
2. **Database errors**: Run the Alembic migrations to add the new fields
3. **Frontend errors**: Run `npm install` in the frontend directory to install `livekit-client`
4. **Production deployment fails**: Ensure the `heygen-api-key` secret exists in Google Secret Manager

## Next Steps

Once setup is complete, you can customize:
- Avatar selection (currently uses `Wayne_20240711`)
- Voice ID (currently uses the example voice)
- Video quality settings
- Language support for speech-to-text

