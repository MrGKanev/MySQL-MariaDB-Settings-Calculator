# MySQL, MariaDB & PostgreSQL Settings Calculator

A web-based tool for generating optimized database configurations based on your server's hardware. Supports MySQL, MariaDB, and PostgreSQL. Built with [Astro 7](https://astro.build) and [Tailwind CSS v4](https://tailwindcss.com).

**Live:**
- MySQL/MariaDB: https://database.gkanev.com/
- PostgreSQL: https://database.gkanev.com/postgresql

---

## Features

- **MySQL / MariaDB** and **PostgreSQL** — two separate SEO-indexed pages
- Version-specific exports: MySQL 8.0/8.4; MariaDB 10.6/10.11/11.4/11.8/12.3; PostgreSQL 14–18
- MariaDB 10.6 is retained for existing servers and marked as past community support; PostgreSQL defaults to 18
- Selected database version is preserved in shared URLs and container exports
- Memory-based calculations with OS and application memory reservation
- Workload templates: OLTP, OLAP, Mixed, Web Application, Small VPS
- Performance score with per-category breakdown and recommendations
- Export to `my.cnf`, `postgresql.conf`, `pg_hba.conf`, Docker Compose, JSON
- Shareable URLs — configuration encoded in query parameters
- Responsive design optimized for mobile and desktop
- Accessible: keyboard navigation, screen reader support, WCAG AA contrast

## Getting Started

Requires Node.js 22.12.0 or newer and pnpm 12.8.1 (pinned in `package.json`).

```bash
pnpm install
pnpm dev
```

Open http://localhost:4321 in your browser.

## Commands

| Command           | Description                          |
|-------------------|--------------------------------------|
| `pnpm dev`     | Start dev server with hot reload     |
| `pnpm build`   | Build for production -> `dist/`      |
| `pnpm preview` | Preview the production build locally |
| `pnpm test` | Run configuration regression tests |
| `pnpm test:database` | Validate against official database images (requires Docker) |

## Configuration validation

`pnpm test` checks version-specific settings, SQL size syntax, container image tags,
shared URL round-trips, and every workload template at memory/storage boundaries.
These tests also run before the production build in GitHub Actions.

`pnpm test:database` pulls official MySQL, MariaDB, and PostgreSQL images and uses
isolated, temporary containers without publishing ports or accessing existing databases.
It parses `my.cnf` with every supported MySQL/MariaDB server, executes the generated
`SET GLOBAL` scripts, and starts each PostgreSQL version with the generated
`postgresql.conf` and `pg_hba.conf` before executing its `ALTER SYSTEM` script.
This verifies configuration acceptance and SQL execution, not workload performance.

Docker Compose exports use the selected database version. MySQL/MariaDB exports
require the matching `my.cnf` export beside the Compose file; official images do not
apply arbitrary tuning settings supplied as environment variables. PostgreSQL
exports pass the calculated memory, connection, and I/O settings as command arguments.

Version compatibility references:
- [MariaDB maintenance policy](https://mariadb.org/about/)
- [MariaDB 10.6 removed options](https://mariadb.com/docs/server/server-management/install-and-upgrade-mariadb/upgrading/mariadb-community-server-upgrade-paths/upgrading-from-mariadb-10-5-to-mariadb-10-6)
- [MariaDB InnoDB flushing](https://mariadb.com/docs/server/server-usage/storage-engines/innodb/innodb-flush-method)
- [PostgreSQL version policy](https://www.postgresql.org/support/versioning/)
- [PostgreSQL 18 connection logging](https://www.postgresql.org/docs/18/runtime-config-logging.html)

## Calculation Methods

### MySQL / MariaDB

| Setting | Formula |
|---------|---------|
| `innodb_buffer_pool_size` | 70% of available memory |
| `max_connections` | ~100 per GB (capped by workload) |
| `innodb_log_file_size` | 25% of buffer pool |
| `innodb_io_capacity` | 100–2000 based on storage type |
| `innodb_flush_method` | OS-dependent (O_DIRECT on Linux) |

### PostgreSQL

| Setting | Formula |
|---------|---------|
| `shared_buffers` | 25% of available memory |
| `effective_cache_size` | 75% of total memory |
| `work_mem` | (RAM − shared_buffers) / (max_connections × 3) |
| `maintenance_work_mem` | 5% of available memory (max 2GB) |
| `wal_buffers` | 3% of shared_buffers (min 14MB) |
| `random_page_cost` | 1.1 (NVMe/SSD), 4.0 (HDD) |

All values are starting points. Monitor your database and adjust based on actual workload.

## Contributing

1. Fork the repository
2. Create a branch: `git checkout -b feature/your-feature`
3. Commit your changes
4. Push and open a Pull Request

## License

[MIT](LICENSE) — Created by [Gabriel Kanev](https://gkanev.com)
