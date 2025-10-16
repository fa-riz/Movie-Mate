import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import "./App.css";

const API_BASE = "http://localhost:8000";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

function App() {
  // State declarations
  const [movies, setMovies] = useState([]);
  const [filter, setFilter] = useState({});
  const [stats, setStats] = useState({});
  const [showForm, setShowForm] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingMovie, setEditingMovie] = useState(null);
  const [userNotes, setUserNotes] = useState({});
  const [editingReview, setEditingReview] = useState({});
  // CHANGED: Added loading state for TMDB search
  const [searchLoading, setSearchLoading] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    director: "",
    genre: "",
    platform: "",
    status: "wishlist",
    is_tv_show: false,
    episodes_watched: 0,
    total_episodes: "",
    tmdb_id: null,
  });

  // Data fetching functions with useCallback to prevent infinite re-renders
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

  // Effects
  useEffect(() => {
    fetchMovies();
    fetchStats();
  }, [fetchMovies, fetchStats]);

  // CHANGED: Completely rewritten TMDB search function with better error handling
  const searchTMDB = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setSearchLoading(true);
      console.log(`🔍 Searching TMDB for: "${query}"`);

      const response = await axios.get(
        `${API_BASE}/tmdb/search?query=${encodeURIComponent(query)}`,
        { timeout: 100000 } // CHANGED: Added timeout to prevent hanging
      );

      if (response.data && response.data.results) {
        setSearchResults(response.data.results);
        console.log(`✅ Found ${response.data.results.length} results`);
      } else {
        setSearchResults([]);
        console.log("❌ No results found in response");
      }
    } catch (error) {
      console.error("Error searching TMDB:", error);
      setSearchResults([]);
      // CHANGED: Show user-friendly error message
      if (error.code === "ECONNABORTED") {
        alert("TMDB search timed out. The service might be unavailable.");
      } else {
        alert(
          "TMDB search is currently unavailable. Please add movies manually."
        );
      }
    } finally {
      setSearchLoading(false);
    }
  };

  // CHANGED: Improved TMDB selection with fallback data
  const selectFromTMDB = async (item) => {
    try {
      console.log(`🎬 Selected: ${item.title} (${item.media_type})`);

      // CHANGED: Use direct data from search results instead of making another API call
      // This avoids the hanging issue with TMDB details endpoint
      const movieData = {
        title: item.title,
        director:
          item.media_type === "tv" ? "Various Directors" : "Unknown Director",
        genre: "Unknown Genre", // CHANGED: Default value to avoid empty fields
        platform: "", // User will fill this
        status: "wishlist",
        is_tv_show: item.media_type === "tv",
        episodes_watched: 0,
        total_episodes:
          item.media_type === "tv" ? item.total_episodes || 1 : null,
        tmdb_id: item.id,
        poster_path: item.poster_path,
        overview: item.overview || "No description available.",
        release_date: item.release_date || "Unknown",
      };

      setFormData(movieData);

      setShowSearch(false);
      setSearchResults([]);
      setSearchQuery("");

      console.log(`✅ Form populated with: ${item.title}`);
    } catch (error) {
      console.error("Error selecting TMDB item:", error);
      alert("Error loading movie details. Please try again or add manually.");
    }
  };

  // CHANGED: Added debounced search to prevent too many API calls
  useEffect(() => {
    if (searchQuery.trim()) {
      const timeoutId = setTimeout(() => {
        searchTMDB(searchQuery);
      }, 500); // Wait 500ms after user stops typing

      return () => clearTimeout(timeoutId);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  // Form handling
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        total_episodes: formData.is_tv_show
          ? parseInt(formData.total_episodes) || 1
          : null,
        tmdb_id: formData.tmdb_id || null,
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
      alert("Error saving movie. Please check your connection and try again.");
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
      tmdb_id: null,
    });
    setEditingMovie(null);
    setShowForm(false);
    setShowSearch(false);
    setSearchResults([]);
    setSearchQuery("");
    setSearchLoading(false); // CHANGED: Reset loading state
  };

  // Movie actions (unchanged)
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

  // Rating and review functions (unchanged)
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

  // Get unique values for filters
  const genres = [...new Set(movies.map((m) => m.genre).filter(Boolean))];
  const platforms = [...new Set(movies.map((m) => m.platform).filter(Boolean))];

  return (
    <div className="App">
      {/* Header */}
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

      {/* CHANGED: Completely rewritten TMDB Search Modal with better UX */}
      <button className="tmdb-search-btn" onClick={() => setShowSearch(true)}>
        🔍 Search TMDB for Movie/TV Show
      </button>
      {showSearch && (
        <div className="modal">
          <div className="modal-content">
            <h2>Search TMDB</h2>
            <div className="search-container">
              <input
                type="text"
                placeholder="Search for movies or TV shows..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  // CHANGED: Removed direct API call - now handled by useEffect debounce
                }}
                className="search-input"
              />
              <button onClick={() => setShowSearch(false)}>Cancel</button>
            </div>

            <div className="search-results">
              {/* CHANGED: Added loading state */}
              {searchLoading ? (
                <div className="search-loading">
                  <p>Searching TMDB...</p>
                </div>
              ) : searchResults.length > 0 ? (
                searchResults.map((item) => (
                  <div
                    key={item.id}
                    className="search-result-item"
                    onClick={() => selectFromTMDB(item)}
                  >
                    {/* CHANGED: Added fallback for missing posters */}
                    {item.poster_path ? (
                      <img
                        src={`${TMDB_IMAGE_BASE}${item.poster_path}`}
                        alt={item.title}
                        onError={(e) => {
                          e.target.style.display = "none";
                          e.target.nextSibling.style.display = "flex";
                        }}
                      />
                    ) : null}
                    <div
                      className="poster-placeholder"
                      style={{ display: item.poster_path ? "none" : "flex" }}
                    >
                      No Image
                    </div>
                    <div className="search-result-info">
                      <h4>{item.title}</h4>
                      <p>
                        {item.release_date?.split("-")[0] || "Unknown year"} •{" "}
                        {item.media_type === "movie" ? "MOVIE" : "TV SHOW"}
                      </p>
                      {/* CHANGED: Added rating display */}
                      {item.vote_average && (
                        <p className="rating">⭐ {item.vote_average}/10</p>
                      )}
                      <p className="overview">
                        {item.overview?.substring(0, 100) ||
                          "No description available."}
                        ...
                      </p>
                    </div>
                  </div>
                ))
              ) : searchQuery ? (
                <div className="empty-state">
                  <p>
                    No results found for "{searchQuery}". Try a different
                    search.
                  </p>
                </div>
              ) : (
                <div className="empty-state">
                  <p>Enter a movie or TV show name to search</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="modal">
          <div className="modal-content">
            <h2>{editingMovie ? "Edit" : "Add"} Content</h2>

            <p style={{ textAlign: "center", margin: "10px 0", color: "#666" }}>
              Or fill manually:
            </p>

            <form onSubmit={handleSubmit}>
              <input
                type="text"
                placeholder="Title *"
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
              />

              <input
                type="text"
                placeholder="Genre"
                value={formData.genre}
                onChange={(e) =>
                  setFormData({ ...formData, genre: e.target.value })
                }
              />

              <input
                type="text"
                placeholder="Platform (Netflix, Prime, etc.)"
                value={formData.platform}
                onChange={(e) =>
                  setFormData({ ...formData, platform: e.target.value })
                }
              />

              <label>
                <input
                  type="checkbox"
                  checked={formData.is_tv_show}
                  onChange={(e) =>
                    setFormData({ ...formData, is_tv_show: e.target.checked })
                  }
                />
                This is a TV Show
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
                        episodes_watched: parseInt(e.target.value) || 0,
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

      {/* Movies Grid (unchanged) */}
      <div className="movies-grid">
        {movies.length > 0 ? (
          movies.map((movie) => (
            <div key={movie.id} className="movie-card">
              {movie.poster_path && (
                <img
                  src={`${TMDB_IMAGE_BASE}${movie.poster_path}`}
                  alt={movie.title}
                  className="movie-poster"
                />
              )}
              <div className="movie-content">
                <div className="movie-header">
                  <h3>{movie.title}</h3>
                  <span className={`status-badge ${movie.status}`}>
                    {movie.status}
                  </span>
                </div>

                <div className="movie-details">
                  <p>
                    <strong>Director:</strong>{" "}
                    {movie.director || "Not specified"}
                  </p>
                  <p>
                    <strong>Genre:</strong> {movie.genre || "Not specified"}
                  </p>
                  <p>
                    <strong>Platform:</strong>{" "}
                    {movie.platform || "Not specified"}
                  </p>
                  {movie.release_date && (
                    <p>
                      <strong>Released:</strong> {movie.release_date}
                    </p>
                  )}
                  {movie.is_tv_show && (
                    <div>
                      <p>
                        <strong>Progress:</strong> {movie.episodes_watched}/
                        {movie.total_episodes} episodes
                      </p>
                      {movie.total_episodes && (
                        <div className="progress-bar">
                          <div
                            className="progress-fill"
                            style={{
                              width: `${
                                (movie.episodes_watched /
                                  movie.total_episodes) *
                                100
                              }%`,
                            }}
                          ></div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {movie.overview && (
                  <div className="movie-overview">
                    <p>{movie.overview}</p>
                  </div>
                )}

                {/* Rating Section */}
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

                {/* Review Section */}
                <div className="review-section">
                  <strong>Review:</strong>
                  {editingReview[movie.id] !== undefined ? (
                    <div className="review-edit">
                      <textarea
                        value={editingReview[movie.id]}
                        onChange={(e) =>
                          handleReviewChange(movie.id, e.target.value)
                        }
                        placeholder="Write your review..."
                        rows="3"
                      />
                      <div className="review-edit-buttons">
                        <button onClick={() => saveReview(movie.id)}>
                          Save
                        </button>
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
                        className="edit-review-btn"
                      >
                        ✏️
                      </button>
                    </div>
                  )}
                </div>

                {/* AI Review Section */}
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
                      className="notes-input"
                    />
                    <button onClick={() => generateAIReview(movie)}>
                      🪄 AI Review
                    </button>
                  </div>
                )}

                <div className="movie-actions">
                  <select
                    value={movie.status}
                    onChange={(e) => handleUpdateStatus(movie, e.target.value)}
                  >
                    <option value="wishlist">Wishlist</option>
                    <option value="watching">Watching</option>
                    <option value="completed">Completed</option>
                  </select>

                  {movie.is_tv_show &&
                    movie.status === "watching" &&
                    movie.total_episodes && (
                      <button
                        onClick={() => {
                          const newEpisodes = movie.episodes_watched + 1;
                          const isCompleted =
                            newEpisodes >= movie.total_episodes;
                          axios
                            .put(`${API_BASE}/movies/${movie.id}`, {
                              episodes_watched: newEpisodes,
                              status: isCompleted ? "completed" : "watching",
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
            </div>
          ))
        ) : (
          <div className="empty-state">
            <h3>No movies yet</h3>
            <p>Add your first movie or TV show to get started!</p>
            <button className="add-btn" onClick={() => setShowForm(true)}>
              + Add Your First Movie
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
