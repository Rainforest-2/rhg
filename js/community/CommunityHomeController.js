function createElement(documentRef, tagName, className, text = null) {
  const element = documentRef.createElement(tagName);
  if (className) element.className = className;
  if (text !== null) element.textContent = text;
  return element;
}

// Owns only the Phase 2 overlay. It does not route, fetch, or retain game state.
export class CommunityHomeController {
  constructor({ documentRef = document, mount, onPlay = null, browseAvailable = false } = {}) {
    if (!documentRef?.createElement) throw new TypeError('CommunityHomeController requires a document');
    if (!mount?.appendChild) throw new TypeError('CommunityHomeController requires a mount element');
    this.document = documentRef;
    this.mountTarget = mount;
    this.onPlay = typeof onPlay === 'function' ? onPlay : null;
    this.browseAvailable = browseAvailable === true && false; // Phase 2 has no browse route: fail closed.
    this.root = null;
    this.playButton = null;
    this._playStarted = false;
    this._onPlayClick = () => { void this.requestPlay(); };
  }

  mount() {
    if (this.root) return this.root;
    const root = createElement(this.document, 'section', 'community-home');
    root.setAttribute('aria-labelledby', 'community-home-title');
    root.setAttribute('data-community-home', 'phase-2');

    const shell = createElement(this.document, 'div', 'community-home__shell');
    const heading = createElement(this.document, 'h1', 'community-home__title', 'BWS');
    heading.id = 'community-home-title';
    const status = createElement(this.document, 'p', 'community-home__status', 'オンライン機能は準備中です');
    status.setAttribute('role', 'status');

    const actions = createElement(this.document, 'div', 'community-home__actions');
    const playCard = createElement(this.document, 'article', 'community-home__card community-home__card--primary');
    const playButton = createElement(this.document, 'button', 'community-home__play', 'プレイ');
    playButton.type = 'button';
    playButton.setAttribute('data-community-play', '');
    playButton.addEventListener('click', this._onPlayClick);
    playCard.append(playButton, createElement(this.document, 'p', 'community-home__description', '今までの公式ステージ・自作ステージ・編成画面へ'));

    const browseCard = createElement(this.document, 'article', 'community-home__card community-home__card--disabled');
    const browseButton = createElement(this.document, 'button', 'community-home__browse', 'みんなのステージをプレイ');
    browseButton.type = 'button';
    browseButton.disabled = true;
    browseButton.setAttribute('aria-disabled', 'true');
    browseButton.setAttribute('aria-describedby', 'community-home-browse-status');
    const browseStatus = createElement(this.document, 'p', 'community-home__description', '公開ステージ一覧・検索・プレイ・インポートへ（準備中）');
    browseStatus.id = 'community-home-browse-status';
    browseCard.append(browseButton, browseStatus);

    actions.append(playCard, browseCard);
    shell.append(heading, status, actions);
    root.append(shell);
    this.mountTarget.append(root);
    this.root = root;
    this.playButton = playButton;
    return root;
  }

  show() {
    const root = this.mount();
    root.hidden = false;
    root.removeAttribute('inert');
    return root;
  }

  hide() {
    if (!this.root) return;
    this.root.hidden = true;
    this.root.setAttribute('inert', '');
  }

  async requestPlay() {
    if (this._playStarted || !this.onPlay) return false;
    this._playStarted = true;
    if (this.playButton) {
      this.playButton.disabled = true;
      this.playButton.setAttribute('aria-busy', 'true');
    }
    try {
      await this.onPlay();
      return true;
    } finally {
      if (this.playButton) this.playButton.removeAttribute('aria-busy');
    }
  }

  destroy() {
    if (!this.root) return;
    this.playButton?.removeEventListener('click', this._onPlayClick);
    this.root.remove();
    this.root = null;
    this.playButton = null;
  }
}
