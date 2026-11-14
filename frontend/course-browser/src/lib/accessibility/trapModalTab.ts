/** Keeps Tab navigation within an open modal dialog. */
export function trapModalTab(dialog: HTMLElement, event: KeyboardEvent): void {
  if (event.key !== "Tab") return;

  const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
      'textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
  )).filter((element) => !element.closest('[hidden], [inert]') && element.tabIndex >= 0);

  if (focusable.length === 0) {
    event.preventDefault();
    dialog.focus();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;

  if (!dialog.contains(active)) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  } else if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}
