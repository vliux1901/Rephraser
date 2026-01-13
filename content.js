// Prevent duplicate listeners if injected multiple times
if (!window.hasRun) {
  window.hasRun = true;

  let shadowRoot = null;
  let hostElement = null;

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "open_modal") {
      // Capture text here to preserve line breaks
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
        /* WIDER MODAL FOR 2 COLUMNS */
        width: 600px; 
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        display: flex; flex-direction: column; gap: 12px;
        color: #333;
        max-height: 90vh;
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
      
      /* NEW GRID SYSTEM */
      .grid-row {
        display: flex;
        gap: 15px;
        margin-top: 5px;
      }
      .col {
        flex: 1; /* Each column takes 50% width */
        display: flex;
        flex-direction: column;
        min-width: 0; /* Prevents overflow issues */
      }

      /* UNIFIED TEXT BOX STYLES */
      .text-box {
        padding: 10px; 
        border-radius: 4px; 
        height: 200px; /* Fixed height for scrolling */
        overflow-y: auto;
        white-space: pre-wrap; /* Preserves line breaks */
        font-size: 13px;
        line-height: 1.4;
        box-sizing: border-box;
        width: 100%;
      }

      .original {
        background: #fff;
        border: 1px dashed #ccc;
        color: #555;
      }
      
      .result {
        background: #f8f9fa;
        border: 1px solid #e9ecef;
        color: #333;
      }
      
      .error { color: #dc3545; font-size: 12px; }
    `;
    shadowRoot.appendChild(style);

    const container = document.createElement('div');
    container.className = 'overlay';
    container.innerHTML = `
      <div class="modal">
        <h2>Rephrase Text</h2>
        
        <!-- Input Rows -->
        <div style="display: flex; gap: 15px;">
          <div style="flex: 2;">
            <label>Recipient</label>
            <input type="text" id="recipient" placeholder="e.g. Boss, Client">
          </div>
          <div style="flex: 1;">
            <label>Tone</label>
            <select id="tone">
              <option value="Professional">Professional</option>
              <option value="Casual">Casual</option>
              <option value="Friendly">Friendly</option>
              <option value="Diplomatic">Diplomatic</option>
              <option value="Funny">Funny</option>
            </select>
          </div>
        </div>

        <button id="btn-rephrase">Rephrase</button>
        
        <!-- Side-by-Side Comparison -->
        <div class="grid-row">
            <!-- Left Column: Original -->
            <div class="col">
                <label>Original</label>
                <div id="original-text" class="text-box original"></div>
            </div>

            <!-- Right Column: Result -->
            <div class="col">
                <label>Rephrased</label>
                <div id="result" class="text-box result"></div>
            </div>
        </div>

        <button id="btn-close" class="close">Close</button>
      </div>
    `;
    shadowRoot.appendChild(container);

    // 1. Fill Original Text
    const originalTextDiv = shadowRoot.getElementById('original-text');
    originalTextDiv.innerText = selectedText;

    // 2. Event Listeners
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