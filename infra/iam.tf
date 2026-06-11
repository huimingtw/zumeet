resource "google_service_account" "cloud_run" {
  account_id   = "zumeet-cloud-run"
  display_name = "Zumeet Cloud Run Service Account"
}

resource "google_project_iam_member" "cloud_run_log_writer" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.cloud_run.email}"
}

resource "google_artifact_registry_repository_iam_member" "cloud_run_reader" {
  location   = var.region
  repository = google_artifact_registry_repository.zumeet.name
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:${google_service_account.cloud_run.email}"
}

# GitHub Actions deploy service account
resource "google_service_account" "github_actions" {
  account_id   = "zumeet-github-actions"
  display_name = "Zumeet GitHub Actions Deployer"
}

resource "google_artifact_registry_repository_iam_member" "github_push" {
  location   = var.region
  repository = google_artifact_registry_repository.zumeet.name
  role       = "roles/artifactregistry.writer"
  member     = "serviceAccount:${google_service_account.github_actions.email}"
}

resource "google_project_iam_member" "github_cloud_run_deploy" {
  project = var.project_id
  role    = "roles/run.admin"
  member  = "serviceAccount:${google_service_account.github_actions.email}"
}

resource "google_project_iam_member" "github_sa_user" {
  project = var.project_id
  role    = "roles/iam.serviceAccountUser"
  member  = "serviceAccount:${google_service_account.github_actions.email}"
}
