(function () {
  const app = window.rephraser || {};
  window.rephraser = app;
  app.ui = app.ui || {};

  function createAndShowSettingsModal(options) {
    const mode = (options && options.mode) || 'rephrase';
    const payload = (options && options.payload) || {};
    const state = app.state;
    if (state.hostElement) state.hostElement.remove();

    state.hostElement = document.createElement('div');
    document.body.appendChild(state.hostElement);
    state.shadowRoot = state.hostElement.attachShadow({ mode: 'open' });

    app.ui.appendStyles(state.shadowRoot);

    const container = document.createElement('div');
    container.className = 'overlay';
    container.innerHTML = `
      <div class="modal settings">
        <div class="header-row">
           <h2>Settings</h2>
           <button id="btn-close-settings" class="close-icon">&times;</button>
        </div>
        <div class="notice">Enter your OpenAI API key to enable rephrasing. It will be protected by the password and won't be shared with anyone.</div>
        <div id="privacy-disclosure"></div>
        <div class="section">
          <div class="input-group" id="settings-api-key-section">
            <label>OpenAI API Key</label>
            <input type="password" id="api-key-input" placeholder="sk-xxxxxx...">
          </div>
          <div class="input-group" id="settings-password-section">
            <label>Password</label>
            <input type="password" id="password-input" placeholder="Set the password to protect the OpenAI API key">
          </div>
          <div class="settings-actions">
            <button id="btn-save-key" class="btn-primary">Continue</button>
          </div>
        </div>
        <div id="settings-error" class="error" style="display:none;"></div>
        <div id="settings-status" class="settings-status" style="display:none;">Saved!</div>
        <div class="settings-actions"></div>
      </div>
    `;
    state.shadowRoot.appendChild(container);

    const apiKeyInput = state.shadowRoot.getElementById('api-key-input');
    const passwordInput = state.shadowRoot.getElementById('password-input');
    const settingsTitle = state.shadowRoot.getElementById('settings-title');
    const apiKeySection = state.shadowRoot.getElementById('settings-api-key-section');
    const errorDiv = state.shadowRoot.getElementById('settings-error');
    const statusDiv = state.shadowRoot.getElementById('settings-status');
    const privacyDisclosure = state.shadowRoot.getElementById('privacy-disclosure');

    app.ui.loadPrivacyDisclosure(privacyDisclosure);
    apiKeyInput.focus();

    const closeSettings = () => state.hostElement.remove();
    state.shadowRoot.getElementById('btn-close-settings').onclick = closeSettings;
    container.onclick = (e) => { if (e.target === container) closeSettings(); };

    const showError = (message) => {
      errorDiv.textContent = message;
      errorDiv.style.display = 'block';
    };

    const showStatus = (message) => {
      statusDiv.textContent = message;
      statusDiv.style.display = 'block';
      setTimeout(() => {
        statusDiv.style.display = 'none';
      }, 2000);
    };

    const clearMessages = () => {
      errorDiv.style.display = 'none';
      statusDiv.style.display = 'none';
    };

    const saveKey = async () => {
      clearMessages();
      const privacyAccepted = await app.storage.getPrivacyAccepted();
      const privacyConsent = state.shadowRoot.getElementById('privacy-consent');
      if (!privacyAccepted && (!privacyConsent || !privacyConsent.checked)) {
        showError("Please accept the privacy disclosure to continue.");
        return;
      }
      if (!privacyAccepted && privacyConsent && privacyConsent.checked) {
        await app.storage.setPrivacyAccepted();
      }
      const apiKey = apiKeyInput.value.trim();
      const password = passwordInput.value.trim();
      const existingEncrypted = await app.storage.getLocalEncrypted();
      if (!existingEncrypted) {
        if (!apiKey) {
          showError("Please enter an API key.");
          return;
        }
        if (!password) {
          showError("Please enter a password.");
          return;
        }
        const encrypted = await app.crypto.encryptApiKey(apiKey, password);
        chrome.storage.local.set({ openaiKeyEncrypted: encrypted }, async () => {
          await app.storage.setSessionPassphrase(password);
          showStatus("API key saved.");
          setTimeout(() => {
            closeSettings();
            app.ui.openAfterAuth(mode, payload);
          }, 800);
        });
        return;
      }

      if (!password) {
        showError("Please enter your password.");
        return;
      }
      try {
        await app.crypto.decryptApiKey(existingEncrypted, password);
        await app.storage.setSessionPassphrase(password);
        showStatus("Unlocked.");
        setTimeout(() => {
          closeSettings();
          app.ui.openAfterAuth(mode, payload);
        }, 800);
      } catch (e) {
        showError("Password is incorrect.");
      }
    };

    state.shadowRoot.getElementById('btn-save-key').onclick = saveKey;
    apiKeyInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        saveKey();
      }
    });
    passwordInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        saveKey();
      }
    });

    app.storage.getLocalEncrypted().then((encrypted) => {
      if (encrypted) {
        if (settingsTitle) settingsTitle.textContent = 'Unlock';
        if (apiKeySection) apiKeySection.style.display = 'none';
        if (passwordInput) {
          passwordInput.placeholder = 'Enter password to unlock';
        }
      }
    });
  }

  app.ui.createAndShowSettingsModal = createAndShowSettingsModal;
})();
