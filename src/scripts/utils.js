// Constants
export const CONSTANTS = {
  // Memory allocation percentages
  BUFFER_POOL_PERCENTAGE: 0.7,
  KEY_BUFFER_PERCENTAGE: 0.1,
  QUERY_CACHE_PERCENTAGE: 0.03,
  TMP_TABLE_PERCENTAGE: 0.05,
  LOG_BUFFER_PERCENTAGE: 0.01,
  SORT_BUFFER_PERCENTAGE: 0.01,
  READ_BUFFER_PERCENTAGE: 0.005,
  READ_RND_BUFFER_PERCENTAGE: 0.01,
  JOIN_BUFFER_PERCENTAGE: 0.005,

  // InnoDB settings
  LOG_FILE_RATIO: 0.25,
  FLUSH_LOG_AT_TRX_COMMIT: 1,
  FILE_PER_TABLE: 1,
  THREAD_CONCURRENCY: 0,

  // Connection settings
  CONNECTIONS_PER_GB: 100,

  // Minimum viable memory available to MySQL/MariaDB (GB)
  MIN_VIABLE_MEMORY_GB: 1,

  // Buffer limits (in bytes)
  MAX_LOG_BUFFER_SIZE: 16 * 1024 * 1024, // 16MB
  MAX_SORT_BUFFER_SIZE: 8 * 1024 * 1024, // 8MB
  MAX_READ_BUFFER_SIZE: 4 * 1024 * 1024, // 4MB
  MAX_READ_RND_BUFFER_SIZE: 8 * 1024 * 1024, // 8MB
  MAX_JOIN_BUFFER_SIZE: 4 * 1024 * 1024, // 4MB

  // Performance scoring
  SCORE_WEIGHTS: {
    memoryAllocation: 20,
    bufferPoolSize: 20,
    logFileSize: 20,
    connections: 20,
    ioSettings: 20
  },

  // Storage type multipliers for IO capacity
  STORAGE_IO_MULTIPLIERS: {
    nvme: 200,
    ssd: 100,
    hdd: 50
  },

  // Server size thresholds (in GB) for tiered calculations
  SERVER_SIZE_THRESHOLDS: {
    VERY_LARGE: 128,
    LARGE: 64,
    MEDIUM_LARGE: 32,
    MEDIUM: 16,
    SMALL: 8,
    VERY_SMALL: 4
  },

  // Buffer pool percentages by server size (dedicated servers)
  DEDICATED_BUFFER_POOL_PERCENTAGES: {
    VERY_LARGE: 0.85,  // 128GB+
    LARGE: 0.80,       // 64-128GB
    MEDIUM_LARGE: 0.75, // 32-64GB
    MEDIUM: 0.72,      // 16-32GB
    SMALL: 0.70        // 8-16GB
  },

  // Buffer pool percentages for shared servers
  SHARED_BUFFER_POOL_PERCENTAGES: {
    VERY_LARGE: 0.65,
    LARGE: 0.60,
    MEDIUM: 0.65,
    SMALL: 0.50
  },

  // Connections per GB by server type
  CONNECTIONS_PER_GB_DEDICATED: {
    SMALL: 80,
    LARGE: 120,
    DEFAULT: 100
  },

  CONNECTIONS_PER_GB_SHARED: {
    SMALL: 60,
    LARGE: 80,
    DEFAULT: 75
  },

  // Max connections caps by server size
  MAX_CONNECTIONS_CAPS: {
    VERY_LARGE: 2000,
    LARGE: 1500,
    MEDIUM_LARGE: 1000,
    MEDIUM: 500,
    SMALL: 300
  },

  // NVMe IO capacity multipliers by server size
  NVME_IO_MULTIPLIERS: {
    VERY_LARGE: 2.5,
    LARGE: 2.0,
    MEDIUM_LARGE: 1.5,
    DEDICATED_MEDIUM: 1.3
  },

  // SSD IO capacity multipliers
  SSD_IO_MULTIPLIERS: {
    DEDICATED_MEDIUM: 1.3,
    LARGE: 1.2
  },

  // Memory ratio thresholds
  DEDICATED_SERVER_THRESHOLD: 0.2, // < 20% reserved = dedicated

  // Calculation cache size
  CALCULATION_CACHE_SIZE: 15
};

// Helper functions
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export function formatBytes(bytes) {
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  if (bytes === 0) return "0 Bytes";
  const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + " " + sizes[i];
}

function formatBytesDB(bytes, units) {
  if (bytes === 0) return '0';
  if (bytes >= 1073741824 && bytes % 1073741824 === 0) return (bytes / 1073741824) + units[0];
  if (bytes >= 1048576 && bytes % 1048576 === 0) return (bytes / 1048576) + units[1];
  if (bytes >= 1024 && bytes % 1024 === 0) return (bytes / 1024) + units[2];
  return bytes + (units[3] ?? '');
}

export const formatBytesMySQL = (bytes) => formatBytesDB(bytes, ['G', 'M', 'K', '']);
export const formatBytesPostgreSQL = (bytes) => formatBytesDB(bytes, ['GB', 'MB', 'kB', 'B']);

