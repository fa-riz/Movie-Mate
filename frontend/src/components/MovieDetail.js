import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import Header from "./Header";
import { API_BASE, TMDB_IMAGE_BASE } from "../utils/constants";
import "./MovieDetail.css";

function MovieDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [aiNotes, setAiNotes] = useState("");
  const [editForm, setEditForm] = useState({
    rating: "",
    review: "",
    episodes_watched: "",
    total_episodes: "",
    minutes_watched: "",
    total_minutes: "",
    status: "wishlist",
  });

  // Fetch single movie by ID
  useEffect(() => {
    const fetchMovie = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`${API_BASE}/movies`);
        const foundMovie = response.data.find((m) => m.id === parseInt(id));

        if (foundMovie) {
          setMovie(foundMovie);
          setEditForm({
            rating: foundMovie.rating || "",
            review: foundMovie.review || "",
            episodes_watched: foundMovie.episodes_watched || 0,
            total_episodes: foundMovie.total_episodes || "",
            minutes_watched: foundMovie.minutes_watched || 0,
            total_minutes: foundMovie.total_minutes || "",
            status: foundMovie.status || "wishlist",
          });
        } else {
          setMovie(null);
        }
      } catch (error) {
        console.error("Error fetching movie:", error);
        alert("Failed to load movie details");
      } finally {
        setLoading(false);
      }
    };

    fetchMovie();
  }, [id]);

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Quick status update
  const updateStatus = async (newStatus) => {
    if (!movie) return;

    try {
      setSaving(true);

      const updateData = {
        status: newStatus,
      };

      const response = await axios.put(
        `${API_BASE}/movies/${movie.id}`,
        updateData
      );

      setMovie({
        ...movie,
        ...response.data,
      });

      setEditForm((prev) => ({
        ...prev,
        status: newStatus,
      }));

      alert(`Status updated to ${newStatus}!`);
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Failed to update status. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Update movie watch progress - ENHANCED with TV show specific logic
  const updateMovieProgress = async (progressType, customMinutes = null) => {
    if (!movie) return;

    try {
      setSaving(true);

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
        `${API_BASE}/movies/${movie.id}`,
        updateData
      );

      setMovie({
        ...movie,
        ...response.data,
      });

      setEditForm((prev) => ({
        ...prev,
        minutes_watched: updateData.minutes_watched,
        status: updateData.status,
      }));

      if (progressType === "complete") {
        alert(`"${movie.title}" marked as completed!`);
      } else if (progressType === "reset") {
        alert(`Progress reset for "${movie.title}"!`);
      }
    } catch (error) {
      console.error("Error updating movie progress:", error);
      alert("Failed to update progress. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Save details
  const saveDetails = async () => {
    if (!movie) return;

    try {
      setSaving(true);

      const updateData = {
        rating: editForm.rating ? parseFloat(editForm.rating) : null,
        review: editForm.review || null,
        episodes_watched: editForm.episodes_watched
          ? parseInt(editForm.episodes_watched)
          : null,
        minutes_watched: editForm.minutes_watched
          ? parseInt(editForm.minutes_watched)
          : null,
        total_minutes: editForm.total_minutes
          ? parseInt(editForm.total_minutes)
          : null,
        status: editForm.status,
      };

      // Auto-update status based on episodes for TV shows
      if (
        movie.is_tv_show &&
        updateData.episodes_watched !== null &&
        editForm.total_episodes
      ) {
        const totalEps = parseInt(editForm.total_episodes);
        if (updateData.episodes_watched === 0) {
          updateData.status = "wishlist";
        } else if (updateData.episodes_watched >= totalEps) {
          updateData.status = "completed";
        } else {
          updateData.status = "watching";
        }
      }

      // Auto-update status based on watch time for all content
      if (updateData.minutes_watched !== null) {
        let totalRuntime;
        if (movie.is_tv_show) {
          totalRuntime =
            updateData.total_minutes ||
            (movie.total_episodes ? movie.total_episodes * 20 : 240);
        } else {
          totalRuntime = updateData.total_minutes || 120;
        }

        if (updateData.minutes_watched === 0) {
          updateData.status = "wishlist";
        } else if (updateData.minutes_watched >= totalRuntime) {
          updateData.status = "completed";
        } else {
          updateData.status = "watching";
        }
      }

      const response = await axios.put(
        `${API_BASE}/movies/${movie.id}`,
        updateData
      );

      setMovie({
        ...movie,
        ...response.data,
      });

      setIsEditing(false);
      alert("Details updated successfully!");
    } catch (error) {
      console.error("Error updating movie details:", error);
      if (error.response?.data?.detail) {
        alert(`Error: ${error.response.data.detail}`);
      } else {
        alert("Failed to update details. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  // Update only rating and review
  const updateRatingReview = async () => {
    if (!movie) return;

    try {
      setSaving(true);

      const updateData = {
        rating: editForm.rating ? parseFloat(editForm.rating) : null,
        review: editForm.review || null,
      };

      const response = await axios.put(
        `${API_BASE}/movies/${movie.id}/rating-review`,
        updateData
      );

      setMovie({
        ...movie,
        ...response.data,
      });

      setIsEditing(false);
      alert("Rating and review updated successfully!");
    } catch (error) {
      console.error("Error updating rating/review:", error);
      if (error.response?.data?.detail) {
        alert(`Error: ${error.response.data.detail}`);
      } else {
        alert("Failed to update rating and review. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  // Generate AI review - ENHANCED with user notes
  const generateAIReview = async () => {
    if (!movie) return;

    try {
      setGeneratingAI(true);

      const requestData = {
        user_notes: aiNotes,
        rating: editForm.rating ? parseFloat(editForm.rating) : null,
      };

      const response = await axios.post(
        `${API_BASE}/movies/${movie.id}/generate-review`,
        requestData
      );

      setEditForm((prev) => ({
        ...prev,
        review: response.data.review,
      }));

      setMovie({
        ...movie,
        review: response.data.review,
      });

      // Clear AI notes after successful generation
      setAiNotes("");

      alert("AI review generated successfully!");
    } catch (error) {
      console.error("Error generating AI review:", error);
      if (error.response?.data?.detail) {
        alert(`Error: ${error.response.data.detail}`);
      } else {
        alert("Failed to generate AI review. Please try again.");
      }
    } finally {
      setGeneratingAI(false);
    }
  };

  // Quick AI Review with preset notes
  const generateQuickAIReview = async (presetNotes = "") => {
    if (!movie) return;

    try {
      setGeneratingAI(true);

      const requestData = {
        user_notes: presetNotes,
        rating: editForm.rating ? parseFloat(editForm.rating) : null,
      };

      const response = await axios.post(
        `${API_BASE}/movies/${movie.id}/generate-review`,
        requestData
      );

      setEditForm((prev) => ({
        ...prev,
        review: response.data.review,
      }));

      setMovie({
        ...movie,
        review: response.data.review,
      });

      alert("AI review generated successfully!");
    } catch (error) {
      console.error("Error generating AI review:", error);
      alert("Failed to generate AI review. Please try again.");
    } finally {
      setGeneratingAI(false);
    }
  };

  // Increment episodes watched
  const incrementEpisode = async () => {
    if (!movie) return;

    try {
      const newEpisodes = (movie.episodes_watched || 0) + 1;
      const isCompleted =
        movie.total_episodes && newEpisodes >= movie.total_episodes;

      const updateData = {
        episodes_watched: newEpisodes,
        status: isCompleted ? "completed" : "watching",
      };

      const response = await axios.put(
        `${API_BASE}/movies/${movie.id}`,
        updateData
      );

      const updatedMovie = {
        ...movie,
        ...response.data,
      };

      setMovie(updatedMovie);
      setEditForm((prev) => ({
        ...prev,
        episodes_watched: newEpisodes,
        status: updateData.status,
      }));
    } catch (error) {
      console.error("Error updating episodes:", error);
      alert("Failed to update episode count. Please try again.");
    }
  };

  // Decrement episodes watched
  const decrementEpisode = async () => {
    if (!movie || !movie.episodes_watched || movie.episodes_watched <= 0)
      return;

    try {
      const newEpisodes = Math.max(0, (movie.episodes_watched || 0) - 1);
      const newStatus = newEpisodes === 0 ? "wishlist" : "watching";

      const updateData = {
        episodes_watched: newEpisodes,
        status: newStatus,
      };

      const response = await axios.put(
        `${API_BASE}/movies/${movie.id}`,
        updateData
      );

      const updatedMovie = {
        ...movie,
        ...response.data,
      };

      setMovie(updatedMovie);
      setEditForm((prev) => ({
        ...prev,
        episodes_watched: newEpisodes,
        status: newStatus,
      }));
    } catch (error) {
      console.error("Error updating episodes:", error);
      alert("Failed to update episode count. Please try again.");
    }
  };

  // Quick Status Buttons
  const QuickStatusButtons = () => (
    <div className="quick-status-section">
      <h4>Quick Status Update:</h4>
      <div className="quick-status-buttons">
        {movie.status !== "wishlist" && (
          <button
            onClick={() => updateStatus("wishlist")}
            className="btn-status wishlist large"
            disabled={saving}
          >
            ⭐ Move to Wishlist
          </button>
        )}
        {movie.status !== "watching" && (
          <button
            onClick={() => updateStatus("watching")}
            className="btn-status watching large"
            disabled={saving}
          >
            ▶️ Mark as Watching
          </button>
        )}
        {movie.status !== "completed" && (
          <button
            onClick={() => updateStatus("completed")}
            className="btn-status completed large"
            disabled={saving}
          >
            ✅ Mark as Completed
          </button>
        )}
      </div>
    </div>
  );

  // Movie Progress Controls - ENHANCED with TV show specific logic
  const MovieProgressControls = () => {
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
        <h4>Watch Progress:</h4>
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
                onClick={() => updateMovieProgress("increment")}
                className="btn btn-success"
                disabled={saving}
                title="Add 20 minutes (one episode)"
              >
                +20 min
              </button>
              <button
                onClick={() => updateMovieProgress("complete")}
                className="btn btn-primary"
                disabled={saving}
              >
                ✅ Complete Series
              </button>
              <button
                onClick={() => updateMovieProgress("reset")}
                className="btn btn-secondary"
                disabled={saving}
              >
                🔄 Reset Progress
              </button>
            </>
          ) : (
            // MOVIE CONTROLS - Multiple increment options
            <>
              <button
                onClick={() => updateMovieProgress("increment")}
                className="btn btn-success"
                disabled={saving}
              >
                +15 min
              </button>
              <button
                onClick={() => updateMovieProgress("increment", 30)}
                className="btn btn-success"
                disabled={saving}
              >
                +30 min
              </button>
              <button
                onClick={() => updateMovieProgress("increment", 60)}
                className="btn btn-success"
                disabled={saving}
              >
                +60 min
              </button>
              <button
                onClick={() => updateMovieProgress("complete")}
                className="btn btn-primary"
                disabled={saving}
              >
                ✅ Complete Movie
              </button>
              <button
                onClick={() => updateMovieProgress("reset")}
                className="btn btn-secondary"
                disabled={saving}
              >
                🔄 Reset Progress
              </button>
            </>
          )}
        </div>

        <div className="custom-progress">
          <input
            type="number"
            placeholder="Custom minutes"
            className="form-control small"
            onKeyPress={(e) => {
              if (e.key === "Enter") {
                const minutes = parseInt(e.target.value);
                if (minutes >= 0 && minutes <= totalRuntime) {
                  updateMovieProgress("custom", minutes);
                  e.target.value = "";
                }
              }
            }}
          />
          <span>Press Enter to set custom minutes (0-{totalRuntime})</span>
        </div>
      </div>
    );
  };

  // AI Review Section Component
  const AIReviewSection = () => (
    <div className="ai-review-section">
      <h4>🤖 AI Review Generator</h4>
      <div className="ai-review-options">
        <div className="quick-ai-buttons">
          <p>Quick templates:</p>
          <div className="quick-ai-buttons-grid">
            <button
              onClick={() =>
                generateQuickAIReview(
                  "Focus on character development and storyline"
                )
              }
              className="btn btn-outline ai-quick-btn"
              disabled={generatingAI}
            >
              📖 Story & Characters
            </button>
            <button
              onClick={() =>
                generateQuickAIReview(
                  "Focus on cinematography and visual style"
                )
              }
              className="btn btn-outline ai-quick-btn"
              disabled={generatingAI}
            >
              🎥 Visuals & Style
            </button>
            <button
              onClick={() =>
                generateQuickAIReview("Focus on emotional impact and themes")
              }
              className="btn btn-outline ai-quick-btn"
              disabled={generatingAI}
            >
              💭 Themes & Emotions
            </button>
            <button
              onClick={() =>
                generateQuickAIReview(
                  "Write a balanced review with pros and cons"
                )
              }
              className="btn btn-outline ai-quick-btn"
              disabled={generatingAI}
            >
              ⚖️ Balanced Review
            </button>
          </div>
        </div>

        <div className="custom-ai-section">
          <p>Or add your own notes:</p>
          <div className="ai-input-group">
            <textarea
              value={aiNotes}
              onChange={(e) => setAiNotes(e.target.value)}
              className="form-control ai-notes-input"
              placeholder="Add specific points you'd like the AI to focus on (e.g., 'great acting but weak ending', 'amazing visuals', etc.)"
              rows="3"
            />
            <button
              onClick={generateAIReview}
              className="btn btn-primary ai-generate-btn"
              disabled={generatingAI}
            >
              {generatingAI ? "🔄 Generating..." : "🤖 Generate Custom Review"}
            </button>
          </div>
        </div>

        <div className="ai-tips">
          <p>
            <strong>💡 Tips:</strong>
          </p>
          <ul>
            <li>Set a rating first for more personalized reviews</li>
            <li>Be specific in your notes for better results</li>
            <li>You can edit the generated review afterwards</li>
          </ul>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="movie-detail-page">
        <Header currentPage="detail" />
        <div className="loading">Loading movie details...</div>
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="movie-detail-page">
        <Header currentPage="detail" />
        <div className="empty-state">
          <h3>Movie not found</h3>
          <p>The movie you're looking for doesn't exist in your collection.</p>
          <button onClick={() => navigate("/")} className="btn btn-primary">
            ← Back to Collection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="movie-detail-page">
      <Header title="Movie Details" currentPage="detail" />

      <div className="movie-detail-container">
        <div className="movie-detail-card">
          <div className="detail-poster-section">
            {movie.poster_path ? (
              <img
                src={movie.poster_path}
                alt={movie.title}
                className="detail-poster"
                onError={(e) => {
                  e.target.style.display = "none";
                  e.target.nextSibling.style.display = "block";
                }}
              />
            ) : null}
            <div
              className="detail-poster-placeholder"
              style={{ display: movie.poster_path ? "none" : "block" }}
            >
              No Image Available
            </div>
          </div>

          <div className="movie-detail-content">
            <div className="detail-header">
              <h1>{movie.title}</h1>
              <div className="detail-meta">
                <span className={`status-badge large ${movie.status}`}>
                  {movie.status === "wishlist" && "⭐ Wishlist"}
                  {movie.status === "watching" && "🎬 Watching"}
                  {movie.status === "completed" && "✅ Completed"}
                </span>
                {movie.rating && (
                  <span className="rating-badge">⭐ {movie.rating}/10</span>
                )}
              </div>
            </div>

            {/* Quick Status Buttons */}
            <QuickStatusButtons />

            {/* Movie Progress Controls - Show for all content types except wishlist */}
            {movie.status !== "wishlist" && <MovieProgressControls />}

            <div className="detail-info-grid">
              <div className="info-item">
                <strong>Director:</strong>
                <span>{movie.director || "Not specified"}</span>
              </div>
              <div className="info-item">
                <strong>Genre:</strong>
                <span>{movie.genre || "Not specified"}</span>
              </div>
              <div className="info-item">
                <strong>Platform:</strong>
                <span>{movie.platform || "Not specified"}</span>
              </div>
              {movie.release_date && (
                <div className="info-item">
                  <strong>Released:</strong>
                  <span>{movie.release_date}</span>
                </div>
              )}

              {/* Content Type */}
              <div className="info-item">
                <strong>Type:</strong>
                <span>{movie.is_tv_show ? "📺 TV Show" : "🎬 Movie"}</span>
              </div>

              {/* Watch Progress for all content */}
              {movie.status !== "wishlist" && (
                <div className="info-item">
                  <strong>Watch Progress:</strong>
                  <span>
                    {movie.minutes_watched || 0} /{" "}
                    {movie.total_minutes ||
                      (movie.is_tv_show
                        ? movie.total_episodes
                          ? movie.total_episodes * 20
                          : 240
                        : 120)}{" "}
                    minutes
                    {movie.minutes_watched >=
                      (movie.total_minutes ||
                        (movie.is_tv_show
                          ? movie.total_episodes
                            ? movie.total_episodes * 20
                            : 240
                          : 120)) && " (Completed)"}
                  </span>
                </div>
              )}

              {/* TV Show Progress Section */}
              {movie.is_tv_show && (
                <>
                  <div className="info-item">
                    <strong>Episode Progress:</strong>
                    <span>
                      {movie.episodes_watched || 0}/
                      {movie.total_episodes || "?"} episodes
                    </span>
                  </div>
                  {movie.total_episodes && (
                    <div className="info-item">
                      <strong>Episode Completion:</strong>
                      <span>
                        {Math.round(
                          ((movie.episodes_watched || 0) /
                            movie.total_episodes) *
                            100
                        )}
                        %
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* TV Show Progress Bar */}
            {movie.is_tv_show && movie.total_episodes && (
              <div className="tv-progress-section">
                <div className="progress-bar-container">
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${
                          ((movie.episodes_watched || 0) /
                            movie.total_episodes) *
                          100
                        }%`,
                      }}
                    ></div>
                  </div>
                  <div className="progress-text">
                    {movie.episodes_watched || 0} / {movie.total_episodes}{" "}
                    episodes
                  </div>
                </div>

                {/* Episode Controls */}
                <div className="episode-controls">
                  <button
                    onClick={decrementEpisode}
                    className="btn btn-secondary episode-btn"
                    disabled={
                      !movie.episodes_watched || movie.episodes_watched <= 0
                    }
                  >
                    -1 Episode
                  </button>
                  <button
                    onClick={incrementEpisode}
                    className="btn btn-success episode-btn"
                    disabled={
                      movie.total_episodes &&
                      (movie.episodes_watched || 0) >= movie.total_episodes
                    }
                  >
                    +1 Episode
                  </button>
                </div>
              </div>
            )}

            {/* Review and Rating Section */}
            <div className="detail-section">
              <div className="section-header">
                <h3>Your Review & Rating</h3>
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="btn btn-outline"
                  disabled={saving}
                >
                  {isEditing ? "Cancel" : "✏️ Edit"}
                </button>
              </div>

              {isEditing ? (
                <div className="edit-form">
                  <div className="form-group">
                    <label>Rating (0-10):</label>
                    <input
                      type="number"
                      name="rating"
                      min="0"
                      max="10"
                      step="0.1"
                      value={editForm.rating}
                      onChange={handleInputChange}
                      className="form-control"
                      placeholder="Enter rating 0-10"
                    />
                  </div>

                  <div className="form-group">
                    <label>Your Review:</label>
                    <textarea
                      name="review"
                      value={editForm.review}
                      onChange={handleInputChange}
                      className="form-control"
                      rows="4"
                      placeholder="Write your review here..."
                    />
                  </div>

                  {/* AI Review Section - Only show when editing */}
                  <AIReviewSection />

                  {/* Minutes watched for ALL content types */}
                  <div className="form-group">
                    <label>Minutes Watched:</label>
                    <input
                      type="number"
                      name="minutes_watched"
                      min="0"
                      value={editForm.minutes_watched}
                      onChange={handleInputChange}
                      className="form-control"
                      placeholder="Total minutes watched"
                    />
                  </div>

                  <div className="form-group">
                    <label>Total Minutes (Optional):</label>
                    <input
                      type="number"
                      name="total_minutes"
                      min="0"
                      value={editForm.total_minutes}
                      onChange={handleInputChange}
                      className="form-control"
                      placeholder="Total runtime in minutes"
                    />
                  </div>

                  {movie.is_tv_show ? (
                    <>
                      <div className="form-group">
                        <label>Episodes Watched:</label>
                        <input
                          type="number"
                          name="episodes_watched"
                          min="0"
                          value={editForm.episodes_watched}
                          onChange={handleInputChange}
                          className="form-control"
                          placeholder="Episodes watched"
                        />
                      </div>

                      <div className="form-group">
                        <label>Total Episodes:</label>
                        <input
                          type="number"
                          name="total_episodes"
                          min="0"
                          value={editForm.total_episodes}
                          onChange={handleInputChange}
                          className="form-control"
                          placeholder="Total episodes in series"
                        />
                      </div>
                    </>
                  ) : null}

                  <div className="form-group">
                    <label>Status:</label>
                    <select
                      name="status"
                      value={editForm.status}
                      onChange={handleInputChange}
                      className="form-control"
                    >
                      <option value="wishlist">Wishlist</option>
                      <option value="watching">Watching</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>

                  <div className="form-actions">
                    <button
                      onClick={saveDetails}
                      className="btn btn-primary save-btn"
                      disabled={saving}
                    >
                      {saving ? "💾 Saving..." : "💾 Save All Changes"}
                    </button>

                    <button
                      onClick={updateRatingReview}
                      className="btn btn-secondary save-btn"
                      disabled={saving}
                    >
                      {saving ? "💾 Saving..." : "⭐ Save Rating & Review Only"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="display-content">
                  {movie.rating ? (
                    <div className="rating-display">
                      <strong>Your Rating:</strong> ⭐ {movie.rating}/10
                    </div>
                  ) : (
                    <div className="rating-display">
                      <strong>Your Rating:</strong> Not rated yet
                    </div>
                  )}

                  {movie.review ? (
                    <div className="review-display">
                      <strong>Your Review:</strong>
                      <div className="review-text">{movie.review}</div>
                    </div>
                  ) : (
                    <div className="review-display">
                      <strong>Your Review:</strong> No review yet
                    </div>
                  )}
                </div>
              )}
            </div>

            {movie.overview && (
              <div className="detail-section">
                <h3>Overview</h3>
                <p>{movie.overview}</p>
              </div>
            )}

            <div className="detail-actions">
              <button
                onClick={() => navigate("/")}
                className="btn btn-secondary"
              >
                ← Back to Collection
              </button>
              <Link to="/search" className="btn btn-primary">
                🔍 Search More Movies
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MovieDetail;
