# PostgreSQL Support Implementation Plan

**Status:** Planning Phase
**Target Branch:** `claude/add-postgres-calculator-k7Orx`
**Estimated Scope:** ~1,500-2,000 lines of new code
**Risk Level:** Low (modular architecture, additive changes)

---

## Executive Summary

This document outlines the implementation plan for adding PostgreSQL configuration calculator support to the MySQL/MariaDB Settings Calculator. The existing modular architecture allows us to add PostgreSQL support without modifying existing MySQL functionality.

### Goals
- ✅ Add PostgreSQL configuration calculations alongside MySQL/MariaDB
- ✅ Support PostgreSQL-specific settings and best practices
- ✅ Generate `postgresql.conf` and `pg_hba.conf` files
- ✅ Maintain existing MySQL/MariaDB functionality unchanged
- ✅ Provide workload templates for PostgreSQL (OLTP, OLAP, Mixed, Web, Small VPS)

### Non-Goals
- ❌ Remove or modify existing MySQL/MariaDB functionality
- ❌ Database migration tools
- ❌ SQL query optimization
- ❌ Backend server implementation

---

## Architecture Overview

### Current Architecture
```
User Input → MySQLCalculator → ConfigGenerator → Output (my.cnf)
                ↓
           Templates (MySQL)
```

### Proposed Architecture
```
User Input → Database Type Selector
                ↓                    ↓
         MySQLCalculator      PostgreSQLCalculator
                ↓                    ↓
         MySQL Templates      PostgreSQL Templates
                ↓                    ↓
         ConfigGenerator (supports both formats)
                ↓                    ↓
         my.cnf output        postgresql.conf output
```

---

## Implementation Phases

### Phase 1: Foundation & Constants (Est. ~150 lines)

**File:** `assets/js/utils.js`

**Tasks:**
1. Add `POSTGRESQL_CONSTANTS` object with PostgreSQL-specific settings
2. Add PostgreSQL utility functions
3. Add PostgreSQL validation helpers

**New Constants to Add:**

```javascript
export const POSTGRESQL_CONSTANTS = {
  // Memory allocation percentages (PostgreSQL uses conservative values)
  SHARED_BUFFERS_PERCENTAGE: 0.25,      // Max 25% of RAM (vs MySQL 70%)
  EFFECTIVE_CACHE_SIZE_PERCENTAGE: 0.75, // 75% of RAM for query planner
  WORK_MEM_BASE: 4 * 1024 * 1024,       // 4MB base per operation
  MAINTENANCE_WORK_MEM_PERCENTAGE: 0.05, // 5% for VACUUM, CREATE INDEX
  WAL_BUFFERS_PERCENTAGE: 0.03,          // 3% for Write-Ahead Log

  // Connection settings
  CONNECTIONS_PER_GB: 50,                // PostgreSQL handles fewer connections
  MAX_CONNECTIONS_CAPS: {
    VERY_LARGE: 500,                     // vs MySQL 2000
    LARGE: 400,
    MEDIUM: 300,
    SMALL: 200
  },

  // WAL (Write-Ahead Log) settings
  WAL_SIZE_RATIO: 0.15,                  // WAL size as % of shared_buffers
  CHECKPOINT_COMPLETION_TARGET: 0.9,

  // Storage type multipliers (PostgreSQL has different I/O patterns)
  STORAGE_RANDOM_PAGE_COST: {
    nvme: 1.1,
    ssd: 1.5,
    hdd: 4.0
  },

  STORAGE_EFFECTIVE_IO_CONCURRENCY: {
    nvme: 200,
    ssd: 100,
    hdd: 2
  },

  // Worker processes
  MAX_WORKER_PROCESSES: 8,
  MAX_PARALLEL_WORKERS_PER_GATHER: 4,
  MAX_PARALLEL_WORKERS: 8
};
```

**Deliverables:**
- [ ] `POSTGRESQL_CONSTANTS` object
- [ ] `validatePostgreSQLInputs()` function
- [ ] `formatBytesPostgreSQL()` helper
- [ ] PostgreSQL-specific calculation helpers

---

### Phase 2: PostgreSQL Calculator Class (Est. ~600 lines)

**File:** `assets/js/calculations.js`

**Tasks:**
1. Create `PostgreSQLCalculator` class (parallel to `MySQLCalculator`)
2. Implement PostgreSQL-specific calculation methods
3. Add PostgreSQL performance scoring
4. Add PostgreSQL-specific recommendations

**Key Calculations:**

| PostgreSQL Setting | Formula | MySQL Equivalent |
|-------------------|---------|------------------|
| `shared_buffers` | 25% of available RAM (max) | `innodb_buffer_pool_size` (70%) |
| `effective_cache_size` | 75% of total RAM | Implicit in MySQL |
| `work_mem` | (RAM - shared_buffers) / (max_connections × 3) | `sort_buffer_size` |
| `maintenance_work_mem` | 5% of available RAM (max 2GB) | Similar to `key_buffer_size` |
| `wal_buffers` | 3% of `shared_buffers` (min 14MB, max 1GB) | `innodb_log_buffer_size` |
| `max_wal_size` | 15% of `shared_buffers` | `innodb_log_file_size` |
| `checkpoint_completion_target` | 0.9 (static) | `innodb_flush_log_at_trx_commit` |
| `random_page_cost` | 1.1 (NVMe), 1.5 (SSD), 4.0 (HDD) | Implicit in MySQL |
| `effective_io_concurrency` | 200 (NVMe), 100 (SSD), 2 (HDD) | `innodb_io_capacity` |
| `max_connections` | 50 per GB (lower than MySQL) | `max_connections` |
| `max_worker_processes` | CPU cores (max 8) | N/A |
| `max_parallel_workers` | CPU cores (max 8) | N/A |

