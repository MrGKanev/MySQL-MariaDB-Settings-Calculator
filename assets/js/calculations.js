import { CONSTANTS, validateMemoryInputs, determineFlushMethod, getStorageOptimizations, calculateBufferPoolInstances, calculateIOThreads, calculateTableSettings, convertGBToBytes, clamp } from './utils.js';

/**
 * Core MySQL/MariaDB calculations
 */
export class MySQLCalculator {
  constructor() {
    this.lastInputs = {};
    this.lastResults = {};
    this.calculationCache = new Map();
  }

  /**
   * Main calculation method with smart recalculation
   */
  calculate(inputs, templateSettings = null) {
    const inputHash = this.hashInputs(inputs);
    const templateHash = templateSettings ? JSON.stringify(templateSettings) : 'none';
    const cacheKey = `${inputHash}-${templateHash}`;

    // Check if we can reuse previous calculations
    if (this.calculationCache.has(cacheKey)) {
      return this.calculationCache.get(cacheKey);
    }

    const results = this.performCalculations(inputs, templateSettings);
    
    // Cache results (keep only last 5 calculations to prevent memory issues)
    if (this.calculationCache.size >= 5) {
      const firstKey = this.calculationCache.keys().next().value;
      this.calculationCache.delete(firstKey);
    }
    this.calculationCache.set(cacheKey, results);

    return results;
  }

  /**
   * Hash inputs to detect changes
   */
  hashInputs(inputs) {
    return JSON.stringify(inputs);
  }

  /**
   * Validate inputs before calculation
   */
  validateInputs(inputs) {
    const { totalMemory, reservedMemory, otherTasksMemory } = inputs;
    return validateMemoryInputs(totalMemory, reservedMemory, otherTasksMemory);
  }

  /**
   * Perform the actual MySQL calculations
   */
  performCalculations(inputs, templateSettings) {
    const { totalMemory, reservedMemory, otherTasksMemory, osType, storageType } = inputs;
    
    // Calculate available memory
    const availableMemory = Math.max(0, totalMemory - reservedMemory - otherTasksMemory);
    const availableMemoryBytes = convertGBToBytes(availableMemory);

    // Get storage optimizations
    const storageOpts = getStorageOptimizations(storageType);
    
    // Base calculations (before template modifications)
    let calculations = this.calculateBaseSettings(availableMemory, availableMemoryBytes, totalMemory, storageOpts);
    
    // Apply template settings if provided
    if (templateSettings) {
      calculations = this.applyTemplateSettings(calculations, templateSettings, availableMemory, availableMemoryBytes);
    }

    // Add OS-specific settings
    calculations.innodb_flush_method = determineFlushMethod(osType);
    
    // Add derived settings
    calculations = this.calculateDerivedSettings(calculations, totalMemory, availableMemory);

    // Store for performance score calculation
    const results = {
      inputs: { ...inputs, availableMemory },
      calculations,
      validationErrors: this.validateInputs(inputs)
    };

    return results;
  }

  /**
   * Calculate base MySQL settings without template modifications
   */
  calculateBaseSettings(availableMemory, availableMemoryBytes, totalMemory, storageOpts) {
    // Smart buffer pool calculation based on server size
    let bufferPoolPercentage = CONSTANTS.BUFFER_POOL_PERCENTAGE;
    if (totalMemory > 32) {
      bufferPoolPercentage = 0.6; // Large servers need less percentage
    } else if (totalMemory > 16) {
      bufferPoolPercentage = 0.65;
    }

    // Smart connections per GB based on server size
    let connectionsPerGB = CONSTANTS.CONNECTIONS_PER_GB;
    if (totalMemory < 4) {
      connectionsPerGB = 75; // Smaller servers more conservative
    } else if (totalMemory > 32) {
      connectionsPerGB = 120; // Larger servers can handle more
    }

    const calculations = {
      // Core InnoDB settings
      innodb_buffer_pool_size: Math.floor(availableMemoryBytes * bufferPoolPercentage),
      innodb_log_buffer_size: Math.min(
        Math.floor(availableMemoryBytes * CONSTANTS.LOG_BUFFER_PERCENTAGE),
        CONSTANTS.MAX_LOG_BUFFER_SIZE
      ),
      innodb_flush_log_at_trx_commit: CONSTANTS.FLUSH_LOG_AT_TRX_COMMIT,
      innodb_file_per_table: CONSTANTS.FILE_PER_TABLE,
      innodb_thread_concurrency: CONSTANTS.THREAD_CONCURRENCY,
      innodb_flush_neighbors: storageOpts.flushNeighbors,

      // Connection settings
      max_connections: Math.floor(availableMemory * connectionsPerGB),

      // MyISAM settings
      key_buffer_size: Math.floor(availableMemoryBytes * CONSTANTS.KEY_BUFFER_PERCENTAGE),

      // Query cache (commented for MySQL 8+)
      query_cache_size: Math.floor(availableMemoryBytes * CONSTANTS.QUERY_CACHE_PERCENTAGE),

      // Temporary tables
      tmp_table_size: Math.floor(availableMemoryBytes * CONSTANTS.TMP_TABLE_PERCENTAGE),

      // I/O settings
      innodb_io_capacity: Math.floor(availableMemory * storageOpts.ioCapacityMultiplier),

      // Buffer sizes with limits
      sort_buffer_size: Math.min(
        Math.floor(availableMemoryBytes * CONSTANTS.SORT_BUFFER_PERCENTAGE),
        CONSTANTS.MAX_SORT_BUFFER_SIZE
      ),
      read_buffer_size: Math.min(
        Math.floor(availableMemoryBytes * CONSTANTS.READ_BUFFER_PERCENTAGE),
        CONSTANTS.MAX_READ_BUFFER_SIZE
      ),
      read_rnd_buffer_size: Math.min(
        Math.floor(availableMemoryBytes * CONSTANTS.READ_RND_BUFFER_PERCENTAGE),
        CONSTANTS.MAX_READ_RND_BUFFER_SIZE
      ),
      join_buffer_size: Math.min(
        Math.floor(availableMemoryBytes * CONSTANTS.JOIN_BUFFER_PERCENTAGE),
        CONSTANTS.MAX_JOIN_BUFFER_SIZE
      )
    };

    // Calculate log file size based on buffer pool
    calculations.innodb_log_file_size = Math.floor(calculations.innodb_buffer_pool_size * CONSTANTS.LOG_FILE_RATIO);

    // Adjust IO capacity for larger servers
    if (totalMemory > 16) {
      calculations.innodb_io_capacity = Math.floor(calculations.innodb_io_capacity * 1.5);
    }

    return calculations;
  }

