import { POSTGRESQL_CONSTANTS, validateMemoryInputs, convertGBToBytes, convertBytesToGB, clamp } from './utils.js';

/**
 * Recommendation message constants for PostgreSQL
 */
const PG_RECOMMENDATION_MESSAGES = {
  LOW_MEMORY_ALLOCATION: "Consider allocating more memory to PostgreSQL by reducing reserved memory or memory for other tasks. For dedicated database servers, 70-80% of total memory should be available.",
  REASONABLE_MEMORY_ALLOCATION: "Your memory allocation is reasonable, but could be optimized further for better performance.",

  INCREASE_SHARED_BUFFERS: "Increase shared_buffers to 25% of available memory for dedicated database servers. This is PostgreSQL's main memory setting for caching data.",
  DECREASE_SHARED_BUFFERS: "Your shared_buffers may be too large. Values above 40% of total RAM rarely help and can hurt performance due to OS double-buffering.",

  INCREASE_WAL_SIZE: "Consider increasing max_wal_size for write-heavy workloads. This reduces checkpoint frequency and improves write performance.",

  TOO_MANY_CONNECTIONS: "Your max_connections setting may be too high. Each PostgreSQL connection uses ~10MB of memory. Consider using a connection pooler like PgBouncer.",
  USE_CONNECTION_POOLING: "For production workloads, strongly consider using PgBouncer or pgpool-II for connection pooling rather than increasing max_connections.",

  OPTIMIZE_RANDOM_PAGE_COST: "Adjust random_page_cost based on your storage type. SSDs/NVMe should use 1.1, HDDs should use 4.0.",
  INCREASE_IO_CONCURRENCY: "Increase effective_io_concurrency for SSD/NVMe storage to allow PostgreSQL to issue more concurrent I/O requests.",

  OPTIMIZED_CONFIG: "Your PostgreSQL configuration is well optimized for your hardware. Monitor pg_stat_activity, pg_stat_bgwriter, and query plans to fine-tune further."
};

/**
 * Core PostgreSQL calculations
 */
export class PostgreSQLCalculator {
  constructor() {
    this.lastInputs = {};
    this.lastResults = {};
    this.calculationCache = new Map();
  }

  /**
   * Main calculation method with caching
   */
  calculate(inputs, templateSettings = null) {
    const inputHash = this.hashInputs(inputs);
    const templateHash = templateSettings ? JSON.stringify(templateSettings) : 'none';
    const cacheKey = `${inputHash}-${templateHash}`;

    if (this.calculationCache.has(cacheKey)) {
      return this.calculationCache.get(cacheKey);
    }

    const results = this.performCalculations(inputs, templateSettings);

    if (this.calculationCache.size >= POSTGRESQL_CONSTANTS.CALCULATION_CACHE_SIZE) {
      const firstKey = this.calculationCache.keys().next().value;
      this.calculationCache.delete(firstKey);
    }
    this.calculationCache.set(cacheKey, results);

    return results;
  }

  hashInputs(inputs) {
    return JSON.stringify(inputs);
  }

  validateInputs(inputs) {
    const { totalMemory, reservedMemory, otherTasksMemory } = inputs;
    return validateMemoryInputs(totalMemory, reservedMemory, otherTasksMemory);
  }

  /**
   * Perform the actual PostgreSQL calculations
   */
  performCalculations(inputs, templateSettings) {
    const { totalMemory, reservedMemory, otherTasksMemory, storageType } = inputs;

    const availableMemory = Math.max(POSTGRESQL_CONSTANTS.MIN_VIABLE_MEMORY_GB, totalMemory - reservedMemory - otherTasksMemory);
    const availableMemoryBytes = convertGBToBytes(availableMemory);

    let calculations = this.calculateBaseSettings(availableMemory, availableMemoryBytes, totalMemory, storageType, inputs);

    if (templateSettings) {
      calculations = this.applyTemplateSettings(calculations, templateSettings, availableMemory, availableMemoryBytes, totalMemory);
    }

    const results = {
      inputs: { ...inputs, availableMemory },
      calculations,
      validationErrors: this.validateInputs(inputs)
    };

    return results;
  }

