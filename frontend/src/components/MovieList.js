import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import Header from "./Header";
import { API_BASE, TMDB_IMAGE_BASE } from "../utils/constants";
import "./MovieList.css";

function MovieList() {
  const [movies, setMovies] = useState([]);
  const [filter, setFilter] = useState({});
  const [stats, setStats] = useState({});
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [recommendationLoading, setRecommendationLoading] = useState(false);
  const [recommendationError, setRecommendationError] = useState("");
  const [recommendationInfo, setRecommendationInfo] = useState({});
  const [addingMovie, setAddingMovie] = useState(null);
  const [deletingMovie, setDeletingMovie] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [updatingMovie, setUpdatingMovie] = useState(null);
  const navigate = useNavigate();

  // Fetch movies and stats
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

  useEffect(() => {
    fetchMovies();
    fetchStats();
  }, [fetchMovies, fetchStats]);

  // Get genre-based recommendations
  const fetchRecommendations = async () => {
    try {
      setRecommendationLoading(true);
      setRecommendationError("");
      setShowRecommendations(true);

      const response = await axios.get(
        `${API_BASE}/recommendations?max_results=12`
      );

      setRecommendations(response.data.recommendations);
      setRecommendationInfo({
        basedOn: response.data.based_on,
        message: response.data.message,
      });
    } catch (error) {
      console.error("Error fetching recommendations:", error);
      setRecommendationError(
        "Failed to load recommendations. Please try again."
      );

      // Try fallback recommendations
      try {
        const fallbackResponse = await axios.get(
          `${API_BASE}/recommendations/fallback?max_results=8`
        );
        setRecommendations(fallbackResponse.data.recommendations);
        setRecommendationInfo({
          basedOn: fallbackResponse.data.based_on,
          message: fallbackResponse.data.message,
        });
      } catch (fallbackError) {
        setRecommendationError("Could not load recommendations at this time.");
      }
    } finally {
      setRecommendationLoading(false);
    }
  };

  // Add movie from recommendations
  const addFromRecommendation = async (
    item,
    platform = "",
    status = "wishlist"
  ) => {
    try {
      setAddingMovie(item.id);

      // Validate platform
      if (!platform.trim()) {
        alert("Please specify a platform (Netflix, Prime, Disney+, etc.)");
        setAddingMovie(null);
        return;
      }

      const addData = {
        tmdb_id: item.id,
        platform: platform.trim(),
        status: status,
        is_tv_show: item.is_tv_show || item.media_type === "tv",
      };

      await axios.post(`${API_BASE}/movies/tmdb/add`, addData);

      // Update recommendations to mark as added
      setRecommendations((prev) =>
        prev.map((rec) =>
          rec.id === item.id
            ? { ...rec, already_added: true, existing_status: status }
            : rec
        )
      );

      // Refresh movies and stats
      fetchMovies();
      fetchStats();

      alert(`"${item.title}" added to your collection!`);
    } catch (error) {
      console.error("Error adding movie:", error);
      if (error.response?.status === 400) {
        alert("This movie is already in your collection!");
      } else {
        alert("Error adding movie. Please try again.");
      }
    } finally {
      setAddingMovie(null);
    }
  };

  // Delete movie
  const deleteMovie = async (movieId, movieTitle) => {
    try {
      setDeletingMovie(movieId);

      await axios.delete(`${API_BASE}/movies/${movieId}`);

      // Remove movie from local state
      setMovies((prev) => prev.filter((movie) => movie.id !== movieId));
      setShowDeleteConfirm(null);

      // Refresh stats
      fetchStats();

      alert(`"${movieTitle}" has been deleted from your collection!`);
    } catch (error) {
      console.error("Error deleting movie:", error);
      alert("Failed to delete movie. Please try again.");
    } finally {
      setDeletingMovie(null);
    }
  };

  // Update movie status
  const updateMovieStatus = async (movieId, newStatus) => {
    try {
      setUpdatingMovie(movieId);

      const updateData = {
        status: newStatus,
      };

      const response = await axios.put(
        `${API_BASE}/movies/${movieId}`,
        updateData
      );

      // Update local state
      setMovies((prev) =>
        prev.map((movie) =>
          movie.id === movieId ? { ...movie, ...response.data } : movie
        )
      );

      // Refresh stats
      fetchStats();

      alert(`Status updated to ${newStatus}!`);
    } catch (error) {
      console.error("Error updating movie status:", error);
      alert("Failed to update status. Please try again.");
    } finally {
      setUpdatingMovie(null);
    }
  };

  // Update movie progress - ENHANCED with TV show specific logic
  const updateMovieProgress = async (
    movieId,
    progressType,
    customMinutes = null
  ) => {
    try {
      setUpdatingMovie(movieId);

      const movie = movies.find((m) => m.id === movieId);
      if (!movie) return;

      let updateData = {};
      const currentMinutes = movie.minutes_watched || 0;

      // Calculate total runtime based on content type
      let totalRuntime;
      if (movie.is_tv_show) {
        // For TV shows: use total_minutes if available, otherwise calculate from episodes
        totalRuntime =
          movie.total_minutes ||
          (movie.total_episodes ? movie.total_episodes * 20 : 240);
      } else {
        // For movies: use total_minutes if available, otherwise default to 120
        totalRuntime = movie.total_minutes || 120;
      }

      if (progressType === "increment") {
        let minutesToAdd;
        if (movie.is_tv_show) {
          // TV shows: always add 20 minutes (one episode equivalent)
          minutesToAdd = 20;
        } else {
          // Movies: use custom minutes or default to 15
          minutesToAdd = customMinutes || 15;
        }

        const newMinutes = currentMinutes + minutesToAdd;
        updateData = {
          minutes_watched: newMinutes,
          status: newMinutes >= totalRuntime ? "completed" : "watching",
        };
      } else if (progressType === "complete") {
        updateData = {
          minutes_watched: totalRuntime,
          status: "completed",
        };
      } else if (progressType === "reset") {
        updateData = {
          minutes_watched: 0,
          status: "wishlist",
        };
      } else if (progressType === "custom") {
        updateData = {
          minutes_watched: customMinutes,
          status: customMinutes >= totalRuntime ? "completed" : "watching",
        };
      }

      const response = await axios.put(
        `${API_BASE}/movies/${movieId}`,
        updateData
      );

      // Update local state
      setMovies((prev) =>
        prev.map((movie) =>
          movie.id === movieId ? { ...movie, ...response.data } : movie
        )
      );

      // Refresh stats
      fetchStats();

      if (progressType === "complete") {
        alert(`"${movie.title}" marked as completed!`);
      } else if (progressType === "reset") {
        alert(`Progress reset for "${movie.title}"!`);
      }
    } catch (error) {
      console.error("Error updating movie progress:", error);
      alert("Failed to update progress. Please try again.");
    } finally {
      setUpdatingMovie(null);
    }
  };

  // Increment episodes watched for TV shows
  const incrementEpisode = async (movieId) => {
    try {
      setUpdatingMovie(movieId);

      const movie = movies.find((m) => m.id === movieId);
      if (!movie) return;

      const newEpisodes = (movie.episodes_watched || 0) + 1;
      const isCompleted =
        movie.total_episodes && newEpisodes >= movie.total_episodes;

      const updateData = {
        episodes_watched: newEpisodes,
        status: isCompleted ? "completed" : "watching",
      };

      const response = await axios.put(
        `${API_BASE}/movies/${movieId}`,
        updateData
      );

      // Update local state
      setMovies((prev) =>
        prev.map((movie) =>
          movie.id === movieId ? { ...movie, ...response.data } : movie
        )
      );

      // Refresh stats
      fetchStats();
    } catch (error) {
      console.error("Error updating episodes:", error);
      alert("Failed to update episode count. Please try again.");
    } finally {
      setUpdatingMovie(null);
    }
  };

  // Decrement episodes watched for TV shows
  const decrementEpisode = async (movieId) => {
    try {
      setUpdatingMovie(movieId);

      const movie = movies.find((m) => m.id === movieId);
      if (!movie || !movie.episodes_watched || movie.episodes_watched <= 0)
        return;

      const newEpisodes = Math.max(0, (movie.episodes_watched || 0) - 1);
      const newStatus = newEpisodes === 0 ? "wishlist" : "watching";

      const updateData = {
        episodes_watched: newEpisodes,
        status: newStatus,
      };

      const response = await axios.put(
        `${API_BASE}/movies/${movieId}`,
        updateData
      );

      // Update local state
      setMovies((prev) =>
        prev.map((movie) =>
          movie.id === movieId ? { ...movie, ...response.data } : movie
        )
      );

      // Refresh stats
      fetchStats();
    } catch (error) {
      console.error("Error updating episodes:", error);
      alert("Failed to update episode count. Please try again.");
    } finally {
      setUpdatingMovie(null);
    }
  };

  // Quick status update buttons
  const QuickStatusButtons = ({ movie }) => (
    <div className="quick-status-buttons">
      {movie.status !== "wishlist" && (
        <button
          onClick={() => updateMovieStatus(movie.id, "wishlist")}
          className="btn-status wishlist"
          disabled={updatingMovie === movie.id}
          title="Move to Wishlist"
        >
          ⭐
        </button>
      )}
      {movie.status !== "watching" && (
        <button
          onClick={() => updateMovieStatus(movie.id, "watching")}
          className="btn-status watching"
          disabled={updatingMovie === movie.id}
          title="Mark as Watching"
        >
          ▶️
        </button>
      )}
      {movie.status !== "completed" && (
        <button
          onClick={() => updateMovieStatus(movie.id, "completed")}
          className="btn-status completed"
          disabled={updatingMovie === movie.id}
          title="Mark as Completed"
        >
          ✅
        </button>
      )}
    </div>
  );

  // Movie Progress Controls - ENHANCED with TV show specific logic
  const MovieProgressControls = ({ movie }) => {
    // Calculate total runtime based on content type
    let totalRuntime;
    let runtimeDescription;

    if (movie.is_tv_show) {
      // For TV shows: use total_minutes if available, otherwise calculate from episodes
      if (movie.total_minutes) {
        totalRuntime = movie.total_minutes;
        runtimeDescription = `${totalRuntime} minutes (${Math.ceil(
          totalRuntime / 20
        )} episodes)`;
      } else if (movie.total_episodes) {
        totalRuntime = movie.total_episodes * 20;
        runtimeDescription = `${totalRuntime} minutes (${movie.total_episodes} episodes)`;
      } else {
        totalRuntime = 240; // Default fallback
        runtimeDescription = `${totalRuntime} minutes (estimated)`;
      }
    } else {
      // For movies: use total_minutes if available, otherwise default to 120
      totalRuntime = movie.total_minutes || 120;
      runtimeDescription = `${totalRuntime} minutes`;
    }

    const currentMinutes = movie.minutes_watched || 0;
    const completionPercentage = Math.min(
      100,
      (currentMinutes / totalRuntime) * 100
    );

    return (
      <div className="movie-progress-section">
        <div className="progress-bar-container">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{
                width: `${completionPercentage}%`,
              }}
            ></div>
          </div>
          <div className="progress-text">
            {currentMinutes} / {runtimeDescription} (
            {Math.round(completionPercentage)}%)
          </div>
        </div>

        <div className="progress-controls">
          {movie.is_tv_show ? (
            // TV SHOW SPECIFIC CONTROLS - Only +20 minutes
            <>
              <button
                onClick={() => updateMovieProgress(movie.id, "increment")}
                className="btn btn-success btn-small"
                disabled={updatingMovie === movie.id}
                title="Add 20 minutes (one episode)"
              >
                +20 min
              </button>
              <button
                onClick={() => updateMovieProgress(movie.id, "complete")}
                className="btn btn-primary btn-small"
                disabled={updatingMovie === movie.id}
              >
                ✅ Complete
              </button>
            </>
          ) : (
            // MOVIE CONTROLS - Multiple increment options
            <>
              <button
                onClick={() => updateMovieProgress(movie.id, "increment")}
                className="btn btn-success btn-small"
                disabled={updatingMovie === movie.id}
              >
                +15 min
              </button>
              <button
                onClick={() => updateMovieProgress(movie.id, "increment", 30)}
                className="btn btn-success btn-small"
                disabled={updatingMovie === movie.id}
              >
                +30 min
              </button>
              <button
                onClick={() => updateMovieProgress(movie.id, "complete")}
                className="btn btn-primary btn-small"
                disabled={updatingMovie === movie.id}
              >
                ✅ Complete
              </button>
            </>
          )}

          {(movie.status === "completed" || movie.status === "watching") && (
            <button
              onClick={() => updateMovieProgress(movie.id, "reset")}
              className="btn btn-secondary btn-small"
              disabled={updatingMovie === movie.id}
            >
              🔄 Reset
            </button>
          )}
        </div>

        <div className="custom-progress">
          <input
            type="number"
            placeholder="Custom minutes"
            className="form-control xsmall"
            onKeyPress={(e) => {
              if (e.key === "Enter") {
                const minutes = parseInt(e.target.value);
                if (minutes >= 0 && minutes <= totalRuntime) {
                  updateMovieProgress(movie.id, "custom", minutes);
                  e.target.value = "";
                }
              }
            }}
          />
        </div>
      </div>
    );
  };

  // TV Show Episode Controls
  const TVShowEpisodeControls = ({ movie }) => {
    if (!movie.is_tv_show || !movie.total_episodes) return null;

    const currentEpisodes = movie.episodes_watched || 0;
    const episodePercentage = Math.min(
      100,
      (currentEpisodes / movie.total_episodes) * 100
    );

    return (
      <div className="tv-show-episode-controls">
        <div className="progress-bar-container">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{
                width: `${episodePercentage}%`,
              }}
            ></div>
          </div>
          <div className="progress-text">
            {currentEpisodes} / {movie.total_episodes} episodes (
            {Math.round(episodePercentage)}%)
          </div>
        </div>

        <div className="episode-controls">
          <button
            onClick={() => decrementEpisode(movie.id)}
            className="btn btn-secondary btn-small episode-btn"
            disabled={
              updatingMovie === movie.id ||
              !movie.episodes_watched ||
              movie.episodes_watched <= 0
            }
          >
            -1 Episode
          </button>
          <button
            onClick={() => incrementEpisode(movie.id)}
            className="btn btn-success btn-small episode-btn"
            disabled={
              updatingMovie === movie.id ||
              (movie.total_episodes && currentEpisodes >= movie.total_episodes)
            }
          >
            +1 Episode
          </button>
        </div>
      </div>
    );
  };

  // FIXED: Quick Add Form Component for Recommendations with unique IDs
  const RecommendationAddForm = ({ item, onAdd, isAdding }) => {
    const [platform, setPlatform] = useState("");
    const [status, setStatus] = useState("wishlist");

    const handleAdd = () => {
      if (!platform.trim()) {
        alert("Please specify a platform (Netflix, Prime, Disney+, etc.)");
        return;
      }
      onAdd(item, platform, status);
    };

    return (
      <div className="recommendation-add-form">
        <div className="quick-add-fields">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="form-control small"
          >
            <option value="wishlist">Wishlist</option>
            <option value="watching">Watching</option>
            <option value="completed">Completed</option>
          </select>
          <input
            type="text"
            placeholder="Platform (Netflix, Prime, etc.)"
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="form-control small"
            required
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={isAdding}
          className="btn btn-success btn-small"
        >
          {isAdding ? "Adding..." : "Add"}
        </button>
      </div>
    );
  };

  // Delete Confirmation Modal
  const DeleteConfirmationModal = ({
    movie,
    onConfirm,
    onCancel,
    isDeleting,
  }) => (
    <div className="modal delete-confirm-modal">
      <div className="modal-content small">
        <div className="modal-header">
          <h3>Confirm Delete</h3>
          <button onClick={onCancel} className="close-btn">
            ×
          </button>
        </div>
        <div className="modal-body">
          <p>
            Are you sure you want to delete <strong>"{movie.title}"</strong>{" "}
            from your collection?
          </p>
          <p className="warning-text">This action cannot be undone.</p>
        </div>
        <div className="modal-actions">
          <button
            onClick={onCancel}
            className="btn btn-secondary"
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(movie.id, movie.title)}
            className="btn btn-danger"
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Yes, Delete"}
          </button>
        </div>
      </div>
    </div>
  );

  // Get unique platforms for filter
  const platforms = [...new Set(movies.map((m) => m.platform).filter(Boolean))];

  // Analyze user's genres for the recommendation button
  const getUserGenres = () => {
    const genreStats = {};
    movies.forEach((movie) => {
      if (movie.genre && movie.genre !== "Not specified") {
        const genres = movie.genre.split(",").map((g) => g.trim());
        genres.forEach((genre) => {
          genreStats[genre] = (genreStats[genre] || 0) + 1;
        });
      }
    });

    const topGenres = Object.entries(genreStats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([genre]) => genre);

    return topGenres;
  };

  const topGenres = getUserGenres();
  const hasMovies = movies.length > 0;

  return (
    <div className="movie-list">
      <Header
        title="MovieMate"
        subtitle="Track and manage your movie & TV show collection"
        currentPage="home"
      />

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

      {/* Action Buttons */}
      <div className="action-buttons">
        <button className="btn btn-primary" onClick={() => navigate("/search")}>
          🔍 Search & Add from TMDB
        </button>

        <button
          className="btn btn-recommendation"
          onClick={fetchRecommendations}
          disabled={recommendationLoading}
          title={
            hasMovies
              ? `Get recommendations based on your favorite genres${
                  topGenres.length > 0 ? `: ${topGenres.join(", ")}` : ""
                }`
              : "Add movies to get personalized recommendations"
          }
        >
          {recommendationLoading ? (
            "🔄 Getting Recommendations..."
          ) : hasMovies ? (
            <>
              🎬 Get Genre Recommendations
              {topGenres.length > 0 && (
                <span className="genre-badge">{topGenres[0]}</span>
              )}
            </>
          ) : (
            "🎬 Get Popular Recommendations"
          )}
        </button>

        <Link to="/add-manual" className="btn btn-secondary">
          ➕ Add Manually
        </Link>
        <Link to="/stats" className="btn btn-secondary">
          📊 View Statistics
        </Link>
      </div>

      {/* Platform Filter */}
      <div className="filters">
        <select
          onChange={(e) => setFilter({ ...filter, platform: e.target.value })}
          className="form-control"
        >
          <option value="">All Platforms</option>
          {platforms.map((platform) => (
            <option key={platform} value={platform}>
              {platform}
            </option>
          ))}
        </select>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <DeleteConfirmationModal
          movie={showDeleteConfirm}
          onConfirm={deleteMovie}
          onCancel={() => setShowDeleteConfirm(null)}
          isDeleting={deletingMovie === showDeleteConfirm.id}
        />
      )}

      {/* Recommendations Modal */}
      {showRecommendations && (
        <div className="modal">
          <div className="modal-content xlarge">
            <div className="modal-header">
              <h2>🎭 Genre-Based Recommendations</h2>
              <button
                onClick={() => {
                  setShowRecommendations(false);
                  setRecommendations([]);
                  setRecommendationError("");
                }}
                className="close-btn"
              >
                ×
              </button>
            </div>

            <div className="recommendations-content">
              {recommendationLoading ? (
                <div className="loading">
                  <div>
                    🎭 Analyzing your favorite genres and finding
                    recommendations...
                  </div>
                </div>
              ) : recommendationError ? (
                <div className="error-message">⚠️ {recommendationError}</div>
              ) : (
                <>
                  {/* Recommendation Info */}
                  <div className="recommendation-info">
                    <p className="recommendation-message">
                      {recommendationInfo.message}
                    </p>
                    {recommendationInfo.basedOn &&
                      recommendationInfo.basedOn.length > 0 && (
                        <div className="recommendation-reasons">
                          <strong>Based on:</strong>
                          <ul>
                            {recommendationInfo.basedOn.map((reason, index) => (
                              <li key={index}>• {reason}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                  </div>

                  {/* Recommendations Grid */}
                  {recommendations.length > 0 ? (
                    <div className="recommendations-grid">
                      {recommendations.map((item) => (
                        <div key={item.id} className="recommendation-card">
                          <div className="recommendation-poster">
                            {item.poster_path ? (
                              <img
                                src={item.poster_path}
                                alt={item.title}
                                onError={(e) => {
                                  e.target.style.display = "none";
                                  e.target.nextSibling.style.display = "block";
                                }}
                              />
                            ) : (
                              <div className="poster-placeholder">No Image</div>
                            )}
                          </div>

                          <div className="recommendation-info">
                            <h4>{item.title}</h4>

                            <div className="recommendation-meta">
                              <span className="year">
                                {item.release_date?.split("-")[0] || "Unknown"}
                              </span>
                              <span className={`media-type ${item.media_type}`}>
                                {item.media_type === "movie"
                                  ? "🎬 MOVIE"
                                  : "📺 TV SHOW"}
                              </span>
                              {item.vote_average && (
                                <span className="rating">
                                  ⭐ {item.vote_average}/10
                                </span>
                              )}
                            </div>

                            {item.recommendation_reason && (
                              <div className="recommendation-reason">
                                💡 {item.recommendation_reason}
                              </div>
                            )}

                            <p className="overview">
                              {item.overview?.substring(0, 100) ||
                                "No description available."}
                              {item.overview?.length > 100 ? "..." : ""}
                            </p>

                            <div className="recommendation-actions">
                              {item.already_added ? (
                                <div className="already-added">
                                  ✅ In your collection
                                  {item.existing_status && (
                                    <span className="status">
                                      ({item.existing_status})
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <RecommendationAddForm
                                  item={item}
                                  onAdd={addFromRecommendation}
                                  isAdding={addingMovie === item.id}
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state">
                      <p>No recommendations found at the moment.</p>
                      <p className="empty-state-subtext">
                        Try adding more movies to your collection for better
                        recommendations.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Movies Grid */}
      <div className="movies-grid">
        {movies.length > 0 ? (
          movies.map((movie) => (
            <div key={movie.id} className="movie-card">
              {/* Delete Button */}
              <button
                className="delete-movie-btn"
                onClick={() => setShowDeleteConfirm(movie)}
                title={`Delete ${movie.title}`}
                disabled={deletingMovie === movie.id}
              >
                {deletingMovie === movie.id ? "🗑️..." : "🗑️"}
              </button>

              {/* Quick Status Buttons */}
              <QuickStatusButtons movie={movie} />

              {movie.poster_path && (
                <img
                  src={movie.poster_path}
                  alt={movie.title}
                  className="movie-poster"
                />
              )}
              <div className="movie-content">
                <div className="movie-header">
                  <h3 className="movie-title">{movie.title}</h3>
                  <span className={`status-badge ${movie.status}`}>
                    {movie.status === "wishlist" && "⭐ Wishlist"}
                    {movie.status === "watching" && "🎬 Watching"}
                    {movie.status === "completed" && "✅ Completed"}
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

                  {/* Content Type Badge */}
                  <p>
                    <strong>Type:</strong>{" "}
                    {movie.is_tv_show ? "📺 TV Show" : "🎬 Movie"}
                  </p>

                  {/* Progress Controls for ALL content except wishlist */}
                  {movie.status !== "wishlist" && (
                    <div className="progress-section">
                      <MovieProgressControls movie={movie} />
                    </div>
                  )}

                  {/* TV Show Episode Controls */}
                  {movie.is_tv_show && movie.total_episodes && (
                    <TVShowEpisodeControls movie={movie} />
                  )}
                </div>

                {movie.overview && (
                  <div className="movie-overview">
                    <p>{movie.overview}</p>
                  </div>
                )}

                {movie.rating && (
                  <div className="rating-section">
                    <strong>Rating:</strong> ⭐ {movie.rating}/10
                  </div>
                )}

                {movie.review && (
                  <div className="review-section">
                    <strong>Review:</strong>
                    <p>{movie.review}</p>
                  </div>
                )}

                <div className="movie-actions">
                  <Link to={`/movie/${movie.id}`} className="btn btn-primary">
                    👁️ View Details
                  </Link>
                  <button
                    onClick={() => setShowDeleteConfirm(movie)}
                    className="btn btn-danger"
                    disabled={deletingMovie === movie.id}
                  >
                    {deletingMovie === movie.id ? "Deleting..." : "🗑️ Delete"}
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">
            <h3>Your collection is empty</h3>
            <p>Start by searching TMDB to add movies to your collection</p>
            <div className="empty-state-actions">
              <button
                className="btn btn-primary"
                onClick={() => navigate("/search")}
              >
                🔍 Search TMDB
              </button>
              <button
                className="btn btn-recommendation"
                onClick={fetchRecommendations}
              >
                🎬 Get Popular Recommendations
              </button>
              <Link to="/add-manual" className="btn btn-secondary">
                ➕ Add Manually
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default MovieList;
