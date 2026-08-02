import { uiManager } from './ui.js';

async function initialize() {
  try {
    await uiManager.initialize();

    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason);
      event.preventDefault();
    });

    const helpButton = document.querySelector('[data-help]');
    if (helpButton) {
      helpButton.addEventListener('click', (e) => {
        e.preventDefault();
        uiManager.showHelpModal();
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'F1' || (e.key === '?' && e.shiftKey)) {
        e.preventDefault();
        uiManager.showHelpModal();
      }
    });
  } catch (error) {
    console.error('Failed to initialize Database Settings Calculator:', error);
    const container = document.querySelector('.container') || document.body;
    container.insertAdjacentHTML('afterbegin', `
      <div style="background:#fee2e2;border:1px solid #fca5a5;color:#991b1b;padding:1rem;border-radius:0.375rem;margin:1rem">
        <h3 style="margin:0 0 0.5rem;font-weight:600">Application Failed to Load</h3>
        <p style="margin:0">Please refresh the page or try a different browser.</p>
      </div>
    `);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
