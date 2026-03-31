/**
 * Equavicle — Content Script (Google Docs)
 * Handles auto-typing LaTeX into the Google Docs equation editor.
 *
 * Strategy:
 *   1. Open equation editor via the Insert > Equation menu
 *   2. Wait for the equation input box to appear
 *   3. Type the cleaned LaTeX character by character with small delays
 *      (Google Docs equation editor interprets LaTeX-like commands on space/enter)
 */

(function () {
  'use strict';

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'insertEquation') {
      handleInsertEquation(message.latex, sendResponse);
      return true; // keep channel open for async response
    }
  });

  /**
   * Main handler: opens equation editor and types in the LaTeX
   */
  async function handleInsertEquation(latex, sendResponse) {
    try {
      // Step 1: Open the equation editor
      const opened = await openEquationEditor();
      if (!opened) {
        sendResponse({ success: false, error: 'Could not open equation editor — try Insert > Equation manually first' });
        return;
      }

      // Step 2: Wait for the equation input to be ready
      await sleep(500);

      // Step 3: Type the LaTeX into the equation editor
      await typeLatex(latex);

      sendResponse({ success: true });
    } catch (err) {
      sendResponse({ success: false, error: err.message });
    }
  }

  /**
   * Opens the equation editor via menu navigation.
   * Tries multiple approaches.
   */
  async function openEquationEditor() {
    // Approach 1: Use keyboard shortcut to open Insert menu
    // There's no universal shortcut for equation editor, so we navigate menus

    // Approach 2: Click Insert menu → Equation
    const insertMenu = findMenuItem('Insert');
    if (insertMenu) {
      insertMenu.click();
      await sleep(400);

      const equationMenuItem = findSubMenuItem('Equation');
      if (equationMenuItem) {
        equationMenuItem.click();
        await sleep(600);
        return true;
      }
    }

    // Approach 3: Try finding the equation toolbar if already visible
    const equationInput = findEquationInput();
    if (equationInput) {
      equationInput.focus();
      return true;
    }

    return false;
  }

  /**
   * Find a top-level menu item by text
   */
  function findMenuItem(text) {
    // Google Docs menu items are in the menu bar
    const menuItems = document.querySelectorAll(
      '.menu-button, .docs-menu-button, [role="menuitem"], .docs-menubar-menu'
    );
    for (const item of menuItems) {
      const label = item.textContent?.trim() || item.getAttribute('aria-label') || '';
      if (label === text || label.startsWith(text)) {
        return item;
      }
    }
    // Try by ID patterns Google Docs uses
    const byId = document.querySelector('#docs-insert-menu, [id*="insert"][id*="menu"]');
    if (byId) return byId;

    return null;
  }

  /**
   * Find a submenu item by text (after menu is open)
   */
  function findSubMenuItem(text) {
    // Google Docs renders dropdown menus with these selectors
    const items = document.querySelectorAll(
      '.goog-menuitem, [role="menuitem"], .docs-menuitem'
    );
    for (const item of items) {
      const label = item.textContent?.trim() || '';
      if (label.includes(text)) {
        return item;
      }
    }
    return null;
  }

  /**
   * Find the equation editor input element
   */
  function findEquationInput() {
    // The equation editor creates an editable area — look for it
    const candidates = document.querySelectorAll(
      '.docs-equation-input, [class*="equation"] input, [class*="equation"] [contenteditable], .kix-equation-editor-textinput'
    );
    return candidates[0] || null;
  }

  /**
   * Find the active editable element that's inside an equation context
   */
  function findActiveEquationElement() {
    // When the equation editor is active, the focused element is usually
    // an iframe or a contenteditable within the equation toolbar area.
    // We can also look for the equation toolbar
    const toolbar = document.querySelector(
      '.docs-equation-toolbar, [class*="equation-toolbar"], [class*="equation"][class*="bar"]'
    );

    if (toolbar) {
      const input = toolbar.querySelector('input, [contenteditable="true"], textarea');
      if (input) return input;
    }

    // Fall back to the currently focused element if it seems equation-related
    const active = document.activeElement;
    if (active && active !== document.body) {
      return active;
    }

    // Try iframes (Google Docs sometimes uses them)
    const iframes = document.querySelectorAll('iframe.docs-texteventtarget-iframe');
    if (iframes.length > 0) {
      return iframes[0];
    }

    return null;
  }

  /**
   * Type LaTeX string into the equation editor, character by character.
   * Google Docs equation editor processes commands when you type
   * a backslash-command followed by space.
   */
  async function typeLatex(latex) {
    const target = findActiveEquationElement();
    if (!target) {
      // If we can't find a specific element, dispatch to the focused iframe
      await typeViaKeyboardEvents(latex);
      return;
    }

    await typeViaKeyboardEvents(latex, target);
  }

  /**
   * Dispatches keyboard events to simulate typing.
   * This is the core mechanism — Google Docs intercepts keyboard events
   * through its iframe-based input system.
   */
  async function typeViaKeyboardEvents(text, target) {
    // Google Docs uses an iframe for text input capture
    const iframe = document.querySelector('iframe.docs-texteventtarget-iframe');
    let eventTarget;

    if (iframe && iframe.contentDocument) {
      eventTarget = iframe.contentDocument.body || iframe.contentDocument;
    } else if (target) {
      eventTarget = target;
    } else {
      eventTarget = document.activeElement || document.body;
    }

    // Parse the LaTeX into tokens for smarter typing
    const tokens = tokenizeLatex(text);

    for (const token of tokens) {
      if (token.type === 'command') {
        // Type the backslash-command, then space to trigger conversion
        for (const char of token.value) {
          dispatchKeyEvent(eventTarget, char);
          await sleep(15);
        }
        // Space triggers the command conversion in GDocs equation editor
        dispatchKeyEvent(eventTarget, ' ');
        await sleep(80);
      } else if (token.type === 'special') {
        // Special characters: ^, _, {, }
        dispatchKeyEvent(eventTarget, token.value);
        await sleep(30);
      } else {
        // Regular characters
        for (const char of token.value) {
          dispatchKeyEvent(eventTarget, char);
          await sleep(15);
        }
      }
    }
  }

  /**
   * Tokenize LaTeX into meaningful chunks for typing:
   * - \commands (typed then followed by space)
   * - Special chars: ^, _, {, }
   * - Regular text
   */
  function tokenizeLatex(latex) {
    const tokens = [];
    let i = 0;

    while (i < latex.length) {
      if (latex[i] === '\\') {
        // Read the full command: \word
        let cmd = '\\';
        i++;
        while (i < latex.length && /[a-zA-Z]/.test(latex[i])) {
          cmd += latex[i];
          i++;
        }
        if (cmd.length > 1) {
          tokens.push({ type: 'command', value: cmd });
        } else {
          // Lone backslash or \{special}
          if (i < latex.length) {
            tokens.push({ type: 'char', value: latex[i] });
            i++;
          }
        }
      } else if ('^_{}()[]'.includes(latex[i])) {
        tokens.push({ type: 'special', value: latex[i] });
        i++;
      } else if (latex[i] === ' ') {
        // Skip excess spaces
        i++;
      } else {
        // Accumulate regular chars
        let text = '';
        while (i < latex.length && !'^_{}()[]\\'.includes(latex[i]) && latex[i] !== ' ') {
          text += latex[i];
          i++;
        }
        if (text) {
          tokens.push({ type: 'char', value: text });
        }
      }
    }

    return tokens;
  }

  /**
   * Dispatch a single key event
   */
  function dispatchKeyEvent(target, char) {
    const keyCode = char.charCodeAt(0);
    const key = char;

    const eventInit = {
      key,
      code: `Key${char.toUpperCase()}`,
      keyCode,
      which: keyCode,
      charCode: keyCode,
      bubbles: true,
      cancelable: true,
      composed: true,
    };

    target.dispatchEvent(new KeyboardEvent('keydown', eventInit));
    target.dispatchEvent(new KeyboardEvent('keypress', eventInit));

    // For input elements, also dispatch input event
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      target.dispatchEvent(new InputEvent('input', {
        data: char,
        inputType: 'insertText',
        bubbles: true,
        cancelable: true,
      }));
    }

    // Also try beforeinput
    target.dispatchEvent(new InputEvent('beforeinput', {
      data: char,
      inputType: 'insertText',
      bubbles: true,
      cancelable: true,
      composed: true,
    }));

    target.dispatchEvent(new KeyboardEvent('keyup', eventInit));
  }

  /**
   * Sleep helper
   */
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Log that content script loaded
  console.log('[Equavicle] Content script loaded on Google Docs');

})();
