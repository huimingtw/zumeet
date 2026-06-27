
import axios from "axios";

export const adminApi = axios.create({
  baseURL: "/admin-api",
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
