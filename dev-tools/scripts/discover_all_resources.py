#!/usr/bin/env python3
"""
Comprehensive Resource Discovery Script

This script fetches ALL available resources from:
1. HeyGen API - avatars, talking photos, voices, languages
2. Google Cloud TTS - voices, languages

Output is organized to help you make informed decisions about:
- Which avatars to use for different languages
- Which voices sound best for your use case
- What languages are supported by both services

Usage:
    python scripts/discover_all_resources.py --output resources_report.json
"""

import asyncio
import json
import os
import sys
from pathlib import Path
from typing import Dict, List, Any
import logging
from datetime import datetime

# Add the parent directory to the Python path
sys.path.append(str(Path(__file__).parent.parent))

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class ResourceDiscovery:
    """Discovers all available resources from HeyGen and Google Cloud."""
    
    def __init__(self):
        """Initialize the resource discovery."""
        self.heygen_api_key = os.getenv("HEYGEN_API_KEY")
        if not self.heygen_api_key:
            logger.error("HEYGEN_API_KEY not found!")
            sys.exit(1)
    
    async def discover_heygen_resources(self) -> Dict[str, Any]:
        """Discover all HeyGen resources."""
        logger.info("🔍 Discovering HeyGen resources...")
        
        try:
            from app.services.heygen_service import get_heygen_service
            heygen = get_heygen_service()
            
            if not heygen.enabled:
                return {"error": "HeyGen service not enabled"}
            
            # Fetch all resources
            logger.info("Fetching avatars and talking photos...")
            avatars_response = await heygen._make_heygen_request("GET", "/v2/avatars")
            
            logger.info("Fetching voices...")
            voices_response = await heygen._make_heygen_request("GET", "/v2/voices")
            
            # Parse avatar data
            avatar_data = avatars_response.get("data", {})
            avatars = avatar_data.get("avatars", [])
            talking_photos = avatar_data.get("talking_photos", [])
            
            # Parse voice data
            voice_data = voices_response.get("data", {})
            voices = voice_data.get("voices", [])
            
            # Organize avatars by type and capabilities
            premium_avatars = []
            standard_avatars = []
            motion_avatars = []
            
            for avatar in avatars:
                avatar_info = {
                    "id": avatar.get("avatar_id"),
                    "name": avatar.get("avatar_name", "Unknown"),
                    "type": "standard_avatar",
                    "preview_image": avatar.get("preview_image_url"),
                    "gender": avatar.get("gender", "unknown"),
                }
                standard_avatars.append(avatar_info)
            
            for photo in talking_photos:
                photo_info = {
                    "id": photo.get("talking_photo_id"),
                    "name": photo.get("talking_photo_name", "Unknown"),
                    "type": "talking_photo",
                    "preview_image": photo.get("preview_image_url"),
                    "gender": "unknown",  # Not specified for talking photos
                }
                
                # Categorize by motion capability
                if "(Motion)" in photo_info["name"]:
                    motion_avatars.append(photo_info)
                else:
                    premium_avatars.append(photo_info)
            
            # Organize voices by language and quality
            voices_by_language = {}
            premium_voices = []
            interactive_voices = []
            
            for voice in voices:
                language = voice.get("language", "Unknown")
                voice_info = {
                    "id": voice.get("voice_id"),
                    "name": voice.get("name", "Unknown"),
                    "language": language,
                    "gender": voice.get("gender", "unknown"),
                    "preview_audio": voice.get("preview_audio"),
                    "support_pause": voice.get("support_pause", False),
                    "emotion_support": voice.get("emotion_support", False),
                    "support_interactive_avatar": voice.get("support_interactive_avatar", False),
                }
                
                # Organize by language
                if language not in voices_by_language:
                    voices_by_language[language] = []
                voices_by_language[language].append(voice_info)
                
                # Categorize by capabilities
                if voice_info["support_interactive_avatar"]:
                    interactive_voices.append(voice_info)
                if voice_info["emotion_support"]:
                    premium_voices.append(voice_info)
            
            # Get language statistics
            language_stats = {}
            for lang, lang_voices in voices_by_language.items():
                if lang and lang.strip():  # Skip empty languages
                    language_stats[lang] = {
                        "voice_count": len(lang_voices),
                        "female_voices": len([v for v in lang_voices if v["gender"] == "female"]),
                        "male_voices": len([v for v in lang_voices if v["gender"] == "male"]),
                        "interactive_voices": len([v for v in lang_voices if v["support_interactive_avatar"]]),
                        "emotion_voices": len([v for v in lang_voices if v["emotion_support"]]),
                        "sample_voices": lang_voices[:3]  # First 3 voices as samples
                    }
            
            return {
                "timestamp": datetime.now().isoformat(),
                "summary": {
                    "total_avatars": len(avatars),
                    "total_talking_photos": len(talking_photos),
                    "total_voices": len(voices),
                    "languages_supported": len([k for k in language_stats.keys() if k.strip()]),
                    "motion_avatars": len(motion_avatars),
                    "interactive_voices": len(interactive_voices),
                    "emotion_voices": len(premium_voices)
                },
                "avatars": {
                    "standard_avatars": standard_avatars,
                    "premium_talking_photos": premium_avatars,
                    "motion_avatars": motion_avatars
                },
                "voices": {
                    "by_language": voices_by_language,
                    "language_statistics": language_stats,
                    "premium_voices": premium_voices[:10],  # Top 10 premium voices
                    "interactive_voices": interactive_voices[:10]  # Top 10 interactive voices
                },
                "recommendations": {
                    "best_multilingual_voices": [
                        v for v in voices 
                        if v.get("language", "").lower() == "multilingual" 
                        and v.get("support_interactive_avatar", False)
                    ][:5],
                    "best_english_voices": voices_by_language.get("English", [])[:5],
                    "best_spanish_voices": voices_by_language.get("Spanish", [])[:5],
                    "best_french_voices": voices_by_language.get("French", [])[:5],
                }
            }
            
        except Exception as e:
            logger.error(f"Failed to discover HeyGen resources: {e}")
            return {"error": str(e)}
    
    def discover_google_cloud_resources(self) -> Dict[str, Any]:
        """Discover Google Cloud TTS resources."""
        logger.info("🔍 Discovering Google Cloud TTS resources...")
        
        try:
            from app.services.tts_service import get_tts_service
            tts = get_tts_service()
            
            if not tts.is_operational():
                return {"error": "Google Cloud TTS service not operational"}
            
            # Get voice map (populated during TTS service initialization)
            voice_map = tts.voice_map
            supported_languages = tts.get_supported_languages()
            
            # Organize voices by type
            wavenet_voices = {}
            standard_voices = {}
            neural_voices = {}
            
            for lang_code, voices in voice_map.items():
                wavenet_voices[lang_code] = [v for v in voices if "Wavenet" in v]
                standard_voices[lang_code] = [v for v in voices if "Standard" in v]
                neural_voices[lang_code] = [v for v in voices if "Neural" in v or "Studio" in v]
            
            # Calculate statistics
            total_voices = sum(len(voices) for voices in voice_map.values())
            total_wavenet = sum(len(voices) for voices in wavenet_voices.values())
            total_standard = sum(len(voices) for voices in standard_voices.values())
            total_neural = sum(len(voices) for voices in neural_voices.values())
            
            return {
                "timestamp": datetime.now().isoformat(),
                "summary": {
                    "languages_supported": len(supported_languages),
                    "total_voices": total_voices,
                    "wavenet_voices": total_wavenet,
                    "standard_voices": total_standard,
                    "neural_voices": total_neural,
                    "supports_ssml_marks": tts.supports_timepoint_generation()
                },
                "supported_languages": supported_languages,
                "voices_by_language": voice_map,
                "voice_categories": {
                    "wavenet_voices": wavenet_voices,
                    "standard_voices": standard_voices,
                    "neural_voices": neural_voices
                },
                "recommendations": {
                    "best_for_lip_sync": {
                        lang: voices[:2] for lang, voices in wavenet_voices.items() if voices
                    },
                    "most_natural": {
                        lang: [v for v in voices if "Wavenet" in v][:1] 
                        for lang, voices in voice_map.items() if any("Wavenet" in v for v in voices)
                    }
                }
            }
            
        except Exception as e:
            logger.error(f"Failed to discover Google Cloud resources: {e}")
            return {"error": str(e)}
    
    def generate_comparison_report(self, heygen_data: Dict, gcloud_data: Dict) -> Dict[str, Any]:
        """Generate a comparison report between HeyGen and Google Cloud."""
        logger.info("📊 Generating comparison report...")
        
        # Find common languages
        heygen_languages = set()
        if "voices" in heygen_data and "language_statistics" in heygen_data["voices"]:
            heygen_languages = set(heygen_data["voices"]["language_statistics"].keys())
        
        gcloud_languages = set()
        if "supported_languages" in gcloud_data:
            gcloud_languages = set(lang["name"] for lang in gcloud_data["supported_languages"])
        
        # Map language names (HeyGen uses different naming)
        language_mapping = {
            "English": ["English (United States)", "English (United Kingdom)"],
            "Spanish": ["Spanish (Spain)", "Spanish (United States)"],
            "French": ["French (France)", "French (Canada)"],
            "German": ["German (Germany)"],
            "Italian": ["Italian (Italy)"],
            "Portuguese": ["Portuguese (Brazil)", "Portuguese (Portugal)"],
            "Chinese": ["Chinese (Simplified)", "Chinese (Traditional)"],
            "Japanese": ["Japanese"],
            "Korean": ["Korean"],
            "Arabic": ["Arabic"],
        }
        
        common_languages = []
        for heygen_lang in heygen_languages:
            for gcloud_lang in gcloud_languages:
                # Direct match or mapped match
                if (heygen_lang == gcloud_lang or 
                    any(heygen_lang in mapped for mapped in language_mapping.values())):
                    common_languages.append({
                        "heygen_name": heygen_lang,
                        "gcloud_name": gcloud_lang,
                        "heygen_voice_count": heygen_data["voices"]["language_statistics"].get(heygen_lang, {}).get("voice_count", 0),
                        "recommended": heygen_lang in ["English", "Spanish", "French", "German", "Multilingual"]
                    })
        
        return {
            "timestamp": datetime.now().isoformat(),
            "service_comparison": {
                "heygen": {
                    "total_avatars": heygen_data.get("summary", {}).get("total_avatars", 0),
                    "total_talking_photos": heygen_data.get("summary", {}).get("total_talking_photos", 0),
                    "total_voices": heygen_data.get("summary", {}).get("total_voices", 0),
                    "languages": len(heygen_languages),
                    "strengths": [
                        "High-quality video avatars",
                        "Massive voice selection (2000+ voices)",
                        "Motion and emotion support",
                        "Professional talking photos",
                        "Multilingual voices"
                    ]
                },
                "google_cloud": {
                    "total_voices": gcloud_data.get("summary", {}).get("total_voices", 0),
                    "languages": gcloud_data.get("summary", {}).get("languages_supported", 0),
                    "supports_ssml": gcloud_data.get("summary", {}).get("supports_ssml_marks", False),
                    "strengths": [
                        "Real-time generation",
                        "SSML support for lip-sync",
                        "Reliable and fast",
                        "Cost-effective for high volume",
                        "Better language detection"
                    ]
                }
            },
            "common_languages": common_languages,
            "recommendations": {
                "primary_strategy": "Use HeyGen for video avatars with pre-generation",
                "fallback_strategy": "Use Google TTS for real-time backup",
                "best_languages_to_start": ["English", "Spanish", "French", "German"],
                "avatar_recommendations": {
                    "professional_interviews": "Standard avatars or professional talking photos",
                    "casual_interactions": "Motion avatars for more dynamic feel",
                    "multilingual": "Use consistent avatar across languages with different voices"
                }
            }
        }
    
    async def run_full_discovery(self, output_file: str = None) -> Dict[str, Any]:
        """Run complete resource discovery."""
        logger.info("🚀 Starting comprehensive resource discovery...")
        
        # Discover HeyGen resources
        heygen_data = await self.discover_heygen_resources()
        
        # Discover Google Cloud resources
        gcloud_data = self.discover_google_cloud_resources()
        
        # Generate comparison
        comparison = self.generate_comparison_report(heygen_data, gcloud_data)
        
        # Compile final report
        report = {
            "discovery_timestamp": datetime.now().isoformat(),
            "heygen_resources": heygen_data,
            "google_cloud_resources": gcloud_data,
            "comparison_analysis": comparison,
        }
        
        # Save to file if specified
        if output_file:
            with open(output_file, 'w') as f:
                json.dump(report, f, indent=2)
            logger.info(f"📄 Full report saved to {output_file}")
        
        return report