  /**
   * Calculate base PostgreSQL settings
   */
  calculateBaseSettings(availableMemory, availableMemoryBytes, totalMemory, storageType, inputs) {
    const PG = POSTGRESQL_CONSTANTS;

    // shared_buffers: 25% of available memory (PostgreSQL recommendation)
    const sharedBuffers = Math.floor(availableMemoryBytes * PG.SHARED_BUFFERS_PERCENTAGE);

    // effective_cache_size: 75% of available memory (OS cache + shared_buffers)
    const effectiveCacheSize = Math.floor(availableMemoryBytes * PG.EFFECTIVE_CACHE_SIZE_PERCENTAGE);

    // work_mem: available_memory / (max_connections * 2), with floor of 4MB
    // This is per-operation memory, and a single query can use multiple operations
    let maxConnections = Math.floor(availableMemory * PG.CONNECTIONS_PER_GB);

    // Apply connection caps
    if (totalMemory >= PG.SERVER_SIZE_THRESHOLDS.VERY_LARGE) {
      maxConnections = Math.min(maxConnections, PG.MAX_CONNECTIONS_CAPS.VERY_LARGE);
    } else if (totalMemory >= PG.SERVER_SIZE_THRESHOLDS.LARGE) {
      maxConnections = Math.min(maxConnections, PG.MAX_CONNECTIONS_CAPS.LARGE);
    } else if (totalMemory >= PG.SERVER_SIZE_THRESHOLDS.MEDIUM) {
      maxConnections = Math.min(maxConnections, PG.MAX_CONNECTIONS_CAPS.MEDIUM);
    } else {
      maxConnections = Math.min(maxConnections, PG.MAX_CONNECTIONS_CAPS.SMALL);
    }
    maxConnections = Math.max(maxConnections, 20);

    // work_mem calculation: memory left after shared_buffers, divided by expected active connections
    const memoryForWorkMem = availableMemoryBytes - sharedBuffers;
    const estimatedActiveConnections = Math.max(maxConnections * 0.3, 5);
    const workMemPerSort = Math.floor(memoryForWorkMem / (estimatedActiveConnections * 3));
    // Clamp between 4MB and 256MB
    const workMem = clamp(workMemPerSort, 4 * 1024 * 1024, 256 * 1024 * 1024);
    // Round down to nearest MB
    const workMemRounded = Math.floor(workMem / (1024 * 1024)) * 1024 * 1024;

    // maintenance_work_mem: 5% of available memory, max 2GB
    const maintenanceWorkMem = Math.min(
      Math.floor(availableMemoryBytes * PG.MAINTENANCE_WORK_MEM_PERCENTAGE),
      2 * 1024 * 1024 * 1024
    );
    const maintenanceWorkMemRounded = Math.floor(maintenanceWorkMem / (1024 * 1024)) * 1024 * 1024;

    // wal_buffers: 3% of shared_buffers, between 1MB and 64MB (auto-tuned by PG but we suggest)
    const walBuffers = clamp(
      Math.floor(sharedBuffers * PG.WAL_BUFFERS_PERCENTAGE),
      1024 * 1024,
      64 * 1024 * 1024
    );
    const walBuffersRounded = Math.floor(walBuffers / (1024 * 1024)) * 1024 * 1024;

    // max_wal_size based on server size
    let maxWalSizeGB = 1;
    if (totalMemory >= 64) {
      maxWalSizeGB = 4;
    } else if (totalMemory >= 32) {
      maxWalSizeGB = 2;
    }

    // min_wal_size
    const minWalSizeMB = maxWalSizeGB * 1024 / 4; // 1/4 of max_wal_size

    // Storage-dependent settings
    const storage = storageType || 'ssd';
    const randomPageCost = PG.RANDOM_PAGE_COST[storage] || PG.RANDOM_PAGE_COST.ssd;
    const effectiveIoConcurrency = PG.EFFECTIVE_IO_CONCURRENCY[storage] || PG.EFFECTIVE_IO_CONCURRENCY.ssd;

    // Parallel query settings
    let maxParallelWorkersPerGather = PG.MAX_PARALLEL_WORKERS_PER_GATHER;
    let maxParallelWorkers = PG.MAX_PARALLEL_WORKERS;
    let maxParallelMaintenanceWorkers = PG.MAX_PARALLEL_MAINTENANCE_WORKERS;

    if (totalMemory >= 64) {
      maxParallelWorkersPerGather = 4;
      maxParallelWorkers = 8;
      maxParallelMaintenanceWorkers = 4;
    } else if (totalMemory >= 32) {
      maxParallelWorkersPerGather = 4;
      maxParallelWorkers = 6;
      maxParallelMaintenanceWorkers = 2;
    } else if (totalMemory < 4) {
      maxParallelWorkersPerGather = 1;
      maxParallelWorkers = 2;
      maxParallelMaintenanceWorkers = 1;
    }

    const calculations = {
      // Memory settings
      shared_buffers: sharedBuffers,
      effective_cache_size: effectiveCacheSize,
      work_mem: workMemRounded || PG.WORK_MEM_BASE,
      maintenance_work_mem: maintenanceWorkMemRounded || 64 * 1024 * 1024,
      wal_buffers: walBuffersRounded || 16 * 1024 * 1024,

      // WAL settings
      max_wal_size: maxWalSizeGB + 'GB',
      min_wal_size: minWalSizeMB + 'MB',
      wal_level: PG.WAL_LEVEL_DEFAULT,
      checkpoint_completion_target: PG.CHECKPOINT_COMPLETION_TARGET,

      // Query planner settings
      random_page_cost: randomPageCost,
      effective_io_concurrency: effectiveIoConcurrency,

      // Connection settings
      max_connections: maxConnections,

      // Parallel query settings
      max_worker_processes: PG.MAX_WORKER_PROCESSES,
      max_parallel_workers_per_gather: maxParallelWorkersPerGather,
      max_parallel_workers: maxParallelWorkers,
      max_parallel_maintenance_workers: maxParallelMaintenanceWorkers,

      // Logging defaults
      log_min_duration_statement: 1000,
      log_checkpoints: 'on',
      log_connections: 'on',
      log_disconnections: 'on',
      log_lock_waits: 'on',
      log_temp_files: 0,

      // Misc
      default_statistics_target: totalMemory >= 16 ? 200 : 100,
      huge_pages: totalMemory >= 32 ? 'try' : 'off'
    };

    return calculations;
  }

