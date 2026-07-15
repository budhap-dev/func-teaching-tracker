#!/usr/bin/env bash
#
# Configure GitHub Environments (dev/test/prod) and their AZURE_* variables from
# Terraform outputs, so the deploy pipeline can authenticate via OIDC.
#
# Prereqs: gh (authenticated), terraform, jq. Run from the repo root AFTER
# `terraform apply` has succeeded.
#
#   ./infra/scripts/configure-github-environments.sh
#
set -euo pipefail

TF_DIR="infra/terraform"
ENVIRONMENTS=(dev test prod)

for tool in gh terraform jq; do
  command -v "$tool" >/dev/null || { echo "error: '$tool' is required but not installed." >&2; exit 1; }
done

REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
echo "Repository: $REPO"

TENANT_ID=$(terraform -chdir="$TF_DIR" output -raw azure_tenant_id)
SUBSCRIPTION_ID=$(terraform -chdir="$TF_DIR" output -raw azure_subscription_id)
CLIENT_IDS=$(terraform -chdir="$TF_DIR" output -json azure_client_ids)
APP_NAMES=$(terraform -chdir="$TF_DIR" output -json function_app_names)

for ENV in "${ENVIRONMENTS[@]}"; do
  echo "==> Configuring environment: $ENV"

  # Create the environment (idempotent; no-op if it already exists).
  gh api -X PUT "repos/$REPO/environments/$ENV" >/dev/null

  CLIENT_ID=$(jq -r --arg e "$ENV" '.[$e]' <<<"$CLIENT_IDS")
  APP_NAME=$(jq -r --arg e "$ENV" '.[$e]' <<<"$APP_NAMES")

  gh variable set AZURE_TENANT_ID        --env "$ENV" -b "$TENANT_ID"
  gh variable set AZURE_SUBSCRIPTION_ID  --env "$ENV" -b "$SUBSCRIPTION_ID"
  gh variable set AZURE_CLIENT_ID        --env "$ENV" -b "$CLIENT_ID"
  gh variable set AZURE_FUNCTIONAPP_NAME --env "$ENV" -b "$APP_NAME"
done

cat <<'EOF'

Done. GitHub Environments dev/test/prod are configured.

To require manual approval before PROD deploys, add required reviewers:
  GitHub -> repo Settings -> Environments -> prod -> "Required reviewers"
(or: gh api -X PUT repos/<owner>/<repo>/environments/prod \
       -F 'reviewers[][type]=User' -F 'reviewers[][id]=<your-numeric-user-id>')
EOF
