export function createControls(container, { onCheck, onHint, onReveal, onNext }) {
  const make = (label, handler, variant, hidden = false) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `btn ${variant}`;
    button.textContent = label;
    button.hidden = hidden;
    button.addEventListener('click', handler);
    container.append(button);
    return button;
  };

  const check = make('Check', onCheck, 'btn--soft');
  const hint = make('Hint', onHint, 'btn--soft');
  const reveal = make('Reveal', onReveal, 'btn--quiet');
  const next = make('Next puzzle', onNext, 'btn--primary', true);

  return {
    render(state) {
      const won = state.status === 'won';
      check.hidden = won;
      hint.hidden = won;
      reveal.hidden = won;
      next.hidden = !won;
    },
  };
}
