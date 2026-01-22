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

function showStatus(message) {
  const status = document.getElementById('settings-status');
  if (!status) return;
  status.textContent = message;
  status.style.display = 'block';
  setTimeout(() => {
    status.style.display = 'none';
  }, 2000);
}

function showError(message) {
  const error = document.getElementById('settings-error');
  if (!error) return;
  error.textContent = message;
  error.style.display = 'block';
}

function clearError() {
  const error = document.getElementById('settings-error');
  if (!error) return;
  error.textContent = '';
  error.style.display = 'none';
}

function setSessionPassphrase(passphrase) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'set_session_passphrase', passphrase }, (response) => {
      resolve(Boolean(response && response.ok));
    });
  });
}

document.getElementById('btn-save-key').addEventListener('click', async () => {
  clearError();
  const apiKeyInput = document.getElementById('api-key-input');
  const passwordInput = document.getElementById('password-input');
  const apiKey = apiKeyInput ? apiKeyInput.value.trim() : '';
  const password = passwordInput ? passwordInput.value.trim() : '';

  const encrypted = await getLocalEncrypted();

  if (!encrypted || apiKey) {
    if (!apiKey) {
      showError('Please enter an API key.');
      return;
    }
    if (!password) {
      showError('Please enter a password.');
      return;
    }
    const encryptedKey = await encryptApiKey(apiKey, password);
    chrome.storage.local.set({ openaiKeyEncrypted: encryptedKey }, () => {
      setSessionPassphrase(password).then(() => {
        showStatus('API key saved.');
        setTimeout(() => {
          window.close();
        }, 400);
      });
    });
    return;
  }

  if (!password) {
    showError('Please enter your password.');
    return;
  }
  try {
    await decryptApiKey(encrypted, password);
    setSessionPassphrase(password).then(() => {
      showStatus('Unlocked.');
      setTimeout(() => {
        window.close();
      }, 400);
    });
  } catch (e) {
    showError('Password is incorrect.');
  }
});

document.getElementById('btn-remove-key').addEventListener('click', () => {
  clearError();
  chrome.storage.local.remove(['openaiKeyEncrypted'], () => {
    showStatus('API key removed.');
    setTimeout(() => {
      window.close();
    }, 400);
  });
});

document.addEventListener('DOMContentLoaded', async () => {
  const sectionTitle = document.getElementById('settings-title');
  const apiKeyInput = document.getElementById('api-key-input');
  const passwordInput = document.getElementById('password-input');
  const encrypted = await getLocalEncrypted();
  if (encrypted) {
    if (sectionTitle) sectionTitle.textContent = 'Update';
    if (passwordInput) passwordInput.placeholder = 'Enter password to unlock';
  }

  chrome.runtime.sendMessage({ action: 'get_session_passphrase' }, (response) => {
    if (passwordInput && response && response.hasPassphrase) {
      passwordInput.value = response.passphrase || '';
      if (apiKeyInput && encrypted) {
        decryptApiKey(encrypted, response.passphrase).then((apiKey) => {
          apiKeyInput.value = apiKey || '';
        }).catch(() => {});
      }
    }
  });
});
