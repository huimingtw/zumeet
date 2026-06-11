variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "asia-east1"
}

variable "api_image" {
  description = "Full image path for the API service (e.g. asia-east1-docker.pkg.dev/PROJECT/zumeet/api:latest)"
  type        = string
}
