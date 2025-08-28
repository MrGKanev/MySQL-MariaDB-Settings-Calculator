// DOM Cache - Centralized DOM element access for better performance
class DOMCache {
  constructor() {
    this.elements = {};
    this.initialized = false;
  }

  initialize() {
    if (this.initialized) return;

    try {
      // Input elements
      this.elements.workloadTemplate = document.getElementById('workloadTemplate');
      this.elements.totalMemory = document.getElementById('totalMemory');
      this.elements.totalMemorySlider = document.getElementById('totalMemorySlider');
      this.elements.reservedMemory = document.getElementById('reservedMemory');
      this.elements.reservedMemorySlider = document.getElementById('reservedMemorySlider');
      this.elements.otherTasksMemory = document.getElementById('otherTasksMemory');
      this.elements.otherTasksMemorySlider = document.getElementById('otherTasksMemorySlider');
      this.elements.osType = document.getElementById('osType');
      this.elements.storageType = document.getElementById('storageType');

      // Output elements
      this.elements.error = document.getElementById('error');
      this.elements.results = document.getElementById('results');
      this.elements.configOutput = document.getElementById('configOutput');
      this.elements.configContent = document.getElementById('configContent');

      // Performance score elements
      this.elements.scoreCircle = document.getElementById('scoreCircle');
      this.elements.scoreValue = document.getElementById('scoreValue');
      this.elements.scoreBreakdown = document.getElementById('scoreBreakdown');
      this.elements.scoreRecommendations = document.getElementById('scoreRecommendations');

      // Button elements
      this.elements.generateConfigBtn = document.getElementById('generateConfigBtn');
      this.elements.copyConfigBtn = document.getElementById('copyConfigBtn');
      this.elements.downloadConfigBtn = document.getElementById('downloadConfigBtn');
      this.elements.exportOptionsBtn = document.getElementById('exportOptionsBtn');
      this.elements.exportMenu = document.getElementById('exportMenu');
      this.elements.configCopyBtn = document.getElementById('configCopyBtn');
      
      // New UI buttons
      this.elements.helpButton = document.getElementById('helpButton');
      this.elements.shareButton = document.getElementById('shareButton');
      this.elements.resetButton = document.getElementById('resetButton');

      // Footer elements
      this.elements.currentYear = document.getElementById('currentYear');
      this.elements.appVersion = document.getElementById('appVersion');

      // Accessibility elements
      this.elements.loadingIndicator = document.getElementById('loadingIndicator');
      this.elements.loadingText = document.getElementById('loadingText');
      this.elements.screenReaderAnnouncements = document.getElementById('screenReaderAnnouncements');

      // ARIA labels for accessibility
      this.elements.totalMemoryLabel = document.getElementById('totalMemoryLabel');
      this.elements.reservedMemoryLabel = document.getElementById('reservedMemoryLabel');
      this.elements.otherTasksMemoryLabel = document.getElementById('otherTasksMemoryLabel');

      this.initialized = true;
      this.enhanceAccessibility();
    } catch (error) {
      console.error('Error initializing DOM cache:', error);
      throw new Error('Failed to initialize DOM elements');
    }
  }

  enhanceAccessibility() {
    // Add ARIA descriptions for better screen reader support
    this.addAriaDescriptions();
    
    // Improve focus indicators
    this.enhanceFocusIndicators();
    
    // Make sliders more accessible
    this.enhanceSliderAccessibility();
    
    // Improve mobile experience
    this.enhanceMobileExperience();
  }

  addAriaDescriptions() {
    const descriptions = {
      totalMemory: 'Enter the total amount of server memory in gigabytes',
      reservedMemory: 'Amount of memory to reserve for the operating system',
      otherTasksMemory: 'Memory allocated for other applications and services',
      workloadTemplate: 'Select a predefined configuration template for your workload type',
      osType: 'Choose your server operating system for optimal configuration',
      storageType: 'Select your storage type for I/O optimization'
    };

    Object.entries(descriptions).forEach(([elementId, description]) => {
      const element = this.elements[elementId];
      if (element) {
        element.setAttribute('aria-description', description);
      }
    });

    // Add aria-describedby for form relationships
    if (this.elements.totalMemory && this.elements.totalMemorySlider) {
      this.elements.totalMemory.setAttribute('aria-describedby', 'totalMemorySlider');
      this.elements.totalMemorySlider.setAttribute('aria-describedby', 'totalMemory');
    }
  }

  enhanceFocusIndicators() {
    // Add better focus styling for keyboard navigation
    const focusableElements = [
      this.elements.workloadTemplate,
      this.elements.totalMemory,
      this.elements.totalMemorySlider,
      this.elements.reservedMemory,
      this.elements.reservedMemorySlider,
      this.elements.otherTasksMemory,
      this.elements.otherTasksMemorySlider,
      this.elements.osType,
      this.elements.storageType,
      this.elements.generateConfigBtn,
      this.elements.copyConfigBtn,
      this.elements.downloadConfigBtn,
      this.elements.exportOptionsBtn,
      this.elements.configCopyBtn,
      this.elements.helpButton,
      this.elements.shareButton,
      this.elements.resetButton
    ].filter(Boolean);

    focusableElements.forEach(element => {
      element.addEventListener('focus', () => {
        element.style.outline = '2px solid #3b82f6';
        element.style.outlineOffset = '2px';
      });
      
      element.addEventListener('blur', () => {
        element.style.outline = '';
        element.style.outlineOffset = '';
      });
    });
  }

