/**
 * Workload Templates for PostgreSQL Configuration
 */

export const PG_WORKLOAD_TEMPLATES = {
  pg_oltp: {
    name: 'OLTP (Online Transaction Processing)',
    description: 'Optimized for many small, concurrent transactions with high consistency requirements',
    shared_buffers_percentage: 0.25,
    effective_cache_size_percentage: 0.75,
    work_mem_multiplier: 0.5, // Lower work_mem, more connections
    maintenance_work_mem_percentage: 0.05,
    max_connections_per_gb: 75,
    max_wal_size: '2GB',
    checkpoint_completion_target: 0.9,
    default_statistics_target: 100,
    max_parallel_workers_per_gather: 2,
    characteristics: [
      'High concurrency with many simultaneous connections',
      'Small, quick transactions',
      'Frequent INSERT, UPDATE, DELETE operations',
      'Strong consistency requirements (synchronous_commit = on)',
      'Connection pooling strongly recommended'
    ]
  },

  pg_olap: {
    name: 'OLAP (Online Analytical Processing)',
    description: 'Optimized for complex analytical queries and data warehousing',
    shared_buffers_percentage: 0.30,
    effective_cache_size_percentage: 0.80,
    work_mem_multiplier: 4.0, // Much higher work_mem for sorts/hashes
    maintenance_work_mem_percentage: 0.10,
    max_connections_per_gb: 20,
    max_wal_size: '4GB',
    checkpoint_completion_target: 0.9,
    default_statistics_target: 500,
    max_parallel_workers_per_gather: 4,
    characteristics: [
      'Complex queries with large result sets',
      'Heavy use of GROUP BY, ORDER BY, and aggregations',
      'Large hash joins and sort operations',
      'Fewer concurrent connections needed',
      'Parallel query execution heavily utilized'
    ]
  },

  pg_mixed: {
    name: 'Mixed Workload',
    description: 'Balanced settings for applications with both transactional and analytical workloads',
    shared_buffers_percentage: 0.25,
    effective_cache_size_percentage: 0.75,
    work_mem_multiplier: 1.5,
    maintenance_work_mem_percentage: 0.05,
    max_connections_per_gb: 50,
    max_wal_size: '2GB',
    checkpoint_completion_target: 0.9,
    default_statistics_target: 200,
    max_parallel_workers_per_gather: 2,
    characteristics: [
      'Mix of transactional and reporting queries',
      'Variable query complexity',
      'Moderate concurrency levels',
      'Both real-time and batch processing needs'
    ]
  },

  pg_webserver: {
    name: 'Web Application',
    description: 'Optimized for web applications with many short-lived connections',
    shared_buffers_percentage: 0.20,
    effective_cache_size_percentage: 0.70,
    work_mem_multiplier: 0.5,
    maintenance_work_mem_percentage: 0.04,
    max_connections_per_gb: 60,
    max_wal_size: '1GB',
    checkpoint_completion_target: 0.7,
    default_statistics_target: 100,
    max_parallel_workers_per_gather: 2,
    characteristics: [
      'High number of short-lived connections',
      'Relatively simple queries',
      'Memory shared with web server processes',
      'Connection pooling essential (PgBouncer)',
      'Read-heavy with caching at application layer'
    ]
  },

  pg_smallserver: {
    name: 'Small VPS Server',
    description: 'Conservative settings for small VPS environments with limited resources',
    shared_buffers_percentage: 0.15,
    effective_cache_size_percentage: 0.50,
    work_mem_multiplier: 0.5,
    maintenance_work_mem_percentage: 0.03,
    max_connections_per_gb: 40,
    max_wal_size: '512MB',
    checkpoint_completion_target: 0.7,
    default_statistics_target: 100,
    max_parallel_workers_per_gather: 1,
    characteristics: [
      'Limited server resources (1-4 GB RAM)',
      'Shared hosting environment',
      'Low to moderate traffic',
      'Memory conservation is priority',
      'Simplified configuration for stability'
    ]
  }
};
