# app/services/ai_analyzer.py
import os
import json
import logging
import asyncio
from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

# --- ADD THIS HELPER FUNCTION AT THE TOP ---
def get_language_name(language_code: str) -> str:
    """Maps a BCP-47 language code to a full language name for prompts."""
    lang_map = {
        "en-US": "English",
        "es-ES": "Spanish",
        "fr-FR": "French",
        "de-DE": "German",
        "hi-IN": "Hindi",
        "mr-IN": "Marathi",
    }
    return lang_map.get(language_code, "the specified language")
# -------------------------------------------

def _create_client():
    """Helper function to create a Gemini client."""
    return genai.Client(
        api_key=os.environ.get("GEMINI_API_KEY"),
    )

def _get_safety_settings():
    """Helper function to get consistent safety settings."""
    return [
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
    ]

async def _get_ai_score(question: str, answer: str, role_name: str, language_code: str) -> dict:
    """
    Specialized function to get a numerical score from 1 to 10.
    
    Returns:
        A dictionary with a single 'score' key (integer from 1-10, or 0 on error).
    """
    language_name = get_language_name(language_code)
    def _call_gemini():
        """Synchronous wrapper for the Gemini API call."""
        client = _create_client()
        model = "gemini-2.5-flash"
        
        # --- REPLACE THE PROMPT ---
        prompt = f"""
        You are a strict hiring manager fluent in {language_name}, evaluating a candidate for a "{role_name}" position.
        The following interview question and answer are in {language_name}.
        
        **The Question:**
        "{question}"
        
        **The Candidate's Answer:**
        "{answer}"
        
        **Your Task:**
        Evaluate this answer based on its quality in {language_name}. Consider:
        - Relevance to the question
        - Technical accuracy (if applicable)
        - Clarity and structure
        - Depth of understanding
        
        Provide ONLY a numerical score from 1 to 10.
        
        Return your response as a valid JSON object with a single key: "score".
        Your entire response, including keys and values, must be in English.
        
        Example: {{"score": 7}}
        """
        # --------------------------
        
        contents = [
            types.Content(
                role="user",
                parts=[
                    types.Part.from_text(text=prompt),
                ],
            ),
        ]
        
        generate_content_config = types.GenerateContentConfig(
            thinking_config=types.ThinkingConfig(
                thinking_budget=0,
            ),
            safety_settings=_get_safety_settings(),
            response_mime_type="application/json",
        )
        
        try:
            # Collect all response chunks
            response_text = ""
            for chunk in client.models.generate_content_stream(
                model=model,
                contents=contents,
                config=generate_content_config,
            ):
                response_text += chunk.text or ""
            
            # Parse and validate
            response_json = json.loads(response_text)
            if "score" in response_json and isinstance(response_json["score"], int):
                # Ensure score is in valid range
                score = max(1, min(10, response_json["score"]))
                return {"score": score}
            else:
                logger.error("Score response missing or invalid 'score' key.")
                logger.error(f"Response received: {response_text}")
                return {"score": 0}
                
        except json.JSONDecodeError as e:
            logger.error(f"Error parsing JSON response from Gemini (score): {e}")
            return {"score": 0}
        except Exception as e:
            logger.error(f"Error calling Gemini API for score: {e}")
            return {"score": 0}
    
    # Run the synchronous call in a thread to avoid blocking
    return await asyncio.to_thread(_call_gemini)

