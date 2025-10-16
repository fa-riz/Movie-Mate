from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from datetime import datetime

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///movies.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
CORS(app)

# Movie Model
class Movie(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    director = db.Column(db.String(100))
    genre = db.Column(db.String(100))
    platform = db.Column(db.String(100))
    status = db.Column(db.String(50), default='wishlist')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'director': self.director,
            'genre': self.genre,
            'platform': self.platform,
            'status': self.status,
            'created_at': self.created_at.isoformat()
        }

# Create tables
with app.app_context():
    db.create_all()

# Routes
@app.route('/movies', methods=['GET'])
def get_movies():
    try:
        # Filter parameters
        genre = request.args.get('genre')
        platform = request.args.get('platform')
        status = request.args.get('status')
        
        query = Movie.query
        
        if genre:
            query = query.filter(Movie.genre == genre)
        if platform:
            query = query.filter(Movie.platform == platform)
        if status:
            query = query.filter(Movie.status == status)
        
        movies = query.order_by(Movie.created_at.desc()).all()
        return jsonify([movie.to_dict() for movie in movies])
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/movies', methods=['POST'])
def add_movie():
    try:
        data = request.get_json()
        
        # Validation
        if not data.get('title'):
            return jsonify({'error': 'Title is required'}), 400
        
        movie = Movie(
            title=data['title'],
            director=data.get('director', ''),
            genre=data.get('genre', ''),
            platform=data.get('platform', ''),
            status=data.get('status', 'wishlist')
        )
        
        db.session.add(movie)
        db.session.commit()
        
        return jsonify(movie.to_dict()), 201
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/movies/<int:movie_id>', methods=['PUT'])
def update_movie(movie_id):
    try:
        movie = Movie.query.get_or_404(movie_id)
        data = request.get_json()
        
        # Update fields if provided
        if 'title' in data:
            movie.title = data['title']
        if 'director' in data:
            movie.director = data['director']
        if 'genre' in data:
            movie.genre = data['genre']
        if 'platform' in data:
            movie.platform = data['platform']
        if 'status' in data:
            movie.status = data['status']
        
        db.session.commit()
        return jsonify(movie.to_dict())
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/movies/<int:movie_id>', methods=['DELETE'])
def delete_movie(movie_id):
    try:
        movie = Movie.query.get_or_404(movie_id)
        db.session.delete(movie)
        db.session.commit()
        return jsonify({'message': 'Movie deleted successfully'})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/stats', methods=['GET'])
def get_stats():
    try:
        total = Movie.query.count()
        watching = Movie.query.filter_by(status='watching').count()
        completed = Movie.query.filter_by(status='completed').count()
        wishlist = Movie.query.filter_by(status='wishlist').count()
        
        return jsonify({
            'total': total,
            'watching': watching,
            'completed': completed,
            'wishlist': wishlist
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/')
def home():
    return jsonify({
        'message': 'MovieMate API is running!',
        'endpoints': {
            'GET /movies': 'Get all movies',
            'POST /movies': 'Add a new movie',
            'PUT /movies/<id>': 'Update a movie',
            'DELETE /movies/<id>': 'Delete a movie',
            'GET /stats': 'Get statistics'
        }
    })

if __name__ == '__main__':
    app.run(debug=True, port=8000)