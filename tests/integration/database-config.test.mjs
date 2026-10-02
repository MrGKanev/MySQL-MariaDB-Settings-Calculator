// Optional integration suite: requires a running Docker daemon and pulls official database images.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigGenerator } from '../../src/scripts/config-generator.js';
import { MySQLCalculator } from '../../src/scripts/calculations.js';
import { PostgreSQLCalculator } from '../../src/scripts/pg-calculations.js';
import { MYSQL_VERSIONS, MARIADB_VERSIONS, POSTGRESQL_VERSIONS } from '../../src/scripts/database-versions.js';

const exec = promisify(execFile);
const run = (args) => exec('docker', args, { timeout: 300_000, maxBuffer: 4 * 1024 * 1024 });
const generator = new ConfigGenerator();
const base = { totalMemory: 1, reservedMemory: 0, otherTasksMemory: 0, osType: 'linux', storageType: 'ssd', template: 'custom' };

for (const [engine, versions] of [['mysql', MYSQL_VERSIONS], ['mariadb', MARIADB_VERSIONS], ['postgresql', POSTGRESQL_VERSIONS]]) {
  for (const version of versions) {
    test(`${engine} ${version}: official server accepts generated configuration`, { timeout: 360_000 }, async () => {
      const folder = await mkdtemp(join(tmpdir(), 'db-calculator-'));
      const name = `db-calculator-${engine}-${version.replaceAll('.', '-')}-${process.pid}`;
      try {
        const calculator = engine === 'postgresql' ? new PostgreSQLCalculator() : new MySQLCalculator();
        const results = calculator.calculate({ ...base, dbType: engine === 'postgresql' ? engine : 'mysql', dbEngine: engine, dbVersion: version });
        const format = engine === 'postgresql' ? 'postgresql.conf' : 'my.cnf';
        await writeFile(join(folder, format), generator.generateConfig(results, format));
        await writeFile(join(folder, 'apply.sql'), generator.generateConfig(results, 'apply-sql'));
        await writeFile(join(folder, 'compose.yml'), generator.generateConfig(results, 'docker-compose'));
        await run(['compose', '-f', join(folder, 'compose.yml'), 'config', '--quiet']);
        if (engine === 'postgresql') {
          await writeFile(join(folder, 'pg_hba.conf'), generator.generateConfig(results, 'pg_hba.conf'));
          // Start a throwaway cluster, load both generated files, then let the SQL parser validate ALTER SYSTEM too.
          const { stderr } = await run(['run', '--rm', '--name', name, '--user', 'postgres', '-v', `${folder}:/config:ro`,
            '--entrypoint', 'sh', `postgres:${version}-alpine`, '-ec',
            'initdb -D /tmp/data -U postgres >/dev/null; pg_ctl -D /tmp/data -l /tmp/server.log -o "-c config_file=/config/postgresql.conf -c hba_file=/config/pg_hba.conf" start >/dev/null || { cat /tmp/server.log; exit 1; }; psql -U postgres -v ON_ERROR_STOP=1 -f /config/apply.sql; pg_ctl -D /tmp/data stop >/dev/null']);
          assert.doesNotMatch(stderr, /ERROR|FATAL/);
        } else {
          const daemon = engine === 'mariadb' ? 'mariadbd' : 'mysqld';
          // --verbose --help parses the whole option file without allocating a database's buffer pool.
          const { stderr } = await run(['run', '--rm', '--name', name, '-v', `${folder}:/config:ro`,
            '--entrypoint', 'sh', `${engine}:${version}`, '-ec',
            `mkdir -p /var/log/mysql /var/run/mysqld; chown mysql:mysql /var/log/mysql /var/run/mysqld; ${daemon} --defaults-file=/config/my.cnf --verbose --help`]);
          assert.doesNotMatch(stderr, /unknown (?:variable|option)|\[ERROR\]|has been removed/i);
        }
      } finally {
        await run(['rm', '-f', name]).catch(() => {});
        await rm(folder, { recursive: true, force: true });
      }
    });
  }
}

// Exercise SET GLOBAL against every supported engine version, rather than only checking its text.
for (const [engine, version] of [
  ...MYSQL_VERSIONS.map(version => ['mysql', version]),
  ...MARIADB_VERSIONS.map(version => ['mariadb', version])
]) {
  test(`${engine} ${version}: runtime SQL executes on an isolated server`, { timeout: 360_000 }, async () => {
    const folder = await mkdtemp(join(tmpdir(), 'db-calculator-sql-'));
    const name = `db-calculator-sql-${engine}-${version.replaceAll('.', '-')}-${process.pid}`;
    const client = engine === 'mariadb' ? 'mariadb' : 'mysql';
    try {
      const results = new MySQLCalculator().calculate({ ...base, dbType: 'mysql', dbEngine: engine, dbVersion: version });
      await writeFile(join(folder, 'my.cnf'), generator.generateConfig(results));
      await writeFile(join(folder, 'apply.sql'), generator.generateConfig(results, 'apply-sql'));
      await run(['run', '-d', '--name', name, '-v', `${folder}:/config:ro`,
        '-e', `${engine === 'mariadb' ? 'MARIADB' : 'MYSQL'}_ROOT_PASSWORD=calculator-test`, `${engine}:${version}`,
        '--defaults-file=/config/my.cnf', '--log-error=/var/lib/mysql/error.log',
        '--slow-query-log-file=/var/lib/mysql/slow.log', '--log-bin=/var/lib/mysql/mysql-bin']);
      let ready = false;
      for (let attempt = 0; attempt < 90; attempt++) {
        try {
          await run(['exec', '-e', 'MYSQL_PWD=calculator-test', name, client, '-h127.0.0.1', '-uroot', '-e', 'SELECT 1']);
          ready = true;
          break;
        } catch {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      if (!ready) {
        const logs = await run(['logs', name]);
        throw new Error(`Database did not become ready: ${logs.stdout}\n${logs.stderr}`);
      }
      await run(['exec', '-e', 'MYSQL_PWD=calculator-test', name, 'sh', '-ec', `${client} -h127.0.0.1 -uroot < /config/apply.sql`]);
    } finally {
      await run(['rm', '-f', name]).catch(() => {});
      await rm(folder, { recursive: true, force: true });
    }
  });
}
