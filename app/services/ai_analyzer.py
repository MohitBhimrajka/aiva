# app/services/ai_analyzer.py
import os
import json
import logging
import asyncio
import time
from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

# Retry configuration
MAX_RETRIES = 3
RETRY_DELAY_BASE = 1  # Base delay in seconds

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

async def _get_ai_score(question: str, answer: str, role_name: str) -> dict:
    """
    Specialized function to get a numerical score from 1 to 10.
    
    Returns:
        A dictionary with a single 'score' key (integer from 1-10, or 0 on error).
    """
    def _call_gemini_with_retry():
        """Synchronous wrapper for the Gemini API call with retry logic."""
        client = _create_client()
        model = "gemini-2.5-flash"
        
        prompt = f"""
        You are a strict hiring manager evaluating a candidate's answer for a "{role_name}" position.
        
        **The Question:**
        "{question}"
        
        **The Candidate's Answer:**
        "{answer}"
        
        **Your Task:**
        Evaluate this answer as if you were conducting a real interview. Consider:
        - Relevance to the question
        - Technical accuracy (if applicable)
        - Clarity and structure
        - Depth of understanding
        - Real-world applicability
        
        Provide ONLY a numerical score from 1 to 10, where:
        - 1-3: Poor answer (major gaps, incorrect information, or completely off-topic)
        - 4-5: Below average (some relevant points but significant weaknesses)
        - 6-7: Average (acceptable but missing key elements or could be more detailed)
        - 8-9: Good to excellent (strong answer with minor areas for improvement)
        - 10: Outstanding (exemplary answer that demonstrates exceptional understanding)
        
        Return your response as a valid JSON object with a single key: "score".
        
        Example: {{"score": 7}}
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
            thinking_config=types.ThinkingConfig(
                thinking_budget=0,
            ),
            safety_settings=_get_safety_settings(),
            response_mime_type="application/json",
        )
        
        for attempt in range(MAX_RETRIES):
            try:
                # Collect all response chunks
                response_text = ""
                for chunk in client.models.generate_content_stream(
                    model=model,
                    contents=contents,
                    config=generate_content_config,
                ):
                    response_text += chunk.text
                
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
                # Don't retry JSON decode errors - we got a response, it's just malformed
                logger.error(f"Error parsing JSON response from Gemini (score): {e}")
                return {"score": 0}
            except Exception as e:
                last_error = e
                if attempt < MAX_RETRIES - 1:
                    delay = RETRY_DELAY_BASE * (2 ** attempt)  # Exponential backoff
                    logger.warning(f"Gemini API error (attempt {attempt + 1}/{MAX_RETRIES}) for score: {e}. Retrying in {delay}s...")
                    time.sleep(delay)
                else:
                    logger.error(f"Error calling Gemini API for score after {MAX_RETRIES} attempts: {e}")
                    return {"score": 0}
        
        return {"score": 0}
    
    # Run the synchronous call in a thread to avoid blocking
    return await asyncio.to_thread(_call_gemini_with_retry)

async def _get_ai_feedback(question: str, answer: str, role_name: str) -> dict:
    """
    Specialized function to get detailed, constructive feedback.
    
    Returns:
        A dictionary with a single 'feedback' key (string with detailed critique).
    """
    def _call_gemini_with_retry():
        """Synchronous wrapper for the Gemini API call with retry logic."""
        client = _create_client()
        model = "gemini-2.5-flash"
        
        prompt = f"""
        You are an expert career coach and hiring manager with deep experience in "{role_name}" roles.
        
        **The Question:**
        "{question}"
        
        **The Candidate's Answer:**
        "{answer}"
        
        **Your Task:**
        Provide detailed, constructive, and professional feedback on this candidate's answer. Your feedback should:
        
        1. **Acknowledge Strengths:** Identify what the candidate did well (specific examples, good structure, relevant experience, etc.)
        
        2. **Identify Areas for Improvement:** Point out specific weaknesses, gaps, or missed opportunities in a constructive manner
        
        3. **Provide Actionable Guidance:** Offer concrete suggestions for how the candidate could enhance their answer in the future
        
        4. **Maintain Professional Tone:** Be encouraging and supportive while being honest and specific
        
        Your feedback should be comprehensive enough to help the candidate understand both what worked and what could be improved. Aim for 2-4 sentences that provide genuine value.
        
        Return your response as a valid JSON object with a single key: "feedback".
        
        Example: {{"feedback": "Your explanation demonstrates good understanding of the core concept and you provided a relevant example. To strengthen this answer, consider discussing the trade-offs and edge cases. Also, connecting your example back to the specific requirements of this role would make your answer more compelling."}}
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
            thinking_config=types.ThinkingConfig(
                thinking_budget=0,
            ),
            safety_settings=_get_safety_settings(),
            response_mime_type="application/json",
        )
        
        for attempt in range(MAX_RETRIES):
            try:
                # Collect all response chunks
                response_text = ""
                for chunk in client.models.generate_content_stream(
                    model=model,
                    contents=contents,
                    config=generate_content_config,
                ):
                    response_text += chunk.text
                
                # Parse and validate
                response_json = json.loads(response_text)
                if "feedback" in response_json and isinstance(response_json["feedback"], str):
                    return {"feedback": response_json["feedback"]}
                else:
                    logger.error("Feedback response missing or invalid 'feedback' key.")
                    logger.error(f"Response received: {response_text}")
                    return {"feedback": "We encountered an issue analyzing your response. Please try again or review the question and provide a more detailed answer."}
                    
            except json.JSONDecodeError as e:
                # Don't retry JSON decode errors - we got a response, it's just malformed
                logger.error(f"Error parsing JSON response from Gemini (feedback): {e}")
                return {"feedback": "We encountered an issue analyzing your response. Please try again or review the question and provide a more detailed answer."}
            except Exception as e:
                if attempt < MAX_RETRIES - 1:
                    delay = RETRY_DELAY_BASE * (2 ** attempt)  # Exponential backoff
                    logger.warning(f"Gemini API error (attempt {attempt + 1}/{MAX_RETRIES}) for feedback: {e}. Retrying in {delay}s...")
                    time.sleep(delay)
                else:
                    logger.error(f"Error calling Gemini API for feedback after {MAX_RETRIES} attempts: {e}")
                    return {"feedback": "We encountered an issue analyzing your response. Please try again or review the question and provide a more detailed answer."}
        
        return {"feedback": "We encountered an issue analyzing your response. Please try again or review the question and provide a more detailed answer."}
    
    # Run the synchronous call in a thread to avoid blocking
    return await asyncio.to_thread(_call_gemini_with_retry)

