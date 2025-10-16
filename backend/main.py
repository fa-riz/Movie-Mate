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

# TMDB Genre IDs Mapping
TMDB_GENRE_IDS = {
    "Action": 28, "Adventure": 12, "Animation": 16, "Comedy": 35,
    "Crime": 80, "Documentary": 99, "Drama": 18, "Family": 10751,
    "Fantasy": 14, "History": 36, "Horror": 27, "Music": 10402,
    "Mystery": 9648, "Romance": 10749, "Science Fiction": 878,
    "TV Movie": 10770, "Thriller": 53, "War": 10752, "Western": 37
}

# Hugging Face Configuration
HUGGING_FACE_API_KEY = os.getenv('HUGGING_FACE_API_KEY', '')
HUGGING_FACE_API_URL = "https://api-inference.huggingface.co/models/microsoft/DialoGPT-medium"

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

class ReviewGenerationResponse(BaseModel):
    review: str

# Recommendation Models
class RecommendationRequest(BaseModel):
    max_results: int = 10

class RecommendationResponse(BaseModel):
    recommendations: List[Dict[str, Any]]
    based_on: List[str]
    message: str

# AI Review Generator - IMPROVED VERSION
class AIReviewGenerator:
    def __init__(self):
        self.api_key = HUGGING_FACE_API_KEY
        self.api_url = HUGGING_FACE_API_URL
        self.headers = {"Authorization": f"Bearer {self.api_key}"} if self.api_key else {}
        
        if not self.api_key:
            print("⚠️  No Hugging Face API key found. AI reviews disabled.")
        else:
            print("✅ AI Review Generator initialized")
    
    def generate_review(self, title: str, user_notes: str = "", rating: Optional[float] = None):
        if not self.api_key:
            return self._get_fallback_review(title, user_notes, rating)
        
        try:
            prompt = self._build_prompt(title, user_notes, rating)
            
            payload = {
                "inputs": prompt,
                "parameters": {
                    "max_length": 300,
                    "temperature": 0.8,
                    "do_sample": True,
                    "return_full_text": False,
                    "max_new_tokens": 200,
                },
                "options": {
                    "wait_for_model": True,
                }
            }
            
            print(f"🤖 Generating AI review for: {title}")
            response = requests.post(
                self.api_url, 
                headers=self.headers, 
                json=payload,
                timeout=45  # Increased timeout
            )
            
            if response.status_code == 200:
                result = response.json()
                generated_text = self._extract_generated_text(result)
                if generated_text:
                    cleaned_text = self._clean_text(generated_text)
                    print(f"✅ AI review generated successfully")
                    return cleaned_text
            
            # If we get here, the API call failed
            print(f"❌ AI API returned status {response.status_code}")
            return self._get_fallback_review(title, user_notes, rating)
            
        except requests.exceptions.Timeout:
            print("❌ AI request timed out")
            return self._get_fallback_review(title, user_notes, rating)
        except requests.exceptions.ConnectionError:
            print("❌ AI service connection error")
            return self._get_fallback_review(title, user_notes, rating)
        except Exception as e:
            print(f"❌ AI error: {e}")
            return self._get_fallback_review(title, user_notes, rating)
    
    def _build_prompt(self, title: str, user_notes: str, rating: Optional[float] = None):
        """Build a better prompt for review generation"""
        prompt_parts = []
        
        # Base instruction
        prompt_parts.append(f"Write a thoughtful movie review for '{title}'.")
        
        # Add rating context if available
        if rating is not None:
            if rating >= 8:
                sentiment = "very positive"
            elif rating >= 6:
                sentiment = "positive but balanced"
            elif rating >= 4:
                sentiment = "mixed"
            else:
                sentiment = "critical"
            prompt_parts.append(f"The review should be {sentiment} since it's rated {rating}/10.")
        
        # Add user notes if provided
        if user_notes.strip():
            prompt_parts.append(f"Incorporate these points: {user_notes}")
        
        # Add structure guidance
        prompt_parts.append("The review should discuss plot, characters, and overall impression. Keep it concise and engaging.")
        
        # Add closing
        prompt_parts.append("Review:")
        
        return " ".join(prompt_parts)
    
    def _extract_generated_text(self, result):
        """Extract generated text from different response formats"""
        if isinstance(result, list) and len(result) > 0:
            return result[0].get('generated_text', '').strip()
        elif isinstance(result, dict):
            return result.get('generated_text', '').strip()
        return ""
    
    def _clean_text(self, text: str):
        """Clean and format the generated text"""
        text = text.strip()
        
        # Remove the prompt if it's included in the response
        if "Write a thoughtful movie review for" in text:
            # Find where the actual review starts
            lines = text.split('\n')
            for i, line in enumerate(lines):
                if line.strip() and "review" not in line.lower() and "write" not in line.lower():
                    text = '\n'.join(lines[i:]).strip()
                    break
        
        # Ensure proper punctuation
        if text and text[-1] not in ['.', '!', '?']:
            text += '.'
        
        # Remove any duplicate sentences or weird repetitions
        sentences = text.split('. ')
        unique_sentences = []
        for sentence in sentences:
            if sentence and sentence not in unique_sentences:
                unique_sentences.append(sentence)
        
        return '. '.join(unique_sentences).strip()
    
    def _get_fallback_review(self, title: str, user_notes: str = "", rating: Optional[float] = None):
        """Provide a meaningful fallback review when AI is unavailable"""
        print("🔄 Using fallback review generator")
        
        # Template-based fallback reviews
        templates = [
            "This {content_type} offers an engaging experience with memorable moments. The storytelling keeps you invested throughout.",
            "A solid entry in its genre, {title} delivers on expectations with competent execution and entertaining sequences.",
            "{title} presents an interesting premise that develops into a satisfying narrative with good pacing and character development.",
            "With its unique approach and consistent quality, this {content_type} stands out as a worthwhile viewing experience.",
            "The creative vision behind {title} results in a compelling watch that balances different elements effectively."
        ]
        
        # Select template based on rating if available
        if rating is not None:
            if rating >= 8:
                templates = [
                    "An exceptional {content_type} that excels in multiple aspects. {title} demonstrates outstanding quality in storytelling and execution.",
                    "Masterfully crafted, {title} represents the best of what this genre has to offer with superb attention to detail.",
                    "A remarkable achievement in filmmaking, {title} delivers an unforgettable experience that resonates deeply.",
                    "Outstanding in every regard, this {content_type} sets new standards with its brilliant execution and emotional depth."
                ]
            elif rating <= 4:
                templates = [
                    "While {title} has some interesting ideas, the execution falls short of its potential in several areas.",
                    "This {content_type} struggles to find its footing, resulting in an uneven experience that could have been better developed.",
                    "{title} shows glimpses of promise but ultimately doesn't fully deliver on its initial concept.",
                    "Despite some positive elements, the overall experience of {title} is hampered by inconsistent quality."
                ]
        
        content_type = "movie" if "movie" in title.lower() else "show"
        template = random.choice(templates)
        
        fallback_review = template.format(title=title, content_type=content_type)
        
        # Add user notes if provided
        if user_notes.strip():
            fallback_review += f" Note: {user_notes}"
        
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
ai_generator = AIReviewGenerator()
recommendation_engine = RecommendationEngine(tmdb_service)

