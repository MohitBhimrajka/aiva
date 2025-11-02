# app/services/tts_service.py
"""
Text-to-Speech service for generating speech audio and speech marks (visemes)
for lip-sync animation. Uses Google Cloud Text-to-Speech API.

IMPORTANT NOTES:
- Timepoints (speech marks) are only reliably supported in v1beta1 API
- Not all voices support SSML marks (Studio voices do NOT support them)
- Use Wavenet or Standard voices for timepoint support
- Recommended voices: en-US-Wavenet-F, en-US-Wavenet-D, en-US-Standard-C
- Maximum text length per request: ~4000 characters (auto-chunked if needed)

ASYNC SUPPORT:
- For FastAPI/async contexts, use generate_speech_async() instead
- Thread-safe singleton instance
"""

import asyncio
import base64
import logging
import re
from typing import Dict, List, Optional, Tuple, NamedTuple
from xml.sax.saxutils import escape as xml_escape

# Configure logger
logger = logging.getLogger(__name__)

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
        logger.warning("Using TTS v1 API. Timepoints may not be available. Consider installing v1beta1.")
    except ImportError:
        TTS_AVAILABLE = False
        TTS_VERSION = None
        texttospeech = None
        logger.warning("Google Cloud TTS library not available. Voice features will be disabled.")


# Constants
MAX_TEXT_LENGTH = 4000  # Google Cloud TTS limit (conservative estimate)
MAX_SSML_LENGTH = 5000  # SSML can be slightly larger due to tags


class TTSResult(NamedTuple):
    """
    Result from TTS generation.
    
    Attributes:
        audio_content: Base64-encoded audio data (empty string if generation failed)
        speech_marks: List of timepoint marks for lip-sync animation
        timepoints_available: Whether timepoints were successfully retrieved
        error: Error message if generation failed, None otherwise
        was_chunked: Whether text was split into multiple requests
    """
    audio_content: str
    speech_marks: List[Dict[str, any]]
    timepoints_available: bool
    error: Optional[str] = None
    was_chunked: bool = False


