import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export const api = axios.create({
  baseURL: `${API_BASE}/api/v1`,
  withCredentials: true,
});

// Intercept 401 → redirect to login (skip if already on login page)
api.interceptors.response.use(
  (r) => r,
  async (err) => {
    if (
      err.response?.status === 401 &&
      typeof window !== "undefined" &&
      window.location.pathname !== "/"
    ) {
      window.location.href = "/";
    }
    return Promise.reject(err);
  }
);
