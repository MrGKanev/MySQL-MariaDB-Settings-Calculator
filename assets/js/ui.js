import { domCache } from './dom-cache.js';
import { formatBytes, debounce } from './utils.js';
import { mysqlCalculator } from './calculations.js';
import { templateManager } from './templates.js';
import { configGenerator } from './config-generator.js';

/**
 * UI Manager - Handles all user interface interactions and updates
 */
export class UIManager {
  constructor() {
    this.isInitialized = false;
    this.currentResults = null;
    this.loadingStates = new Set();
    this.debouncedCalculate = debounce(this.performCalculation.bind(this), 300);
  }

  /**
   * Initialize the UI manager
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      // Initialize DOM cache first
      domCache.initialize();

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
      console.log('UI Manager initialized successfully');
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
   */
  setupNewUIButtons() {
    // Help button
    const helpButton = document.getElementById('helpButton');
    if (helpButton) {
      helpButton.addEventListener('click', () => {
        this.showHelpModal();
      });
    }

    // Share button
    const shareButton = document.getElementById('shareButton');
    if (shareButton) {
      shareButton.addEventListener('click', () => {
        this.handleShareConfig();
      });
    }

    // Reset button
    const resetButton = document.getElementById('resetButton');
    if (resetButton) {
      resetButton.addEventListener('click', () => {
        this.handleResetForm();
      });
    }

    // Config copy button in the output area
    const configCopyBtn = document.getElementById('configCopyBtn');
    if (configCopyBtn) {
      configCopyBtn.addEventListener('click', () => {
        this.handleCopyConfig();
      });
    }
  }

  /**
   * Setup export dropdown functionality
   */
  setupExportDropdown() {
    const exportBtn = document.getElementById('exportOptionsBtn');
    const exportMenu = document.getElementById('exportMenu');

    if (exportBtn && exportMenu) {
      exportBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = exportMenu.classList.contains('hidden');
        
        if (isOpen) {
          exportMenu.classList.remove('hidden');
          exportBtn.setAttribute('aria-expanded', 'true');
        } else {
          exportMenu.classList.add('hidden');
          exportBtn.setAttribute('aria-expanded', 'false');
        }
      });

