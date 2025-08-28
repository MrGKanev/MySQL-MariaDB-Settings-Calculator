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
  }
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
  return Math.round(bytes / Math.pow(1024, i), 2) + " " + sizes[i];
}

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
  
  if (reservedMemory + otherTasksMemory + 1 > totalMemory) {
    errors.push("Reserved memory + Other tasks memory + 1 GB cannot exceed total server memory");
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
  let instances = Math.min(Math.ceil(bufferPoolGB), 16);
  
  // For smaller servers, don't add overhead of multiple instances
  if (totalMemoryGB < 4) {
    instances = 1;
  }
  
  return instances;
}

export function calculateIOThreads(totalMemoryGB) {
  return {
    read: totalMemoryGB > 16 ? 8 : 4,
    write: totalMemoryGB > 16 ? 8 : 4
  };
}

export function calculateTableSettings(totalMemoryGB, maxConnections) {
  return {
    definitionCache: totalMemoryGB > 8 ? 4096 : 2048,
    openCache: Math.floor(maxConnections * 4),
    openFilesLimit: Math.max(maxConnections * 10, 5000)
  };
}