async def _get_ai_feedback(question: str, answer: str, role_name: str, language_code: str) -> dict:
    """
    Specialized function to get detailed, constructive feedback.
    
    Returns:
        A dictionary with a single 'feedback' key (string with detailed critique).
    """
    language_name = get_language_name(language_code)
    def _call_gemini():
        """Synchronous wrapper for the Gemini API call."""
        client = _create_client()
        model = "gemini-2.5-flash"
        
        # --- REPLACE THE PROMPT ---
        prompt = f"""
        You are an expert career coach fluent in {language_name}, with experience in "{role_name}" roles.
        The following interview question and answer are in {language_name}.
        
        **The Question:**
        "{question}"
        
        **The Candidate's Answer:**
        "{answer}"
        
        **Your Task:**
        Provide detailed, constructive, and professional feedback in {language_name}. Your feedback should:
        1. Acknowledge strengths.
        2. Identify areas for improvement.
        3. Provide actionable guidance.
        
        Return your response as a valid JSON object with a single key: "feedback".
        The value for "feedback" must be a string written in {language_name}.
        The key "feedback" itself must be in English.
        
        Example for French: {{"feedback": "Votre explication démontre une bonne compréhension..."}}
        Example for Hindi: {{"feedback": "आपकी व्याख्या मुख्य अवधारणा की अच्छी समझ प्रदर्शित करती है..."}}
        """
        # --------------------------
        
        contents = [
            types.Content(
                role="user",
                parts=[
                    types.Part.from_text(text=prompt),
                ],
            ),
        ]
        
        generate_content_config = types.GenerateContentConfig(
            thinking_config=types.ThinkingConfig(
                thinking_budget=0,
            ),
            safety_settings=_get_safety_settings(),
            response_mime_type="application/json",
        )
        
        try:
            # Collect all response chunks
            response_text = ""
            for chunk in client.models.generate_content_stream(
                model=model,
                contents=contents,
                config=generate_content_config,
            ):
                response_text += chunk.text or ""
            
            # Parse and validate
            response_json = json.loads(response_text)
            if "feedback" in response_json and isinstance(response_json["feedback"], str):
                return {"feedback": response_json["feedback"]}
            else:
                logger.error("Feedback response missing or invalid 'feedback' key.")
                logger.error(f"Response received: {response_text}")
                return {"feedback": "We encountered an issue analyzing your response. Please try again or review the question and provide a more detailed answer."}
                
        except json.JSONDecodeError as e:
            logger.error(f"Error parsing JSON response from Gemini (feedback): {e}")
            return {"feedback": "We encountered an issue analyzing your response. Please try again or review the question and provide a more detailed answer."}
        except Exception as e:
            logger.error(f"Error calling Gemini API for feedback: {e}")
            return {"feedback": "We encountered an issue analyzing your response. Please try again or review the question and provide a more detailed answer."}
    
    # Run the synchronous call in a thread to avoid blocking
    return await asyncio.to_thread(_call_gemini)

async def _get_ai_one_liner(question: str, answer: str, role_name: str, language_code: str) -> dict:
    """
    Specialized function to get a concise, actionable one-line summary.
    
    Returns:
        A dictionary with a single 'oneLiner' key (string with the most important takeaway).
    """
    language_name = get_language_name(language_code)
    def _call_gemini():
        """Synchronous wrapper for the Gemini API call."""
        client = _create_client()
        model = "gemini-2.5-flash"
        
        # --- REPLACE THE PROMPT ---
        prompt = f"""
        You are an AI assistant helping a candidate improve their interview skills in {language_name}.
        
        **The Question (in {language_name}):**
        "{question}"
        
        **The Candidate's Answer (in {language_name}):**
        "{answer}"
        
        **Your Task:**
        Distill the most important takeaway into a single, actionable sentence.
        This one-liner must be written in {language_name}.
        
        Return your response as a valid JSON object with a single key: "oneLiner".
        The value for "oneLiner" must be a string written in {language_name}.
        The key "oneLiner" itself must be in English.
        
        Example for Spanish: {{"oneLiner": "Gran ejemplo, pero la próxima vez conéctalo con los requisitos del trabajo."}}
        """
        # --------------------------
        
        contents = [
            types.Content(
                role="user",
                parts=[
                    types.Part.from_text(text=prompt),
                ],
            ),
        ]
        
        generate_content_config = types.GenerateContentConfig(
            thinking_config=types.ThinkingConfig(
                thinking_budget=0,
            ),
            safety_settings=_get_safety_settings(),
            response_mime_type="application/json",
        )
        
        try:
            # Collect all response chunks
            response_text = ""
            for chunk in client.models.generate_content_stream(
                model=model,
                contents=contents,
                config=generate_content_config,
            ):
                response_text += chunk.text or ""
            
            # Parse and validate
            response_json = json.loads(response_text)
            if "oneLiner" in response_json and isinstance(response_json["oneLiner"], str):
                return {"oneLiner": response_json["oneLiner"]}
            else:
                logger.error("One-liner response missing or invalid 'oneLiner' key.")
                logger.error(f"Response received: {response_text}")
                return {"oneLiner": "Feedback is being processed."}
                
        except json.JSONDecodeError as e:
            logger.error(f"Error parsing JSON response from Gemini (one-liner): {e}")
            return {"oneLiner": "Feedback is being processed."}
        except Exception as e:
            logger.error(f"Error calling Gemini API for one-liner: {e}")
            return {"oneLiner": "Feedback is being processed."}
    
    # Run the synchronous call in a thread to avoid blocking
    return await asyncio.to_thread(_call_gemini)

