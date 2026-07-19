variable "project" {
  description = "Short project name prefix (lowercase alphanumeric)."
  type        = string
}

variable "env" {
  description = "Environment name (e.g. dev, prod)."
  type        = string
}

variable "location" {
  description = "Azure region — UK South for the data account (REQ-009 §10.1)."
  type        = string
}

variable "tags" {
  description = "Tags applied to all resources."
  type        = map(string)
  default     = {}
}