**Class Structure:**

```javascript
export class PostgreSQLCalculator {
  constructor() {
    this.lastInputs = {};
    this.lastResults = {};
    this.calculationCache = new Map();
  }

  calculate(inputs, templateSettings = null) {
    // Main calculation entry point
  }

  performCalculations(inputs, templateSettings) {
    const availableMemory = this.calculateAvailableMemory(inputs);

    const baseSettings = this.calculateBaseSettings(availableMemory, inputs);
    const derivedSettings = this.calculateDerivedSettings(baseSettings, inputs);
    const templateAdjusted = this.applyTemplateSettings(derivedSettings, templateSettings);

    const performanceScore = this.calculatePerformanceScore(templateAdjusted, inputs);
    const recommendations = this.generateRecommendations(templateAdjusted, inputs);

    return {
      calculations: templateAdjusted,
      performanceScore,
      recommendations,
      inputs
    };
  }

  calculateBaseSettings(availableMemory, inputs) {
    // Calculate shared_buffers, effective_cache_size, work_mem, etc.
  }

  calculateDerivedSettings(baseSettings, inputs) {
    // Calculate WAL settings, worker processes, etc.
  }

  applyTemplateSettings(settings, templateSettings) {
    // Override with workload-specific optimizations
  }

  calculatePerformanceScore(settings, inputs) {
    // Score based on PostgreSQL best practices
  }

  generateRecommendations(settings, inputs) {
    // PostgreSQL-specific optimization recommendations
  }
}
```

**PostgreSQL-Specific Recommendations:**

```javascript
const POSTGRESQL_RECOMMENDATION_MESSAGES = {
  INCREASE_SHARED_BUFFERS: "For dedicated PostgreSQL servers, shared_buffers can be 25% of RAM. For servers > 32GB RAM, this is optimal.",

  EFFECTIVE_CACHE_SIZE_LOW: "effective_cache_size should be set to 50-75% of total system memory. This helps the query planner make better decisions.",

  WORK_MEM_TOO_HIGH: "work_mem may be too high. Remember: this is per operation, and a complex query can use multiple work_mem allocations. Total memory usage = work_mem × max_connections × query complexity.",

  INCREASE_MAINTENANCE_WORK_MEM: "For servers with >16GB RAM, increase maintenance_work_mem to 1-2GB to speed up VACUUM, CREATE INDEX, and other maintenance operations.",

  WAL_SIZE_OPTIMIZATION: "max_wal_size controls checkpoint frequency. Larger values reduce I/O but increase recovery time. For write-heavy workloads, consider increasing.",

  PARALLEL_WORKERS_AVAILABLE: "Your server can benefit from parallel query execution. Ensure max_parallel_workers_per_gather and max_parallel_workers are configured for analytical queries.",

  RANDOM_PAGE_COST_TUNING: "With SSD/NVMe storage, reduce random_page_cost to 1.1-1.5 to encourage index usage in query plans.",

  CONNECTION_POOLING_RECOMMENDED: "PostgreSQL uses one process per connection. For > 200 connections, consider using PgBouncer or pgpool-II for connection pooling.",

  CHECKPOINT_WARNING: "With checkpoint_completion_target = 0.9, PostgreSQL spreads checkpoint writes over 90% of the checkpoint interval, reducing I/O spikes.",

  OPTIMIZED_CONFIG: "Your PostgreSQL configuration follows best practices for your hardware. Monitor query performance and adjust work_mem and shared_buffers based on actual workload patterns."
};
```

**Deliverables:**
- [ ] `PostgreSQLCalculator` class
- [ ] PostgreSQL calculation methods
- [ ] Performance scoring for PostgreSQL
- [ ] PostgreSQL-specific recommendations
- [ ] Unit tests for calculations

---

### Phase 3: PostgreSQL Templates (Est. ~180 lines)

**File:** `assets/js/templates.js`

**Tasks:**
1. Add 5 PostgreSQL workload templates
2. Define PostgreSQL-specific optimizations per template
3. Update template loader to support database type filtering

**PostgreSQL Templates:**