  /**
   * Apply template settings to base calculations
   */
  applyTemplateSettings(baseCalculations, templateSettings, availableMemory, availableMemoryBytes) {
    const calculations = { ...baseCalculations };

    // Apply template percentages
    if (templateSettings.innodb_buffer_pool_percentage) {
      calculations.innodb_buffer_pool_size = Math.floor(
        availableMemoryBytes * templateSettings.innodb_buffer_pool_percentage
      );
    }

    if (templateSettings.innodb_log_file_size_ratio) {
      calculations.innodb_log_file_size = Math.floor(
        calculations.innodb_buffer_pool_size * templateSettings.innodb_log_file_size_ratio
      );
    }

    if (templateSettings.query_cache_size_percentage !== undefined) {
      calculations.query_cache_size = Math.floor(
        availableMemoryBytes * templateSettings.query_cache_size_percentage
      );
    }

    if (templateSettings.max_connections_per_gb) {
      calculations.max_connections = Math.floor(
        availableMemory * templateSettings.max_connections_per_gb
      );
    }

    if (templateSettings.sort_buffer_size_percentage) {
      calculations.sort_buffer_size = Math.floor(
        availableMemoryBytes * templateSettings.sort_buffer_size_percentage
      );
    }

    if (templateSettings.join_buffer_size_percentage) {
      calculations.join_buffer_size = Math.floor(
        availableMemoryBytes * templateSettings.join_buffer_size_percentage
      );
    }

    if (templateSettings.tmp_table_size_percentage) {
      calculations.tmp_table_size = Math.floor(
        availableMemoryBytes * templateSettings.tmp_table_size_percentage
      );
    }

    if (templateSettings.innodb_io_capacity_per_gb) {
      calculations.innodb_io_capacity = Math.floor(
        availableMemory * templateSettings.innodb_io_capacity_per_gb
      );
    }

    if (templateSettings.innodb_flush_log_at_trx_commit !== undefined) {
      calculations.innodb_flush_log_at_trx_commit = templateSettings.innodb_flush_log_at_trx_commit;
    }

    if (templateSettings.innodb_flush_neighbors !== undefined) {
      calculations.innodb_flush_neighbors = templateSettings.innodb_flush_neighbors;
    }

    return calculations;
  }

  /**
   * Calculate derived settings based on main calculations
   */
  calculateDerivedSettings(calculations, totalMemory, availableMemory) {
    const enhanced = { ...calculations };

    // Buffer pool instances
    enhanced.innodb_buffer_pool_instances = calculateBufferPoolInstances(
      calculations.innodb_buffer_pool_size,
      totalMemory
    );

    // I/O threads
    const ioThreads = calculateIOThreads(totalMemory);
    enhanced.innodb_read_io_threads = ioThreads.read;
    enhanced.innodb_write_io_threads = ioThreads.write;

    // Table settings
    const tableSettings = calculateTableSettings(totalMemory, calculations.max_connections);
    enhanced.table_definition_cache = tableSettings.definitionCache;
    enhanced.table_open_cache = tableSettings.openCache;
    enhanced.open_files_limit = tableSettings.openFilesLimit;

    // Additional InnoDB settings
    enhanced.innodb_io_capacity_max = Math.floor(calculations.innodb_io_capacity * 2);
    enhanced.innodb_page_cleaners = Math.max(enhanced.innodb_buffer_pool_instances, totalMemory > 16 ? 4 : 1);
    enhanced.innodb_purge_threads = totalMemory > 16 ? 4 : 1;

    // Performance schema setting
    enhanced.performance_schema = totalMemory >= 8 ? 1 : 0;

    // Thread cache
    enhanced.thread_cache_size = 128;

    // Max allowed packet
    enhanced.max_allowed_packet = '16M';

    return enhanced;
  }

