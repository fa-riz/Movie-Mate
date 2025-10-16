import os
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Float, Text, Boolean, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from pydantic import BaseModel
from typing import List, Optional
import requests
from datetime import datetime
from dotenv import load_dotenv
import random

# Load environment variables
load_dotenv()

# Database setup
SQLALCHEMY_DATABASE_URL = "sqlite:///./moviemate.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# TMDB Configuration - Both API Key and Access Token
TMDB_API_KEY = os.getenv('TMDB_API_KEY', '')
TMDB_ACCESS_TOKEN = os.getenv('TMDB_ACCESS_TOKEN', '')
TMDB_BASE_URL = "https://api.themoviedb.org/3"
TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500"

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
    episodes_watched = Column(Integer, default=0)
    total_episodes = Column(Integer, nullable=True)
    is_tv_show = Column(Boolean, default=False)
    poster_path = Column(String, nullable=True)
    release_date = Column(String, nullable=True)
    overview = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

# Create all tables
try:
    Base.metadata.create_all(bind=engine)
    print("✅ Database tables created successfully")
except Exception as e:
    print(f"❌ Error creating database tables: {e}")

# Pydantic models
class MovieBase(BaseModel):
    title: str
    director: str = ""
    genre: str = ""
    platform: str = ""
    status: str = "wishlist"
    is_tv_show: bool = False
    episodes_watched: int = 0
    total_episodes: Optional[int] = None

class MovieCreate(MovieBase):
    tmdb_id: Optional[int] = None
    poster_path: Optional[str] = None
    overview: Optional[str] = None
    release_date: Optional[str] = None

class MovieUpdate(BaseModel):
    rating: Optional[float] = None
    review: Optional[str] = None
    episodes_watched: Optional[int] = None
    status: Optional[str] = None

class MovieResponse(MovieBase):
    id: int
    tmdb_id: Optional[int]
    rating: Optional[float]
    review: Optional[str]
    poster_path: Optional[str]
    release_date: Optional[str]
    overview: Optional[str]
    
    class Config:
        from_attributes = True

class RatingReviewUpdate(BaseModel):
    rating: Optional[float] = None
    review: Optional[str] = None

