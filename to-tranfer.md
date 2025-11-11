### 1. User Onboarding & Comprehensive Profile Management

Version B introduces a formal, multi-step user onboarding process and a much more detailed user profile system. This is a foundational feature that personalizes the entire user experience.

*   **Multi-Step Onboarding Flow**: New users are guided through a series of steps to build their profile from the start. This includes:
    *   **Profile Basics**: Collecting first and last name.
    *   **Goal Setting**: Identifying the user's primary career goal (e.g., student, career changer, advancement).
    *   **Student-Specific Profile**: If the user is a student, it collects academic details like college, degree, major, and graduation year.
*   **Expanded User Profile**: The user's profile is no longer just for authentication. It's a central hub for their career data, storing information on skills, education, and career goals.

### 2. The "Career Hub": Advanced Resume Analysis & Optimization

This is the largest new feature set. It transforms the application from just an interview tool into a comprehensive career preparation platform centered around the user's resume.

*   **Resume Upload & Parsing**: Users can upload their resume in PDF format. The system extracts the full text content from the PDF for analysis.
*   **AI Resume Verification**: Before fully processing, an AI performs a sanity check to ensure the uploaded resume plausibly matches the user's profile, preventing accidental uploads of wrong documents.
*   **AI Resume Analysis & Scoring**: Once uploaded, the user can trigger a deep analysis of their resume. The AI provides:
    *   A numerical score out of 100.
    *   A list of specific strengths.
    *   A list of actionable areas for improvement.
*   **AI Role Matching**: Based on the resume content, the AI suggests the most suitable job roles from the platform's database, providing a match score and a justification for each recommendation. This helps users focus their practice.
*   **AI Resume Improver (Co-Pilot)**: This is a powerful editing tool. It takes the user's original resume text and the AI's suggestions, then generates an improved version. The UI presents this as a "diff" (like on GitHub), showing what text was added, removed, or changed.
*   **Resume PDF Export**: After using the AI improver, users can export their newly polished resume as a PDF document.

### 3. Enhanced & Dynamic Interview Experience

The core interview loop itself has been upgraded with more dynamic and varied content.

*   **Coding Interviews**: A completely new interview type has been added.
    *   The system can now present coding problems with a description, starter code, and test cases.
    *   It features an in-browser code editor (CodeMirror).
    *   Code execution is handled by integrating with the **Judge0 API**, which runs the user's code against test cases and returns the output or errors.
*   **Pre-Interview "Ready" Screen**: Before the interview starts, there is a new setup screen that checks for camera/mic permissions and initializes the performance analyzers, ensuring everything is working correctly.

### 4. Real-Time Performance Analytics (In-Browser)

This is a very advanced set of features that provides live feedback on the user's delivery and body language *during* the interview, all processed client-side.

*   **Facial & Gaze Tracking (via MediaPipe)**: The application uses the user's webcam to analyze facial landmarks in the browser. It calculates an **eye contact score** based on how much the user is looking at the "interviewer" (the camera).
*   **Posture & Body Language Analysis (via MediaPipe)**: It also analyzes the user's posture to detect slouching and whether their arms are crossed, generating a **posture stability score** and an **openness score**.
*   **Vocal Analysis (via Web Audio API)**: The user's microphone input is analyzed in real-time to calculate **pitch variation** and **volume stability**, which contribute to a "vocal confidence" metric.
*   **Real-Time Feedback HUD**: During the interview, a "Heads-Up Display" is shown on screen, giving the user live metrics on their speaking pace (WPM), filler word count, vocal confidence, and posture.

### 5. Backend & Architectural Improvements

*   **Expanded Database Models**: The database schema is significantly expanded to store all the new data related to detailed user profiles, resume analysis, role matches, and coding problems.