(function () {
  const app = window.rephraser || {};
  window.rephraser = app;
  app.ui = app.ui || {};

  function createAndShowSummaryModal(payload) {
    const pageText = (payload && payload.text) || '';
    const pageTitle = (payload && payload.title) || 'Untitled page';
    const pageUrl = (payload && payload.url) || '';
    const isTruncated = Boolean(payload && payload.truncated);
    const fullLength = (payload && payload.length) || 0;
    const isSelection = Boolean(payload && payload.isSelection);

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
        <div class="header-row">
           <h2>Summarize page</h2>
           <button id="btn-close-summary" class="close-icon">&times;</button>
        </div>
        <div class="input-row">
          <div class="input-group input-model">
            <label>Model</label>
            <select id="summary-model">
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
          <div class="input-group input-sentences">
            <label>Max sentences</label>
            <select id="summary-sentences">
              <option value="1" selected>1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5</option>
            </select>
          </div>
          <button id="btn-summarize" class="btn-primary">Summarize</button>
        </div>
        <div class="meta">
          <div class="meta-row"><strong>Title:</strong> <span id="summary-title"></span></div>
          <div class="meta-row"><strong>URL:</strong> <a id="summary-url" href="#" target="_blank" rel="noreferrer"></a></div>
          <div id="summary-truncated" class="notice" style="display:none;"></div>
        </div>
        <div class="grid-row">
            <div class="col">
                <label>Page content</label>
                <div id="page-text" class="text-box original"></div>
            </div>

            <div class="col">
                <label>Summary</label>
                <div id="summary-result" class="text-box result"></div>
            </div>
        </div>
      </div>
    `;
    state.shadowRoot.appendChild(container);

    const pageTextDiv = state.shadowRoot.getElementById('page-text');
    pageTextDiv.innerText = pageText || 'No readable content found on this page.';
    const titleSpan = state.shadowRoot.getElementById('summary-title');
    const urlLink = state.shadowRoot.getElementById('summary-url');
    const truncatedNotice = state.shadowRoot.getElementById('summary-truncated');
    titleSpan.textContent = pageTitle;
    if (pageUrl) {
      urlLink.textContent = pageUrl;
      urlLink.href = pageUrl;
    } else {
      urlLink.textContent = 'Unknown';
      urlLink.removeAttribute('href');
    }
    if (isSelection) {
      truncatedNotice.textContent = "Summarizing the selected text only.";
      truncatedNotice.style.display = 'block';
    } else if (isTruncated) {
      truncatedNotice.textContent = `Page is too long. Showing the first ${app.constants.MAX_SUMMARY_CHARS.toLocaleString()} of ${fullLength.toLocaleString()} characters for summary.`;
      truncatedNotice.style.display = 'block';
    }

    const resultDiv = state.shadowRoot.getElementById('summary-result');
    state.shadowRoot.getElementById('btn-close-summary').onclick = () => state.hostElement.remove();
    container.onclick = (e) => { if (e.target === container) state.hostElement.remove(); };

    state.shadowRoot.getElementById('btn-summarize').onclick = () => {
      if (!pageText) {
        resultDiv.innerHTML = `<span class="error">No readable content found to summarize.</span>`;
        return;
      }
      const model = state.shadowRoot.getElementById('summary-model').value;
      const maxSentences = Number(state.shadowRoot.getElementById('summary-sentences').value) || 1;
      resultDiv.innerText = "Generating summary...";
      chrome.runtime.sendMessage({
        action: "call_openai_summary",
        text: pageText,
        title: pageTitle,
        url: pageUrl,
        model,
        maxSentences
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

  app.ui.createAndShowSummaryModal = createAndShowSummaryModal;
})();