# IMPROVED: TMDB Service with better error handling and authentication
class TMDBService:
    def __init__(self):
        self.api_key = TMDB_API_KEY
        self.access_token = TMDB_ACCESS_TOKEN
        self.base_url = TMDB_BASE_URL
        self.image_base_url = TMDB_IMAGE_BASE_URL
        
        # IMPROVED: Better credential checking with detailed messages
        if not self.api_key and not self.access_token:
            print("❌ No TMDB credentials configured - please check your .env file")
            print("💡 Get free API key from: https://www.themoviedb.org/settings/api")
        else:
            if self.api_key:
                print(f"✅ TMDB API Key loaded: {self.api_key[:8]}...")
            if self.access_token:
                print(f"✅ TMDB Access Token loaded: {self.access_token[:8]}...")

    def _get_params(self):
        """Get parameters for API requests - use API Key when Access Token not available"""
        # IMPROVED: Only use API key if we don't have access token
        if self.access_token:
            return {}  # Access token uses headers, not params
        elif self.api_key:
            return {'api_key': self.api_key}
        else:
            return {}

    def _get_headers(self):
        """Get headers for API requests - use Access Token when available"""
        # IMPROVED: Only return headers if we have access token
        if self.access_token:
            return {
                'Authorization': f'Bearer {self.access_token}',
                'Content-Type': 'application/json;charset=utf-8'
            }
        return {}

    def search_movies(self, query: str, page: int = 1):
        """Search for movies and TV shows on TMDB"""
        # IMPROVED: Better credential checking
        if not self.api_key and not self.access_token:
            print("❌ No TMDB credentials configured - please check your .env file")
            print("💡 Get free API key from: https://www.themoviedb.org/settings/api")
            return []
            
        try:
            url = f"{self.base_url}/search/multi"
            
            # IMPROVED: Simplified parameter handling
            params = {
                'query': query,
                'page': page,
                'include_adult': False,
            }
            
            # IMPROVED: Add API key to params only if using API key auth
            if self.api_key and not self.access_token:
                params['api_key'] = self.api_key
            
            headers = self._get_headers()
            
            print(f"🔍 Searching TMDB for: '{query}'")
            print(f"📡 URL: {url}")
            print(f"🔑 Using: {'Access Token' if self.access_token else 'API Key'}")
            
            response = requests.get(
                url, 
                params=params, 
                headers=headers,
                timeout=10
            )
            
            # IMPROVED: Better error response handling
            if response.status_code == 401:
                error_detail = response.json().get('status_message', 'Unknown error')
                print(f"❌ TMDB Authentication failed: {error_detail}")
                print("💡 Check your TMDB_API_KEY and TMDB_ACCESS_TOKEN in .env file")
                return []
            elif response.status_code == 404:
                print("❌ TMDB endpoint not found")
                return []
            elif response.status_code != 200:
                print(f"❌ TMDB HTTP Error {response.status_code}: {response.text}")
                return []
                
            response.raise_for_status()
            data = response.json()
            
            # IMPROVED: Better results handling
            results = []
            raw_results = data.get('results', [])
            
            if not raw_results:
                print(f"ℹ️  No results found for: '{query}'")
                return []
                
            for item in raw_results:
                if item.get('media_type') in ['movie', 'tv']:
                    poster_path = item.get('poster_path')
                    
                    result = {
                        'id': item['id'],
                        'title': item.get('title') or item.get('name'),
                        'release_date': item.get('release_date') or item.get('first_air_date'),
                        'overview': item.get('overview'),
                        'poster_path': poster_path,
                        'media_type': item.get('media_type'),
                        'vote_average': item.get('vote_average')
                    }
                    results.append(result)
            
            print(f"✅ Found {len(results)} results for: '{query}'")
            return results
            
        except requests.exceptions.Timeout:
            print("❌ TMDB Search Timeout - request took too long")
            return []
        except requests.exceptions.ConnectionError:
            print("❌ TMDB Connection Error - check your internet connection")
            return []
        except requests.exceptions.RequestException as e:
            print(f"❌ TMDB Request Error: {e}")
            return []
        except Exception as e:
            print(f"❌ Unexpected TMDB Search Error: {e}")
            return []

    def get_movie_details(self, tmdb_id: int, is_tv: bool = False):
        """Get detailed information about a movie or TV show"""
        # IMPROVED: Early return with better messaging
        if not self.api_key and not self.access_token:
            print("❌ Cannot fetch details - no TMDB credentials")
            return None
            
        try:
            media_type = 'tv' if is_tv else 'movie'
            url = f"{self.base_url}/{media_type}/{tmdb_id}"
            
            # IMPROVED: Simplified parameter handling
            params = {}
            if self.api_key and not self.access_token:
                params['api_key'] = self.api_key
                
            headers = self._get_headers()
            
            print(f"📡 Fetching TMDB details for {media_type} ID: {tmdb_id}")
            
            response = requests.get(
                url, 
                params=params, 
                headers=headers,
                timeout=10
            )
            
            # IMPROVED: Better error handling
            if response.status_code == 404:
                print(f"❌ TMDB {media_type} not found with ID: {tmdb_id}")
                return None
            elif response.status_code == 401:
                error_detail = response.json().get('status_message', 'Unknown error')
                print(f"❌ TMDB Authentication failed: {error_detail}")
                return None
            elif response.status_code != 200:
                print(f"❌ TMDB HTTP Error {response.status_code}: {response.text}")
                return None
                
            response.raise_for_status()
            data = response.json()
            
            # IMPROVED: Simplified director/creator logic
            directors = []
            if is_tv:
                creators = data.get('created_by', [])
                directors = [creator['name'] for creator in creators[:2]]
            else:
                # For movies, use a simpler approach
                directors = ["Unknown Director"]  # Default value
            
            # Get genres
            genres = [genre['name'] for genre in data.get('genres', [])[:3]]
            
            result = {
                'title': data.get('title') or data.get('name'),
                'director': ', '.join(directors) if directors else 'Not specified',
                'genre': ', '.join(genres) if genres else 'Not specified',
                'overview': data.get('overview'),
                'poster_path': data.get('poster_path'),
                'release_date': data.get('release_date') or data.get('first_air_date'),
                'total_episodes': data.get('number_of_episodes') if is_tv else None
            }
            
            print(f"✅ Successfully fetched details for: {result['title']}")
            return result
            
        except requests.exceptions.Timeout:
            print(f"❌ TMDB Details Timeout for ID: {tmdb_id}")
            return None
        except requests.exceptions.RequestException as e:
            print(f"❌ TMDB Details Request Error: {e}")
            return None
        except Exception as e:
            print(f"❌ Unexpected TMDB Details Error: {e}")
            return None

    def test_connection(self):
        """Test TMDB connection with detailed diagnostics"""
        print("\n🔧 Testing TMDB Connection...")
        print(f"API Key: {'✅ Set' if self.api_key else '❌ Missing'}")
        print(f"Access Token: {'✅ Set' if self.access_token else '❌ Missing'}")
        
        if not self.api_key and not self.access_token:
            return {"status": "error", "message": "No credentials found in .env file"}
        
        try:
            # Test with a simple search
            test_results = self.search_movies("avengers")
            
            if test_results:
                return {"status": "success", "message": f"TMDB working! Found {len(test_results)} results"}
            else:
                return {"status": "error", "message": "TMDB connected but no results returned"}
                
        except Exception as e:
            return {"status": "error", "message": f"Connection failed: {str(e)}"}

