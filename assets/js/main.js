/**
 * MySQL/MariaDB Settings Calculator - Main Entry Point
 * Modular version with improved performance and accessibility
 */

import { uiManager } from './ui.js';
import { templateManager } from './templates.js';
import { configGenerator } from './config-generator.js';

/**
 * Application Manager - Coordinates all modules
 */
class MySQLCalculatorApp {
  constructor() {
    this.version = '2.0.0';
    this.isInitialized = false;
  }

  /**
   * Initialize the application
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      console.log('Starting MySQL/MariaDB Calculator v' + this.version);

      // Check browser compatibility
      this.checkBrowserCompatibility();

      // Initialize UI manager (this will initialize DOM cache and other dependencies)
      await uiManager.initialize();

      // Setup global error handling
      this.setupErrorHandling();

      // Setup keyboard shortcuts and accessibility
      this.setupGlobalFeatures();

      // Mark as initialized
      this.isInitialized = true;
      
      console.log('Application initialized successfully');

    } catch (error) {
      console.error('Failed to initialize MySQL Calculator:', error);
      this.showFallbackError();
    }
  }

  /**
   * Check browser compatibility
   */
  checkBrowserCompatibility() {
    const requiredFeatures = [
      'Promise',
      'fetch',
      'addEventListener',
      'querySelector'
    ];

    const missingFeatures = requiredFeatures.filter(feature => {
      switch (feature) {
        case 'Promise':
          return typeof Promise === 'undefined';
        case 'fetch':
          return typeof fetch === 'undefined';
        case 'addEventListener':
          return !document.addEventListener;
        case 'querySelector':
          return !document.querySelector;
        default:
          return false;
      }
    });

    if (missingFeatures.length > 0) {
      throw new Error(`Browser missing required features: ${missingFeatures.join(', ')}`);
    }

    console.log('Browser compatibility check passed');
  }

  /**
   * Setup global error handling
   */
  setupErrorHandling() {
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason);
      event.preventDefault();
    });

    // Handle general JavaScript errors
    window.addEventListener('error', (event) => {
      console.error('JavaScript error:', event.error);
    });

    console.log('Global error handling setup complete');
  }

  /**
   * Setup global features and shortcuts
   */
  setupGlobalFeatures() {
    // Setup help system
    this.setupHelpSystem();

    console.log('Global features setup complete');
  }

  /**
   * Setup help system
   */
  setupHelpSystem() {
    // Add help button functionality if it exists
    const helpButton = document.querySelector('[data-help]');
    if (helpButton) {
      helpButton.addEventListener('click', (e) => {
        e.preventDefault();
        this.showHelpModal();
      });
    }

    // Add keyboard shortcut for help
    document.addEventListener('keydown', (e) => {
      if (e.key === 'F1' || (e.key === '?' && e.shiftKey)) {
        e.preventDefault();
        this.showHelpModal();
      }
    });
  }

  /**
   * Show help modal
   */
  showHelpModal() {
    // Delegate to UI manager
    if (uiManager.isInitialized) {
      uiManager.showHelpModal();
    }
  }

  /**
   * Show fallback error message
   */
  showFallbackError() {
    const errorHTML = `
      <div style="
        background: #fee2e2; 
        border: 1px solid #fca5a5; 
        color: #991b1b; 
        padding: 1rem; 
        border-radius: 0.375rem; 
        margin: 1rem;
      ">
        <h3 style="margin: 0 0 0.5rem 0; font-weight: 600;">
          Application Failed to Load
        </h3>
        <p style="margin: 0 0 0.5rem 0;">
          The MySQL/MariaDB Calculator failed to initialize. This might be due to:
        </p>
        <ul style="margin: 0; padding-left: 1.5rem;">
          <li>Browser compatibility issues</li>
          <li>JavaScript disabled</li>
          <li>Network connectivity problems</li>
        </ul>
        <p style="margin: 0.5rem 0 0 0;">
          <strong>Solution:</strong> Please refresh the page or try a different browser.
        </p>
      </div>
    `;

    // Try to insert error message
    const container = document.querySelector('.container') || document.body;
    container.insertAdjacentHTML('afterbegin', errorHTML);
  }

  /**
   * Get application status
   */
  getStatus() {
    return {
      version: this.version,
      initialized: this.isInitialized,
      features: {
        templates: Object.keys(templateManager.getTemplates()).length,
        configFormats: Object.keys(configGenerator.configFormats).length
      }
    };
  }

  /**
   * Reset application state
   */
  async reset() {
    console.log('Resetting application state');
    
    try {
      // Reset UI
      uiManager.resetForm();
      
      // Reset templates
      templateManager.setTemplate('custom');
      
      console.log('Application reset complete');
    } catch (error) {
      console.error('Error resetting application:', error);
    }
  }

  /**
   * Export current configuration
   */
  async exportConfiguration(format = 'json') {
    try {
      const config = uiManager.getCurrentConfiguration();
      if (!config) {
        throw new Error('No configuration available to export');
      }

      return await configGenerator.exportToFile(config, format);
    } catch (error) {
      console.error('Export failed:', error);
      throw error;
    }
  }

  /**
   * Get shareable URL
   */
  getShareableURL() {
    try {
      return uiManager.generateShareableURL();
    } catch (error) {
      console.error('Failed to generate shareable URL:', error);
      return null;
    }
  }
}

// Create global app instance
const app = new MySQLCalculatorApp();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    app.initialize();
  });
} else {
  // DOM is already ready
  app.initialize();
}

// Export for potential external use
export default app;