(function () {
  const app = window.rephraser || {};
  window.rephraser = app;

  app.state = app.state || { shadowRoot: null, hostElement: null, lastSelectedText: '' };
  app.constants = app.constants || { MAX_SUMMARY_CHARS: 102400 };
  app.utils = app.utils || {};

  app.utils.normalizeText = function normalizeText(text) {
    return (text || '').replace(/\s+/g, ' ').trim();
  };

  app.utils.getSelectionContent = function getSelectionContent() {
    return app.utils.normalizeText(window.getSelection().toString());
  };

  app.utils.getPageContent = function getPageContent(maxChars) {
    const rawText = document.body ? document.body.innerText : '';
    const normalized = app.utils.normalizeText(rawText);
    if (normalized.length <= maxChars) {
      return { text: normalized, truncated: false, length: normalized.length };
    }
    return { text: normalized.slice(0, maxChars), truncated: true, length: normalized.length };
  };

  app.utils.buildSummaryPayload = function buildSummaryPayload() {
    const selectedText = app.utils.getSelectionContent();
    if (selectedText) {
      return {
        text: selectedText,
        truncated: false,
        length: selectedText.length,
        title: document.title || 'Untitled page',
        url: window.location.href,
        isSelection: true
      };
    }
    const { text, truncated, length } = app.utils.getPageContent(app.constants.MAX_SUMMARY_CHARS);
    return {
      text,
      truncated,
      length,
      title: document.title || 'Untitled page',
      url: window.location.href,
      isSelection: false
    };
  };
})();
