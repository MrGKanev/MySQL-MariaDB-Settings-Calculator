import { domCache } from './dom-cache.js';
import { formatBytes, debounce } from './utils.js';
import { mysqlCalculator } from './calculations.js';
import { postgresqlCalculator } from './pg-calculations.js';
import { templateManager } from './templates.js';
import { PG_WORKLOAD_TEMPLATES } from './pg-templates.js';
import { configGenerator } from './config-generator.js';

/**
 * UI Manager - Handles all user interface interactions and updates
 */
export class UIManager {
  constructor() {
    this.isInitialized = false;
    this.currentResults = null;
    this.currentDbType = 'mysql';
    this.loadingStates = new Set();
    this.debouncedCalculate = debounce(this.performCalculation.bind(this), 150);
  }

  /**
   * Initialize the UI manager
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      // Initialize DOM cache first
      domCache.initialize();

      // Read initial db type from body data attribute
      this.currentDbType = document.body.dataset.dbType || 'mysql';

      // Setup event listeners
      this.setupEventListeners();

      // Setup slider synchronization
      this.setupSliderSync();

      // Set current year in footer
      domCache.setText('currentYear', new Date().getFullYear().toString());

      // Load configuration from URL if available
      this.loadConfigFromURL();

      // Perform initial calculation
      await this.performCalculation();

      this.isInitialized = true;
    } catch (error) {
      console.error('Error initializing UI Manager:', error);
      this.showError('Failed to initialize calculator. Please refresh the page.');
    }
  }

  /**
   * Setup event listeners for all interactive elements
   */
  setupEventListeners() {
    // Template selection
    domCache.addEventListener('workloadTemplate', 'change', (e) => {
      this.handleTemplateChange(e.target.value);
    });

    // Memory input changes
    ['totalMemory', 'reservedMemory', 'otherTasksMemory'].forEach(id => {
      domCache.addEventListener(id, 'input', () => {
        this.debouncedCalculate();
      });
    });

    // System configuration changes
    ['osType', 'storageType'].forEach(id => {
      domCache.addEventListener(id, 'change', () => {
        this.debouncedCalculate();
      });
    });

    // Button actions
    domCache.addEventListener('generateConfigBtn', 'click', () => {
      this.handleGenerateConfig();
    });

    domCache.addEventListener('copyConfigBtn', 'click', () => {
      this.handleCopyConfig();
    });

    domCache.addEventListener('downloadConfigBtn', 'click', () => {
      this.handleDownloadConfig();
    });

    // New UI buttons
    this.setupNewUIButtons();

    // Export dropdown functionality
    this.setupExportDropdown();

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      this.handleKeyboardShortcuts(e);
    });

    // Click outside handler for dropdowns
    document.addEventListener('click', (e) => {
      this.handleClickOutside(e);
    });
  }

  /**
   * Setup new UI buttons added in the refactoring
   * Uses domCache for consistent DOM access
   */
  setupNewUIButtons() {
    // Help button
    domCache.addEventListener('helpButton', 'click', () => {
      this.showHelpModal();
    });

    // Share button
    domCache.addEventListener('shareButton', 'click', () => {
      this.handleShareConfig();
    });

    // Reset button
    domCache.addEventListener('resetButton', 'click', () => {
      this.handleResetForm();
    });

    // Config copy button in the output area
    domCache.addEventListener('configCopyBtn', 'click', () => {
      this.handleCopyConfig();
    });
  }

  /**
   * Setup export dropdown functionality
   * Uses domCache for consistent DOM access
   */
  setupExportDropdown() {
    const exportBtn = domCache.get('exportOptionsBtn');
    const exportMenu = domCache.get('exportMenu');

    if (exportBtn && exportMenu) {
      exportBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = domCache.hasClass('exportMenu', 'hidden');

        if (isOpen) {
          domCache.show('exportMenu');
          exportBtn.setAttribute('aria-expanded', 'true');
        } else {
          domCache.hide('exportMenu');
          exportBtn.setAttribute('aria-expanded', 'false');
        }
      });

      // Handle export options
      const exportOptions = exportMenu.querySelectorAll('.export-option');
      exportOptions.forEach(option => {
        option.addEventListener('click', (e) => {
          e.stopPropagation();
          this.handleExportOption(option);
          domCache.hide('exportMenu');
          exportBtn.setAttribute('aria-expanded', 'false');
        });
      });
    }
  }

  /**
   * Switch between MySQL and PostgreSQL modes
   */
  switchDatabaseType(dbType) {
    if (this.currentDbType === dbType) return;
    this.currentDbType = dbType;

    const isPostgres = dbType === 'postgresql';
    const mysqlBtn = domCache.get('dbToggleMySQL');
    const pgBtn = domCache.get('dbTogglePostgreSQL');

    // Update toggle styling
    if (mysqlBtn && pgBtn) {
      if (isPostgres) {
        mysqlBtn.className = 'px-4 py-1.5 rounded-full text-sm font-medium transition-colors text-zinc-600';
        mysqlBtn.setAttribute('aria-checked', 'false');
        pgBtn.className = 'px-4 py-1.5 rounded-full text-sm font-medium transition-colors bg-blue-600 text-white';
        pgBtn.setAttribute('aria-checked', 'true');
      } else {
        mysqlBtn.className = 'px-4 py-1.5 rounded-full text-sm font-medium transition-colors bg-blue-600 text-white';
        mysqlBtn.setAttribute('aria-checked', 'true');
        pgBtn.className = 'px-4 py-1.5 rounded-full text-sm font-medium transition-colors text-zinc-600';
        pgBtn.setAttribute('aria-checked', 'false');
      }
    }

    // Update page title and document title
    domCache.setText('pageTitle', isPostgres
      ? 'PostgreSQL Settings Calculator'
      : 'MySQL/MariaDB Settings Calculator');
    document.title = isPostgres
      ? 'PostgreSQL Performance Calculator - Optimize Database Settings | Gabriel Kanev'
      : 'MySQL/MariaDB & PostgreSQL Performance Calculator - Optimize Database Settings | Gabriel Kanev';

    // Update page description
    domCache.setText('pageDescription', isPostgres
      ? 'Generate optimized PostgreSQL configurations based on your server specifications'
      : 'Generate optimized database configurations based on your server specifications');

    // Swap workload template options
    this.updateTemplateOptions(isPostgres);

    // Update help text
    this.updateHelpText(isPostgres);

    // Update action button labels
    this.updateButtonLabels(isPostgres);

    // Update export menu first item
    this.updateExportMenu(isPostgres);

    // Hide stale config output
    this.hideConfigOutput();

    // Re-run calculation
    this.debouncedCalculate();

    // Screen reader announcement
    this.announceToScreenReader(`Switched to ${isPostgres ? 'PostgreSQL' : 'MySQL/MariaDB'} mode`);
  }

  /**
   * Update template dropdown options for database type
   */
  updateTemplateOptions(isPostgres) {
    const select = domCache.get('workloadTemplate');
    if (!select) return;

    if (isPostgres) {
      select.innerHTML = `
        <option value="custom">Custom Configuration</option>
        <option value="pg_oltp">OLTP (Online Transaction Processing)</option>
        <option value="pg_olap">OLAP (Online Analytical Processing)</option>
        <option value="pg_mixed">Mixed Workload</option>
        <option value="pg_webserver">Web Application</option>
        <option value="pg_smallserver">Small VPS Server</option>
      `;
    } else {
      select.innerHTML = `
        <option value="custom">Custom Configuration</option>
        <option value="oltp">OLTP (Online Transaction Processing)</option>
        <option value="olap">OLAP (Online Analytical Processing)</option>
        <option value="mixed">Mixed Workload</option>
        <option value="webserver">Web Server</option>
        <option value="smallserver">Small VPS Server</option>
      `;
    }
    select.value = 'custom';
    templateManager.setTemplate('custom');

    // Remove template info display
    const infoElement = document.getElementById('templateInfo');
    if (infoElement) infoElement.remove();
  }

  /**
   * Update help text for storage/OS fields based on db type
   */
  updateHelpText(isPostgres) {
    const osHelp = document.getElementById('osType-help');
    if (osHelp) {
      osHelp.textContent = isPostgres
        ? 'Affects huge_pages setting recommendation'
        : 'Affects optimal InnoDB flush method settings';
    }

    const storageHelp = document.getElementById('storageType-help');
    if (storageHelp) {
      storageHelp.textContent = isPostgres
        ? 'Affects random_page_cost and effective_io_concurrency settings'
        : 'Affects InnoDB I/O optimizations and flush neighbors setting';
    }
  }

  /**
   * Update action button labels for database type
   */
  updateButtonLabels(isPostgres) {
    const generateBtn = domCache.get('generateConfigBtn');
    if (generateBtn) {
      generateBtn.textContent = isPostgres ? 'Generate postgresql.conf File' : 'Generate my.cnf File';
    }

    const downloadBtn = domCache.get('downloadConfigBtn');
    if (downloadBtn) {
      downloadBtn.textContent = isPostgres ? 'Download postgresql.conf' : 'Download my.cnf';
    }
  }

  /**
   * Update FAQ content for database type
   */
  updateFaqContent(isPostgres) {
    const faqContainer = domCache.get('faqContent');
    if (!faqContainer) return;

    if (isPostgres) {
      faqContainer.innerHTML = `
        <details class="border-b border-zinc-200 pb-4">
          <summary class="text-lg font-semibold cursor-pointer hover:text-blue-600 focus:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300 rounded">
            What is shared_buffers?
          </summary>
          <p class="mt-2 text-zinc-700">
            shared_buffers sets the amount of memory PostgreSQL uses for shared memory buffers.
            The recommended starting point is 25% of total system memory. Unlike MySQL's buffer pool,
            PostgreSQL relies heavily on the OS page cache, so setting this too high can actually hurt performance.
          </p>
        </details>
        <details class="border-b border-zinc-200 pb-4">
          <summary class="text-lg font-semibold cursor-pointer hover:text-blue-600 focus:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300 rounded">
            What is effective_cache_size?
          </summary>
          <p class="mt-2 text-zinc-700">
            effective_cache_size provides an estimate to the query planner of how much memory is available
            for disk caching. It includes both shared_buffers and OS file system cache. A good starting
            value is 75% of total system memory. This setting does not allocate memory - it only informs the planner.
          </p>
        </details>
        <details class="border-b border-zinc-200 pb-4">
          <summary class="text-lg font-semibold cursor-pointer hover:text-blue-600 focus:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300 rounded">
            How does work_mem affect queries?
          </summary>
          <p class="mt-2 text-zinc-700">
            work_mem sets the amount of memory used for sort operations and hash tables before writing
            to temporary disk files. A single complex query can use multiple units of work_mem simultaneously.
            Setting this too high with many connections can exhaust memory; too low causes frequent disk spills.
          </p>
        </details>
        <details class="border-b border-zinc-200 pb-4">
          <summary class="text-lg font-semibold cursor-pointer hover:text-blue-600 focus:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300 rounded">
            Why use a connection pooler?
          </summary>
          <p class="mt-2 text-zinc-700">
            PostgreSQL creates a new process for each connection, using about 10MB of memory each.
            Connection poolers like PgBouncer or pgpool-II multiplex many client connections over fewer
            server connections, dramatically reducing memory usage and improving performance.
          </p>
        </details>
        <details class="border-b border-zinc-200 pb-4">
          <summary class="text-lg font-semibold cursor-pointer hover:text-blue-600 focus:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300 rounded">
            What does random_page_cost control?
          </summary>
          <p class="mt-2 text-zinc-700">
            random_page_cost tells the query planner the estimated cost of a non-sequential disk page fetch.
            For SSDs and NVMe drives, set this to 1.1 (close to sequential cost). For HDDs, the default of
            4.0 is appropriate. Incorrect values can cause the planner to choose suboptimal query plans.
          </p>
        </details>
        <details>
          <summary class="text-lg font-semibold cursor-pointer hover:text-blue-600 focus:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300 rounded">
            Are these settings optimal for all scenarios?
          </summary>
          <p class="mt-2 text-zinc-700">
            No, these are general recommendations based on PostgreSQL best practices. Optimal settings
            depend on your specific workload, data size, and query patterns. Use pg_stat_statements,
            EXPLAIN ANALYZE, and monitoring tools like pgBadger to fine-tune for your environment.
          </p>
        </details>
      `;
    } else {
      faqContainer.innerHTML = `
        <details class="border-b border-zinc-200 pb-4">
          <summary class="text-lg font-semibold cursor-pointer hover:text-blue-600 focus:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300 rounded">
            What is innodb_buffer_pool_size?
          </summary>
          <p class="mt-2 text-zinc-700">
            The innodb_buffer_pool_size is the size in bytes of the memory buffer InnoDB uses to
            cache data and indexes of its tables. This is the most important MySQL configuration
            setting for performance.
          </p>
        </details>
        <details class="border-b border-zinc-200 pb-4">
          <summary class="text-lg font-semibold cursor-pointer hover:text-blue-600 focus:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300 rounded">
            How is max_connections calculated?
          </summary>
          <p class="mt-2 text-zinc-700">
            In this calculator, max_connections is estimated based on available memory and
            workload type.
            The actual optimal value depends on your specific workload, connection pooling, and
            server configuration.
          </p>
        </details>
        <details class="border-b border-zinc-200 pb-4">
          <summary class="text-lg font-semibold cursor-pointer hover:text-blue-600 focus:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300 rounded">
            Why is some memory reserved for the OS?
          </summary>
          <p class="mt-2 text-zinc-700">
            Reserving memory for the OS ensures that the system has enough resources to run
            smoothly,
            preventing potential slowdowns or crashes due to memory exhaustion. A good rule of
            thumb is 10-20% of total RAM.
          </p>
        </details>
        <details class="border-b border-zinc-200 pb-4">
          <summary class="text-lg font-semibold cursor-pointer hover:text-blue-600 focus:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300 rounded">
            Are these settings optimal for all scenarios?
          </summary>
          <p class="mt-2 text-zinc-700">
            No, these are general recommendations. The optimal settings can vary greatly
            depending on
            your specific use case, workload patterns, and hardware. Always monitor your
            system's performance and adjust accordingly.
          </p>
        </details>
        <details class="border-b border-zinc-200 pb-4">
          <summary class="text-lg font-semibold cursor-pointer hover:text-blue-600 focus:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300 rounded">
            Why do different storage types matter?
          </summary>
          <p class="mt-2 text-zinc-700">
            SSDs and NVMe drives have much higher IOPS (Input/Output Operations Per Second) than
            traditional HDDs. Settings like innodb_io_capacity, innodb_flush_neighbors, and
            innodb_flush_method should be optimized differently based on your storage type.
          </p>
        </details>
        <details>
          <summary class="text-lg font-semibold cursor-pointer hover:text-blue-600 focus:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300 rounded">
            How is innodb_flush_method chosen?
          </summary>
          <p class="mt-2 text-zinc-700">
            The optimal innodb_flush_method varies by operating system. For Linux, O_DIRECT is
            generally recommended as it bypasses the filesystem cache. For Windows, unbuffered
            is typically best, while macOS often works best with fsync.
          </p>
        </details>
      `;
    }
  }

  /**
   * Update sidebar links for database type
   */
  updateSidebarContent(isPostgres) {
    const sidebarContainer = domCache.get('sidebarContent');
    if (!sidebarContainer) return;

    const linkClass = 'text-blue-500 hover:underline focus:underline focus:outline-none focus:ring-2 focus:ring-blue-300 rounded';

    if (isPostgres) {
      sidebarContainer.innerHTML = `
        <section class="mb-4">
          <h3 class="text-lg font-semibold mb-2">PostgreSQL Tutorials</h3>
          <ul class="list-disc pl-5 space-y-1">
            <li><a href="https://www.postgresql.org/docs/current/tutorial.html" class="${linkClass}" target="_blank" rel="noopener">PostgreSQL Official Tutorial</a></li>
            <li><a href="https://www.postgresqltutorial.com/" class="${linkClass}" target="_blank" rel="noopener">PostgreSQL Tutorial</a></li>
          </ul>
        </section>
        <section class="mb-4">
          <h3 class="text-lg font-semibold mb-2">Performance Tuning</h3>
          <ul class="list-disc pl-5 space-y-1">
            <li><a href="https://wiki.postgresql.org/wiki/Tuning_Your_PostgreSQL_Server" class="${linkClass}" target="_blank" rel="noopener">Tuning Your PostgreSQL Server</a></li>
            <li><a href="https://pgtune.leopard.in.ua/" class="${linkClass}" target="_blank" rel="noopener">PGTune - Configuration Calculator</a></li>
          </ul>
        </section>
        <section>
          <h3 class="text-lg font-semibold mb-2">Documentation</h3>
          <ul class="list-disc pl-5 space-y-1">
            <li><a href="https://www.postgresql.org/docs/current/" class="${linkClass}" target="_blank" rel="noopener">PostgreSQL Documentation</a></li>
            <li><a href="https://www.postgresql.org/docs/current/runtime-config.html" class="${linkClass}" target="_blank" rel="noopener">Server Configuration</a></li>
          </ul>
        </section>
      `;
    } else {
      sidebarContainer.innerHTML = `
        <section class="mb-4">
          <h3 class="text-lg font-semibold mb-2">MySQL Tutorials</h3>
          <ul class="list-disc pl-5 space-y-1">
            <li><a href="https://dev.mysql.com/doc/refman/8.0/en/tutorial.html" class="${linkClass}" target="_blank" rel="noopener">MySQL Official Tutorial</a></li>
            <li><a href="https://www.w3schools.com/mysql/" class="${linkClass}" target="_blank" rel="noopener">W3Schools MySQL Tutorial</a></li>
          </ul>
        </section>
        <section class="mb-4">
          <h3 class="text-lg font-semibold mb-2">MariaDB Tutorials</h3>
          <ul class="list-disc pl-5 space-y-1">
            <li><a href="https://mariadb.com/kb/en/training-tutorials/" class="${linkClass}" target="_blank" rel="noopener">MariaDB Tutorials</a></li>
            <li><a href="https://www.tutorialspoint.com/mariadb/" class="${linkClass}" target="_blank" rel="noopener">TutorialsPoint MariaDB Tutorial</a></li>
          </ul>
        </section>
        <section>
          <h3 class="text-lg font-semibold mb-2">Documentation</h3>
          <ul class="list-disc pl-5 space-y-1">
            <li><a href="https://dev.mysql.com/doc/" class="${linkClass}" target="_blank" rel="noopener">MySQL Documentation</a></li>
            <li><a href="https://mariadb.com/kb/en/documentation/" class="${linkClass}" target="_blank" rel="noopener">MariaDB Documentation</a></li>
          </ul>
        </section>
      `;
    }
  }

  /**
   * Update export menu for database type
   */
  updateExportMenu(isPostgres) {
    const exportConfigBtn = domCache.get('exportConfigBtn');
    if (exportConfigBtn) {
      exportConfigBtn.textContent = isPostgres ? 'Download postgresql.conf' : 'Download my.cnf';
      exportConfigBtn.dataset.format = isPostgres ? 'postgresql.conf' : 'my.cnf';
    }

    const pgHbaBtn = document.getElementById('exportPgHbaBtn');
    if (pgHbaBtn) {
      pgHbaBtn.classList.toggle('hidden', !isPostgres);
    }
  }

  /**
   * Handle export option selection
   */
  async handleExportOption(option) {
    const format = option.dataset.format;
    const action = option.dataset.action;

    if (!this.currentResults) {
      this.showError('Please generate a configuration first.');
      return;
    }

    try {
      if (action === 'copy') {
        await this.handleCopyConfig();
      } else if (format) {
        const result = await configGenerator.exportToFile(this.currentResults, format, null, {
          databaseType: this.currentDbType
        });
        this.showSuccessMessage('exportOptionsBtn', 'Downloaded!', 2000);
        this.announceToScreenReader(`${format} configuration downloaded successfully`);
      }
    } catch (error) {
      this.showError(`Failed to export configuration as ${format}.`);
    }
  }

  /**
   * Handle share configuration
   */
  async handleShareConfig() {
    if (!this.currentResults) {
      this.showError('No configuration to share. Please generate a configuration first.');
      return;
    }

    try {
      const shareableURL = configGenerator.generateShareableURL(this.currentResults);
      
      // Try to use Web Share API if available
      const dbLabel = this.currentDbType === 'postgresql' ? 'PostgreSQL' : 'MySQL/MariaDB';
      if (navigator.share) {
        await navigator.share({
          title: `${dbLabel} Configuration`,
          text: `Check out this optimized ${dbLabel} configuration`,
          url: shareableURL
        });
      } else {
        // Fallback to clipboard
        await navigator.clipboard.writeText(shareableURL);
        this.showSuccessMessage('shareButton', 'Link Copied!', 2000);
        this.announceToScreenReader('Shareable configuration link copied to clipboard');
      }
    } catch (error) {
      this.showError('Failed to share configuration.');
    }
  }

  /**
   * Handle form reset
   */
  handleResetForm() {
    if (confirm('Are you sure you want to reset all settings to default values?')) {
      this.resetForm();
      this.announceToScreenReader('Form has been reset to default values');
    }
  }

  /**
   * Show help modal with proper event listener cleanup
   */
  showHelpModal() {
    const existingModal = document.querySelector('.help-modal');
    if (existingModal) {
      existingModal.remove();
    }

    // Store reference to escape handler for cleanup
    let escapeHandler = null;

    // Cleanup function to properly remove all event listeners
    const closeModal = () => {
      const modal = document.querySelector('.help-modal');
      if (modal) {
        modal.remove();
      }
      if (escapeHandler) {
        document.removeEventListener('keydown', escapeHandler);
        escapeHandler = null;
      }
      document.getElementById('helpButton')?.focus();
    };

    escapeHandler = (e) => {
      if (e.key === 'Escape') {
        closeModal();
      }
    };

    // Build modal using DOM methods for better security
    const modal = document.createElement('div');
    modal.className = 'help-modal fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-labelledby', 'help-title');
    modal.setAttribute('aria-modal', 'true');

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });

    // Static help content (safe - no user input)
    const helpHTML = this.getHelpModalContent();
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto';
    contentWrapper.innerHTML = helpHTML;

    // Setup close button with proper event listener
    const closeButton = contentWrapper.querySelector('.help-modal-close');
    if (closeButton) {
      closeButton.addEventListener('click', closeModal);
    }

    modal.appendChild(contentWrapper);
    document.body.appendChild(modal);

    // Focus management
    if (closeButton) {
      closeButton.focus();
    }

    // Setup escape key handler
    document.addEventListener('keydown', escapeHandler);

    this.announceToScreenReader('Help modal opened');
  }

  /**
   * Get static help modal content (no user input - safe for innerHTML)
   */
  getHelpModalContent() {
    return `
      <div class="p-6">
        <h2 id="help-title" class="text-2xl font-bold mb-4 text-blue-600">MySQL/MariaDB Calculator Help</h2>

        <div class="space-y-4">
          <section>
            <h3 class="text-lg font-semibold mb-2">Keyboard Shortcuts</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              <div><kbd class="bg-zinc-100 px-2 py-1 rounded">Ctrl/Cmd + G</kbd> Generate config</div>
              <div><kbd class="bg-zinc-100 px-2 py-1 rounded">Ctrl/Cmd + C</kbd> Copy config (when visible)</div>
              <div><kbd class="bg-zinc-100 px-2 py-1 rounded">F1</kbd> or <kbd class="bg-zinc-100 px-2 py-1 rounded">Shift + ?</kbd> Show help</div>
              <div><kbd class="bg-zinc-100 px-2 py-1 rounded">Shift + Arrow</kbd> Fine-tune sliders (0.1 increments)</div>
              <div><kbd class="bg-zinc-100 px-2 py-1 rounded">Ctrl + Arrow</kbd> Coarse-tune sliders (10 increments)</div>
              <div><kbd class="bg-zinc-100 px-2 py-1 rounded">Home/End</kbd> Min/Max slider values</div>
            </div>
          </section>

          <section>
            <h3 class="text-lg font-semibold mb-2">Usage Tips</h3>
            <ul class="list-disc list-inside space-y-1 text-sm">
              <li>Use workload templates for common configurations</li>
              <li>Monitor the performance score for optimization guidance</li>
              <li>Always test configurations in development first</li>
              <li>Consider your actual workload patterns when choosing settings</li>
              <li>Leave adequate memory for the operating system</li>
              <li>Use the share feature to save and share configurations</li>
            </ul>
          </section>

          <section>
            <h3 class="text-lg font-semibold mb-2">Workload Templates</h3>
            <div class="grid grid-cols-1 gap-2 text-sm">
              <div><strong>OLTP:</strong> High concurrency, fast transactions, strong consistency</div>
              <div><strong>OLAP:</strong> Complex queries, data analysis, large result sets</div>
              <div><strong>Mixed:</strong> Balanced for most applications with varied workloads</div>
              <div><strong>Web Server:</strong> Optimized for web applications with database backend</div>
              <div><strong>Small VPS:</strong> Conservative settings for limited resources</div>
            </div>
          </section>

          <section>
            <h3 class="text-lg font-semibold mb-2">Export Options</h3>
            <ul class="list-disc list-inside space-y-1 text-sm">
              <li><strong>my.cnf:</strong> Standard MySQL configuration file</li>
              <li><strong>JSON:</strong> Structured data format for automation</li>
              <li><strong>Docker Compose:</strong> Environment variables for containers</li>
              <li><strong>Copy to Clipboard:</strong> Quick sharing and pasting</li>
            </ul>
          </section>
        </div>

        <div class="mt-6 flex justify-end">
          <button class="help-modal-close bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-300">
            Close
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Handle clicks outside dropdowns
   * Uses domCache for consistent DOM access
   */
  handleClickOutside(e) {
    const exportMenu = domCache.get('exportMenu');
    const exportBtn = domCache.get('exportOptionsBtn');

    if (exportMenu && !exportMenu.contains(e.target) && !exportBtn?.contains(e.target)) {
      domCache.hide('exportMenu');
      exportBtn?.setAttribute('aria-expanded', 'false');
    }
  }

  /**
   * Get adaptive step size based on current value
   */
  getAdaptiveStep(value, sliderType) {
    if (sliderType === 'totalMemory') {
      if (value < 32) return 0.5;
      if (value < 128) return 1;
      return 2;
    } else if (sliderType === 'otherTasksMemory') {
      if (value < 32) return 0.5;
      return 1;
    } else if (sliderType === 'reservedMemory') {
      return 0.1; // Keep fine control for reserved memory
    }
    return 1;
  }

  /**
   * Update slider step attribute dynamically
   */
  updateSliderStep(slider, sliderType) {
    const currentValue = parseFloat(slider.value);
    const newStep = this.getAdaptiveStep(currentValue, sliderType);
    slider.step = newStep;
  }

  /**
   * Setup slider and input synchronization
   */
  setupSliderSync() {
    const syncPairs = [
      ['totalMemorySlider', 'totalMemory', 512, 'totalMemory'],
      ['reservedMemorySlider', 'reservedMemory', 256, 'reservedMemory'],
      ['otherTasksMemorySlider', 'otherTasksMemory', 256, 'otherTasksMemory']
    ];

    syncPairs.forEach(([sliderId, inputId, max, sliderType]) => {
      this.syncSliderAndInput(sliderId, inputId, max, sliderType);
    });
  }

  /**
   * Synchronize slider and text input values with adaptive steps
   */
  syncSliderAndInput(sliderId, inputId, max, sliderType) {
    const slider = domCache.get(sliderId);
    const input = domCache.get(inputId);

    if (!slider || !input) return;

    // Set initial step
    this.updateSliderStep(slider, sliderType);

    slider.addEventListener('input', () => {
      // Update step based on current value
      this.updateSliderStep(slider, sliderType);
      
      input.value = slider.value;
      this.debouncedCalculate();
    });

    input.addEventListener('input', () => {
      let value = parseFloat(input.value);
      if (isNaN(value)) value = 0;
      if (value > max) value = max;
      if (value < 0) value = 0;
      
      input.value = value;
      slider.value = value;
      
      // Update step based on new value
      this.updateSliderStep(slider, sliderType);
      
      this.debouncedCalculate();
    });

    // Initialize slider max value
    slider.max = max;
  }

  /**
   * Handle template selection changes
   */
  handleTemplateChange(templateName) {
    let template;
    if (this.currentDbType === 'postgresql') {
      // Look up from PG templates directly
      template = templateName === 'custom' ? null : PG_WORKLOAD_TEMPLATES[templateName] || null;
      // Still set on templateManager for consistency
      templateManager.setTemplate('custom');
    } else {
      template = templateManager.setTemplate(templateName);
    }

    if (template && template.characteristics) {
      this.showTemplateInfo(template);
    }

    this.debouncedCalculate();
  }

  /**
   * Show template information to user
   */
  showTemplateInfo(template) {
    // Create or update template info display
    let infoElement = document.getElementById('templateInfo');
    
    if (!infoElement) {
      infoElement = document.createElement('div');
      infoElement.id = 'templateInfo';
      infoElement.className = 'mt-2 p-3 bg-blue-50 rounded-md text-sm';
      
      const templateSelect = domCache.get('workloadTemplate');
      if (templateSelect && templateSelect.parentNode) {
        templateSelect.parentNode.appendChild(infoElement);
      }
    }

    const characteristics = template.characteristics 
      ? template.characteristics.map(char => `• ${char}`).join('\n')
      : '';

    infoElement.innerHTML = `
      <div class="font-medium text-blue-800">${template.name}</div>
      <div class="text-blue-700 mb-2">${template.description}</div>
      ${characteristics ? `<div class="text-blue-600 text-xs whitespace-pre-line">${characteristics}</div>` : ''}
    `;

    // Auto-hide after a few seconds
    setTimeout(() => {
      infoElement.style.opacity = '0.7';
    }, 5000);
  }

  /**
   * Perform MySQL calculations and update UI
   * Uses batch DOM updates for better performance
   */
  async performCalculation() {
    try {
      const inputs = this.collectInputs();

      // Validate inputs are numbers before setting loading state
      if (isNaN(inputs.totalMemory) || isNaN(inputs.reservedMemory) || isNaN(inputs.otherTasksMemory)) {
        console.warn('Invalid memory values detected:', inputs);
        this.showError('Invalid memory values. Please enter valid numbers.');
        this.resetPerformanceScore();
        return;
      }

      this.setLoadingState('calculation', true);

      // Select calculator and template settings based on database type
      let templateSettings;
      let results;

      if (this.currentDbType === 'postgresql') {
        const pgTemplateName = domCache.getValue('workloadTemplate');
        templateSettings = pgTemplateName && pgTemplateName !== 'custom'
          ? PG_WORKLOAD_TEMPLATES[pgTemplateName] || null
          : null;
        results = postgresqlCalculator.calculate(inputs, templateSettings);
      } else {
        templateSettings = templateManager.getCurrentTemplate();
        results = mysqlCalculator.calculate(inputs, templateSettings);
      }

      if (!results || !results.calculations) {
        console.error('Calculation returned invalid results:', results);
        this.showError('Calculation failed to produce valid results.');
        this.setLoadingState('calculation', false);
        this.resetPerformanceScore();
        return;
      }

      this.currentResults = results;

      // Batch all DOM updates together to prevent layout thrashing
      domCache.batchUpdate([
        // Update UI with results
        () => this.updateCalculationResults(results),

        // Update performance score - always update, but show "Not Rated" for errors
        () => {
          if (!results.validationErrors || results.validationErrors.length === 0) {
            this.updatePerformanceScore(results);
          } else {
            this.resetPerformanceScore();
          }
        },

        // Hide config output when inputs change
        () => this.hideConfigOutput()
      ]);

    } catch (error) {
      console.error('Error in performCalculation:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      this.showError('Error performing calculations. Please check your inputs.');
      this.resetPerformanceScore();
    } finally {
      this.setLoadingState('calculation', false);
    }
  }

  /**
   * Collect all input values from the form
   */
  collectInputs() {
    return {
      totalMemory: parseFloat(domCache.getValue('totalMemory')) || 16,
      reservedMemory: parseFloat(domCache.getValue('reservedMemory')) || 0,
      otherTasksMemory: parseFloat(domCache.getValue('otherTasksMemory')) || 0,
      osType: domCache.getValue('osType') || 'linux',
      storageType: domCache.getValue('storageType') || 'ssd',
      template: domCache.getValue('workloadTemplate') || 'custom',
      dbType: this.currentDbType
    };
  }

  /**
   * Update the calculation results display
   */
  updateCalculationResults(results) {
    const { inputs, calculations, validationErrors } = results;
    const { totalMemory, reservedMemory, otherTasksMemory, availableMemory } = inputs;

    // Show validation errors if any
    if (validationErrors && validationErrors.length > 0) {
      console.warn('Validation errors found:', validationErrors);
      this.showError(validationErrors[0]);
      this.resetPerformanceScore();
      // Still show partial results if we have calculations
      if (calculations) {
        const resultsHTML = this.buildResultsHTML(inputs, calculations);
        domCache.setHTML('results', resultsHTML);
      }
      return;
    } else {
      this.hideError();
    }

    // Build results HTML
    const resultsHTML = this.buildResultsHTML(inputs, calculations);
    domCache.setHTML('results', resultsHTML);
  }

  /**
   * Build the results HTML content
   */
  buildResultsHTML(inputs, calculations) {
    const { totalMemory, reservedMemory, otherTasksMemory, availableMemory } = inputs;

    const dbLabel = this.currentDbType === 'postgresql' ? 'PostgreSQL' : 'MySQL/MariaDB';

    return `
      <h2 class="text-xl font-semibold mb-3 text-blue-600">Memory Allocation</h2>
      <div class="grid grid-cols-2 gap-2 mb-4">
        <div>Total Server Memory:</div>
        <div>${formatBytes(totalMemory * 1024 * 1024 * 1024)}</div>
        <div>Reserved for OS:</div>
        <div>${formatBytes(reservedMemory * 1024 * 1024 * 1024)}</div>
        <div>Other Tasks:</div>
        <div>${formatBytes(otherTasksMemory * 1024 * 1024 * 1024)}</div>
        <div class="font-semibold">Available for ${dbLabel}:</div>
        <div class="font-semibold">${formatBytes(availableMemory * 1024 * 1024 * 1024)}</div>
      </div>

      <h2 class="text-xl font-semibold mb-3 text-blue-600">Recommended Settings</h2>
      <div class="grid grid-cols-2 gap-2">
        ${this.currentDbType === 'postgresql' ? this.generatePostgreSQLSettingsRows(calculations) : this.generateSettingsRows(calculations)}
      </div>

      <p class="mt-4 text-sm text-zinc-600">
        <strong>Note:</strong> These are general recommendations based on your inputs.
        Always test configurations in a development environment and monitor performance in production.
      </p>
    `;
  }

  /**
   * Generate settings rows HTML
   */
  generateSettingsRows(calculations) {
    const settings = [
      ['innodb_buffer_pool_size', 'innodb-parameters.html#sysvar_innodb_buffer_pool_size'],
      ['innodb_buffer_pool_instances', 'innodb-parameters.html#sysvar_innodb_buffer_pool_instances'],
      ['max_connections', 'server-system-variables.html#sysvar_max_connections'],
      ['key_buffer_size', 'server-system-variables.html#sysvar_key_buffer_size'],
      ['innodb_log_file_size', 'innodb-parameters.html#sysvar_innodb_log_file_size'],
      ['query_cache_size', 'server-system-variables.html#sysvar_query_cache_size'],
      ['tmp_table_size', 'server-system-variables.html#sysvar_tmp_table_size'],
      ['innodb_log_buffer_size', 'innodb-parameters.html#sysvar_innodb_log_buffer_size'],
      ['innodb_flush_log_at_trx_commit', 'innodb-parameters.html#sysvar_innodb_flush_log_at_trx_commit'],
      ['innodb_flush_method', 'innodb-parameters.html#sysvar_innodb_flush_method'],
      ['innodb_file_per_table', 'innodb-parameters.html#sysvar_innodb_file_per_table'],
      ['innodb_io_capacity', 'innodb-parameters.html#sysvar_innodb_io_capacity'],
      ['innodb_read_io_threads', 'innodb-parameters.html#sysvar_innodb_read_io_threads'],
      ['innodb_write_io_threads', 'innodb-parameters.html#sysvar_innodb_write_io_threads'],
      ['innodb_thread_concurrency', 'innodb-parameters.html#sysvar_innodb_thread_concurrency'],
      ['sort_buffer_size', 'server-system-variables.html#sysvar_sort_buffer_size'],
      ['read_buffer_size', 'server-system-variables.html#sysvar_read_buffer_size'],
      ['read_rnd_buffer_size', 'server-system-variables.html#sysvar_read_rnd_buffer_size'],
      ['join_buffer_size', 'server-system-variables.html#sysvar_join_buffer_size'],
      ['innodb_flush_neighbors', 'innodb-parameters.html#sysvar_innodb_flush_neighbors']
    ];

    const byteSettings = new Set([
      'innodb_buffer_pool_size', 'key_buffer_size', 'innodb_log_file_size',
      'query_cache_size', 'tmp_table_size', 'innodb_log_buffer_size',
      'sort_buffer_size', 'read_buffer_size', 'read_rnd_buffer_size',
      'join_buffer_size'
    ]);

    return settings.map(([setting, docPath]) => {
      const value = calculations[setting];
      const formattedValue = typeof value === 'number' && byteSettings.has(setting)
        ? formatBytes(value)
        : value;

      const docUrl = docPath.includes('5.7') 
        ? `https://dev.mysql.com/doc/refman/5.7/en/${docPath}`
        : `https://dev.mysql.com/doc/refman/8.0/en/${docPath}`;

      return `
        <div>
          <a href="${docUrl}" target="_blank" class="text-blue-500 hover:underline" rel="noopener">
            ${setting}
          </a> =
        </div>
        <div>${formattedValue}</div>
      `;
    }).join('');
  }

  /**
   * Generate PostgreSQL settings rows HTML
   */
  generatePostgreSQLSettingsRows(calculations) {
    const settings = [
      ['shared_buffers', 'runtime-config-resource.html#GUC-SHARED-BUFFERS'],
      ['effective_cache_size', 'runtime-config-query.html#GUC-EFFECTIVE-CACHE-SIZE'],
      ['work_mem', 'runtime-config-resource.html#GUC-WORK-MEM'],
      ['maintenance_work_mem', 'runtime-config-resource.html#GUC-MAINTENANCE-WORK-MEM'],
      ['wal_buffers', 'runtime-config-wal.html#GUC-WAL-BUFFERS'],
      ['max_wal_size', 'runtime-config-wal.html#GUC-MAX-WAL-SIZE'],
      ['min_wal_size', 'runtime-config-wal.html#GUC-MIN-WAL-SIZE'],
      ['checkpoint_completion_target', 'runtime-config-wal.html#GUC-CHECKPOINT-COMPLETION-TARGET'],
      ['random_page_cost', 'runtime-config-query.html#GUC-RANDOM-PAGE-COST'],
      ['effective_io_concurrency', 'runtime-config-resource.html#GUC-EFFECTIVE-IO-CONCURRENCY'],
      ['max_connections', 'runtime-config-connection.html#GUC-MAX-CONNECTIONS'],
      ['max_worker_processes', 'runtime-config-resource.html#GUC-MAX-WORKER-PROCESSES'],
      ['max_parallel_workers_per_gather', 'runtime-config-resource.html#GUC-MAX-PARALLEL-WORKERS-PER-GATHER'],
      ['max_parallel_workers', 'runtime-config-resource.html#GUC-MAX-PARALLEL-WORKERS'],
      ['max_parallel_maintenance_workers', 'runtime-config-resource.html#GUC-MAX-PARALLEL-MAINTENANCE-WORKERS'],
      ['default_statistics_target', 'runtime-config-query.html#GUC-DEFAULT-STATISTICS-TARGET'],
      ['huge_pages', 'runtime-config-resource.html#GUC-HUGE-PAGES']
    ];

    const byteSettings = new Set([
      'shared_buffers', 'effective_cache_size', 'work_mem',
      'maintenance_work_mem', 'wal_buffers'
    ]);

    return settings.map(([setting, docPath]) => {
      const value = calculations[setting];
      if (value === undefined) return '';

      const formattedValue = typeof value === 'number' && byteSettings.has(setting)
        ? formatBytes(value)
        : value;

      const docUrl = `https://www.postgresql.org/docs/current/${docPath}`;

      return `
        <div>
          <a href="${docUrl}" target="_blank" class="text-blue-500 hover:underline" rel="noopener">
            ${setting}
          </a> =
        </div>
        <div>${formattedValue}</div>
      `;
    }).join('');
  }

  /**
   * Update performance score display
   */
  updatePerformanceScore(results) {
    try {
      const calculator = this.currentDbType === 'postgresql' ? postgresqlCalculator : mysqlCalculator;
      const scoreData = calculator.calculatePerformanceScore(results);

      // Validate score data
      if (!scoreData) {
        console.error('Performance score calculation returned null/undefined');
        this.resetPerformanceScore();
        return;
      }

      if (typeof scoreData.totalScore === 'undefined') {
        console.error('Performance score missing totalScore property', scoreData);
        this.resetPerformanceScore();
        return;
      }

      if (isNaN(scoreData.totalScore)) {
        console.error('Performance score is NaN - check calculation inputs', {
          inputs: results.inputs,
          calculations: results.calculations
        });
        this.resetPerformanceScore();
        return;
      }

      const { totalScore, scores, recommendations } = scoreData;

      // Update circular progress with improved styling
      this.updateScoreCircleDisplay(totalScore);

      // Update score value
      domCache.setText('scoreValue', totalScore.toString());

      // Update score breakdown
      this.updateScoreBreakdown(scores);

      // Update recommendations
      this.updateRecommendations(recommendations);
    } catch (error) {
      console.error('Error updating performance score:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        inputs: results?.inputs
      });
      this.resetPerformanceScore();
    }
  }

  /**
   * Reset performance score to default state
   * Uses domCache for consistent DOM access
   */
  resetPerformanceScore() {
    try {
      // Reset score value to 0
      domCache.setText('scoreValue', '0');

      // Reset score circle using domCache
      const circle = domCache.get('scoreCircle');
      if (circle) {
        const circumference = 2 * Math.PI * 42;
        circle.style.strokeDasharray = `${circumference} ${circumference}`;
        circle.style.strokeDashoffset = circumference;
        circle.style.stroke = '#ef4444'; // Red for error state
      }

      // Reset score grade using domCache
      const scoreGrade = domCache.get('scoreGrade');
      if (scoreGrade) {
        scoreGrade.textContent = 'N/A';
        scoreGrade.className = 'text-xs font-medium px-2 py-1 rounded-full bg-zinc-100 text-zinc-600';
      }

      // Clear score breakdown
      domCache.setHTML('scoreBreakdown', '<p class="text-zinc-500 col-span-2">Enter valid configuration to see score breakdown.</p>');

      // Clear recommendations
      const recommendationsContainer = domCache.get('scoreRecommendations');
      if (recommendationsContainer) {
        const ul = recommendationsContainer.querySelector('ul');
        if (ul) {
          ul.textContent = '';
          const li = document.createElement('li');
          li.className = 'text-zinc-500';
          li.textContent = 'Fix configuration errors to see recommendations.';
          ul.appendChild(li);
        }
      }
    } catch (error) {
      console.error('Error resetting performance score:', error);
    }
  }

  /**
   * Update the circular score indicator with improved styling
   * Uses domCache for consistent DOM access
   */
  updateScoreCircleDisplay(score) {
    const circle = domCache.get('scoreCircle');
    const scoreGrade = domCache.get('scoreGrade');

    if (!circle) return;

    const circumference = 2 * Math.PI * 42; // radius = 42
    const offset = circumference - (score / 100) * circumference;

    // Update circle progress
    circle.style.strokeDasharray = `${circumference} ${circumference}`;
    circle.style.strokeDashoffset = offset;
    
    // Update color and grade based on score
    let color = '#ef4444'; // Red for low scores
    let gradeText = 'Poor';
    let gradeClass = 'bg-red-100 text-red-800';
    
    if (score >= 90) {
      color = '#10b981'; // Green
      gradeText = 'Excellent';
      gradeClass = 'bg-green-100 text-green-800';
    } else if (score >= 80) {
      color = '#10b981'; // Green
      gradeText = 'Good';
      gradeClass = 'bg-green-100 text-green-800';
    } else if (score >= 70) {
      color = '#3b82f6'; // Blue
      gradeText = 'Fair';
      gradeClass = 'bg-blue-100 text-blue-800';
    } else if (score >= 50) {
      color = '#f59e0b'; // Orange
      gradeText = 'Needs Work';
      gradeClass = 'bg-orange-100 text-orange-800';
    }
    
    circle.style.stroke = color;
    
    // Update grade display if element exists
    if (scoreGrade) {
      scoreGrade.textContent = gradeText;
      scoreGrade.className = `text-xs font-medium px-2 py-1 rounded-full ${gradeClass}`;
    }
  }

  /**
   * Update score breakdown bars
   */
  updateScoreBreakdown(scores) {
    const breakdownHTML = Object.entries(scores).map(([category, score]) => {
      const displayName = category.replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase());
      
      return `
        <div class="bg-zinc-50 p-3 rounded-md">
          <div class="text-sm font-medium">${displayName}</div>
          <div class="flex items-center mt-1">
            <div class="bg-zinc-200 h-2 rounded-full flex-grow">
              <div class="bg-blue-500 h-2 rounded-full transition-all duration-300" 
                   style="width: ${Math.max(0, score * 5)}%"></div>
            </div>
            <span class="ml-2 text-sm font-medium">${Math.round(score)}/20</span>
          </div>
        </div>
      `;
    }).join('');

    domCache.setHTML('scoreBreakdown', breakdownHTML);
  }

  /**
   * Update recommendations list
   */
  updateRecommendations(recommendations) {
    try {
      // Ensure recommendations is always an array
      if (!Array.isArray(recommendations)) {
        console.error('Recommendations is not an array, using fallback:', recommendations);
        recommendations = ['Unable to generate recommendations. Please check your configuration.'];
      }

      // Provide a default message if empty
      if (recommendations.length === 0) {
        recommendations = ['Your MySQL/MariaDB configuration is well optimized for your hardware. Monitor cache hit ratios and query performance to fine-tune further based on your specific workload patterns.'];
      }

      const recommendationsHTML = recommendations
        .map(rec => `<li class="mb-2">${rec}</li>`)
        .join('');

      const recommendationsContainer = domCache.get('scoreRecommendations');
      if (!recommendationsContainer) {
        console.error('Recommendations container element not found in DOM');
        return;
      }

      const ul = recommendationsContainer.querySelector('ul');
      if (!ul) {
        console.error('Recommendations list element not found in DOM');
        return;
      }

      ul.innerHTML = recommendationsHTML;
    } catch (error) {
      console.error('Error updating recommendations:', error);
    }
  }

  /**
   * Announce message to screen readers
   */
  announceToScreenReader(message) {
    const announcer = document.getElementById('screenReaderAnnouncements');
    if (announcer) {
      announcer.textContent = message;
      
      // Clear after a short delay to allow for re-announcements
      setTimeout(() => {
        announcer.textContent = '';
      }, 1000);
    }
  }

  /**
   * Handle config generation
   */
  async handleGenerateConfig() {
    if (!this.currentResults) {
      this.showError('Please wait for calculations to complete first.');
      return;
    }

    try {
      this.setLoadingState('config-generation', true);

      const configFormat = this.currentDbType === 'postgresql' ? 'postgresql.conf' : 'my.cnf';
      const config = configGenerator.generateConfig(this.currentResults, configFormat, {
        includeComments: true,
        mysqlVersion: '8.0',
        includeReplication: true,
        includeLogging: true
      });

      domCache.setText('configContent', config);
      domCache.show('configOutput');
      domCache.show('copyConfigBtn');
      domCache.show('downloadConfigBtn');

    } catch (error) {
      this.showError('Error generating configuration file.');
    } finally {
      this.setLoadingState('config-generation', false);
    }
  }

  /**
   * Handle copying config to clipboard
   */
  async handleCopyConfig() {
    try {
      const configFormat = this.currentDbType === 'postgresql' ? 'postgresql.conf' : 'my.cnf';
      await configGenerator.copyToClipboard(this.currentResults, configFormat);
      this.showSuccessMessage('copyConfigBtn', 'Copied!', 2000);
    } catch (error) {
      this.showError('Failed to copy to clipboard. Please try selecting and copying manually.');
    }
  }

  /**
   * Handle downloading config file
   */
  async handleDownloadConfig() {
    try {
      const configFormat = this.currentDbType === 'postgresql' ? 'postgresql.conf' : 'my.cnf';
      const result = await configGenerator.exportToFile(this.currentResults, configFormat);
      this.showSuccessMessage('downloadConfigBtn', 'Downloaded!', 2000);
    } catch (error) {
      this.showError('Failed to download configuration file.');
    }
  }

  /**
   * Handle keyboard shortcuts
   */
  handleKeyboardShortcuts(e) {
    // Ctrl/Cmd + G - Generate config
    if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
      e.preventDefault();
      this.handleGenerateConfig();
    }
    
    // Ctrl/Cmd + C (when config is visible) - Copy config
    if ((e.ctrlKey || e.metaKey) && e.key === 'c' && domCache.isVisible('configOutput')) {
      if (!domCache.get('configContent').contains(document.activeElement)) {
        e.preventDefault();
        this.handleCopyConfig();
      }
    }
  }

  /**
   * Load configuration from URL parameters
   */
  loadConfigFromURL() {
    const config = configGenerator.loadFromURL();
    if (!config) return;

    // Switch database type if specified
    if (config.dbType && config.dbType !== 'mysql') {
      this.switchDatabaseType(config.dbType);
    }

    // Populate inputs
    Object.entries(config).forEach(([key, value]) => {
      if (key === 'dbType') return; // Already handled
      const element = domCache.get(key);
      if (element) {
        element.value = value;

        // Also update corresponding slider
        const slider = domCache.get(key + 'Slider');
        if (slider) {
          slider.value = value;
        }
      }
    });

    // Set template
    if (config.template) {
      if (this.currentDbType === 'postgresql') {
        // For PG mode, just set the dropdown value
        const select = domCache.get('workloadTemplate');
        if (select) select.value = config.template;
      } else {
        templateManager.setTemplate(config.template);
      }
    }
  }

  /**
   * Show error message
   */
  showError(message) {
    domCache.setText('error', message);
    domCache.show('error');
    
    // Auto-hide after 10 seconds
    setTimeout(() => {
      this.hideError();
    }, 10000);
  }

  /**
   * Hide error message
   */
  hideError() {
    domCache.hide('error');
  }

  /**
   * Show success message on button
   */
  showSuccessMessage(buttonId, message, duration = 2000) {
    const button = domCache.get(buttonId);
    if (!button) return;

    const originalText = button.textContent;
    button.textContent = message;
    button.style.backgroundColor = '#10b981'; // Green

    setTimeout(() => {
      button.textContent = originalText;
      button.style.backgroundColor = ''; // Reset to original
    }, duration);
  }

  /**
   * Hide configuration output
   */
  hideConfigOutput() {
    domCache.hide('configOutput');
    domCache.hide('copyConfigBtn');
    domCache.hide('downloadConfigBtn');
  }

  /**
   * Set loading state for UI elements
   */
  setLoadingState(operation, isLoading) {
    if (isLoading) {
      this.loadingStates.add(operation);
    } else {
      this.loadingStates.delete(operation);
    }

    // Update UI based on loading states
    const anyLoading = this.loadingStates.size > 0;
    
    const configLabel = this.currentDbType === 'postgresql' ? 'postgresql.conf' : 'my.cnf';

    if (operation === 'calculation') {
      const button = domCache.get('generateConfigBtn');
      if (button) {
        button.disabled = isLoading;
        button.textContent = isLoading ? 'Calculating...' : `Generate ${configLabel} File`;
      }
    }

    if (operation === 'config-generation') {
      const button = domCache.get('generateConfigBtn');
      if (button) {
        button.disabled = isLoading;
        button.textContent = isLoading ? 'Generating...' : `Generate ${configLabel} File`;
      }
    }
  }

  /**
   * Export current configuration as shareable URL
   */
  generateShareableURL() {
    if (!this.currentResults) {
      this.showError('No configuration to share. Please generate a configuration first.');
      return null;
    }

    return configGenerator.generateShareableURL(this.currentResults);
  }

  /**
   * Get current configuration for external use
   */
  getCurrentConfiguration() {
    return this.currentResults;
  }

  /**
   * Reset form to default values
   */
  resetForm() {
    // Reset to MySQL mode if not already
    if (this.currentDbType !== 'mysql') {
      this.switchDatabaseType('mysql');
    }

    domCache.setValue('totalMemory', 16);
    domCache.setValue('totalMemorySlider', 16);
    domCache.setValue('reservedMemory', 0);
    domCache.setValue('reservedMemorySlider', 0);
    domCache.setValue('otherTasksMemory', 0);
    domCache.setValue('otherTasksMemorySlider', 0);
    domCache.setValue('osType', 'linux');
    domCache.setValue('storageType', 'ssd');
    domCache.setValue('workloadTemplate', 'custom');

    templateManager.setTemplate('custom');
    this.hideError();
    this.hideConfigOutput();

    this.debouncedCalculate();
  }
}

// Export singleton instance
export const uiManager = new UIManager();