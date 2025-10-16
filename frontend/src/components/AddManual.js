import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Header from "./Header";
import { API_BASE } from "../utils/constants";
import "./AddManual.css";

function AddManual() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: "",
    director: "",
    genre: "",
    platform: "",
    status: "wishlist",
    is_tv_show: false,
    episodes_watched: 0,
    total_episodes: "",
    rating: "",
    review: "",
    release_date: "",
    overview: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        type === "checkbox"
          ? checked
          : type === "number"
          ? value === ""
            ? ""
            : parseFloat(value)
          : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Validate required fields
    if (!formData.title.trim()) {
      setError("Title is required");
      setLoading(false);
      return;
    }

    if (!formData.platform.trim()) {
      setError("Platform is required");
      setLoading(false);
      return;
    }

    try {
      // Prepare data for API
      const submitData = {
        ...formData,
        total_episodes: formData.total_episodes
          ? parseInt(formData.total_episodes)
          : null,
        rating: formData.rating ? parseFloat(formData.rating) : null,
        episodes_watched: formData.episodes_watched || 0,
      };

      const response = await axios.post(`${API_BASE}/movies/`, submitData);

      // Success - redirect to movie list
      navigate("/");
    } catch (error) {
      console.error("Error adding movie:", error);
      if (error.response?.status === 400) {
        setError(
          error.response.data.detail ||
            "Invalid data. Please check your inputs."
        );
      } else if (error.response?.status === 500) {
        setError("Server error. Please try again later.");
      } else {
        setError("Failed to add movie. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="add-manual-page">
      <Header title="Add Movie Manually" currentPage="add-manual" />

      <div className="add-manual-container">
        <div className="add-manual-card">
          <div className="form-header">
            <h1>Add Movie/TV Show Manually</h1>
            <p>
              Fill in the details below to add a movie or TV show to your
              collection
            </p>
          </div>

          {error && <div className="error-message">⚠️ {error}</div>}

          <form onSubmit={handleSubmit} className="movie-form">
            <div className="form-section">
              <h3>Basic Information</h3>

              <div className="form-row">
                <div className="form-group required">
                  <label>Title *</label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    placeholder="Enter movie/TV show title"
                    required
                  />
                </div>

                <div className="form-group required">
                  <label>Platform *</label>
                  <input
                    type="text"
                    name="platform"
                    value={formData.platform}
                    onChange={handleInputChange}
                    placeholder="Netflix, Prime, Disney+, etc."
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Director</label>
                  <input
                    type="text"
                    name="director"
                    value={formData.director}
                    onChange={handleInputChange}
                    placeholder="Director name"
                  />
                </div>

                <div className="form-group">
                  <label>Genre</label>
                  <input
                    type="text"
                    name="genre"
                    value={formData.genre}
                    onChange={handleInputChange}
                    placeholder="Action, Drama, Comedy, etc."
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Release Date</label>
                  <input
                    type="date"
                    name="release_date"
                    value={formData.release_date}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="form-group">
                  <label>Status</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                  >
                    <option value="wishlist">Wishlist</option>
                    <option value="watching">Watching</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>

              <div className="form-checkbox">
                <label>
                  <input
                    type="checkbox"
                    name="is_tv_show"
                    checked={formData.is_tv_show}
                    onChange={handleInputChange}
                  />
                  This is a TV Show
                </label>
              </div>
            </div>

            {/* TV Show Specific Fields */}
            {formData.is_tv_show && (
              <div className="form-section">
                <h3>TV Show Details</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>Episodes Watched</label>
                    <input
                      type="number"
                      name="episodes_watched"
                      value={formData.episodes_watched}
                      onChange={handleInputChange}
                      min="0"
                      placeholder="0"
                    />
                  </div>

                  <div className="form-group">
                    <label>Total Episodes</label>
                    <input
                      type="number"
                      name="total_episodes"
                      value={formData.total_episodes}
                      onChange={handleInputChange}
                      min="1"
                      placeholder="Total number of episodes"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="form-section">
              <h3>Rating & Review</h3>
              <div className="form-row">
                <div className="form-group">
                  <label>Rating (0-10)</label>
                  <input
                    type="number"
                    name="rating"
                    value={formData.rating}
                    onChange={handleInputChange}
                    min="0"
                    max="10"
                    step="0.1"
                    placeholder="8.5"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Review</label>
                <textarea
                  name="review"
                  value={formData.review}
                  onChange={handleInputChange}
                  placeholder="Write your review..."
                  rows="4"
                />
              </div>
            </div>

            <div className="form-section">
              <h3>Additional Information</h3>
              <div className="form-group">
                <label>Overview/Description</label>
                <textarea
                  name="overview"
                  value={formData.overview}
                  onChange={handleInputChange}
                  placeholder="Brief description of the movie/TV show..."
                  rows="3"
                />
              </div>
            </div>

            <div className="form-actions">
              <button
                type="button"
                onClick={() => navigate("/")}
                className="btn btn-secondary"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? "Adding..." : "Add to Collection"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default AddManual;
