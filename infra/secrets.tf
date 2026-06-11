locals {
  secret_names = [
    "DATABASE_URL",
    "JWT_SECRET",
    "ADMIN_JWT_SECRET",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "RESEND_API_KEY",
    "STORAGE_ACCESS_KEY",
    "STORAGE_SECRET_KEY",
  ]
}

resource "google_secret_manager_secret" "secrets" {
  for_each  = toset(local.secret_names)
  secret_id = each.value

  replication {
    auto {}
  }
}

# Allow Cloud Run service account to access secrets
resource "google_secret_manager_secret_iam_member" "cloud_run_access" {
  for_each  = toset(local.secret_names)
  secret_id = google_secret_manager_secret.secrets[each.value].secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.cloud_run.email}"
}
