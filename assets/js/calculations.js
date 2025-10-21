import { CONSTANTS, validateMemoryInputs, determineFlushMethod, getStorageOptimizations, calculateBufferPoolInstances, calculateIOThreads, calculateTableSettings, convertGBToBytes, convertBytesToGB, clamp } from './utils.js';

/**
 * Recommendation message constants for better maintainability
 */
const RECOMMENDATION_MESSAGES = {
  // Memory allocation messages
  LOW_MEMORY_ALLOCATION: "Consider allocating more memory to MySQL by reducing reserved memory or memory for other tasks. For dedicated database servers, 70-80% of total memory should be available for MySQL.",
  REASONABLE_MEMORY_ALLOCATION: "Your memory allocation is reasonable, but could be optimized further for better performance.",

  // Buffer pool messages
  INCREASE_BUFFER_POOL: "Increase innodb_buffer_pool_size to 70-80% of available memory for dedicated database servers, or 60-70% for shared servers. This is the most critical MySQL performance setting.",
  DECREASE_BUFFER_POOL: "Your innodb_buffer_pool_size may be too large. Consider reducing it to 75-80% of available memory to leave space for other MySQL operations and OS processes.",

  // Log file messages
  INCREASE_LOG_FILE: "Increase innodb_log_file_size to about 25% of your buffer pool size. This improves write performance by reducing checkpoint frequency.",
  DECREASE_LOG_FILE: "Your innodb_log_file_size may be too large relative to buffer pool size. Consider reducing it to 20-25% of buffer pool size.",

  // Connection messages
  TOO_MANY_CONNECTIONS: "Your max_connections setting may be too high for available memory. Each connection uses memory; consider reducing connections or implementing connection pooling.",
  ADJUST_CONNECTIONS: "Consider adjusting max_connections based on your actual concurrent user requirements and available memory.",

  // I/O settings messages
  INCREASE_IO_CAPACITY: "Consider increasing innodb_io_capacity based on your storage capabilities. SSDs can typically handle 200+ IOPS per GB, NVMe drives even more.",
  INCREASE_IO_THREADS: "Increase innodb_read_io_threads and innodb_write_io_threads to at least 4 each for better I/O performance on modern hardware.",
  USE_MULTIPLE_BUFFER_POOL_INSTANCES: "Consider using multiple innodb_buffer_pool_instances (typically 1 instance per 1-2 GB of buffer pool) to reduce contention on larger servers.",

  // Server-specific messages
  LARGE_SERVER_BUFFER_POOL: "For servers with 16GB+ RAM dedicated primarily to MySQL, consider allocating 70-80% of memory to innodb_buffer_pool_size for optimal performance.",
  ENABLE_ADAPTIVE_HASH_INDEX: "Enable innodb_adaptive_hash_index on large servers to improve read performance for frequently accessed data patterns.",

  // Default message
  OPTIMIZED_CONFIG: "Your MySQL/MariaDB configuration is well optimized for your hardware. Monitor cache hit ratios and query performance to fine-tune further based on your specific workload patterns."
};

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
    let calculations = this.calculateBaseSettings(availableMemory, availableMemoryBytes, totalMemory, storageOpts, inputs, templateSettings);
    
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
   * Determine if this is likely a dedicated database server
   */
  isDedicatedDatabaseServer(inputs, templateSettings) {
    const { totalMemory, reservedMemory, otherTasksMemory } = inputs;
    const memoryReservedRatio = (reservedMemory + otherTasksMemory) / totalMemory;
    
    // Consider it dedicated if:
    // 1. Very little memory reserved for other tasks (< 20%)
    // 2. Template suggests dedicated usage (OLTP, OLAP, not web server)
    // 3. Large server (>= 8GB) with minimal other allocations
    
    const isLowReservation = memoryReservedRatio < 0.2;
    const isLargeServer = totalMemory >= 8;
    const isDedicatedTemplate = templateSettings && 
      ['oltp', 'olap', 'mixed'].includes(templateSettings.name?.toLowerCase());
    
    return (isLowReservation && isLargeServer) || isDedicatedTemplate;
  }

  /**
   * Calculate optimal buffer pool percentage based on server characteristics
   */
  calculateOptimalBufferPoolPercentage(totalMemory, availableMemory, isDedicated, templateSettings) {
    // Base percentage from research: 70-80% for dedicated servers
    let bufferPoolPercentage = CONSTANTS.BUFFER_POOL_PERCENTAGE; // 0.7

    if (isDedicated) {
      // For dedicated database servers, use higher percentages as recommended
      if (totalMemory >= 64) {
        // Very large dedicated servers: 75% (upper end of recommendation)
        bufferPoolPercentage = 0.75;
      } else if (totalMemory >= 32) {
        // Large dedicated servers: 75%
        bufferPoolPercentage = 0.75;
      } else if (totalMemory >= 16) {
        // Medium dedicated servers: 70-75%
        bufferPoolPercentage = 0.72;
      } else if (totalMemory >= 8) {
        // Small dedicated servers: 70%
        bufferPoolPercentage = 0.70;
      }
    } else {
      // For shared servers, be more conservative
      if (totalMemory > 32) {
        bufferPoolPercentage = 0.60; // Conservative for large shared servers
      } else if (totalMemory > 16) {
        bufferPoolPercentage = 0.65; // Moderate for medium shared servers
      } else if (totalMemory <= 4) {
        bufferPoolPercentage = 0.50; // Very conservative for small shared servers
      }
    }

    // Additional workload-based adjustments
    if (templateSettings) {
      const templateName = templateSettings.name?.toLowerCase();
      
      // Read-heavy workloads benefit from larger buffer pools
      if (templateName === 'olap') {
        bufferPoolPercentage = Math.min(0.80, bufferPoolPercentage + 0.05);
      }
      
      // Web servers typically share resources, so be more conservative
      if (templateName === 'webserver') {
        bufferPoolPercentage = Math.max(0.50, bufferPoolPercentage - 0.10);
      }
      
      // Small servers should always be conservative
      if (templateName === 'smallserver') {
        bufferPoolPercentage = 0.50;
      }
    }

    return bufferPoolPercentage;
  }

  /**
   * Calculate base MySQL settings without template modifications
   */
  calculateBaseSettings(availableMemory, availableMemoryBytes, totalMemory, storageOpts, inputs, templateSettings) {
    // Determine if this is a dedicated database server
    const isDedicated = this.isDedicatedDatabaseServer(inputs, templateSettings);
    
    // Calculate optimal buffer pool percentage
    const bufferPoolPercentage = this.calculateOptimalBufferPoolPercentage(
      totalMemory, 
      availableMemory, 
      isDedicated, 
      templateSettings
    );

    // Smart connections per GB based on server characteristics
    let connectionsPerGB = CONSTANTS.CONNECTIONS_PER_GB;
    
    if (isDedicated) {
      // Dedicated servers can handle more connections per GB
      if (totalMemory < 4) {
        connectionsPerGB = 80;
      } else if (totalMemory > 32) {
        connectionsPerGB = 120; // Large dedicated servers
      } else {
        connectionsPerGB = 100; // Standard dedicated servers
      }
    } else {
      // Shared servers should be more conservative
      if (totalMemory < 4) {
        connectionsPerGB = 60; // Very conservative for small shared
      } else if (totalMemory > 32) {
        connectionsPerGB = 80; // Conservative for large shared
      } else {
        connectionsPerGB = 75; // Conservative for medium shared
      }
    }

    const calculations = {
      // Core InnoDB settings with improved buffer pool calculation
      innodb_buffer_pool_size: Math.floor(availableMemoryBytes * bufferPoolPercentage),
      innodb_log_buffer_size: Math.min(
        Math.floor(availableMemoryBytes * CONSTANTS.LOG_BUFFER_PERCENTAGE),
        CONSTANTS.MAX_LOG_BUFFER_SIZE
      ),
      innodb_flush_log_at_trx_commit: CONSTANTS.FLUSH_LOG_AT_TRX_COMMIT,
      innodb_file_per_table: CONSTANTS.FILE_PER_TABLE,
      innodb_thread_concurrency: CONSTANTS.THREAD_CONCURRENCY,
      innodb_flush_neighbors: storageOpts.flushNeighbors,

      // Connection settings adjusted for dedicated vs shared
      max_connections: Math.floor(availableMemory * connectionsPerGB),

      // MyISAM settings
      key_buffer_size: Math.floor(availableMemoryBytes * CONSTANTS.KEY_BUFFER_PERCENTAGE),

      // Query cache (commented for MySQL 8+)
      query_cache_size: Math.floor(availableMemoryBytes * CONSTANTS.QUERY_CACHE_PERCENTAGE),

      // Temporary tables - adjust based on workload expectations
      tmp_table_size: Math.floor(availableMemoryBytes * CONSTANTS.TMP_TABLE_PERCENTAGE),

      // I/O settings with workload considerations
      innodb_io_capacity: Math.floor(availableMemory * storageOpts.ioCapacityMultiplier),

      // Buffer sizes with limits and workload considerations
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

    // Calculate log file size based on buffer pool (25% is optimal for most workloads)
    calculations.innodb_log_file_size = Math.floor(calculations.innodb_buffer_pool_size * CONSTANTS.LOG_FILE_RATIO);

    // Adjust IO capacity based on server characteristics and workload
    if (isDedicated && totalMemory > 16) {
      // Dedicated servers with substantial memory can handle higher IO capacity
      calculations.innodb_io_capacity = Math.floor(calculations.innodb_io_capacity * 1.3);
    } else if (totalMemory > 32) {
      // Large servers get moderate boost
      calculations.innodb_io_capacity = Math.floor(calculations.innodb_io_capacity * 1.2);
    }

    // Adjust temporary table sizes for analytical workloads
    if (templateSettings?.name?.toLowerCase() === 'olap') {
      calculations.tmp_table_size = Math.floor(calculations.tmp_table_size * 1.5);
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
      calculations.sort_buffer_size = Math.min(
        Math.floor(availableMemoryBytes * templateSettings.sort_buffer_size_percentage),
        CONSTANTS.MAX_SORT_BUFFER_SIZE
      );
    }

    if (templateSettings.join_buffer_size_percentage) {
      calculations.join_buffer_size = Math.min(
        Math.floor(availableMemoryBytes * templateSettings.join_buffer_size_percentage),
        CONSTANTS.MAX_JOIN_BUFFER_SIZE
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

    // Buffer pool instances - critical for performance on larger servers
    enhanced.innodb_buffer_pool_instances = calculateBufferPoolInstances(
      calculations.innodb_buffer_pool_size,
      totalMemory
    );

    // I/O threads - scale with server capability
    const ioThreads = calculateIOThreads(totalMemory);
    enhanced.innodb_read_io_threads = ioThreads.read;
    enhanced.innodb_write_io_threads = ioThreads.write;

    // Table settings
    const tableSettings = calculateTableSettings(totalMemory, calculations.max_connections);
    enhanced.table_definition_cache = tableSettings.definitionCache;
    enhanced.table_open_cache = tableSettings.openCache;
    enhanced.open_files_limit = tableSettings.openFilesLimit;

    // Additional InnoDB settings optimized for performance
    enhanced.innodb_io_capacity_max = Math.floor(calculations.innodb_io_capacity * 2);
    enhanced.innodb_page_cleaners = Math.max(
      enhanced.innodb_buffer_pool_instances, 
      totalMemory > 16 ? Math.min(16, Math.floor(totalMemory / 8)) : 1
    );
    enhanced.innodb_purge_threads = totalMemory > 16 ? Math.min(32, Math.floor(totalMemory / 4)) : 1;

    // Performance schema setting - enable for servers with adequate memory
    enhanced.performance_schema = totalMemory >= 4 ? 1 : 0;

    // Thread cache - scale with expected connections
    enhanced.thread_cache_size = Math.min(256, Math.max(8, Math.floor(calculations.max_connections * 0.1)));

    // Max allowed packet - larger for modern applications
    enhanced.max_allowed_packet = totalMemory >= 8 ? '32M' : '16M';

    // Add innodb_adaptive_hash_index setting
    enhanced.innodb_adaptive_hash_index = totalMemory >= 8 ? 1 : 0;

    // Add innodb_change_buffering optimization
    enhanced.innodb_change_buffering = 'all';

    // Add innodb_doublewrite setting (can be disabled for SSDs in some cases)
    enhanced.innodb_doublewrite = 1;

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
      bufferPoolSize: this.scoreBufferPoolSize(calculations.innodb_buffer_pool_size, availableMemory, totalMemory),
      logFileSize: this.scoreLogFileSize(calculations.innodb_log_file_size, calculations.innodb_buffer_pool_size),
      connections: this.scoreConnections(calculations.max_connections, availableMemory, totalMemory),
      ioSettings: this.scoreIOSettings(calculations, totalMemory)
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
    // Better scoring for higher memory allocation ratios
    if (memoryRatio >= 0.8) return CONSTANTS.SCORE_WEIGHTS.memoryAllocation;
    if (memoryRatio >= 0.6) return Math.round(memoryRatio * 25);
    return Math.round(memoryRatio * 20);
  }

  scoreBufferPoolSize(bufferPoolSize, availableMemory, totalMemory) {
    const availableBytes = convertGBToBytes(availableMemory);
    const bufferPoolRatio = bufferPoolSize / availableBytes;
    
    // Optimal range is 70-80% for dedicated servers, 50-70% for shared
    let optimalRange = [0.70, 0.80];
    if (totalMemory <= 4) {
      optimalRange = [0.50, 0.70]; // More conservative for small servers
    }
    
    const [minOptimal, maxOptimal] = optimalRange;
    const midOptimal = (minOptimal + maxOptimal) / 2;
    
    if (bufferPoolRatio >= minOptimal && bufferPoolRatio <= maxOptimal) {
      return CONSTANTS.SCORE_WEIGHTS.bufferPoolSize;
    }
    
    const deviation = Math.abs(midOptimal - bufferPoolRatio);
    return Math.max(0, Math.round(CONSTANTS.SCORE_WEIGHTS.bufferPoolSize - (deviation * 40)));
  }

  scoreLogFileSize(logFileSize, bufferPoolSize) {
    const logFileRatio = logFileSize / bufferPoolSize;
    // Optimal is around 25% of buffer pool size
    const deviation = Math.abs(0.25 - logFileRatio);
    return Math.max(0, Math.round(CONSTANTS.SCORE_WEIGHTS.logFileSize - (deviation * 80)));
  }

  scoreConnections(maxConnections, availableMemory, totalMemory) {
    const connectionsPerGB = maxConnections / availableMemory;
    
    // Optimal ranges depend on server size and expected usage
    let optimalRange = [80, 120];
    if (totalMemory <= 4) {
      optimalRange = [50, 80];
    } else if (totalMemory >= 32) {
      optimalRange = [100, 150];
    }
    
    const [minOptimal, maxOptimal] = optimalRange;
    
    if (connectionsPerGB >= minOptimal && connectionsPerGB <= maxOptimal) {
      return CONSTANTS.SCORE_WEIGHTS.connections;
    }
    
    if (connectionsPerGB > maxOptimal) {
      return Math.max(0, CONSTANTS.SCORE_WEIGHTS.connections - Math.floor((connectionsPerGB - maxOptimal) / 10));
    }
    
    return Math.max(0, Math.round(CONSTANTS.SCORE_WEIGHTS.connections * (connectionsPerGB / minOptimal)));
  }

  scoreIOSettings(calculations, totalMemory) {
    const baseIOScore = Math.min(10, calculations.innodb_io_capacity / 200);
    const ioThreadsScore = Math.min(10, (calculations.innodb_read_io_threads + calculations.innodb_write_io_threads) / 2);
    
    // Bonus for properly configured buffer pool instances
    let instancesBonus = 0;
    if (calculations.innodb_buffer_pool_instances > 1 && totalMemory >= 8) {
      instancesBonus = 2;
    }
    
    return Math.min(CONSTANTS.SCORE_WEIGHTS.ioSettings, Math.round(baseIOScore + ioThreadsScore + instancesBonus));
  }

  generateRecommendations(scores, inputs, calculations) {
    const recommendations = [];
    const { availableMemory, totalMemory } = inputs;

    // Memory allocation recommendations
    if (scores.memoryAllocation < 15) {
      const memoryRatio = availableMemory / totalMemory;
      recommendations.push(
        this.getMemoryAllocationRecommendation(memoryRatio)
      );
    }

    // Buffer pool size recommendations
    if (scores.bufferPoolSize < 15) {
      const bufferPoolRatio = calculations.innodb_buffer_pool_size / convertGBToBytes(availableMemory);
      const recommendation = this.getBufferPoolRecommendation(bufferPoolRatio);
      if (recommendation) {
        recommendations.push(recommendation);
      }
    }

    // Log file size recommendations
    if (scores.logFileSize < 15) {
      const logFileRatio = calculations.innodb_log_file_size / calculations.innodb_buffer_pool_size;
      const recommendation = this.getLogFileSizeRecommendation(logFileRatio);
      if (recommendation) {
        recommendations.push(recommendation);
      }
    }

    // Connection settings recommendations
    if (scores.connections < 15) {
      const connectionsPerGB = calculations.max_connections / availableMemory;
      recommendations.push(
        this.getConnectionsRecommendation(connectionsPerGB)
      );
    }

    // I/O settings recommendations
    if (scores.ioSettings < 15) {
      const ioRecommendations = this.getIOSettingsRecommendations(
        calculations,
        availableMemory,
        totalMemory
      );
      recommendations.push(...ioRecommendations);
    }

    // Additional server-specific recommendations
    recommendations.push(
      ...this.getServerSpecificRecommendations(calculations, totalMemory)
    );

    // Default recommendation if no issues found
    if (recommendations.length === 0) {
      recommendations.push(RECOMMENDATION_MESSAGES.OPTIMIZED_CONFIG);
    }

    return recommendations;
  }

  /**
   * Get memory allocation recommendation based on ratio
   */
  getMemoryAllocationRecommendation(memoryRatio) {
    if (memoryRatio < 0.6) {
      return RECOMMENDATION_MESSAGES.LOW_MEMORY_ALLOCATION;
    }
    return RECOMMENDATION_MESSAGES.REASONABLE_MEMORY_ALLOCATION;
  }

  /**
   * Get buffer pool size recommendation
   */
  getBufferPoolRecommendation(bufferPoolRatio) {
    if (bufferPoolRatio < 0.6) {
      return RECOMMENDATION_MESSAGES.INCREASE_BUFFER_POOL;
    }
    if (bufferPoolRatio > 0.85) {
      return RECOMMENDATION_MESSAGES.DECREASE_BUFFER_POOL;
    }
    return null;
  }

  /**
   * Get log file size recommendation
   */
  getLogFileSizeRecommendation(logFileRatio) {
    if (logFileRatio < 0.2) {
      return RECOMMENDATION_MESSAGES.INCREASE_LOG_FILE;
    }
    if (logFileRatio > 0.3) {
      return RECOMMENDATION_MESSAGES.DECREASE_LOG_FILE;
    }
    return null;
  }

  /**
   * Get connections recommendation
   */
  getConnectionsRecommendation(connectionsPerGB) {
    if (connectionsPerGB > 150) {
      return RECOMMENDATION_MESSAGES.TOO_MANY_CONNECTIONS;
    }
    return RECOMMENDATION_MESSAGES.ADJUST_CONNECTIONS;
  }

  /**
   * Get I/O settings recommendations
   */
  getIOSettingsRecommendations(calculations, availableMemory, totalMemory) {
    const recommendations = [];

    if (calculations.innodb_io_capacity < availableMemory * 50) {
      recommendations.push(RECOMMENDATION_MESSAGES.INCREASE_IO_CAPACITY);
    }

    if (calculations.innodb_read_io_threads < 4 || calculations.innodb_write_io_threads < 4) {
      recommendations.push(RECOMMENDATION_MESSAGES.INCREASE_IO_THREADS);
    }

    // Only recommend multiple instances if buffer pool is large enough (> 1GB)
    // This matches the logic in calculateBufferPoolInstances
    const bufferPoolGB = convertBytesToGB(calculations.innodb_buffer_pool_size);
    if (calculations.innodb_buffer_pool_instances === 1 && totalMemory >= 8 && bufferPoolGB > 1) {
      recommendations.push(RECOMMENDATION_MESSAGES.USE_MULTIPLE_BUFFER_POOL_INSTANCES);
    }

    return recommendations;
  }

  /**
   * Get server-specific recommendations
   */
  getServerSpecificRecommendations(calculations, totalMemory) {
    const recommendations = [];

    if (totalMemory >= 16 && calculations.innodb_buffer_pool_size / convertGBToBytes(totalMemory) < 0.6) {
      recommendations.push(RECOMMENDATION_MESSAGES.LARGE_SERVER_BUFFER_POOL);
    }

    if (totalMemory >= 32 && !calculations.innodb_adaptive_hash_index) {
      recommendations.push(RECOMMENDATION_MESSAGES.ENABLE_ADAPTIVE_HASH_INDEX);
    }

    return recommendations;
  }
}

// Export singleton instance
export const mysqlCalculator = new MySQLCalculator();