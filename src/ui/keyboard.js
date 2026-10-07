const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

export function createKeyboard(container, { onLetter, onBackspace }) {
  ROWS.forEach((letters, rowIndex) => {
    const row = document.createElement('div');
    row.className = 'keyboard__row';

    for (const letter of letters) {
      const key = document.createElement('button');
      key.type = 'button';
      key.className = 'key';
      key.textContent = letter;
      key.setAttribute('aria-label', `Letter ${letter.toUpperCase()}`);
      key.addEventListener('click', () => onLetter(letter.toUpperCase()));
      row.append(key);
    }

    if (rowIndex === ROWS.length - 1) {
      const backspace = document.createElement('button');
      backspace.type = 'button';
      backspace.className = 'key key--wide';
      backspace.textContent = '\u232B';
      backspace.setAttribute('aria-label', 'Backspace');
      backspace.addEventListener('click', () => onBackspace());
      row.append(backspace);
    }

    container.append(row);
  });
}
