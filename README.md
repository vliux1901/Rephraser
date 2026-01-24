# Rephraser AI

Chrome extension that rephrases selected text and summarizes pages using the OpenAI API.

## Features
- Rephrase selected text from the right-click context menu.
- Summarize the current page or selection.
- Protects your OpenAI API key with a local user password and AES-GCM encryption.
- Stores data locally in Chrome storage (no external backend).

## Install (unpacked)
1. Clone or download this repo.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the project folder.

## Configure
1. Open the extension settings (from the extension menu or `chrome://extensions` > Details > Extension options).
2. Enter your OpenAI API key and a password.
3. Save.

## Usage
- Select text on a page, right-click, choose **Rephrase text ...**.
- Right-click on a page and choose **Summarize text ...** to get a quick summary.
- The first time each session, you may be asked to unlock with your password.

## Security and privacy
- Your OpenAI API key is encrypted locally using a password you set.
- The key is stored in `chrome.storage.local`; the session passphrase is in `chrome.storage.session`.
- Only the selected text or extracted page content is sent to the OpenAI API when you trigger actions.

## Development
- Lint:
  ```bash
  npm run lint
  ```

## Project structure
- `background.js`: context menu wiring, OpenAI API calls, key decryption.
- `content/`: injected UI and logic for modals, rephrase, and summary.
- `options.html`/`options.js`: settings page for API key and password.
- `manifest.json`: Chrome extension manifest.

## License
MIT