async def _get_ai_one_liner(question: str, answer: str, role_name: str) -> dict:
    """
    Specialized function to get a concise, actionable one-line summary.
    
    Returns:
        A dictionary with a single 'oneLiner' key (string with the most important takeaway).
    """
    def _call_gemini_with_retry():
        """Synchronous wrapper for the Gemini API call with retry logic."""
        client = _create_client()
        model = "gemini-2.5-flash"
        
        prompt = f"""
        You are an AI assistant helping interview candidates improve their performance.
        
        **The Question:**
        "{question}"
        
        **The Candidate's Answer:**
        "{answer}"
        
        **Your Task:**
        Distill the most important takeaway from this interview interaction into a single, actionable sentence.
        
        This one-liner should:
        - Be concise (one sentence, ideally under 15 words)
        - Highlight the MOST CRITICAL point for the candidate to remember
        - Be immediately actionable (the candidate should know exactly what to do differently next time)
        - Be encouraging yet constructive
        
        Focus on the single most impactful improvement or the most important strength to leverage.
        
        Return your response as a valid JSON object with a single key: "oneLiner".
        
        Example: {{"oneLiner": "Great example, but connect it back to the job requirements next time."}}
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
            thinking_config=types.ThinkingConfig(
                thinking_budget=0,
            ),
            safety_settings=_get_safety_settings(),
            response_mime_type="application/json",
        )
        
        for attempt in range(MAX_RETRIES):
            try:
                # Collect all response chunks
                response_text = ""
                for chunk in client.models.generate_content_stream(
                    model=model,
                    contents=contents,
                    config=generate_content_config,
                ):
                    response_text += chunk.text
                
                # Parse and validate
                response_json = json.loads(response_text)
                if "oneLiner" in response_json and isinstance(response_json["oneLiner"], str):
                    return {"oneLiner": response_json["oneLiner"]}
                else:
                    logger.error("One-liner response missing or invalid 'oneLiner' key.")
                    logger.error(f"Response received: {response_text}")
                    return {"oneLiner": "Feedback is being processed."}
                    
            except json.JSONDecodeError as e:
                # Don't retry JSON decode errors - we got a response, it's just malformed
                logger.error(f"Error parsing JSON response from Gemini (one-liner): {e}")
                return {"oneLiner": "Feedback is being processed."}
            except Exception as e:
                if attempt < MAX_RETRIES - 1:
                    delay = RETRY_DELAY_BASE * (2 ** attempt)  # Exponential backoff
                    logger.warning(f"Gemini API error (attempt {attempt + 1}/{MAX_RETRIES}) for one-liner: {e}. Retrying in {delay}s...")
                    time.sleep(delay)
                else:
                    logger.error(f"Error calling Gemini API for one-liner after {MAX_RETRIES} attempts: {e}")
                    return {"oneLiner": "Feedback is being processed."}
        
        return {"oneLiner": "Feedback is being processed."}
    
    # Run the synchronous call in a thread to avoid blocking
    return await asyncio.to_thread(_call_gemini_with_retry)

async def analyze_answer_content(question: str, answer: str, role_name: str) -> dict:
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
        # Create tasks for parallel execution
        score_task = asyncio.create_task(_get_ai_score(question, answer, role_name))
        feedback_task = asyncio.create_task(_get_ai_feedback(question, answer, role_name))
        one_liner_task = asyncio.create_task(_get_ai_one_liner(question, answer, role_name))
        
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

async def get_overall_summary(full_transcript: str, role_name: str, client: genai.Client) -> dict:
    """
    Analyzes a full interview transcript to provide a holistic summary.
    
    Args:
        full_transcript: The complete interview transcript as a formatted string
        role_name: The name of the role being interviewed for
        client: A pre-configured Gemini client instance
        
    Returns:
        A dictionary with 'summary', 'strengths', and 'areas_for_improvement' keys.
        Each has appropriate defaults if analysis fails.
    """
    def _call_gemini_with_retry():
        """Synchronous wrapper for the Gemini API call with retry logic."""
        model = "gemini-2.5-flash"
        
        prompt = f"""
