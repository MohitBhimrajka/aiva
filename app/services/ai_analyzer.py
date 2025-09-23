# app/services/ai_analyzer.py
import os
import json
from google import genai
from google.genai import types

def analyze_answer_content(question: str, answer: str, role_name: str) -> dict:
    """
    Analyzes a user's answer using the Gemini API and returns structured feedback.

    Returns:
        A dictionary with 'feedback' and 'score' keys, or a default error message.
    """
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

        # Collect all response chunks
        response_text = ""
        for chunk in client.models.generate_content_stream(
            model=model,
            contents=contents,
            config=generate_content_config,
        ):
            response_text += chunk.text
        
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