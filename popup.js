/**
 * Equavicle — Popup Script
 * Parses LaTeX from pasted text, renders previews with KaTeX, and sends to content script
 */

(function () {
  'use strict';

  // DOM refs
  const latexInput = document.getElementById('latexInput');
  const parseBtn = document.getElementById('parseBtn');
  const clearBtn = document.getElementById('clearBtn');
  const results = document.getElementById('results');
  const resultsCount = document.getElementById('resultsCount');
  const equationsList = document.getElementById('equationsList');
  const emptyState = document.getElementById('emptyState');
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');
  const modeAutoType = document.getElementById('modeAutoType');
  const modeCopy = document.getElementById('modeCopy');

  let currentMode = 'autotype'; // 'autotype' | 'copy'
  let extractedEquations = [];

  // ---- Mode Toggle ----
  modeAutoType.addEventListener('click', () => setMode('autotype'));
  modeCopy.addEventListener('click', () => setMode('copy'));

  function setMode(mode) {
    currentMode = mode;
    modeAutoType.classList.toggle('active', mode === 'autotype');
    modeCopy.classList.toggle('active', mode === 'copy');
    if (extractedEquations.length > 0) {
      renderEquations(extractedEquations);
    }
  }

  // ---- Parse Button ----
  parseBtn.addEventListener('click', () => {
    const text = latexInput.value.trim();
    if (!text) {
      showToast('Paste some text first', true);
      return;
    }
    extractedEquations = extractLatex(text);
    if (extractedEquations.length === 0) {
      showToast('No LaTeX equations found', true);
      return;
    }
    renderEquations(extractedEquations);
  });

  // ---- Clear Button ----
  clearBtn.addEventListener('click', () => {
    latexInput.value = '';
    extractedEquations = [];
    equationsList.innerHTML = '';
    results.classList.add('hidden');
    emptyState.classList.remove('hidden');
  });

  // ---- Extract LaTeX ----
  function extractLatex(text) {
    const equations = [];
    const patterns = [
      { regex: /\$\$([\s\S]*?)\$\$/g, type: 'display' },
      { regex: /\\\[([\s\S]*?)\\\]/g, type: 'display' },
      { regex: /(?<!\$)\$(?!\$)((?:[^$\\]|\\.)+)\$(?!\$)/g, type: 'inline' },
      { regex: /\\\(([\s\S]*?)\\\)/g, type: 'inline' },
    ];

    const found = new Set();

    for (const { regex, type } of patterns) {
      let match;
      while ((match = regex.exec(text)) !== null) {
        const raw = match[1].trim();
        if (raw && !found.has(raw)) {
          found.add(raw);
          equations.push({
            raw,
            cleaned: cleanForGDocs(raw),
            type,
          });
        }
      }
    }

    return equations;
  }

  // ---- Clean LaTeX for Google Docs Equation Editor ----
  function cleanForGDocs(latex) {
    let cleaned = latex;

    cleaned = cleaned.replace(/\\(displaystyle|textstyle|scriptstyle|scriptscriptstyle)\s*/g, '');
    cleaned = cleaned.replace(/\\left\s*/g, '');
    cleaned = cleaned.replace(/\\right\s*/g, '');
    cleaned = cleaned.replace(/\\text\{([^}]*)\}/g, '$1');
    cleaned = cleaned.replace(/\\mathrm\{([^}]*)\}/g, '$1');
    cleaned = cleaned.replace(/\\mathbf\{([^}]*)\}/g, '$1');
    cleaned = cleaned.replace(/\\mathit\{([^}]*)\}/g, '$1');
    cleaned = cleaned.replace(/\\overrightarrow\{([^}]*)\}/g, '$1');
    cleaned = cleaned.replace(/\\boxed\{([^}]*)\}/g, '$1');
    cleaned = cleaned.replace(/\\(quad|qquad)/g, ' ');
    cleaned = cleaned.replace(/\\[,;:!]/g, ' ');
    cleaned = cleaned.replace(/\\cdots/g, '...');
    cleaned = cleaned.replace(/\\ldots/g, '...');
    cleaned = cleaned.replace(/\\div/g, '÷');
    cleaned = cleaned.replace(/\\times/g, '×');
    cleaned = cleaned.replace(/\s{2,}/g, ' ');

    return cleaned.trim();
  }

  // ---- Render Equations with KaTeX ----
  function renderEquations(equations) {
    emptyState.classList.add('hidden');
    results.classList.remove('hidden');
    resultsCount.textContent = `${equations.length} equation${equations.length > 1 ? 's' : ''} found`;
    equationsList.innerHTML = '';

    equations.forEach((eq, i) => {
      const card = document.createElement('div');
      card.className = 'equation-card';
      card.style.animationDelay = `${i * 40}ms`;

      // Render KaTeX preview
      let renderedHtml;
      try {
        renderedHtml = katex.renderToString(eq.raw, {
          displayMode: eq.type === 'display',
          throwOnError: false,
          errorColor: '#EF4444',
          trust: true,
        });
      } catch (e) {
        renderedHtml = `<span style="color:#EF4444;font-size:12px;">Render error: ${escapeHtml(e.message)}</span>`;
      }

      card.innerHTML = `
        <div class="eq-header">
          <span class="eq-index">Eq ${i + 1}</span>
          <span class="eq-type">${eq.type}</span>
        </div>
        <div class="eq-preview">${renderedHtml}</div>
        <div class="eq-raw" title="Click to expand">${escapeHtml(eq.raw)}</div>
        <div class="eq-actions">
          ${currentMode === 'autotype'
            ? `<button class="btn btn-insert" data-index="${i}">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="4 7 4 4 20 4 20 7"></polyline>
                  <line x1="9" y1="20" x2="15" y2="20"></line>
                  <line x1="12" y1="4" x2="12" y2="20"></line>
                </svg>
                Auto-Type
              </button>`
            : ''
          }
          <button class="btn btn-copy" data-index="${i}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            Copy
          </button>
        </div>
      `;

      equationsList.appendChild(card);
    });

    bindCardActions();
  }

  // ---- Bind Card Actions ----
  function bindCardActions() {
    document.querySelectorAll('.btn-copy').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.dataset.index);
        const eq = extractedEquations[idx];
        copyToClipboard(eq.cleaned);
        e.currentTarget.classList.add('copied');
        const svgEl = e.currentTarget.querySelector('svg');
        if (svgEl) svgEl.style.display = 'none';
        const textNode = e.currentTarget.lastChild;
        const origText = textNode.textContent;
        textNode.textContent = ' Copied!';
        showToast('Copied to clipboard');
        setTimeout(() => {
          e.currentTarget.classList.remove('copied');
          if (svgEl) svgEl.style.display = '';
          textNode.textContent = origText;
        }, 1500);
      });
    });

    document.querySelectorAll('.btn-insert').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const idx = parseInt(e.currentTarget.dataset.index);
        const eq = extractedEquations[idx];
        await sendToContentScript(eq.cleaned);
      });
    });
  }

  // ---- Send to Content Script ----
  async function sendToContentScript(cleanedLatex) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url || !tab.url.includes('docs.google.com')) {
        showToast('Open a Google Doc first', true);
        return;
      }

      chrome.tabs.sendMessage(tab.id, {
        action: 'insertEquation',
        latex: cleanedLatex,
      }, (response) => {
        if (chrome.runtime.lastError) {
          showToast('Refresh the Google Doc and try again', true);
          return;
        }
        if (response && response.success) {
          showToast('Equation inserted!');
        } else {
          showToast(response?.error || 'Insert failed', true);
        }
      });
    } catch (err) {
      showToast('Error: ' + err.message, true);
    }
  }

  // ---- Copy to Clipboard ----
  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  }

  // ---- Toast ----
  let toastTimer;
  function showToast(msg, isError = false) {
    clearTimeout(toastTimer);
    toastMsg.textContent = msg;
    toast.classList.remove('hidden', 'error');
    if (isError) toast.classList.add('error');
    void toast.offsetWidth;
    toast.classList.add('show');
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.classList.add('hidden'), 300);
    }, 2500);
  }

  // ---- Util ----
  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ---- Auto-parse on paste ----
  latexInput.addEventListener('paste', () => {
    setTimeout(() => parseBtn.click(), 100);
  });

})();
