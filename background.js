// --- Encryption Helper Functions (Same as before) ---
const SECRET_SALT = "rephraser-extension-secret-salt-9876"; 

function decryptData(encoded) {
  try {
    const text = atob(encoded);
    const textChars = text.split('');
    const saltChars = SECRET_SALT.split('');
    let decrypted = "";
    for(let i = 0; i < textChars.length; i++) {
      const charCode = textChars[i].charCodeAt(0) ^ saltChars[i % saltChars.length].charCodeAt(0);
      decrypted += String.fromCharCode(charCode);
    }
    return decrypted;
  } catch (e) {
    return encoded;
  }
}
// ---------------------------------------------------
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

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
    ['decrypt']
  );
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

function storageGet(area, keys) {
  return new Promise((resolve) => {
    chrome.storage[area].get(keys, (result) => resolve(result || {}));
  });
}

async function getApiKeyForRequest(requestPassphrase) {
  const [local, session] = await Promise.all([
    storageGet('local', ['openaiKeyEncrypted']),
    storageGet('session', ['openaiPassphrase'])
  ]);

  if (!local.openaiKeyEncrypted) {
    return { error: "Please save your OpenAI API key in settings." };
  }

  try {
    const passphraseToUse = session.openaiPassphrase || requestPassphrase;
    if (!passphraseToUse) {
      return { error: "Please enter your password to unlock the API key." };
    }
    const apiKey = await decryptApiKey(local.openaiKeyEncrypted, passphraseToUse);
    if (!session.openaiPassphrase && requestPassphrase) {
      chrome.storage.session.set({ openaiPassphrase: requestPassphrase });
    }
    return { apiKey };
  } catch (e) {
    return { error: "Failed to decrypt API key. Please check your password." };
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "rephrase-text",
    title: "Rephrase selected text...",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "rephrase-text") {
    // Security check: cannot inject into chrome:// settings pages
    if (tab.url.startsWith("chrome://") || tab.url.startsWith("edge://")) return;

    (async () => {
      const [local, session] = await Promise.all([
        storageGet('local', ['openaiKeyEncrypted']),
        storageGet('session', ['openaiPassphrase'])
      ]);
      const hasEncrypted = Boolean(local.openaiKeyEncrypted);
      const action = hasEncrypted ? "open_modal" : "open_settings";

      // 1. Always inject the script first.
      // 'activeTab' gives us permission to do this upon user click.
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"]
      }, () => {
        // 2. Once injected, send the message to open the modal
        if (chrome.runtime.lastError) {
          console.error("Script injection failed: " + chrome.runtime.lastError.message);
        } else {
          chrome.tabs.sendMessage(tab.id, { action });
        }
      });
    })();
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "call_openai") {
    (async () => {
      const { apiKey, error } = await getApiKeyForRequest(request.passphrase);
      if (error) {
        sendResponse({ error });
        return;
      }

      try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: request.model || "gpt-5-mini",
            messages: [
              { role: "system", content: `You are a helpful writing assistant.${request.context ? " Context: " + request.context : ""}` },
              { role: "user", content: `Rephrase the text between '[[["' and '"]]]'. Recipient: ${request.recipient}\nTone: ${request.tone}\nReturn only the rephrased text, no labels or extra lines.\n[[["${request.text}"]]]` }
            ]
          })
        });

        const data = await response.json();
        
        if (data.error) {
            sendResponse({ error: data.error.message });
        } else {
            sendResponse({ result: data.choices[0].message.content });
        }

      } catch (error) {
        sendResponse({ error: "Network error or invalid API key." });
      }
    })();

    return true; 
  }
  if (request.action === "get_session_passphrase") {
    chrome.storage.session.get(['openaiPassphrase'], (result) => {
      sendResponse({ hasPassphrase: Boolean(result.openaiPassphrase), passphrase: result.openaiPassphrase || '' });
    });
    return true;
  }
  if (request.action === "set_session_passphrase") {
    chrome.storage.session.set({ openaiPassphrase: request.passphrase || '' }, () => {
      sendResponse({ ok: true });
    });
    return true;
  }
});
