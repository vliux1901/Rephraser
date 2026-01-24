const { webcrypto } = require('crypto');

if (!global.crypto) {
  global.crypto = webcrypto;
}

if (!global.atob) {
  global.atob = (b64) => Buffer.from(b64, 'base64').toString('binary');
}

const { base64ToBuffer, decryptApiKey } = require('../background.js');

function bufferToBase64(data) {
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
  return Buffer.from(bytes).toString('base64');
}

describe('background helpers', () => {
  test('base64ToBuffer decodes base64 into original bytes', () => {
    const input = 'hello world';
    const base64 = Buffer.from(input, 'utf8').toString('base64');
    const buffer = base64ToBuffer(base64);
    const output = Buffer.from(new Uint8Array(buffer)).toString('utf8');
    expect(output).toBe(input);
  });

  test('decryptApiKey decrypts AES-GCM payload produced with PBKDF2 key', async () => {
    const passphrase = 'test-passphrase';
    const plaintext = 'sk-test-123';
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const iterations = 150000;

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(passphrase),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );

    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(plaintext)
    );

    const encrypted = {
      salt: bufferToBase64(salt),
      iv: bufferToBase64(iv),
      ciphertext: bufferToBase64(ciphertext),
      iterations
    };

    const decrypted = await decryptApiKey(encrypted, passphrase);
    expect(decrypted).toBe(plaintext);
  });
});
