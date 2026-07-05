// © 2026 RHgrive. All Rights Reserved. 無断複製・再配布・流用を禁じます。
//
// Mobile install gate.
//
// iOS / Android visitors who open the site in a normal browser tab are asked to
// add the app to their home screen, and the game is blocked until they do. Once
// the app is launched from the home-screen icon it runs in standalone
// (display-mode: standalone / navigator.standalone) and this gate never shows —
// so "opened as a web app" users see nothing. Desktop / PC is never gated.
//
// The gate sets globalThis.__INSTALL_GATE_ACTIVE__ so main.js aborts the heavy
// boot instead of loading the whole game behind the overlay.

(() => {
  const ua = navigator.userAgent || navigator.vendor || '';
  const isIOS =
    /iphone|ipad|ipod/i.test(ua) ||
    // iPadOS 13+ presents itself as "Macintosh"; distinguish a real touch iPad
    // from a desktop Mac by the presence of touch support.
    (/Macintosh/i.test(ua) && typeof document !== 'undefined' && 'ontouchend' in document);
  const isAndroid = /android/i.test(ua);
  const isMobile = isIOS || isAndroid;

  const isStandalone =
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    window.navigator.standalone === true ||
    (typeof document !== 'undefined' && String(document.referrer || '').startsWith('android-app://'));

  // QA bypass so the gate can be exercised without a real install:
  //   ?installGate=off  (persists to localStorage), or  ?installGate=on to re-arm.
  let bypass = false;
  try {
    const param = new URLSearchParams(location.search).get('installGate');
    if (param === 'off') localStorage.setItem('installGate', 'off');
    if (param === 'on') localStorage.removeItem('installGate');
    bypass = (param === 'off') || localStorage.getItem('installGate') === 'off';
  } catch { /* private-mode / storage disabled → no bypass */ }

  // Desktop, already-installed (home-screen launch), or QA bypass → do nothing.
  if (!isMobile || isStandalone || bypass) return;

  // Signal main.js to skip booting the game while the gate is up.
  globalThis.__INSTALL_GATE_ACTIVE__ = true;

  // Capture the Android install prompt as early as possible; it can fire before
  // the overlay is built, so stash it and wire the button up when it exists.
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const btn = document.getElementById('install-gate-button');
    if (btn) btn.hidden = false;
  });

  const SHARE_SVG =
    '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3"/><path d="M8 7l4-4 4 4"/><path d="M6 12H5a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2h-1"/></svg>';
  const MENU_SVG =
    '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor"><circle cx="12" cy="5" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="19" r="1.7"/></svg>';
  const ADD_SVG =
    '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/></svg>';

  const manifestLink = document.querySelector('link[rel="manifest"]');
  const appRoot = manifestLink?.href ? new URL('.', manifestLink.href) : new URL('./', location.href);
  let iconUrl = './assets/ui/game-icon-192.png';
  try { iconUrl = new URL('assets/ui/game-icon-192.png', appRoot).href; } catch { /* keep relative */ }

  function stepsHtml() {
    const li = (icon, text) => `<li><span class="ig-step-ic">${icon}</span><span class="ig-step-tx">${text}</span></li>`;
    if (isIOS) {
      return (
        li(SHARE_SVG, '画面下の<b>共有</b>ボタンを押す') +
        li(ADD_SVG, '<b>「ホーム画面に追加」</b>を選ぶ') +
        li('🎮', '追加された<b>アイコンから起動</b>する')
      );
    }
    return (
      li(MENU_SVG, '右上の<b>メニュー（︙）</b>を開く') +
      li(ADD_SVG, '<b>「ホーム画面に追加」</b>を選ぶ') +
      li('🎮', '追加された<b>アイコンから起動</b>する')
    );
  }

  function build() {
    if (document.getElementById('install-gate')) return;

    const style = document.createElement('style');
    style.textContent = `
      #install-gate{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;
        justify-content:center;padding:24px;box-sizing:border-box;
        background:radial-gradient(120% 120% at 50% 0%,#111b2c 0%,#05070d 70%);
        color:#e8eef7;font-family:ui-sans-serif,system-ui,-apple-system,"Hiragino Kaku Gothic ProN","Noto Sans JP",sans-serif;
        -webkit-user-select:none;user-select:none;overscroll-behavior:none;}
      #install-gate *{box-sizing:border-box;}
      .ig-card{width:100%;max-width:420px;text-align:center;background:rgba(17,27,44,.72);
        border:1px solid rgba(120,160,220,.18);border-radius:22px;padding:26px 22px 22px;
        box-shadow:0 24px 60px rgba(0,0,0,.55);backdrop-filter:blur(6px);}
      .ig-icon{width:88px;height:88px;border-radius:20px;display:block;margin:0 auto 14px;
        box-shadow:0 8px 24px rgba(0,0,0,.45);}
      .ig-title{font-size:22px;font-weight:800;margin:0 0 8px;letter-spacing:.02em;}
      .ig-lead{font-size:14px;line-height:1.7;color:#aebbcd;margin:0 0 18px;}
      .ig-lead b{color:#ffd07a;}
      .ig-steps{list-style:none;margin:0 0 16px;padding:0;text-align:left;}
      .ig-steps li{display:flex;align-items:center;gap:10px;counter-increment:ig;
        font-size:14px;line-height:1.5;padding:11px 12px;margin:8px 0;border-radius:12px;
        background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);}
      .ig-steps li::before{content:counter(ig);flex:0 0 22px;width:22px;height:22px;border-radius:50%;
        display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;
        color:#05070d;background:#ffb454;}
      .ig-steps{counter-reset:ig;}
      .ig-steps b{color:#e8eef7;}
      .ig-step-ic{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;
        width:26px;height:26px;color:#8fd0ff;font-size:16px;}
      .ig-step-tx{flex:1 1 auto;min-width:0;}
      .ig-install{appearance:none;border:0;cursor:pointer;width:100%;margin:2px 0 12px;
        padding:14px 18px;border-radius:14px;font-size:16px;font-weight:800;color:#05070d;
        background:linear-gradient(180deg,#ffce7a,#ff9f43);box-shadow:0 8px 20px rgba(255,150,60,.35);}
      .ig-install:active{transform:translateY(1px);}
      .ig-note{font-size:12px;color:#7d8a9c;line-height:1.6;margin:4px 0 0;}
      .ig-done .ig-steps,.ig-done .ig-install{display:none;}
    `;
    document.head.appendChild(style);

    const gate = document.createElement('div');
    gate.id = 'install-gate';
    gate.setAttribute('role', 'dialog');
    gate.setAttribute('aria-modal', 'true');
    gate.setAttribute('aria-label', 'ホーム画面に追加してください');
    gate.innerHTML =
      `<div class="ig-card">
        <img class="ig-icon" src="${iconUrl}" alt="" onerror="this.style.display='none'"/>
        <h1 class="ig-title">ホーム画面に追加してね</h1>
        <p class="ig-lead">このゲームは<b>ホーム画面に追加</b>してから遊べるよ。<br>下の手順でアイコンを追加してね。</p>
        <button id="install-gate-button" class="ig-install" type="button" hidden>アプリを追加する</button>
        <ol class="ig-steps">${stepsHtml()}</ol>
        <p class="ig-note">追加したら、ブラウザではなく<b>ホーム画面のアイコン</b>から起動してください。</p>
      </div>`;
    document.body.appendChild(gate);
    document.documentElement.style.overflow = 'hidden';

    const btn = document.getElementById('install-gate-button');
    if (btn && deferredPrompt) btn.hidden = false;
    if (btn) {
      btn.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        btn.disabled = true;
        try {
          deferredPrompt.prompt();
          await deferredPrompt.userChoice;
        } catch { /* user dismissed */ }
        deferredPrompt = null;
        btn.hidden = true;
        btn.disabled = false;
      });
    }
  }

  // Once installed, keep blocking this browser tab but confirm success and point
  // the user to the home-screen icon.
  window.addEventListener('appinstalled', () => {
    const card = document.querySelector('#install-gate .ig-card');
    const gate = document.getElementById('install-gate');
    if (card) {
      gate?.classList.add('ig-done');
      const title = card.querySelector('.ig-title');
      const lead = card.querySelector('.ig-lead');
      if (title) title.textContent = '追加できました！';
      if (lead) lead.innerHTML = '<b>ホーム画面のアイコン</b>から起動して遊んでね。';
    }
  });

  // If the tab itself transitions to standalone, drop the gate and boot the game.
  if (window.matchMedia) {
    const mq = window.matchMedia('(display-mode: standalone)');
    const onChange = (e) => { if (e.matches) location.reload(); };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }

  if (document.body) build();
  else document.addEventListener('DOMContentLoaded', build, { once: true });
})();
