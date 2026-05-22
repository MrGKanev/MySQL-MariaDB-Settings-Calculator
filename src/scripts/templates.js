/**
 * Workload Templates for MySQL/MariaDB Configuration
 */

export const WORKLOAD_TEMPLATES = {
  oltp: {
    name: 'OLTP (Online Transaction Processing)',
    description: 'Optimized for many small, concurrent transactions with high consistency requirements',
    // Memory allocation
    innodb_buffer_pool_percentage: 0.7,
    innodb_log_file_size_ratio: 0.25,
    query_cache_size_percentage: 0.02, // Reduced - query cache can cause contention
    tmp_table_size_percentage: 0.05,
    
    // Connection settings
    max_connections_per_gb: 150, // Higher for concurrent users
    
    // Buffer sizes
    sort_buffer_size_percentage: 0.01, // Smaller for quick operations
    join_buffer_size_percentage: 0.01,
    
    // InnoDB settings
    innodb_flush_log_at_trx_commit: 1, // Full ACID compliance
    innodb_io_capacity_per_gb: 150, // Higher for frequent writes
    innodb_flush_neighbors: 0, // Disable for SSD performance
    
    // Additional optimizations
    use_performance_schema: true,
    innodb_page_cleaners: 4,
    
    characteristics: [
      'High concurrency with many simultaneous connections',
      'Small, quick transactions',
      'Frequent INSERT, UPDATE, DELETE operations',
      'Strong consistency requirements',
      'Low query cache usage due to frequent data changes'
    ]
  },

  olap: {
    name: 'OLAP (Online Analytical Processing)',
    description: 'Optimized for complex analytical queries and data warehousing',
    // Memory allocation - more for buffer pool, less for connections
    innodb_buffer_pool_percentage: 0.75,
    innodb_log_file_size_ratio: 0.2,
    query_cache_size_percentage: 0, // Disable for OLAP
    tmp_table_size_percentage: 0.1, // Larger for complex operations
    
    // Connection settings
    max_connections_per_gb: 50, // Fewer concurrent users
    
    // Buffer sizes - larger for complex operations
    sort_buffer_size_percentage: 0.02,
    join_buffer_size_percentage: 0.015, // Larger for complex joins
    
    // InnoDB settings
    innodb_flush_log_at_trx_commit: 2, // Slightly relaxed for performance
    innodb_io_capacity_per_gb: 200, // High for large data operations
    innodb_flush_neighbors: 0, // Optimize for SSD
    
    // Additional optimizations
    use_performance_schema: true,
    innodb_page_cleaners: 4,
    
    characteristics: [
      'Complex queries with large result sets',
      'Heavy use of GROUP BY, ORDER BY, and aggregations',
      'Large temporary tables for intermediate results',
      'Batch processing and ETL operations',
      'Read-heavy workload with occasional bulk updates'
    ]
  },

  mixed: {
    name: 'Mixed Workload',
    description: 'Balanced settings for applications with both transactional and analytical workloads',
    // Balanced memory allocation
    innodb_buffer_pool_percentage: 0.75,
    innodb_log_file_size_ratio: 0.25,
    query_cache_size_percentage: 0.03,
    tmp_table_size_percentage: 0.07,
    
    // Moderate connection settings
    max_connections_per_gb: 100,
    
    // Moderate buffer sizes
    sort_buffer_size_percentage: 0.015,
    join_buffer_size_percentage: 0.01,
    
    // Balanced InnoDB settings
    innodb_flush_log_at_trx_commit: 1,
    innodb_io_capacity_per_gb: 120,
    innodb_flush_neighbors: 0,
    
    characteristics: [
      'Mix of transactional and reporting queries',
      'Variable query complexity',
      'Moderate concurrency levels',
      'Both real-time and batch processing needs'
    ]
  },

  webserver: {
    name: 'Web Server',
    description: 'Optimized for web applications with database backend',
    // Leave more memory for web server
    innodb_buffer_pool_percentage: 0.65,
    innodb_log_file_size_ratio: 0.25,
    query_cache_size_percentage: 0.05, // Useful for repeated queries
    tmp_table_size_percentage: 0.04,
    
    // High connection count for web traffic
    max_connections_per_gb: 120,
    
    // Small buffers for web queries
    sort_buffer_size_percentage: 0.01,
    join_buffer_size_percentage: 0.008,
    
    // Standard InnoDB settings
    innodb_flush_log_at_trx_commit: 1,
    innodb_io_capacity_per_gb: 80,
    innodb_flush_neighbors: 0,
    
    characteristics: [
      'High number of concurrent connections',
      'Relatively simple queries',
      'Frequent identical or similar queries',
      'Memory shared with web server processes',
      'Session and cache table usage'
    ]
  },

  smallserver: {
    name: 'Small VPS Server',
    description: 'Conservative settings for small VPS environments with limited resources',
    // Conservative memory usage
    innodb_buffer_pool_percentage: 0.5, // Only 50% of available memory
    innodb_log_file_size_ratio: 0.15, // Smaller log files
    query_cache_size_percentage: 0.03,
    tmp_table_size_percentage: 0.04,
    
    // Limited connections
    max_connections_per_gb: 80,
    
    // Small buffer sizes
    sort_buffer_size_percentage: 0.01,
    join_buffer_size_percentage: 0.008,
    
    // Conservative InnoDB settings
    innodb_flush_log_at_trx_commit: 2, // Slightly relaxed for performance
    innodb_io_capacity_per_gb: 50, // Lower for shared resources
    innodb_flush_neighbors: 0,
    
    characteristics: [
      'Limited server resources',
      'Shared hosting environment',
      'Low to moderate traffic',
      'Memory conservation is priority',
      'Simplified configuration for stability'
    ]
  }
};

/**
 * Template Manager Class
 */
export class TemplateManager {
  constructor() {
    this.currentTemplate = null;
  }

  /**
   * Get all available templates
   */
  getTemplates() {
    return WORKLOAD_TEMPLATES;
  }

  /**
   * Get a specific template by name
   */
  getTemplate(templateName) {
    if (templateName === 'custom' || !templateName) {
      return null;
    }
    return WORKLOAD_TEMPLATES[templateName] || null;
  }

  /**
   * Set current template
   */
  setTemplate(templateName) {
    this.currentTemplate = templateName === 'custom' ? null : templateName;
    return this.getTemplate(templateName);
  }

  /**
   * Get current template settings
   */
  getCurrentTemplate() {
    return this.currentTemplate ? WORKLOAD_TEMPLATES[this.currentTemplate] : null;
  }

}

// Export singleton instance
export const templateManager = new TemplateManager();