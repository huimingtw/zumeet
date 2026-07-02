# Infra (Terraform)

Terraform configuration for GCP Cloud Run, Artifact Registry, Secret Manager, IAM, and GCS state bucket.

## Environments

Environment is driven by the Terraform workspace (`terraform.workspace`).
`default` workspace == production. Any other workspace name becomes a `-<env>` suffix
on per-env resources (Cloud Run service, its SA, secrets) and sets `APP_ENV` accordingly.

The Artifact Registry and GitHub Actions SA are shared singletons with no suffix —
they must exist before staging can use them (apply prod workspace first).

To add a staging environment, create the workspace and apply:

```bash
terraform workspace new staging
terraform workspace select staging
terraform apply -var project_id=production-361903 -var api_image=<IMAGE>
```

Then populate the staging secrets (`DATABASE_URL-staging`, etc.) and configure DNS.
