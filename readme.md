# MySQL, MariaDB & PostgreSQL Settings Calculator

A web-based tool for generating optimized database configurations based on your server's hardware. Supports MySQL, MariaDB, and PostgreSQL. Built with [Astro 7](https://astro.build) and [Tailwind CSS v4](https://tailwindcss.com).

**Live:**
- MySQL/MariaDB: https://database.gkanev.com/
- PostgreSQL: https://database.gkanev.com/postgresql

---

## Features

- **MySQL / MariaDB** and **PostgreSQL** — two separate SEO-indexed pages
- Memory-based calculations with OS and application memory reservation
- Workload templates: OLTP, OLAP, Mixed, Web Application, Small VPS
- Performance score with per-category breakdown and recommendations
- Export to `my.cnf`, `postgresql.conf`, `pg_hba.conf`, Docker Compose, JSON
- Shareable URLs — configuration encoded in query parameters
- Responsive design optimized for mobile and desktop
- Accessible: keyboard navigation, screen reader support, WCAG AA contrast

## Getting Started

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