```javascript
export const POSTGRESQL_WORKLOAD_TEMPLATES = {
  postgresql_oltp: {
    name: 'PostgreSQL OLTP',
    description: 'Optimized for high-frequency transactions (e-commerce, financial systems)',
    databaseType: 'postgresql',
    settings: {
      shared_buffers_percentage: 0.25,
      effective_cache_size_percentage: 0.75,
      work_mem_multiplier: 0.8,              // Lower work_mem for many concurrent operations
      maintenance_work_mem_percentage: 0.05,
      max_connections_per_gb: 60,
      random_page_cost: 1.1,
      effective_io_concurrency: 200,
      checkpoint_completion_target: 0.9,
      wal_buffers_multiplier: 1.0,
      max_wal_size_multiplier: 1.2,          // Larger WAL for write-heavy
      synchronous_commit: 'on',
      max_parallel_workers_per_gather: 0      // Disable parallelism for OLTP
    }
  },

  postgresql_olap: {
    name: 'PostgreSQL OLAP',
    description: 'Optimized for analytics and complex reporting queries',
    databaseType: 'postgresql',
    settings: {
      shared_buffers_percentage: 0.25,
      effective_cache_size_percentage: 0.75,
      work_mem_multiplier: 2.0,              // Higher work_mem for large sorts/aggregations
      maintenance_work_mem_percentage: 0.10, // More for CREATE INDEX
      max_connections_per_gb: 30,            // Fewer connections, more resources each
      random_page_cost: 1.1,
      effective_io_concurrency: 200,
      checkpoint_completion_target: 0.9,
      wal_buffers_multiplier: 0.8,
      max_wal_size_multiplier: 0.8,
      synchronous_commit: 'off',             // Can disable for analytics
      max_parallel_workers_per_gather: 4,    // Enable parallelism
      max_parallel_workers: 8
    }
  },

  postgresql_mixed: {
    name: 'PostgreSQL Mixed Workload',
    description: 'Balanced configuration for transactional + analytical workloads',
    databaseType: 'postgresql',
    settings: {
      shared_buffers_percentage: 0.25,
      effective_cache_size_percentage: 0.75,
      work_mem_multiplier: 1.0,
      maintenance_work_mem_percentage: 0.05,
      max_connections_per_gb: 50,
      random_page_cost: 1.1,
      effective_io_concurrency: 200,
      checkpoint_completion_target: 0.9,
      wal_buffers_multiplier: 1.0,
      max_wal_size_multiplier: 1.0,
      synchronous_commit: 'on',
      max_parallel_workers_per_gather: 2
    }
  },

  postgresql_webserver: {
    name: 'PostgreSQL Web Application',
    description: 'Optimized for web applications with moderate database load',
    databaseType: 'postgresql',
    settings: {
      shared_buffers_percentage: 0.20,       // Lower for shared server
      effective_cache_size_percentage: 0.60,
      work_mem_multiplier: 0.7,
      maintenance_work_mem_percentage: 0.03,
      max_connections_per_gb: 80,            // More connections for web apps
      random_page_cost: 1.1,
      effective_io_concurrency: 100,
      checkpoint_completion_target: 0.9,
      wal_buffers_multiplier: 0.8,
      max_wal_size_multiplier: 0.8,
      synchronous_commit: 'on',
      max_parallel_workers_per_gather: 0
    }
  },

  postgresql_smallserver: {
    name: 'PostgreSQL Small VPS',
    description: 'Conservative settings for small VPS (1-4GB RAM)',
    databaseType: 'postgresql',
    settings: {
      shared_buffers_percentage: 0.15,       // Very conservative
      effective_cache_size_percentage: 0.50,
      work_mem_multiplier: 0.5,
      maintenance_work_mem_percentage: 0.02,
      max_connections_per_gb: 40,
      random_page_cost: 1.5,
      effective_io_concurrency: 50,
      checkpoint_completion_target: 0.9,
      wal_buffers_multiplier: 0.7,
      max_wal_size_multiplier: 0.6,
      synchronous_commit: 'on',
      max_parallel_workers_per_gather: 0
    }
  }
};

// Merge with existing MySQL templates
export const WORKLOAD_TEMPLATES = {
  ...MYSQL_WORKLOAD_TEMPLATES,
  ...POSTGRESQL_WORKLOAD_TEMPLATES
};
```

**Deliverables:**
- [ ] 5 PostgreSQL workload templates
- [ ] Template filtering by database type
- [ ] Updated template documentation

---

### Phase 4: Configuration Generators (Est. ~350 lines)

**File:** `assets/js/config-generator.js`

**Tasks:**
1. Add `generatePostgresqlConf()` method
2. Add `generatePgHbaConf()` method
3. Update Docker Compose generator for PostgreSQL
4. Update Kubernetes ConfigMap generator for PostgreSQL
5. Add PostgreSQL JSON export

**PostgreSQL Configuration Formats:**

#### 4.1 postgresql.conf Generator

```javascript
generatePostgresqlConf(results, options = {}) {
  const { inputs, calculations } = results;
  const {
    includeComments = true,
    postgresqlVersion = '16',
    includeReplication = true,
    includeLogging = true,
    includeSecurity = true
  } = options;

  const sections = [];

  // Header
  if (includeComments) {
    sections.push(this.generatePostgreSQLHeader(inputs));
  }

  // Memory settings
  sections.push(this.generatePostgreSQLMemorySection(calculations, includeComments));

  // WAL settings
  sections.push(this.generatePostgreSQLWALSection(calculations, includeComments));

  // Query planner settings
  sections.push(this.generatePostgreSQLPlannerSection(calculations, includeComments));

  // Connection settings
  sections.push(this.generatePostgreSQLConnectionSection(calculations, includeComments));

  // Worker processes
  sections.push(this.generatePostgreSQLWorkerSection(calculations, includeComments));

  // Optional: Logging
  if (includeLogging) {
    sections.push(this.generatePostgreSQLLoggingSection(includeComments));
  }

  // Optional: Replication
  if (includeReplication) {
    sections.push(this.generatePostgreSQLReplicationSection(includeComments));
  }

  // Optional: Security
  if (includeSecurity) {
    sections.push(this.generatePostgreSQLSecuritySection(includeComments));
  }

  return sections.join('\n\n');
}
```

