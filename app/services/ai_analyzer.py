# app/services/ai_analyzer.py
# To run this code you need to install the following dependencies:
# pip install google-genai scikit-learn

import os
import json
from google import genai
from google.genai import types
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from typing import List, Tuple


def analyze_answer_content(question: str, answer: str, role_name: str) -> dict:
    """
    Analyzes a user's answer using the Gemini API and returns structured feedback.

    Returns:
        A dictionary with 'feedback' and 'score' keys, or a default error message.
    """
    # Handle None or empty inputs
    if not question:
        question = "No question provided"
    if not answer:
        answer = "No answer provided"
    if not role_name:
        role_name = "General Role"
    
    response_text = ""  # Initialize to avoid UnboundLocalError
    
    try:
        client = genai.Client(
            api_key=os.environ.get("GEMINI_API_KEY"),
        )

        model = "gemini-2.5-flash"
        
        # This is the most critical part: the prompt.
        prompt = f"""
        As an expert hiring manager for a "{role_name}" position, your task is to evaluate a candidate's answer to an interview question.

        **The Question:**
        "{question}"

        **The Candidate's Answer:**
        "{answer}"

        **Your Task:**
        Provide a constructive critique of the answer and a numerical score from 1 to 10.
        - The feedback should be concise, helpful, and professional.
        - The score should reflect the quality of the answer in a real-world interview context for the specified role.

        **Output Format:**
        Return your response as a valid JSON object with ONLY the following two keys:
        1. "feedback": A string containing your constructive critique.
        2. "score": An integer from 1 to 10.

        Example JSON output:
        {{
          "feedback": "Your explanation was clear and you provided a good example. To improve, you could also mention the performance implications.",
          "score": 8
        }}
        """

        contents = [
            types.Content(
                role="user",
                parts=[
                    types.Part.from_text(text=prompt),
                ],
            ),
        ]
        
        generate_content_config = types.GenerateContentConfig(
            thinking_config = types.ThinkingConfig(
                thinking_budget=0,
            ),
            safety_settings=[
                types.SafetySetting(
                    category="HARM_CATEGORY_HARASSMENT",
                    threshold="BLOCK_NONE",  # Block none
                ),
                types.SafetySetting(
                    category="HARM_CATEGORY_HATE_SPEECH",
                    threshold="BLOCK_NONE",  # Block none
                ),
                types.SafetySetting(
                    category="HARM_CATEGORY_SEXUALLY_EXPLICIT",
                    threshold="BLOCK_NONE",  # Block none
                ),
                types.SafetySetting(
                    category="HARM_CATEGORY_DANGEROUS_CONTENT",
                    threshold="BLOCK_NONE",  # Block none
                ),
            ],
            response_mime_type="application/json",
        )

        # Collect all response chunks
        for chunk in client.models.generate_content_stream(
            model=model,
            contents=contents,
            config=generate_content_config,
        ):
            if chunk.text is not None:
                response_text += chunk.text
        
        # Check if we got any response
        if not response_text.strip():
            return {"feedback": "AI analysis failed: Empty response from AI service.", "score": 0}
        
        # Parse the JSON response text
        response_json = json.loads(response_text)
        
        # Validate the response structure
        if "feedback" in response_json and "score" in response_json:
            return response_json
        else:
            print("Error: Gemini response is missing required keys.")
            print(f"Response received: {response_text}")
            return {"feedback": "AI analysis failed: Invalid format.", "score": 0}

    except json.JSONDecodeError as e:
        print(f"Error parsing JSON response from Gemini: {e}")
        print(f"Raw response: {response_text}")
        return {"feedback": "AI analysis failed: Invalid JSON response.", "score": 0}
    except Exception as e:
        print(f"An error occurred while calling the Gemini API: {e}")
        return {"feedback": f"AI analysis failed: {str(e)}", "score": 0}


