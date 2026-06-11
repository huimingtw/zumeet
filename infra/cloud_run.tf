locals {
  secret_env_vars = [
    { name = "DATABASE_URL",        secret = "DATABASE_URL" },
    { name = "JWT_SECRET",          secret = "JWT_SECRET" },
    { name = "ADMIN_JWT_SECRET",    secret = "ADMIN_JWT_SECRET" },
    { name = "GOOGLE_CLIENT_ID",    secret = "GOOGLE_CLIENT_ID" },
    { name = "GOOGLE_CLIENT_SECRET", secret = "GOOGLE_CLIENT_SECRET" },
    { name = "RESEND_API_KEY",      secret = "RESEND_API_KEY" },
    { name = "STORAGE_ACCESS_KEY",  secret = "STORAGE_ACCESS_KEY" },
    { name = "STORAGE_SECRET_KEY",  secret = "STORAGE_SECRET_KEY" },
  ]
}

resource "google_cloud_run_v2_service" "api" {
  name     = "zumeet-api"
  location = var.region

  template {
    service_account = google_service_account.cloud_run.email

    scaling {
      min_instance_count = 0
      max_instance_count = 5
    }

    # Graceful shutdown: Cloud Run sends SIGTERM; app has 10s to drain
    timeout = "30s"

    containers {
      image = var.api_image

      ports {
        container_port = 8080
      }

      env {
        name  = "APP_ENV"
        value = "production"
      }

      env {
        name  = "STORAGE_USE_SSL"
        value = "true"
      }

      env {
        name  = "GOOGLE_REDIRECT_URL"
        value = "https://api.zumeet.tw/api/v1/auth/google/callback"
      }

      dynamic "env" {
        for_each = local.secret_env_vars
        content {
          name = env.value.name
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.secrets[env.value.secret].secret_id
              version = "latest"
            }
          }
        }
      }

      resources {
        limits = {
          cpu    = "1000m"
          memory = "512Mi"
        }
      }
    }
  }

  depends_on = [
    google_secret_manager_secret.secrets,
    google_service_account.cloud_run,
  ]
}

# Allow unauthenticated public access (JWT auth is handled in app layer)
resource "google_cloud_run_v2_service_iam_member" "public" {
  name     = google_cloud_run_v2_service.api.name
  location = var.region
  role     = "roles/run.invoker"
  member   = "allUsers"
}
