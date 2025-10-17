# MovieMate - Movie & TV Show Collection Manager 🎬

A comprehensive full-stack application for tracking and managing your movie and TV show collection with AI-powered features and social watching capabilities.

![MovieMate](https://img.shields.io/badge/MovieMate-V1.0-blue) ![Python](https://img.shields.io/badge/Python-3.8%2B-green) ![React](https://img.shields.io/badge/React-18%2B-blue) ![FastAPI](https://img.shields.io/badge/FastAPI-0.68%2B-green)

## ✨ Features

### 🎯 Core Functionality
- **📝 Movie & TV Show Tracking** - Add, organize, and track your watch progress
- **🔄 Multi-Platform Support** - Track content across Netflix, Prime, Disney+, etc.
- **📊 Watch Status Management** - Wishlist, Watching, Completed statuses
- **⭐ Rating & Review System** - Rate and review with AI-powered assistance
- **⏱️ Progress Tracking** - Track minutes watched and episode progress

### 🤖 AI-Powered Features
- **🧠 AI21 Integration** - Generate professional reviews using AI21's Jurassic-2 Ultra
- **💡 Smart Review Generation** - Context-aware reviews based on ratings and user notes
- **📏 Length Control** - Short, medium, and long review options
- **🛡️ Fallback System** - High-quality fallback reviews when AI is unavailable

### 👥 Social & Discovery
- **🎉 Watch Party Planner** - Find optimal times to watch with friends
- **🔍 TMDB Integration** - Search and add from The Movie Database
- **🎭 Smart Recommendations** - Genre-based personalized recommendations
- **👥 Friend Availability** - Coordinate watch times with friends' schedules

### 📈 Analytics & Insights
- **📊 Comprehensive Statistics** - Visual charts and progress tracking
- **🎭 Genre Analysis** - Understand your viewing preferences
- **📱 Platform Distribution** - See where you watch most content
- **📈 Progress Analytics** - Track completion rates and watch patterns

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- Node.js 14+
- TMDB API account (free)
- AI21 Studio account (optional, for AI reviews)

### Backend Setup

1. **Clone and setup environment**
```bash
git clone <repository-url>
cd moviemate
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. **Install dependencies**
```bash
pip install fastapi uvicorn sqlalchemy python-dotenv requests pydantic
```

3. **Configure environment**
Create `.env` file:
```env
TMDB_API_KEY=your_tmdb_api_key
TMDB_ACCESS_TOKEN=your_tmdb_access_token
AI21_API_KEY=your_ai21_api_key  # Optional
```

4. **Run backend**
```bash
python main.py
# Backend runs on http://localhost:8000
```

### Frontend Setup

1. **Install dependencies**
```bash
cd frontend  # If separate frontend
npm install
```

2. **Configure API**
Update `src/utils/constants.js`:
```javascript
export const API_BASE = "http://localhost:8000";
```

3. **Run frontend**
```bash
npm start
# Frontend runs on http://localhost:3000
```

## 🗂️ Project Structure

```
moviemate/
├── main.py                 # FastAPI backend
├── requirements.txt        # Python dependencies
├── moviemate.db           # SQLite database
├── .env                   # Environment variables
└── frontend/              # React frontend
    ├── src/
    │   ├── components/    # React components
    │   ├── utils/         # Constants and utilities
    │   └── App.js         # Main App component
    └── package.json
```

## 🔧 API Endpoints

### 🎬 Movies
- `GET /movies/` - Get all movies with filters
- `POST /movies/` - Create new movie
- `PUT /movies/{id}` - Update movie
- `DELETE /movies/{id}` - Delete movie
- `POST /movies/tmdb/add` - Add movie from TMDB

### 🤖 AI Features
- `POST /movies/{id}/generate-review` - Generate AI review
- `POST /ai21/test-review` - Test AI21 review generation
- `GET /ai21/health` - Check AI21 service status

### 🔍 TMDB Integration
- `GET /tmdb/search` - Search TMDB database
- `GET /tmdb/popular` - Get popular content
- `GET /tmdb/top-rated` - Get top-rated content

### 💡 Recommendations
- `GET /recommendations` - Get personalized recommendations
- `GET /recommendations/fallback` - Get fallback recommendations

## 🎯 Usage Examples

### Adding a Movie
1. Search TMDB database
2. Select platform (Netflix, Prime, etc.)
3. Set initial status (Wishlist/Watching/Completed)
4. Track progress with minute-by-minute updates

### Generating AI Reviews
1. Rate your movie (1-10 stars)
2. Add specific notes (optional)
3. Choose review length (Short/Medium/Long)
4. Get professional-quality review instantly

### Planning Watch Parties
1. Select movie from collection
2. Add friends and their availability
3. Get AI-suggested optimal watch times
4. Coordinate with friends easily

## 🛠️ Configuration

### API Keys Setup

1. **TMDB API** (Required):
   - Visit [The Movie Database](https://www.themoviedb.org/settings/api)
   - Register for free account
   - Generate API key from settings

2. **AI21 API** (Optional):
   - Visit [AI21 Studio](https://studio.ai21.com/)
   - Sign up for free account
   - Generate API key from dashboard

### Database
- Automatic SQLite database creation
- Schema migrations handled automatically
- Data persists in `moviemate.db` file

## 🚀 Deployment

### Backend Options
- **Railway**: One-click deployment
- **Heroku**: Use Procfile
- **DigitalOcean**: App Platform
- **AWS**: EC2 or ECS

### Frontend Options
- **Vercel**: Connect GitHub repo
- **Netlify**: Drag and drop build
- **GitHub Pages**: Static hosting

### Production Environment
```env
TMDB_API_KEY=your_production_key
TMDB_ACCESS_TOKEN=your_production_token
AI21_API_KEY=your_production_ai21_key
DATABASE_URL=your_production_db_url
```

## 🐛 Troubleshooting

### Common Issues

**TMDB API Errors:**
- Verify API key in `.env`
- Check API quota limits
- Ensure CORS configuration

**AI21 Review Failures:**
- Check AI21 API key
- Verify internet connection
- Use fallback reviews as backup

**Database Issues:**
- Delete `moviemate.db` to reset
- Check file permissions
- Verify SQLite compatibility

**CORS Errors:**
- Backend: port 8000
- Frontend: port 3000
- Check CORS middleware config

## 📈 Future Roadmap

- [ ] 🔐 User authentication system
- [ ] 👥 Social features and friend system
- [ ] 🎥 Real-time watch party sync
- [ ] 📱 Mobile app development
- [ ] 📤 Export/import functionality
- [ ] 📊 Advanced analytics dashboard
- [ ] 🔗 More streaming platform integrations

## 🤝 Contributing

We welcome contributions! Please:

1. 🍴 Fork the repository
2. 🌿 Create a feature branch
3. 💻 Make your changes
4. ✅ Add tests if applicable
5. 🔀 Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **The Movie Database (TMDB)** for comprehensive movie data
- **AI21 Labs** for powerful AI review generation
- **FastAPI** for excellent web framework
- **React** for modern frontend development

---

**⭐ Star this repo if you find it helpful!**

**🐛 Found a bug?** Open an issue on GitHub.

**💡 Have a feature request?** We'd love to hear your ideas!

---

*MovieMate - Organize Your Entertainment World* 🎬✨
