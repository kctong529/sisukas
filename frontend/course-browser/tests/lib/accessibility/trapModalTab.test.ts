// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { trapModalTab } from '../../../src/lib/accessibility/trapModalTab';

let dialog: HTMLDivElement;
let outside: HTMLButtonElement;
let first: HTMLButtonElement;
let last: HTMLButtonElement;

function pressTab(shiftKey = false): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, cancelable: true });
  trapModalTab(dialog, event);
  return event;
}

beforeEach(() => {
  outside = document.createElement('button');
  dialog = document.createElement('div');
  first = document.createElement('button');
  last = document.createElement('button');
  first.textContent = 'Close';
  last.textContent = 'Action';
  dialog.append(first, last);
  document.body.append(outside, dialog);
});

afterEach(() => {
  outside.remove();
  dialog.remove();
});

describe('trapModalTab', () => {
  it('wraps Tab from the last control to the first', () => {
    last.focus();
    expect(pressTab().defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);
  });

  it('wraps Shift+Tab from the first control to the last', () => {
    first.focus();
    expect(pressTab(true).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);
  });

  it('redirects focus into the dialog if it was outside', () => {
    outside.focus();
    expect(pressTab().defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);
  });

  it('leaves normal Tab navigation to the browser from middle controls', () => {
    const middle = document.createElement('button');
    first.after(middle);
    middle.focus();
    expect(pressTab().defaultPrevented).toBe(false);
  });

  it('skips disabled buttons and focusable elements with tabindex -1', () => {
    first.disabled = true;
    const ignored = document.createElement('button');
    ignored.tabIndex = -1;
    last.after(ignored);
    outside.focus();
    pressTab();
    expect(document.activeElement).toBe(last);
  });

  it('focuses the dialog itself when it has no interactive descendants', () => {
    first.remove();
    last.remove();
    dialog.tabIndex = -1;
    outside.focus();
    expect(pressTab().defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(dialog);
  });
});
