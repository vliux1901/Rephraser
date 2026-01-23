(function () {
  const app = window.rephraser || {};
  window.rephraser = app;

  app.state = app.state || { shadowRoot: null, hostElement: null, lastSelectedText: '' };
  app.constants = app.constants || { MAX_SUMMARY_CHARS: 102400 };
  app.styles = app.styles || {};
  app.utils = app.utils || {};

  if (!app.styles.base) {
    app.styles.base = `
      :host {
        color-scheme: light;
      }
      .overlay {
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.5); z-index: 2147483647;
        display: flex; justify-content: center; align-items: center;
        font-family: sans-serif, Arial; text-align: left;
      }
      .modal {
        background: white; padding: 20px; border-radius: 8px;

        /* Dimensions */
        width: 65vw;
        height: 65vh;
        min-width: 780px;
        min-height: 520px;
        max-width: 95vw;
        max-height: 95vh;

        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        display: flex; flex-direction: column; gap: 10px;
        color: #333;
        box-sizing: border-box;
      }
      .modal.settings {
        width: 546px;
        min-width: 416px;
        height: auto;
        min-height: auto;
      }

      /* HEADER ROW (Title + X) */
      .header-row {
        display: flex; justify-content: space-between; align-items: center;
        margin-bottom: 5px;
      }
      h2 { margin: 0; font-size: 18px; color: #222; }

      /* Close "X" Button Styling */
      .close-icon {
        background: transparent; border: none; font-size: 24px;
        color: #999; cursor: pointer; line-height: 1; padding: 0;
      }
      .close-icon:hover { color: #333; }

      /* INPUT ROW (Recipient + Tone + Button) */
      .input-row {
        display: flex; gap: 15px;
        align-items: flex-end; /* Aligns inputs and button on the bottom baseline */
      }
      .input-group { display: flex; flex-direction: column; }

      /* Flex weights for inputs */
      .input-recipient { flex: 3; }
      .input-tone { flex: 2; }

      label { font-size: 12px; font-weight: bold; color: #555; margin-bottom: 4px; }

      input, select, textarea {
        width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;
        box-sizing: border-box; font-size: 14px; height: 36px;
      }
      input[type="checkbox"] {
        width: auto;
        height: auto;
        padding: 0;
        border: none;
      }
      textarea {
        height: 70px;
        resize: vertical;
      }

      /* Primary Button Styling */
      button#btn-rephrase, .btn-primary {
        background: #007bff; color: white; border: none; padding: 0 20px;
        border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: bold;
        height: 36px; /* Match input height */
        white-space: nowrap;
      }
      button#btn-rephrase:hover, .btn-primary:hover { background: #0056b3; }
      .btn-secondary {
        background: #6c757d; color: white; border: none; padding: 0 16px;
        border-radius: 4px; cursor: pointer; font-size: 14px;
        height: 36px; white-space: nowrap;
      }
      .btn-secondary:hover { background: #5a6268; }

      /* CONTENT AREA (Side-by-Side) */
      .grid-row {
        display: flex; gap: 15px; margin-top: 5px;
        flex: 1; min-height: 0;
      }
      .col {
        flex: 1; display: flex; flex-direction: column; min-width: 0;
      }
      .text-box {
        padding: 10px; border-radius: 4px;
        flex: 1; height: 100%;
        overflow-y: auto; white-space: pre-wrap;
        font-size: 15px; line-height: 1.5; box-sizing: border-box; width: 100%;
      }
      .original { background: #fff; border: 1px dashed #ccc; color: #555; }
      .result { background: #f8f9fa; border: 1px solid #e9ecef; color: #333; }
      .error { color: #dc3545; font-size: 12px; }
      .notice { color: #0c5460; background: #d1ecf1; border: 1px solid #bee5eb; padding: 8px; border-radius: 4px; }
      .privacy {
        background: #fff7e6;
        border: 1px solid #f2d9a6;
        color: #5c4400;
        padding: 10px;
        border-radius: 4px;
        font-size: 12px;
        line-height: 1.4;
      }
      .privacy h3 { margin: 0 0 6px; font-size: 12px; }
      .privacy ul { margin: 0; padding-left: 16px; }
      .privacy li { margin-bottom: 4px; }
      .privacy-consent { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
      .privacy-consent input { margin-top: 0; flex: 0 0 auto; }
      .privacy-consent span { line-height: 1.2; }
      .meta { font-size: 12px; color: #666; }
      .meta-row { margin-bottom: 6px; }
      .meta a { color: #0b63ce; text-decoration: none; }
      .settings-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 5px; }
      .settings-status { color: #28a745; font-size: 12px; }
      h3 { margin: 10px 0 6px; font-size: 13px; }
      .section { margin-top: 6px; padding-top: 6px; border-top: 1px solid #e5e5e5; }
      .unlock-row { margin-top: 6px; }
      #settings-password-section { margin-top: 8px; }
    `;
  }

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