def summarize_resume(resume_text: str) -> str:
    """
    Uses the Gemini API to summarize a resume's text content.
    """
    try:
        client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
        model = "gemini-2.5-flash"

        prompt = f"""
        Analyze the following resume text and provide a concise, professional summary in 2-3 short bullet points.
        Focus on key roles, technologies, and major accomplishments.
        This summary will be shown to the user to confirm that the system has understood their background.

        **Resume Text:**
        ---
        {resume_text}
        ---

        **Summary Output Example:**
        - Experienced Full-Stack Developer with 5+ years in Python (Django, FastAPI) and JavaScript (React).
        - Led the development of a real-time data processing pipeline, reducing latency by 40%.
        - Proven ability to mentor junior engineers and collaborate across teams.
        """

        contents = [
            types.Content(
                role="user",
                parts=[
                    types.Part.from_text(text=prompt),
                ],
            ),
        ]
        
        generate_content_config = types.GenerateContentConfig(
            thinking_config = types.ThinkingConfig(
                thinking_budget=0,
            ),
            safety_settings=[
                types.SafetySetting(
                    category="HARM_CATEGORY_HARASSMENT",
                    threshold="BLOCK_NONE",
                ),
                types.SafetySetting(
                    category="HARM_CATEGORY_HATE_SPEECH",
                    threshold="BLOCK_NONE",
                ),
                types.SafetySetting(
                    category="HARM_CATEGORY_SEXUALLY_EXPLICIT",
                    threshold="BLOCK_NONE",
                ),
                types.SafetySetting(
                    category="HARM_CATEGORY_DANGEROUS_CONTENT",
                    threshold="BLOCK_NONE",
                ),
            ],
            response_mime_type="text/plain",
        )

        # Collect all response chunks
        response_text = ""
        for chunk in client.models.generate_content_stream(
            model=model,
            contents=contents,
            config=generate_content_config,
        ):
            if chunk.text is not None:
                response_text += chunk.text
        
        return response_text.strip()

    except Exception as e:
        print(f"An error occurred while summarizing the resume with Gemini: {e}")
        return "AI analysis failed. Could not generate a resume summary."


def analyze_and_score_resume(resume_text: str) -> dict:
    """Uses Gemini to score a resume and provide strengths and improvements."""
    try:
        client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
        model = "gemini-2.5-flash"

        prompt = f"""
        Analyze the following resume text as an expert career coach. Provide a numerical score out of 100
        and list 3 strengths and 3 actionable improvements.

        **Evaluation Criteria:**
        - **Impact & Action Verbs:** Does the user use strong action verbs and quantify achievements?
        - **Clarity & Conciseness:** Is the resume easy to read and understand?
        - **Skills Presentation:** Are skills clearly listed and demonstrated through experience?

        **Resume Text:**
        ---
        {resume_text}
        ---

        **Output Format:**
        Return a valid JSON object with ONLY the following three keys:
        1. "score": An integer from 1 to 100.
        2. "strengths": A JSON array of 3 strings, each highlighting a positive aspect.
        3. "improvements": A JSON array of 3 strings, each providing a specific, actionable suggestion for improvement.

        **Example JSON Output:**
        {{
          "score": 85,
          "strengths": [
            "Excellent use of quantifiable metrics to demonstrate impact (e.g., 'reduced latency by 40%').",
            "Clearly lists a modern and relevant tech stack (Python, FastAPI, React).",
            "Strong action verbs used throughout the experience section."
          ],
          "improvements": [
            "Consider adding a brief professional summary at the top to immediately state your career objective.",
            "The 'Project' section could be enhanced by linking to a live demo or GitHub repository.",
            "Ensure consistent formatting for dates across all job entries."
          ]
        }}
        """

        contents = [
            types.Content(
                role="user",
                parts=[
                    types.Part.from_text(text=prompt),
                ],
            ),
        ]
        
        generate_content_config = types.GenerateContentConfig(
            thinking_config = types.ThinkingConfig(
                thinking_budget=0,
            ),
            safety_settings=[
                types.SafetySetting(
                    category="HARM_CATEGORY_HARASSMENT",
                    threshold="BLOCK_NONE",
                ),
                types.SafetySetting(
                    category="HARM_CATEGORY_HATE_SPEECH",
                    threshold="BLOCK_NONE",
                ),
                types.SafetySetting(
                    category="HARM_CATEGORY_SEXUALLY_EXPLICIT",
                    threshold="BLOCK_NONE",
                ),
                types.SafetySetting(
                    category="HARM_CATEGORY_DANGEROUS_CONTENT",
                    threshold="BLOCK_NONE",
                ),
            ],
            response_mime_type="application/json",
        )

        response_text = ""
        for chunk in client.models.generate_content_stream(
            model=model,
            contents=contents,
            config=generate_content_config,
        ):
            if chunk.text is not None:
                response_text += chunk.text

        response_json = json.loads(response_text)
        
        # Basic validation
        if "score" in response_json and "strengths" in response_json and "improvements" in response_json:
            return response_json
        else:
            return {"score": 0, "strengths": [], "improvements": ["AI analysis failed to return a valid format."]}

    except Exception as e:
        print(f"An error occurred during resume analysis: {e}")
        return {"score": 0, "strengths": [], "improvements": [f"AI analysis failed: {str(e)}"]}


