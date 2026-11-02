// 画面の上に重ねるダイアログの共通部分。
// 開いている間は背後を inert にし、Tab をダイアログの中だけで巡らせ、Escape で閉じる。同時に開けるのは1つだけ

export interface ModalHandle {
  overlay: HTMLElement;
  close(): void;
}

let current: ModalHandle | null = null;

export function isModalOpen(): boolean {
  return current !== null;
}

export function openModal(
  root: HTMLElement,
  background: HTMLElement,
  options: { className: string; labelledBy: string; describedBy?: string; onClose?: () => void },
): ModalHandle | null {
  if (current) return null;
  const previouslyFocused = document.activeElement as HTMLElement | null;
  const overlay = document.createElement('div');
  overlay.className = options.className;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', options.labelledBy);
  if (options.describedBy) overlay.setAttribute('aria-describedby', options.describedBy);
  root.append(overlay);
  background.inert = true;

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      handle.close();
      return;
    }
    if (e.key === 'Tab') {
      const items = [...overlay.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex="0"]')];
      if (items.length === 0) return;
      const i = items.indexOf(document.activeElement as HTMLElement);
      const next = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : i === items.length - 1 ? 0 : i + 1;
      items[next].focus();
      e.preventDefault();
    }
  }
  document.addEventListener('keydown', onKey);

  const handle: ModalHandle = {
    overlay,
    close() {
      if (current !== handle) return;
      current = null;
      overlay.remove();
      background.inert = false;
      document.removeEventListener('keydown', onKey);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
      options.onClose?.();
    },
  };
  current = handle;
  return handle;
}
