# MediaPipe Model Files

This directory should contain the following MediaPipe model files:

1. `face_landmarker.task` - Face landmark detection model
2. `pose_landmarker_lite.task` - Pose detection model

These files are required for the real-time video analysis features (eye contact, posture, engagement).

## How to Obtain the Models

You can download these models from the MediaPipe Solutions page:
- Face Landmarker: https://developers.google.com/mediapipe/solutions/vision/face_landmarker
- Pose Landmarker: https://developers.google.com/mediapipe/solutions/vision/pose_landmarker

Or use the MediaPipe Model Maker to create custom models.

## File Size

- `face_landmarker.task`: ~9MB
- `pose_landmarker_lite.task`: ~3MB

Make sure these files are placed in the `frontend/public/` directory before running the application.