**Sample Output:**

```conf
# PostgreSQL Configuration File
# Generated by MySQL/MariaDB Settings Calculator (PostgreSQL Edition)
# Generated on: 2026-02-10
#
# Server Specifications:
# - Total Memory: 32 GB
# - Available Memory: 28 GB
# - Operating System: linux
# - Storage Type: nvme
# - PostgreSQL Version: 16
#
# IMPORTANT: Always test configurations in a development environment first!

#------------------------------------------------------------------------------
# MEMORY SETTINGS
#------------------------------------------------------------------------------

shared_buffers = 7GB                    # 25% of available memory
effective_cache_size = 24GB             # 75% of total memory
work_mem = 16MB                         # Per-operation memory
maintenance_work_mem = 1GB              # For VACUUM, CREATE INDEX

#------------------------------------------------------------------------------
# WRITE-AHEAD LOG (WAL)
#------------------------------------------------------------------------------

wal_buffers = 224MB                     # 3% of shared_buffers
max_wal_size = 1GB
min_wal_size = 256MB
checkpoint_completion_target = 0.9
wal_compression = on

#------------------------------------------------------------------------------
# QUERY PLANNER
#------------------------------------------------------------------------------

random_page_cost = 1.1                  # Optimized for NVMe
effective_io_concurrency = 200          # For NVMe storage
seq_page_cost = 1.0

#------------------------------------------------------------------------------
# CONNECTIONS
#------------------------------------------------------------------------------

max_connections = 200
superuser_reserved_connections = 3

#------------------------------------------------------------------------------
# PARALLEL QUERIES
#------------------------------------------------------------------------------

max_worker_processes = 8
max_parallel_workers_per_gather = 4
max_parallel_workers = 8
max_parallel_maintenance_workers = 4

#------------------------------------------------------------------------------
# LOGGING
#------------------------------------------------------------------------------

logging_collector = on
log_directory = 'log'
log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
log_rotation_age = 1d
log_rotation_size = 100MB
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
log_checkpoints = on
log_connections = on
log_disconnections = on
log_duration = off
log_lock_waits = on
log_min_duration_statement = 1000       # Log queries > 1 second

#------------------------------------------------------------------------------
# REPLICATION
#------------------------------------------------------------------------------

wal_level = replica
max_wal_senders = 10
max_replication_slots = 10
hot_standby = on
```

#### 4.2 pg_hba.conf Generator

```javascript
generatePgHbaConf(options = {}) {
  const {
    allowLocalConnections = true,
    allowIPv4Connections = true,
    allowIPv6Connections = true,
    trustedNetworks = ['127.0.0.1/32'],
    authMethod = 'scram-sha-256'
  } = options;

  return `# PostgreSQL Client Authentication Configuration File (pg_hba.conf)
# Generated by MySQL/MariaDB Settings Calculator (PostgreSQL Edition)
#
# TYPE  DATABASE        USER            ADDRESS                 METHOD

# Local connections
${allowLocalConnections ? 'local   all             all                                     peer' : '# local connections disabled'}

# IPv4 local connections
${allowIPv4Connections ? 'host    all             all             127.0.0.1/32            ' + authMethod : '# IPv4 local disabled'}

# IPv6 local connections
${allowIPv6Connections ? 'host    all             all             ::1/128                 ' + authMethod : '# IPv6 local disabled'}

# Trusted networks
${trustedNetworks.map(net => `host    all             all             ${net.padEnd(23)}  ${authMethod}`).join('\n')}

# Replication connections
${allowLocalConnections ? 'local   replication     all                                     peer' : ''}
${allowIPv4Connections ? 'host    replication     all             127.0.0.1/32            ' + authMethod : ''}
${allowIPv6Connections ? 'host    replication     all             ::1/128                 ' + authMethod : ''}`;
}
```

#### 4.3 Docker Compose for PostgreSQL

```javascript
generateDockerComposeConfig(results, options = {}) {
  const { databaseType = 'mysql' } = options;

  if (databaseType === 'postgresql') {
    return this.generatePostgreSQLDockerCompose(results, options);
  }

  return this.generateMySQLDockerCompose(results, options);
}

generatePostgreSQLDockerCompose(results, options) {
  const { calculations } = results;

  return `version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: postgres-optimized
    restart: unless-stopped

    environment:
      POSTGRES_USER: \${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD:-changeme}
      POSTGRES_DB: \${POSTGRES_DB:-myapp}

      # PostgreSQL tuning parameters
      POSTGRES_SHARED_BUFFERS: "${calculations.shared_buffers}"
      POSTGRES_EFFECTIVE_CACHE_SIZE: "${calculations.effective_cache_size}"
      POSTGRES_WORK_MEM: "${calculations.work_mem}"
      POSTGRES_MAINTENANCE_WORK_MEM: "${calculations.maintenance_work_mem}"
      POSTGRES_MAX_CONNECTIONS: "${calculations.max_connections}"

    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./postgresql.conf:/etc/postgresql/postgresql.conf:ro
      - ./pg_hba.conf:/etc/postgresql/pg_hba.conf:ro

    command: >
      postgres
      -c config_file=/etc/postgresql/postgresql.conf

    ports:
      - "5432:5432"

    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
    driver: local`;
}
```

