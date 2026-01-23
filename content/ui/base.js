(function () {
  const app = window.rephraser || {};
  window.rephraser = app;
  app.ui = app.ui || {};

  function appendStyles(shadowRoot) {
    const stylesheetHrefs = [
      chrome.runtime.getURL('content/ui/base.css'),
      chrome.runtime.getURL('content/ui/summary.css'),
      chrome.runtime.getURL('content/ui/settings.css')
    ];

    stylesheetHrefs.forEach((href) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      shadowRoot.appendChild(link);
    });
  }

  function loadPrivacyDisclosure(target) {
    if (!target) return;
    app.storage.getPrivacyAccepted().then((privacyAccepted) => {
      if (privacyAccepted) {
        target.style.display = 'none';
        return;
      }
      fetch(chrome.runtime.getURL('res/privacy-disclosure.html'))
        .then((response) => response.text())
        .then((html) => {
          target.innerHTML = html;
        })
        .catch(() => {
          target.innerHTML = '<div class="error">Failed to load privacy disclosure.</div>';
        });
    });
  }

  function openAfterAuth(mode, payload) {
    if (mode === 'summary') {
      app.ui.createAndShowSummaryModal(payload);
      return;
    }
    app.ui.createAndShowModal((payload && payload.selectedText) || '');
  }

  app.ui.appendStyles = appendStyles;
  app.ui.loadPrivacyDisclosure = loadPrivacyDisclosure;
  app.ui.openAfterAuth = openAfterAuth;
})();