  enhanceSliderAccessibility() {
    const sliders = [
      this.elements.totalMemorySlider,
      this.elements.reservedMemorySlider,
      this.elements.otherTasksMemorySlider
    ].filter(Boolean);

    sliders.forEach(slider => {
      // Add keyboard support for fine-tuning
      slider.addEventListener('keydown', (e) => {
        let step = 1;
        if (e.shiftKey) step = 0.1; // Fine adjustment with Shift
        if (e.ctrlKey) step = 10; // Coarse adjustment with Ctrl

        let newValue = parseFloat(slider.value);
        
        switch (e.key) {
          case 'ArrowUp':
          case 'ArrowRight':
            e.preventDefault();
            newValue = Math.min(newValue + step, parseFloat(slider.max));
            break;
          case 'ArrowDown':
          case 'ArrowLeft':
            e.preventDefault();
            newValue = Math.max(newValue - step, parseFloat(slider.min));
            break;
          case 'Home':
            e.preventDefault();
            newValue = parseFloat(slider.min);
            break;
          case 'End':
            e.preventDefault();
            newValue = parseFloat(slider.max);
            break;
          default:
            return;
        }
        
        slider.value = newValue;
        slider.dispatchEvent(new Event('input', { bubbles: true }));
      });

      // Add visual feedback for touch devices
      slider.addEventListener('touchstart', () => {
        slider.style.transform = 'scale(1.05)';
      });
      
      slider.addEventListener('touchend', () => {
        slider.style.transform = '';
      });
    });
  }

  enhanceMobileExperience() {
    // Make touch targets larger on mobile
    if ('ontouchstart' in window) {
      const touchElements = [
        this.elements.totalMemorySlider,
        this.elements.reservedMemorySlider,
        this.elements.otherTasksMemorySlider,
        this.elements.generateConfigBtn,
        this.elements.copyConfigBtn,
        this.elements.downloadConfigBtn,
        this.elements.exportOptionsBtn,
        this.elements.helpButton,
        this.elements.shareButton,
        this.elements.resetButton
      ].filter(Boolean);

      touchElements.forEach(element => {
        element.style.minHeight = '44px'; // Minimum touch target size
        element.style.minWidth = '44px';
      });
    }
  }

  get(elementId) {
    if (!this.initialized) {
      console.warn('DOM cache not initialized, calling initialize()');
      this.initialize();
    }
    
    const element = this.elements[elementId];
    if (!element) {
      console.warn(`Element '${elementId}' not found in DOM cache`);
    }
    
    return element;
  }

  getValue(elementId) {
    const element = this.get(elementId);
    return element ? element.value : null;
  }

  setValue(elementId, value) {
    const element = this.get(elementId);
    if (element) {
      element.value = value;
    }
  }

  getText(elementId) {
    const element = this.get(elementId);
    return element ? element.textContent : null;
  }

  setText(elementId, text) {
    const element = this.get(elementId);
    if (element) {
      element.textContent = text;
    }
  }

  getHTML(elementId) {
    const element = this.get(elementId);
    return element ? element.innerHTML : null;
  }

  setHTML(elementId, html) {
    const element = this.get(elementId);
    if (element) {
      element.innerHTML = html;
    }
  }

  addClass(elementId, className) {
    const element = this.get(elementId);
    if (element) {
      element.classList.add(className);
    }
  }

  removeClass(elementId, className) {
    const element = this.get(elementId);
    if (element) {
      element.classList.remove(className);
    }
  }

  hasClass(elementId, className) {
    const element = this.get(elementId);
    return element ? element.classList.contains(className) : false;
  }

  toggleClass(elementId, className) {
    const element = this.get(elementId);
    if (element) {
      element.classList.toggle(className);
    }
  }

  show(elementId) {
    this.removeClass(elementId, 'hidden');
  }

  hide(elementId) {
    this.addClass(elementId, 'hidden');
  }

  isVisible(elementId) {
    return !this.hasClass(elementId, 'hidden');
  }

  addEventListener(elementId, event, handler, options = {}) {
    const element = this.get(elementId);
    if (element) {
      element.addEventListener(event, handler, options);
    }
  }

  // Batch DOM updates to prevent layout thrashing
  batchUpdate(updates) {
    // Use requestAnimationFrame to batch DOM updates
    requestAnimationFrame(() => {
      updates.forEach(update => {
        try {
          update();
        } catch (error) {
          console.error('Error in batch update:', error);
        }
      });
    });
  }

  // Performance monitoring
  measurePerformance(label, fn) {
    const startTime = performance.now();
    const result = fn();
    const endTime = performance.now();
    
    if (endTime - startTime > 10) { // Log if operation takes more than 10ms
      console.log(`${label} took ${endTime - startTime} milliseconds`);
    }
    
    return result;
  }
}

// Create and export singleton instance
export const domCache = new DOMCache();