async def main():
    """Main function."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Discover all HeyGen and Google Cloud resources")
    parser.add_argument("--output", type=str, default="resources_discovery_report.json", 
                       help="Output file for the report")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    try:
        discovery = ResourceDiscovery()
        report = await discovery.run_full_discovery(args.output)
        
        # Print summary to console
        print("\n" + "="*80)
        print("🎯 RESOURCE DISCOVERY SUMMARY")
        print("="*80)
        
        # HeyGen summary
        heygen_summary = report["heygen_resources"].get("summary", {})
        print(f"🎬 HEYGEN RESOURCES:")
        print(f"   • Avatars: {heygen_summary.get('total_avatars', 0)}")
        print(f"   • Talking Photos: {heygen_summary.get('total_talking_photos', 0)}")
        print(f"   • Motion Avatars: {heygen_summary.get('motion_avatars', 0)}")
        print(f"   • Total Voices: {heygen_summary.get('total_voices', 0):,}")
        print(f"   • Languages: {heygen_summary.get('languages_supported', 0)}")
        print(f"   • Interactive Voices: {heygen_summary.get('interactive_voices', 0)}")
        print(f"   • Emotion Voices: {heygen_summary.get('emotion_voices', 0)}")
        
        # Google Cloud summary
        gcloud_summary = report["google_cloud_resources"].get("summary", {})
        print(f"\n☁️  GOOGLE CLOUD TTS:")
        print(f"   • Total Voices: {gcloud_summary.get('total_voices', 0)}")
        print(f"   • Languages: {gcloud_summary.get('languages_supported', 0)}")
        print(f"   • Wavenet Voices: {gcloud_summary.get('wavenet_voices', 0)}")
        print(f"   • Standard Voices: {gcloud_summary.get('standard_voices', 0)}")
        print(f"   • SSML Support: {'Yes' if gcloud_summary.get('supports_ssml_marks') else 'No'}")
        
        # Language overlap
        comparison = report["comparison_analysis"]
        common_langs = comparison.get("common_languages", [])
        print(f"\n🌐 COMMON LANGUAGES: {len(common_langs)}")
        for lang in common_langs[:10]:  # Show first 10
            heygen_count = lang.get("heygen_voice_count", 0)
            print(f"   • {lang['heygen_name']}: {heygen_count} HeyGen voices")
        
        print(f"\n📄 Complete details saved to: {args.output}")
        print("\n🔍 NEXT STEPS:")
        print("1. Open the JSON report to explore all avatars and voices")
        print("2. Choose your preferred avatars for different scenarios")
        print("3. Select voices for each language you want to support")
        print("4. Update your avatar/voice configuration")
        
        # Show top recommendations
        print("\n💡 TOP RECOMMENDATIONS:")
        heygen_recs = report["heygen_resources"].get("recommendations", {})
        multilingual = heygen_recs.get("best_multilingual_voices", [])
        if multilingual:
            print("   🌟 Best Multilingual Voices:")
            for voice in multilingual[:3]:
                print(f"      • {voice.get('name', 'Unknown')} (ID: {voice.get('voice_id', 'N/A')})")
        
        english = heygen_recs.get("best_english_voices", [])
        if english:
            print("   🇺🇸 Best English Voices:")
            for voice in english[:3]:
                print(f"      • {voice.get('name', 'Unknown')} (ID: {voice.get('voice_id', 'N/A')})")
        
        print(f"\n✅ Discovery complete! Check {args.output} for full details.")
        
    except Exception as e:
        logger.error(f"Discovery failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
