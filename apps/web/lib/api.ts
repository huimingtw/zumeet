import axios, { type InternalAxiosRequestConfig } from "axios";
import type { ApiFieldError } from "@/types";

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export const api = axios.create({
  baseURL: `${API_BASE}/api/v1`,
  withCredentials: true,
});

let refreshPromise: Promise<void> | null = null;

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    if (err.response?.status !== 401 || typeof window === "undefined") {
      return Promise.reject(err);
    }

    const config = err.config as RetryableConfig | undefined;

    // Refresh endpoint itself returned 401 — refresh token is expired/invalid
    if (config?.url?.includes("/auth/refresh")) {
      if (window.location.pathname !== "/") {
        window.location.href = "/";
      }
      return Promise.reject(err);
    }

    // Already retried once after a successful refresh — give up
    if (config?._retry) {
      if (window.location.pathname !== "/") {
        window.location.href = "/";
      }
      return Promise.reject(err);
    }

    // Deduplicate concurrent refresh calls: all 401s share one refresh attempt
    if (!refreshPromise) {
      refreshPromise = api
        .post<void>("/auth/refresh")
        .then(() => undefined)
        .finally(() => {
          refreshPromise = null;
        });
    }

    try {
      await refreshPromise;
    } catch {
      if (window.location.pathname !== "/") {
        window.location.href = "/";
      }
      return Promise.reject(err);
    }

    if (!config) {
      return Promise.reject(err);
    }

    config._retry = true;
    return api(config);
  }
);

export function extractFieldErrors(err: unknown): Record<string, string> {
  if (err && typeof err === "object" && "response" in err) {
    const e = err as { response?: { data?: { fields?: ApiFieldError[] } } };
    const fields = e.response?.data?.fields;
    if (Array.isArray(fields)) {
      return Object.fromEntries(fields.map((f) => [f.field, f.message]));
    }
  }
  return {};
}
