// Prevent duplicate listeners if injected multiple times
if (!window.hasRun) {
  window.hasRun = true;

  let shadowRoot = null;
  let hostElement = null;

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "open_modal") {
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
        
        /* Dimensions */
        width: 50vw;       
        height: 50vh;      
        min-width: 600px;
        min-height: 400px; 
        max-width: 95vw;
        max-height: 95vh;
        
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        display: flex; flex-direction: column; gap: 10px;
        color: #333;
        box-sizing: border-box;
      }
      
      /* HEADER ROW (Title + X) */
      .header-row {
        display: flex; justify-content: space-between; align-items: center;
        margin-bottom: 5px;
      }
      h2 { margin: 0; font-size: 18px; color: #222; }
      
      /* Close "X" Button Styling */
      .close-icon {
        background: transparent; border: none; font-size: 24px; 
        color: #999; cursor: pointer; line-height: 1; padding: 0;
      }
      .close-icon:hover { color: #333; }

      /* INPUT ROW (Recipient + Tone + Button) */
      .input-row {
        display: flex; gap: 15px; 
        align-items: flex-end; /* Aligns inputs and button on the bottom baseline */
      }
      .input-group { display: flex; flex-direction: column; }
      
      /* Flex weights for inputs */
      .input-recipient { flex: 3; }
      .input-tone { flex: 2; }

      label { font-size: 12px; font-weight: bold; color: #555; margin-bottom: 4px; }
      
      input, select {
        width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;
        box-sizing: border-box; font-size: 14px; height: 36px;
      }

      /* Primary Button Styling */
      button#btn-rephrase {
        background: #007bff; color: white; border: none; padding: 0 20px;
        border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: bold;
        height: 36px; /* Match input height */
        white-space: nowrap;
      }
      button#btn-rephrase:hover { background: #0056b3; }

      /* CONTENT AREA (Side-by-Side) */
      .grid-row {
        display: flex; gap: 15px; margin-top: 5px;
        flex: 1; min-height: 0;
      }
      .col {
        flex: 1; display: flex; flex-direction: column; min-width: 0;
      }
      .text-box {
        padding: 10px; border-radius: 4px; 
        flex: 1; height: 100%; 
        overflow-y: auto; white-space: pre-wrap; 
        font-size: 13px; line-height: 1.4; box-sizing: border-box; width: 100%;
      }
      .original { background: #fff; border: 1px dashed #ccc; color: #555; }
      .result { background: #f8f9fa; border: 1px solid #e9ecef; color: #333; }
      .error { color: #dc3545; font-size: 12px; }
    `;
    shadowRoot.appendChild(style);

    const container = document.createElement('div');
    container.className = 'overlay';
    container.innerHTML = `
      <div class="modal">
        
        <!-- Header Row: Title & X Button -->
        <div class="header-row">
           <h2>Rephrase Text</h2>
           <button id="btn-close-x" class="close-icon">&times;</button>
        </div>
        
        <!-- Input Row: Recipient, Tone, and Rephrase Button -->
        <div class="input-row">
          <div class="input-group input-recipient">
            <label>Recipient</label>
            <input type="text" id="recipient" placeholder="e.g. Boss, Client">
          </div>
          
          <div class="input-group input-tone">
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
        </div>

        <!-- Content Row -->
        <div class="grid-row">
            <div class="col">
                <label>Original</label>
                <div id="original-text" class="text-box original"></div>
            </div>

            <div class="col">
                <label>Rephrased</label>
                <div id="result" class="text-box result"></div>
            </div>
        </div>
      </div>
    `;
    shadowRoot.appendChild(container);

    const originalTextDiv = shadowRoot.getElementById('original-text');
    originalTextDiv.innerText = selectedText;

    // Use the new X button ID
    shadowRoot.getElementById('btn-close-x').onclick = () => hostElement.remove();
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