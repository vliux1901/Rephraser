// Save Options
document.getElementById('save').addEventListener('click', () => {
  const apiKey = document.getElementById('apiKey').value;
  chrome.storage.sync.set({ openaiKey: apiKey }, () => {
    const status = document.getElementById('status');
    status.style.display = 'block';
    setTimeout(() => {
      status.style.display = 'none';
    }, 2000);
  });
});

// Restore Options
document.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput = document.getElementById('apiKey');

  chrome.storage.sync.get(['openaiKey'], (items) => {
    if (items.openaiKey) {
      if (apiKeyInput) {
        apiKeyInput.value = items.openaiKey;
      }
    }
  });
});
