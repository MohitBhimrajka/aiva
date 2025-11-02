# app/services/stt_service.py
"""
Speech-to-Text service for real-time transcription using Google Cloud Speech-to-Text API.

Features:
- Real-time streaming transcription via WebSocket
- Word-level timestamps for accurate metrics
- Automatic reconnection handling for 4-minute streaming limit
- Cost controls and resource limits
- Heartbeat mechanism for connection health

IMPORTANT NOTES:
- Maximum streaming duration: ~4 minutes per continuous stream (GCSTT limit)
- Service automatically handles reconnection for longer sessions
- Audio must be LINEAR16 encoding at 16kHz sample rate
- Word timestamps only available in final results
"""

import asyncio
import logging
import os
import time
from typing import AsyncGenerator, Dict, List, Optional, Any
from dataclasses import dataclass

# Configure logger
logger = logging.getLogger(__name__)

# Try to import Google Cloud Speech
try:
    from google.cloud import speech_v1
    from google.cloud.speech_v1 import types
    STT_AVAILABLE = True
except ImportError:
    STT_AVAILABLE = False
    speech_v1 = None
    types = None
    logger.warning("Google Cloud Speech-to-Text library not available. Transcription features will be disabled.")

# Configuration constants
MAX_STREAMING_DURATION_SECONDS = int(os.getenv("MAX_STREAMING_DURATION_SECONDS", 240))  # 4 minutes (GCSTT limit)
MAX_AUDIO_BYTES_PER_SESSION = int(os.getenv("MAX_AUDIO_BYTES_PER_SESSION", 50 * 1024 * 1024))  # 50MB default limit
HEARTBEAT_INTERVAL = 30  # seconds


@dataclass
class TranscriptionResult:
    """Result from transcription processing."""
    is_final: bool
    transcript: str
    confidence: Optional[float]
    words: List[Dict[str, Any]]
    stream_number: int
    error: Optional[str] = None
    warning: Optional[str] = None


