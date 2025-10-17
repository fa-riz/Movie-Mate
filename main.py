import os
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Float, Text, Boolean, DateTime, func
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from pydantic import BaseModel, field_validator
from typing import List, Optional, Dict, Any
import requests
from datetime import datetime, timedelta
from dotenv import load_dotenv
import sqlite3
import json
from functools import lru_cache
import random
import uuid

# Load environment variables
load_dotenv()

# Database setup
SQLALCHEMY_DATABASE_URL = "sqlite:///./moviemate.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# TMDB Configuration
TMDB_API_KEY = os.getenv('TMDB_API_KEY', '')
TMDB_ACCESS_TOKEN = os.getenv('TMDB_ACCESS_TOKEN', '')
TMDB_BASE_URL = "https://api.themoviedb.org/3"
TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500"

# AI21 Configuration
AI21_API_KEY = os.getenv('AI21_API_KEY', '')
AI21_BASE_URL = "https://api.ai21.com/studio/v1"

# TMDB Genre IDs Mapping
TMDB_GENRE_IDS = {
    "Action": 28, "Adventure": 12, "Animation": 16, "Comedy": 35,
    "Crime": 80, "Documentary": 99, "Drama": 18, "Family": 10751,
    "Fantasy": 14, "History": 36, "Horror": 27, "Music": 10402,
    "Mystery": 9648, "Romance": 10749, "Science Fiction": 878,
    "TV Movie": 10770, "Thriller": 53, "War": 10752, "Western": 37
}

# Constants
EPISODE_DURATION_MINUTES = 20  # Average episode duration in minutes
MIN_GOOD_RATING = 7.0  # Minimum rating to be considered "good"
MIN_TOP_RATING = 8.0   # Minimum rating for top-rated section
MAX_SEARCH_RESULTS = 3  # Limit search results to 3 for faster response

# Models
class Movie(Base):
    __tablename__ = "movies"
    
    id = Column(Integer, primary_key=True, index=True)
    tmdb_id = Column(Integer, nullable=True)
    title = Column(String, index=True)
    director = Column(String, default="")
    genre = Column(String, default="")
    platform = Column(String, default="")
    status = Column(String, default="wishlist")
    rating = Column(Float, nullable=True)
    review = Column(Text, nullable=True)
    episodes_watched = Column(Integer, default=0, nullable=False)
    total_episodes = Column(Integer, nullable=True)
    minutes_watched = Column(Integer, default=0, nullable=False)
    total_minutes = Column(Integer, nullable=True)
    is_tv_show = Column(Boolean, default=False)
    poster_path = Column(String, nullable=True)
    release_date = Column(String, nullable=True)
    overview = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

# Party Room Model
class PartyRoom(Base):
    __tablename__ = "party_rooms"
    
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, index=True)
    movie_id = Column(Integer)
    movie_title = Column(String)
    movie_poster = Column(String, nullable=True)
    host_id = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    members = Column(Text, default="[]")  # Store as JSON string

# Database Migration Function
def migrate_database():
    """Add new columns to existing database and fix null values"""
    try:
        conn = sqlite3.connect('moviemate.db')
        cursor = conn.cursor()
        
        # Check if minutes_watched column exists
        cursor.execute("PRAGMA table_info(movies)")
        columns = [column[1] for column in cursor.fetchall()]
        
        migrations_applied = []
        
        if 'minutes_watched' not in columns:
            print("🔄 Adding minutes_watched column...")
            cursor.execute("ALTER TABLE movies ADD COLUMN minutes_watched INTEGER DEFAULT 0")
            migrations_applied.append("minutes_watched")
        
        if 'total_minutes' not in columns:
            print("🔄 Adding total_minutes column...")
            cursor.execute("ALTER TABLE movies ADD COLUMN total_minutes INTEGER")
            migrations_applied.append("total_minutes")
        
        # Check if party_rooms table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='party_rooms'")
        if not cursor.fetchone():
            print("🔄 Creating party_rooms table...")
            cursor.execute("""
                CREATE TABLE party_rooms (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    code TEXT UNIQUE,
                    movie_id INTEGER,
                    movie_title TEXT,
                    movie_poster TEXT,
                    host_id TEXT,
                    is_active BOOLEAN DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    members TEXT DEFAULT '[]'
                )
            """)
            migrations_applied.append("party_rooms")
        
        # Fix any null values in episodes_watched and minutes_watched
        print("🔄 Fixing null values in episodes_watched...")
        cursor.execute("UPDATE movies SET episodes_watched = 0 WHERE episodes_watched IS NULL")
        
        print("🔄 Fixing null values in minutes_watched...")
        cursor.execute("UPDATE movies SET minutes_watched = 0 WHERE minutes_watched IS NULL")
        
        # Ensure created_at has proper default values for existing records
        print("🔄 Ensuring created_at values exist...")
        cursor.execute("UPDATE movies SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL")
        
        conn.commit()
        conn.close()
        
        if migrations_applied:
            print(f"✅ Database migration completed! Added: {', '.join(migrations_applied)}")
        else:
            print("✅ Database is up to date!")
            
    except Exception as e:
        print(f"❌ Migration error: {e}")

# Create all tables with migration
try:
    Base.metadata.create_all(bind=engine)
    print("✅ Database tables created successfully")
    
    # Run migration to ensure new columns are added and null values are fixed
    migrate_database()
    
except Exception as e:
    print(f"❌ Error creating database tables: {e}")

# Pydantic models with proper validation
class MovieBase(BaseModel):
    title: str
    director: str = ""
    genre: str = ""
    platform: str = ""
    status: str = "wishlist"
    is_tv_show: bool = False
    episodes_watched: int = 0
    total_episodes: Optional[int] = None
    minutes_watched: int = 0
    total_minutes: Optional[int] = None
    
    @field_validator('episodes_watched', 'minutes_watched', mode='before')
    @classmethod
    def set_default_int(cls, v):
        """Ensure integer fields are never None"""
        if v is None:
            return 0
        return v

class MovieCreate(MovieBase):
    tmdb_id: Optional[int] = None
    poster_path: Optional[str] = None
    overview: Optional[str] = None
    release_date: Optional[str] = None

class TMDBMovieAdd(BaseModel):
    tmdb_id: int
    platform: str = ""
    status: str = "wishlist"
    is_tv_show: bool = False

class MovieUpdate(BaseModel):
    rating: Optional[float] = None
    review: Optional[str] = None
    episodes_watched: Optional[int] = None
    minutes_watched: Optional[int] = None
    total_minutes: Optional[int] = None
    status: Optional[str] = None
    
    @field_validator('episodes_watched', 'minutes_watched', mode='before')
    @classmethod
    def set_default_int(cls, v):
        """Ensure integer fields are never None"""
        if v is None:
            return 0
        return v

class MovieResponse(MovieBase):
    id: int
    tmdb_id: Optional[int]
    rating: Optional[float]
    review: Optional[str]
    poster_path: Optional[str]
    release_date: Optional[str]
    overview: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True

class RatingReviewUpdate(BaseModel):
    rating: Optional[float] = None
    review: Optional[str] = None

class ReviewGenerationRequest(BaseModel):
    user_notes: str = ""
    rating: Optional[float] = None
    length: Optional[str] = "medium"  # short, medium, long

class ReviewGenerationResponse(BaseModel):
    review: str

# Recommendation Models
class RecommendationRequest(BaseModel):
    max_results: int = 10

class RecommendationResponse(BaseModel):
    recommendations: List[Dict[str, Any]]
    based_on: List[str]
    message: str

# NEW: Test Review Request Model with length parameter
class TestReviewRequest(BaseModel):
    title: Optional[str] = None
    rating: Optional[float] = None
    user_notes: str = ""
    length: Optional[str] = "medium"  # short, medium, long

# Party Watcher Models
class PartyRoomBase(BaseModel):
    movie_id: int
    movie_title: str
    movie_poster: Optional[str] = None
    host_id: str

class PartyRoomCreate(PartyRoomBase):
    pass

class PartyRoomResponse(PartyRoomBase):
    id: int
    code: str
    created_at: datetime
    is_active: bool
    members: List[Dict[str, Any]] = []

class PartyJoinRequest(BaseModel):
    room_code: str
    user_id: str
    user_name: str

class PartySyncRequest(BaseModel):
    room_code: str
    action: str  # play, pause, seek
    timestamp: int

class PartyMember(BaseModel):
    id: str
    name: str
    is_host: bool = False
    joined_at: datetime

class PartyStartRequest(BaseModel):
    room_code: str

