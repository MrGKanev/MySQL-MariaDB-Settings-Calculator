# MySQL, MariaDB & PostgreSQL Settings Calculator

A web-based tool for generating optimized database configurations based on your server's hardware. Supports MySQL, MariaDB, and PostgreSQL. Built with [Astro 6](https://astro.build) and [Tailwind CSS v4](https://tailwindcss.com).

**Live:** https://gkanev.com/mysql-calculator

---

## Features

- **MySQL / MariaDB** and **PostgreSQL** support — toggle between them instantly
- Memory-based calculations with OS and application memory reservation
- Workload templates: OLTP, OLAP, Mixed, Web Application, Small VPS
- Performance score with per-category breakdown and recommendations
- Export to `my.cnf`, `postgresql.conf`, `pg_hba.conf`, Docker Compose, JSON
- Shareable URLs — configuration is encoded in query parameters
- Responsive, accessible design (keyboard navigation, screen reader support)

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:4321 in your browser.

## Commands

| Command           | Description                              |
|-------------------|------------------------------------------|
| `npm run dev`     | Start dev server with hot reload         |
| `npm run build`   | Build for production (output: `dist/`)   |
| `npm run preview` | Preview the production build locally     |

## Project Structure

```
src/
├── layouts/
│   └── Layout.astro          # HTML shell, meta tags, structured data
├── pages/
│   └── index.astro           # Main page
├── components/
│   ├── Header.astro          # Title + MySQL/PostgreSQL toggle
│   ├── ConfigForm.astro      # Input form
│   ├── ExportMenu.astro      # Export buttons and dropdown
│   ├── ConfigOutput.astro    # Generated config code block
│   ├── PerformanceScore.astro # Score visualization
│   ├── FaqSection.astro      # FAQ
│   ├── Sidebar.astro         # Links + footer
│   └── LoadingIndicator.astro
├── scripts/                  # Client-side JavaScript modules
│   ├── calculations.js       # MySQL/MariaDB calculator
│   ├── pg-calculations.js    # PostgreSQL calculator
│   ├── config-generator.js   # Config file generators
│   ├── templates.js          # MySQL workload templates
│   ├── pg-templates.js       # PostgreSQL workload templates
│   ├── ui.js                 # UI manager
│   ├── dom-cache.js          # DOM element cache
│   ├── utils.js              # Shared utilities
│   └── main.js               # App entry point
└── styles/
    └── global.css            # Tailwind CSS v4 import
```

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
| `random_page_cost` | 1.1 (NVMe), 1.5 (SSD), 4.0 (HDD) |

All values are starting points. Monitor your database and adjust based on actual workload.

## Contributing

1. Fork the repository
2. Create a branch: `git checkout -b feature/your-feature`
3. Commit your changes
4. Push and open a Pull Request

## License

[MIT](LICENSE) — Created by [Gabriel Kanev](https://gkanev.com)
