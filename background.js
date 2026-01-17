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

    chrome.storage.sync.get(['openaiKey'], (result) => {
      const action = result.openaiKey ? "open_modal" : "open_settings";

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
    });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "call_openai") {
    
    chrome.storage.sync.get(['openaiKey'], async (result) => {
      let apiKey = result.openaiKey;

      if (!apiKey) {
        sendResponse({ error: "Please save your OpenAI API Key in settings." });
        return;
      }

      if (!apiKey.startsWith("sk-")) {
          apiKey = decryptData(apiKey);
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
    });

    return true; 
  }
});