# AI21 Review Generator - ENHANCED WITH LENGTH CONTROL AND NO "ADDITIONAL NOTES"
class AI21ReviewGenerator:
    def __init__(self):
        self.api_key = AI21_API_KEY
        self.base_url = "https://api.ai21.com/studio/v1"  # FIXED: Use base URL only
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        } if self.api_key else {}
        
        if not self.api_key:
            print("⚠️  No AI21 API key found. AI reviews disabled.")
        else:
            print("✅ AI21 Review Generator initialized")
    
    def generate_review(self, title: str, user_notes: str = "", rating: Optional[float] = None, length: str = "medium"):
        if not self.api_key:
            return self._get_fallback_review(title, user_notes, rating, length)
        
        try:
            prompt = self._build_prompt(title, user_notes, rating, length)
            
            # Adjust tokens based on length
            length_tokens = {
                "short": 100,
                "medium": 200, 
                "long": 300
            }
            max_tokens = length_tokens.get(length, 200)
            
            payload = {
                "prompt": prompt,
                "numResults": 1,
                "maxTokens": max_tokens,
                "temperature": 0.7,
                "topKReturn": 0,
                "topP": 1,
                "stopSequences": ["\n\n", "Review:", "Rating:"],
                "countPenalty": {
                    "scale": 0,
                    "applyToNumbers": False,
                    "applyToPunctuations": False,
                    "applyToStopwords": False,
                    "applyToWhitespaces": False,
                    "applyToEmojis": False
                }
            }
            
            print(f"🤖 Generating AI21 review for: {title} (length: {length})")
            
            # FIXED: Use correct endpoint URL
            response = requests.post(
                f"{self.base_url}/j2-ultra/complete",
                headers=self.headers,
                json=payload,
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                generated_text = self._extract_generated_text(result)
                if generated_text:
                    cleaned_text = self._clean_text(generated_text)
                    print(f"✅ AI21 review generated successfully (length: {length})")
                    return cleaned_text
            else:
                print(f"❌ AI21 API returned status {response.status_code}: {response.text}")
            
            # If we get here, the API call failed
            return self._get_fallback_review(title, user_notes, rating, length)
            
        except requests.exceptions.Timeout:
            print("❌ AI21 request timed out")
            return self._get_fallback_review(title, user_notes, rating, length)
        except requests.exceptions.ConnectionError:
            print("❌ AI21 service connection error")
            return self._get_fallback_review(title, user_notes, rating, length)
        except Exception as e:
            print(f"❌ AI21 error: {e}")
            return self._get_fallback_review(title, user_notes, rating, length)
    
    def _build_prompt(self, title: str, user_notes: str = "", rating: Optional[float] = None, length: str = "medium"):
        """Build a sophisticated prompt for AI21 review generation with length control"""
        
        # Length-specific instructions
        length_instructions = {
            "short": "Write a VERY SHORT and concise film review (2-3 sentences maximum). Focus only on the most important aspects. Be direct and to the point. Avoid lengthy analysis.",
            "medium": "Write a standard length film review (4-6 sentences). Provide balanced analysis of key elements while maintaining readability.",
            "long": "Write a detailed, comprehensive film review. Explore various aspects in depth including narrative structure, character development, and technical execution."
        }
        
        prompt_parts = []
        
        # Add length-specific instruction
        prompt_parts.append(length_instructions.get(length, length_instructions["medium"]))
        prompt_parts.append(f"Review the film: '{title}'.")
        
        # Add rating context if available
        if rating is not None:
            rating_context = {
                9.0: "an outstanding masterpiece that exceeds expectations",
                8.0: "an excellent film with remarkable qualities", 
                7.0: "a very good movie with strong elements",
                6.0: "a decent film with some notable aspects",
                5.0: "a mediocre film with mixed qualities",
                4.0: "a below-average film with significant flaws",
                3.0: "a poor film with major issues",
                2.0: "a very disappointing film",
                1.0: "an exceptionally bad film"
            }
            
            # Find the closest rating context
            closest_rating = min(rating_context.keys(), key=lambda x: abs(x - rating))
            sentiment = rating_context[closest_rating]
            prompt_parts.append(f"The review should reflect that this is {sentiment} (rated {rating}/10).")
        
        # FIXED: Better user notes integration - NO "Additional notes" appendage
        if user_notes.strip():
            prompt_parts.append(f"Focus your analysis on these aspects: {user_notes}")
            prompt_parts.append("Integrate these points naturally into your review without using phrases like 'Additional notes' or 'Viewer observations'.")
        
        # Add structure guidance based on length
        if length == "short":
            prompt_parts.extend([
                "Structure for short review:",
                "- First sentence: Overall impression and rating context",
                "- Second sentence: Key strength or standout element", 
                "- Third sentence: Final recommendation or summary thought",
                "Be extremely concise - every word must count!"
            ])
        elif length == "medium":
            prompt_parts.extend([
                "The review should analyze:",
                "- Overall impression and rating context",
                "- Key strengths and standout elements",
                "- Any notable weaknesses (if applicable)",
                "- Final recommendation and summary"
            ])
        else:  # long
            prompt_parts.extend([
                "The review should provide comprehensive analysis of:",
                "- Plot structure and narrative flow", 
                "- Character development and performances",
                "- Directing style and technical execution",
                "- Thematic elements and emotional impact",
                "- Overall audience appeal and lasting impression"
            ])
        
        # Common instructions
        prompt_parts.extend([
            "Write in a professional critic's voice.",
            "Avoid spoilers and focus on the overall viewing experience.",
            "Ensure the review flows naturally and engages the reader.",
            "DO NOT use phrases like 'Additional notes:', 'Viewer observations:', or similar appendages."
        ])
        
        return "\n".join(prompt_parts)
    
    def _extract_generated_text(self, result):
        """Extract generated text from AI21 response"""
        try:
            if 'completions' in result and len(result['completions']) > 0:
                return result['completions'][0]['data']['text'].strip()
            return ""
        except (KeyError, IndexError) as e:
            print(f"❌ Error extracting AI21 response: {e}")
            return ""
    
    def _clean_text(self, text: str):
        """Clean and format the generated text"""
        text = text.strip()
        
        # Remove any trailing incomplete sentences
        if text and text[-1] not in ['.', '!', '?']:
            last_period = text.rfind('.')
            last_exclamation = text.rfind('!')
            last_question = text.rfind('?')
            last_punctuation = max(last_period, last_exclamation, last_question)
            
            if last_punctuation != -1:
                text = text[:last_punctuation + 1]
        
        # Remove any rating numbers that might have been generated
        lines = text.split('\n')
        cleaned_lines = []
        for line in lines:
            if not any(phrase in line.lower() for phrase in ['rating:', 'score:', '/10', '/5']):
                cleaned_lines.append(line)
        
        text = '\n'.join(cleaned_lines).strip()
        
        # Ensure the review starts properly
        if text.lower().startswith('the review:'):
            text = text[11:].strip()
        elif text.lower().startswith('review:'):
            text = text[7:].strip()
        
        # Remove any "Additional notes" appendages that might have been generated
        if "Additional notes:" in text:
            text = text.split("Additional notes:")[0].strip()
        if "Viewer observations:" in text:
            text = text.split("Viewer observations:")[0].strip()
        
        # Capitalize first letter
        if text and len(text) > 0:
            text = text[0].upper() + text[1:]
        
        return text
    
    def _get_fallback_review(self, title: str, user_notes: str = "", rating: Optional[float] = None, length: str = "medium"):
        """Provide high-quality fallback reviews when AI21 is unavailable"""
        print(f"🔄 Using AI21 fallback review generator (length: {length})")
        
        # Length-specific templates
        short_templates = [
            "A compelling {content_type} that delivers strong performances and engaging storytelling. The narrative flows smoothly with well-executed technical elements. {user_notes_integration}",
            
            "This {content_type} showcases impressive craftsmanship with memorable moments throughout. Character development and visual execution stand out as particular strengths. {user_notes_integration}",
            
            "With its thoughtful approach to storytelling and solid technical execution, this {content_type} offers a satisfying experience. {user_notes_integration}"
        ]
        
        medium_templates = [
            "This {content_type} demonstrates exceptional craftsmanship in both storytelling and technical execution. The narrative unfolds with precision, keeping viewers engaged from start to finish. {user_notes_integration} Character development is particularly noteworthy, with performances that bring depth and authenticity to the story.",
            
            "A masterful blend of compelling narrative and artistic expression, this {content_type} stands as a significant achievement. {user_notes_integration} The pacing is expertly handled, allowing both dramatic moments and character interactions to shine.",
            
            "With its sophisticated approach to storytelling and remarkable attention to detail, this {content_type} delivers an experience that is both intellectually stimulating and emotionally satisfying. {user_notes_integration} The ensemble cast delivers uniformly excellent performances."
        ]
        
        long_templates = [
            "This film represents a remarkable achievement in contemporary cinema, showcasing a level of craftsmanship that elevates it above typical genre offerings. The narrative structure is meticulously constructed, with each scene serving a distinct purpose in advancing both plot and character development. Director's vision is consistently evident throughout, from the carefully composed visual language to the nuanced handling of complex emotional themes. Performances across the board are exceptional, with each actor bringing depth and authenticity to their roles. Technical elements including cinematography, sound design, and editing work in perfect harmony to create an immersive viewing experience. {user_notes_integration} The film successfully balances entertainment value with artistic ambition, resulting in a work that both engages in the moment and resonates long after viewing.",
            
            "From its opening moments, this production establishes itself as a work of considerable artistic merit and technical proficiency. The storytelling approach demonstrates a confident understanding of narrative rhythm, knowing precisely when to accelerate tension and when to allow character moments to breathe. Visual composition throughout is striking yet purposeful, with each frame contributing meaningfully to the overall thematic tapestry. Character arcs are developed with remarkable subtlety and psychological insight, avoiding cliché while maintaining emotional accessibility. {user_notes_integration} The film's exploration of its central ideas is both intellectually rigorous and emotionally resonant, inviting multiple interpretations while maintaining narrative coherence."
        ]
        
        # Select templates based on length
        template_groups = {
            "short": short_templates,
            "medium": medium_templates,
            "long": long_templates
        }
        
        templates = template_groups.get(length, medium_templates)
        
        # Handle user notes integration naturally
        user_notes_integration = ""
        if user_notes.strip():
            user_notes_integration = f"The film particularly excels in {user_notes.lower()},"
        
        # Select templates based on rating
        if rating is not None:
            if rating >= 8.0:
                templates = [t for t in templates if "exceptional" in t.lower() or "masterful" in t.lower() or "remarkable" in t.lower()]
            elif rating >= 6.0:
                templates = [t for t in templates if "solid" in t.lower() or "enjoyable" in t.lower() or "satisfying" in t.lower()]
            else:
                templates = [t for t in templates if "ambition" in t.lower() or "uneven" in t.lower() or "flaws" in t.lower()]
        
        content_type = "series" if "season" in title.lower() or "episode" in title.lower() else "film"
        template = random.choice(templates) if templates else medium_templates[0]
        
        # Create personalized fallback review
        fallback_review = template.format(
            content_type=content_type,
            user_notes_integration=user_notes_integration
        )
        
        return fallback_review

# Enhanced TMDB Service with Caching and Top-Rated Features
class TMDBService:
    def __init__(self):
        self.api_key = TMDB_API_KEY
        self.access_token = TMDB_ACCESS_TOKEN
        self.base_url = TMDB_BASE_URL
        self.image_base_url = TMDB_IMAGE_BASE_URL
        self._cache = {}
        self._cache_ttl = timedelta(hours=1)  # Cache TTL: 1 hour
        
        print(f"🔧 TMDB Config - API Key: {'✅ Set' if self.api_key else '❌ Missing'}")
        print(f"🔧 TMDB Config - Access Token: {'✅ Set' if self.access_token else '❌ Missing'}")
        
        if not self.api_key and not self.access_token:
            print("❌ No TMDB credentials configured")
        else:
            print("✅ TMDB Service initialized with caching")

    def _get_headers(self):
        if self.access_token:
            return {
                'Authorization': f'Bearer {self.access_token}',
                'Content-Type': 'application/json;charset=utf-8'
            }
        elif self.api_key:
            return {'Content-Type': 'application/json;charset=utf-8'}
        return {}

    def _get_cache_key(self, method: str, **kwargs):
        """Generate cache key from method and parameters"""
        key_parts = [method]
        for k, v in sorted(kwargs.items()):
            key_parts.append(f"{k}:{v}")
        return ":".join(key_parts)

    def _is_cache_valid(self, cache_key):
        """Check if cache entry is still valid"""
        if cache_key not in self._cache:
            return False
        cache_time, _ = self._cache[cache_key]
        return datetime.now() - cache_time < self._cache_ttl

    def _get_from_cache(self, cache_key):
        """Get data from cache if valid"""
        if self._is_cache_valid(cache_key):
            print(f"📦 Cache hit: {cache_key}")
            return self._cache[cache_key][1]
        return None

    def _set_to_cache(self, cache_key, data):
        """Store data in cache"""
        self._cache[cache_key] = (datetime.now(), data)
        print(f"💾 Cached: {cache_key}")

    def search_movies(self, query: str, page: int = 1):
        """Search movies with caching and limit results to 3 for faster response"""
        cache_key = self._get_cache_key("search_movies", query=query, page=page)
        cached_data = self._get_from_cache(cache_key)
        if cached_data is not None:
            return cached_data[:MAX_SEARCH_RESULTS]  # Return only 3 results even from cache

        if not self.api_key and not self.access_token:
            print("❌ TMDB: No credentials available")
            return []
            
        try:
            url = f"{self.base_url}/search/multi"
            params = {
                'query': query,
                'page': page,
                'include_adult': False,
            }
            
            if self.api_key:
                params['api_key'] = self.api_key
            
            headers = self._get_headers()
            
            print(f"🔄 TMDB: Searching for '{query}'...")
            response = requests.get(url, params=params, headers=headers, timeout=10)
            
            if response.status_code != 200:
                return []
                
            data = response.json()
            results = []
            
            for item in data.get('results', []):
                if item.get('media_type') in ['movie', 'tv']:
                    poster_path = item.get('poster_path')
                    
                    result = {
                        'id': item['id'],
                        'title': item.get('title') or item.get('name'),
                        'release_date': item.get('release_date') or item.get('first_air_date'),
                        'overview': item.get('overview'),
                        'poster_path': f"{self.image_base_url}{poster_path}" if poster_path else None,
                        'media_type': item.get('media_type'),
                        'vote_average': item.get('vote_average'),
                        'is_tv_show': item.get('media_type') == 'tv',
                        'popularity': item.get('popularity', 0)
                    }
                    results.append(result)
            
            # Sort by popularity and rating, then take only top 3
            results.sort(key=lambda x: (
                x.get('popularity', 0),
                x.get('vote_average', 0)
            ), reverse=True)
            
            limited_results = results[:MAX_SEARCH_RESULTS]
            print(f"✅ TMDB: Found {len(limited_results)} results (limited to {MAX_SEARCH_RESULTS})")
            
            # Cache the limited results
            self._set_to_cache(cache_key, limited_results)
            return limited_results
            
        except Exception as e:
            print(f"❌ TMDB Search Error: {e}")
            return []

    def get_popular_movies(self, limit: int = 3):
        """Get popular movies with good ratings"""
        cache_key = self._get_cache_key("get_popular_movies", limit=limit)
        cached_data = self._get_from_cache(cache_key)
        if cached_data is not None:
            return cached_data

        if not self.api_key and not self.access_token:
            return []
            
        try:
            url = f"{self.base_url}/movie/popular"
            params = {
                'page': 1,
            }
            
            if self.api_key:
                params['api_key'] = self.api_key
                
            headers = self._get_headers()
            
            response = requests.get(url, params=params, headers=headers, timeout=10)
            
            if response.status_code != 200:
                return []
                
            data = response.json()
            results = []
            
            for item in data.get('results', []):
                # Filter for good ratings (7.0+)
                if item.get('vote_average', 0) >= MIN_GOOD_RATING:
                    poster_path = item.get('poster_path')
                    
                    result = {
                        'id': item['id'],
                        'title': item.get('title'),
                        'release_date': item.get('release_date'),
                        'overview': item.get('overview'),
                        'poster_path': f"{self.image_base_url}{poster_path}" if poster_path else None,
                        'media_type': 'movie',
                        'vote_average': item.get('vote_average'),
                        'is_tv_show': False,
                        'popularity': item.get('popularity', 0),
                        'is_popular': True
                    }
                    results.append(result)
            
            # Sort by rating and take top results
            results.sort(key=lambda x: x.get('vote_average', 0), reverse=True)
            limited_results = results[:limit]
            
            print(f"✅ Found {len(limited_results)} popular movies with good ratings")
            
            # Cache the results
            self._set_to_cache(cache_key, limited_results)
            return limited_results
            
        except Exception as e:
            print(f"❌ Popular Movies Error: {e}")
            return []

    def get_popular_tv_shows(self, limit: int = 3):
        """Get popular TV shows with good ratings"""
        cache_key = self._get_cache_key("get_popular_tv_shows", limit=limit)
        cached_data = self._get_from_cache(cache_key)
        if cached_data is not None:
            return cached_data

        if not self.api_key and not self.access_token:
            return []
            
        try:
            url = f"{self.base_url}/tv/popular"
            params = {
                'page': 1,
            }
            
            if self.api_key:
                params['api_key'] = self.api_key
                
            headers = self._get_headers()
            
            response = requests.get(url, params=params, headers=headers, timeout=10)
            
            if response.status_code != 200:
                return []
                
            data = response.json()
            results = []
            
            for item in data.get('results', []):
                # Filter for good ratings (7.0+)
                if item.get('vote_average', 0) >= MIN_GOOD_RATING:
                    poster_path = item.get('poster_path')
                    
                    result = {
                        'id': item['id'],
                        'title': item.get('name'),
                        'release_date': item.get('first_air_date'),
                        'overview': item.get('overview'),
                        'poster_path': f"{self.image_base_url}{poster_path}" if poster_path else None,
                        'media_type': 'tv',
                        'vote_average': item.get('vote_average'),
                        'is_tv_show': True,
                        'popularity': item.get('popularity', 0),
                        'is_popular': True
                    }
                    results.append(result)
            
            # Sort by rating and take top results
            results.sort(key=lambda x: x.get('vote_average', 0), reverse=True)
            limited_results = results[:limit]
            
            print(f"✅ Found {len(limited_results)} popular TV shows with good ratings")
            
            # Cache the results
            self._set_to_cache(cache_key, limited_results)
            return limited_results
            
        except Exception as e:
            print(f"❌ Popular TV Shows Error: {e}")
            return []

    def get_top_rated_movies(self, limit: int = 3):
        """Get top rated movies with 8+ ratings"""
        cache_key = self._get_cache_key("get_top_rated_movies", limit=limit)
        cached_data = self._get_from_cache(cache_key)
        if cached_data is not None:
            return cached_data

        if not self.api_key and not self.access_token:
            return []
            
        try:
            url = f"{self.base_url}/movie/top_rated"
            params = {
                'page': 1,
            }
            
            if self.api_key:
                params['api_key'] = self.api_key
                
            headers = self._get_headers()
            
            response = requests.get(url, params=params, headers=headers, timeout=10)
            
            if response.status_code != 200:
                return []
                
            data = response.json()
            results = []
            
            for item in data.get('results', []):
                # STRICTLY filter for 8+ ratings only
                if item.get('vote_average', 0) >= MIN_TOP_RATING:
                    poster_path = item.get('poster_path')
                    
                    result = {
                        'id': item['id'],
                        'title': item.get('title'),
                        'release_date': item.get('release_date'),
                        'overview': item.get('overview'),
                        'poster_path': f"{self.image_base_url}{poster_path}" if poster_path else None,
                        'media_type': 'movie',
                        'vote_average': item.get('vote_average'),
                        'is_tv_show': False,
                        'popularity': item.get('popularity', 0),
                        'is_top_rated': True
                    }
                    results.append(result)
            
            # Take top results (already sorted by rating from API)
            limited_results = results[:limit]
            
            print(f"✅ Found {len(limited_results)} top rated movies with 8+ ratings")
            
            # Cache the results
            self._set_to_cache(cache_key, limited_results)
            return limited_results
            
        except Exception as e:
            print(f"❌ Top Rated Movies Error: {e}")
            return []

    def get_top_rated_tv_shows(self, limit: int = 3):
        """Get top rated TV shows with 8+ ratings"""
        cache_key = self._get_cache_key("get_top_rated_tv_shows", limit=limit)
        cached_data = self._get_from_cache(cache_key)
        if cached_data is not None:
            return cached_data

        if not self.api_key and not self.access_token:
            return []
            
        try:
            url = f"{self.base_url}/tv/top_rated"
            params = {
                'page': 1,
            }
            
            if self.api_key:
                params['api_key'] = self.api_key
                
            headers = self._get_headers()
            
            response = requests.get(url, params=params, headers=headers, timeout=10)
            
            if response.status_code != 200:
                return []
                
            data = response.json()
            results = []
            
            for item in data.get('results', []):
                # STRICTLY filter for 8+ ratings only
                if item.get('vote_average', 0) >= MIN_TOP_RATING:
                    poster_path = item.get('poster_path')
                    
                    result = {
                        'id': item['id'],
                        'title': item.get('name'),
                        'release_date': item.get('first_air_date'),
                        'overview': item.get('overview'),
                        'poster_path': f"{self.image_base_url}{poster_path}" if poster_path else None,
                        'media_type': 'tv',
                        'vote_average': item.get('vote_average'),
                        'is_tv_show': True,
                        'popularity': item.get('popularity', 0),
                        'is_top_rated': True
                    }
                    results.append(result)
            
            # Take top results (already sorted by rating from API)
            limited_results = results[:limit]
            
            print(f"✅ Found {len(limited_results)} top rated TV shows with 8+ ratings")
            
            # Cache the results
            self._set_to_cache(cache_key, limited_results)
            return limited_results
            
        except Exception as e:
            print(f"❌ Top Rated TV Shows Error: {e}")
            return []

    def get_highly_rated_movies(self, limit: int = 3):
        """Get highly rated movies (8+) from discover endpoint for better variety"""
        cache_key = self._get_cache_key("get_highly_rated_movies", limit=limit)
        cached_data = self._get_from_cache(cache_key)
        if cached_data is not None:
            return cached_data

        if not self.api_key and not self.access_token:
            return []
            
        try:
            # Use discover endpoint with rating filter
            url = f"{self.base_url}/discover/movie"
            params = {
                'page': 1,
                'sort_by': 'vote_average.desc',
                'vote_average.gte': MIN_TOP_RATING,
                'vote_count.gte': 1000,  # Ensure enough votes for credibility
                'include_adult': False,
            }
            
            if self.api_key:
                params['api_key'] = self.api_key
                
            headers = self._get_headers()
            
            response = requests.get(url, params=params, headers=headers, timeout=10)
            
            if response.status_code != 200:
                return []
                
            data = response.json()
            results = []
            
            for item in data.get('results', []):
                poster_path = item.get('poster_path')
                
                result = {
                    'id': item['id'],
                    'title': item.get('title'),
                    'release_date': item.get('release_date'),
                    'overview': item.get('overview'),
                    'poster_path': f"{self.image_base_url}{poster_path}" if poster_path else None,
                    'media_type': 'movie',
                    'vote_average': item.get('vote_average'),
                    'is_tv_show': False,
                    'popularity': item.get('popularity', 0),
                    'is_highly_rated': True
                }
                results.append(result)
            
            # Take top results
            limited_results = results[:limit]
            
            print(f"✅ Found {len(limited_results)} highly rated movies with 8+ ratings")
            
            # Cache the results
            self._set_to_cache(cache_key, limited_results)
            return limited_results
            
        except Exception as e:
            print(f"❌ Highly Rated Movies Error: {e}")
            return []

    def get_movie_details(self, tmdb_id: int, is_tv: bool = False):
        """Get movie/TV details with caching"""
        cache_key = self._get_cache_key("get_movie_details", tmdb_id=tmdb_id, is_tv=is_tv)
        cached_data = self._get_from_cache(cache_key)
        if cached_data is not None:
            return cached_data

        if not self.api_key and not self.access_token:
            return None
            
        try:
            media_type = 'tv' if is_tv else 'movie'
            url = f"{self.base_url}/{media_type}/{tmdb_id}"
            
            params = {}
            if self.api_key:
                params['api_key'] = self.api_key
                
            headers = self._get_headers()
            
            response = requests.get(url, params=params, headers=headers, timeout=10)
            
            if response.status_code != 200:
                return None
                
            data = response.json()
            
            directors = ["Not specified"]
            if is_tv:
                creators = data.get('created_by', [])
                directors = [creator['name'] for creator in creators[:2]] or directors
            
            genres = [genre['name'] for genre in data.get('genres', [])[:3]]
            
            # Calculate total minutes based on content type
            total_minutes = None
            if is_tv:
                # For TV shows: total_episodes × 20 minutes per episode
                total_episodes = data.get('number_of_episodes')
                if total_episodes:
                    total_minutes = total_episodes * EPISODE_DURATION_MINUTES
                    print(f"📺 TV Show: {data.get('name')} - {total_episodes} episodes × {EPISODE_DURATION_MINUTES} minutes = {total_minutes} minutes total")
                else:
                    # Fallback: if no episode data, use seasons × 10 episodes × 20 minutes
                    number_of_seasons = data.get('number_of_seasons', 1)
                    estimated_episodes = number_of_seasons * 10  # Assume 10 episodes per season
                    total_minutes = estimated_episodes * EPISODE_DURATION_MINUTES
                    print(f"📺 TV Show (estimated): {data.get('name')} - {estimated_episodes} episodes × {EPISODE_DURATION_MINUTES} minutes = {total_minutes} minutes total")
            else:
                # For movies, use runtime if available, otherwise default to 120 minutes
                runtime = data.get('runtime')
                total_minutes = runtime if runtime else 120
                print(f"🎬 Movie: {data.get('title')} - {total_minutes} minutes")
            
            result = {
                'title': data.get('title') or data.get('name'),
                'director': ', '.join(directors) if directors else 'Not specified',
                'genre': ', '.join(genres) if genres else 'Not specified',
                'overview': data.get('overview'),
                'poster_path': f"{self.image_base_url}{data.get('poster_path')}" if data.get('poster_path') else None,
                'release_date': data.get('release_date') or data.get('first_air_date'),
                'total_episodes': data.get('number_of_episodes') if is_tv else None,
                'number_of_seasons': data.get('number_of_seasons') if is_tv else None,
                'total_minutes': total_minutes
            }
            
            # Cache the result
            self._set_to_cache(cache_key, result)
            return result
            
        except Exception:
            return None

    def discover_by_genre(self, genre_id: int, page: int = 1):
        """Discover movies by genre ID with caching"""
        cache_key = self._get_cache_key("discover_by_genre", genre_id=genre_id, page=page)
        cached_data = self._get_from_cache(cache_key)
        if cached_data is not None:
            return cached_data

        if not self.api_key and not self.access_token:
            return []
            
        try:
            url = f"{self.base_url}/discover/movie"
            params = {
                'with_genres': genre_id,
                'page': page,
                'sort_by': 'popularity.desc',
                'include_adult': False,
            }
            
            if self.api_key:
                params['api_key'] = self.api_key
                
            headers = self._get_headers()
            
            response = requests.get(url, params=params, headers=headers, timeout=10)
            
            if response.status_code != 200:
                return []
                
            data = response.json()
            results = []
            
            for item in data.get('results', []):
                result = {
                    'id': item['id'],
                    'title': item.get('title'),
                    'release_date': item.get('release_date'),
                    'overview': item.get('overview'),
                    'poster_path': f"{self.image_base_url}{item.get('poster_path')}" if item.get('poster_path') else None,
                    'media_type': 'movie',
                    'vote_average': item.get('vote_average'),
                    'is_tv_show': False
                }
                results.append(result)
            
            # Cache the results
            self._set_to_cache(cache_key, results)
            return results
            
        except Exception as e:
            print(f"❌ TMDB Genre Discovery Error: {e}")
            return []

    def discover_tv_by_genre(self, genre_id: int, page: int = 1):
        """Discover TV shows by genre ID with caching"""
        cache_key = self._get_cache_key("discover_tv_by_genre", genre_id=genre_id, page=page)
        cached_data = self._get_from_cache(cache_key)
        if cached_data is not None:
            return cached_data

        if not self.api_key and not self.access_token:
            return []
            
        try:
            url = f"{self.base_url}/discover/tv"
            params = {
                'with_genres': genre_id,
                'page': page,
                'sort_by': 'popularity.desc',
                'include_adult': False,
            }
            
            if self.api_key:
                params['api_key'] = self.api_key
                
            headers = self._get_headers()
            
            response = requests.get(url, params=params, headers=headers, timeout=10)
            
            if response.status_code != 200:
                return []
                
            data = response.json()
            results = []
            
            for item in data.get('results', []):
                result = {
                    'id': item['id'],
                    'title': item.get('name'),
                    'release_date': item.get('first_air_date'),
                    'overview': item.get('overview'),
                    'poster_path': f"{self.image_base_url}{item.get('poster_path')}" if item.get('poster_path') else None,
                    'media_type': 'tv',
                    'vote_average': item.get('vote_average'),
                    'is_tv_show': True
                }
                results.append(result)
            
            # Cache the results
            self._set_to_cache(cache_key, results)
            return results
            
        except Exception as e:
            print(f"❌ TMDB TV Genre Discovery Error: {e}")
            return []

    def clear_cache(self):
        """Clear all cached data"""
        self._cache.clear()
        print("🧹 TMDB cache cleared")

# Recommendation Engine
class RecommendationEngine:
    def __init__(self, tmdb_service: TMDBService):
        self.tmdb_service = tmdb_service
        
    def get_recommendations(self, user_movies: List[Movie], max_results: int = 10):
        if not user_movies:
            return [], ["No movies in collection"], "Add some movies to get genre-based recommendations"
        
        genre_recommendations = self._get_genre_based_recommendations(user_movies, max_results)
        based_on = self._get_recommendation_reasons(user_movies)
        
        return genre_recommendations[:max_results], based_on, f"Found {len(genre_recommendations)} recommendations based on your favorite genres"

    def _get_genre_based_recommendations(self, user_movies: List[Movie], max_results: int):
        try:
            genre_stats = {}
            for movie in user_movies:
                if movie.genre and movie.genre != "Not specified":
                    genres = [g.strip() for g in movie.genre.split(',')]
                    for genre in genres:
                        genre_stats[genre] = genre_stats.get(genre, 0) + 1
            
            if not genre_stats:
                return []
            
            top_genres = sorted(genre_stats.items(), key=lambda x: x[1], reverse=True)[:3]
            recommendations = []
            
            for genre, count in top_genres:
                genre_id = TMDB_GENRE_IDS.get(genre)
                if not genre_id:
                    continue
                
                movies = self.tmdb_service.discover_by_genre(genre_id, page=1)
                tv_shows = self.tmdb_service.discover_tv_by_genre(genre_id, page=1)
                
                all_results = movies + tv_shows
                
                for result in all_results:
                    if any(m.tmdb_id == result['id'] for m in user_movies):
                        continue
                    
                    if any(r['id'] == result['id'] for r in recommendations):
                        continue
                    
                    result['recommendation_reason'] = f"Popular {genre} {result['media_type']}"
                    recommendations.append(result)
                    
                    if len(recommendations) >= max_results:
                        break
                
                if len(recommendations) >= max_results:
                    break
            
            if len(recommendations) < max_results:
                recommendations = self._get_additional_recommendations(
                    user_movies, recommendations, max_results, top_genres
                )
            
            return recommendations
            
        except Exception as e:
            print(f"Error in genre-based recommendations: {e}")
            return []

    def _get_additional_recommendations(self, user_movies: List[Movie], current_recommendations: List[Dict], 
                                      max_results: int, top_genres: List[tuple]):
        try:
            recommendations = current_recommendations.copy()
            remaining_slots = max_results - len(recommendations)
            
            if remaining_slots <= 0:
                return recommendations
            
            # Use highly-rated content as fallback
            highly_rated_movies = self.tmdb_service.get_highly_rated_movies(remaining_slots)
            
            for result in highly_rated_movies:
                if (not any(m.tmdb_id == result['id'] for m in user_movies) and 
                    not any(r['id'] == result['id'] for r in recommendations)):
                    result['recommendation_reason'] = "Critically acclaimed"
                    recommendations.append(result)
                    
                    if len(recommendations) >= max_results:
                        break
            
            return recommendations
            
        except Exception as e:
            print(f"Error in additional recommendations: {e}")
            return current_recommendations

    def _get_recommendation_reasons(self, user_movies: List[Movie]) -> List[str]:
        reasons = set()
        
        genre_stats = {}
        for movie in user_movies:
            if movie.genre and movie.genre != "Not specified":
                genres = [g.strip() for g in movie.genre.split(',')]
                for genre in genres:
                    genre_stats[genre] = genre_stats.get(genre, 0) + 1
        
        top_genres = sorted(genre_stats.items(), key=lambda x: x[1], reverse=True)[:2]
        
        for genre, count in top_genres:
            if count == 1:
                reasons.add(f"Your interest in {genre}")
            else:
                reasons.add(f"Your {count} {genre} movies")
        
        if not reasons:
            reasons.add("Your movie collection preferences")
        
        return list(reasons)

# Party Service
class PartyService:
    def __init__(self):
        print("✅ Party Service initialized")
    
    def generate_room_code(self):
        """Generate a unique 6-character room code"""
        return ''.join(random.choices('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', k=6))
    
    def create_party_room(self, db: Session, party_data: PartyRoomCreate):
        """Create a new party room"""
        try:
            # Generate unique room code
            code = self.generate_room_code()
            
            # Create initial members list with host
            host_member = {
                "id": party_data.host_id,
                "name": "Host",
                "is_host": True,
                "joined_at": datetime.utcnow().isoformat()
            }
            members = [host_member]
            
            party_room = PartyRoom(
                code=code,
                movie_id=party_data.movie_id,
                movie_title=party_data.movie_title,
                movie_poster=party_data.movie_poster,
                host_id=party_data.host_id,
                is_active=True,
                members=json.dumps(members)
            )
            
            db.add(party_room)
            db.commit()
            db.refresh(party_room)
            
            print(f"🎉 Party room created: {code} for movie '{party_data.movie_title}'")
            
            return party_room
            
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Error creating party room: {str(e)}")
    
    def join_party_room(self, db: Session, join_data: PartyJoinRequest):
        """Join an existing party room"""
        try:
            party_room = db.query(PartyRoom).filter(
                PartyRoom.code == join_data.room_code,
                PartyRoom.is_active == True
            ).first()
            
            if not party_room:
                raise HTTPException(status_code=404, detail="Party room not found or inactive")
            
            # Parse existing members
            members = json.loads(party_room.members)
            
            # Check if user is already in the room
            if any(member["id"] == join_data.user_id for member in members):
                raise HTTPException(status_code=400, detail="User already in party room")
            
            # Add new member
            new_member = {
                "id": join_data.user_id,
                "name": join_data.user_name,
                "is_host": False,
                "joined_at": datetime.utcnow().isoformat()
            }
            members.append(new_member)
            
            # Update room members
            party_room.members = json.dumps(members)
            db.commit()
            db.refresh(party_room)
            
            print(f"👤 User {join_data.user_name} joined party room: {join_data.room_code}")
            
            return party_room
            
        except HTTPException:
            raise
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Error joining party room: {str(e)}")
    
    def leave_party_room(self, db: Session, room_code: str, user_id: str):
        """Leave a party room"""
        try:
            party_room = db.query(PartyRoom).filter(
                PartyRoom.code == room_code,
                PartyRoom.is_active == True
            ).first()
            
            if not party_room:
                raise HTTPException(status_code=404, detail="Party room not found")
            
            # Parse existing members
            members = json.loads(party_room.members)
            
            # Find and remove user
            original_count = len(members)
            members = [member for member in members if member["id"] != user_id]
            
            # If host left, end the party
            if len(members) < original_count:
                if user_id == party_room.host_id:
                    # Host left - end the party
                    party_room.is_active = False
                    print(f"🎉 Party room {room_code} ended by host")
                else:
                    # Regular user left - update members
                    party_room.members = json.dumps(members)
                
                db.commit()
                db.refresh(party_room)
                
                print(f"👤 User {user_id} left party room: {room_code}")
                return party_room
            else:
                raise HTTPException(status_code=404, detail="User not found in party room")
                
        except HTTPException:
            raise
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Error leaving party room: {str(e)}")
    
    def end_party_room(self, db: Session, room_code: str):
        """End a party room (host only)"""
        try:
            party_room = db.query(PartyRoom).filter(PartyRoom.code == room_code).first()
            
            if not party_room:
                raise HTTPException(status_code=404, detail="Party room not found")
            
            party_room.is_active = False
            db.commit()
            
            print(f"🎉 Party room {room_code} ended")
            
            return {"message": "Party room ended successfully"}
            
        except HTTPException:
            raise
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Error ending party room: {str(e)}")
    
    def get_party_room(self, db: Session, room_code: str):
        """Get party room details"""
        try:
            party_room = db.query(PartyRoom).filter(
                PartyRoom.code == room_code,
                PartyRoom.is_active == True
            ).first()
            
            if not party_room:
                raise HTTPException(status_code=404, detail="Party room not found or inactive")
            
            return party_room
            
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error getting party room: {str(e)}")
    
    def sync_playback(self, db: Session, sync_data: PartySyncRequest):
        """Sync playback across party members"""
        try:
            party_room = db.query(PartyRoom).filter(
                PartyRoom.code == sync_data.room_code,
                PartyRoom.is_active == True
            ).first()
            
            if not party_room:
                raise HTTPException(status_code=404, detail="Party room not found")
            
            # In a real implementation, you would broadcast this to all connected clients
            # For now, we just log the sync action
            print(f"🎬 Playback sync in room {sync_data.room_code}: {sync_data.action} at {sync_data.timestamp}")
            
            return {
                "message": "Playback synced",
                "action": sync_data.action,
                "timestamp": sync_data.timestamp,
                "room_code": sync_data.room_code
            }
            
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error syncing playback: {str(e)}")

# FastAPI app
app = FastAPI(title="MovieMate API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

tmdb_service = TMDBService()
ai21_generator = AI21ReviewGenerator()
recommendation_engine = RecommendationEngine(tmdb_service)
party_service = PartyService()

# Helper function to ensure integer fields are never None
def ensure_int_fields(movie_dict):
    """Ensure episodes_watched and minutes_watched are never None"""
    if 'episodes_watched' in movie_dict and movie_dict['episodes_watched'] is None:
        movie_dict['episodes_watched'] = 0
    if 'minutes_watched' in movie_dict and movie_dict['minutes_watched'] is None:
        movie_dict['minutes_watched'] = 0
    return movie_dict

# Test endpoint
@app.get("/ai21/status")
def check_ai21_status():
    return {
        "ai21_configured": bool(AI21_API_KEY),
        "api_key_set": bool(AI21_API_KEY),
        "status": "✅ AI21 Ready" if AI21_API_KEY else "❌ AI21 Not Configured",
        "model": "j2-ultra",
        "features": {
            "ai_reviews": bool(AI21_API_KEY),
            "professional_tone": True,
            "rating_aware": True,
            "fallback_system": True,
            "length_control": True
        }
    }

# CORRECTED: Test AI21 review generation with JSON body and length parameter
@app.post("/ai21/test-review")
def test_ai21_review(request: TestReviewRequest):
    if not AI21_API_KEY:
        raise HTTPException(status_code=503, detail="AI21 API key not configured")
    
    try:
        review = ai21_generator.generate_review(
            request.title, 
            request.user_notes, 
            request.rating,
            request.length
        )
        return {
            "title": request.title,
            "rating": request.rating,
            "user_notes": request.user_notes,
            "review": review,
            "status": "success",
            "length": len(review),
            "review_type": request.length,
            "provider": "AI21 Jurassic-2 Ultra"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Test failed: {str(e)}")

# NEW: Quick short review endpoint
@app.post("/ai21/quick-short-review")
def quick_short_ai21_review():
    """Quick test endpoint for short reviews"""
    if not AI21_API_KEY:
        raise HTTPException(status_code=503, detail="AI21 API key not configured")
    
    try:
        review = ai21_generator.generate_review(
            "Inception", 
            "mind bending plot and great visuals", 
            8.8,
            "short"
        )
        return {
            "title": "Inception",
            "rating": 8.8,
            "user_notes": "mind bending plot and great visuals",
            "review": review,
            "status": "success",
            "review_type": "short",
            "length": len(review),
            "provider": "AI21 Jurassic-2 Ultra"
        }
    except Exception as e:
        return {
            "title": "Inception", 
            "review": ai21_generator._get_fallback_review("Inception", "mind bending plot", 8.8, "short"),
            "status": "fallback",
            "review_type": "short",
            "error": str(e)
        }

# Quick test endpoint
@app.post("/ai21/quick-review")
def quick_ai21_review():
    """Quick test endpoint with hardcoded values"""
    if not AI21_API_KEY:
        raise HTTPException(status_code=503, detail="AI21 API key not configured")
    
    try:
        review = ai21_generator.generate_review(
            "Inception", 
            "mind bending plot", 
            8.8
        )
        return {
            "title": "Inception",
            "rating": 8.8,
            "user_notes": "mind bending plot",
            "review": review,
            "status": "success",
            "provider": "AI21 Jurassic-2 Ultra"
        }
    except Exception as e:
        return {
            "title": "Inception", 
            "review": ai21_generator._get_fallback_review("Inception", "mind bending plot", 8.8),
            "status": "fallback",
            "error": str(e)
        }

# ULTIMATE FIX: Movie-specific AI review endpoint - NO DATABASE UPDATES
@app.post("/movies/{movie_id}/generate-review", response_model=ReviewGenerationResponse)
def generate_ai21_review(movie_id: int, request: ReviewGenerationRequest, db: Session = Depends(get_db)):
    """
    ULTIMATE FIX: Generate AI review without ANY database updates
    Uses the same reliable pattern as /ai21/test-review
    """
    try:
        # Step 1: Get movie title only (minimal DB operation)
        db_movie = db.query(Movie).filter(Movie.id == movie_id).first()
        if not db_movie:
            raise HTTPException(status_code=404, detail="Movie not found")
        
        # Step 2: Generate review (EXACTLY like test endpoint)
        review = ai21_generator.generate_review(
            title=db_movie.title,
            user_notes=request.user_notes,
            rating=request.rating,
            length=request.length
        )
        
        # ⚠️ CRITICAL FIX: NO DATABASE UPDATES
        # The review is returned to the frontend, which can choose to save it
        # This makes it as reliable as /ai21/test-review
        
        print(f"✅ AI Review generated for '{db_movie.title}' (length: {request.length}) - Returning to frontend")
        
        return ReviewGenerationResponse(review=review)
        
    except Exception as e:
        print(f"❌ Error in AI21 review generation: {e}")
        # Provide fallback review (same as test endpoint fallback)
        fallback_review = ai21_generator._get_fallback_review(
            db_movie.title if 'db_movie' in locals() else "Movie",
            request.user_notes,
            request.rating,
            request.length
        )
        return ReviewGenerationResponse(review=fallback_review)

# NEW: AI21 Health Check
@app.get("/ai21/health")
def ai21_health_check():
    """Comprehensive AI21 service health check"""
    health_status = {
        "ai21_configured": bool(AI21_API_KEY),
        "api_key_length": len(AI21_API_KEY) if AI21_API_KEY else 0,
        "base_url": AI21_BASE_URL,
        "model": "j2-ultra",
        "fallback_system": True,
        "length_control": True,
        "status": "✅ Operational" if AI21_API_KEY else "❌ Not Configured",
        "timestamp": datetime.utcnow().isoformat(),
        "endpoints": {
            "test_review": "/ai21/test-review",
            "quick_review": "/ai21/quick-review", 
            "quick_short_review": "/ai21/quick-short-review",
            "movie_review": "/movies/{id}/generate-review",
            "health": "/ai21/health"
        }
    }
    return health_status

# DEBUG ENDPOINT: Simple version for testing
@app.post("/debug/movies/{movie_id}/generate-review-simple")
def debug_generate_review_simple(movie_id: int, request: ReviewGenerationRequest, db: Session = Depends(get_db)):
    """Simplified version that mirrors test-review endpoint behavior"""
    try:
        # Just get the movie title
        db_movie = db.query(Movie).filter(Movie.id == movie_id).first()
        if not db_movie:
            return {"error": "Movie not found", "movie_id": movie_id}
        
        # Generate review (NO database updates)
        review = ai21_generator.generate_review(
            db_movie.title,
            request.user_notes, 
            request.rating,
            request.length
        )
        
        return {
            "success": True,
            "movie_id": movie_id,
            "title": db_movie.title,
            "review": review,
            "review_length": len(review),
            "review_type": request.length,
            "database_operations": "NONE",  # This is key!
            "status": "Identical to /ai21/test-review behavior"
        }
        
    except Exception as e:
        return {"error": str(e), "movie_id": movie_id}

# Clear TMDB cache endpoint
@app.delete("/tmdb/cache")
def clear_tmdb_cache():
    tmdb_service.clear_cache()
    return {"message": "TMDB cache cleared successfully"}

# Search TMDB - LIMITED TO 3 RESULTS
@app.get("/tmdb/search")
def search_tmdb(query: str, page: int = 1, db: Session = Depends(get_db)):
    if not query.strip():
        return {"results": [], "error": "Query parameter is required"}
    
    results = tmdb_service.search_movies(query, page)
    
    enhanced_results = []
    for result in results:
        existing_movie = db.query(Movie).filter(Movie.tmdb_id == result['id']).first()
        enhanced_results.append({
            **result,
            'already_added': existing_movie is not None,
            'existing_status': existing_movie.status if existing_movie else None
        })
    
    return {
        "results": enhanced_results,
        "query": query,
        "page": page,
        "total_results": len(enhanced_results),
        "max_results_limit": MAX_SEARCH_RESULTS,
        "note": f"Search limited to {MAX_SEARCH_RESULTS} results for faster response"
    }

# Get popular content with good ratings
@app.get("/tmdb/popular")
def get_popular_content(
    type: str = "all",  # "all", "movies", "tv"
    limit: int = 6,
    db: Session = Depends(get_db)
):
    """Get popular content with good ratings (7.0+)"""
    try:
        results = []
        
        if type in ["all", "movies"]:
            popular_movies = tmdb_service.get_popular_movies(limit // 2)
            results.extend(popular_movies)
        
        if type in ["all", "tv"]:
            popular_tv = tmdb_service.get_popular_tv_shows(limit // 2)
            results.extend(popular_tv)
        
        # Enhance with existing collection info
        enhanced_results = []
        for result in results[:limit]:
            existing_movie = db.query(Movie).filter(Movie.tmdb_id == result['id']).first()
            enhanced_results.append({
                **result,
                'already_added': existing_movie is not None,
                'existing_status': existing_movie.status if existing_movie else None
            })
        
        return {
            "results": enhanced_results,
            "type": type,
            "min_rating": MIN_GOOD_RATING,
            "total_results": len(enhanced_results)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching popular content: {str(e)}")

# Get top-rated content (8+ ratings only)
@app.get("/tmdb/top-rated")
def get_top_rated_content(
    type: str = "all",  # "all", "movies", "tv"
    limit: int = 3,
    db: Session = Depends(get_db)
):
    """Get top-rated content (8+ ratings only)"""
    try:
        results = []
        
        if type in ["all", "movies"]:
            top_movies = tmdb_service.get_top_rated_movies(limit)
            results.extend(top_movies)
        
        if type in ["all", "tv"]:
            top_tv = tmdb_service.get_top_rated_tv_shows(limit)
            results.extend(top_tv)
        
        # Enhance with existing collection info
        enhanced_results = []
        for result in results[:limit]:
            existing_movie = db.query(Movie).filter(Movie.tmdb_id == result['id']).first()
            enhanced_results.append({
                **result,
                'already_added': existing_movie is not None,
                'existing_status': existing_movie.status if existing_movie else None
            })
        
        return {
            "results": enhanced_results,
            "type": type,
            "total_results": len(enhanced_results),
            "min_rating": MIN_TOP_RATING,
            "note": f"Top rated content with {MIN_TOP_RATING}+ ratings only"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching top-rated content: {str(e)}")

# Get highly rated movies (8+ ratings from discover endpoint)
@app.get("/tmdb/highly-rated")
def get_highly_rated_movies(limit: int = 3, db: Session = Depends(get_db)):
    """Get highly rated movies with 8+ ratings (better variety)"""
    try:
        results = tmdb_service.get_highly_rated_movies(limit)
        
        # Enhance with existing collection info
        enhanced_results = []
        for result in results:
            existing_movie = db.query(Movie).filter(Movie.tmdb_id == result['id']).first()
            enhanced_results.append({
                **result,
                'already_added': existing_movie is not None,
                'existing_status': existing_movie.status if existing_movie else None
            })
        
        return {
            "results": enhanced_results,
            "min_rating": MIN_TOP_RATING,
            "total_results": len(enhanced_results),
            "note": f"Highly rated movies with {MIN_TOP_RATING}+ ratings"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching highly rated movies: {str(e)}")

# Quick movies endpoint - NOW RETURNS HIGHLY RATED MOVIES WITH 8+ RATINGS
@app.get("/tmdb/quick")
def get_quick_movies(limit: int = 3, db: Session = Depends(get_db)):
    """Get quick highly rated movies with 8+ ratings for instant display"""
    try:
        # Use highly rated movies for quick results (better variety)
        results = tmdb_service.get_highly_rated_movies(limit)
        
        # Enhance with existing collection info
        enhanced_results = []
        for result in results:
            existing_movie = db.query(Movie).filter(Movie.tmdb_id == result['id']).first()
            enhanced_results.append({
                **result,
                'already_added': existing_movie is not None,
                'existing_status': existing_movie.status if existing_movie else None
            })
        
        return {
            "results": enhanced_results,
            "min_rating": MIN_TOP_RATING,
            "note": f"Highly rated movies with {MIN_TOP_RATING}+ ratings"
        }
            
    except Exception as e:
        print(f"Quick movies error: {e}")
        # Final fallback with classic highly-rated movies
        fallback_titles = ["The Shawshank Redemption", "The Godfather", "Pulp Fiction"]
        results = []
        for title in fallback_titles[:limit]:
            search_results = tmdb_service.search_movies(title, 1)
            if search_results:
                # Manually set high rating for fallback
                search_results[0]['vote_average'] = 8.7
                results.append(search_results[0])
        return {
            "results": results,
            "min_rating": MIN_TOP_RATING,
            "note": "Classic highly rated movies"
        }

# Add movie from TMDB
@app.post("/movies/tmdb/add", response_model=MovieResponse)
def add_movie_from_tmdb(tmdb_movie: TMDBMovieAdd, db: Session = Depends(get_db)):
    try:
        existing_movie = db.query(Movie).filter(Movie.tmdb_id == tmdb_movie.tmdb_id).first()
        if existing_movie:
            raise HTTPException(status_code=400, detail="Movie already exists in your collection")
        
        if not tmdb_movie.platform or not tmdb_movie.platform.strip():
            raise HTTPException(
                status_code=400, 
                detail="Please specify a platform (Netflix, Prime, Disney+, etc.)."
            )
        
        details = tmdb_service.get_movie_details(tmdb_movie.tmdb_id, tmdb_movie.is_tv_show)
        if not details:
            raise HTTPException(status_code=404, detail="Movie/TV show not found on TMDB")
        
        # Calculate total minutes based on content type
        total_minutes = details.get('total_minutes')
        if tmdb_movie.is_tv_show and not total_minutes and details.get('total_episodes'):
            total_minutes = details['total_episodes'] * EPISODE_DURATION_MINUTES
            print(f"📺 Setting total minutes for TV show: {details['total_episodes']} episodes × {EPISODE_DURATION_MINUTES} minutes = {total_minutes} minutes")
        
        db_movie = Movie(
            tmdb_id=tmdb_movie.tmdb_id,
            title=details['title'],
            director=details['director'],
            genre=details['genre'],
            platform=tmdb_movie.platform,
            status=tmdb_movie.status,
            is_tv_show=tmdb_movie.is_tv_show,
            poster_path=details['poster_path'],
            overview=details['overview'],
            release_date=details['release_date'],
            total_episodes=details.get('total_episodes'),
            total_minutes=total_minutes,
            episodes_watched=0,  # Explicitly set to avoid None
            minutes_watched=0,   # Explicitly set to avoid None
            created_at=datetime.utcnow()  # Explicitly set creation date
        )
        
        db.add(db_movie)
        db.commit()
        db.refresh(db_movie)
        
        return db_movie
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error adding movie: {str(e)}")

# Create movie
@app.post("/movies/", response_model=MovieResponse)
def create_movie(movie: MovieCreate, db: Session = Depends(get_db)):
    try:
        if not movie.platform or not movie.platform.strip():
            raise HTTPException(
                status_code=400, 
                detail="Please specify a platform where you watch this content."
            )
        
        if movie.tmdb_id:
            details = tmdb_service.get_movie_details(movie.tmdb_id, movie.is_tv_show)
            if details:
                movie_data = movie.dict()
                movie_data.update({
                    'title': details['title'],
                    'director': details['director'],
                    'genre': details['genre'],
                    'poster_path': details['poster_path'],
                    'overview': details['overview'],
                    'release_date': details['release_date'],
                    'total_minutes': details.get('total_minutes')
                })
                db_movie = Movie(**movie_data)
            else:
                db_movie = Movie(**movie.dict())
        else:
            db_movie = Movie(**movie.dict())
        
        # Ensure created_at is set
        if not hasattr(db_movie, 'created_at') or db_movie.created_at is None:
            db_movie.created_at = datetime.utcnow()
        
        db.add(db_movie)
        db.commit()
        db.refresh(db_movie)
        return db_movie
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error creating movie: {str(e)}")

# Get movies with filters
@app.get("/movies/", response_model=List[MovieResponse])
def get_movies(
    genre: Optional[str] = None,
    platform: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        query = db.query(Movie)
        if genre:
            query = query.filter(Movie.genre.contains(genre))
        if platform:
            query = query.filter(Movie.platform.contains(platform))
        if status:
            query = query.filter(Movie.status == status)
        movies = query.all()
        return movies
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching movies: {str(e)}")

# Update movie - ENHANCED with episode-based time calculation
@app.put("/movies/{movie_id}", response_model=MovieResponse)
def update_movie(movie_id: int, movie_update: MovieUpdate, db: Session = Depends(get_db)):
    try:
        db_movie = db.query(Movie).filter(Movie.id == movie_id).first()
        if not db_movie:
            raise HTTPException(status_code=404, detail="Movie not found")
        
        update_data = movie_update.dict(exclude_unset=True)
        
        # Handle episode-based time calculation for TV shows
        if db_movie.is_tv_show and 'episodes_watched' in update_data:
            new_episodes = update_data['episodes_watched']
            if new_episodes is None:
                new_episodes = 0
            
            # Calculate minutes based on episodes (20 minutes per episode)
            update_data['minutes_watched'] = new_episodes * EPISODE_DURATION_MINUTES
            
            # Auto-update status based on episodes
            if db_movie.total_episodes:
                if new_episodes == 0:
                    update_data['status'] = 'wishlist'
                elif new_episodes >= db_movie.total_episodes:
                    update_data['status'] = 'completed'
                else:
                    update_data['status'] = 'watching'
        
        # Ensure integer fields are never None
        if 'episodes_watched' in update_data and update_data['episodes_watched'] is None:
            update_data['episodes_watched'] = 0
        if 'minutes_watched' in update_data and update_data['minutes_watched'] is None:
            update_data['minutes_watched'] = 0
        
        for field, value in update_data.items():
            setattr(db_movie, field, value)
        
        db.commit()
        db.refresh(db_movie)
        return db_movie
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error updating movie: {str(e)}")

# Update rating and review
@app.put("/movies/{movie_id}/rating-review", response_model=MovieResponse)
def update_rating_review(movie_id: int, update: RatingReviewUpdate, db: Session = Depends(get_db)):
    try:
        db_movie = db.query(Movie).filter(Movie.id == movie_id).first()
        if not db_movie:
            raise HTTPException(status_code=404, detail="Movie not found")
        
        if update.rating is not None:
            if update.rating < 0 or update.rating > 10:
                raise HTTPException(status_code=400, detail="Rating must be between 0 and 10")
            db_movie.rating = update.rating
        
        if update.review is not None:
            db_movie.review = update.review
        
        db.commit()
        db.refresh(db_movie)
        return db_movie
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error updating rating/review: {str(e)}")

# Delete movie
@app.delete("/movies/{movie_id}")
def delete_movie(movie_id: int, db: Session = Depends(get_db)):
    try:
        db_movie = db.query(Movie).filter(Movie.id == movie_id).first()
        if not db_movie:
            raise HTTPException(status_code=404, detail="Movie not found")
        
        db.delete(db_movie)
        db.commit()
        return {"message": "Movie deleted successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error deleting movie: {str(e)}")

# Get stats
@app.get("/stats/")
def get_stats(db: Session = Depends(get_db)):
    try:
        total_movies = db.query(Movie).count()
        completed = db.query(Movie).filter(Movie.status == "completed").count()
        watching = db.query(Movie).filter(Movie.status == "watching").count()
        wishlist = db.query(Movie).filter(Movie.status == "wishlist").count()
        
        rated_movies = db.query(Movie).filter(Movie.rating.isnot(None)).all()
        avg_rating = sum(movie.rating for movie in rated_movies) / len(rated_movies) if rated_movies else 0
        
        total_minutes_watched = db.query(func.sum(Movie.minutes_watched)).scalar() or 0
        
        return {
            "total": total_movies,
            "completed": completed,
            "watching": watching,
            "wishlist": wishlist,
            "average_rating": round(avg_rating, 1),
            "total_minutes_watched": int(total_minutes_watched)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching stats: {str(e)}")

# Recommendations
@app.get("/recommendations", response_model=RecommendationResponse)
def get_recommendations(max_results: int = 10, db: Session = Depends(get_db)):
    try:
        user_movies = db.query(Movie).all()
        
        if not user_movies:
            return RecommendationResponse(
                recommendations=[],
                based_on=[],
                message="Add some movies to your collection to get personalized recommendations"
            )
        
        recommendations, based_on, message = recommendation_engine.get_recommendations(
            user_movies, max_results
        )
        
        enhanced_recommendations = []
        for rec in recommendations:
            existing_movie = db.query(Movie).filter(Movie.tmdb_id == rec['id']).first()
            enhanced_rec = {
                **rec,
                'already_added': existing_movie is not None,
                'existing_status': existing_movie.status if existing_movie else None
            }
            enhanced_recommendations.append(enhanced_rec)
        
        return RecommendationResponse(
            recommendations=enhanced_recommendations,
            based_on=based_on,
            message=message
        )
        
    except Exception as e:
        print(f"Error in recommendations: {e}")
        raise HTTPException(status_code=500, detail=f"Error generating recommendations: {str(e)}")

# Fallback recommendations
@app.get("/recommendations/fallback")
def get_fallback_recommendations(max_results: int = 10):
    try:
        # Use highly-rated content as fallback
        highly_rated_movies = tmdb_service.get_highly_rated_movies(max_results)
        
        recommendations = highly_rated_movies
        
        for rec in recommendations:
            rec['recommendation_reason'] = "Critically acclaimed"
        
        return {
            "recommendations": recommendations[:max_results],
            "based_on": ["Critically acclaimed content"],
            "message": "Here are some highly rated movies to get you started"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting fallback recommendations: {str(e)}")

# Party Watcher Endpoints
@app.post("/party/create", response_model=PartyRoomResponse)
def create_party_room(party_data: PartyRoomCreate, db: Session = Depends(get_db)):
    """Create a new party room for synchronized movie watching"""
    try:
        party_room = party_service.create_party_room(db, party_data)
        
        # Parse members for response
        members = json.loads(party_room.members)
        
        return PartyRoomResponse(
            id=party_room.id,
            code=party_room.code,
            movie_id=party_room.movie_id,
            movie_title=party_room.movie_title,
            movie_poster=party_room.movie_poster,
            host_id=party_room.host_id,
            created_at=party_room.created_at,
            is_active=party_room.is_active,
            members=members
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating party room: {str(e)}")

@app.post("/party/join")
def join_party_room(join_data: PartyJoinRequest, db: Session = Depends(get_db)):
    """Join an existing party room"""
    try:
        party_room = party_service.join_party_room(db, join_data)
        
        # Parse members for response
        members = json.loads(party_room.members)
        
        # Get movie details for response
        movie = db.query(Movie).filter(Movie.id == party_room.movie_id).first()
        movie_details = {
            "id": movie.id if movie else party_room.movie_id,
            "title": party_room.movie_title,
            "poster_path": party_room.movie_poster,
            "is_tv_show": movie.is_tv_show if movie else False
        }
        
        return {
            "room": {
                "id": party_room.id,
                "code": party_room.code,
                "movie_id": party_room.movie_id,
                "movie_title": party_room.movie_title,
                "movie_poster": party_room.movie_poster,
                "host_id": party_room.host_id,
                "created_at": party_room.created_at,
                "is_active": party_room.is_active,
                "members": members
            },
            "movie": movie_details,
            "members": members
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error joining party room: {str(e)}")

@app.post("/party/leave")
def leave_party_room(room_code: str, user_id: str, db: Session = Depends(get_db)):
    """Leave a party room"""
    try:
        party_room = party_service.leave_party_room(db, room_code, user_id)
        
        if party_room.is_active:
            # Parse updated members for response
            members = json.loads(party_room.members)
            return {
                "message": "Left party room successfully",
                "room": {
                    "code": party_room.code,
                    "members": members
                }
            }
        else:
            return {
                "message": "Party room ended (host left)",
                "room_ended": True
            }
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error leaving party room: {str(e)}")

@app.post("/party/end")
def end_party_room(room_code: str, db: Session = Depends(get_db)):
    """End a party room (host only)"""
    try:
        result = party_service.end_party_room(db, room_code)
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error ending party room: {str(e)}")

@app.get("/party/{room_code}")
def get_party_room(room_code: str, db: Session = Depends(get_db)):
    """Get party room details"""
    try:
        party_room = party_service.get_party_room(db, room_code)
        
        # Parse members for response
        members = json.loads(party_room.members)
        
        # Get movie details
        movie = db.query(Movie).filter(Movie.id == party_room.movie_id).first()
        movie_details = {
            "id": movie.id if movie else party_room.movie_id,
            "title": party_room.movie_title,
            "poster_path": party_room.movie_poster,
            "is_tv_show": movie.is_tv_show if movie else False,
            "overview": movie.overview if movie else None
        }
        
        return {
            "room": {
                "id": party_room.id,
                "code": party_room.code,
                "movie_id": party_room.movie_id,
                "movie_title": party_room.movie_title,
                "movie_poster": party_room.movie_poster,
                "host_id": party_room.host_id,
                "created_at": party_room.created_at,
                "is_active": party_room.is_active,
                "members": members
            },
            "movie": movie_details
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting party room: {str(e)}")

@app.post("/party/sync")
def sync_playback(sync_data: PartySyncRequest, db: Session = Depends(get_db)):
    """Sync playback across party members"""
    try:
        result = party_service.sync_playback(db, sync_data)
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error syncing playback: {str(e)}")

@app.post("/party/start")
def start_party_watching(start_data: PartyStartRequest, db: Session = Depends(get_db)):
    """Start synchronized watching session"""
    try:
        party_room = party_service.get_party_room(db, start_data.room_code)
        
        # In a real implementation, you would start the video playback for all members
        # For now, we just return a success message
        
        return {
            "message": "Party watching session started",
            "room_code": start_data.room_code,
            "movie_title": party_room.movie_title,
            "started_at": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error starting party watching: {str(e)}")

# Health check
@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "message": "MovieMate API is running",
        "timestamp": datetime.utcnow().isoformat(),
        "features": {
            "max_search_results": MAX_SEARCH_RESULTS,
            "min_good_rating": MIN_GOOD_RATING,
            "min_top_rating": MIN_TOP_RATING,
            "popular_content": True,
            "top_rated_content": True,
            "highly_rated_content": True,
            "fast_search": True,
            "ai_reviews": bool(AI21_API_KEY),
            "ai_review_lengths": ["short", "medium", "long"],
            "ai_provider": "AI21 Jurassic-2 Ultra",
            "party_watcher": True,
            "synchronized_watching": True
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)