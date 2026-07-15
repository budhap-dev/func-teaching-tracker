# Contributing

Thanks for contributing to **func-teaching-tracker** — the Azure Functions
(Node.js + TypeScript) API behind Teaching Tracker.

## Prerequisites

- Node.js **>= 24**
- [Azure Functions Core Tools v4](https://learn.microsoft.com/azure/azure-functions/functions-run-local) (`npm i -g azure-functions-core-tools@4`)
- For infrastructure/deploy work: [Terraform](https://developer.hashicorp.com/terraform/install) >= 1.6, [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli), and [GitHub CLI](https://cli.github.com/)

## Local development

```bash
npm install
npm start          # cleans, builds, then runs `func start` on http://localhost:7071
```

For iterative development, run the compiler in watch mode alongside the host:

```bash
npm run watch      # terminal 1 — tsc -w
func start         # terminal 2
```

Each HTTP endpoint lives in its own file under `src/functions/` and self-registers
via `app.http(...)` (the Azure Functions Node.js v4 programming model). Business
logic goes in `src/services/`, types in `src/models/`, and shared HTTP helpers in
`src/shared/`. See [README.md](README.md) for the full project layout and API.

## Coding conventions

- **TypeScript strict mode** is on — keep the build clean (`npm run build`).
- Match the existing style: 4-space indentation, single quotes, no semicolons where
  the surrounding code omits them.
- One endpoint per file; keep handlers thin and push logic into services.

## Before you open a pull request

```bash
npm run build      # must compile with no errors
npm test           # (no tests configured yet — add them with your change)
```

- Branch off `main`; keep changes focused and commits descriptive.
- Update `README.md` / this file if you change behavior, endpoints, or setup.
- Do **not** commit secrets, `local.settings.json`, `dist/`, or Terraform state
  (`.gitignore` already excludes these).

## Deployment & CI/CD

There are **three environments** — `dev`, `test`, and `prod` — each a separate
Azure Function App. A push to `main` builds once and promotes the same artifact
through them sequentially via
[.github/workflows/deploy.yml](.github/workflows/deploy.yml):

```
build → deploy dev → deploy test → deploy prod (requires approval)
```

1. **build**: `npm ci` → `npm run build` → prune dev deps → upload the deployment
   artifact.
2. **dev / test / prod**: each calls the reusable
   [deploy-env.yml](.github/workflows/deploy-env.yml), which authenticates to Azure
   via **OIDC** (`azure/login`, no stored secrets) and deploys with
   `Azure/functions-action`. `prod` is gated by a GitHub Environment protection rule
   (required reviewer).

Each **GitHub Environment** holds its own variables (not secrets):
`AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `AZURE_FUNCTIONAPP_NAME`.

### Infrastructure

All Azure resources — three Flex Consumption Function Apps plus a per-environment
GitHub OIDC identity — are provisioned with Terraform under
[infra/terraform/](infra/terraform/) using a reusable module driven by an
`environments` map. It is a **one-time local bootstrap** with local state. See
[infra/terraform/README.md](infra/terraform/README.md) for the full runbook. In short:

```bash
az login
cd infra/terraform && terraform init && terraform apply     # creates dev/test/prod
cd ../.. && ./infra/scripts/configure-github-environments.sh # wires GitHub Environments
```

Then add a required reviewer to the `prod` environment in GitHub → Settings →
Environments. Changing infrastructure means editing the Terraform config and running
`terraform apply` locally — the CI pipeline only deploys application code.

## Manual deploy (fallback)

```bash
npm run clean && npm run build
func azure functionapp publish <your-function-app-name>
```