  /**
   * Apply template settings to base calculations
   */
  applyTemplateSettings(baseCalculations, templateSettings, availableMemory, availableMemoryBytes, totalMemory) {
    const calculations = { ...baseCalculations };
    const PG = POSTGRESQL_CONSTANTS;

    if (templateSettings.shared_buffers_percentage) {
      calculations.shared_buffers = Math.floor(availableMemoryBytes * templateSettings.shared_buffers_percentage);
    }

    if (templateSettings.effective_cache_size_percentage) {
      calculations.effective_cache_size = Math.floor(availableMemoryBytes * templateSettings.effective_cache_size_percentage);
    }

    if (templateSettings.work_mem_multiplier) {
      calculations.work_mem = Math.floor(calculations.work_mem * templateSettings.work_mem_multiplier);
      // Round to nearest MB
      calculations.work_mem = Math.floor(calculations.work_mem / (1024 * 1024)) * 1024 * 1024;
      calculations.work_mem = Math.max(calculations.work_mem, 4 * 1024 * 1024);
    }

    if (templateSettings.maintenance_work_mem_percentage) {
      calculations.maintenance_work_mem = Math.min(
        Math.floor(availableMemoryBytes * templateSettings.maintenance_work_mem_percentage),
        2 * 1024 * 1024 * 1024
      );
      calculations.maintenance_work_mem = Math.floor(calculations.maintenance_work_mem / (1024 * 1024)) * 1024 * 1024;
    }

    if (templateSettings.max_connections_per_gb) {
      let maxConn = Math.floor(availableMemory * templateSettings.max_connections_per_gb);
      if (totalMemory >= PG.SERVER_SIZE_THRESHOLDS.VERY_LARGE) {
        maxConn = Math.min(maxConn, PG.MAX_CONNECTIONS_CAPS.VERY_LARGE);
      } else if (totalMemory >= PG.SERVER_SIZE_THRESHOLDS.LARGE) {
        maxConn = Math.min(maxConn, PG.MAX_CONNECTIONS_CAPS.LARGE);
      } else if (totalMemory >= PG.SERVER_SIZE_THRESHOLDS.MEDIUM) {
        maxConn = Math.min(maxConn, PG.MAX_CONNECTIONS_CAPS.MEDIUM);
      } else {
        maxConn = Math.min(maxConn, PG.MAX_CONNECTIONS_CAPS.SMALL);
      }
      calculations.max_connections = Math.max(maxConn, 20);
    }

    if (templateSettings.max_wal_size) {
      calculations.max_wal_size = templateSettings.max_wal_size;
    }

    if (templateSettings.checkpoint_completion_target !== undefined) {
      calculations.checkpoint_completion_target = templateSettings.checkpoint_completion_target;
    }

    if (templateSettings.default_statistics_target) {
      calculations.default_statistics_target = templateSettings.default_statistics_target;
    }

    if (templateSettings.max_parallel_workers_per_gather !== undefined) {
      calculations.max_parallel_workers_per_gather = templateSettings.max_parallel_workers_per_gather;
    }

    return calculations;
  }