#### 4.4 Kubernetes ConfigMap for PostgreSQL

```javascript
generateKubernetesConfig(results, options = {}) {
  const { databaseType = 'mysql' } = options;

  if (databaseType === 'postgresql') {
    return this.generatePostgreSQLKubernetesConfig(results, options);
  }

  return this.generateMySQLKubernetesConfig(results, options);
}

generatePostgreSQLKubernetesConfig(results, options) {
  const postgresqlConf = this.generatePostgresqlConf(results, options);
  const pgHbaConf = this.generatePgHbaConf(options);

  return `apiVersion: v1
kind: ConfigMap
metadata:
  name: postgresql-config
  namespace: default
data:
  postgresql.conf: |
${postgresqlConf.split('\n').map(line => '    ' + line).join('\n')}

  pg_hba.conf: |
${pgHbaConf.split('\n').map(line => '    ' + line).join('\n')}

---
apiVersion: v1
kind: Secret
metadata:
  name: postgresql-secret
  namespace: default
type: Opaque
stringData:
  POSTGRES_USER: postgres
  POSTGRES_PASSWORD: changeme
  POSTGRES_DB: myapp

---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgresql
  namespace: default
spec:
  serviceName: postgresql
  replicas: 1
  selector:
    matchLabels:
      app: postgresql
  template:
    metadata:
      labels:
        app: postgresql
    spec:
      containers:
      - name: postgresql
        image: postgres:16-alpine
        ports:
        - containerPort: 5432
          name: postgresql
        envFrom:
        - secretRef:
            name: postgresql-secret
        volumeMounts:
        - name: postgresql-data
          mountPath: /var/lib/postgresql/data
        - name: postgresql-config
          mountPath: /etc/postgresql
        command:
        - postgres
        - -c
        - config_file=/etc/postgresql/postgresql.conf
        resources:
          requests:
            memory: "${results.inputs.totalMemory}Gi"
            cpu: "2"
          limits:
            memory: "${results.inputs.totalMemory}Gi"
            cpu: "4"
      volumes:
      - name: postgresql-config
        configMap:
          name: postgresql-config
  volumeClaimTemplates:
  - metadata:
      name: postgresql-data
    spec:
      accessModes: [ "ReadWriteOnce" ]
      resources:
        requests:
          storage: 100Gi`;
}
```

**Deliverables:**
- [ ] `generatePostgresqlConf()` method
- [ ] `generatePgHbaConf()` method
- [ ] PostgreSQL Docker Compose generator
- [ ] PostgreSQL Kubernetes generator
- [ ] PostgreSQL JSON export format
- [ ] Configuration format tests

---

### Phase 5: UI Integration (Est. ~200 lines)

**Files:** `assets/js/ui.js`, `assets/js/main.js`, `assets/js/dom-cache.js`, `index.html`

**Tasks:**
1. Add database type selector to UI
2. Update template dropdown to filter by database type
3. Add conditional field visibility
4. Update export options for PostgreSQL
5. Add PostgreSQL version selector
6. Update documentation links

#### 5.1 HTML Changes (`index.html`)

**Add Database Type Selector:**

```html
<!-- Add after the title, before workload template selector -->
<div class="mb-6">
  <label for="databaseType" class="block text-sm font-medium text-gray-700 mb-2">
    Database Type
  </label>
  <select
    id="databaseType"
    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    aria-label="Select database type"
  >
    <option value="mysql">MySQL / MariaDB</option>
    <option value="postgresql">PostgreSQL</option>
  </select>
  <p class="mt-2 text-sm text-gray-500">
    Select your database engine to get optimized configuration recommendations.
  </p>
</div>

<!-- Update workload template label to be database-aware -->
<div class="mb-6">
  <label for="workloadTemplate" class="block text-sm font-medium text-gray-700 mb-2">
    <span id="workloadTemplateLabel">Workload Template (MySQL/MariaDB)</span>
  </label>
  <select
    id="workloadTemplate"
    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    aria-label="Select workload template"
  >
    <!-- Options will be populated dynamically based on database type -->
  </select>
</div>

<!-- Add PostgreSQL version selector (shown only when PostgreSQL is selected) -->
<div id="postgresqlVersionContainer" class="mb-6" style="display: none;">
  <label for="postgresqlVersion" class="block text-sm font-medium text-gray-700 mb-2">
    PostgreSQL Version
  </label>
  <select
    id="postgresqlVersion"
    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
  >
    <option value="16">PostgreSQL 16 (Latest)</option>
    <option value="15">PostgreSQL 15</option>
    <option value="14">PostgreSQL 14</option>
    <option value="13">PostgreSQL 13</option>
    <option value="12">PostgreSQL 12</option>
  </select>
</div>

<!-- Update MySQL version container to show/hide based on database type -->
<div id="mysqlVersionContainer" class="mb-6">
  <!-- Existing MySQL version selector -->
</div>
```

#### 5.2 DOM Cache Updates (`dom-cache.js`)

```javascript
export const DOM_ELEMENTS = {
  // ... existing elements ...

  // New PostgreSQL elements
  databaseType: () => document.getElementById('databaseType'),
  postgresqlVersion: () => document.getElementById('postgresqlVersion'),
  postgresqlVersionContainer: () => document.getElementById('postgresqlVersionContainer'),
  mysqlVersionContainer: () => document.getElementById('mysqlVersionContainer'),
  workloadTemplateLabel: () => document.getElementById('workloadTemplateLabel'),

  // ... rest of elements ...
};
```