def match_resume_to_roles(resume_text: str, available_roles: List[str]) -> List[dict]:
    """Matches resume text against a list of roles using a combination of TF-IDF and Gemini."""
    try:
        # 1. TF-IDF for a quick, numeric similarity score
        vectorizer = TfidfVectorizer().fit_transform([resume_text] + available_roles)
        vectors = vectorizer.toarray()
        cosine_similarities = cosine_similarity(vectors[0:1], vectors[1:])[0]

        top_indices = cosine_similarities.argsort()[-3:][::-1] # Get top 3 matches
        top_roles = [available_roles[i] for i in top_indices]

        # 2. Gemini for qualitative justification
        client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
        model = "gemini-2.5-flash"
        
        prompt = f"""
        Given the following resume text and a list of top job roles, provide a 1-sentence justification for why the candidate is a good match for each role.

        **Resume Text:**
        ---
        {resume_text}
        ---
        
        **Top Roles to Justify:**
        {", ".join(top_roles)}

        **Output Format:**
        Return a valid JSON object where keys are the role names and values are the justification strings.
        
        **Example JSON Output:**
        {{
          "Python Developer": "Strong experience with FastAPI and data processing aligns perfectly with backend development.",
          "Data Engineer": "The resume shows experience with data pipelines, which is a core skill for this role."
        }}
        """

        contents = [
            types.Content(
                role="user",
                parts=[
                    types.Part.from_text(text=prompt),
                ],
            ),
        ]
        
        generate_content_config = types.GenerateContentConfig(
            thinking_config = types.ThinkingConfig(
                thinking_budget=0,
            ),
            safety_settings=[
                types.SafetySetting(
                    category="HARM_CATEGORY_HARASSMENT",
                    threshold="BLOCK_NONE",
                ),
                types.SafetySetting(
                    category="HARM_CATEGORY_HATE_SPEECH",
                    threshold="BLOCK_NONE",
                ),
                types.SafetySetting(
                    category="HARM_CATEGORY_SEXUALLY_EXPLICIT",
                    threshold="BLOCK_NONE",
                ),
                types.SafetySetting(
                    category="HARM_CATEGORY_DANGEROUS_CONTENT",
                    threshold="BLOCK_NONE",
                ),
            ],
            response_mime_type="application/json",
        )

        response_text = ""
        for chunk in client.models.generate_content_stream(
            model=model,
            contents=contents,
            config=generate_content_config,
        ):
            if chunk.text is not None:
                response_text += chunk.text
        
        justifications = json.loads(response_text)
        
        # 3. Combine results
        matches = []
        for i, role_name in enumerate(top_roles):
            # Convert TF-IDF score (0-1) to a percentage (50-100 scale for better UX)
            match_score = int(50 + (cosine_similarities[top_indices[i]] * 50))
            matches.append({
                "role_name": role_name,
                "match_score": match_score,
                "justification": justifications.get(role_name, "A good general skills match.")
            })
            
        return matches

    except Exception as e:
        print(f"An error occurred during role matching: {e}")
        return []


def generate_follow_up_question(question: str, answer: str, resume_summary: str = None) -> str:
    """Generates a dynamic follow-up question based on the user's answer and resume."""
    try:
        client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
        model = "gemini-2.5-flash"
        
        context_prompt = f"""
        You are a hiring manager conducting an interview. The candidate just answered a question. Your task is to ask a SINGLE, relevant, and insightful follow-up question.

        - If the answer is weak or vague, ask for more specific details or an example.
        - If the answer is strong, probe deeper into the outcome, learnings, or challenges.
        - If possible, subtly connect the follow-up to the candidate's background.

        **Candidate's Background Summary:**
        {resume_summary or "Not provided."}

        **Previous Question:** "{question}"
        **Candidate's Answer:** "{answer}"

        **Your Task:**
        Respond with ONLY the text of your single follow-up question. Do not add any conversational filler like "That's interesting" or "Thanks for sharing."

        **Example Output:**
        What was the most significant technical challenge you faced during that project?
        """
        
        contents = [
            types.Content(
                role="user",
                parts=[
                    types.Part.from_text(text=context_prompt),
                ],
            ),
        ]
        
        generate_content_config = types.GenerateContentConfig(
            thinking_config = types.ThinkingConfig(
                thinking_budget=0,
            ),
            safety_settings=[
                types.SafetySetting(
                    category="HARM_CATEGORY_HARASSMENT",
                    threshold="BLOCK_NONE",
                ),
                types.SafetySetting(
                    category="HARM_CATEGORY_HATE_SPEECH",
                    threshold="BLOCK_NONE",
                ),
                types.SafetySetting(
                    category="HARM_CATEGORY_SEXUALLY_EXPLICIT",
                    threshold="BLOCK_NONE",
                ),
                types.SafetySetting(
                    category="HARM_CATEGORY_DANGEROUS_CONTENT",
                    threshold="BLOCK_NONE",
                ),
            ],
            response_mime_type="text/plain",
        )

        response_text = ""
        for chunk in client.models.generate_content_stream(
            model=model,
            contents=contents,
            config=generate_content_config,
        ):
            if chunk.text is not None:
                response_text += chunk.text
            
        return response_text.strip()
        
    except Exception as e:
        print(f"An error occurred during follow-up question generation: {e}")
        return "Can you tell me more about that?"


