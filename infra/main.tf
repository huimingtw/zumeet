terraform {
  required_version = ">= 1.6"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }

  backend "gcs" {
    bucket = "zumeet-tf-state"
    prefix = "terraform/state"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

locals {
  # Environment is driven by the Terraform workspace.
  # default workspace == production (keeps existing resource names unchanged).
  env     = terraform.workspace == "default" ? "production" : terraform.workspace
  is_prod = local.env == "production"

  # prod stays unsuffixed so its state/resources are untouched; staging gets "-staging".
  suffix = local.is_prod ? "" : "-${local.env}"

  api_host     = local.is_prod ? "api.zumeet.tw" : "api.${local.env}.zumeet.tw"
  redirect_url = "https://${local.api_host}/api/v1/auth/google/callback"
}
