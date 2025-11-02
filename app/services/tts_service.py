# app/services/tts_service.py
"""
Text-to-Speech service for generating speech audio and speech marks (visemes)
for lip-sync animation. Uses Google Cloud Text-to-Speech API.
"""

import base64
import re
from typing import Dict, List, Optional, Tuple

# Try to import Google Cloud TTS - v1beta1 for timepoint support
try:
    from google.cloud import texttospeech_v1beta1 as texttospeech
    TTS_AVAILABLE = True
    TTS_VERSION = "v1beta1"
except ImportError:
    try:
        # Fallback to v1 if v1beta1 is not available
        from google.cloud import texttospeech
        TTS_AVAILABLE = True
        TTS_VERSION = "v1"
        print("Warning: Using TTS v1 API. Timepoints may not be available. Consider using v1beta1.")
    except ImportError:
        TTS_AVAILABLE = False
        TTS_VERSION = None
        texttospeech = None
        print("Warning: Google Cloud TTS library not available. Voice features will be disabled.")


class TTSService:
    """
    Service for generating speech audio and speech marks using Google Cloud Text-to-Speech.
    """
    
    def __init__(self):
        """
        Initialize the TTS service and client.
        """
        self.client = None
        self.is_available = TTS_AVAILABLE
        self.version = TTS_VERSION
        
        if TTS_AVAILABLE:
            try:
                self.client = texttospeech.TextToSpeechClient()
                print(f"✓ Google Cloud TTS initialized successfully (using {TTS_VERSION})")
            except Exception as e:
                print(f"✗ Could not initialize Google TTS Client. Voice features will be disabled.")
                print(f"  Error: {e}")
                self.client = None
                self.is_available = False
    
    def clean_markdown_formatting(self, text: str) -> str:
        """
        Remove markdown formatting from text to prevent TTS from vocalizing it.
        
        Args:
            text: Text that may contain markdown formatting
            
        Returns:
            Cleaned text without markdown syntax
        """
        # Remove backticks (code formatting)
        text = re.sub(r'`([^`]*)`', r'\1', text)
        
        # Remove bold markers (** or __)
        text = re.sub(r'\*\*([^*]+)\*\*', r'\1', text)
        text = re.sub(r'__([^_]+)__', r'\1', text)
        
        # Remove italic markers (* or _)
        text = re.sub(r'\*([^*]+)\*', r'\1', text)
        text = re.sub(r'_([^_]+)_', r'\1', text)
        
        # Clean up extra whitespace
        text = re.sub(r'\s+', ' ', text).strip()
        
        return text
    
    def text_to_ssml_with_marks(self, text: str) -> str:
        """
        Convert plain text to SSML format with mark tags at word boundaries.
        This enables timepoint tracking for lip-sync animation.
        
        The function:
        1. Cleans markdown formatting
        2. Escapes XML special characters
        3. Adds SSML <mark> tags at strategic points for animation
        4. Splits longer words for smoother animation
        
        Args:
            text: Plain text to convert
            
        Returns:
            SSML-formatted string with mark tags
        """
        # Clean markdown formatting first
        text = self.clean_markdown_formatting(text)
        
        # Escape XML special characters
        text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        
        # Split into words (preserving punctuation)
        words = re.findall(r'\S+', text)
        
        # Build SSML with marks - use more frequent marks for smoother animation
        ssml_parts = ["<speak>"]
        mark_index = 0
        
        for word in words:
            # For longer words, add multiple marks to create smoother animation
            # Estimate syllables by counting vowel groups
            vowel_groups = len(re.findall(r'[aeiouAEIOU]+', word))
            syllables = max(1, min(vowel_groups, 3))  # Cap at 3 marks per word
            
            if syllables > 1 and len(word) > 4:
                # Split word into parts for smoother animation
                # Add a mark at the start and middle/end of longer words
                parts = [word[:len(word)//2], word[len(word)//2:]]
                for part in parts:
                    mark_name = f"viseme_{mark_index}"
                    ssml_parts.append(f"<mark name='{mark_name}'/>{part}")
                    mark_index += 1
            else:
                # Single mark for shorter words
                mark_name = f"viseme_{mark_index}"
                ssml_parts.append(f"<mark name='{mark_name}'/>{word} ")
                mark_index += 1
        
        ssml_parts.append("</speak>")
        return "".join(ssml_parts)
    
    def generate_speech(
        self,
        text: str,
        language_code: str = "en-US",
        voice_gender: str = "FEMALE",
        audio_encoding: str = "MP3"
    ) -> Tuple[str, List[Dict[str, any]]]:
        """
        Generate speech audio and speech marks from text.
        
        Args:
            text: The text to convert to speech
            language_code: BCP-47 language code (default: "en-US")
            voice_gender: Voice gender - "FEMALE", "MALE", or "NEUTRAL" (default: "FEMALE")
            audio_encoding: Audio format - "MP3", "LINEAR16", "OGG_OPUS" (default: "MP3")
            
        Returns:
            Tuple of (base64_encoded_audio, speech_marks_list)
            Returns ("", []) if TTS is not available or fails
        """
        if not self.is_available or not self.client:
            print("TTS service not available - returning empty audio")
            return "", []
        
        try:
            # Convert text to SSML with mark tags
            ssml_content = self.text_to_ssml_with_marks(text)
            synthesis_input = texttospeech.SynthesisInput(ssml=ssml_content)
            
            # Configure voice parameters
            # Use Standard/Wavenet voices (not Studio) - Studio voices don't support SSML marks
            gender_map = {
                "FEMALE": texttospeech.SsmlVoiceGender.FEMALE,
                "MALE": texttospeech.SsmlVoiceGender.MALE,
                "NEUTRAL": texttospeech.SsmlVoiceGender.NEUTRAL,
            }
            
            voice = texttospeech.VoiceSelectionParams(
                language_code=language_code,
                ssml_gender=gender_map.get(voice_gender.upper(), texttospeech.SsmlVoiceGender.FEMALE)
            )
            
            # Configure audio parameters
            encoding_map = {
                "MP3": texttospeech.AudioEncoding.MP3,
                "LINEAR16": texttospeech.AudioEncoding.LINEAR16,
                "OGG_OPUS": texttospeech.AudioEncoding.OGG_OPUS,
            }
            
            audio_config = texttospeech.AudioConfig(
                audio_encoding=encoding_map.get(audio_encoding.upper(), texttospeech.AudioEncoding.MP3)
            )
            
            # Construct request with timepointing enabled
            request = texttospeech.SynthesizeSpeechRequest(
                input=synthesis_input,
                voice=voice,
                audio_config=audio_config,
                enable_time_pointing=[
                    texttospeech.SynthesizeSpeechRequest.TimepointType.SSML_MARK
                ]
            )
            
            # Make the TTS request
            response = self.client.synthesize_speech(request=request)
            
            # Validate that we received timepoints
            speech_marks = []
            if not response.timepoints:
                print("Warning: No timepoints returned from TTS. Lip-sync may not work correctly.")
            else:
                # Format speech marks into a simpler list of dictionaries
                speech_marks = [
                    {"timeSeconds": mark.time_seconds, "value": mark.mark_name}
                    for mark in response.timepoints
                ]
            
            # Encode audio to Base64 for JSON serialization
            audio_content = base64.b64encode(response.audio_content).decode("utf-8")
            
            return audio_content, speech_marks
            
        except Exception as e:
            print(f"Error generating TTS audio: {str(e)}")
            print("Returning empty audio and speech marks")
            return "", []
    
    def is_operational(self) -> bool:
        """
        Check if the TTS service is operational.
        
        Returns:
            True if the service is available and client is initialized
        """
        return self.is_available and self.client is not None


# Create a singleton instance
_tts_service_instance: Optional[TTSService] = None


def get_tts_service() -> TTSService:
    """
    Get the singleton TTS service instance.
    
    Returns:
        TTSService instance
    """
    global _tts_service_instance
    if _tts_service_instance is None:
        _tts_service_instance = TTSService()
    return _tts_service_instance

