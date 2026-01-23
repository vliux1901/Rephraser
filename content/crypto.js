(function () {
  const app = window.rephraser || {};
  window.rephraser = app;
  app.crypto = app.crypto || {};

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

  app.crypto.encryptApiKey = encryptApiKey;
  app.crypto.decryptApiKey = decryptApiKey;
})();
