resource "google_artifact_registry_repository" "zumeet" {
  location      = var.region
  repository_id = "zumeet"
  format        = "DOCKER"
  description   = "Zumeet API container images"
}
