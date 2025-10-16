import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import "./App.css";

const API_BASE = "http://localhost:8000";

function App() {
  const [movies, setMovies] = useState([]);
  const [filter, setFilter] = useState({});
  const [stats, setStats] = useState({});
  const [showForm, setShowForm] = useState(false);
  const [editingMovie, setEditingMovie] = useState(null);
  const [userNotes, setUserNotes] = useState({});
  const [editingReview, setEditingReview] = useState({});

  const [formData, setFormData] = useState({
    title: "",
    director: "",
    genre: "",
    platform: "",
    status: "wishlist",
    is_tv_show: false,
    episodes_watched: 0,
    total_episodes: "",
  });

  // ===== Fetch Functions with useCallback =====
  const fetchMovies = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      Object.keys(filter).forEach((key) => {
        if (filter[key]) params.append(key, filter[key]);
      });
      const response = await axios.get(`${API_BASE}/movies?${params}`);
      setMovies(response.data);
    } catch (error) {
      console.error("Error fetching movies:", error);
    }
  }, [filter]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE}/stats`);
      setStats(response.data);
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  }, []);

  // ===== useEffect =====
  useEffect(() => {
    fetchMovies();
    fetchStats();
  }, [fetchMovies, fetchStats]);

  // ===== Form Handlers =====
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        total_episodes: formData.is_tv_show
          ? parseInt(formData.total_episodes)
          : null,
      };

      if (editingMovie) {
        await axios.put(`${API_BASE}/movies/${editingMovie.id}`, data);
      } else {
        await axios.post(`${API_BASE}/movies`, data);
      }

      resetForm();
      fetchMovies();
      fetchStats();
    } catch (error) {
      console.error("Error saving movie:", error);
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      director: "",
      genre: "",
      platform: "",
      status: "wishlist",
      is_tv_show: false,
      episodes_watched: 0,
      total_episodes: "",
    });
    setEditingMovie(null);
    setShowForm(false);
  };

  // ===== CRUD Handlers =====
  const handleDelete = async (id) => {
    try {
      await axios.delete(`${API_BASE}/movies/${id}`);
      fetchMovies();
      fetchStats();
    } catch (error) {
      console.error("Error deleting movie:", error);
    }
  };

  const handleUpdateStatus = async (movie, newStatus) => {
    try {
      await axios.put(`${API_BASE}/movies/${movie.id}`, { status: newStatus });
      fetchMovies();
      fetchStats();
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const updateRatingReview = async (movieId, rating, review) => {
    try {
      await axios.put(`${API_BASE}/movies/${movieId}/rating-review`, {
        rating: rating,
        review: review,
      });
      fetchMovies();
      fetchStats();
    } catch (error) {
      console.error("Error updating rating/review:", error);
      alert("Error updating rating/review. Rating must be 0-10.");
    }
  };

  const generateAIReview = async (movie) => {
    try {
      const notes = userNotes[movie.id] || "";
      const response = await axios.post(
        `${API_BASE}/movies/${movie.id}/generate-review`,
        { user_notes: notes }
      );
      await updateRatingReview(movie.id, movie.rating, response.data.review);
      setUserNotes((prev) => ({ ...prev, [movie.id]: "" }));
    } catch (error) {
      console.error("Error generating AI review:", error);
    }
  };

  const handleRatingChange = (movieId, newRating) => {
    updateRatingReview(
      movieId,
      newRating,
      movies.find((m) => m.id === movieId)?.review
    );
  };

  const handleReviewChange = (movieId, newReview) => {
    setEditingReview((prev) => ({ ...prev, [movieId]: newReview }));
  };

  const saveReview = (movieId) => {
    const review = editingReview[movieId];
    if (review !== undefined) {
      updateRatingReview(
        movieId,
        movies.find((m) => m.id === movieId)?.rating,
        review
      );
      setEditingReview((prev) => ({ ...prev, [movieId]: undefined }));
    }
  };

  const genres = [...new Set(movies.map((m) => m.genre))];
  const platforms = [...new Set(movies.map((m) => m.platform))];

  return (
    <div className="App">
      <header className="app-header">
        <h1>🎬 MovieMate</h1>
        <p>Track and manage your movie & TV show collection</p>
      </header>

      {/* Stats Dashboard */}
      <div className="stats-dashboard">
        <div className="stat-card">
          <h3>Total</h3>
          <p>{stats.total || 0}</p>
        </div>
        <div className="stat-card">
          <h3>Completed</h3>
          <p>{stats.completed || 0}</p>
        </div>
        <div className="stat-card">
          <h3>Watching</h3>
          <p>{stats.watching || 0}</p>
        </div>
        <div className="stat-card">
          <h3>Wishlist</h3>
          <p>{stats.wishlist || 0}</p>
        </div>
        <div className="stat-card">
          <h3>Avg Rating</h3>
          <p>⭐ {stats.average_rating || "0.0"}/10</p>
        </div>
      </div>

      {/* Filters and Add Button */}
      <div className="filters">
        <select
          onChange={(e) => setFilter({ ...filter, genre: e.target.value })}
        >
          <option value="">All Genres</option>
          {genres.map((genre) => (
            <option key={genre} value={genre}>
              {genre}
            </option>
          ))}
        </select>

        <select
          onChange={(e) => setFilter({ ...filter, platform: e.target.value })}
        >
          <option value="">All Platforms</option>
          {platforms.map((platform) => (
            <option key={platform} value={platform}>
              {platform}
            </option>
          ))}
        </select>

        <select
          onChange={(e) => setFilter({ ...filter, status: e.target.value })}
        >
          <option value="">All Status</option>
          <option value="watching">Watching</option>
          <option value="completed">Completed</option>
          <option value="wishlist">Wishlist</option>
        </select>

        <button className="add-btn" onClick={() => setShowForm(true)}>
          + Add Movie/TV Show
        </button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="modal">
          <div className="modal-content">
            <h2>{editingMovie ? "Edit" : "Add"} Content</h2>
            <form onSubmit={handleSubmit}>
              <input
                type="text"
                placeholder="Title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                required
              />
              <input
                type="text"
                placeholder="Director"
                value={formData.director}
                onChange={(e) =>
                  setFormData({ ...formData, director: e.target.value })
                }
                required
              />
              <input
                type="text"
                placeholder="Genre"
                value={formData.genre}
                onChange={(e) =>
                  setFormData({ ...formData, genre: e.target.value })
                }
                required
              />
              <input
                type="text"
                placeholder="Platform (Netflix, Prime, etc.)"
                value={formData.platform}
                onChange={(e) =>
                  setFormData({ ...formData, platform: e.target.value })
                }
                required
              />

              <label>
                <input
                  type="checkbox"
                  checked={formData.is_tv_show}
                  onChange={(e) =>
                    setFormData({ ...formData, is_tv_show: e.target.checked })
                  }
                />
                TV Show
              </label>

              {formData.is_tv_show && (
                <div className="tv-show-fields">
                  <input
                    type="number"
                    placeholder="Episodes Watched"
                    value={formData.episodes_watched}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        episodes_watched: parseInt(e.target.value),
                      })
                    }
                  />
                  <input
                    type="number"
                    placeholder="Total Episodes"
                    value={formData.total_episodes}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        total_episodes: e.target.value,
                      })
                    }
                  />
                </div>
              )}

              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value })
                }
              >
                <option value="wishlist">Wishlist</option>
                <option value="watching">Watching</option>
                <option value="completed">Completed</option>
              </select>

              <div className="form-actions">
                <button type="submit">{editingMovie ? "Update" : "Add"}</button>
                <button type="button" onClick={resetForm}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Movies Grid */}
      <div className="movies-grid">
        {movies.map((movie) => (
          <div key={movie.id} className="movie-card">
            <div className="movie-header">
              <h3>{movie.title}</h3>
              <span className={`status-badge ${movie.status}`}>
                {movie.status}
              </span>
            </div>

            <div className="movie-details">
              <p>
                <strong>Director:</strong> {movie.director}
              </p>
              <p>
                <strong>Genre:</strong> {movie.genre}
              </p>
              <p>
                <strong>Platform:</strong> {movie.platform}
              </p>
              {movie.is_tv_show && (
                <p>
                  <strong>Progress:</strong> {movie.episodes_watched}/
                  {movie.total_episodes} episodes
                </p>
              )}

              {/* Rating */}
              <div className="rating-section">
                <strong>Rating: </strong>
                <select
                  value={movie.rating || ""}
                  onChange={(e) =>
                    handleRatingChange(movie.id, parseFloat(e.target.value))
                  }
                >
                  <option value="">Not rated</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                    <option key={num} value={num}>
                      {num}/10
                    </option>
                  ))}
                </select>
                {movie.rating && (
                  <span className="rating-stars">⭐ {movie.rating}/10</span>
                )}
              </div>
            </div>

            {/* Review */}
            <div className="review-section">
              <strong>Review:</strong>
              {editingReview[movie.id] !== undefined ? (
                <div className="review-edit">
                  <textarea
                    value={editingReview[movie.id]}
                    onChange={(e) =>
                      handleReviewChange(movie.id, e.target.value)
                    }
                    rows="3"
                    placeholder="Write your review..."
                  />
                  <button onClick={() => saveReview(movie.id)}>Save</button>
                  <button
                    onClick={() =>
                      setEditingReview((prev) => ({
                        ...prev,
                        [movie.id]: undefined,
                      }))
                    }
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="review-display">
                  <p>{movie.review || "No review yet"}</p>
                  <button
                    onClick={() =>
                      setEditingReview((prev) => ({
                        ...prev,
                        [movie.id]: movie.review || "",
                      }))
                    }
                  >
                    ✏️
                  </button>
                </div>
              )}
            </div>

            <div className="movie-actions">
              <select
                value={movie.status}
                onChange={(e) => handleUpdateStatus(movie, e.target.value)}
              >
                <option value="wishlist">Wishlist</option>
                <option value="watching">Watching</option>
                <option value="completed">Completed</option>
              </select>

              {movie.status === "completed" && (
                <div className="ai-review-section">
                  <input
                    type="text"
                    placeholder="Add notes for AI review..."
                    value={userNotes[movie.id] || ""}
                    onChange={(e) =>
                      setUserNotes((prev) => ({
                        ...prev,
                        [movie.id]: e.target.value,
                      }))
                    }
                  />
                  <button onClick={() => generateAIReview(movie)}>
                    🪄 AI Review
                  </button>
                </div>
              )}

              {movie.is_tv_show && movie.status === "watching" && (
                <button
                  onClick={() => {
                    const newEpisodes = movie.episodes_watched + 1;
                    axios
                      .put(`${API_BASE}/movies/${movie.id}`, {
                        episodes_watched: newEpisodes,
                        status:
                          newEpisodes >= movie.total_episodes
                            ? "completed"
                            : "watching",
                      })
                      .then(fetchMovies);
                  }}
                >
                  +1 Episode
                </button>
              )}

              <button
                onClick={() => handleDelete(movie.id)}
                className="delete-btn"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
