import { FormationEditor } from './FormationEditor.js';

function createDomStub() {
  globalThis.document = {
    body: { appendChild() {} },
    createElement() {
      return {
        className: '',
        style: {},
        innerHTML: '',
        appendChild() {},
        querySelectorAll() { return []; },
        querySelector() { return { onclick: () => {} }; },
        remove() {}
      };
    }
  };
}

export async function verifyFormationLayoutContract() {
  createDomStub();
  const editor = new FormationEditor({ mount: document.body, onApplyBattle: () => {} });
  editor.setVisible(true);
  const html = editor.root.innerHTML;
  const hasScroll = html.includes('formation-catalog-scroll');
  const scrollStart = html.indexOf('formation-catalog-scroll');
  const scrollEnd = html.indexOf('</div>', scrollStart);
  const slotsInside = scrollStart >= 0 && html.slice(scrollStart, scrollEnd).includes('formation-slots');
  const actionsInside = scrollStart >= 0 && html.slice(scrollStart, scrollEnd).includes('formation-actions');
  const slotCount = (html.match(/data-slot='/g) || []).length;
  editor.onApplyBattle();
  const hidden = editor.root.style.display === 'none';
  return { ok: hasScroll && !slotsInside && !actionsInside && !hidden && slotCount === 5, hasScroll, slotsInside, actionsInside, hidden, slotCount };
}
