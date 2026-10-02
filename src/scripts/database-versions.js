// Supported configuration targets. Keep legacy targets for existing servers and shared URLs.
export const MYSQL_VERSIONS = ['8.0', '8.4'];
export const MARIADB_VERSIONS = ['10.6', '10.11', '11.4', '11.8', '12.3'];
export const POSTGRESQL_VERSIONS = ['14', '15', '16', '17', '18'];
export const DEFAULT_POSTGRESQL_VERSION = '18';
export const MYSQL_DEFAULT_SOFTWARE = 'mysql-8.0';
export const POSTGRESQL_DEFAULT_SOFTWARE = `postgresql-${DEFAULT_POSTGRESQL_VERSION}`;

export const DATABASE_OPTIONS = [
  ...MYSQL_VERSIONS.map(version => ({ value: `mysql-${version}`, label: `MySQL ${version}${version === '8.4' ? ' LTS' : ''}`, engine: 'mysql' })),
  ...MARIADB_VERSIONS.map(version => ({ value: `mariadb-${version}`, label: `MariaDB ${version}${version === '10.6' ? ' (Community support ended)' : ' LTS'}`, engine: 'mariadb' })),
  ...POSTGRESQL_VERSIONS.map(version => ({ value: `postgresql-${version}`, label: `PostgreSQL ${version}`, engine: 'postgresql' }))
];

export function normalizeSoftware(value, dbType = 'mysql') {
  // Old PostgreSQL links used "current" rather than a major version.
  if (value === 'postgresql-current') value = POSTGRESQL_DEFAULT_SOFTWARE;
  return DATABASE_OPTIONS.some(option => option.value === value && (dbType === 'postgresql' ? option.engine === 'postgresql' : option.engine !== 'postgresql'))
    ? value
    : dbType === 'postgresql' ? POSTGRESQL_DEFAULT_SOFTWARE : MYSQL_DEFAULT_SOFTWARE;
}

export function getPostgresqlVersion(inputs) {
  const software = normalizeSoftware(`postgresql-${inputs.dbVersion || DEFAULT_POSTGRESQL_VERSION}`, 'postgresql');
  return software.split('-')[1];
}

// MariaDB 10.6 removed the instance/concurrency/cleaner options; 10.9 ignores change buffering and 11.0 removes it.
// https://mariadb.com/docs/server/server-management/install-and-upgrade-mariadb/upgrading/mariadb-community-server-upgrade-paths/upgrading-from-mariadb-10-5-to-mariadb-10-6
export function getMySQLSettingName(setting, inputs) {
  const isMariaDB = inputs.dbEngine === 'mariadb';
  const major = Number((inputs.dbVersion || '8.0').split('.')[0]);
  if (isMariaDB && ['innodb_buffer_pool_instances', 'innodb_thread_concurrency', 'innodb_page_cleaners'].includes(setting)) return null;
  if (isMariaDB && (major >= 11 || inputs.dbVersion === '10.11') && setting === 'innodb_change_buffering') return null;
  if (isMariaDB && major >= 11 && setting === 'innodb_flush_method') return null;
  if (!isMariaDB && setting === 'query_cache_size') return null;
  if (!isMariaDB && inputs.dbVersion === '8.4' && setting === 'innodb_log_file_size') return 'innodb_redo_log_capacity';
  return setting;
}

// MariaDB 11.0 replaces the flush-method enum with independent buffering/write-through flags.
// https://mariadb.com/docs/server/server-usage/storage-engines/innodb/innodb-flush-method
export function getMariaDBFlushSettings(inputs) {
  if (inputs.dbEngine !== 'mariadb' || Number(inputs.dbVersion.split('.')[0]) < 11) return {};
  return {
    innodb_data_file_buffering: inputs.osType === 'linux' ? 'OFF' : 'ON',
    innodb_log_file_buffering: 'OFF',
    innodb_data_file_write_through: 'OFF',
    innodb_log_file_write_through: 'OFF'
  };
}