  /**
   * Calculate performance score
   */
  calculatePerformanceScore(results) {
    const { inputs, calculations } = results;
    const { totalMemory, availableMemory } = inputs;

    const scores = {
      memoryAllocation: this.scoreMemoryAllocation(totalMemory, availableMemory),
      sharedBuffers: this.scoreSharedBuffers(calculations.shared_buffers, availableMemory),
      walSettings: this.scoreWalSettings(calculations, totalMemory),
      connections: this.scoreConnections(calculations.max_connections, availableMemory, totalMemory),
      queryPlanner: this.scoreQueryPlanner(calculations, inputs)
    };

    const totalScore = Object.values(scores).reduce((sum, score) => sum + score, 0);

    return {
      totalScore,
      scores,
      recommendations: this.generateRecommendations(scores, inputs, calculations)
    };
  }

  scoreMemoryAllocation(totalMemory, availableMemory) {
    const memoryRatio = availableMemory / totalMemory;
    if (memoryRatio >= 0.8) return POSTGRESQL_CONSTANTS.SCORE_WEIGHTS.memoryAllocation;
    if (memoryRatio >= 0.6) return Math.round(memoryRatio * 25);
    return Math.round(memoryRatio * 20);
  }

  scoreSharedBuffers(sharedBuffers, availableMemory) {
    const availableBytes = convertGBToBytes(availableMemory);
    const ratio = sharedBuffers / availableBytes;

    // PostgreSQL recommendation: 25% of RAM is optimal, up to 40% max
    if (ratio >= 0.20 && ratio <= 0.35) return POSTGRESQL_CONSTANTS.SCORE_WEIGHTS.sharedBuffers;
    if (ratio >= 0.15 && ratio <= 0.40) return 15;

    const deviation = Math.abs(0.25 - ratio);
    return Math.max(0, Math.round(POSTGRESQL_CONSTANTS.SCORE_WEIGHTS.sharedBuffers - (deviation * 60)));
  }

  scoreWalSettings(calculations, totalMemory) {
    let score = 10;

    // Check checkpoint_completion_target
    if (calculations.checkpoint_completion_target >= 0.7 && calculations.checkpoint_completion_target <= 0.9) {
      score += 5;
    }

    // Check max_wal_size proportional to server size
    const walSizeStr = calculations.max_wal_size;
    const walSizeGB = walSizeStr.endsWith('GB') ? parseFloat(walSizeStr) : parseFloat(walSizeStr) / 1024;
    if (totalMemory >= 32 && walSizeGB >= 2) {
      score += 5;
    } else if (totalMemory < 32 && walSizeGB >= 1) {
      score += 5;
    }

    return Math.min(POSTGRESQL_CONSTANTS.SCORE_WEIGHTS.walSettings, score);
  }

  scoreConnections(maxConnections, availableMemory, totalMemory) {
    const connectionsPerGB = maxConnections / availableMemory;

    // PostgreSQL prefers fewer connections than MySQL; optimal range is 25-75 per GB
    if (connectionsPerGB >= 25 && connectionsPerGB <= 75) {
      return POSTGRESQL_CONSTANTS.SCORE_WEIGHTS.connections;
    }

    if (connectionsPerGB > 75) {
      return Math.max(0, POSTGRESQL_CONSTANTS.SCORE_WEIGHTS.connections - Math.floor((connectionsPerGB - 75) / 10));
    }

    return Math.max(0, Math.round(POSTGRESQL_CONSTANTS.SCORE_WEIGHTS.connections * (connectionsPerGB / 25)));
  }

