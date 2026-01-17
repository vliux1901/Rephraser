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
  const params = new URLSearchParams(window.location.search);
  const notice = document.getElementById('notice');
  const apiKeyInput = document.getElementById('apiKey');
  if (params.get('reason') === 'missing_key' && notice) {
    notice.style.display = 'block';
    if (apiKeyInput) {
      apiKeyInput.focus();
    }
    setTimeout(() => {
      notice.style.display = 'none';
    }, 4000);
  }

  chrome.storage.sync.get(['openaiKey'], (items) => {
    if (items.openaiKey) {
      if (apiKeyInput) {
        apiKeyInput.value = items.openaiKey;
      }
    }
  });
});