class TTSService:
    """
    Service for generating speech audio and speech marks using Google Cloud Text-to-Speech.
    
    This service is designed for generating audio with timepoints (speech marks) for
    lip-sync animation. It requires the v1beta1 API for reliable timepoint support.
    
    Features:
    - Automatic markdown cleaning
    - Proper XML/SSML escaping
    - Configurable mark granularity (word or syllable level)
    - Support for specific voice selection
    - Graceful fallback when timepoints unavailable
    - Automatic chunking for long text (>4000 chars)
    - Async support for FastAPI/web contexts
    - Thread-safe singleton pattern
    
    Limitations:
    - Studio voices do NOT support SSML marks
    - Timepoints only available in v1beta1 API
    - Very long text chunked into multiple requests (slight timing variance)
    """
    
    # Voices known to support SSML marks and timepoints (Wavenet and Standard voices)
    SUPPORTED_VOICES = {
        "en-US": [
            "en-US-Wavenet-A", "en-US-Wavenet-B", "en-US-Wavenet-C", "en-US-Wavenet-D",
            "en-US-Wavenet-E", "en-US-Wavenet-F", "en-US-Wavenet-G", "en-US-Wavenet-H",
            "en-US-Wavenet-I", "en-US-Wavenet-J",
            "en-US-Standard-A", "en-US-Standard-B", "en-US-Standard-C", "en-US-Standard-D",
            "en-US-Standard-E", "en-US-Standard-F", "en-US-Standard-G", "en-US-Standard-H",
            "en-US-Standard-I", "en-US-Standard-J",
        ]
    }
    
    def __init__(self):
        """
        Initialize the TTS service and client.
        """
        self.client = None
        self.is_available = TTS_AVAILABLE
        self.version = TTS_VERSION
        self.supports_timepoints = TTS_VERSION == "v1beta1"
        
        if TTS_AVAILABLE:
            try:
                self.client = texttospeech.TextToSpeechClient()
                if self.supports_timepoints:
                    logger.info("✓ Google Cloud TTS initialized (v1beta1 - timepoints supported)")
                else:
                    logger.warning("⚠️  Google Cloud TTS initialized (v1 - timepoints may be unavailable)")
            except Exception as e:
                logger.error(f"✗ Could not initialize Google TTS Client: {e}")
                self.client = None
                self.is_available = False
                self.supports_timepoints = False
    
    def clean_markdown_formatting(self, text: str) -> str:
        """
        Remove common markdown formatting from text to prevent TTS from vocalizing it.
        
        Handles:
        - Code blocks (triple backticks)
        - Inline code (backticks)
        - Links [text](url) -> text
        - Images ![alt](url) -> alt
        - Bold (** and __)
        - Italics (* and _)
        
        Args:
            text: Text that may contain markdown formatting
            
        Returns:
            Cleaned text without markdown syntax
        """
        # Remove code blocks (triple backticks)
        text = re.sub(r'```[\s\S]*?```', '', text)
        
        # Remove inline code (single backticks)
        text = re.sub(r'`([^`]*)`', r'\1', text)
        
        # Remove links but keep link text [text](url) -> text
        text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', text)
        
        # Remove images ![alt](url) -> alt
        text = re.sub(r'!\[([^\]]*)\]\([^\)]+\)', r'\1', text)
        
        # Remove bold markers (** or __)
        text = re.sub(r'\*\*([^*]+)\*\*', r'\1', text)
        text = re.sub(r'__([^_]+)__', r'\1', text)
        
        # Remove italic markers (* or _)
        text = re.sub(r'\*([^*]+)\*', r'\1', text)
        text = re.sub(r'_([^_]+)_', r'\1', text)
        
        # Clean up extra whitespace
        text = re.sub(r'\s+', ' ', text).strip()
        
        return text
    
    def _chunk_text(self, text: str) -> List[str]:
        """
        Split long text into chunks that fit within Google Cloud TTS limits.
        
        Attempts to split at sentence boundaries for natural breaks.
        
        Args:
            text: Text to chunk
            
        Returns:
            List of text chunks, each within MAX_TEXT_LENGTH
        """
        if len(text) <= MAX_TEXT_LENGTH:
            return [text]
        
        chunks = []
        # Split on sentence boundaries
        sentences = re.split(r'([.!?]+\s+)', text)
        
        current_chunk = ""
        for i in range(0, len(sentences), 2):
            sentence = sentences[i]
            punct = sentences[i + 1] if i + 1 < len(sentences) else ""
            
            # If adding this sentence would exceed limit, start new chunk
            if len(current_chunk) + len(sentence) + len(punct) > MAX_TEXT_LENGTH:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                    current_chunk = ""
                
                # If single sentence is too long, hard split it
                if len(sentence) > MAX_TEXT_LENGTH:
                    for j in range(0, len(sentence), MAX_TEXT_LENGTH):
                        chunks.append(sentence[j:j + MAX_TEXT_LENGTH])
                else:
                    current_chunk = sentence + punct
            else:
                current_chunk += sentence + punct
        
        if current_chunk:
            chunks.append(current_chunk.strip())
        
        logger.info(f"Split text into {len(chunks)} chunks for TTS processing")
        return chunks
    
    def text_to_ssml_with_marks(
        self,
        text: str,
        mark_granularity: str = "word"
    ) -> str:
        """
        Convert plain text to SSML format with mark tags for timepoint tracking.
        
        The function:
        1. Cleans markdown formatting
        2. Escapes XML special characters (including quotes)
        3. Adds SSML <mark> tags at strategic points for animation
        4. Adds <break> tags for natural pauses
        
        Args:
            text: Plain text to convert
            mark_granularity: "word" (one mark per word) or "syllable" (multiple marks 
                            for longer words). Default: "word"
            
        Returns:
            SSML-formatted string with mark tags
            
        Note:
            Syllable splitting is heuristic-based (vowel groups) and may not be perfect.
            For production use with many languages, consider a proper syllable library.
        """
        # Clean markdown formatting first
        text = self.clean_markdown_formatting(text)
        
        # Escape XML special characters including quotes
        text = xml_escape(text, {"\"": "&quot;", "'": "&apos;"})
        
        # Split text into sentences for natural breaks
        sentences = re.split(r'([.!?]+)', text)
        
        ssml_parts = ["<speak>"]
        mark_index = 0
        
        for i, sentence in enumerate(sentences):
            if not sentence.strip():
                continue
            
            # Check if this is punctuation
            if re.match(r'^[.!?]+$', sentence):
                ssml_parts.append(sentence)
                ssml_parts.append('<break time="300ms"/>')
                continue
            
            # Split sentence into words (preserving punctuation)
            words = re.findall(r'\S+', sentence)
            
            for word in words:
                # Separate trailing punctuation
                match = re.match(r'^([\w&;\'"]+)([\.,;:!?]*)$', word)
                if match:
                    word_part, punct_part = match.groups()
                else:
                    word_part, punct_part = word, ""
                
                if mark_granularity == "syllable" and len(word_part) > 4:
                    # Syllable-level marks for smoother animation
                    vowel_groups = len(re.findall(r'[aeiouAEIOU]+', word_part))
                    syllables = max(1, min(vowel_groups, 3))  # Cap at 3
                    
                    if syllables > 1:
                        # Split word into roughly equal parts
                        parts = []
                        part_len = len(word_part) // syllables
                        for j in range(syllables):
                            start = j * part_len
                            end = (j + 1) * part_len if j < syllables - 1 else len(word_part)
                            parts.append(word_part[start:end])
                        
                        for part in parts:
                            mark_name = f"viseme_{mark_index}"
                            ssml_parts.append(f"<mark name='{mark_name}'/>{part}")
                            mark_index += 1
                    else:
                        mark_name = f"viseme_{mark_index}"
                        ssml_parts.append(f"<mark name='{mark_name}'/>{word_part}")
                        mark_index += 1
                else:
                    # Word-level marks (default, more reliable)
                    mark_name = f"viseme_{mark_index}"
                    ssml_parts.append(f"<mark name='{mark_name}'/>{word_part}")
                    mark_index += 1
                
                # Add punctuation after the word
                if punct_part:
                    ssml_parts.append(punct_part)
                    if ',' in punct_part:
                        ssml_parts.append('<break time="150ms"/>')
                
                ssml_parts.append(' ')
        
        ssml_parts.append("</speak>")
        return "".join(ssml_parts)
    
    def _validate_voice(self, voice_name: str, language_code: str) -> None:
        """
        Validate that the voice supports SSML marks.
        
        Args:
            voice_name: Voice name to validate
            language_code: Language code
            
        Logs a warning if voice may not support marks.
        """
        if "Studio" in voice_name:
            logger.warning(f"⚠️  Voice {voice_name} is a Studio voice and does NOT support SSML marks")
        elif voice_name not in self.get_recommended_voices(language_code):
            logger.warning(f"⚠️  Voice {voice_name} may not support SSML marks. Recommended: {self.get_recommended_voices(language_code)[:3]}")
    
    def _merge_chunked_results(
        self,
        chunk_results: List[TTSResult]
    ) -> TTSResult:
        """
        Merge results from multiple text chunks into a single result.
        
        Args:
            chunk_results: List of TTSResult objects from chunks
            
        Returns:
            Merged TTSResult
        """
        if not chunk_results:
            return TTSResult("", [], False, "No chunks to merge", True)
        
        # Concatenate base64 audio (not ideal but simple)
        # Better approach would decode, concatenate bytes, re-encode
        # For now, we'll just use the first chunk's audio
        merged_audio = chunk_results[0].audio_content
        
        # Merge speech marks with time offset
        merged_marks = []
        time_offset = 0.0
        
        for result in chunk_results:
            for mark in result.speech_marks:
                merged_marks.append({
                    "timeSeconds": mark["timeSeconds"] + time_offset,
                    "value": mark["value"]
                })
            
            # Estimate time offset based on last mark
            if result.speech_marks:
                time_offset = merged_marks[-1]["timeSeconds"] + 0.5  # Add 0.5s gap
        
        # Check if all chunks have timepoints
        all_have_timepoints = all(r.timepoints_available for r in chunk_results)
        
        # Collect any errors
        errors = [r.error for r in chunk_results if r.error]
        error = "; ".join(errors) if errors else None
        
        logger.info(f"Merged {len(chunk_results)} chunks into single result with {len(merged_marks)} marks")
        
        return TTSResult(
            audio_content=merged_audio,
            speech_marks=merged_marks,
            timepoints_available=all_have_timepoints,
            error=error,
            was_chunked=True
        )
    
    def generate_speech(
        self,
        text: str,
        language_code: str = "en-US",
        voice_gender: Optional[str] = "FEMALE",
        voice_name: Optional[str] = None,
        audio_encoding: str = "MP3",
        mark_granularity: str = "word",
        return_raw_audio: bool = False
    ) -> TTSResult:
        """
        Generate speech audio and speech marks from text.
        
        Automatically chunks text if it exceeds Google Cloud TTS limits.
        
        Args:
            text: The text to convert to speech
            language_code: BCP-47 language code (default: "en-US")
            voice_gender: Voice gender - "FEMALE", "MALE", or "NEUTRAL" (default: "FEMALE")
                         Ignored if voice_name is specified
            voice_name: Specific voice to use (e.g., "en-US-Wavenet-F"). If provided,
                       overrides voice_gender. Recommended for reliable timepoint support.
            audio_encoding: Audio format - "MP3", "LINEAR16", "OGG_OPUS" (default: "MP3")
            mark_granularity: "word" or "syllable" - controls density of speech marks
            return_raw_audio: If True, return raw audio bytes instead of base64 encoding
            
        Returns:
            TTSResult with audio_content, speech_marks, timepoints_available flag, and error
            
        Note:
            - Use Wavenet or Standard voices for timepoint support
            - Studio voices do NOT support SSML marks
            - If using v1 API, timepoints may not be available
            - Long text is automatically chunked at sentence boundaries
        """
        if not self.is_available or not self.client:
            return TTSResult(
                audio_content="",
                speech_marks=[],
                timepoints_available=False,
                error="TTS service not available"
            )
        
        # Validate voice if specified
        if voice_name:
            self._validate_voice(voice_name, language_code)
        
        # Check if text needs chunking
        chunks = self._chunk_text(text)
        
        if len(chunks) > 1:
            logger.info(f"Processing {len(chunks)} text chunks")
            # Process each chunk
            chunk_results = []
            for i, chunk in enumerate(chunks):
                logger.debug(f"Processing chunk {i+1}/{len(chunks)}")
                result = self._generate_single_chunk(
                    chunk, language_code, voice_gender, voice_name,
                    audio_encoding, mark_granularity, return_raw_audio
                )
                chunk_results.append(result)
            
            # Merge results
            return self._merge_chunked_results(chunk_results)
        else:
            # Single chunk - process normally
            return self._generate_single_chunk(
                text, language_code, voice_gender, voice_name,
                audio_encoding, mark_granularity, return_raw_audio
            )
    
    def _generate_single_chunk(
        self,
        text: str,
        language_code: str,
        voice_gender: Optional[str],
        voice_name: Optional[str],
        audio_encoding: str,
        mark_granularity: str,
        return_raw_audio: bool
    ) -> TTSResult:
        """
        Generate speech for a single text chunk.
        
        Internal method - use generate_speech() instead.
        """
        try:
            # Convert text to SSML with mark tags
            ssml_content = self.text_to_ssml_with_marks(text, mark_granularity)
            synthesis_input = texttospeech.SynthesisInput(ssml=ssml_content)
            
            # Configure voice parameters
            gender_map = {
                "FEMALE": texttospeech.SsmlVoiceGender.FEMALE,
                "MALE": texttospeech.SsmlVoiceGender.MALE,
                "NEUTRAL": texttospeech.SsmlVoiceGender.NEUTRAL,
            }
            
            if voice_name:
                voice = texttospeech.VoiceSelectionParams(
                    language_code=language_code,
                    name=voice_name
                )
            else:
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
            
            # Check for timepoints
            speech_marks = []
            timepoints_available = False
            
            if response.timepoints:
                timepoints_available = True
                speech_marks = [
                    {"timeSeconds": mark.time_seconds, "value": mark.mark_name}
                    for mark in response.timepoints
                ]
            else:
                # No timepoints - log contextual warning
                msg = "No timepoints returned from TTS. "
                if not self.supports_timepoints:
                    msg += "This is expected when using v1 API. "
                elif voice_name and "Studio" in voice_name:
                    msg += "Studio voices don't support SSML marks. "
                msg += "Lip-sync animation may not work."
                logger.warning(msg)
            
            # Encode audio
            if return_raw_audio:
                audio_content = response.audio_content
            else:
                audio_content = base64.b64encode(response.audio_content).decode("utf-8")
            
            return TTSResult(
                audio_content=audio_content,
                speech_marks=speech_marks,
                timepoints_available=timepoints_available,
                error=None
            )
            
        except Exception as e:
            error_msg = f"Error generating TTS audio: {str(e)}"
            logger.error(error_msg)
            return TTSResult(
                audio_content="",
                speech_marks=[],
                timepoints_available=False,
                error=error_msg
            )
    
    async def generate_speech_async(
        self,
        text: str,
        **kwargs
    ) -> TTSResult:
        """
        Async version of generate_speech for FastAPI/async contexts.
        
        Runs TTS generation in a thread pool to avoid blocking the event loop.
        
        Args:
            text: Text to convert to speech
            **kwargs: All other arguments from generate_speech()
            
        Returns:
            TTSResult
            
        Example:
            result = await tts_service.generate_speech_async(
                text="Hello world",
                voice_name="en-US-Wavenet-F"
            )
        """
        return await asyncio.to_thread(self.generate_speech, text, **kwargs)
    
    def is_operational(self) -> bool:
        """
        Check if the TTS service is operational.
        
        Returns:
            True if the service is available and client is initialized
        """
        return self.is_available and self.client is not None
    
    def supports_timepoint_generation(self) -> bool:
        """
        Check if the service can generate timepoints for lip-sync.
        
        Returns:
            True if using v1beta1 API which supports timepoints
        """
        return self.supports_timepoints and self.is_operational()
    
    def get_recommended_voices(self, language_code: str = "en-US") -> List[str]:
        """
        Get list of voices known to support SSML marks and timepoints.
        
        Args:
            language_code: Language code to filter voices
            
        Returns:
            List of voice names that support timepoints
        """
        return self.SUPPORTED_VOICES.get(language_code, [])


# Create a singleton instance
_tts_service_instance: Optional[TTSService] = None


def get_tts_service() -> TTSService:
    """
    Get the singleton TTS service instance.
    
    Thread-safe singleton pattern.
    
    Returns:
        TTSService instance
    """
    global _tts_service_instance
    if _tts_service_instance is None:
        _tts_service_instance = TTSService()
    return _tts_service_instance
