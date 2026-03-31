/**
 * Equavicle — Content Script (Google Docs)
 * 
 * Uses Google Docs' "Search the menus" shortcut (Alt+/) to reliably
 * open the equation editor, then types LaTeX into it.
 */

(function () {
  'use strict';

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'insertEquation') {
      handleInsertEquation(message.latex, sendResponse);
      return true; // keep channel open for async
    }
  });

  async function handleInsertEquation(latex, sendResponse) {
    try {
      // Step 1: Focus the Google Docs editor
      focusEditor();
      await sleep(200);

      // Step 2: Open equation editor via menu search
      const opened = await openEquationViaMenuSearch();
      if (!opened) {
        sendResponse({
          success: false,
          error: 'Could not open equation editor. Make sure you\'re in a Google Doc.'
        });
        return;
      }

      // Step 3: Wait for equation editor to fully initialize
      await sleep(800);

      // Step 4: Type the LaTeX
      await typeLatex(latex);

      sendResponse({ success: true });
    } catch (err) {
      console.error('[Equavicle]', err);
      sendResponse({ success: false, error: err.message });
    }
  }

  /**
   * Focus the Google Docs editing surface
   */
  function focusEditor() {
    // Google Docs uses an iframe for capturing text input
    const iframe = document.querySelector('iframe.docs-texteventtarget-iframe');
    if (iframe) {
      iframe.focus();
      if (iframe.contentDocument && iframe.contentDocument.body) {
        iframe.contentDocument.body.focus();
      }
    }
    // Also try clicking the editing canvas
    const canvas = document.querySelector('.kix-appview-editor');
    if (canvas) canvas.click();
  }

  /**
   * Get the target element for dispatching keyboard events.
   * Google Docs listens on the iframe's content document.
   */
  function getEventTarget() {
    const iframe = document.querySelector('iframe.docs-texteventtarget-iframe');
    if (iframe && iframe.contentDocument) {
      return iframe.contentDocument.body || iframe.contentDocument;
    }
    return document.activeElement || document.body;
  }

  /**
   * Open equation editor using Google Docs' "Search the menus" feature.
   * Shortcut: Alt+/ (opens a search box where you can type menu commands)
   */
  async function openEquationViaMenuSearch() {
    const target = getEventTarget();

    // Method 1: Alt+/ to open "Search the menus"
    dispatchKeyCombo(target, '/', { altKey: true, keyCode: 191 });
    await sleep(600);

    // Check if the search box appeared
    let searchBox = findMenuSearchBox();
    
    if (!searchBox) {
      // Method 2: Try Ctrl+/ (some Google Docs versions use this)
      dispatchKeyCombo(target, '/', { ctrlKey: true, keyCode: 191 });
      await sleep(600);
      searchBox = findMenuSearchBox();
    }

    if (!searchBox) {
      // Method 3: Try Alt+Shift+H (Help menu search in some versions)  
      dispatchKeyCombo(target, 'h', { altKey: true, shiftKey: true, keyCode: 72 });
      await sleep(600);
      searchBox = findMenuSearchBox();
    }

    if (!searchBox) {
      // Method 4: Direct menu click fallback
      return await openEquationViaDirectClick();
    }

    // Type "Equation" into the search box
    if (searchBox.tagName === 'INPUT' || searchBox.tagName === 'TEXTAREA') {
      searchBox.value = '';
      searchBox.focus();
      // Type each character with input events
      for (const char of 'Equation') {
        searchBox.value += char;
        searchBox.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(40);
      }
    } else {
      // ContentEditable or other element
      searchBox.focus();
      searchBox.textContent = '';
      for (const char of 'Equation') {
        dispatchCharEvent(searchBox, char);
        await sleep(40);
      }
    }

    await sleep(500);

    // Press Enter to select the "Equation" result
    dispatchKeyCombo(searchBox, 'Enter', { keyCode: 13 });
    await sleep(300);
    
    // Also try dispatching Enter on the target
    dispatchKeyCombo(target, 'Enter', { keyCode: 13 });
    await sleep(500);

    return true;
  }

  /**
   * Find the menu search box that appears after Alt+/
   */
  function findMenuSearchBox() {
    // Google Docs menu search uses various selectors depending on version
    const selectors = [
      'input[aria-label*="Search"]',
      'input[aria-label*="search"]',
      'input[aria-label*="menu"]',
      '.docs-explore-widget input',
      '.goog-menuheader input',
      '.docs-menubar input',
      'input.goog-flat-menu-button-caption',
      // The search box in the help menu
      'input[type="text"][aria-autocomplete]',
      'input[role="combobox"]',
      'input[aria-haspopup="listbox"]',
      // Broader selectors
      '.docs-omnibox-input',
      '.docs-menu-search input',
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && isVisible(el)) return el;
    }

    // Broader: find any recently-appeared input that's visible
    const allInputs = document.querySelectorAll('input[type="text"], input:not([type])');
    for (const input of allInputs) {
      if (isVisible(input) && !input.closest('.kix-appview-editor')) {
        return input;
      }
    }

    return null;
  }

  /**
   * Fallback: try to open equation editor by clicking through menus
   */
  async function openEquationViaDirectClick() {
    // Find the Insert menu
    const menuBar = document.querySelector('.docs-menubar, [role="menubar"]');
    if (!menuBar) return false;

    const menuItems = menuBar.querySelectorAll(
      '.docs-menu-button, .menu-button, [role="menuitem"], .goog-control'
    );

    let insertMenu = null;
    for (const item of menuItems) {
      const text = (item.textContent || '').trim();
      const label = item.getAttribute('aria-label') || '';
      if (text === 'Insert' || label.includes('Insert')) {
        insertMenu = item;
        break;
      }
    }

    if (!insertMenu) {
      // Try by ID
      insertMenu = document.querySelector('#docs-insert-menu');
    }

    if (!insertMenu) return false;

    // Click Insert menu
    insertMenu.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    insertMenu.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    insertMenu.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await sleep(500);

    // Find Equation in the dropdown
    const dropdownItems = document.querySelectorAll(
      '.goog-menuitem, [role="menuitem"], .docs-menuitem'
    );
    
    for (const item of dropdownItems) {
      const text = (item.textContent || '').trim();
      if (text === 'Equation' || text.startsWith('Equation')) {
        item.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        item.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        item.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await sleep(600);
        return true;
      }
    }

    // Close menu if we couldn't find Equation
    document.body.click();
    return false;
  }

  /**
   * Check if an element is visible on screen
   */
  function isVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  // ============================================================
  // TYPING LATEX INTO THE EQUATION EDITOR
  // ============================================================

  async function typeLatex(latex) {
    const target = getEventTarget();
    const tokens = tokenizeLatex(latex);

    for (const token of tokens) {
      if (token.type === 'command') {
        // Type \command then space to trigger conversion
        for (const char of token.value) {
          dispatchCharEvent(target, char);
          await sleep(25);
        }
        // Space triggers command conversion in GDocs equation editor
        dispatchCharEvent(target, ' ');
        await sleep(120);
      } else if (token.type === 'special') {
        dispatchCharEvent(target, token.value);
        await sleep(50);
      } else {
        // Regular characters
        for (const char of token.value) {
          dispatchCharEvent(target, char);
          await sleep(25);
        }
      }
    }
  }

  /**
   * Tokenize LaTeX into commands, special chars, and regular text
   */
  function tokenizeLatex(latex) {
    const tokens = [];
    let i = 0;

    while (i < latex.length) {
      if (latex[i] === '\\') {
        let cmd = '\\';
        i++;
        while (i < latex.length && /[a-zA-Z]/.test(latex[i])) {
          cmd += latex[i];
          i++;
        }
        if (cmd.length > 1) {
          tokens.push({ type: 'command', value: cmd });
        } else if (i < latex.length) {
          tokens.push({ type: 'char', value: latex[i] });
          i++;
        }
      } else if ('^_{}()[]'.includes(latex[i])) {
        tokens.push({ type: 'special', value: latex[i] });
        i++;
      } else if (latex[i] === ' ') {
        i++; // skip spaces
      } else {
        let text = '';
        while (i < latex.length && !'^_{}()[]\\'.includes(latex[i]) && latex[i] !== ' ') {
          text += latex[i];
          i++;
        }
        if (text) tokens.push({ type: 'char', value: text });
      }
    }

    return tokens;
  }

  // ============================================================
  // KEYBOARD EVENT HELPERS
  // ============================================================

  /**
   * Dispatch a single character keystroke (keydown → keypress → input → keyup)
   */
  function dispatchCharEvent(target, char) {
    const keyCode = char.charCodeAt(0);
    const opts = {
      key: char,
      code: getKeyCode(char),
      keyCode: keyCode,
      which: keyCode,
      charCode: keyCode,
      bubbles: true,
      cancelable: true,
      composed: true,
    };

    target.dispatchEvent(new KeyboardEvent('keydown', opts));
    target.dispatchEvent(new KeyboardEvent('keypress', opts));
    target.dispatchEvent(new InputEvent('beforeinput', {
      data: char, inputType: 'insertText', bubbles: true, cancelable: true, composed: true,
    }));
    target.dispatchEvent(new InputEvent('input', {
      data: char, inputType: 'insertText', bubbles: true,
    }));
    target.dispatchEvent(new KeyboardEvent('keyup', opts));
  }

  /**
   * Dispatch a key combo (like Alt+/, Ctrl+/, Enter)
   */
  function dispatchKeyCombo(target, key, opts = {}) {
    const keyCode = opts.keyCode || key.charCodeAt(0);
    const eventOpts = {
      key: key,
      code: getKeyCode(key),
      keyCode: keyCode,
      which: keyCode,
      charCode: 0,
      bubbles: true,
      cancelable: true,
      composed: true,
      altKey: opts.altKey || false,
      ctrlKey: opts.ctrlKey || false,
      shiftKey: opts.shiftKey || false,
      metaKey: opts.metaKey || false,
    };

    target.dispatchEvent(new KeyboardEvent('keydown', eventOpts));
    target.dispatchEvent(new KeyboardEvent('keypress', eventOpts));
    target.dispatchEvent(new KeyboardEvent('keyup', eventOpts));
  }

  /**
   * Map character to key code string
   */
  function getKeyCode(char) {
    const map = {
      '/': 'Slash', '\\': 'Backslash', ' ': 'Space',
      'Enter': 'Enter', '\n': 'Enter',
      '{': 'BracketLeft', '}': 'BracketRight',
      '[': 'BracketLeft', ']': 'BracketRight',
      '(': 'Digit9', ')': 'Digit0',
      '^': 'Digit6', '_': 'Minus',
      '+': 'Equal', '-': 'Minus', '=': 'Equal',
      '.': 'Period', ',': 'Comma',
    };
    if (map[char]) return map[char];
    if (/[a-zA-Z]/.test(char)) return `Key${char.toUpperCase()}`;
    if (/[0-9]/.test(char)) return `Digit${char}`;
    return `Key${char}`;
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  console.log('[Equavicle] Content script loaded on Google Docs');
})();
