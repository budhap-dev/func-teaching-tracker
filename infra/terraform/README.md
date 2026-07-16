# Infrastructure — Azure Functions (Terraform)

Provisions **two isolated environments** (`dev`, `prod`) plus the CI/CD
identities for the Teaching Tracker API. Each environment gets its own:

- Resource group, Storage account (+ deployment container)
- Log Analytics workspace + Application Insights
- **Flex Consumption** plan (`FC1`) + Linux Function App (Node)
- **GitHub OIDC identity**: Azure AD app registration + federated credential
  (subject `repo:<owner>/<repo>:environment:<env>`) + `Contributor` role scoped to
  that environment's resource group — so GitHub Actions deploys with **no stored
  secrets**.

Environments are defined by the `environments` map in [variables.tf](variables.tf)
and materialised with `for_each` over the [function_app](modules/function_app) and
[github_oidc](modules/github_oidc) modules. Terraform is a **local bootstrap**
(local state, gitignored); GitHub Actions only builds and deploys application code.

## Layout

```
infra/terraform/
├── main.tf          # module calls (for_each over environments)
├── variables.tf     # project, github_*, environments map
├── outputs.tf       # per-env maps: client ids, app names, hostnames
├── modules/
│   ├── function_app/ # RG, storage, App Insights, plan, Function App
│   └── github_oidc/  # app registration, federated credential, role assignment
└── ../scripts/configure-github-environments.sh
```

## Prerequisites

- [Terraform](https://developer.hashicorp.com/terraform/install) >= 1.6
- [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) (`az`)
- [GitHub CLI](https://cli.github.com/) (`gh`), authenticated, plus `jq`
- Permission in the tenant to **create app registrations** and **assign roles**
  (Owner or User Access Administrator on the subscription).

## One-time bootstrap

```bash
# 1. Authenticate
az login
az account set --subscription "<your-subscription-id>"

# 2. Provision all three environments
cd infra/terraform
terraform init
terraform apply           # review the plan (3x everything), then type "yes"

# 3. Configure GitHub Environments + variables from the outputs (from repo root)
cd ../..
./infra/scripts/configure-github-environments.sh
```

Then add **required reviewers** to the `prod` environment (GitHub → repo Settings →
Environments → prod) so prod deploys wait for approval, and push to `main`.

## Notes

- **Node version**: each environment's `node_version` defaults to `24`. If a region
  doesn't offer it yet, set `22` or `20` for that env in `terraform.tfvars`.
- **Environment names are the contract**: the `environments` map keys must match the
  GitHub Environment names referenced in `.github/workflows/deploy.yml` (`dev`,
  `prod`) and the federated-credential subjects.
- **Regions/scale per env**: tune `location`, `maximum_instance_count`, and
  `instance_memory_in_mb` per environment in the `environments` map.
- **Teardown**: `terraform destroy` removes all resources for every environment.
