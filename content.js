/**
 * Equavicle — Content Script (Google Docs)
 * Handles auto-typing LaTeX into the Google Docs equation editor.
 */

(function () {
  'use strict';

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'insertEquation') {
      handleInsertEquation(message.latex, sendResponse);
      return true;
    }
  });

  async function handleInsertEquation(latex, sendResponse) {
    try {
      const opened = await openEquationEditor();
      if (!opened) {
        sendResponse({
          success: false,
          error: 'Could not open equation editor. Open Insert > Equation first, then click Auto-Type again.'
        });
        return;
      }

      await sleep(600);
      await typeLatex(latex);
      sendResponse({ success: true });
    } catch (err) {
      sendResponse({ success: false, error: err.message });
    }
  }

  /**
   * Try to open the equation editor through Google Docs menu system
   */
  async function openEquationEditor() {
    // Strategy 1: Check if equation editor is already open
    if (isEquationEditorOpen()) {
      return true;
    }

    // Strategy 2: Click through Insert > Equation menu
    // Google Docs uses various selector patterns depending on version
    const menuSelectors = [
      '#docs-insert-menu',                         // Classic ID
      '[id="docs-insert-menu"]',
      '.menu-button[aria-label="Insert"]',
      '.docs-menubar-menu[aria-label="Insert"]',
      'div[role="menuitem"][aria-label="Insert"]',
    ];

    let insertMenu = null;
    for (const sel of menuSelectors) {
      insertMenu = document.querySelector(sel);
      if (insertMenu) break;
    }

    // Fallback: search by text content
    if (!insertMenu) {
      const allMenus = document.querySelectorAll(
        '.menu-button, .docs-menubar-menu, [role="menubar"] > [role="menuitem"], .goog-control'
      );
      for (const el of allMenus) {
        const text = el.textContent?.trim();
        if (text === 'Insert' || text === 'insert') {
          insertMenu = el;
          break;
        }
      }
    }

    if (!insertMenu) {
      return false;
    }

    // Click the Insert menu
    insertMenu.click();
    await sleep(500);

    // Now find Equation in the dropdown
    const subMenuSelectors = [
      '.goog-menuitem',
      '[role="menuitem"]',
      '.docs-menuitem',
      '.goog-menuitem-content',
    ];

    let equationItem = null;
    for (const sel of subMenuSelectors) {
      const items = document.querySelectorAll(sel);
      for (const item of items) {
        const text = item.textContent?.trim();
        if (text && (text === 'Equation' || text.startsWith('Equation'))) {
          equationItem = item;
          break;
        }
      }
      if (equationItem) break;
    }

    if (!equationItem) {
      // Close the menu since we couldn't find Equation
      document.body.click();
      return false;
    }

    equationItem.click();
    await sleep(700);

    return true;
  }

  /**
   * Check if equation editor toolbar is currently visible
   */
  function isEquationEditorOpen() {
    const selectors = [
      '.docs-equation-toolbar',
      '[class*="equation-toolbar"]',
      '[class*="equation"][class*="bar"]',
      '.equation-toolbar',
    ];
    for (const sel of selectors) {
      if (document.querySelector(sel)) return true;
    }
    return false;
  }

  /**
   * Type LaTeX into the equation editor via keyboard events
   */
  async function typeLatex(latex) {
    // Google Docs captures keyboard input through a special iframe
    const iframe = document.querySelector('iframe.docs-texteventtarget-iframe');
    let eventTarget;

    if (iframe && iframe.contentDocument) {
      eventTarget = iframe.contentDocument.body || iframe.contentDocument;
    } else {
      eventTarget = document.activeElement || document.body;
    }

    const tokens = tokenizeLatex(latex);

    for (const token of tokens) {
      if (token.type === 'command') {
        // Type \command then space to trigger conversion
        for (const char of token.value) {
          dispatchKey(eventTarget, char);
          await sleep(20);
        }
        dispatchKey(eventTarget, ' ');
        await sleep(100);
      } else if (token.type === 'special') {
        dispatchKey(eventTarget, token.value);
        await sleep(40);
      } else {
        for (const char of token.value) {
          dispatchKey(eventTarget, char);
          await sleep(20);
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
        } else {
          if (i < latex.length) {
            tokens.push({ type: 'char', value: latex[i] });
            i++;
          }
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

  /**
   * Dispatch keyboard event for a single character
   */
  function dispatchKey(target, char) {
    const keyCode = char.charCodeAt(0);

    const opts = {
      key: char,
      code: char === ' ' ? 'Space' : `Key${char.toUpperCase()}`,
      keyCode,
      which: keyCode,
      charCode: keyCode,
      bubbles: true,
      cancelable: true,
      composed: true,
    };

    target.dispatchEvent(new KeyboardEvent('keydown', opts));
    target.dispatchEvent(new KeyboardEvent('keypress', opts));
    target.dispatchEvent(new InputEvent('beforeinput', {
      data: char,
      inputType: 'insertText',
      bubbles: true,
      cancelable: true,
      composed: true,
    }));
    target.dispatchEvent(new InputEvent('input', {
      data: char,
      inputType: 'insertText',
      bubbles: true,
    }));
    target.dispatchEvent(new KeyboardEvent('keyup', opts));
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  console.log('[Equavicle] Content script loaded');
})();
