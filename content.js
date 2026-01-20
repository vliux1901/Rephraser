// Prevent duplicate listeners if injected multiple times
if (!window.hasRun) {
  window.hasRun = true;

  let shadowRoot = null;
  let hostElement = null;
  let lastSelectedText = '';
  const MAX_SUMMARY_CHARS = 12000;
  const baseStyles = `
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
        width: 50vw;       
        height: 50vh;      
        min-width: 600px;
        min-height: 400px; 
        max-width: 95vw;
        max-height: 95vh;
        
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        display: flex; flex-direction: column; gap: 10px;
        color: #333;
        box-sizing: border-box;
      }
      .modal.settings {
        width: 420px;
        min-width: 320px;
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
        font-size: 13px; line-height: 1.4; box-sizing: border-box; width: 100%;
      }
      .original { background: #fff; border: 1px dashed #ccc; color: #555; }
      .result { background: #f8f9fa; border: 1px solid #e9ecef; color: #333; }
      .error { color: #dc3545; font-size: 12px; }
      .notice { color: #0c5460; background: #d1ecf1; border: 1px solid #bee5eb; padding: 8px; border-radius: 4px; }
      .meta { font-size: 12px; color: #666; }
      .meta a { color: #0b63ce; text-decoration: none; }
      .settings-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 5px; }
      .settings-status { color: #28a745; font-size: 12px; }
      h3 { margin: 10px 0 6px; font-size: 13px; }
      .section { margin-top: 6px; padding-top: 6px; border-top: 1px solid #e5e5e5; }
      .unlock-row { margin-top: 6px; }
      #settings-password-section { margin-top: 8px; }
  `;

  const textEncoder = new TextEncoder();
  const textDecoder = new TextDecoder();

  function bufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  function base64ToBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  async function deriveKey(passphrase, salt, iterations) {
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      textEncoder.encode(passphrase),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async function encryptApiKey(apiKey, passphrase) {
    const iterations = 150000;
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(passphrase, salt, iterations);
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      textEncoder.encode(apiKey)
    );
    return {
      ciphertext: bufferToBase64(ciphertext),
      iv: bufferToBase64(iv),
      salt: bufferToBase64(salt),
      iterations
    };
  }

  async function decryptApiKey(encrypted, passphrase) {
    const iterations = encrypted.iterations || 150000;
    const salt = new Uint8Array(base64ToBuffer(encrypted.salt));
    const iv = new Uint8Array(base64ToBuffer(encrypted.iv));
    const key = await deriveKey(passphrase, salt, iterations);
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      base64ToBuffer(encrypted.ciphertext)
    );
    return textDecoder.decode(plaintext);
  }

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

  function normalizeText(text) {
    return (text || '').replace(/\s+/g, ' ').trim();
  }

  function getPageContent(maxChars) {
    const rawText = document.body ? document.body.innerText : '';
    const normalized = normalizeText(rawText);
    if (normalized.length <= maxChars) {
      return { text: normalized, truncated: false };
    }
    return { text: normalized.slice(0, maxChars), truncated: true };
  }

  function buildSummaryPayload() {
    const { text, truncated } = getPageContent(MAX_SUMMARY_CHARS);
    return {
      text,
      truncated,
      title: document.title || 'Untitled page',
      url: window.location.href
    };
  }

  function openAfterAuth(mode, payload) {
    if (mode === 'summary') {
      createAndShowSummaryModal(payload);
      return;
    }
    createAndShowModal((payload && payload.selectedText) || '');
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "open_modal") {
      lastSelectedText = window.getSelection().toString();
      chrome.storage.local.get(['openaiKeyEncrypted'], async (localItems) => {
        const hasEncrypted = Boolean(localItems.openaiKeyEncrypted);
        const hasPassphrase = await hasSessionPassphrase();
        if (hasEncrypted && !hasPassphrase) {
          createAndShowUnlockModal({ mode: 'rephrase', payload: { selectedText: lastSelectedText } });
          return;
        }
        createAndShowModal(lastSelectedText);
      });
    } else if (request.action === "open_settings") {
      lastSelectedText = window.getSelection().toString();
      createAndShowSettingsModal({ mode: request.mode || 'rephrase', payload: { selectedText: lastSelectedText } });
    } else if (request.action === "open_summary_modal") {
      const summaryPayload = buildSummaryPayload();
      chrome.storage.local.get(['openaiKeyEncrypted'], async (localItems) => {
        const hasEncrypted = Boolean(localItems.openaiKeyEncrypted);
        const hasPassphrase = await hasSessionPassphrase();
        if (!hasEncrypted) {
          createAndShowSettingsModal({ mode: 'summary', payload: summaryPayload });
          return;
        }
        if (hasEncrypted && !hasPassphrase) {
          createAndShowUnlockModal({ mode: 'summary', payload: summaryPayload });
          return;
        }
        createAndShowSummaryModal(summaryPayload);
      });
    }
  });

  function createAndShowModal(selectedText) {
    if (hostElement) hostElement.remove();

    hostElement = document.createElement('div');
    document.body.appendChild(hostElement);
    shadowRoot = hostElement.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = baseStyles;
    shadowRoot.appendChild(style);

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
    shadowRoot.appendChild(container);

    const originalTextDiv = shadowRoot.getElementById('original-text');
    originalTextDiv.innerText = selectedText;

    // Use the new X button ID
    shadowRoot.getElementById('btn-close-x').onclick = () => hostElement.remove();
    container.onclick = (e) => { if(e.target === container) hostElement.remove(); };
    
    const resultDiv = shadowRoot.getElementById('result');
    
    shadowRoot.getElementById('btn-rephrase').onclick = () => {
      const recipient = shadowRoot.getElementById('recipient').value;
      const tone = shadowRoot.getElementById('tone').value;
      const model = shadowRoot.getElementById('model').value;
      const context = shadowRoot.getElementById('context').value;
      
      resultDiv.innerText = "Generating...";

      const sendRequest = () => {
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

      sendRequest();
    };
  }

  function createAndShowSummaryModal(payload) {
    const pageText = (payload && payload.text) || '';
    const pageTitle = (payload && payload.title) || 'Untitled page';
    const pageUrl = (payload && payload.url) || '';
    const isTruncated = Boolean(payload && payload.truncated);

    if (hostElement) hostElement.remove();

    hostElement = document.createElement('div');
    document.body.appendChild(hostElement);
    shadowRoot = hostElement.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = baseStyles;
    shadowRoot.appendChild(style);

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
          <button id="btn-summarize" class="btn-primary">Summarize</button>
        </div>
        <div class="meta">
          <div><strong>Title:</strong> <span id="summary-title"></span></div>
          <div><strong>URL:</strong> <a id="summary-url" href="#" target="_blank" rel="noreferrer"></a></div>
          <div id="summary-truncated" class="notice" style="display:none;">Content truncated to fit the summary limit.</div>
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
    shadowRoot.appendChild(container);

    const pageTextDiv = shadowRoot.getElementById('page-text');
    pageTextDiv.innerText = pageText || 'No readable content found on this page.';
    const titleSpan = shadowRoot.getElementById('summary-title');
    const urlLink = shadowRoot.getElementById('summary-url');
    const truncatedNotice = shadowRoot.getElementById('summary-truncated');
    titleSpan.textContent = pageTitle;
    if (pageUrl) {
      urlLink.textContent = pageUrl;
      urlLink.href = pageUrl;
    } else {
      urlLink.textContent = 'Unknown';
      urlLink.removeAttribute('href');
    }
    if (isTruncated) {
      truncatedNotice.style.display = 'block';
    }

    const resultDiv = shadowRoot.getElementById('summary-result');
    shadowRoot.getElementById('btn-close-summary').onclick = () => hostElement.remove();
    container.onclick = (e) => { if (e.target === container) hostElement.remove(); };

    shadowRoot.getElementById('btn-summarize').onclick = () => {
      if (!pageText) {
        resultDiv.innerHTML = `<span class="error">No readable content found to summarize.</span>`;
        return;
      }
      const model = shadowRoot.getElementById('summary-model').value;
      resultDiv.innerText = "Generating summary...";
      chrome.runtime.sendMessage({
        action: "call_openai_summary",
        text: pageText,
        title: pageTitle,
        url: pageUrl,
        model
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
    if (hostElement) hostElement.remove();

    hostElement = document.createElement('div');
    document.body.appendChild(hostElement);
    shadowRoot = hostElement.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = baseStyles;
    shadowRoot.appendChild(style);

    const container = document.createElement('div');
    container.className = 'overlay';
    container.innerHTML = `
      <div class="modal settings">
        <div class="header-row">
           <h2>Settings</h2>
           <button id="btn-close-settings" class="close-icon">&times;</button>
        </div>
        <div class="notice">Enter your OpenAI API key to enable rephrasing. It will be protected by the password and won't be shared with anyone.</div>
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
    shadowRoot.appendChild(container);

    const apiKeyInput = shadowRoot.getElementById('api-key-input');
    const passwordInput = shadowRoot.getElementById('password-input');
    const settingsTitle = shadowRoot.getElementById('settings-title');
    const apiKeySection = shadowRoot.getElementById('settings-api-key-section');
    const errorDiv = shadowRoot.getElementById('settings-error');
    const statusDiv = shadowRoot.getElementById('settings-status');

    apiKeyInput.focus();

    const closeSettings = () => hostElement.remove();
    shadowRoot.getElementById('btn-close-settings').onclick = closeSettings;
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
      const apiKey = apiKeyInput.value.trim();
      const password = passwordInput.value.trim();
      const existingEncrypted = await getLocalEncrypted();
      if (!existingEncrypted) {
        if (!apiKey) {
          showError("Please enter an API key.");
          return;
        }
        if (!password) {
          showError("Please enter a password.");
          return;
        }
        const encrypted = await encryptApiKey(apiKey, password);
        chrome.storage.local.set({ openaiKeyEncrypted: encrypted }, async () => {
          await setSessionPassphrase(password);
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
        await decryptApiKey(existingEncrypted, password);
        await setSessionPassphrase(password);
        showStatus("Unlocked.");
        setTimeout(() => {
          closeSettings();
          openAfterAuth(mode, payload);
        }, 800);
      } catch (e) {
        showError("Password is incorrect.");
      }
    };

    shadowRoot.getElementById('btn-save-key').onclick = saveKey;
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

    getLocalEncrypted().then((encrypted) => {
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
    if (hostElement) hostElement.remove();

    hostElement = document.createElement('div');
    document.body.appendChild(hostElement);
    shadowRoot = hostElement.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = baseStyles;
    shadowRoot.appendChild(style);

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
    shadowRoot.appendChild(container);

    const passwordInput = shadowRoot.getElementById('unlock-password-input');
    const errorDiv = shadowRoot.getElementById('unlock-error');

    passwordInput.focus();

    const closeUnlock = () => hostElement.remove();
    shadowRoot.getElementById('btn-close-unlock').onclick = closeUnlock;
    shadowRoot.getElementById('btn-cancel-unlock').onclick = closeUnlock;
    container.onclick = (e) => { if (e.target === container) closeUnlock(); };

    const unlock = async () => {
      errorDiv.style.display = 'none';
      const password = passwordInput.value.trim();
      if (!password) {
        errorDiv.textContent = 'Please enter your password.';
        errorDiv.style.display = 'block';
        return;
      }
      const encrypted = await getLocalEncrypted();
      if (!encrypted) {
        closeUnlock();
        createAndShowSettingsModal({ mode, payload });
        return;
      }
      try {
        await decryptApiKey(encrypted, password);
        await setSessionPassphrase(password);
        closeUnlock();
        openAfterAuth(mode, payload);
      } catch (e) {
        errorDiv.textContent = 'Password is incorrect.';
        errorDiv.style.display = 'block';
      }
    };

    shadowRoot.getElementById('btn-unlock').onclick = unlock;
    passwordInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        unlock();
      }
    });
  }
}
