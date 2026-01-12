// Prevent duplicate listeners if injected multiple times
if (!window.hasRun) {
  window.hasRun = true;

  let shadowRoot = null;
  let hostElement = null;

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "open_modal") {
      // CHANGED: Grab text here directly to preserve newlines
      const selectedText = window.getSelection().toString();
      createAndShowModal(selectedText);
    }
  });

  function createAndShowModal(selectedText) {
    if (hostElement) hostElement.remove();

    hostElement = document.createElement('div');
    document.body.appendChild(hostElement);
    shadowRoot = hostElement.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
      .overlay {
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.5); z-index: 2147483647;
        display: flex; justify-content: center; align-items: center;
        font-family: sans-serif, Arial; text-align: left;
      }
      .modal {
        background: white; padding: 20px; border-radius: 8px;
        width: 400px; box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        display: flex; flex-direction: column; gap: 12px;
        color: #333;
        max-height: 90vh;
        overflow-y: auto;
      }
      h2 { margin: 0 0 5px 0; font-size: 18px; color: #222; }
      label { font-size: 12px; font-weight: bold; color: #555; display: block; margin-bottom: 4px; }
      input, select {
        width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;
        box-sizing: border-box; font-size: 14px;
      }
      button {
        background: #007bff; color: white; border: none; padding: 10px;
        border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: bold;
      }
      button:hover { background: #0056b3; }
      button.close { background: transparent; color: #666; border: 1px solid #ccc; margin-top: 5px;}
      button.close:hover { background: #eee; }
      
      .result-area {
        background: #f8f9fa; padding: 10px; border: 1px solid #e9ecef;
        border-radius: 4px; min-height: 60px; 
        white-space: pre-wrap;
        font-size: 14px;
        color: #333;
      }
      
      .original-area {
        font-size: 12px; color: #666; font-style: italic;
        background: #fff; border: 1px dashed #ccc; padding: 8px;
        border-radius: 4px; max-height: 80px; overflow-y: auto;
        
        /* This ensures the newlines captured by JS are actually displayed */
        white-space: pre-wrap; 
      }

      .error { color: #dc3545; font-size: 12px; }
    `;
    shadowRoot.appendChild(style);

    const container = document.createElement('div');
    container.className = 'overlay';
    container.innerHTML = `
      <div class="modal">
        <h2>Rephrase Text</h2>
        
        <div>
          <label>Recipient</label>
          <input type="text" id="recipient" placeholder="e.g. Boss, Client, Friend">
        </div>

        <div>
          <label>Tone</label>
          <select id="tone">
            <option value="Professional">Professional</option>
            <option value="Casual">Casual</option>
            <option value="Friendly">Friendly</option>
            <option value="Diplomatic">Diplomatic</option>
            <option value="Funny">Funny</option>
          </select>
        </div>

        <button id="btn-rephrase">Rephrase</button>
        
        <div>
          <label>Result</label>
          <div id="result" class="result-area"></div>
        </div>

        <div>
           <label>Original Selection</label>
           <div id="original-text" class="original-area"></div>
        </div>

        <button id="btn-close" class="close">Close</button>
      </div>
    `;
    shadowRoot.appendChild(container);

    const originalTextDiv = shadowRoot.getElementById('original-text');
    originalTextDiv.innerText = selectedText;

    shadowRoot.getElementById('btn-close').onclick = () => hostElement.remove();
    container.onclick = (e) => { if(e.target === container) hostElement.remove(); };
    
    const resultDiv = shadowRoot.getElementById('result');
    
    shadowRoot.getElementById('btn-rephrase').onclick = () => {
      const recipient = shadowRoot.getElementById('recipient').value;
      const tone = shadowRoot.getElementById('tone').value;
      
      resultDiv.innerText = "Generating...";
      
      chrome.runtime.sendMessage({
        action: "call_openai",
        text: selectedText,
        recipient: recipient,
        tone: tone
      }, (response) => {
        if (!response) {
            resultDiv.innerHTML = `<span class="error">Error: No response. Check API Key.</span>`;
        } else if (response.error) {
            resultDiv.innerHTML = `<span class="error">${response.error}</span>`;
        } else {
            resultDiv.innerText = response.result;
        }
      });
    };
  }
}