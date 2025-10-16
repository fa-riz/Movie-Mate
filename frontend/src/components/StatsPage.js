import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import Header from "./Header";
import { API_BASE } from "../utils/constants";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
} from "recharts";
import "./StatsPage.css";

function StatsPage() {
  const [stats, setStats] = useState({});
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("all");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [statsResponse, moviesResponse] = await Promise.all([
          axios.get(`${API_BASE}/stats`),
          axios.get(`${API_BASE}/movies`),
        ]);
        setStats(statsResponse.data);
        setMovies(moviesResponse.data);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="stats-page">
        <Header currentPage="stats" />
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <div className="loading">Loading your statistics...</div>
        </div>
      </div>
    );
  }

  // Color palettes
  const COLORS = [
    "#0088FE",
    "#00C49F",
    "#FFBB28",
    "#FF8042",
    "#8884D8",
    "#82CA9D",
  ];
  const STATUS_COLORS = {
    completed: "#00C49F",
    watching: "#0088FE",
    wishlist: "#FFBB28",
  };

  // Calculate real monthly data from movie creation dates
  const calculateRealMonthlyData = () => {
    const monthlyCounts = {};

    movies.forEach((movie) => {
      if (movie.created_at) {
        const date = new Date(movie.created_at);
        const monthYear = date.toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        });

        if (!monthlyCounts[monthYear]) {
          monthlyCounts[monthYear] = 0;
        }
        monthlyCounts[monthYear]++;
      }
    });

    // Convert to array and get last 6 months
    const monthlyData = Object.entries(monthlyCounts)
      .map(([month, added]) => ({ month, added }))
      .sort((a, b) => new Date(a.month) - new Date(b.month))
      .slice(-6);

    return monthlyData;
  };

  // Process data for charts
  const processChartData = () => {
    // Status Distribution
    const statusData = [
      {
        name: "Completed",
        value: stats.completed || 0,
        color: STATUS_COLORS.completed,
      },
      {
        name: "Watching",
        value: stats.watching || 0,
        color: STATUS_COLORS.watching,
      },
      {
        name: "Wishlist",
        value: stats.wishlist || 0,
        color: STATUS_COLORS.wishlist,
      },
    ];

    // Platform Distribution
    const platformStats = movies.reduce((acc, movie) => {
      if (movie.platform) {
        acc[movie.platform] = (acc[movie.platform] || 0) + 1;
      }
      return acc;
    }, {});
    const platformData = Object.entries(platformStats)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([name, value], index) => ({
        name: name.length > 12 ? name.substring(0, 12) + "..." : name,
        fullName: name,
        value,
        color: COLORS[index % COLORS.length],
      }));

    // Genre Distribution
    const genreStats = movies.reduce((acc, movie) => {
      if (movie.genre) {
        const genres = movie.genre.split(",").map((g) => g.trim());
        genres.forEach((genre) => {
          if (genre) {
            acc[genre] = (acc[genre] || 0) + 1;
          }
        });
      }
      return acc;
    }, {});
    const genreData = Object.entries(genreStats)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, value], index) => ({
        name: name.length > 15 ? name.substring(0, 15) + "..." : name,
        fullName: name,
        value,
        color: COLORS[index % COLORS.length],
      }));

    // Content Type Distribution
    const contentTypeData = [
      {
        name: "Movies",
        value: movies.filter((m) => !m.is_tv_show).length,
        color: "#0088FE",
      },
      {
        name: "TV Shows",
        value: movies.filter((m) => m.is_tv_show).length,
        color: "#00C49F",
      },
    ];

    // Watch Progress Data
    const progressData = movies
      .filter((movie) => movie.status !== "wishlist")
      .map((movie) => {
        const totalRuntime = movie.is_tv_show
          ? movie.total_minutes ||
            (movie.total_episodes ? movie.total_episodes * 20 : 240)
          : movie.total_minutes || 120;
        const progress = Math.min(
          100,
          ((movie.minutes_watched || 0) / totalRuntime) * 100
        );
        return {
          name:
            movie.title.length > 20
              ? movie.title.substring(0, 20) + "..."
              : movie.title,
          fullName: movie.title,
          progress,
          minutesWatched: movie.minutes_watched || 0,
          totalMinutes: totalRuntime,
          type: movie.is_tv_show ? "TV Show" : "Movie",
        };
      })
      .sort((a, b) => b.progress - a.progress)
      .slice(0, 10);

    // REAL Monthly Added Trend - using actual created_at data
    const monthlyData = calculateRealMonthlyData();

    // TV Show Episode Progress
    const tvShows = movies.filter((m) => m.is_tv_show && m.total_episodes);
    const episodeProgressData = tvShows
      .map((show) => ({
        name:
          show.title.length > 20
            ? show.title.substring(0, 20) + "..."
            : show.title,
        fullName: show.title,
        episodesWatched: show.episodes_watched || 0,
        totalEpisodes: show.total_episodes,
        progress: Math.min(
          100,
          ((show.episodes_watched || 0) / show.total_episodes) * 100
        ),
      }))
      .sort((a, b) => b.progress - a.progress)
      .slice(0, 8);

    return {
      statusData,
      platformData,
      genreData,
      contentTypeData,
      progressData,
      monthlyData,
      episodeProgressData,
      tvShows,
    };
  };

  const {
    statusData,
    platformData,
    genreData,
    contentTypeData,
    progressData,
    monthlyData,
    episodeProgressData,
    tvShows,
  } = processChartData();

  // Custom Tooltip Components
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip">
          <p className="tooltip-label">{label}</p>
          {payload.map((entry, index) => (
            <p
              key={index}
              className="tooltip-value"
              style={{ color: entry.color }}
            >
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const ProgressTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="custom-tooltip">
          <p className="tooltip-label">{data.fullName}</p>
          <p className="tooltip-value">
            Progress: {Math.round(data.progress)}%
          </p>
          <p className="tooltip-value">
            {data.minutesWatched} / {data.totalMinutes} minutes
          </p>
          <p className="tooltip-value">Type: {data.type}</p>
        </div>
      );
    }
    return null;
  };

  // Chart Components
  const StatusDistributionChart = () => (
    <div className="chart-container">
      <h3>📊 Status Distribution</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={statusData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) =>
              `${name} (${(percent * 100).toFixed(0)}%)`
            }
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {statusData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );

  const PlatformDistributionChart = () => (
    <div className="chart-container">
      <h3>📱 Platform Distribution</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={platformData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Bar dataKey="value" name="Movies/Shows">
            {platformData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  const GenreDistributionChart = () => (
    <div className="chart-container">
      <h3>🎭 Genre Distribution</h3>
      <ResponsiveContainer width="100%" height={350}>
        <BarChart data={genreData} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" />
          <YAxis type="category" dataKey="name" width={80} />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Bar dataKey="value" name="Count">
            {genreData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  const MonthlyTrendChart = () => (
    <div className="chart-container">
      <h3>📈 Monthly Added Trend</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={monthlyData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Line
            type="monotone"
            dataKey="added"
            stroke="#8884d8"
            name="Movies Added"
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );

  const WatchProgressChart = () => (
    <div className="chart-container">
      <h3>⏱️ Watch Progress (Top 10)</h3>
      <ResponsiveContainer width="100%" height={350}>
        <BarChart data={progressData} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" domain={[0, 100]} unit="%" />
          <YAxis type="category" dataKey="name" width={80} />
          <Tooltip content={<ProgressTooltip />} />
          <Legend />
          <Bar dataKey="progress" name="Completion %">
            {progressData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.type === "TV Show" ? "#00C49F" : "#0088FE"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  const TVShowProgressChart = () => {
    if (tvShows.length === 0) return null;

    return (
      <div className="chart-container">
        <h3>📺 TV Show Episode Progress</h3>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={episodeProgressData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" domain={[0, 100]} unit="%" />
            <YAxis type="category" dataKey="name" width={80} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="custom-tooltip">
                      <p className="tooltip-label">{data.fullName}</p>
                      <p className="tooltip-value">
                        Episodes: {data.episodesWatched} / {data.totalEpisodes}
                      </p>
                      <p className="tooltip-value">
                        Progress: {Math.round(data.progress)}%
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend />
            <Bar dataKey="progress" name="Episode Progress %" fill="#8884d8" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const ContentTypeChart = () => (
    <div className="chart-container">
      <h3>🎬 Content Type Distribution</h3>
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={contentTypeData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) =>
              `${name} (${(percent * 100).toFixed(0)}%)`
            }
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {contentTypeData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );

  // Top Lists
  const TopRatedList = () => {
    const topRatedMovies = movies
      .filter((movie) => movie.rating)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 5);

    return (
      <div className="stats-section card">
        <h3>🏆 Top Rated Content</h3>
        <div className="top-list">
          {topRatedMovies.length > 0 ? (
            topRatedMovies.map((movie, index) => (
              <div key={movie.id} className="list-item">
                <div className="rank-badge">#{index + 1}</div>
                <div className="item-content">
                  <h4>{movie.title}</h4>
                  <div className="item-meta">
                    <span className="rating">⭐ {movie.rating}/10</span>
                    <span className={`status-badge ${movie.status}`}>
                      {movie.status}
                    </span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="no-data">No rated content yet</p>
          )}
        </div>
      </div>
    );
  };

  const RecentlyAddedList = () => {
    // Fix for date handling - check if created_at exists and is valid
    const recentlyAdded = movies
      .filter((movie) => {
        // Check if created_at exists and is a valid date
        if (!movie.created_at) return false;
        const date = new Date(movie.created_at);
        return !isNaN(date.getTime());
      })
      .sort((a, b) => {
        const dateA = new Date(a.created_at);
        const dateB = new Date(b.created_at);
        return dateB - dateA; // Sort by most recent first
      })
      .slice(0, 5);

    return (
      <div className="stats-section card">
        <h3>🆕 Recently Added</h3>
        <div className="recent-list">
          {recentlyAdded.length > 0 ? (
            recentlyAdded.map((movie) => {
              const date = new Date(movie.created_at);
              const formattedDate = date.toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              });

              return (
                <div key={movie.id} className="list-item">
                  <div className="poster-mini">
                    {movie.poster_path ? (
                      <img src={movie.poster_path} alt={movie.title} />
                    ) : (
                      <div className="poster-placeholder-mini">🎬</div>
                    )}
                  </div>
                  <div className="item-content">
                    <h4>{movie.title}</h4>
                    <p className="date">{formattedDate}</p>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="no-data">No content added yet</p>
          )}
        </div>
      </div>
    );
  };

  // Key Metrics Cards
  const MetricCard = ({ icon, title, value, subtitle, color }) => (
    <div className="metric-card" style={{ borderTopColor: color }}>
      <div className="metric-icon" style={{ backgroundColor: color }}>
        {icon}
      </div>
      <div className="metric-content">
        <h3>{title}</h3>
        <p className="metric-value">{value}</p>
        <p className="metric-subtitle">{subtitle}</p>
      </div>
    </div>
  );

  return (
    <div className="stats-page">
      <Header
        title="Analytics Dashboard"
        subtitle="Visual insights into your movie and TV show collection"
        currentPage="stats"
      />

      <div className="stats-container">
        {/* Time Range Filter */}
        <div className="time-filter">
          <button
            className={`time-btn ${timeRange === "week" ? "active" : ""}`}
            onClick={() => setTimeRange("week")}
          >
            This Week
          </button>
          <button
            className={`time-btn ${timeRange === "month" ? "active" : ""}`}
            onClick={() => setTimeRange("month")}
          >
            This Month
          </button>
          <button
            className={`time-btn ${timeRange === "year" ? "active" : ""}`}
            onClick={() => setTimeRange("year")}
          >
            This Year
          </button>
          <button
            className={`time-btn ${timeRange === "all" ? "active" : ""}`}
            onClick={() => setTimeRange("all")}
          >
            All Time
          </button>
        </div>

        {/* Key Metrics */}
        <div className="metrics-grid">
          <MetricCard
            icon="🎬"
            title="Total Collection"
            value={stats.total || 0}
            subtitle="Movies & TV Shows"
            color="#0088FE"
          />
          <MetricCard
            icon="✅"
            title="Completed"
            value={stats.completed || 0}
            subtitle={`${
              stats.total
                ? Math.round((stats.completed / stats.total) * 100)
                : 0
            }% of collection`}
            color="#00C49F"
          />
          <MetricCard
            icon="👁️"
            title="Watching"
            value={stats.watching || 0}
            subtitle="Currently watching"
            color="#FFBB28"
          />
          <MetricCard
            icon="⭐"
            title="Average Rating"
            value={`${stats.average_rating || "0.0"}/10`}
            subtitle={`Based on ${
              movies.filter((m) => m.rating).length
            } ratings`}
            color="#FF8042"
          />
          <MetricCard
            icon="⏱️"
            title="Total Watch Time"
            value={`${Math.round((stats.total_minutes_watched || 0) / 60)}h`}
            subtitle={`${stats.total_minutes_watched || 0} minutes`}
            color="#8884D8"
          />
          <MetricCard
            icon="📺"
            title="TV Shows"
            value={movies.filter((m) => m.is_tv_show).length}
            subtitle="In collection"
            color="#82CA9D"
          />
        </div>

        {/* Main Charts Grid */}
        <div className="charts-grid">
          <div className="chart-row">
            <StatusDistributionChart />
            <PlatformDistributionChart />
          </div>

          <div className="chart-row">
            <GenreDistributionChart />
            <MonthlyTrendChart />
          </div>

          <div className="chart-row">
            <WatchProgressChart />
            <ContentTypeChart />
          </div>

          {tvShows.length > 0 && (
            <div className="chart-row1">
              <TVShowProgressChart />
            </div>
          )}
        </div>

        {/* Top Lists Sidebar */}
        <div className="lists-sidebar">
          <TopRatedList />
          <RecentlyAddedList />
        </div>

        {/* Quick Stats */}
        <div className="quick-stats">
          <div className="stat-badge">
            <span className="stat-number">
              {movies.filter((m) => m.rating >= 8).length}
            </span>
            <span className="stat-label">Highly Rated (8+⭐)</span>
          </div>
          <div className="stat-badge">
            <span className="stat-number">
              {
                movies.filter(
                  (m) => m.status === "watching" && m.minutes_watched > 0
                ).length
              }
            </span>
            <span className="stat-label">In Progress</span>
          </div>
          <div className="stat-badge">
            <span className="stat-number">
              {
                movies.filter((m) => m.is_tv_show && m.episodes_watched > 0)
                  .length
              }
            </span>
            <span className="stat-label">TV Shows Started</span>
          </div>
          <div className="stat-badge">
            <span className="stat-number">
              {
                movies.filter((m) => !m.is_tv_show && m.minutes_watched > 0)
                  .length
              }
            </span>
            <span className="stat-label">Movies Started</span>
          </div>
        </div>

        <div className="stats-actions">
          <Link to="/" className="btn btn-primary">
            ← Back to Collection
          </Link>
          <Link to="/search" className="btn btn-secondary">
            🔍 Search More Content
          </Link>
        </div>
      </div>
    </div>
  );
}

export default StatsPage;