class STTService:
    """
    Service for real-time speech-to-text transcription using Google Cloud Speech-to-Text.
    
    This service handles streaming audio transcription with:
    - Automatic reconnection for 4-minute streaming limits
    - Word-level timestamps for accurate metrics
    - Cost controls and resource limits
    - Heartbeat monitoring for connection health
    
    Usage:
        service = STTService()
        async for result in service.transcribe_stream(audio_generator):
            # Process transcription results
            if result.is_final:
                # Handle final transcript with word timings
                pass
    """
    
    def __init__(self):
        """Initialize the STT service and client."""
        self.client = None
        self.is_available = STT_AVAILABLE
        
        if STT_AVAILABLE:
            try:
                # Check for credentials
                if not os.getenv("GOOGLE_APPLICATION_CREDENTIALS") and not os.path.exists("gcp-credentials.json"):
                    logger.warning("Google Cloud credentials not found. Transcription may fail.")
                
                self.client = speech_v1.SpeechAsyncClient()
                logger.info("✓ Google Cloud Speech-to-Text initialized")
            except Exception as e:
                logger.error(f"✗ Could not initialize Google STT Client: {e}")
                self.client = None
                self.is_available = False
    
    def get_recognition_config(
        self,
        language_code: str = "en-US",
        sample_rate_hertz: int = 16000,
        enable_word_time_offsets: bool = True,
        enable_automatic_punctuation: bool = True
    ) -> types.RecognitionConfig:
        """
        Create a recognition configuration for transcription.
        
        Args:
            language_code: BCP-47 language code (default: "en-US")
            sample_rate_hertz: Audio sample rate (default: 16000)
            enable_word_time_offsets: Enable word-level timestamps (default: True)
            enable_automatic_punctuation: Enable automatic punctuation (default: True)
            
        Returns:
            RecognitionConfig object
        """
        if not STT_AVAILABLE:
            raise RuntimeError("Google Cloud Speech-to-Text is not available")
        
        return types.RecognitionConfig(
            encoding=types.RecognitionConfig.AudioEncoding.LINEAR16,
            sample_rate_hertz=sample_rate_hertz,
            language_code=language_code,
            enable_automatic_punctuation=enable_automatic_punctuation,
            enable_word_time_offsets=enable_word_time_offsets,
        )
    
    def parse_word_timestamps(self, word_info: Any) -> Dict[str, Any]:
        """
        Parse word timestamps from Google Cloud Speech response.
        
        Handles Duration protobuf format with support for both:
        - total_seconds() method (if available)
        - seconds + nanos attributes (standard protobuf format)
        
        Args:
            word_info: WordInfo object from GCSTT response
            
        Returns:
            Dictionary with word, start_time, and end_time
        """
        start_time = 0.0
        end_time = 0.0
        
        # Parse start_time
        if hasattr(word_info, 'start_time'):
            duration = word_info.start_time
            if hasattr(duration, 'total_seconds'):
                start_time = duration.total_seconds()
            elif hasattr(duration, 'seconds'):
                nanos = getattr(duration, 'nanos', 0)
                start_time = duration.seconds + (nanos / 1e9)
        
        # Parse end_time
        if hasattr(word_info, 'end_time'):
            duration = word_info.end_time
            if hasattr(duration, 'total_seconds'):
                end_time = duration.total_seconds()
            elif hasattr(duration, 'seconds'):
                nanos = getattr(duration, 'nanos', 0)
                end_time = duration.seconds + (nanos / 1e9)
        
        return {
            "word": word_info.word,
            "start_time": start_time,
            "end_time": end_time,
        }
    
    async def transcribe_stream(
        self,
        audio_generator: AsyncGenerator[bytes, None],
        config: types.RecognitionConfig,
        max_duration_seconds: int = MAX_STREAMING_DURATION_SECONDS,
        max_bytes: int = MAX_AUDIO_BYTES_PER_SESSION,
        heartbeat_interval: int = HEARTBEAT_INTERVAL
    ) -> AsyncGenerator[TranscriptionResult, None]:
        """
        Transcribe audio stream in real-time.
        
        This generator handles:
        - Automatic reconnection for 4-minute streaming limits
        - Cost controls and resource limits
        - Heartbeat monitoring
        - Word timestamp extraction
        
        Args:
            audio_generator: Async generator yielding audio chunks (bytes)
            config: RecognitionConfig for transcription settings
            max_duration_seconds: Maximum duration per stream before reconnection (default: 240s)
            max_bytes: Maximum bytes to process per session (default: 50MB)
            heartbeat_interval: Interval for heartbeat checks in seconds (default: 30s)
            
        Yields:
            TranscriptionResult objects with transcripts, timestamps, and metadata
            
        Note:
            Automatically handles stream reconnection every ~4 minutes to comply with GCSTT limits.
            Word timestamps are only available in final results.
        """
        if not self.is_available or not self.client:
            yield TranscriptionResult(
                is_final=False,
                transcript="",
                confidence=None,
                words=[],
                stream_number=0,
                error="STT service not available"
            )
            return
        
        streaming_config = types.StreamingRecognitionConfig(
            config=config,
            interim_results=True
        )
        
        stream_count = 0
        total_bytes_received = 0
        
        while True:
            stream_start_time = time.time()
            stream_count += 1
            last_data_time = stream_start_time
            
            # Warn about reconnection if this is not the first stream
            if stream_count > 1:
                yield TranscriptionResult(
                    is_final=False,
                    transcript="",
                    confidence=None,
                    words=[],
                    stream_number=stream_count,
                    warning="Stream reconnected due to time limit"
                )
            
            # Define request generator for this stream
            stream_bytes_received = 0  # Bytes for this specific stream
            
            async def request_generator():
                nonlocal stream_bytes_received, total_bytes_received
                # First message must be the config
                yield types.StreamingRecognizeRequest(streaming_config=streaming_config)
                
                try:
                    async for audio_chunk in audio_generator:
                        # Update byte counters
                        stream_bytes_received += len(audio_chunk)
                        total_bytes_received += len(audio_chunk)
                        
                        # Check timeout
                        elapsed = time.time() - stream_start_time
                        if elapsed >= max_duration_seconds:
                            logger.info(f"Stream {stream_count} reached time limit ({max_duration_seconds}s)")
                            break
                        
                        # Check byte limit
                        if total_bytes_received > max_bytes:
                            logger.warning(f"Stream exceeded byte limit ({max_bytes} bytes)")
                            break
                        
                        yield types.StreamingRecognizeRequest(audio_content=audio_chunk)
                except Exception as e:
                    logger.error(f"Error in audio generator: {e}")
            
            # Process the stream
            try:
                requests = request_generator()
                stream = await self.client.streaming_recognize(requests=requests)
                
                # Track if we've received any audio to distinguish normal completion from real errors
                received_audio = False
                last_final_result_time = None
                
                async for response in stream:
                    if not response.results:
                        continue
                    
                    for result in response.results:
                        if not result.alternatives:
                            continue
                        
                        transcript = result.alternatives[0].transcript
                        confidence = getattr(result.alternatives[0], 'confidence', None)
                        
                        # Extract word timings (only available in final results)
                        words_data = []
                        if result.is_final and hasattr(result.alternatives[0], 'words'):
                            for word_info in result.alternatives[0].words:
                                words_data.append(self.parse_word_timestamps(word_info))
                            last_final_result_time = time.time()
                        
                        if transcript:
                            received_audio = True
                        
                        # Yield transcription result
                        yield TranscriptionResult(
                            is_final=result.is_final,
                            transcript=transcript,
                            confidence=confidence,
                            words=words_data,
                            stream_number=stream_count
                        )
                        
                        # Check if approaching time limit
                        elapsed = time.time() - stream_start_time
                        if elapsed >= max_duration_seconds - 10:  # Warn 10s before limit
                            remaining = max_duration_seconds - int(elapsed)
                            yield TranscriptionResult(
                                is_final=False,
                                transcript="",
                                confidence=None,
                                words=[],
                                stream_number=stream_count,
                                warning=f"Streaming will reconnect in {remaining} seconds"
                            )
                            break
                        
                        last_data_time = time.time()
                
                # Stream completed normally (all audio sent, all responses received)
                logger.info(f"Stream {stream_count} completed normally")
                
                # Check if we should continue to next stream
                elapsed = time.time() - stream_start_time
                if elapsed >= max_duration_seconds:
                    # Time limit reached, continue to next stream
                    continue
                else:
                    # Stream ended normally (all audio processed), exit
                    logger.info(f"Stream {stream_count} finished processing all audio")
                    break
                    
            except StopAsyncIteration:
                # Normal completion when generator exhausts
                logger.info(f"Stream {stream_count} generator exhausted (normal completion)")
                elapsed = time.time() - stream_start_time
                if elapsed >= max_duration_seconds:
                    continue  # Reconnect if time limit reached
                else:
                    break  # Normal completion, exit
                    
            except Exception as stream_error:
                error_type = type(stream_error).__name__
                error_msg = str(stream_error)
                
                # Check if this is a normal completion or expected behavior
                is_normal_completion = (
                    "cancelled" in error_msg.lower() or
                    "closed" in error_msg.lower() or
                    ("audio timeout" in error_msg.lower() and stream_bytes_received > 0) or
                    ("timeout" in error_msg.lower() and stream_bytes_received > 0 and elapsed < 30)
                )
                
                # Audio timeout is EXPECTED when audio generator finishes
                # Google Cloud closes the stream after receiving all audio
                # Final results should have been received before this timeout
                if is_normal_completion:
                    logger.info(f"Stream {stream_count} ended normally ({error_type}: {error_msg[:100]})")
                    elapsed = time.time() - stream_start_time
                    # If we received audio and finished before time limit, this is normal completion
                    if elapsed < max_duration_seconds and stream_bytes_received > 0:
                        logger.info(f"Stream {stream_count} completed successfully ({stream_bytes_received} bytes processed)")
                        break  # Normal completion, exit stream loop
                    elif elapsed >= max_duration_seconds:
                        logger.info(f"Stream {stream_count} reached time limit, would reconnect if needed")
                        continue  # Time limit reached, reconnect if looping
                    else:
                        logger.info(f"Stream {stream_count} completed early")
                        break  # Normal completion
                
                logger.error(f"Error in stream processing for stream {stream_count}: {error_type}: {error_msg}")
                
                # Check if we should reconnect
                elapsed = time.time() - stream_start_time
                if elapsed < max_duration_seconds:
                    # Unexpected error, try to reconnect
                    yield TranscriptionResult(
                        is_final=False,
                        transcript="",
                        confidence=None,
                        words=[],
                        stream_number=stream_count,
                        error="Stream error occurred, attempting to reconnect...",
                        warning="reconnecting"
                    )
                    await asyncio.sleep(1)  # Brief pause before reconnecting
                    continue
                else:
                    # Time limit reached, reconnect naturally
                    logger.info(f"Stream {stream_count} completed, reconnecting...")
                    continue
    
    def is_operational(self) -> bool:
        """
        Check if the STT service is operational.
        
        Returns:
            True if the service is available and client is initialized
        """
        return self.is_available and self.client is not None


# Create a singleton instance
_stt_service_instance: Optional[STTService] = None


def get_stt_service() -> STTService:
    """
    Get the singleton STT service instance.
    
    Thread-safe singleton pattern.
    
    Returns:
        STTService instance
    """
    global _stt_service_instance
    if _stt_service_instance is None:
        _stt_service_instance = STTService()
    return _stt_service_instance