You are an expert career coach summarizing a candidate's full interview performance for a "{role_name}" role.

Given the following transcript, your task is to provide a holistic analysis. Be encouraging but direct.

Focus on patterns and overarching themes in the candidate's communication and problem-solving.

**CRITICAL INSTRUCTIONS FOR STRENGTHS:**
- Only list genuine technical, communication, or professional strengths demonstrated in the answers
- Do NOT list attendance, participation, or lack of strengths (e.g., "Attended the interview", "No apparent strengths")
- If no real strengths are evident, return an empty list [] for strengths
- Only include strengths that show actual knowledge, skill, or positive traits from the candidate's responses

Your output MUST be a valid JSON object with three keys:

1. "summary": A 2-3 sentence overview of the candidate's performance.

2. "strengths": A list of 2-3 SPECIFIC, GENUINE positive points demonstrated in the candidate's actual answers. Each strength should reflect actual knowledge, skill, communication ability, or problem-solving demonstrated in their responses. If no real strengths are evident, return an empty list []. Do NOT include generic statements like "attended the interview" or "participated".

3. "areas_for_improvement": A list of the 2-3 most critical areas for improvement as strings.

TRANSCRIPT:

---

{full_transcript}

---

Return your response as a valid JSON object.
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
            thinking_config=types.ThinkingConfig(
                thinking_budget=0,
            ),
            safety_settings=_get_safety_settings(),
            response_mime_type="application/json",
        )
        
        for attempt in range(MAX_RETRIES):
            try:
                # Collect all response chunks
                response_text = ""
                for chunk in client.models.generate_content_stream(
                    model=model,
                    contents=contents,
                    config=generate_content_config,
                ):
                    response_text += chunk.text
                
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
                # Don't retry JSON decode errors - we got a response, it's just malformed
                logger.error(f"Error parsing JSON response from Gemini (overall summary): {e}")
                return {
                    "summary": "We encountered an issue generating your performance summary. Please try viewing this report again later.",
                    "strengths": [],
                    "areas_for_improvement": [],
                }
            except Exception as e:
                if attempt < MAX_RETRIES - 1:
                    delay = RETRY_DELAY_BASE * (2 ** attempt)  # Exponential backoff
                    logger.warning(f"Gemini API error (attempt {attempt + 1}/{MAX_RETRIES}) for overall summary: {e}. Retrying in {delay}s...")
                    time.sleep(delay)
                else:
                    logger.error(f"Error calling Gemini API for overall summary after {MAX_RETRIES} attempts: {e}")
                    return {
                        "summary": "We encountered an issue generating your performance summary. Please try viewing this report again later.",
                        "strengths": [],
                        "areas_for_improvement": [],
                    }
        
        return {
            "summary": "We encountered an issue generating your performance summary. Please try viewing this report again later.",
            "strengths": [],
            "areas_for_improvement": [],
        }
    
    # Run the synchronous call in a thread to avoid blocking
    return await asyncio.to_thread(_call_gemini_with_retry)