async def analyze_answer_content(question: str, answer: str, role_name: str, language_code: str) -> dict:
    """
    Analyzes a user's answer using parallel, specialized Gemini API calls.
    
    This function orchestrates three independent API calls that run concurrently:
    1. Scoring call - focused on numerical evaluation
    2. Feedback call - focused on detailed critique
    3. One-liner call - focused on concise, actionable summary
    
    Returns:
        A dictionary with 'feedback', 'score', and 'oneLiner' keys.
        Each call has independent error handling, so partial results are possible.
    """
    try:
        # --- UPDATE THE TASK CREATION CALLS ---
        score_task = asyncio.create_task(_get_ai_score(question, answer, role_name, language_code))
        feedback_task = asyncio.create_task(_get_ai_feedback(question, answer, role_name, language_code))
        one_liner_task = asyncio.create_task(_get_ai_one_liner(question, answer, role_name, language_code))
        # ---------------------------------------
        
        # Execute all three calls in parallel and wait for completion
        results = await asyncio.gather(
            score_task,
            feedback_task,
            one_liner_task,
            return_exceptions=True  # Don't fail fast if one call fails
        )
        
        # Extract results (handle exceptions gracefully)
        score_result = results[0] if not isinstance(results[0], Exception) else {"score": 0}
        feedback_result = results[1] if not isinstance(results[1], Exception) else {"feedback": "Error retrieving feedback."}
        one_liner_result = results[2] if not isinstance(results[2], Exception) else {"oneLiner": "Feedback is being processed."}
        
        # Log any exceptions that occurred
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                task_names = ["score", "feedback", "one-liner"]
                logger.error(f"Exception in {task_names[i]} task: {result}")
        
        # Combine results into final response
        final_response = {
            "score": score_result.get("score", 0),
            "feedback": feedback_result.get("feedback", "Error retrieving feedback."),
            "oneLiner": one_liner_result.get("oneLiner", "Feedback is being processed.")
        }
        
        return final_response
        
    except Exception as e:
        logger.error(f"Unexpected error in analyze_answer_content: {e}")
        # Return safe defaults if the orchestrator itself fails
        return {
            "score": 0,
            "feedback": f"AI analysis failed: {str(e)}",
            "oneLiner": "Could not retrieve feedback."
        }

