(function () {
  const app = window.rephraser || {};
  window.rephraser = app;
  app.storage = app.storage || {};

  function getLocalEncrypted() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['openaiKeyEncrypted'], (result) => {
        resolve(result.openaiKeyEncrypted || null);
      });
    });
  }

  function hasSessionPassphrase() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'get_session_passphrase' }, (response) => {
        resolve(Boolean(response && response.hasPassphrase));
      });
    });
  }

  function setSessionPassphrase(passphrase) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'set_session_passphrase', passphrase }, (response) => {
        resolve(Boolean(response && response.ok));
      });
    });
  }

  function getPrivacyAccepted() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['privacyDisclosureAccepted'], (result) => {
        resolve(Boolean(result.privacyDisclosureAccepted));
      });
    });
  }

  function setPrivacyAccepted() {
    return new Promise((resolve) => {
      chrome.storage.local.set({ privacyDisclosureAccepted: true }, () => resolve(true));
    });
  }

  app.storage.getLocalEncrypted = getLocalEncrypted;
  app.storage.hasSessionPassphrase = hasSessionPassphrase;
  app.storage.setSessionPassphrase = setSessionPassphrase;
  app.storage.getPrivacyAccepted = getPrivacyAccepted;
  app.storage.setPrivacyAccepted = setPrivacyAccepted;
})();
