import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConfigGenerator } from '../src/scripts/config-generator.js';
import { MySQLCalculator } from '../src/scripts/calculations.js';
import { PostgreSQLCalculator } from '../src/scripts/pg-calculations.js';
import { MYSQL_VERSIONS, MARIADB_VERSIONS, POSTGRESQL_VERSIONS, normalizeSoftware } from '../src/scripts/database-versions.js';
import { WORKLOAD_TEMPLATES } from '../src/scripts/templates.js';
import { PG_WORKLOAD_TEMPLATES } from '../src/scripts/pg-templates.js';

const generator = new ConfigGenerator();
const mysql = new MySQLCalculator();
const postgres = new PostgreSQLCalculator();
const base = { totalMemory: 16, reservedMemory: 2, otherTasksMemory: 1, osType: 'linux', storageType: 'ssd', template: 'custom' };
const setting = (config, key) => config.match(new RegExp(`^${key}\\s*=\\s*(.+)$`, 'm'))?.[1];

for (const [engine, versions] of [['mysql', MYSQL_VERSIONS], ['mariadb', MARIADB_VERSIONS]]) {
  for (const version of versions) {
    test(`${engine} ${version}: version-compatible config and SQL`, () => {
      const results = mysql.calculate({ ...base, dbType: 'mysql', dbEngine: engine, dbVersion: version });
      const config = generator.generateConfig(results);
      const sql = generator.generateConfig(results, 'apply-sql');
      assert.ok(setting(config, 'innodb_buffer_pool_size'));
      assert.doesNotMatch(config + sql, /undefined|NaN/);
      assert.equal(setting(config, 'collation-server'), engine === 'mariadb' ? 'utf8mb4_unicode_ci' : 'utf8mb4_0900_ai_ci');
      assert.equal(setting(config, 'binlog_expire_logs_seconds'), '864000');
      assert.doesNotMatch(sql, /^SET GLOBAL \w+ = \d+[KMG];/m);
      assert.match(sql, /^SET GLOBAL max_allowed_packet = \d+;/m);
      if (engine === 'mariadb') {
        for (const removed of ['innodb_buffer_pool_instances', 'innodb_thread_concurrency', 'innodb_page_cleaners']) {
          assert.equal(setting(config, removed), undefined);
          assert.doesNotMatch(sql, new RegExp(`\\b${removed}\\b`));
        }
        assert.equal(setting(config, 'log_slow_replica_statements'), undefined);
        assert.equal(setting(config, 'replica_parallel_threads'), undefined);
        assert.equal(setting(config, 'log_slow_slave_statements'), 'ON');
        assert.ok(setting(config, 'slave_parallel_threads'));
        assert.ok(setting(config, 'query_cache_size'));
        assert.ok(setting(config, 'innodb_log_file_size'));
        assert.doesNotMatch(sql, /^SET GLOBAL innodb_log_buffer_size/m);
        if (version === '10.6') assert.doesNotMatch(sql, /^SET GLOBAL innodb_log_file_size/m);
        else assert.match(sql, /^SET GLOBAL innodb_log_file_size = \d+;/m);
        if (version !== '10.6') assert.equal(setting(config, 'innodb_change_buffering'), undefined);
        if (Number(version.split('.')[0]) >= 11) {
          assert.equal(setting(config, 'innodb_change_buffering'), undefined);
          assert.equal(setting(config, 'innodb_flush_method'), undefined);
          assert.doesNotMatch(sql, /innodb_change_buffering/);
          assert.equal(setting(config, 'innodb_data_file_buffering'), 'OFF');
          assert.match(sql, /SET GLOBAL innodb_data_file_buffering = OFF;/);
        }
      } else {
        assert.equal(setting(config, 'query_cache_size'), undefined);
        assert.ok(setting(config, 'innodb_buffer_pool_instances'));
        if (version === '8.4') {
          assert.equal(setting(config, 'innodb_log_file_size'), undefined);
          assert.equal(setting(config, 'expire_logs_days'), undefined);
          assert.equal(setting(config, 'default_authentication_plugin'), undefined);
          assert.ok(setting(config, 'innodb_redo_log_capacity'));
          assert.match(sql, /^SET GLOBAL innodb_redo_log_capacity = \d+;/m);
          assert.doesNotMatch(sql, /innodb_log_file_size/);
        }
      }
      const docker = generator.generateConfig(results, 'docker-compose');
      assert.match(docker, new RegExp(`image: ${engine}:${version}`));
      assert.match(docker, /\.\/my\.cnf:\/etc\/mysql\/conf\.d\/calculator\.cnf:ro/);
      assert.doesNotMatch(docker, /MYSQL_INNODB_/); // Official images do not apply these environment variables.
    });
  }
}