#### 5.3 Main Application Updates (`main.js`)

```javascript
import { MySQLCalculator } from './calculations.js';
import { PostgreSQLCalculator } from './calculations.js';
import { ConfigGenerator } from './config-generator.js';
import { UI } from './ui.js';

class DatabaseCalculatorApp {
  constructor() {
    // Initialize both calculators
    this.calculators = {
      mysql: new MySQLCalculator(),
      postgresql: new PostgreSQLCalculator()
    };

    this.configGenerator = new ConfigGenerator();
    this.ui = new UI();

    this.currentDatabaseType = 'mysql'; // Default

    this.init();
  }

  init() {
    this.setupEventListeners();
    this.ui.init();
    this.loadSavedSettings();
  }

  setupEventListeners() {
    // Database type change
    const dbTypeSelector = document.getElementById('databaseType');
    dbTypeSelector?.addEventListener('change', (e) => {
      this.handleDatabaseTypeChange(e.target.value);
    });

    // ... existing event listeners ...
  }

  handleDatabaseTypeChange(databaseType) {
    this.currentDatabaseType = databaseType;

    // Update UI to show/hide database-specific elements
    this.ui.updateForDatabaseType(databaseType);

    // Re-populate workload templates
    this.ui.populateWorkloadTemplates(databaseType);

    // Recalculate with new database type
    this.calculate();
  }

  async calculate() {
    const inputs = this.ui.getInputs();
    const templateSettings = this.ui.getSelectedTemplate();

    // Select appropriate calculator
    const calculator = this.calculators[this.currentDatabaseType];

    // Perform calculation
    const results = calculator.calculate(inputs, templateSettings);

    // Update UI with results
    this.ui.displayResults(results, this.currentDatabaseType);

    return results;
  }

  generateConfig(format = 'default') {
    const results = this.lastResults;

    // Determine default format based on database type
    if (format === 'default') {
      format = this.currentDatabaseType === 'postgresql' ? 'postgresql.conf' : 'my.cnf';
    }

    const config = this.configGenerator.generateConfig(
      results,
      format,
      { databaseType: this.currentDatabaseType }
    );

    return config;
  }
}

// Initialize app
const app = new DatabaseCalculatorApp();
```

#### 5.4 UI Updates (`ui.js`)