# Helper function to ensure integer fields are never None
def ensure_int_fields(movie_dict):
    """Ensure episodes_watched and minutes_watched are never None"""
    if 'episodes_watched' in movie_dict and movie_dict['episodes_watched'] is None:
        movie_dict['episodes_watched'] = 0
    if 'minutes_watched' in movie_dict and movie_dict['minutes_watched'] is None:
        movie_dict['minutes_watched'] = 0
    return movie_dict

# Test endpoint
@app.get("/tmdb/status")
def check_tmdb_status():
    test_results = tmdb_service.search_movies("avengers")
    top_rated = tmdb_service.get_top_rated_movies(3)
    highly_rated = tmdb_service.get_highly_rated_movies(3)
    return {
        "tmdb_configured": bool(TMDB_API_KEY or TMDB_ACCESS_TOKEN),
        "api_key_set": bool(TMDB_API_KEY),
        "access_token_set": bool(TMDB_ACCESS_TOKEN),
        "test_search": "avengers",
        "results_count": len(test_results),
        "top_rated_count": len(top_rated),
        "highly_rated_count": len(highly_rated),
        "status": "✅ Working" if test_results else "❌ Not Working",
        "cache_size": len(tmdb_service._cache),
        "max_search_results": MAX_SEARCH_RESULTS,
        "min_good_rating": MIN_GOOD_RATING,
        "min_top_rating": MIN_TOP_RATING
    }

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

# NEW: Get highly rated movies (8+ ratings from discover endpoint)
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

# Generate AI review - IMPROVED with better error handling
@app.post("/movies/{movie_id}/generate-review", response_model=ReviewGenerationResponse)
def generate_ai_review(movie_id: int, request: ReviewGenerationRequest, db: Session = Depends(get_db)):
    try:
        db_movie = db.query(Movie).filter(Movie.id == movie_id).first()
        if not db_movie:
            raise HTTPException(status_code=404, detail="Movie not found")
        
        # Check if AI service is configured
        if not HUGGING_FACE_API_KEY:
            raise HTTPException(
                status_code=503, 
                detail="AI review service is not configured. Please check your Hugging Face API key."
            )
        
        review = ai_generator.generate_review(
            title=db_movie.title,
            user_notes=request.user_notes,
            rating=request.rating
        )
        
        # Update the movie with the generated review and optional rating
        update_data = {}
        if request.rating is not None:
            update_data['rating'] = request.rating
        update_data['review'] = review
        
        for field, value in update_data.items():
            setattr(db_movie, field, value)
        
        db.commit()
        
        return ReviewGenerationResponse(review=review)
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"❌ Error in AI review generation: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Unable to generate AI review at this time. Please try again later or write your review manually."
        )

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
            "ai_reviews": bool(HUGGING_FACE_API_KEY)
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)