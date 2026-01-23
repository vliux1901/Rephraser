(function () {
  const app = window.rephraser || {};
  window.rephraser = app;
  app.ui = app.ui || {};

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
      createAndShowSummaryModal(payload);
      return;
    }
    createAndShowModal((payload && payload.selectedText) || '');
  }

  function createAndShowModal(selectedText) {
    const state = app.state;
    if (state.hostElement) state.hostElement.remove();

    state.hostElement = document.createElement('div');
    document.body.appendChild(state.hostElement);
    state.shadowRoot = state.hostElement.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = app.styles.base;
    state.shadowRoot.appendChild(style);

    const container = document.createElement('div');
    container.className = 'overlay';
    container.innerHTML = `
      <div class="modal">

        <!-- Header Row: Title & X Button -->
        <div class="header-row">
           <h2>Rephrase with AI</h2>
           <button id="btn-close-x" class="close-icon">&times;</button>
        </div>

        <!-- Input Row: Recipient, Tone, Model, and Rephrase Button -->
        <div class="input-row">
          <div class="input-group input-recipient">
            <label>Recipient</label>
            <input type="text" id="recipient" placeholder="e.g. Boss, Client">
          </div>

          <div class="input-group input-tone">
            <label>Tone</label>
            <select id="tone">
              <option value="Professional">Professional</option>
              <option value="Casual">Casual</option>
              <option value="Friendly">Friendly</option>
              <option value="Diplomatic">Diplomatic</option>
              <option value="Funny">Funny</option>
            </select>
          </div>

          <div class="input-group input-model">
            <label>Model</label>
            <select id="model">
              <option value="gpt-5-mini" selected>GPT-5-mini — fast, cost-effective</option>
              <option value="gpt-5">GPT-5 — highest quality, expensive</option>
              <option value="gpt-5-nano">GPT-5-nano — ultra-fast, low cost</option>
              <option value="gpt-4.1">GPT-4.1 — strong reasoning</option>
              <option value="gpt-4.1-mini">GPT-4.1-mini — balanced price/perf</option>
              <option value="gpt-4.1-nano">GPT-4.1-nano — lightweight, low cost</option>
              <option value="gpt-4o">GPT-4o — flagship multimodal</option>
              <option value="gpt-4o-mini">GPT-4o-mini — small, affordable</option>
              <option value="gpt-3.5-turbo">GPT-3.5 Turbo — legacy, low cost</option>
            </select>
          </div>

          <button id="btn-rephrase">Rephrase</button>
        </div>

        <div class="input-group">
          <label>Context</label>
          <textarea id="context" placeholder="e.g. Purpose of the text: 'Rephrase for college application'"></textarea>
        </div>

        <!-- Content Row -->
        <div class="grid-row">
            <div class="col">
                <label>Original</label>
                <div id="original-text" class="text-box original"></div>
            </div>

            <div class="col">
                <label>Rephrased</label>
                <div id="result" class="text-box result"></div>
            </div>
        </div>
      </div>
    `;
    state.shadowRoot.appendChild(container);

    const originalTextDiv = state.shadowRoot.getElementById('original-text');
    originalTextDiv.innerText = selectedText;

    state.shadowRoot.getElementById('btn-close-x').onclick = () => state.hostElement.remove();
    container.onclick = (e) => { if (e.target === container) state.hostElement.remove(); };

    const resultDiv = state.shadowRoot.getElementById('result');

    state.shadowRoot.getElementById('btn-rephrase').onclick = () => {
      const recipient = state.shadowRoot.getElementById('recipient').value;
      const tone = state.shadowRoot.getElementById('tone').value;
      const model = state.shadowRoot.getElementById('model').value;
      const context = state.shadowRoot.getElementById('context').value;

      resultDiv.innerText = "Generating...";

      chrome.runtime.sendMessage({
        action: "call_openai",
        text: selectedText,
        recipient: recipient,
        tone: tone,
        model: model,
        context: context
      }, (response) => {
        if (!response) {
          resultDiv.innerHTML = `<span class="error">Error: No response. Check API Key.</span>`;
        } else if (response.error) {
          resultDiv.innerHTML = `<span class="error">${response.error}</span>`;
        } else {
          resultDiv.innerText = response.result;
        }
      });
    };
  }

  function createAndShowSummaryModal(payload) {
    const pageText = (payload && payload.text) || '';
    const pageTitle = (payload && payload.title) || 'Untitled page';
    const pageUrl = (payload && payload.url) || '';
    const isTruncated = Boolean(payload && payload.truncated);
    const fullLength = (payload && payload.length) || 0;
    const isSelection = Boolean(payload && payload.isSelection);

    const state = app.state;
    if (state.hostElement) state.hostElement.remove();

    state.hostElement = document.createElement('div');
    document.body.appendChild(state.hostElement);
    state.shadowRoot = state.hostElement.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = app.styles.base;
    state.shadowRoot.appendChild(style);

    const container = document.createElement('div');
    container.className = 'overlay';
    container.innerHTML = `
      <div class="modal">
        <div class="header-row">
           <h2>Summarize page</h2>
           <button id="btn-close-summary" class="close-icon">&times;</button>
        </div>
        <div class="input-row">
          <div class="input-group input-model">
            <label>Model</label>
            <select id="summary-model">
              <option value="gpt-5-mini" selected>GPT-5-mini — fast, cost-effective</option>
              <option value="gpt-5">GPT-5 — highest quality, expensive</option>
              <option value="gpt-5-nano">GPT-5-nano — ultra-fast, low cost</option>
              <option value="gpt-4.1">GPT-4.1 — strong reasoning</option>
              <option value="gpt-4.1-mini">GPT-4.1-mini — balanced price/perf</option>
              <option value="gpt-4.1-nano">GPT-4.1-nano — lightweight, low cost</option>
              <option value="gpt-4o">GPT-4o — flagship multimodal</option>
              <option value="gpt-4o-mini">GPT-4o-mini — small, affordable</option>
              <option value="gpt-3.5-turbo">GPT-3.5 Turbo — legacy, low cost</option>
            </select>
          </div>
          <div class="input-group input-sentences">
            <label>Max sentences</label>
            <select id="summary-sentences">
              <option value="1" selected>1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5</option>
            </select>
          </div>
          <button id="btn-summarize" class="btn-primary">Summarize</button>
        </div>
        <div class="meta">
          <div class="meta-row"><strong>Title:</strong> <span id="summary-title"></span></div>
          <div class="meta-row"><strong>URL:</strong> <a id="summary-url" href="#" target="_blank" rel="noreferrer"></a></div>
          <div id="summary-truncated" class="notice" style="display:none;"></div>
        </div>
        <div class="grid-row">
            <div class="col">
                <label>Page content</label>
                <div id="page-text" class="text-box original"></div>
            </div>

            <div class="col">
                <label>Summary</label>
                <div id="summary-result" class="text-box result"></div>
            </div>
        </div>
      </div>
    `;
    state.shadowRoot.appendChild(container);

    const pageTextDiv = state.shadowRoot.getElementById('page-text');
    pageTextDiv.innerText = pageText || 'No readable content found on this page.';
    const titleSpan = state.shadowRoot.getElementById('summary-title');
    const urlLink = state.shadowRoot.getElementById('summary-url');
    const truncatedNotice = state.shadowRoot.getElementById('summary-truncated');
    titleSpan.textContent = pageTitle;
    if (pageUrl) {
      urlLink.textContent = pageUrl;
      urlLink.href = pageUrl;
    } else {
      urlLink.textContent = 'Unknown';
      urlLink.removeAttribute('href');
    }
    if (isSelection) {
      truncatedNotice.textContent = "Summarizing the selected text only.";
      truncatedNotice.style.display = 'block';
    } else if (isTruncated) {
      truncatedNotice.textContent = `Page is too long. Showing the first ${app.constants.MAX_SUMMARY_CHARS.toLocaleString()} of ${fullLength.toLocaleString()} characters for summary.`;
      truncatedNotice.style.display = 'block';
    }

    const resultDiv = state.shadowRoot.getElementById('summary-result');
    state.shadowRoot.getElementById('btn-close-summary').onclick = () => state.hostElement.remove();
    container.onclick = (e) => { if (e.target === container) state.hostElement.remove(); };

    state.shadowRoot.getElementById('btn-summarize').onclick = () => {
      if (!pageText) {
        resultDiv.innerHTML = `<span class="error">No readable content found to summarize.</span>`;
        return;
      }
      const model = state.shadowRoot.getElementById('summary-model').value;
      const maxSentences = Number(state.shadowRoot.getElementById('summary-sentences').value) || 1;
      resultDiv.innerText = "Generating summary...";
      chrome.runtime.sendMessage({
        action: "call_openai_summary",
        text: pageText,
        title: pageTitle,
        url: pageUrl,
        model,
        maxSentences
      }, (response) => {
        if (!response) {
          resultDiv.innerHTML = `<span class="error">Error: No response. Check API Key.</span>`;
        } else if (response.error) {
          resultDiv.innerHTML = `<span class="error">${response.error}</span>`;
        } else {
          resultDiv.innerText = response.result;
        }
      });
    };
  }

  function createAndShowSettingsModal(options) {
    const mode = (options && options.mode) || 'rephrase';
    const payload = (options && options.payload) || {};
    const state = app.state;
    if (state.hostElement) state.hostElement.remove();

    state.hostElement = document.createElement('div');
    document.body.appendChild(state.hostElement);
    state.shadowRoot = state.hostElement.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = app.styles.base;
    state.shadowRoot.appendChild(style);

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

    loadPrivacyDisclosure(privacyDisclosure);
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
            openAfterAuth(mode, payload);
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
          openAfterAuth(mode, payload);
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

  function createAndShowUnlockModal(options) {
    const mode = (options && options.mode) || 'rephrase';
    const payload = (options && options.payload) || {};
    const state = app.state;
    if (state.hostElement) state.hostElement.remove();

    state.hostElement = document.createElement('div');
    document.body.appendChild(state.hostElement);
    state.shadowRoot = state.hostElement.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = app.styles.base;
    state.shadowRoot.appendChild(style);

    const container = document.createElement('div');
    container.className = 'overlay';
    container.innerHTML = `
      <div class="modal settings">
        <div class="header-row">
           <h2>Unlock</h2>
           <button id="btn-close-unlock" class="close-icon">&times;</button>
        </div>
        <div class="notice">Enter your password to unlock the saved API key for this session.</div>
        <div class="input-group">
          <label>Password</label>
          <input type="password" id="unlock-password-input" placeholder="Enter password">
        </div>
        <div id="unlock-error" class="error" style="display:none;"></div>
        <div class="settings-actions">
          <button id="btn-cancel-unlock" class="btn-secondary">Cancel</button>
          <button id="btn-unlock" class="btn-primary">Unlock</button>
        </div>
      </div>
    `;
    state.shadowRoot.appendChild(container);

    const passwordInput = state.shadowRoot.getElementById('unlock-password-input');
    const errorDiv = state.shadowRoot.getElementById('unlock-error');

    passwordInput.focus();

    const closeUnlock = () => state.hostElement.remove();
    state.shadowRoot.getElementById('btn-close-unlock').onclick = closeUnlock;
    state.shadowRoot.getElementById('btn-cancel-unlock').onclick = closeUnlock;
    container.onclick = (e) => { if (e.target === container) closeUnlock(); };

    const unlock = async () => {
      errorDiv.style.display = 'none';
      const password = passwordInput.value.trim();
      if (!password) {
        errorDiv.textContent = 'Please enter your password.';
        errorDiv.style.display = 'block';
        return;
      }
      const encrypted = await app.storage.getLocalEncrypted();
      if (!encrypted) {
        closeUnlock();
        createAndShowSettingsModal({ mode, payload });
        return;
      }
      try {
        await app.crypto.decryptApiKey(encrypted, password);
        await app.storage.setSessionPassphrase(password);
        closeUnlock();
        openAfterAuth(mode, payload);
      } catch (e) {
        errorDiv.textContent = 'Password is incorrect.';
        errorDiv.style.display = 'block';
      }
    };

    state.shadowRoot.getElementById('btn-unlock').onclick = unlock;
    passwordInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        unlock();
      }
    });
  }

  app.ui.loadPrivacyDisclosure = loadPrivacyDisclosure;
  app.ui.openAfterAuth = openAfterAuth;
  app.ui.createAndShowModal = createAndShowModal;
  app.ui.createAndShowSummaryModal = createAndShowSummaryModal;
  app.ui.createAndShowSettingsModal = createAndShowSettingsModal;
  app.ui.createAndShowUnlockModal = createAndShowUnlockModal;
})();
