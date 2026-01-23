(function () {
  const app = window.rephraser || {};
  window.rephraser = app;
  app.ui = app.ui || {};

  function createAndShowModal(selectedText) {
    const state = app.state;
    if (state.hostElement) state.hostElement.remove();

    state.hostElement = document.createElement('div');
    document.body.appendChild(state.hostElement);
    state.shadowRoot = state.hostElement.attachShadow({ mode: 'open' });

    app.ui.appendStyles(state.shadowRoot);

    const container = document.createElement('div');
    container.className = 'overlay';
    container.innerHTML = `
      <div class="modal">

        <!-- Header Row: Title & X Button -->
        <div class="header-row">
           <h2>Rephrase with AI</h2>
           <button id="btn-close-x" class="close-icon">&times;</button>
        </div>

        <!-- Input Row: Recipient, Tone, Model, and Rephrase Button -->
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

          <div class="input-group input-model">
            <label>Model</label>
            <select id="model">
              <option value="gpt-5-mini" selected>GPT-5-mini — fast, cost-effective</option>
              <option value="gpt-5">GPT-5 — highest quality, expensive</option>
              <option value="gpt-5-nano">GPT-5-nano — ultra-fast, low cost</option>
              <option value="gpt-4.1">GPT-4.1 — strong reasoning</option>
              <option value="gpt-4.1-mini">GPT-4.1-mini — balanced price/perf</option>
              <option value="gpt-4.1-nano">GPT-4.1-nano — lightweight, low cost</option>
              <option value="gpt-4o">GPT-4o — flagship multimodal</option>
              <option value="gpt-4o-mini">GPT-4o-mini — small, affordable</option>
              <option value="gpt-3.5-turbo">GPT-3.5 Turbo — legacy, low cost</option>
            </select>
          </div>

          <button id="btn-rephrase">Rephrase</button>
        </div>

        <div class="input-group">
          <label>Context</label>
          <textarea id="context" placeholder="e.g. Purpose of the text: 'Rephrase for college application'"></textarea>
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
    state.shadowRoot.appendChild(container);

    const originalTextDiv = state.shadowRoot.getElementById('original-text');
    originalTextDiv.innerText = selectedText;

    state.shadowRoot.getElementById('btn-close-x').onclick = () => state.hostElement.remove();
    container.onclick = (e) => { if (e.target === container) state.hostElement.remove(); };

    const resultDiv = state.shadowRoot.getElementById('result');

    state.shadowRoot.getElementById('btn-rephrase').onclick = () => {
      const recipient = state.shadowRoot.getElementById('recipient').value;
      const tone = state.shadowRoot.getElementById('tone').value;
      const model = state.shadowRoot.getElementById('model').value;
      const context = state.shadowRoot.getElementById('context').value;

      resultDiv.innerText = "Generating...";

      chrome.runtime.sendMessage({
        action: "call_openai",
        text: selectedText,
        recipient: recipient,
        tone: tone,
        model: model,
        context: context
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

  app.ui.createAndShowModal = createAndShowModal;
})();