def improve_resume_text(resume_text: str, improvements_needed: List[str]) -> str:
    """Uses Gemini to rewrite and improve resume text based on specific feedback."""
    try:
        client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
        model = "gemini-2.5-flash"

        improvements_str = "\n- ".join(improvements_needed)

        prompt = f"""
        Act as an expert resume writer. Your task is to rewrite the provided resume text to be more professional, impactful, and clear.

        **Specific Areas to Improve:**
        - {improvements_str}

        **General Rewrite Rules:**
        - Rephrase bullet points to start with strong action verbs.
        - Quantify achievements with metrics wherever possible (if not present, use placeholders like "[quantifiable metric]").
        - Ensure the language is professional and concise.
        - Correct any grammatical errors or awkward phrasing.
        - Structure the text logically.

        **Original Resume Text:**
        ---
        {resume_text}
        ---

        **Your Task:**
        Provide ONLY the rewritten, complete resume text. Do not add any commentary, headings, or introductions like "Here is the improved version".
        """

        contents = [
            types.Content(
                role="user",
                parts=[
                    types.Part.from_text(text=prompt),
                ],
            ),
        ]
        
        generate_content_config = types.GenerateContentConfig(
            thinking_config = types.ThinkingConfig(
                thinking_budget=0,
            ),
            safety_settings=[
                types.SafetySetting(
                    category="HARM_CATEGORY_HARASSMENT",
                    threshold="BLOCK_NONE",
                ),
                types.SafetySetting(
                    category="HARM_CATEGORY_HATE_SPEECH",
                    threshold="BLOCK_NONE",
                ),
                types.SafetySetting(
                    category="HARM_CATEGORY_SEXUALLY_EXPLICIT",
                    threshold="BLOCK_NONE",
                ),
                types.SafetySetting(
                    category="HARM_CATEGORY_DANGEROUS_CONTENT",
                    threshold="BLOCK_NONE",
                ),
            ],
            response_mime_type="text/plain",
        )

        response_text = ""
        for chunk in client.models.generate_content_stream(
            model=model,
            contents=contents,
            config=generate_content_config,
        ):
            if chunk.text is not None:
                response_text += chunk.text
            
        return response_text.strip()

    except Exception as e:
        print(f"An error occurred during resume improvement: {e}")
        return f"AI analysis failed: {str(e)}"


def generate_company_specific_questions(role_name: str, difficulty: str, company_name: str) -> List[dict]:
    """Generates a set of interview questions tailored for a specific company."""
    try:
        client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
        model = "gemini-2.5-flash"
        
        prompt = f"""
        Act as a senior hiring manager at "{company_name}". Generate a list of 5 interview questions for a "{role_name} - {difficulty}" candidate.
        The questions should reflect the known culture and technical challenges of "{company_name}". For example, for tech companies, focus on scale, innovation, and collaboration.
        
        **Your Task:**
        Return a valid JSON array of objects. Each object must have two keys: "id" (a unique integer starting from 1000) and "content" (the question text).

        **Example JSON Output:**
        [
          {{
            "id": 1000,
            "content": "Describe a time you had to design a system for millions of users. What were the key trade-offs you made?"
          }},
          {{
            "id": 1001,
            "content": "How would you handle a disagreement with your product manager about a feature's priority, especially when customer data is ambiguous?"
          }}
        ]
        """
        
        contents = [
            types.Content(
                role="user",
                parts=[
                    types.Part.from_text(text=prompt),
                ],
            ),
        ]
        
        generate_content_config = types.GenerateContentConfig(
            thinking_config = types.ThinkingConfig(
                thinking_budget=0,
            ),
            safety_settings=[
                types.SafetySetting(
                    category="HARM_CATEGORY_HARASSMENT",
                    threshold="BLOCK_NONE",
                ),
                types.SafetySetting(
                    category="HARM_CATEGORY_HATE_SPEECH",
                    threshold="BLOCK_NONE",
                ),
                types.SafetySetting(
                    category="HARM_CATEGORY_SEXUALLY_EXPLICIT",
                    threshold="BLOCK_NONE",
                ),
                types.SafetySetting(
                    category="HARM_CATEGORY_DANGEROUS_CONTENT",
                    threshold="BLOCK_NONE",
                ),
            ],
            response_mime_type="application/json",
        )

        response_text = ""
        for chunk in client.models.generate_content_stream(
            model=model,
            contents=contents,
            config=generate_content_config,
        ):
            if chunk.text is not None:
                response_text += chunk.text
        
        questions = json.loads(response_text)
        if isinstance(questions, list) and all("id" in q and "content" in q for q in questions):
            return questions
        return []

    except Exception as e:
        print(f"An error occurred during company question generation: {e}")
        return []


