import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import Header from "./Header";
import { API_BASE, TMDB_IMAGE_BASE } from "../utils/constants";
import "./MovieList.css";

// Memoized Watch Party Planner Modal Component
const WatchPartyPlannerModal = React.memo(
  ({
    selectedMovie,
    friendAvailabilities,
    suggestedTimes,
    plannerLoading,
    onClose,
    onCalculateBestTimes,
    onUpdateFriend,
    onAddFriend,
    onRemoveFriend,
    onToggleAvailability,
    onScheduleParty,
  }) => {
    const timeSlots = useMemo(
      () => [
        {
          id: "weekday_evening",
          label: "Weekday Evenings",
          description: "Mon-Fri, 6-10 PM",
        },
        {
          id: "weekend_afternoon",
          label: "Weekend Afternoons",
          description: "Sat-Sun, 12-5 PM",
        },
        {
          id: "weekend_evening",
          label: "Weekend Evenings",
          description: "Sat-Sun, 6-10 PM",
        },
        {
          id: "weekday_late",
          label: "Weekday Late",
          description: "Mon-Fri, 10 PM+",
        },
        {
          id: "weekend_late",
          label: "Weekend Late",
          description: "Sat-Sun, 10 PM+",
        },
      ],
      []
    );

    return (
      <div className="modal party-planner-modal">
        <div className="modal-content large">
          <div className="modal-header">
            <h2>🎯 Watch Party Planner</h2>
            <p className="modal-subtitle">
              Find the perfect time to watch with friends
            </p>
            <button onClick={onClose} className="close-btn">
              ×
            </button>
          </div>

          <div className="party-planner-content">
            {selectedMovie && (
              <div className="selected-movie-info">
                <div className="movie-header-planner">
                  {selectedMovie.poster_path && (
                    <img
                      src={selectedMovie.poster_path}
                      alt={selectedMovie.title}
                    />
                  )}
                  <div>
                    <h3>{selectedMovie.title}</h3>
                    <p className="movie-runtime">
                      {selectedMovie.is_tv_show ? "TV Show" : "Movie"} •
                      {selectedMovie.total_minutes
                        ? ` ${Math.floor(selectedMovie.total_minutes / 60)}h ${
                            selectedMovie.total_minutes % 60
                          }m`
                        : " Runtime not specified"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="planner-sections">
              {/* Friend Availability Section */}
              <div className="planner-section">
                <h3>👥 Add Your Friends' Availability</h3>
                <p className="section-description">
                  Add friends and select when they're free to watch movies.
                </p>

                <div className="friends-list">
                  {friendAvailabilities.map((friend) => (
                    <div key={friend.id} className="friend-availability-card">
                      <div className="friend-header">
                        <input
                          type="text"
                          placeholder="Friend's name"
                          value={friend.name}
                          onChange={(e) =>
                            onUpdateFriend(friend.id, "name", e.target.value)
                          }
                          className="form-control small"
                        />
                        <select
                          value={friend.timezone}
                          onChange={(e) =>
                            onUpdateFriend(
                              friend.id,
                              "timezone",
                              e.target.value
                            )
                          }
                          className="form-control small"
                        >
                          <option value="EST">EST (Eastern)</option>
                          <option value="PST">PST (Pacific)</option>
                          <option value="CST">CST (Central)</option>
                          <option value="MST">MST (Mountain)</option>
                          <option value="GMT">GMT (UK)</option>
                          <option value="CET">CET (Europe)</option>
                        </select>
                        {friendAvailabilities.length > 1 && (
                          <button
                            onClick={() => onRemoveFriend(friend.id)}
                            className="btn btn-danger btn-small"
                            type="button"
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      <div className="availability-slots">
                        <h4>Available Time Slots:</h4>
                        <div className="time-slot-grid">
                          {timeSlots.map((slot) => (
                            <button
                              key={slot.id}
                              onClick={() =>
                                onToggleAvailability(friend.id, slot.id)
                              }
                              className={`time-slot-btn ${
                                friend.availability.includes(slot.id)
                                  ? "selected"
                                  : ""
                              }`}
                              type="button"
                            >
                              <span className="slot-label">{slot.label}</span>
                              <span className="slot-desc">
                                {slot.description}
                              </span>
                              {friend.availability.includes(slot.id) && (
                                <span className="slot-check">✓</span>
                              )}
                            </button>
                          ))}
                        </div>
                        <div className="selected-count">
                          {friend.availability.length} time slots selected
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="friend-actions">
                  <button
                    onClick={onAddFriend}
                    className="btn btn-secondary"
                    type="button"
                  >
                    + Add Another Friend
                  </button>
                  <div className="friends-count">
                    {friendAvailabilities.length} friend(s) added
                  </div>
                </div>
              </div>

              {/* Suggested Times Section */}
              <div className="planner-section">
                <h3>🕐 Best Watch Times</h3>
                <p className="section-description">
                  We'll find the perfect time based on your friends'
                  availability.
                </p>

                {plannerLoading ? (
                  <div className="loading">
                    <div className="loading-spinner"></div>
                    <div>
                      Analyzing schedules and finding the perfect time...
                    </div>
                  </div>
                ) : suggestedTimes.length > 0 ? (
                  <div className="suggested-times">
                    {suggestedTimes.map((time, index) => (
                      <div key={index} className="suggested-time-card">
                        <div className="time-header">
                          <h4>{time.time}</h4>
                          <div
                            className="confidence-badge"
                            style={{
                              backgroundColor:
                                time.confidence >= 90
                                  ? "#4CAF50"
                                  : time.confidence >= 75
                                  ? "#FF9800"
                                  : "#F44336",
                            }}
                          >
                            {time.confidence}% Match
                          </div>
                        </div>
                        <div className="time-details">
                          <p className="participants">
                            👥 {time.participants} friends available
                          </p>
                          <p className="reason">{time.reason}</p>
                        </div>
                        <button
                          onClick={() => onScheduleParty(time)}
                          className="btn btn-primary"
                          type="button"
                        >
                          🎉 Choose This Time
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="no-times-message">
                    <p>
                      👆 Add friends and their availability above, then click
                      "Find Best Times" to see suggestions.
                    </p>
                  </div>
                )}

                <div className="planner-actions">
                  <button
                    onClick={onCalculateBestTimes}
                    className="btn btn-success"
                    disabled={friendAvailabilities.length === 0}
                    type="button"
                  >
                    🔄 Find Best Times
                  </button>
                  <button
                    onClick={onClose}
                    className="btn btn-secondary"
                    type="button"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

// Memoized Delete Confirmation Modal
const DeleteConfirmationModal = React.memo(
  ({ movie, onConfirm, onCancel, isDeleting }) => (
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
  )
);

// Memoized Quick Status Buttons Component
const QuickStatusButtons = React.memo(
  ({ movie, onUpdateStatus, updatingMovie }) => (
    <div className="quick-status-buttons">
      {movie.status !== "wishlist" && (
        <button
          onClick={() => onUpdateStatus(movie.id, "wishlist")}
          className="btn-status wishlist"
          disabled={updatingMovie === movie.id}
          title="Move to Wishlist"
        >
          ⭐
        </button>
      )}
      {movie.status !== "watching" && (
        <button
          onClick={() => onUpdateStatus(movie.id, "watching")}
          className="btn-status watching"
          disabled={updatingMovie === movie.id}
          title="Mark as Watching"
        >
          ▶️
        </button>
      )}
      {movie.status !== "completed" && (
        <button
          onClick={() => onUpdateStatus(movie.id, "completed")}
          className="btn-status completed"
          disabled={updatingMovie === movie.id}
          title="Mark as Completed"
        >
          ✅
        </button>
      )}
    </div>
  )
);

// Memoized Movie Progress Controls
const MovieProgressControls = React.memo(
  ({ movie, onUpdateProgress, updatingMovie }) => {
    const totalRuntime = movie.is_tv_show
      ? movie.total_minutes ||
        (movie.total_episodes ? movie.total_episodes * 20 : 240)
      : movie.total_minutes || 120;

    const currentMinutes = movie.minutes_watched || 0;
    const completionPercentage = Math.min(
      100,
      (currentMinutes / totalRuntime) * 100
    );

    const runtimeDescription = movie.is_tv_show
      ? movie.total_episodes
        ? `${movie.total_episodes} episodes`
        : `${Math.ceil(totalRuntime / 20)} episodes`
      : `${totalRuntime} minutes`;

    return (
      <div className="movie-progress-section">
        <div className="progress-bar-container">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${completionPercentage}%` }}
            ></div>
          </div>
          <div className="progress-text">
            {currentMinutes}min / {runtimeDescription} (
            {Math.round(completionPercentage)}%)
          </div>
        </div>

        <div className="progress-controls">
          {movie.is_tv_show ? (
            <>
              <button
                onClick={() => onUpdateProgress(movie.id, "increment")}
                className="btn btn-success btn-small"
                disabled={updatingMovie === movie.id}
              >
                +20 min
              </button>
              <button
                onClick={() => onUpdateProgress(movie.id, "complete")}
                className="btn btn-primary btn-small"
                disabled={updatingMovie === movie.id}
              >
                ✅ Complete
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onUpdateProgress(movie.id, "increment")}
                className="btn btn-success btn-small"
                disabled={updatingMovie === movie.id}
              >
                +15 min
              </button>
              <button
                onClick={() => onUpdateProgress(movie.id, "increment", 30)}
                className="btn btn-success btn-small"
                disabled={updatingMovie === movie.id}
              >
                +30 min
              </button>
              <button
                onClick={() => onUpdateProgress(movie.id, "complete")}
                className="btn btn-primary btn-small"
                disabled={updatingMovie === movie.id}
              >
                ✅ Complete
              </button>
            </>
          )}

          {(movie.status === "completed" || movie.status === "watching") && (
            <button
              onClick={() => onUpdateProgress(movie.id, "reset")}
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
                  onUpdateProgress(movie.id, "custom", minutes);
                  e.target.value = "";
                }
              }
            }}
          />
        </div>
      </div>
    );
  }
);

// Memoized TV Show Episode Controls
const TVShowEpisodeControls = React.memo(
  ({ movie, onIncrementEpisode, onDecrementEpisode, updatingMovie }) => {
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
              style={{ width: `${episodePercentage}%` }}
            ></div>
          </div>
          <div className="progress-text">
            {currentEpisodes} / {movie.total_episodes} episodes (
            {Math.round(episodePercentage)}%)
          </div>
        </div>

        <div className="episode-controls">
          <button
            onClick={() => onDecrementEpisode(movie.id)}
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
            onClick={() => onIncrementEpisode(movie.id)}
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
  }
);

// Memoized Recommendation Add Form
const RecommendationAddForm = React.memo(({ item, onAdd, isAdding }) => {
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
});

// Memoized Movie Card Actions Component
const MovieCardActions = React.memo(
  ({ movie, onOpenPartyPlanner, onShowDeleteConfirm, deletingMovie }) => (
    <div className="movie-actions">
      <Link to={`/movie/${movie.id}`} className="btn btn-primary">
        👁️ View Details
      </Link>
      <button
        onClick={() => onOpenPartyPlanner(movie)}
        className="btn btn-planner"
        title="Find best time to watch with friends"
      >
        🎯 Plan Watch Time
      </button>
      <button
        onClick={() => onShowDeleteConfirm(movie)}
        className="btn btn-danger"
        disabled={deletingMovie === movie.id}
      >
        {deletingMovie === movie.id ? "Deleting..." : "🗑️ Delete"}
      </button>
    </div>
  )
);

// Main MovieList Component
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

  // Watch Party Planner States
  const [showPartyPlanner, setShowPartyPlanner] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [friendAvailabilities, setFriendAvailabilities] = useState([]);
  const [suggestedTimes, setSuggestedTimes] = useState([]);
  const [plannerLoading, setPlannerLoading] = useState(false);

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

  // Update movie progress
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
        totalRuntime =
          movie.total_minutes ||
          (movie.total_episodes ? movie.total_episodes * 20 : 240);
      } else {
        totalRuntime = movie.total_minutes || 120;
      }

      if (progressType === "increment") {
        let minutesToAdd;
        if (movie.is_tv_show) {
          minutesToAdd = 20;
        } else {
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

  // Watch Party Planner Functions
  const openPartyPlanner = (movie) => {
    setSelectedMovie(movie);
    setShowPartyPlanner(true);
    // Initialize with empty friend data
    setFriendAvailabilities([
      {
        id: Date.now(),
        name: "",
        timezone: "EST",
        availability: [],
      },
    ]);
    setSuggestedTimes([]);
  };

  const closePartyPlanner = () => {
    setShowPartyPlanner(false);
    setSelectedMovie(null);
    setFriendAvailabilities([]);
    setSuggestedTimes([]);
  };

  const calculateBestTimes = () => {
    // Validate that at least one friend has a name and availability
    const validFriends = friendAvailabilities.filter(
      (friend) => friend.name.trim() && friend.availability.length > 0
    );

    if (validFriends.length === 0) {
      alert(
        "Please add at least one friend with name and availability selected."
      );
      return;
    }

    setPlannerLoading(true);

    // Enhanced AI-powered time calculation
    setTimeout(() => {
      const availabilityStats = analyzeFriendAvailability(validFriends);
      const times = generateTimeSuggestions(validFriends, availabilityStats);

      setSuggestedTimes(times);
      setPlannerLoading(false);
    }, 1500);
  };

  // Helper function to analyze friend availability
  const analyzeFriendAvailability = (friends) => {
    const stats = {
      totalFriends: friends.length,
      weekdayEvening: 0,
      weekendAfternoon: 0,
      weekendEvening: 0,
      weekdayLate: 0,
      weekendLate: 0,
    };

    friends.forEach((friend) => {
      if (friend.availability.includes("weekday_evening"))
        stats.weekdayEvening++;
      if (friend.availability.includes("weekend_afternoon"))
        stats.weekendAfternoon++;
      if (friend.availability.includes("weekend_evening"))
        stats.weekendEvening++;
      if (friend.availability.includes("weekday_late")) stats.weekdayLate++;
      if (friend.availability.includes("weekend_late")) stats.weekendLate++;
    });

    return stats;
  };

  // Helper function to generate intelligent time suggestions
  const generateTimeSuggestions = (friends, stats) => {
    const suggestions = [];
    const totalFriends = friends.length;

    // Generate suggestions based on availability patterns
    if (stats.weekendEvening === totalFriends) {
      suggestions.push({
        time: "Saturday, 7:00 PM EST",
        confidence: 95,
        participants: totalFriends,
        reason:
          "Perfect! All friends available for prime weekend evening movie night",
      });
    }

    if (stats.weekendAfternoon === totalFriends) {
      suggestions.push({
        time: "Sunday, 3:00 PM EST",
        confidence: 85,
        participants: totalFriends,
        reason: "Great weekend afternoon slot - all friends available",
      });
    }

    if (stats.weekdayEvening === totalFriends) {
      suggestions.push({
        time: "Friday, 8:00 PM EST",
        confidence: 80,
        participants: totalFriends,
        reason:
          "Perfect Friday night movie time - everyone available after work",
      });
    }

    // Fallback suggestions for partial availability
    if (suggestions.length === 0) {
      const bestSlot = findBestTimeSlot(stats, totalFriends);
      if (bestSlot) {
        suggestions.push(bestSlot);
      }

      // Add additional options with lower confidence
      if (stats.weekendEvening >= Math.ceil(totalFriends * 0.7)) {
        suggestions.push({
          time: "Saturday, 8:00 PM EST",
          confidence: Math.min(
            90,
            Math.round((stats.weekendEvening / totalFriends) * 100)
          ),
          participants: stats.weekendEvening,
          reason: `${stats.weekendEvening} out of ${totalFriends} friends available for weekend evening`,
        });
      }

      if (stats.weekdayEvening >= Math.ceil(totalFriends * 0.6)) {
        suggestions.push({
          time: "Thursday, 7:30 PM EST",
          confidence: Math.min(
            75,
            Math.round((stats.weekdayEvening / totalFriends) * 100)
          ),
          participants: stats.weekdayEvening,
          reason: `${stats.weekdayEvening} out of ${totalFriends} friends available for weekday evening`,
        });
      }
    }

    // Sort by confidence (highest first)
    return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
  };

  const findBestTimeSlot = (stats, totalFriends) => {
    const slots = [
      {
        key: "weekendEvening",
        time: "Saturday, 7:00 PM EST",
        description: "weekend evening",
      },
      {
        key: "weekendAfternoon",
        time: "Sunday, 2:00 PM EST",
        description: "weekend afternoon",
      },
      {
        key: "weekdayEvening",
        time: "Friday, 8:00 PM EST",
        description: "weekday evening",
      },
      {
        key: "weekendLate",
        time: "Saturday, 10:30 PM EST",
        description: "weekend late night",
      },
      {
        key: "weekdayLate",
        time: "Friday, 10:00 PM EST",
        description: "weekday late night",
      },
    ];

    const bestSlot = slots.reduce(
      (best, slot) => {
        const count = stats[slot.key];
        const confidence = Math.round((count / totalFriends) * 100);

        if (count > (best.count || 0)) {
          return {
            time: slot.time,
            confidence: confidence,
            participants: count,
            reason: `${count} out of ${totalFriends} friends available for ${slot.description}`,
            count: count,
          };
        }
        return best;
      },
      { count: 0 }
    );

    return bestSlot.count > 0 ? bestSlot : null;
  };

  const addFriendAvailability = () => {
    const newFriend = {
      id: Date.now(),
      name: "",
      timezone: "EST",
      availability: [],
    };
    setFriendAvailabilities((prev) => [...prev, newFriend]);
  };

  const updateFriendAvailability = (id, field, value) => {
    setFriendAvailabilities((prev) =>
      prev.map((friend) =>
        friend.id === id ? { ...friend, [field]: value } : friend
      )
    );
  };

  const removeFriendAvailability = (id) => {
    if (friendAvailabilities.length > 1) {
      setFriendAvailabilities((prev) =>
        prev.filter((friend) => friend.id !== id)
      );
    } else {
      alert("You need at least one friend to plan a watch party!");
    }
  };

  const toggleAvailability = (friendId, slot) => {
    setFriendAvailabilities((prev) =>
      prev.map((friend) =>
        friend.id === friendId
          ? {
              ...friend,
              availability: friend.availability.includes(slot)
                ? friend.availability.filter((s) => s !== slot)
                : [...friend.availability, slot],
            }
          : friend
      )
    );
  };

  const scheduleParty = (suggestedTime) => {
    const friendNames = friendAvailabilities
      .filter((friend) => friend.name.trim())
      .map((friend) => friend.name)
      .join(", ");

    alert(
      `🎉 Perfect! The best time to watch "${selectedMovie.title}" is:\n\n📅 ${
        suggestedTime.time
      }\n👥 ${suggestedTime.participants} friends available\n${
        friendNames ? `\nFriends: ${friendNames}` : ""
      }\n\n${
        suggestedTime.reason
      }\n\nShare this time with your friends and enjoy your movie night!`
    );
    setShowPartyPlanner(false);
  };

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

      {/* Watch Party Planner Modal */}
      {showPartyPlanner && (
        <WatchPartyPlannerModal
          selectedMovie={selectedMovie}
          friendAvailabilities={friendAvailabilities}
          suggestedTimes={suggestedTimes}
          plannerLoading={plannerLoading}
          onClose={closePartyPlanner}
          onCalculateBestTimes={calculateBestTimes}
          onUpdateFriend={updateFriendAvailability}
          onAddFriend={addFriendAvailability}
          onRemoveFriend={removeFriendAvailability}
          onToggleAvailability={toggleAvailability}
          onScheduleParty={scheduleParty}
        />
      )}

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
              <button
                className="delete-movie-btn"
                onClick={() => setShowDeleteConfirm(movie)}
                title={`Delete ${movie.title}`}
                disabled={deletingMovie === movie.id}
              >
                {deletingMovie === movie.id ? "🗑️..." : "🗑️"}
              </button>

              <QuickStatusButtons
                movie={movie}
                onUpdateStatus={updateMovieStatus}
                updatingMovie={updatingMovie}
              />

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
                  <p>
                    <strong>Type:</strong>{" "}
                    {movie.is_tv_show ? "📺 TV Show" : "🎬 Movie"}
                  </p>

                  {movie.status !== "wishlist" && (
                    <div className="progress-section">
                      <MovieProgressControls
                        movie={movie}
                        onUpdateProgress={updateMovieProgress}
                        updatingMovie={updatingMovie}
                      />
                    </div>
                  )}

                  {movie.is_tv_show && movie.total_episodes && (
                    <TVShowEpisodeControls
                      movie={movie}
                      onIncrementEpisode={incrementEpisode}
                      onDecrementEpisode={decrementEpisode}
                      updatingMovie={updatingMovie}
                    />
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

                <MovieCardActions
                  movie={movie}
                  onOpenPartyPlanner={openPartyPlanner}
                  onShowDeleteConfirm={setShowDeleteConfirm}
                  deletingMovie={deletingMovie}
                />
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
