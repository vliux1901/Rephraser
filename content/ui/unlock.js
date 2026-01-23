(function () {
  const app = window.rephraser || {};
  window.rephraser = app;
  app.ui = app.ui || {};

  function createAndShowUnlockModal(options) {
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
        app.ui.createAndShowSettingsModal({ mode, payload });
        return;
      }
      try {
        await app.crypto.decryptApiKey(encrypted, password);
        await app.storage.setSessionPassphrase(password);
        closeUnlock();
        app.ui.openAfterAuth(mode, payload);
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

  app.ui.createAndShowUnlockModal = createAndShowUnlockModal;
})();
