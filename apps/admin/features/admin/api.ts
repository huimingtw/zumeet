
import axios from "axios";

export const adminApi = axios.create({
  baseURL: import.meta.env.VITE_ADMIN_API_BASE ?? "/admin-api",
  withCredentials: true,
});

adminApi.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && typeof window !== "undefined") {
      window.location.href = "/login";
    }
    return Promise.reject(err);
  },
);
