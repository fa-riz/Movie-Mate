import axios from "axios";

const API_BASE =
  process.env.REACT_APP_API_URL ||
  "https://movie-mate-backend-production.up.railway.app";

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add request interceptor for error handling
api.interceptors.request.use(
  (config) => {
    console.log(
      `Making ${config.method?.toUpperCase()} request to: ${config.url}`
    );
    return config;
  },
  (error) => {
    console.error("Request error:", error);
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error("Response error:", error);

    if (error.code === "ECONNREFUSED") {
      console.error("Backend server is not running or inaccessible");
    } else if (error.response) {
      // Server responded with error status
      console.error(
        "Server error:",
        error.response.status,
        error.response.data
      );
    } else if (error.request) {
      // Request made but no response received
      console.error("No response received:", error.request);
    }

    return Promise.reject(error);
  }
);

export default api;
