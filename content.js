(function () {
  const app = window.rephraser || {};
  window.rephraser = app;

  if (app.hasRun) {
    return;
  }
  app.hasRun = true;

  const state = app.state;
  const storage = app.storage;
  const ui = app.ui;
  const utils = app.utils;

  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === "open_modal") {
      state.lastSelectedText = window.getSelection().toString();
      chrome.storage.local.get(['openaiKeyEncrypted'], async (localItems) => {
        const privacyAccepted = await storage.getPrivacyAccepted();
        const hasEncrypted = Boolean(localItems.openaiKeyEncrypted);
        const hasPassphrase = await storage.hasSessionPassphrase();
        if (!privacyAccepted) {
          ui.createAndShowSettingsModal({ mode: 'rephrase', payload: { selectedText: state.lastSelectedText } });
          return;
        }
        if (hasEncrypted && !hasPassphrase) {
          ui.createAndShowUnlockModal({ mode: 'rephrase', payload: { selectedText: state.lastSelectedText } });
          return;
        }
        ui.createAndShowModal(state.lastSelectedText);
      });
    } else if (request.action === "open_settings") {
      state.lastSelectedText = window.getSelection().toString();
      ui.createAndShowSettingsModal({ mode: request.mode || 'rephrase', payload: { selectedText: state.lastSelectedText } });
    } else if (request.action === "open_summary_modal") {
      const summaryPayload = utils.buildSummaryPayload();
      chrome.storage.local.get(['openaiKeyEncrypted'], async (localItems) => {
        const privacyAccepted = await storage.getPrivacyAccepted();
        const hasEncrypted = Boolean(localItems.openaiKeyEncrypted);
        const hasPassphrase = await storage.hasSessionPassphrase();
        if (!privacyAccepted) {
          ui.createAndShowSettingsModal({ mode: 'summary', payload: summaryPayload });
          return;
        }
        if (!hasEncrypted) {
          ui.createAndShowSettingsModal({ mode: 'summary', payload: summaryPayload });
          return;
        }
        if (hasEncrypted && !hasPassphrase) {
          ui.createAndShowUnlockModal({ mode: 'summary', payload: summaryPayload });
          return;
        }
        ui.createAndShowSummaryModal(summaryPayload);
      });
    }
  });
})();
