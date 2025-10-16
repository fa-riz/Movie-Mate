import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import "./App.css";

const API_BASE = "http://localhost:8000";

function App() {
  // State declarations
  const [movies, setMovies] = useState([]);
  const [filter, setFilter] = useState({});
  const [stats, setStats] = useState({});
  const [showForm, setShowForm] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    director: "",
    genre: "",
    platform: "",
    status: "wishlist",
  });

  // Data fetching functions
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

  // Form handling
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (formData.title.trim() === "") {
        alert("Please enter a title");
        return;
      }

      await axios.post(`${API_BASE}/movies`, formData);

      resetForm();
      fetchMovies();
      fetchStats();
      alert("Movie added successfully!");
    } catch (error) {
      console.error("Error saving movie:", error);
      alert("Error saving movie. Please try again.");
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      director: "",
      genre: "",
      platform: "",
      status: "wishlist",
    });
    setShowForm(false);
  };

  // Movie actions
  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this movie?")) {
      try {
        await axios.delete(`${API_BASE}/movies/${id}`);
        fetchMovies();
        fetchStats();
      } catch (error) {
        console.error("Error deleting movie:", error);
      }
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

  // Get unique values for filters
  const genres = [...new Set(movies.map((m) => m.genre).filter(Boolean))];
  const platforms = [...new Set(movies.map((m) => m.platform).filter(Boolean))];

  return (
    <div className="App">
      {/* Header */}
      <header className="app-header">
        <h1>🎬 MovieMate</h1>
        <p>Track and manage your movie collection</p>
      </header>

      {/* Stats Dashboard */}
      <div className="stats-dashboard">
        <div className="stat-card">
          <h3>Total</h3>
          <p>{stats.total || 0}</p>
        </div>
        <div className="stat-card">
          <h3>Watching</h3>
          <p>{stats.watching || 0}</p>
        </div>
        <div className="stat-card">
          <h3>Completed</h3>
          <p>{stats.completed || 0}</p>
        </div>
        <div className="stat-card">
          <h3>Wishlist</h3>
          <p>{stats.wishlist || 0}</p>
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
          + Add Movie
        </button>
      </div>

      {/* Add Form Modal */}
      {showForm && (
        <div className="modal">
          <div className="modal-content">
            <h2>Add Movie</h2>
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
                <button type="submit">Add Movie</button>
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
        {movies.length > 0 ? (
          movies.map((movie) => (
            <div key={movie.id} className="movie-card">
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
            <p>Add your first movie to get started!</p>
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
