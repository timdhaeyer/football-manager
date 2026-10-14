// Small DOM helpers shared by the views.

export const $ = (id) => document.getElementById(id);

export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k === 'on') for (const [ev, fn] of Object.entries(v)) node.addEventListener(ev, fn);
    else if (k in node) node[k] = v;
    else node.setAttribute(k, v);
  }
  for (const c of children) if (c != null) node.append(c);
  return node;
}

let toastTimer = null;
export function toast(text, ms = 2200) {
  const t = $('toast');
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), ms);
}

export function confirmDialog({ title, message = '', ok = 'OK', cancel = 'Cancel' }) {
  const d = $('dialog');
  $('dialog-title').textContent = title;
  $('dialog-message').textContent = message;
  $('dialog-ok').textContent = ok;
  $('dialog-cancel').textContent = cancel;
  d.hidden = false;
  return new Promise((resolve) => {
    const done = (v) => {
      d.hidden = true;
      $('dialog-ok').onclick = $('dialog-cancel').onclick = d.onclick = null;
      resolve(v);
    };
    $('dialog-ok').onclick = () => done(true);
    $('dialog-cancel').onclick = () => done(false);
    d.onclick = (e) => { if (e.target === d) done(false); };
  });
}

// Two-step button: first tap arms it (shows confirmLabel) for a few seconds, second tap runs fn.
export function twoStep(button, { confirmLabel, onConfirm, ms = 3000 }) {
  let armedUntil = 0;
  let timer = null;
  button.addEventListener('click', () => {
    if (Date.now() < armedUntil) {
      disarm();
      onConfirm();
      return;
    }
    armedUntil = Date.now() + ms;
    button.dataset.label = button.textContent;
    button.textContent = typeof confirmLabel === 'function' ? confirmLabel() : confirmLabel;
    button.classList.add('armed');
    timer = setTimeout(disarm, ms);
  });
  function disarm() {
    clearTimeout(timer);
    if (!button.classList.contains('armed')) return;
    armedUntil = 0;
    button.classList.remove('armed');
    if (button.dataset.label) button.textContent = button.dataset.label;
  }
  return { disarm, isArmed: () => button.classList.contains('armed') };
}

export function playerLabel(p) {
  return p.number != null ? `${p.number} ${p.name}` : p.name;
}

export function playerButton(p, { pressed, onClick }) {
  const props = { class: 'btn player-btn', type: 'button', on: { click: onClick } };
  if (pressed !== undefined) props['aria-pressed'] = String(pressed);
  return el(
    'button',
    props,
    p.number != null ? el('span', { class: 'num', textContent: String(p.number) }) : null,
    el('span', { textContent: p.name }),
  );
}