async def get_overall_summary(full_transcript: str, role_name: str, language_code: str, client: genai.Client) -> dict:
    """
    Analyzes a full interview transcript to provide a holistic summary.
    
    Args:
        full_transcript: The complete interview transcript as a formatted string
        role_name: The name of the role being interviewed for
        language_code: The language code for the interview content
        client: A pre-configured Gemini client instance
        
    Returns:
        A dictionary with 'summary', 'strengths', and 'areas_for_improvement' keys.
        Each has appropriate defaults if analysis fails.
    """
    language_name = get_language_name(language_code)
    def _call_gemini():
        """Synchronous wrapper for the Gemini API call."""
        model = "gemini-2.5-flash"
        
        # --- REPLACE THE PROMPT ---
        prompt = f"""
        You are an expert career coach summarizing a candidate's full interview performance for a "{role_name}" role.
        The entire interview was conducted in {language_name}.

        Your task is to provide a holistic analysis in {language_name}. Be encouraging but direct.
        Focus on patterns and overarching themes in the candidate's communication and problem-solving.

        **CRITICAL INSTRUCTIONS:**
        Your output MUST be a valid JSON object with three keys: "summary", "strengths", and "areas_for_improvement".
        The values for these keys MUST be written in {language_name}.
        The keys themselves MUST be in English.
        - "summary": A 2-3 sentence overview of the performance.
        - "strengths": A list of 2-3 specific, genuine positive points. If none, return an empty list [].
        - "areas_for_improvement": A list of the 2-3 most critical areas for improvement.

        TRANSCRIPT (in {language_name}):
        ---
        {full_transcript}
        ---
        """
        # --------------------------
        
        contents = [
            types.Content(
                role="user",
                parts=[
                    types.Part.from_text(text=prompt),
                ],
            ),
        ]
        
        generate_content_config = types.GenerateContentConfig(
            thinking_config=types.ThinkingConfig(
                thinking_budget=0,
            ),
            safety_settings=_get_safety_settings(),
            response_mime_type="application/json",
        )
        
        try:
            # Collect all response chunks
            response_text = ""
            for chunk in client.models.generate_content_stream(
                model=model,
                contents=contents,
                config=generate_content_config,
            ):
                response_text += chunk.text or ""
            
            # Parse and validate
            response_json = json.loads(response_text)
            
            # Validate structure
            if not isinstance(response_json, dict):
                raise ValueError("Response is not a JSON object")
            
            # Ensure all required keys exist with defaults
            result = {
                "summary": response_json.get("summary", "Could not generate summary."),
                "strengths": response_json.get("strengths", []),
                "areas_for_improvement": response_json.get("areas_for_improvement", []),
            }
            
            # Ensure strengths and areas_for_improvement are lists
            if not isinstance(result["strengths"], list):
                result["strengths"] = [result["strengths"]] if result["strengths"] else []
            if not isinstance(result["areas_for_improvement"], list):
                result["areas_for_improvement"] = [result["areas_for_improvement"]] if result["areas_for_improvement"] else []
            
            # Filter out non-strengths (generic statements that aren't real strengths)
            invalid_strength_patterns = [
                "attended",
                "participated",
                "no apparent",
                "no discernible",
                "unable to",
                "could not",
                "did not",
                "lack of",
                "failed to",
                "no technical",
                "no real",
            ]
            
            filtered_strengths = []
            for strength in result["strengths"]:
                if isinstance(strength, str):
                    strength_lower = strength.lower()
                    # Check if it's a valid strength (not containing invalid patterns)
                    is_valid = all(pattern not in strength_lower for pattern in invalid_strength_patterns)
                    # Also ensure it's not empty or just whitespace
                    if is_valid and strength.strip():
                        filtered_strengths.append(strength)
            
            result["strengths"] = filtered_strengths
            
            return result
                
        except json.JSONDecodeError as e:
            logger.error(f"Error parsing JSON response from Gemini (overall summary): {e}")
            return {
                "summary": "We encountered an issue generating your performance summary. Please try viewing this report again later.",
                "strengths": [],
                "areas_for_improvement": [],
            }
        except Exception as e:
            logger.error(f"Error calling Gemini API for overall summary: {e}")
            return {
                "summary": "We encountered an issue generating your performance summary. Please try viewing this report again later.",
                "strengths": [],
                "areas_for_improvement": [],
            }
    
    # Run the synchronous call in a thread to avoid blocking
    return await asyncio.to_thread(_call_gemini)