// PostgreSQL-specific constants
export const POSTGRESQL_CONSTANTS = {
  // Memory allocation percentages
  SHARED_BUFFERS_PERCENTAGE: 0.25,
  EFFECTIVE_CACHE_SIZE_PERCENTAGE: 0.75,
  WORK_MEM_BASE: 4 * 1024 * 1024, // 4MB base
  MAINTENANCE_WORK_MEM_PERCENTAGE: 0.05,
  WAL_BUFFERS_PERCENTAGE: 0.03,

  // Connection settings
  CONNECTIONS_PER_GB: 50,

  // WAL settings
  MAX_WAL_SIZE_DEFAULT: '1GB',
  MIN_WAL_SIZE_DEFAULT: '80MB',
  WAL_LEVEL_DEFAULT: 'replica',
  CHECKPOINT_COMPLETION_TARGET: 0.9,

  // Storage type costs
  RANDOM_PAGE_COST: {
    nvme: 1.1,
    ssd: 1.1,
    hdd: 4.0
  },
  EFFECTIVE_IO_CONCURRENCY: {
    nvme: 200,
    ssd: 200,
    hdd: 2
  },

  // Worker processes
  MAX_WORKER_PROCESSES: 8,
  MAX_PARALLEL_WORKERS_PER_GATHER: 2,
  MAX_PARALLEL_WORKERS: 4,
  MAX_PARALLEL_MAINTENANCE_WORKERS: 2,

  // Performance scoring
  SCORE_WEIGHTS: {
    memoryAllocation: 20,
    sharedBuffers: 20,
    walSettings: 20,
    connections: 20,
    queryPlanner: 20
  },

  // Connection caps by server size
  MAX_CONNECTIONS_CAPS: {
    VERY_LARGE: 1000,
    LARGE: 500,
    MEDIUM: 300,
    SMALL: 200
  },

  // Server size thresholds (in GB)
  SERVER_SIZE_THRESHOLDS: {
    VERY_LARGE: 128,
    LARGE: 64,
    MEDIUM: 16,
    SMALL: 4
  },

  // Calculation cache size
  CALCULATION_CACHE_SIZE: 15,

  // Minimum viable memory available to PostgreSQL (GB)
  MIN_VIABLE_MEMORY_GB: 1
};

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function convertGBToBytes(gb) {
  return gb * 1024 * 1024 * 1024;
}

export function convertBytesToGB(bytes) {
  return bytes / (1024 * 1024 * 1024);
}

// Validation functions
export function validateMemoryInputs(totalMemory, reservedMemory, otherTasksMemory) {
  const errors = [];
  
  if (totalMemory <= 0) {
    errors.push("Total memory must be greater than 0");
  }
  
  if (reservedMemory < 0) {
    errors.push("Reserved memory cannot be negative");
  }
  
  if (otherTasksMemory < 0) {
    errors.push("Other tasks memory cannot be negative");
  }
  
  if (totalMemory - reservedMemory - otherTasksMemory < CONSTANTS.MIN_VIABLE_MEMORY_GB) {
    errors.push(`At least ${CONSTANTS.MIN_VIABLE_MEMORY_GB} GB must remain available for the database after reserved and other-tasks memory`);
  }
  
  return errors;
}

// OS-specific optimizations
export function determineFlushMethod(osType = 'linux') {
  const flushMethods = {
    windows: 'unbuffered',
    macos: 'fsync',
    linux: 'O_DIRECT'
  };
  
  return flushMethods[osType] || flushMethods.linux;
}

// Storage type optimizations
export function getStorageOptimizations(storageType = 'ssd') {
  const optimizations = {
    nvme: {
      ioCapacityMultiplier: CONSTANTS.STORAGE_IO_MULTIPLIERS.nvme,
      flushNeighbors: 0,
      readAheadSize: '16M'
    },
    ssd: {
      ioCapacityMultiplier: CONSTANTS.STORAGE_IO_MULTIPLIERS.ssd,
      flushNeighbors: 0,
      readAheadSize: '16M'
    },
    hdd: {
      ioCapacityMultiplier: CONSTANTS.STORAGE_IO_MULTIPLIERS.hdd,
      flushNeighbors: 1,
      readAheadSize: '256K'
    }
  };
  
  return optimizations[storageType] || optimizations.ssd;
}

// Performance calculation helpers
export function calculateBufferPoolInstances(bufferPoolSize, totalMemoryGB) {
  if (bufferPoolSize <= 1 * 1024 * 1024 * 1024) {
    return 1;
  }

  const bufferPoolGB = convertBytesToGB(bufferPoolSize);

  // For smaller servers, don't add overhead of multiple instances
  if (totalMemoryGB < 4) {
    return 1;
  }

  // Target ~1 instance per 1-2 GB; hard cap at 64 (MySQL/MariaDB limit)
  let instances;

  if (bufferPoolGB >= 64) {
    instances = Math.ceil(bufferPoolGB);
  } else if (bufferPoolGB >= 32) {
    instances = Math.ceil(bufferPoolGB / 1.5);
  } else if (bufferPoolGB >= 16) {
    instances = Math.ceil(bufferPoolGB / 2);
  } else {
    instances = Math.min(Math.ceil(bufferPoolGB), 16);
  }

  return Math.min(instances, 64);
}

export function calculateIOThreads(totalMemoryGB) {
  let threads;
  if (totalMemoryGB >= 128) threads = 16;
  else if (totalMemoryGB >= 64) threads = 12;
  else if (totalMemoryGB >= 16) threads = 8;
  else threads = 4;
  return { read: threads, write: threads };
}

export function calculateTableSettings(totalMemoryGB, maxConnections) {
  return {
    definitionCache: totalMemoryGB > 8 ? 4096 : 2048,
    openCache: Math.floor(maxConnections * 4),
    openFilesLimit: Math.max(maxConnections * 10, 5000)
  };
}
