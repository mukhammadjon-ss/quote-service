terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~>3.0"
    }
  }
}

provider "azurerm" {
  features {}
}

resource "azurerm_resource_group" "quote_service" {
  name     = "rg-quote-service-${var.environment}"
  location = var.location

  tags = {
    Environment = var.environment
    Project     = "quote-service"
  }
}

resource "azurerm_container_registry" "quote_service" {
  name                = "acrquoteservice${var.environment}"
  resource_group_name = azurerm_resource_group.quote_service.name
  location           = azurerm_resource_group.quote_service.location
  sku                = "Standard"
  admin_enabled      = true

  tags = {
    Environment = var.environment
  }
}

resource "azurerm_container_app_environment" "quote_service" {
  name                = "cae-quote-service-${var.environment}"
  location           = azurerm_resource_group.quote_service.location
  resource_group_name = azurerm_resource_group.quote_service.name

  tags = {
    Environment = var.environment
  }
}

resource "azurerm_cosmosdb_account" "quote_service" {
  name                = "cosmos-quote-service-${var.environment}"
  location           = azurerm_resource_group.quote_service.location
  resource_group_name = azurerm_resource_group.quote_service.name
  offer_type         = "Standard"
  kind               = "MongoDB"

  enable_automatic_failover = true

  consistency_policy {
    consistency_level       = "BoundedStaleness"
    max_interval_in_seconds = 300
    max_staleness_prefix    = 100000
  }

  geo_location {
    location          = var.location
    failover_priority = 0
  }

  tags = {
    Environment = var.environment
  }
}

resource "azurerm_redis_cache" "quote_service" {
  name                = "redis-quote-service-${var.environment}"
  location           = azurerm_resource_group.quote_service.location
  resource_group_name = azurerm_resource_group.quote_service.name
  capacity           = 2
  family             = "C"
  sku_name           = "Standard"
  enable_non_ssl_port = false
  minimum_tls_version = "1.2"

  tags = {
    Environment = var.environment
  }
}

resource "azurerm_container_app" "quote_service" {
  name                         = "ca-quote-service-${var.environment}"
  container_app_environment_id = azurerm_container_app_environment.quote_service.id
  resource_group_name         = azurerm_resource_group.quote_service.name
  revision_mode               = "Single"

  template {
    container {
      name   = "quote-service"
      image  = "${azurerm_container_registry.quote_service.login_server}/quote-service:latest"
      cpu    = 0.25
      memory = "0.5Gi"

      env {
        name  = "MONGODB_URL"
        value = azurerm_cosmosdb_account.quote_service.connection_strings[0]
      }

      env {
        name  = "REDIS_URL"
        value = "rediss://:${azurerm_redis_cache.quote_service.primary_access_key}@${azurerm_redis_cache.quote_service.hostname}:6380"
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }
    }

    max_replicas = 10
    min_replicas = 1
  }

  ingress {
    external_enabled = true
    target_port      = 3000

    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }

  registry {
    server   = azurerm_container_registry.quote_service.login_server
    username = azurerm_container_registry.quote_service.admin_username
    password = azurerm_container_registry.quote_service.admin_password
  }

  tags = {
    Environment = var.environment
  }
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"
}

variable "location" {
  description = "Azure region"
  type        = string
  default     = "West Europe"
}

output "app_url" {
  value = azurerm_container_app.quote_service.latest_revision_fqdn
}

output "container_registry_login_server" {
  value = azurerm_container_registry.quote_service.login_server
}