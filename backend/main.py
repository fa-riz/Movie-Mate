import os
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Float, Text, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from pydantic import BaseModel
from typing import List, Optional
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Database setup
SQLALCHEMY_DATABASE_URL = "sqlite:///./moviemate.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Models
class Movie(Base):
    __tablename__ = "movies"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    director = Column(String)
    genre = Column(String)
    platform = Column(String)
    status = Column(String)  # watching, completed, wishlist
    rating = Column(Float, nullable=True)
    review = Column(Text, nullable=True)
    episodes_watched = Column(Integer, default=0)
    total_episodes = Column(Integer, nullable=True)
    is_tv_show = Column(Boolean, default=False)

Base.metadata.create_all(bind=engine)

# Pydantic models
class MovieBase(BaseModel):
    title: str
    director: str
    genre: str
    platform: str
    status: str
    is_tv_show: bool = False
    episodes_watched: int = 0
    total_episodes: Optional[int] = None

class MovieCreate(MovieBase):
    pass

class MovieUpdate(BaseModel):
    rating: Optional[float] = None
    review: Optional[str] = None
    episodes_watched: Optional[int] = None
    status: Optional[str] = None

class MovieResponse(MovieBase):
    id: int
    rating: Optional[float]
    review: Optional[str]
    
    class Config:
        from_attributes = True

class ReviewRequest(BaseModel):
    user_notes: str = ""

class RatingReviewUpdate(BaseModel):
    rating: Optional[float] = None
    review: Optional[str] = None

# AI Service
class AIService:
    def __init__(self):
        # Get API key from environment variable
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key:
            print("⚠️  WARNING: OPENAI_API_KEY not found in environment variables")
            print("⚠️  AI features will not work. Please set OPENAI_API_KEY in your .env file")
        
        self.client = OpenAI(api_key=api_key)
        self.is_available = bool(api_key)
    
    def generate_review(self, title: str, user_notes: str = "") -> str:
        """
        Generates a short AI review for a movie or TV show.
        """
        # Check if AI is available
        if not self.is_available:
            return self.get_fallback_review(title, user_notes)
        
        try:
            prompt = f"Write a short, engaging review for the movie/TV show '{title}'. Keep it under 100 words and make it sound natural."
            if user_notes:
                prompt += f" Incorporate these viewer notes: {user_notes}"
            
            print(f"🤖 Generating AI review for: {title}")
            if user_notes:
                print(f"📝 User notes: {user_notes}")

            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=150,
                temperature=0.7
            )
            
            review = response.choices[0].message.content
            print(f"✅ AI Review generated: {review[:50]}...")
            return review
            
        except Exception as e:
            print(f"❌ Error generating AI review: {e}")
            return self.get_fallback_review(title, user_notes)
    
    def get_fallback_review(self, title: str, user_notes: str = "") -> str:
        """Generate a fallback review when AI is not available"""
        fallback_review = f"'{title}' delivers an engaging experience with memorable moments."
        
        if user_notes:
            # Incorporate user notes into fallback review
            if "action" in user_notes.lower():
                fallback_review = f"'{title}' features thrilling action sequences and impressive visuals that keep you on the edge of your seat."
            elif "comedy" in user_notes.lower() or "funny" in user_notes.lower():
                fallback_review = f"'{title}' offers plenty of laughs and entertaining moments that will brighten your day."
            elif "drama" in user_notes.lower():
                fallback_review = f"'{title}' presents a compelling story with emotional depth and strong character development."
            elif "romance" in user_notes.lower():
                fallback_review = f"'{title}' tells a heartwarming love story with genuine chemistry between the characters."
        
        return fallback_review

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

ai_service = AIService()

# Routes
@app.post("/movies/", response_model=MovieResponse)
def create_movie(movie: MovieCreate, db: Session = Depends(get_db)):
    db_movie = Movie(**movie.dict())
    db.add(db_movie)
    db.commit()
    db.refresh(db_movie)
    return db_movie

@app.get("/movies/", response_model=List[MovieResponse])
def get_movies(
    genre: Optional[str] = None,
    platform: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Movie)
    if genre:
        query = query.filter(Movie.genre == genre)
    if platform:
        query = query.filter(Movie.platform == platform)
    if status:
        query = query.filter(Movie.status == status)
    return query.all()

@app.put("/movies/{movie_id}", response_model=MovieResponse)
def update_movie(movie_id: int, movie_update: MovieUpdate, db: Session = Depends(get_db)):
    db_movie = db.query(Movie).filter(Movie.id == movie_id).first()
    if not db_movie:
        raise HTTPException(status_code=404, detail="Movie not found")
    
    for field, value in movie_update.dict(exclude_unset=True).items():
        setattr(db_movie, field, value)
    
    db.commit()
    db.refresh(db_movie)
    return db_movie

@app.put("/movies/{movie_id}/rating-review")
def update_rating_review(movie_id: int, update: RatingReviewUpdate, db: Session = Depends(get_db)):
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

@app.delete("/movies/{movie_id}")
def delete_movie(movie_id: int, db: Session = Depends(get_db)):
    db_movie = db.query(Movie).filter(Movie.id == movie_id).first()
    if not db_movie:
        raise HTTPException(status_code=404, detail="Movie not found")
    
    db.delete(db_movie)
    db.commit()
    return {"message": "Movie deleted successfully"}

@app.post("/movies/{movie_id}/generate-review")
def generate_ai_review(movie_id: int, request: ReviewRequest, db: Session = Depends(get_db)):
    db_movie = db.query(Movie).filter(Movie.id == movie_id).first()
    if not db_movie:
        raise HTTPException(status_code=404, detail="Movie not found")
    
    print(f"🎬 Generating AI review for movie: {db_movie.title}")
    print(f"📝 User notes provided: {request.user_notes}")
    
    review = ai_service.generate_review(db_movie.title, request.user_notes)
    
    # Update movie with generated review
    db_movie.review = review
    db.commit()
    db.refresh(db_movie)
    
    print(f"✅ Review saved for {db_movie.title}")
    return {"review": review}

@app.get("/stats/")
def get_stats(db: Session = Depends(get_db)):
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

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "ai_available": ai_service.is_available,
        "message": "MovieMate API is running"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)