# Simple Review Generator
class ReviewGenerator:
    def generate_review(self, title: str, user_notes: str = "", rating: float = None):
        """Generate a review using template-based approach"""
        
        templates = [
            f"'{title}' delivers a captivating experience that keeps you engaged from start to finish.",
            f"With its compelling storytelling, '{title}' offers an unforgettable viewing experience.",
            f"'{title}' stands out with its unique approach and memorable characters.",
            f"This production of '{title}' showcases excellent craftsmanship and attention to detail.",
            f"'{title}' provides an entertaining escape with its well-executed narrative."
        ]
        
        import random
        review = random.choice(templates)
        
        # Add rating context
        if rating:
            if rating >= 8:
                review = f"Masterpiece! {review} Absolutely worth watching."
            elif rating >= 6:
                review = f"Solid entertainment. {review}"
            else:
                review = f"While '{title}' has its moments, it falls short in some areas."
        
        # Incorporate user notes
        if user_notes:
            review += f" Notably: {user_notes}"
        
        return review

# FastAPI app
app = FastAPI(title="MovieMate API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
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
review_generator = ReviewGenerator()

# Routes
@app.post("/movies/", response_model=MovieResponse)
def create_movie(movie: MovieCreate, db: Session = Depends(get_db)):
    try:
        # If TMDB ID is provided, fetch details from TMDB
        if movie.tmdb_id:
            details = tmdb_service.get_movie_details(movie.tmdb_id, movie.is_tv_show)
            if details:
                # Override with TMDB data but keep user-provided platform
                movie_data = movie.dict()
                movie_data.update({
                    'title': details['title'],
                    'director': details['director'],
                    'genre': details['genre'],
                    'poster_path': details['poster_path'],
                    'overview': details['overview'],
                    'release_date': details['release_date']
                })
                db_movie = Movie(**movie_data)
            else:
                db_movie = Movie(**movie.dict())
        else:
            db_movie = Movie(**movie.dict())
        
        db.add(db_movie)
        db.commit()
        db.refresh(db_movie)
        print(f"✅ Movie added: {db_movie.title}")
        return db_movie
    except Exception as e:
        db.rollback()
        print(f"❌ Error creating movie: {e}")
        raise HTTPException(status_code=500, detail=f"Error creating movie: {str(e)}")

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
        print(f"✅ Fetched {len(movies)} movies")
        return movies
    except Exception as e:
        print(f"❌ Error fetching movies: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching movies: {str(e)}")

@app.put("/movies/{movie_id}", response_model=MovieResponse)
def update_movie(movie_id: int, movie_update: MovieUpdate, db: Session = Depends(get_db)):
    try:
        db_movie = db.query(Movie).filter(Movie.id == movie_id).first()
        if not db_movie:
            raise HTTPException(status_code=404, detail="Movie not found")
        
        for field, value in movie_update.dict(exclude_unset=True).items():
            setattr(db_movie, field, value)
        
        db.commit()
        db.refresh(db_movie)
        return db_movie
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error updating movie: {str(e)}")

@app.put("/movies/{movie_id}/rating-review")
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
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error updating rating/review: {str(e)}")

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

# TMDB Integration Routes
@app.get("/tmdb/search")
def search_tmdb(query: str, page: int = 1):
    """Search TMDB for movies and TV shows"""
    if not query.strip():
        return {"results": []}
    
    results = tmdb_service.search_movies(query, page)
    return {"results": results}

@app.get("/tmdb/details/{tmdb_id}")
def get_tmdb_details(tmdb_id: int, is_tv: bool = False):
    """Get detailed information from TMDB"""
    details = tmdb_service.get_movie_details(tmdb_id, is_tv)
    if not details:
        raise HTTPException(status_code=404, detail="Movie/TV show not found on TMDB")
    return details

@app.get("/tmdb/test")
def test_tmdb_connection():
    """Test TMDB connection and authentication"""
    return tmdb_service.test_connection()

# Review Generation
@app.post("/movies/{movie_id}/generate-review")
def generate_review(movie_id: int, user_notes: str = "", db: Session = Depends(get_db)):
    try:
        db_movie = db.query(Movie).filter(Movie.id == movie_id).first()
        if not db_movie:
            raise HTTPException(status_code=404, detail="Movie not found")
        
        review = review_generator.generate_review(db_movie.title, user_notes, db_movie.rating)
        
        # Update movie with generated review
        db_movie.review = review
        db.commit()
        db.refresh(db_movie)
        
        return {"review": review}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error generating review: {str(e)}")

@app.get("/stats/")
def get_stats(db: Session = Depends(get_db)):
    try:
        total_movies = db.query(Movie).count()
        completed = db.query(Movie).filter(Movie.status == "completed").count()
        watching = db.query(Movie).filter(Movie.status == "watching").count()
        wishlist = db.query(Movie).filter(Movie.status == "wishlist").count()
        
        # Calculate average rating
        rated_movies = db.query(Movie).filter(Movie.rating.isnot(None)).all()
        avg_rating = sum(movie.rating for movie in rated_movies) / len(rated_movies) if rated_movies else 0
        
        return {
            "total": total_movies,
            "completed": completed,
            "watching": watching,
            "wishlist": wishlist,
            "average_rating": round(avg_rating, 1)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching stats: {str(e)}")

@app.get("/health")
def health_check():
    connection_test = tmdb_service.test_connection()
    return {
        "status": "healthy",
        "tmdb_connection": connection_test,
        "message": "MovieMate API is running"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)