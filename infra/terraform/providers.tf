terraform {
  required_version = ">= 1.6.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
    azuread = {
      source  = "hashicorp/azuread"
      version = "~> 3.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

provider "azurerm" {
  features {}
  # Authenticates via `az login` (Azure CLI) during local bootstrap.
  # Optionally pin the subscription: `export ARM_SUBSCRIPTION_ID=<sub-id>`.
}

provider "azuread" {
  # Uses the same Azure CLI login as azurerm.
}
