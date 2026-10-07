export function createWin(overlay, { onNext, onClose }) {
  const titleEl = overlay.querySelector('#win-title');
  const timeEl = overlay.querySelector('#win-time');
  const nextBtn = overlay.querySelector('#win-next');
  const closeBtn = overlay.querySelector('#win-close');
  const background = document.querySelector('.app');
  let dismissed = false;

  function hide() {
    overlay.hidden = true;
    if (background) background.inert = false;
  }

  function show(title, timeText) {
    titleEl.textContent = title;
    timeEl.textContent = `Time ${timeText}`;
    overlay.hidden = false;
    if (background) background.inert = true;
    nextBtn.focus();
  }

  nextBtn.addEventListener('click', () => {
    dismissed = false;
    onNext();
  });

  closeBtn.addEventListener('click', () => {
    dismissed = true;
    hide();
    onClose();
  });

  document.addEventListener('keydown', (event) => {
    if (overlay.hidden) return;
    if (event.key === 'Escape') {
      dismissed = true;
      hide();
      onClose();
    }
  });

  return {
    reset() {
      dismissed = false;
      hide();
    },
    render(state, title, timeText) {
      if (state.status === 'won') {
        if (dismissed) return;
        if (overlay.hidden) show(title, timeText);
        else timeEl.textContent = `Time ${timeText}`;
      } else {
        dismissed = false;
        if (!overlay.hidden) hide();
      }
    },
  };
}