```javascript
export class UI {
  // ... existing methods ...

  updateForDatabaseType(databaseType) {
    // Show/hide version selectors
    const postgresqlVersionContainer = document.getElementById('postgresqlVersionContainer');
    const mysqlVersionContainer = document.getElementById('mysqlVersionContainer');

    if (databaseType === 'postgresql') {
      postgresqlVersionContainer.style.display = 'block';
      mysqlVersionContainer.style.display = 'none';
    } else {
      postgresqlVersionContainer.style.display = 'none';
      mysqlVersionContainer.style.display = 'block';
    }

    // Update workload template label
    const label = document.getElementById('workloadTemplateLabel');
    if (label) {
      label.textContent = databaseType === 'postgresql'
        ? 'Workload Template (PostgreSQL)'
        : 'Workload Template (MySQL/MariaDB)';
    }

    // Update export button text
    const exportBtn = document.getElementById('exportConfigBtn');
    if (exportBtn) {
      exportBtn.textContent = databaseType === 'postgresql'
        ? 'Download postgresql.conf'
        : 'Download my.cnf';
    }
  }

  populateWorkloadTemplates(databaseType) {
    const templateSelect = document.getElementById('workloadTemplate');
    if (!templateSelect) return;

    // Clear existing options
    templateSelect.innerHTML = '';

    // Filter templates by database type
    const templates = Object.entries(WORKLOAD_TEMPLATES)
      .filter(([key, template]) => {
        if (databaseType === 'postgresql') {
          return key.startsWith('postgresql_');
        } else {
          return !key.startsWith('postgresql_');
        }
      });

    // Add default option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = databaseType === 'postgresql'
      ? 'Select PostgreSQL Workload...'
      : 'Select MySQL Workload...';
    templateSelect.appendChild(defaultOption);

    // Add filtered templates
    templates.forEach(([key, template]) => {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = template.name;
      templateSelect.appendChild(option);
    });
  }

  displayResults(results, databaseType) {
    // Update results table with database-specific column headers
    this.updateResultsTable(results, databaseType);

    // Update configuration output
    this.updateConfigOutput(results, databaseType);

    // Update performance score
    this.updatePerformanceScore(results);

    // Update recommendations
    this.updateRecommendations(results);
  }

  updateResultsTable(results, databaseType) {
    const tableBody = document.getElementById('resultsTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = '';

    const { calculations } = results;

    // Define settings to display based on database type
    const settingsToDisplay = databaseType === 'postgresql'
      ? this.getPostgreSQLSettings(calculations)
      : this.getMySQLSettings(calculations);

    settingsToDisplay.forEach(({ name, value, description }) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td class="px-4 py-3 font-medium text-gray-900">${name}</td>
        <td class="px-4 py-3 text-gray-700 font-mono">${value}</td>
        <td class="px-4 py-3 text-sm text-gray-600">${description}</td>
      `;
      tableBody.appendChild(row);
    });
  }

  getPostgreSQLSettings(calculations) {
    return [
      {
        name: 'shared_buffers',
        value: calculations.shared_buffers,
        description: 'Memory allocated for caching data (25% of RAM max)'
      },
      {
        name: 'effective_cache_size',
        value: calculations.effective_cache_size,
        description: 'Estimate of OS + PostgreSQL cache (75% of RAM)'
      },
      {
        name: 'work_mem',
        value: calculations.work_mem,
        description: 'Memory per sort/hash operation'
      },
      {
        name: 'maintenance_work_mem',
        value: calculations.maintenance_work_mem,
        description: 'Memory for VACUUM, CREATE INDEX'
      },
      {
        name: 'max_connections',
        value: calculations.max_connections,
        description: 'Maximum concurrent database connections'
      },
      {
        name: 'wal_buffers',
        value: calculations.wal_buffers,
        description: 'Write-Ahead Log buffer size'
      },
      {
        name: 'max_wal_size',
        value: calculations.max_wal_size,
        description: 'Maximum WAL size before checkpoint'
      },
      {
        name: 'checkpoint_completion_target',
        value: calculations.checkpoint_completion_target,
        description: 'Checkpoint spread (0.0-1.0)'
      },
      {
        name: 'random_page_cost',
        value: calculations.random_page_cost,
        description: 'Cost estimate for random I/O (lower for SSD/NVMe)'
      },
      {
        name: 'effective_io_concurrency',
        value: calculations.effective_io_concurrency,
        description: 'Concurrent I/O operations (higher for SSD/NVMe)'
      },
      {
        name: 'max_worker_processes',
        value: calculations.max_worker_processes,
        description: 'Background worker processes'
      },
      {
        name: 'max_parallel_workers_per_gather',
        value: calculations.max_parallel_workers_per_gather,
        description: 'Parallel workers per query operation'
      },
      {
        name: 'max_parallel_workers',
        value: calculations.max_parallel_workers,
        description: 'Total parallel workers'
      }
    ];
  }

  getMySQLSettings(calculations) {
    // Existing MySQL settings display
    return [
      // ... existing MySQL settings ...
    ];
  }
}
```

**Deliverables:**
- [ ] Database type selector in HTML
- [ ] PostgreSQL version selector
- [ ] Conditional UI visibility
- [ ] Dynamic template filtering
- [ ] Database-aware results display
- [ ] Updated export buttons
- [ ] DOM cache updates
- [ ] Main app multi-calculator support

---

## Testing Strategy

### Unit Tests
- [ ] PostgreSQL calculation accuracy
- [ ] Template application correctness
- [ ] Configuration file format validation
- [ ] Memory allocation formulas
- [ ] Edge cases (very small/large servers)

### Integration Tests
- [ ] Database type switching
- [ ] Template loading and application
- [ ] Config generation for all formats
- [ ] Export functionality

### Manual Testing Checklist
- [ ] Test with 1GB RAM server
- [ ] Test with 256GB RAM server
- [ ] Test all 5 PostgreSQL templates
- [ ] Test all storage types (HDD, SSD, NVMe)
- [ ] Test all OS types (Linux, Windows, macOS)
- [ ] Verify postgresql.conf syntax
- [ ] Verify pg_hba.conf syntax
- [ ] Test Docker Compose config
- [ ] Test Kubernetes ConfigMap
- [ ] Test JSON export

---

## Documentation Updates

### README.md Updates
- [ ] Add PostgreSQL support to feature list
- [ ] Add PostgreSQL calculation methodology
- [ ] Add PostgreSQL vs MySQL parameter comparison table
- [ ] Add PostgreSQL version compatibility notes
- [ ] Update screenshots to show database type selector

### New Documentation
- [ ] Create `POSTGRESQL_CALCULATIONS.md` explaining formulas
- [ ] Create `DATABASE_COMPARISON.md` (MySQL vs PostgreSQL)
- [ ] Add PostgreSQL FAQs

---

## Key Differences: MySQL vs PostgreSQL

| Aspect | MySQL/MariaDB | PostgreSQL | Implementation Impact |
|--------|---------------|-----------|----------------------|
| **Buffer Memory** | `innodb_buffer_pool_size` = 70% RAM | `shared_buffers` = 25% RAM max | Different calculation formulas |
| **Effective Cache** | Implicit | `effective_cache_size` = 75% RAM | New parameter to add |
| **Work Memory** | `sort_buffer_size` (per thread) | `work_mem` (per operation) | Different allocation strategy |
| **Query Cache** | `query_cache_size` (deprecated in 8.0) | N/A (no query cache) | Omit for PostgreSQL |
| **Connections** | Threads (lighter) | Processes (heavier) | Lower max_connections |
| **Transaction Logs** | InnoDB redo logs | WAL (Write-Ahead Log) | Different settings |
| **I/O Configuration** | `innodb_io_capacity` | `effective_io_concurrency`, `random_page_cost` | Different parameters |
| **Parallel Execution** | Limited | Native support | Add worker process settings |
| **Config File** | `my.cnf` / `my.ini` | `postgresql.conf` + `pg_hba.conf` | Two files vs one |
| **Authentication** | In main config | Separate `pg_hba.conf` | Need separate generator |

---

## Risk Assessment

### Low Risk
✅ Additive changes (no modifications to existing MySQL code)
✅ Modular architecture supports multiple calculators
✅ Well-defined PostgreSQL best practices exist

### Medium Risk
⚠️ UI complexity increases with database type switching
⚠️ Need to maintain two sets of templates and constants
⚠️ Configuration file syntax differences

### Mitigation Strategies
- Comprehensive unit tests for both calculators
- Separate PostgreSQL and MySQL code paths (no shared logic that could break)
- Validation for all generated configuration files
- Progressive rollout: develop → test → production

---

## Success Criteria

### Functional Requirements
- [ ] PostgreSQL calculator produces accurate settings based on best practices
- [ ] All 5 PostgreSQL templates work correctly
- [ ] `postgresql.conf` and `pg_hba.conf` files generate with valid syntax
- [ ] Docker Compose and Kubernetes configs work for PostgreSQL
- [ ] Database type switching works smoothly in UI
- [ ] All existing MySQL functionality remains unchanged

### Performance Requirements
- [ ] Calculation time < 100ms for both databases
- [ ] UI switching < 50ms
- [ ] No regression in MySQL calculation performance

### Quality Requirements
- [ ] 80%+ test coverage for new code
- [ ] All generated configs pass syntax validation
- [ ] Accessible UI (ARIA labels, keyboard navigation)
- [ ] Mobile-responsive design maintained

---

## Rollout Plan

### Phase 1: Development (This PR)
1. Implement PostgreSQL calculator
2. Add PostgreSQL templates
3. Create configuration generators
4. Update UI for database type selection
5. Write unit tests

### Phase 2: Testing
1. Internal testing with various server sizes
2. Validate generated configs against real PostgreSQL instances
3. Cross-browser testing
4. Accessibility testing

### Phase 3: Documentation
1. Update README
2. Create PostgreSQL-specific documentation
3. Add code comments
4. Create usage examples

### Phase 4: Release
1. Merge to main branch
2. Deploy to production
3. Announce new PostgreSQL support
4. Monitor for issues

---

## Open Questions

1. **PostgreSQL Version Support:** Should we support PostgreSQL 11 and older? (Decision: 12+ only)
2. **Connection Pooling:** Should we add PgBouncer/pgpool-II configuration generation? (Decision: Future enhancement)
3. **Replication Settings:** How detailed should replication settings be? (Decision: Basic settings, link to docs for advanced)
4. **Extension Support:** Should we recommend PostgreSQL extensions (pg_stat_statements, etc.)? (Decision: Add as recommendations)

---

## Future Enhancements (Out of Scope for This PR)

- 🔮 Support for other databases (MongoDB, Redis, etc.)
- 🔮 PgBouncer configuration generator
- 🔮 PostgreSQL extension recommendations (pg_stat_statements, timescaledb, etc.)
- 🔮 Automated performance testing against real database instances
- 🔮 Configuration diff tool (compare two configs)
- 🔮 Import existing config and suggest improvements
- 🔮 Cloud-specific configurations (AWS RDS, Azure PostgreSQL, Google Cloud SQL)

---

## References

### PostgreSQL Official Documentation
- [PostgreSQL 16 Documentation](https://www.postgresql.org/docs/16/)
- [Resource Consumption](https://www.postgresql.org/docs/16/runtime-config-resource.html)
- [WAL Configuration](https://www.postgresql.org/docs/16/runtime-config-wal.html)
- [Query Planning](https://www.postgresql.org/docs/16/runtime-config-query.html)

### Performance Tuning Guides
- [PGTune](https://pgtune.leopard.in.ua/) - PostgreSQL configuration wizard (for reference)
- [PostgreSQL Performance Optimization](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [Tuning Your PostgreSQL Server](https://wiki.postgresql.org/wiki/Tuning_Your_PostgreSQL_Server)

### Best Practices
- [EDB Blog: PostgreSQL Configuration](https://www.enterprisedb.com/postgres-tutorials/how-tune-postgresql-memory)
- [Cybertec: PostgreSQL Configuration](https://www.cybertec-postgresql.com/en/tuning-max_connections-in-postgresql/)

---

## Approval Checklist

Before merging this implementation, verify:

- [ ] All code follows existing style guidelines
- [ ] Unit tests pass with > 80% coverage
- [ ] Manual testing completed for all database types
- [ ] Documentation updated
- [ ] No regressions in MySQL functionality
- [ ] Accessibility requirements met
- [ ] Cross-browser compatibility verified
- [ ] Code review completed
- [ ] Performance benchmarks met

---

## Estimated Timeline

| Phase | Estimated Effort | Dependencies |
|-------|-----------------|--------------|
| Phase 1: Foundation | 2-3 hours | None |
| Phase 2: Calculator | 4-6 hours | Phase 1 complete |
| Phase 3: Templates | 2-3 hours | Phase 2 complete |
| Phase 4: Config Generators | 4-5 hours | Phase 2 complete |
| Phase 5: UI Integration | 3-4 hours | All phases complete |
| Testing | 2-3 hours | Implementation complete |
| Documentation | 2-3 hours | Implementation complete |
| **Total** | **19-27 hours** | Sequential implementation |

---

## Contributors

- Implementation: Claude Code
- Review: TBD
- Testing: TBD

---

**Status:** ✅ Plan approved, ready for implementation
**Last Updated:** 2026-02-10