def verify_resume_against_profile(resume_text: str, user_profile) -> Tuple[bool, str]:
    """Uses Gemini to perform a sanity check on a resume against a user's profile."""
    try:
        client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
        model = "gemini-2.5-flash"
        
        # Build a string representation of the user profile
        profile_details = f"User Goal: {user_profile.primary_goal or 'Not specified'}"
        if user_profile.primary_goal == 'student':
            # Only add student details if they exist
            student_info_parts = []
            if user_profile.major:
                student_info_parts.append(f"studying {user_profile.major}")
            if user_profile.college:
                student_info_parts.append(f"at {user_profile.college}")
            if user_profile.graduation_year:
                student_info_parts.append(f"graduating in {user_profile.graduation_year}")
            
            if student_info_parts:
                profile_details += ", " + ", ".join(student_info_parts) + "."
            else:
                profile_details += ", student (academic details not yet provided)."
        
        prompt = f"""
        You are a document verification AI. Your task is to determine if the provided resume text plausibly belongs to the user based on their profile.
        Look for strong contradictions. For example, if the profile says "Student in Computer Science" but the resume is for a "Senior Marketing Director with 15 years of experience", that is a mismatch.

        **User Profile:** {profile_details}
        
        **Resume Text:**
        ---
        {resume_text}
        ---

        **Your Task:**
        1.  Determine if there is a strong mismatch.
        2.  Respond with a valid JSON object with ONLY two keys:
            - "is_match": a boolean (true if it seems plausible, false if there's a strong contradiction).
            - "reasoning": a single, brief sentence explaining your decision.

        **Example Output (Match):**
        {{
          "is_match": true,
          "reasoning": "The resume content aligns with the user's stated profile as a Computer Science student."
        }}

        **Example Output (Mismatch):**
        {{
          "is_match": false,
          "reasoning": "The resume describes a senior legal professional, which does not match the user's student profile."
        }}
        """

        contents = [
            types.Content(
                role="user",
                parts=[
                    types.Part.from_text(text=prompt),
                ],
            ),
        ]
        
        generate_content_config = types.GenerateContentConfig(
            thinking_config = types.ThinkingConfig(
                thinking_budget=0,
            ),
            safety_settings=[
                types.SafetySetting(
                    category="HARM_CATEGORY_HARASSMENT",
                    threshold="BLOCK_NONE",
                ),
                types.SafetySetting(
                    category="HARM_CATEGORY_HATE_SPEECH",
                    threshold="BLOCK_NONE",
                ),
                types.SafetySetting(
                    category="HARM_CATEGORY_SEXUALLY_EXPLICIT",
                    threshold="BLOCK_NONE",
                ),
                types.SafetySetting(
                    category="HARM_CATEGORY_DANGEROUS_CONTENT",
                    threshold="BLOCK_NONE",
                ),
            ],
            response_mime_type="application/json",
        )

        response_text = ""
        for chunk in client.models.generate_content_stream(
            model=model,
            contents=contents,
            config=generate_content_config,
        ):
            if chunk.text is not None:
                response_text += chunk.text

        result = json.loads(response_text)
        return result.get("is_match", True), result.get("reasoning", "")
        
    except Exception as e:
        print(f"An error occurred during resume verification: {e}")
        return True, "AI verification failed, proceeding by default." # Default to true to avoid blocking the user