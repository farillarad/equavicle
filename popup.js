/**
 * Equavicle — Popup Script
 * Parses LaTeX from pasted text, renders previews with KaTeX, and sends to content script
 */

(function () {
  'use strict';

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

  let currentMode = 'autotype';
  let extractedEquations = [];

  // ---- Mode Toggle ----
  modeAutoType.addEventListener('click', () => setMode('autotype'));
  modeCopy.addEventListener('click', () => setMode('copy'));

  function setMode(mode) {
    currentMode = mode;
    modeAutoType.classList.toggle('active', mode === 'autotype');
    modeCopy.classList.toggle('active', mode === 'copy');
    if (extractedEquations.length > 0) renderEquations(extractedEquations);
  }

  // ---- Parse Button ----
  parseBtn.addEventListener('click', () => {
    const text = latexInput.value.trim();
    if (!text) { showToast('Paste some text first', true); return; }
    extractedEquations = extractLatex(text);
    if (extractedEquations.length === 0) { showToast('No LaTeX equations found', true); return; }
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

  // ============================================================
  // LATEX EXTRACTION — Left-to-right single-pass tokenizer
  // Handles consecutive inline equations correctly ($eq1$$eq2$)
  // ============================================================
  function extractLatex(text) {
    const equations = [];
    const found = new Set();
    let i = 0;

    function addEq(raw, type) {
      raw = raw.trim();
      if (raw && !found.has(raw)) {
        found.add(raw);
        equations.push({ raw, cleaned: cleanForGDocs(raw), type });
      }
    }

    while (i < text.length) {
      // --- \[...\] display math ---
      if (text[i] === '\\' && text[i + 1] === '[') {
        const close = text.indexOf('\\]', i + 2);
        if (close !== -1) {
          addEq(text.substring(i + 2, close), 'display');
          i = close + 2;
          continue;
        }
      }

      // --- \(...\) inline math ---
      if (text[i] === '\\' && text[i + 1] === '(') {
        const close = text.indexOf('\\)', i + 2);
        if (close !== -1) {
          addEq(text.substring(i + 2, close), 'inline');
          i = close + 2;
          continue;
        }
      }

      // --- Dollar sign math ---
      if (text[i] === '$') {
        if (text[i + 1] === '$') {
          // Potential $$...$$ display math
          // Check that this is a "true" display delimiter:
          // The $$ should be preceded by whitespace/newline/start OR we're confident it's display
          const before = i > 0 ? text[i - 1] : '\n';
          const isStartOfLine = (before === '\n' || before === '\r' || i === 0);
          const isPrecededByWhitespace = /[\s:;,.!?]/.test(before) || i === 0;

          if (isStartOfLine || isPrecededByWhitespace) {
            // Look for closing $$
            const close = findClosingDoubleDollar(text, i + 2);
            if (close !== -1) {
              addEq(text.substring(i + 2, close), 'display');
              i = close + 2;
              continue;
            }
          }
          // If not a true display delimiter, fall through to single $ handling
        }

        // Single $ inline math — find the matching closing $
        const close = findClosingSingleDollar(text, i + 1);
        if (close !== -1 && close > i + 1) {
          addEq(text.substring(i + 1, close), 'inline');
          i = close + 1;
          continue;
        }
      }

      i++;
    }

    return equations;
  }

  /**
   * Find closing $$ for display math, starting from position `start`.
   * Scans for the next $$ that looks like a closing delimiter.
   */
  function findClosingDoubleDollar(text, start) {
    let i = start;
    while (i < text.length - 1) {
      if (text[i] === '\\') {
        i += 2; // skip escaped characters
        continue;
      }
      if (text[i] === '$' && text[i + 1] === '$') {
        return i;
      }
      i++;
    }
    return -1;
  }

  /**
   * Find closing single $ for inline math.
   * Skips escaped \$ and stops at the first unescaped $.
   * Won't match across paragraph boundaries (double newlines).
   */
  function findClosingSingleDollar(text, start) {
    let i = start;
    while (i < text.length) {
      if (text[i] === '\\') {
        i += 2; // skip escaped characters
        continue;
      }
      if (text[i] === '$') {
        return i;
      }
      // Don't match across paragraph boundaries
      if (text[i] === '\n' && i + 1 < text.length && text[i + 1] === '\n') {
        return -1;
      }
      i++;
    }
    return -1;
  }

  // ============================================================
  // CLEAN LATEX FOR GOOGLE DOCS EQUATION EDITOR
  // ============================================================
  function cleanForGDocs(latex) {
    let c = latex;

    // Remove styling commands GDocs doesn't understand
    c = c.replace(/\\(displaystyle|textstyle|scriptstyle|scriptscriptstyle)\s*/g, '');
    c = c.replace(/\\left\s*/g, '');
    c = c.replace(/\\right\s*/g, '');

    // Text-style commands → just content
    c = c.replace(/\\text\{([^}]*)\}/g, '$1');
    c = c.replace(/\\mathrm\{([^}]*)\}/g, '$1');
    c = c.replace(/\\mathbf\{([^}]*)\}/g, '$1');
    c = c.replace(/\\mathit\{([^}]*)\}/g, '$1');
    c = c.replace(/\\overrightarrow\{([^}]*)\}/g, '$1');
    c = c.replace(/\\boxed\{([^}]*)\}/g, '$1');

    // Spacing commands → space
    c = c.replace(/\\(quad|qquad)/g, ' ');
    c = c.replace(/\\[,;:!]/g, ' ');

    // Dots
    c = c.replace(/\\cdots/g, '...');
    c = c.replace(/\\ldots/g, '...');

    // Clean multiple spaces
    c = c.replace(/\s{2,}/g, ' ');

    return c.trim();
  }

  // ============================================================
  // RENDER EQUATIONS
  // ============================================================
  function renderEquations(equations) {
    emptyState.classList.add('hidden');
    results.classList.remove('hidden');
    resultsCount.textContent = `${equations.length} equation${equations.length > 1 ? 's' : ''} found`;
    equationsList.innerHTML = '';

    equations.forEach((eq, i) => {
      const card = document.createElement('div');
      card.className = 'equation-card';
      card.style.animationDelay = `${i * 40}ms`;

      let renderedHtml;
      try {
        renderedHtml = katex.renderToString(eq.raw, {
          displayMode: eq.type === 'display',
          throwOnError: false,
          errorColor: '#EF4444',
          trust: true,
        });
      } catch (e) {
        renderedHtml = `<span style="color:#EF4444;font-size:11px;">Error: ${escapeHtml(e.message)}</span>`;
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

  // ---- Card Actions ----
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

  // ---- Content Script Communication ----
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

  // ---- Clipboard ----
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

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Auto-parse on paste
  latexInput.addEventListener('paste', () => {
    setTimeout(() => parseBtn.click(), 150);
  });

})();