      // Handle export options
      const exportOptions = exportMenu.querySelectorAll('.export-option');
      exportOptions.forEach(option => {
        option.addEventListener('click', (e) => {
          e.stopPropagation();
          this.handleExportOption(option);
          exportMenu.classList.add('hidden');
          exportBtn.setAttribute('aria-expanded', 'false');
        });
      });
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
        const result = await configGenerator.exportToFile(this.currentResults, format);
        this.showSuccessMessage('exportOptionsBtn', 'Downloaded!', 2000);
        this.announceToScreenReader(`${format} configuration downloaded successfully`);
      }
    } catch (error) {
      console.error('Export error:', error);
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
      if (navigator.share) {
        await navigator.share({
          title: 'MySQL/MariaDB Configuration',
          text: 'Check out this optimized MySQL/MariaDB configuration',
          url: shareableURL
        });
      } else {
        // Fallback to clipboard
        await navigator.clipboard.writeText(shareableURL);
        this.showSuccessMessage('shareButton', 'Link Copied!', 2000);
        this.announceToScreenReader('Shareable configuration link copied to clipboard');
      }
    } catch (error) {
      console.error('Share error:', error);
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
   * Show help modal
   */
  showHelpModal() {
    const existingModal = document.querySelector('.help-modal');
    if (existingModal) {
      existingModal.remove();
    }

    const helpContent = `
      <div class="help-modal fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" role="dialog" aria-labelledby="help-title" aria-modal="true">
        <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
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
              <button onclick="this.closest('.help-modal').remove()" 
                class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-300">
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', helpContent);

    // Focus management
    const modal = document.querySelector('.help-modal');
    const closeButton = modal.querySelector('button');
    closeButton.focus();

    // Close on Escape key
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        modal.remove();
        document.removeEventListener('keydown', handleEscape);
        document.getElementById('helpButton')?.focus(); // Return focus
      }
    };
    document.addEventListener('keydown', handleEscape);

    this.announceToScreenReader('Help modal opened');
  }

  /**
   * Handle clicks outside dropdowns
   */
  handleClickOutside(e) {
    const exportMenu = document.getElementById('exportMenu');
    const exportBtn = document.getElementById('exportOptionsBtn');
    
    if (exportMenu && !exportMenu.contains(e.target) && !exportBtn?.contains(e.target)) {
      exportMenu.classList.add('hidden');
      exportBtn?.setAttribute('aria-expanded', 'false');
    }
  }

  /**
   * Setup slider and input synchronization
   */
  setupSliderSync() {
    const syncPairs = [
      ['totalMemorySlider', 'totalMemory', 128],
      ['reservedMemorySlider', 'reservedMemory', 16],
      ['otherTasksMemorySlider', 'otherTasksMemory', 64]
    ];

    syncPairs.forEach(([sliderId, inputId, max]) => {
      this.syncSliderAndInput(sliderId, inputId, max);
    });
  }

  /**
   * Synchronize slider and text input values
   */
  syncSliderAndInput(sliderId, inputId, max) {
    const slider = domCache.get(sliderId);
    const input = domCache.get(inputId);

    if (!slider || !input) return;

    slider.addEventListener('input', () => {
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
      this.debouncedCalculate();
    });

    // Initialize slider max value
    slider.max = max;
  }

  /**
   * Handle template selection changes
   */
  handleTemplateChange(templateName) {
    const template = templateManager.setTemplate(templateName);
    
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
   */
  async performCalculation() {
    try {
      this.setLoadingState('calculation', true);

      const inputs = this.collectInputs();
      const templateSettings = templateManager.getCurrentTemplate();
      
      // Perform calculation
      const results = mysqlCalculator.calculate(inputs, templateSettings);
      this.currentResults = results;

      // Update UI with results
      this.updateCalculationResults(results);
      
      // Update performance score
      this.updatePerformanceScore(results);

      // Hide config output when inputs change
      this.hideConfigOutput();

    } catch (error) {
      console.error('Calculation error:', error);
      this.showError('Error performing calculations. Please check your inputs.');
    } finally {
      this.setLoadingState('calculation', false);
    }
  }

  /**
   * Collect all input values from the form
   */
  collectInputs() {
    return {
      totalMemory: parseFloat(domCache.getValue('totalMemory')) || 1,
      reservedMemory: parseFloat(domCache.getValue('reservedMemory')) || 0,
      otherTasksMemory: parseFloat(domCache.getValue('otherTasksMemory')) || 0,
      osType: domCache.getValue('osType') || 'linux',
      storageType: domCache.getValue('storageType') || 'ssd',
      template: domCache.getValue('workloadTemplate') || 'custom'
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
      this.showError(validationErrors[0]);
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

    return `
      <h2 class="text-xl font-semibold mb-3 text-blue-600">Memory Allocation</h2>
      <div class="grid grid-cols-2 gap-2 mb-4">
        <div>Total Server Memory:</div>
        <div>${formatBytes(totalMemory * 1024 * 1024 * 1024)}</div>
        <div>Reserved for OS:</div>
        <div>${formatBytes(reservedMemory * 1024 * 1024 * 1024)}</div>
        <div>Other Tasks:</div>
        <div>${formatBytes(otherTasksMemory * 1024 * 1024 * 1024)}</div>
        <div class="font-semibold">Available for MySQL/MariaDB:</div>
        <div class="font-semibold">${formatBytes(availableMemory * 1024 * 1024 * 1024)}</div>
      </div>
      
      <h2 class="text-xl font-semibold mb-3 text-blue-600">Recommended Settings</h2>
      <div class="grid grid-cols-2 gap-2">
        ${this.generateSettingsRows(calculations)}
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

    return settings.map(([setting, docPath]) => {
      const value = calculations[setting];
      const formattedValue = typeof value === 'number' && value > 1024 
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
   * Update performance score display
   */
  updatePerformanceScore(results) {
    const scoreData = mysqlCalculator.calculatePerformanceScore(results);
    const { totalScore, scores, recommendations } = scoreData;

    // Update circular progress with improved styling
    this.updateScoreCircle(totalScore);
    
    // Update score value
    domCache.setText('scoreValue', totalScore.toString());

    // Update score breakdown
    this.updateScoreBreakdown(scores);

    // Update recommendations
    this.updateRecommendations(recommendations);
  }

  /**
   * Update the circular score indicator (legacy method, now calls new method)
   */
  updateScoreCircleLegacy(score) {
    this.updateScoreCircle(score);
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
    const recommendationsHTML = recommendations
      .map(rec => `<li class="mb-2">${rec}</li>`)
      .join('');

    const recommendationsContainer = domCache.get('scoreRecommendations');
    if (recommendationsContainer) {
      const ul = recommendationsContainer.querySelector('ul');
      if (ul) {
        ul.innerHTML = recommendationsHTML;
      }
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

      const config = configGenerator.generateConfig(this.currentResults, 'my.cnf', {
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
      console.error('Config generation error:', error);
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
      await configGenerator.copyToClipboard(this.currentResults, 'my.cnf');
      this.showSuccessMessage('copyConfigBtn', 'Copied!', 2000);
    } catch (error) {
      console.error('Copy error:', error);
      this.showError('Failed to copy to clipboard. Please try selecting and copying manually.');
    }
  }

  /**
   * Handle downloading config file
   */
  async handleDownloadConfig() {
    try {
      const result = await configGenerator.exportToFile(this.currentResults, 'my.cnf');
      this.showSuccessMessage('downloadConfigBtn', 'Downloaded!', 2000);
    } catch (error) {
      console.error('Download error:', error);
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

    // Populate inputs
    Object.entries(config).forEach(([key, value]) => {
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
      templateManager.setTemplate(config.template);
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
    
    if (operation === 'calculation') {
      const button = domCache.get('generateConfigBtn');
      if (button) {
        button.disabled = isLoading;
        button.textContent = isLoading ? 'Calculating...' : 'Generate my.cnf File';
      }
    }

    if (operation === 'config-generation') {
      const button = domCache.get('generateConfigBtn');
      if (button) {
        button.disabled = isLoading;
        button.textContent = isLoading ? 'Generating...' : 'Generate my.cnf File';
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
    domCache.setValue('totalMemory', 1);
    domCache.setValue('totalMemorySlider', 1);
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