output "cloud_run_url" {
  description = "Cloud Run service URL"
  value       = google_cloud_run_v2_service.api.uri
}

output "artifact_registry_repo" {
  description = "Artifact Registry repository path"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.zumeet.repository_id}"
}

output "github_actions_sa_email" {
  description = "GitHub Actions service account email (add as GCLOUD_SA_EMAIL secret)"
  value       = google_service_account.github_actions.email
}