for (const version of POSTGRESQL_VERSIONS) {
  test(`PostgreSQL ${version}: config, SQL, container image and logging`, () => {
    const results = postgres.calculate({ ...base, dbType: 'postgresql', dbEngine: 'postgresql', dbVersion: version });
    const conf = generator.generateConfig(results, 'postgresql.conf');
    const sql = generator.generateConfig(results, 'apply-sql');
    assert.match(conf, new RegExp(`# PostgreSQL ${version} Configuration File`));
    assert.equal(setting(conf, 'log_connections'), version === '18' ? 'all' : 'on');
    assert.match(sql, /^ALTER SYSTEM SET shared_buffers = '\d+(?:GB|MB|kB|B)';/m);
    assert.match(sql, /SELECT pg_reload_conf\(\);/);
    assert.doesNotMatch(conf + sql, /undefined|NaN/);
    assert.match(generator.generateConfig(results, 'docker-compose'), new RegExp(`image: postgres:${version}-alpine`));
    assert.match(generator.generateConfig(results, 'kubernetes'), new RegExp(`image: postgres:${version}-alpine`));
    assert.match(generator.generateConfig(results, 'pg_hba.conf'), /scram-sha-256/);
  });
}

test('all workload templates and hardware boundaries generate finite values', () => {
  for (const [calculator, templates, engine, version, format] of [
    [mysql, WORKLOAD_TEMPLATES, 'mysql', '8.4', 'my.cnf'],
    [mysql, WORKLOAD_TEMPLATES, 'mariadb', '12.3', 'my.cnf'],
    [postgres, PG_WORKLOAD_TEMPLATES, 'postgresql', '18', 'postgresql.conf']
  ]) {
    for (const template of [null, ...Object.values(templates)]) {
      for (const memory of [1, 16, 512]) {
        for (const storageType of ['hdd', 'ssd', 'nvme']) {
          const results = calculator.calculate({ ...base, totalMemory: memory, reservedMemory: 0, otherTasksMemory: 0, storageType,
            dbType: engine === 'postgresql' ? engine : 'mysql', dbEngine: engine, dbVersion: version }, template);
          assert.doesNotMatch(generator.generateConfig(results, format), /undefined|NaN|Infinity/);
        }
      }
    }
  }
});

test('shared links round-trip every database version and reject invalid targets', () => {
  const previous = globalThis.window;
  try {
    for (const [engine, versions] of [['mysql', MYSQL_VERSIONS], ['mariadb', MARIADB_VERSIONS], ['postgresql', POSTGRESQL_VERSIONS]]) {
      for (const version of versions) {
        const inputs = { ...base, dbType: engine === 'postgresql' ? engine : 'mysql', dbEngine: engine, dbVersion: version };
        const url = generator.generateShareableURL({ inputs }, 'https://example.com/');
        globalThis.window = { location: { search: new URL(url).search } };
        assert.equal(generator.loadFromURL().dbSoftware, `${engine}-${version}`);
      }
    }
    assert.equal(normalizeSoftware('postgresql-current', 'postgresql'), 'postgresql-18');
    assert.equal(normalizeSoftware('postgresql-99', 'postgresql'), 'postgresql-18');
    assert.equal(normalizeSoftware('mysql-8.4', 'postgresql'), 'postgresql-18');
    globalThis.window = { location: { search: '?totalMemory=16&dbType=postgresql' } };
    assert.equal(generator.loadFromURL().dbSoftware, 'postgresql-18');
  } finally { globalThis.window = previous; }
});

