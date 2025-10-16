import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Header from "./Header";
import { API_BASE, TMDB_IMAGE_BASE } from "../utils/constants";
import "./SearchPage.css";

function SearchPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [addingMovie, setAddingMovie] = useState(null);
  const [searchError, setSearchError] = useState("");
  const navigate = useNavigate();

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    try {
      setSearchLoading(true);
      setSearchPerformed(true);
      setSearchError("");

      const response = await axios.get(
        `${API_BASE}/tmdb/search?query=${encodeURIComponent(searchQuery)}`
      );

      if (response.data && response.data.results) {
        setSearchResults(response.data.results);
      } else {
        setSearchResults([]);
        setSearchError("No results found");
      }
    } catch (error) {
      console.error("Error searching:", error);
      setSearchResults([]);

      if (error.response?.status === 401) {
        setSearchError(
          "TMDB API authentication failed. Please check your API configuration."
        );
      } else if (error.response?.data?.detail) {
        setSearchError(error.response.data.detail);
      } else {
        setSearchError("Failed to search TMDB. Please try again.");
      }
    } finally {
      setSearchLoading(false);
    }
  };

  // Add movie from TMDB
  const addFromTMDB = async (tmdbItem, platform = "", status = "wishlist") => {
    try {
      setAddingMovie(tmdbItem.id);

      if (!platform.trim()) {
        alert("Please specify a platform (Netflix, Prime, Disney+, etc.)");
        setAddingMovie(null);
        return;
      }

      const addData = {
        tmdb_id: tmdbItem.id,
        platform: platform.trim(),
        status: status,
        is_tv_show: tmdbItem.is_tv_show || tmdbItem.media_type === "tv",
      };

      await axios.post(`${API_BASE}/movies/tmdb/add`, addData);

      alert("Movie added successfully!");
      navigate("/");
    } catch (error) {
      console.error("Error adding movie:", error);

      if (error.response?.status === 400) {
        alert("This movie is already in your collection!");
      } else if (error.response?.status === 404) {
        alert("Movie not found on TMDB. Please try a different movie.");
      } else if (error.response?.data?.detail) {
        alert(`Error: ${error.response.data.detail}`);
      } else {
        alert("Error adding movie. Please try again.");
      }
    } finally {
      setAddingMovie(null);
    }
  };

  // Quick Add Form Component
  const QuickAddForm = ({ item, onAdd, onCancel, isAdding }) => (
    <div className="quick-add-form">
      <h4>Add "{item.title}"</h4>
      <div className="quick-add-fields">
        <select
          defaultValue="wishlist"
          className="form-control"
          id={`status-${item.id}`}
        >
          <option value="wishlist">Wishlist</option>
          <option value="watching">Watching</option>
          <option value="completed">Completed</option>
        </select>
        <input
          type="text"
          placeholder="Platform (Netflix, Prime, etc.)"
          className="form-control"
          id={`platform-${item.id}`}
          required
        />
      </div>
      <div className="quick-add-actions">
        <button
          onClick={() => {
            const platform = document.querySelector(
              `#platform-${item.id}`
            ).value;
            const status = document.querySelector(`#status-${item.id}`).value;
            if (!platform.trim()) {
              alert("Please specify a platform");
              return;
            }
            onAdd(item, platform, status);
          }}
          disabled={isAdding}
          className="btn btn-success"
        >
          {isAdding ? "Adding..." : "Add to Collection"}
        </button>
        <button onClick={onCancel} className="btn btn-secondary">
          Cancel
        </button>
      </div>
    </div>
  );

  return (
    <div className="search-page">
      <Header
        title="Advanced Search"
        subtitle="Search the TMDB database for movies and TV shows"
        currentPage="search"
      />

      <div className="search-container">
        <div className="search-header">
          <h2>Discover Movies & TV Shows</h2>
          <p>Search through thousands of titles from The Movie Database</p>
        </div>

        <form onSubmit={handleSearch} className="search-form">
          <div className="search-input-group">
            <input
              type="text"
              placeholder="Enter movie or TV show title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            <button
              type="submit"
              className="btn btn-primary search-btn"
              disabled={searchLoading}
            >
              {searchLoading ? "Searching..." : "🔍 Search"}
            </button>
          </div>
        </form>

        {searchError && (
          <div className="search-error">
            <div className="error-message">⚠️ {searchError}</div>
            <button
              onClick={handleSearch}
              className="btn btn-primary retry-btn"
            >
              Retry Search
            </button>
          </div>
        )}

        <div className="search-results-section">
          {searchLoading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Searching TMDB database...</p>
            </div>
          ) : searchPerformed ? (
            searchResults.length > 0 ? (
              <div className="results-container">
                <h3>
                  Found {searchResults.length} results for "{searchQuery}"
                </h3>
                <div className="search-results-grid">
                  {searchResults.map((item) => (
                    <div key={item.id} className="search-result-item">
                      <div className="result-image">
                        {item.poster_path ? (
                          <img
                            src={item.poster_path}
                            alt={item.title}
                            onError={(e) => {
                              e.target.style.display = "none";
                              e.target.nextSibling.style.display = "flex";
                            }}
                          />
                        ) : null}
                        <div className="image-placeholder">No Image</div>
                      </div>

                      <div className="result-content">
                        <h4 className="result-title">{item.title}</h4>

                        <div className="result-meta-info">
                          <span className="result-year">
                            {item.release_date?.split("-")[0] || "Unknown year"}
                          </span>
                          <span className={`result-type ${item.media_type}`}>
                            {item.media_type === "movie"
                              ? "🎬 Movie"
                              : "📺 TV Show"}
                          </span>
                          {item.vote_average > 0 && (
                            <span className="result-rating">
                              ⭐ {item.vote_average.toFixed(1)}
                            </span>
                          )}
                        </div>

                        {item.overview && (
                          <p className="result-description">
                            {item.overview.length > 150
                              ? `${item.overview.substring(0, 150)}...`
                              : item.overview}
                          </p>
                        )}

                        <div className="result-actions">
                          {item.already_added ? (
                            <div className="already-in-collection">
                              ✅ Already in your collection
                              {item.existing_status && (
                                <span className="existing-status">
                                  ({item.existing_status})
                                </span>
                              )}
                            </div>
                          ) : (
                            <QuickAddForm
                              item={item}
                              onAdd={addFromTMDB}
                              onCancel={() => setAddingMovie(null)}
                              isAdding={addingMovie === item.id}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="no-results">
                <div className="no-results-icon">🔍</div>
                <h3>No results found</h3>
                <p>We couldn't find any matches for "{searchQuery}"</p>
                <div className="search-tips">
                  <h4>Search tips:</h4>
                  <ul>
                    <li>Check your spelling</li>
                    <li>Try more general keywords</li>
                    <li>Search for both movies and TV shows</li>
                    <li>Make sure TMDB API is properly configured</li>
                  </ul>
                </div>
              </div>
            )
          ) : (
            <div className="search-initial-state">
              <div className="initial-content">
                <div className="search-icon">🎬</div>
                <h3>Ready to explore?</h3>
                <p>Enter a movie or TV show title above to start searching</p>
                <div className="featured-categories">
                  <div className="category">
                    <h4>Popular Movies</h4>
                    <p>Avengers, Inception, The Dark Knight</p>
                  </div>
                  <div className="category">
                    <h4>TV Shows</h4>
                    <p>Stranger Things, Breaking Bad, Game of Thrones</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SearchPage;