  /**
   * Calculate performance score based on current settings
   */
  calculatePerformanceScore(results) {
    const { inputs, calculations } = results;
    const { totalMemory, availableMemory } = inputs;

    const scores = {
      memoryAllocation: this.scoreMemoryAllocation(totalMemory, availableMemory),
      bufferPoolSize: this.scoreBufferPoolSize(calculations.innodb_buffer_pool_size, availableMemory),
      logFileSize: this.scoreLogFileSize(calculations.innodb_log_file_size, calculations.innodb_buffer_pool_size),
      connections: this.scoreConnections(calculations.max_connections, availableMemory),
      ioSettings: this.scoreIOSettings(calculations)
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
    return Math.min(CONSTANTS.SCORE_WEIGHTS.memoryAllocation, Math.round(memoryRatio * 25));
  }

  scoreBufferPoolSize(bufferPoolSize, availableMemory) {
    const availableBytes = convertGBToBytes(availableMemory);
    const bufferPoolRatio = bufferPoolSize / availableBytes;
    const deviation = Math.abs(0.75 - bufferPoolRatio);
    return Math.max(0, Math.round(CONSTANTS.SCORE_WEIGHTS.bufferPoolSize - (deviation * 40)));
  }

  scoreLogFileSize(logFileSize, bufferPoolSize) {
    const logFileRatio = logFileSize / bufferPoolSize;
    const deviation = Math.abs(0.25 - logFileRatio);
    return Math.max(0, Math.round(CONSTANTS.SCORE_WEIGHTS.logFileSize - (deviation * 80)));
  }

  scoreConnections(maxConnections, availableMemory) {
    const connectionsPerGB = maxConnections / availableMemory;
    if (connectionsPerGB <= 150) {
      return CONSTANTS.SCORE_WEIGHTS.connections;
    }
    return Math.max(0, CONSTANTS.SCORE_WEIGHTS.connections - Math.floor((connectionsPerGB - 150) / 10));
  }

  scoreIOSettings(calculations) {
    const ioCapacityScore = Math.min(10, calculations.innodb_io_capacity / 200);
    const ioThreadsScore = Math.min(10, (calculations.innodb_read_io_threads + calculations.innodb_write_io_threads) / 2);
    return Math.round(ioCapacityScore + ioThreadsScore);
  }

  generateRecommendations(scores, inputs, calculations) {
    const recommendations = [];
    const { availableMemory } = inputs;

    if (scores.memoryAllocation < 15) {
      recommendations.push("Consider allocating more memory to MySQL by reducing reserved memory or memory for other tasks.");
    }

    if (scores.bufferPoolSize < 15) {
      const bufferPoolRatio = calculations.innodb_buffer_pool_size / convertGBToBytes(availableMemory);
      if (bufferPoolRatio < 0.6) {
        recommendations.push("Increase innodb_buffer_pool_size to around 70-80% of available memory for better performance.");
      } else if (bufferPoolRatio > 0.85) {
        recommendations.push("Your innodb_buffer_pool_size may be too large. Consider reducing it to leave memory for other operations.");
      }
    }

    if (scores.logFileSize < 15) {
      const logFileRatio = calculations.innodb_log_file_size / calculations.innodb_buffer_pool_size;
      if (logFileRatio < 0.2) {
        recommendations.push("Increase innodb_log_file_size to about 25% of your buffer pool size for better transaction performance.");
      } else if (logFileRatio > 0.3) {
        recommendations.push("Your innodb_log_file_size may be too large relative to buffer pool size.");
      }
    }

    if (scores.connections < 15) {
      recommendations.push("Your max_connections setting may be too high for available memory. Consider reducing it to avoid server overload.");
    }

    if (scores.ioSettings < 15) {
      if (calculations.innodb_io_capacity < availableMemory * 50) {
        recommendations.push("Consider increasing innodb_io_capacity based on your storage capabilities.");
      }
      if (calculations.innodb_read_io_threads < 4 || calculations.innodb_write_io_threads < 4) {
        recommendations.push("Increase innodb_read_io_threads and innodb_write_io_threads to at least 4 each for better I/O performance.");
      }
    }

    if (recommendations.length === 0) {
      recommendations.push("Your MySQL/MariaDB configuration looks well optimized. Monitor your specific workload performance for further adjustments.");
    }

    return recommendations;
  }
}

// Export singleton instance
export const mysqlCalculator = new MySQLCalculator();