  scoreQueryPlanner(calculations, inputs) {
    const storage = inputs.storageType || 'ssd';
    let score = 0;

    // random_page_cost should match storage type
    if (storage === 'hdd' && calculations.random_page_cost >= 3.0) {
      score += 10;
    } else if ((storage === 'ssd' || storage === 'nvme') && calculations.random_page_cost <= 1.5) {
      score += 10;
    } else {
      score += 5;
    }

    // effective_io_concurrency should match storage
    if (storage === 'hdd' && calculations.effective_io_concurrency <= 4) {
      score += 5;
    } else if ((storage === 'ssd' || storage === 'nvme') && calculations.effective_io_concurrency >= 100) {
      score += 5;
    } else {
      score += 2;
    }

    // Parallel workers configured
    if (calculations.max_parallel_workers_per_gather >= 2) {
      score += 5;
    } else {
      score += 2;
    }

    return Math.min(POSTGRESQL_CONSTANTS.SCORE_WEIGHTS.queryPlanner, score);
  }

  generateRecommendations(scores, inputs, calculations) {
    const recommendations = [];
    const { availableMemory, totalMemory } = inputs;

    // Connection warnings
    if (calculations.max_connections > 500) {
      recommendations.push("WARNING: Connection counts above 500 are high for PostgreSQL. Each connection uses ~10MB of memory. Strongly consider using PgBouncer or pgpool-II for connection pooling.");
    } else if (calculations.max_connections > 200) {
      recommendations.push(PG_RECOMMENDATION_MESSAGES.USE_CONNECTION_POOLING);
    }

    // Memory allocation
    if (scores.memoryAllocation < 15) {
      recommendations.push(PG_RECOMMENDATION_MESSAGES.LOW_MEMORY_ALLOCATION);
    }

    // shared_buffers
    if (scores.sharedBuffers < 15) {
      const availableBytes = convertGBToBytes(availableMemory);
      const ratio = calculations.shared_buffers / availableBytes;
      if (ratio < 0.20) {
        recommendations.push(PG_RECOMMENDATION_MESSAGES.INCREASE_SHARED_BUFFERS);
      } else if (ratio > 0.40) {
        recommendations.push(PG_RECOMMENDATION_MESSAGES.DECREASE_SHARED_BUFFERS);
      }
    }

    // WAL settings
    if (scores.walSettings < 15) {
      recommendations.push(PG_RECOMMENDATION_MESSAGES.INCREASE_WAL_SIZE);
    }

    // Connection recommendations
    if (scores.connections < 15) {
      const connectionsPerGB = calculations.max_connections / availableMemory;
      if (connectionsPerGB > 75) {
        recommendations.push(PG_RECOMMENDATION_MESSAGES.TOO_MANY_CONNECTIONS);
      }
    }

    // Query planner
    if (scores.queryPlanner < 15) {
      const storage = inputs.storageType || 'ssd';
      if ((storage === 'ssd' || storage === 'nvme') && calculations.random_page_cost > 1.5) {
        recommendations.push(PG_RECOMMENDATION_MESSAGES.OPTIMIZE_RANDOM_PAGE_COST);
      }
      if ((storage === 'ssd' || storage === 'nvme') && calculations.effective_io_concurrency < 100) {
        recommendations.push(PG_RECOMMENDATION_MESSAGES.INCREASE_IO_CONCURRENCY);
      }
    }

    // Large server tips
    if (totalMemory >= 32 && calculations.huge_pages === 'off') {
      recommendations.push("Consider enabling huge_pages = 'try' for servers with 32GB+ RAM to reduce TLB misses and improve memory performance.");
    }

    if (recommendations.length === 0) {
      recommendations.push(PG_RECOMMENDATION_MESSAGES.OPTIMIZED_CONFIG);
    }

    return recommendations;
  }
}

// Export singleton instance
export const postgresqlCalculator = new PostgreSQLCalculator();
