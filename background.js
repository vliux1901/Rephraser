// 1. Create Context Menu
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "rephrase-text",
    title: "Rephrase selected text...",
    contexts: ["selection"]
  });
});

// 2. Handle Context Menu Click
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "rephrase-text") {
    
    // Ignore chrome:// pages
    if (tab.url.startsWith("chrome://") || tab.url.startsWith("edge://")) return;

    const message = {
      action: "open_modal"
      // Note: We REMOVED 'selection: info.selectionText' here.
      // We will let content.js grab the text to preserve newlines.
    };

    chrome.tabs.sendMessage(tab.id, message, (response) => {
      // If error (content script not ready), inject it manually
      if (chrome.runtime.lastError) {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["content.js"]
        }, () => {
            if (!chrome.runtime.lastError) {
                chrome.tabs.sendMessage(tab.id, message);
            }
        });
      }
    });
  }
});

// 3. Handle API Requests
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "call_openai") {
    chrome.storage.sync.get(['openaiKey'], async (result) => {
      const apiKey = result.openaiKey;
      if (!apiKey) {
        sendResponse({ error: "Please save your OpenAI API Key in settings." });
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
            model: "gpt-3.5-turbo",
            messages: [
              { role: "system", content: "You are a helpful writing assistant." },
              { role: "user", content: `Rephrase this text.\nRecipient: ${request.recipient}\nTone: ${request.tone}\nOriginal: "${request.text}"` }
            ]
          })
        });
        const data = await response.json();
        if (data.error) sendResponse({ error: data.error.message });
        else sendResponse({ result: data.choices[0].message.content });
      } catch (error) {
        sendResponse({ error: "Network error." });
      }
    });
    return true; 
  }
});