// src/components/Header.js
import React from "react";
import { Link, useLocation } from "react-router-dom";
import "./Header.css";

function Header({
  title = "MovieMate",
  subtitle = "Track and manage your movie & TV show collection",
  currentPage = "home",
}) {
  const location = useLocation();

  const getPageTitle = () => {
    switch (location.pathname) {
      case "/search":
        return "Advanced Search";
      case "/stats":
        return "Statistics";
      case "/movie":
        return "Movie Details";
      default:
        return title;
    }
  };

  const getPageSubtitle = () => {
    switch (location.pathname) {
      case "/search":
        return "Search the TMDB database for movies and TV shows";
      case "/stats":
        return "Insights and analytics about your movie collection";
      case "/movie":
        return "Detailed information about your movie";
      default:
        return subtitle;
    }
  };

  return (
    <header className="app-header">
      <div className="header-content">
        <div className="header-text">
          <h1>{getPageTitle()}</h1>
          <p>{getPageSubtitle()}</p>
        </div>

        <nav className="main-nav">
          <Link
            to="/"
            className={`nav-link ${currentPage === "home" ? "active" : ""}`}
          >
            🏠 Home
          </Link>
          <Link
            to="/search"
            className={`nav-link ${currentPage === "search" ? "active" : ""}`}
          >
            🔍 Search
          </Link>
          <Link
            to="/stats"
            className={`nav-link ${currentPage === "stats" ? "active" : ""}`}
          >
            📊 Stats
          </Link>
        </nav>
      </div>
    </header>
  );
}

export default Header;
