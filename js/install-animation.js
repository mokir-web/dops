// ── Installationsanimation (v4.58.0) ─────────────────────────────────────────
// Liten animerad "så här gör du" för att installera MoraDOPS som app. Används av
// installationsdialogen i appen (bara den aktuella webbläsarens scen) och av den
// fristående sidan Marknadsföring/installera_app.html (alla scener efter varandra).
//
// InstallAnimation.mount(container, sceneId, { onStep, loop, maxHeight, icon }) → { stop() }
// Varje scen = en ritad enhet (telefon/dator) + en lista steg. Ett steg flyttar
// pekaren till ett element (tap), "trycker" och visar/döljer sedan överlägg (show/hide).
// li = vilken punkt i instruktionslistan steget hör till (onStep(li) markerar den).
// Loopen stoppar sig själv när containern inte längre syns (t.ex. stängd dialog).
(function () {
  const ICON = '%ICON%'; // byts mot opts.icon i mount() — sökvägen skiljer sig mellan appen och fristående sidor

  const CSS = `
  .ia-wrap { position: relative; width: 100%; overflow: hidden; margin: 0 auto; }
  .ia-stage { position: absolute; top: 0; left: 50%; transform-origin: top center; font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #1c2b36; }
  .ia-stage * { box-sizing: border-box; }
  .ia-phone { width: 220px; height: 400px; border-radius: 32px; background: #1c2b36; padding: 9px; box-shadow: 0 8px 24px rgba(0,0,0,0.25); }
  .ia-screen { position: relative; width: 100%; height: 100%; border-radius: 24px; overflow: hidden; background: #f4f6f7; }
  .ia-status { height: 22px; font-size: 10px; font-weight: 600; padding: 5px 16px 0; display: flex; justify-content: space-between; }
  .ia-bar { display: flex; align-items: center; gap: 6px; padding: 5px 8px; background: #fff; border-bottom: 1px solid #dde3e7; font-size: 11px; }
  .ia-bar.bottom { position: absolute; left: 0; right: 0; bottom: 0; border-bottom: none; border-top: 1px solid #dde3e7; padding-bottom: 14px; }
  .ia-url { flex: 1; background: #eceff1; border-radius: 8px; padding: 4px 8px; color: #55656f; text-align: center; white-space: nowrap; overflow: hidden; }
  .ia-btn { width: 24px; height: 24px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 700; color: #1a73e8; flex: none; }
  .ia-btn svg { width: 15px; height: 15px; }
  .ia-page { padding: 10px; }
  .ia-page .ia-hd { height: 34px; border-radius: 8px; background: #2e4a5f; color: #fff; font-size: 12px; font-weight: 700; display: flex; align-items: center; padding: 0 10px; margin-bottom: 8px; }
  .ia-page .ia-card { height: 46px; border-radius: 8px; background: #fff; border: 1px solid #dde3e7; margin-bottom: 7px; padding: 8px; }
  .ia-page .ia-card i { display: block; height: 6px; border-radius: 3px; background: #dde3e7; margin-bottom: 6px; width: 70%; }
  .ia-page .ia-card i + i { width: 45%; }
  .ia-ov { position: absolute; opacity: 0; pointer-events: none; transition: opacity .25s, transform .3s; }
  .ia-ov.ia-on { opacity: 1; transform: none !important; }
  .ia-sheet { left: 0; right: 0; bottom: 0; background: #fff; border-radius: 16px 16px 0 0; box-shadow: 0 -4px 16px rgba(0,0,0,0.18); padding: 10px 10px 18px; transform: translateY(40px); font-size: 11px; }
  .ia-menu { background: #fff; border-radius: 10px; box-shadow: 0 6px 20px rgba(0,0,0,0.22); padding: 4px 0; font-size: 11px; transform: scale(.92); transform-origin: top right; min-width: 150px; }
  .ia-item { padding: 7px 12px; display: flex; align-items: center; gap: 8px; white-space: nowrap; }
  .ia-item.dim { color: #8a979f; }
  .ia-item.sep { border-top: 1px solid #e3e8eb; }
  .ia-dialog { background: #fff; border-radius: 12px; box-shadow: 0 8px 28px rgba(0,0,0,0.28); padding: 12px; font-size: 11px; transform: scale(.92); }
  .ia-dialog .t { font-weight: 700; font-size: 12px; margin-bottom: 8px; }
  .ia-app { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
  .ia-app img { width: 30px; height: 30px; border-radius: 7px; }
  .ia-app small { display: block; color: #8a979f; }
  .ia-acts { display: flex; justify-content: flex-end; gap: 8px; }
  .ia-acts span { padding: 5px 10px; border-radius: 6px; font-weight: 600; }
  .ia-acts .pri { background: #1a73e8; color: #fff; }
  .ia-dim { inset: 0; background: rgba(0,0,0,0.3); }
  .ia-home { inset: 0; background: linear-gradient(160deg, #4b6f8a, #2e4a5f 60%, #1f3443); padding: 34px 16px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px 10px; align-content: start; }
  .ia-home b { display: block; width: 36px; height: 36px; border-radius: 9px; background: rgba(255,255,255,0.28); margin: 0 auto; }
  .ia-home .me { text-align: center; color: #fff; font-size: 8px; transform: scale(0); transition: transform .45s cubic-bezier(.3,1.6,.5,1); }
  .ia-home.ia-on .me { transform: scale(1); transition-delay: .35s; }
  .ia-home .me img { width: 36px; height: 36px; border-radius: 9px; display: block; margin: 0 auto 3px; }
  .ia-desk { width: 440px; height: 280px; border-radius: 10px; background: #f4f6f7; box-shadow: 0 8px 24px rgba(0,0,0,0.25); position: relative; overflow: hidden; border: 1px solid #c7d1d7; }
  .ia-tabs { height: 26px; background: #dfe5e9; display: flex; align-items: flex-end; padding: 0 8px; gap: 6px; }
  .ia-dots { display: flex; gap: 5px; align-self: center; margin-right: 6px; }
  .ia-dots i { width: 9px; height: 9px; border-radius: 50%; background: #c7d1d7; }
  .ia-tab { background: #fff; border-radius: 7px 7px 0 0; padding: 4px 12px; font-size: 10px; display: flex; align-items: center; gap: 5px; }
  .ia-tab img { width: 12px; height: 12px; border-radius: 3px; }
  .ia-desk .ia-page { display: grid; grid-template-columns: 90px 1fr; gap: 10px; }
  .ia-side { background: #2e4a5f; border-radius: 8px; height: 190px; }
  .ia-win { inset: 0; background: #f4f6f7; transform: scale(.96); }
  .ia-win .ia-tbar { height: 26px; background: #2e4a5f; color: #fff; font-size: 10px; font-weight: 600; display: flex; align-items: center; gap: 6px; padding: 0 10px; }
  .ia-win .ia-tbar img { width: 14px; height: 14px; border-radius: 3px; }
  .ia-macbar { height: 20px; background: rgba(255,255,255,0.9); display: flex; align-items: center; gap: 14px; padding: 0 12px; font-size: 10px; border-bottom: 1px solid #dde3e7; }
  .ia-macbar b { font-weight: 700; }
  .ia-dock { left: 50%; bottom: 6px; transform: translateX(-50%); background: rgba(255,255,255,0.55); border: 1px solid rgba(255,255,255,0.7); border-radius: 12px; padding: 5px 8px; display: flex; gap: 6px; backdrop-filter: blur(6px); opacity: 1; }
  .ia-dock b { width: 26px; height: 26px; border-radius: 7px; background: #c7d1d7; }
  .ia-dock img { width: 26px; height: 0; border-radius: 7px; transition: height .4s cubic-bezier(.3,1.6,.5,1), width .4s; width: 0; }
  .ia-dock.ia-grow img { width: 26px; height: 26px; }
  .ia-ptr { position: absolute; left: 0; top: 0; z-index: 50; pointer-events: none; transition: transform .6s cubic-bezier(.45,.05,.3,1), opacity .3s; opacity: 0; }
  .ia-ptr.ia-show { opacity: 1; }
  .ia-ptr.finger { width: 26px; height: 26px; margin: -13px 0 0 -13px; border-radius: 50%; background: rgba(46,74,95,0.35); border: 2px solid rgba(255,255,255,0.9); box-shadow: 0 1px 4px rgba(0,0,0,0.3); }
  .ia-ptr.cursor { width: 16px; height: 22px; }
  .ia-ptr::after { content: ''; position: absolute; left: 50%; top: 50%; width: 10px; height: 10px; margin: -5px 0 0 -5px; border-radius: 50%; border: 2px solid #1a73e8; opacity: 0; }
  .ia-ptr.cursor::after { left: 2px; top: 2px; }
  .ia-ptr.ia-tap::after { animation: ia-ripple .45s ease-out; }
  @keyframes ia-ripple { from { opacity: 1; transform: scale(.5); } to { opacity: 0; transform: scale(3); } }
  .ia-press { background: #dbe8fb !important; transition: background .15s; }
  .ia-hl { box-shadow: 0 0 0 2px #1a73e8; border-radius: 6px; }
  `;

  const SHARE = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 6H3.5v8.5h9V6H11"/><path d="M8 1.5v8M5.5 4 8 1.5 10.5 4"/></svg>';
  const INSTALL = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="2.5" width="13" height="9" rx="1.5"/><path d="M5.5 14h5M8 4.5v4.5M6 7l2 2 2-2"/></svg>';
  const CURSOR = '<svg viewBox="0 0 16 22" width="16" height="22"><path d="M1 1v17l4.5-4.2 3 6.7 2.6-1.2-3-6.6H14z" fill="#1c2b36" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/></svg>';

  const page = '<div class="ia-page"><div class="ia-hd">MoraDOPS</div><div class="ia-card"><i></i><i></i></div><div class="ia-card"><i></i><i></i></div><div class="ia-card"><i></i><i></i></div><div class="ia-card"><i></i><i></i></div></div>';
  const appRow = (sub) => `<div class="ia-app"><img src="${ICON}" alt=""><div><b>MoraDOPS</b><small>${sub}</small></div></div>`;
  const home = '<div class="ia-ov ia-home" data-ia="home">' + '<b></b>'.repeat(9) + `<div class="me"><img src="${ICON}" alt="">MoraDOPS</div></div>`;
  const phone = (inner) => `<div class="ia-phone"><div class="ia-screen"><div class="ia-status"><span>9:41</span><span>●●● ▮</span></div>${inner}</div></div>`;
  const desk = (inner) => `<div class="ia-desk">${inner}</div>`;
  const deskPage = '<div class="ia-page"><div class="ia-side"></div><div><div class="ia-hd">MoraDOPS</div><div class="ia-card"><i></i><i></i></div><div class="ia-card"><i></i><i></i></div><div class="ia-card"><i></i><i></i></div></div></div>';
  const appWin = `<div class="ia-ov ia-win" data-ia="win"><div class="ia-tbar"><img src="${ICON}" alt="">MoraDOPS</div>${deskPage}</div>`;
  const tabs = `<div class="ia-tabs"><span class="ia-dots"><i></i><i></i><i></i></span><span class="ia-tab"><img src="${ICON}" alt="">MoraDOPS</span></div>`;

  // iPhone/iPad: Dela → Lägg till på hemskärmen → Lägg till. shareTop = Chrome på iOS och iPad
  // (Dela uppe till höger); annars ligger Dela under ⋯ i nedre fältet (Safari, iOS 26).
  function iosScene(shareTop) {
    const shareSheet = `<div class="ia-ov ia-sheet" data-ia="sheet">
      ${appRow('moradops.se')}
      <div class="ia-item dim sep">Kopiera</div>
      <div class="ia-item dim sep">Lägg till i bokmärken</div>
      <div class="ia-item sep" data-t="a2hs">Lägg till på hemskärmen <span style="margin-left:auto">＋</span></div>
      <div class="ia-item dim sep">Skriv ut</div></div>`;
    const addDialog = `<div class="ia-ov ia-sheet" data-ia="add" style="top:30px;border-radius:16px 16px 0 0">
      <div style="display:flex;justify-content:space-between;gap:6px;margin-bottom:12px;font-size:9.5px;white-space:nowrap"><span style="color:#1a73e8">Avbryt</span><b>Lägg till på hemskärmen</b><span style="color:#1a73e8;font-weight:700" data-t="add">Lägg till</span></div>
      ${appRow('https://moradops.se')}</div>`;
    if (shareTop) {
      return {
        kind: 'phone',
        html: phone(`<div class="ia-bar"><span class="ia-url">moradops.se</span><span class="ia-btn" data-t="share">${SHARE}</span><span class="ia-btn">⋮</span></div>${page}<div class="ia-ov ia-dim" data-ia="dim"></div>${shareSheet}${addDialog}${home}`),
        steps: [
          { tap: 'share', show: ['dim', 'sheet'], li: 0 },
          { tap: 'a2hs', hide: ['sheet'], show: ['add'], li: 1 },
          { tap: 'add', hide: ['add', 'dim'], show: ['home'], li: 2, hold: 2600 }
        ]
      };
    }
    const moreMenu = `<div class="ia-ov ia-menu" data-ia="more" style="right:10px;bottom:52px;transform-origin:bottom right">
      <div class="ia-item" data-t="dela">${'<span class="ia-btn" style="width:16px;height:16px">' + SHARE + '</span>'}Dela</div>
      <div class="ia-item dim sep">Lägg till bokmärke</div><div class="ia-item dim sep">Ny flik</div></div>`;
    return {
      kind: 'phone',
      html: phone(`${page}<div class="ia-bar bottom"><span class="ia-btn">‹</span><span class="ia-url">moradops.se</span><span class="ia-btn" data-t="dots">⋯</span></div>${moreMenu}<div class="ia-ov ia-dim" data-ia="dim"></div>${shareSheet}${addDialog}${home}`),
      steps: [
        { tap: 'dots', show: ['more'], li: 0 },
        { tap: 'dela', hide: ['more'], show: ['dim', 'sheet'], li: 0 },
        { tap: 'a2hs', hide: ['sheet'], show: ['add'], li: 1 },
        { tap: 'add', hide: ['add', 'dim'], show: ['home'], li: 2, hold: 2600 }
      ]
    };
  }

  const SCENES = {
    ios: { label: 'iPhone (Safari)', ...iosScene(false) },
    iosTop: { label: 'iPad / Chrome på iPhone', ...iosScene(true) },
    android: {
      label: 'Android (Chrome)', kind: 'phone',
      html: phone(`<div class="ia-bar"><span class="ia-url">moradops.se</span><span class="ia-btn" data-t="menu">⋮</span></div>${page}
        <div class="ia-ov ia-menu" data-ia="menu" style="right:8px;top:30px">
          <div class="ia-item dim">Ny flik</div><div class="ia-item dim">Historik</div><div class="ia-item dim">Bokmärken</div>
          <div class="ia-item sep" data-t="inst">Installera app</div><div class="ia-item dim">Inställningar</div></div>
        <div class="ia-ov ia-dim" data-ia="dim"></div>
        <div class="ia-ov ia-dialog" data-ia="dlg" style="left:16px;right:16px;top:130px"><div class="t">Installera app</div>${appRow('moradops.se')}
          <div class="ia-acts"><span>Avbryt</span><span class="pri" data-t="ok">Installera</span></div></div>${home}`),
      steps: [
        { tap: 'menu', show: ['menu'], li: 0 },
        { tap: 'inst', hide: ['menu'], show: ['dim', 'dlg'], li: 1 },
        { tap: 'ok', hide: ['dlg', 'dim'], show: ['home'], li: 2, hold: 2600 }
      ]
    },
    firefoxAndroid: {
      label: 'Firefox på Android', kind: 'phone',
      html: phone(`${page}<div class="ia-bar bottom"><span class="ia-btn">⌂</span><span class="ia-url">moradops.se</span><span class="ia-btn">▢</span><span class="ia-btn" data-t="menu">⋮</span></div>
        <div class="ia-ov ia-dim" data-ia="dim"></div>
        <div class="ia-ov ia-sheet" data-ia="sheet"><div class="ia-item dim">Ny flik</div><div class="ia-item dim sep">Bokmärken</div><div class="ia-item dim sep">Historik</div><div class="ia-item sep" data-t="add">Lägg till på startskärmen</div><div class="ia-item dim sep">Inställningar</div></div>
        <div class="ia-ov ia-dialog" data-ia="dlg" style="left:16px;right:16px;top:130px"><div class="t">Lägg till på startskärmen</div>${appRow('moradops.se')}
          <div class="ia-acts"><span>Avbryt</span><span class="pri" data-t="ok">Lägg till</span></div></div>${home}`),
      steps: [
        { tap: 'menu', show: ['dim', 'sheet'], li: 0 },
        { tap: 'add', hide: ['sheet'], show: ['dlg'], li: 1 },
        { tap: 'ok', hide: ['dlg', 'dim'], show: ['home'], li: 1, hold: 2600 }
      ]
    },
    samsung: {
      label: 'Samsung Internet', kind: 'phone',
      html: phone(`<div class="ia-bar"><span class="ia-url">moradops.se</span></div>${page}
        <div class="ia-bar bottom" style="justify-content:space-around"><span class="ia-btn">‹</span><span class="ia-btn">›</span><span class="ia-btn">⌂</span><span class="ia-btn">▢</span><span class="ia-btn" data-t="menu">☰</span></div>
        <div class="ia-ov ia-dim" data-ia="dim"></div>
        <div class="ia-ov ia-sheet" data-ia="sheet"><div class="ia-item dim">Bokmärken</div><div class="ia-item dim sep">Hämtningar</div><div class="ia-item sep" data-t="add">Lägg till sida på</div><div class="ia-item dim sep">Inställningar</div></div>
        <div class="ia-ov ia-sheet" data-ia="where"><div class="t" style="font-weight:700;padding:4px 12px 8px">Lägg till sida på</div><div class="ia-item dim sep">Bokmärken</div><div class="ia-item dim sep">Snabbåtkomst</div><div class="ia-item sep" data-t="home">Startskärm</div></div>${home}`),
      steps: [
        { tap: 'menu', show: ['dim', 'sheet'], li: 0 },
        { tap: 'add', hide: ['sheet'], show: ['where'], li: 1 },
        { tap: 'home', hide: ['where', 'dim'], show: ['home'], li: 1, hold: 2600 }
      ]
    },
    chrome: {
      label: 'Chrome på datorn', kind: 'desk',
      html: desk(`${tabs}<div class="ia-bar"><span class="ia-btn">‹</span><span class="ia-btn">↻</span><span class="ia-url" style="text-align:left">moradops.se</span><span class="ia-btn" data-t="inst">${INSTALL}</span><span class="ia-btn">⋮</span></div>${deskPage}
        <div class="ia-ov ia-dialog" data-ia="dlg" style="right:30px;top:60px;width:210px;transform-origin:top right"><div class="t">Installera app?</div>${appRow('moradops.se')}
          <div class="ia-acts"><span class="pri" data-t="ok">Installera</span><span>Avbryt</span></div></div>${appWin}`),
      steps: [
        { tap: 'inst', show: ['dlg'], li: 0 },
        { tap: 'ok', hide: ['dlg'], show: ['win'], li: 2, hold: 2600 }
      ]
    },
    edge: {
      label: 'Edge på datorn', kind: 'desk',
      html: desk(`${tabs}<div class="ia-bar"><span class="ia-btn">‹</span><span class="ia-btn">↻</span><span class="ia-url" style="text-align:left">moradops.se</span><span class="ia-btn" data-t="menu">⋯</span></div>${deskPage}
        <div class="ia-ov ia-menu" data-ia="menu" style="right:8px;top:56px"><div class="ia-item dim">Ny flik</div><div class="ia-item dim">Favoriter</div><div class="ia-item dim">Historik</div><div class="ia-item sep" data-t="apps">Appar <span style="margin-left:auto">›</span></div><div class="ia-item dim sep">Inställningar</div></div>
        <div class="ia-ov ia-menu" data-ia="sub" style="right:168px;top:126px"><div class="ia-item" data-t="inst">Installera den här webbplatsen som en app</div><div class="ia-item dim">Visa appar</div></div>
        <div class="ia-ov ia-dialog" data-ia="dlg" style="left:115px;top:70px;width:210px"><div class="t">Installera app</div>${appRow('moradops.se')}
          <div class="ia-acts"><span class="pri" data-t="ok">Installera</span><span>Avbryt</span></div></div>${appWin}`),
      steps: [
        { tap: 'menu', show: ['menu'], li: 0 },
        { tap: 'apps', show: ['sub'], li: 1 },
        { tap: 'inst', hide: ['menu', 'sub'], show: ['dlg'], li: 1 },
        { tap: 'ok', hide: ['dlg'], show: ['win'], li: 2, hold: 2600 }
      ]
    },
    safariMac: {
      label: 'Safari på Mac', kind: 'desk',
      html: desk(`<div class="ia-macbar"><b></b><b>Safari</b><span data-t="arkiv">Arkiv</span><span>Redigera</span><span>Visa</span><span>Fönster</span></div>
        <div class="ia-bar"><span class="ia-dots"><i></i><i></i><i></i></span><span class="ia-btn">‹</span><span class="ia-url">moradops.se</span><span class="ia-btn">${SHARE}</span></div>${deskPage}
        <div class="ia-ov ia-menu" data-ia="menu" style="left:58px;top:20px;transform-origin:top left"><div class="ia-item dim">Nytt fönster</div><div class="ia-item dim">Ny flik</div><div class="ia-item dim sep">Öppna fil…</div><div class="ia-item sep" data-t="dock">Lägg till i Dock…</div><div class="ia-item dim sep">Dela</div></div>
        <div class="ia-ov ia-dialog" data-ia="dlg" style="left:115px;top:60px;width:210px"><div class="t">Lägg till i Dock</div>${appRow('moradops.se')}
          <div class="ia-acts"><span>Avbryt</span><span class="pri" data-t="ok">Lägg till</span></div></div>
        <div class="ia-ov ia-dock ia-on" data-ia="dockbar"><b></b><b></b><b></b><b></b><img src="${ICON}" alt=""></div>`),
      steps: [
        { tap: 'arkiv', show: ['menu'], li: 0 },
        { tap: 'dock', hide: ['menu'], show: ['dlg'], li: 1 },
        { tap: 'ok', hide: ['dlg'], grow: true, li: 1, hold: 2600 }
      ]
    }
  };

  let styled = false;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  function mount(container, sceneId, opts = {}) {
    const scene = SCENES[sceneId];
    if (!scene) return { stop() {} };
    if (!styled) { const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); styled = true; }
    const baseW = scene.kind === 'phone' ? 220 : 440;
    const baseH = scene.kind === 'phone' ? 400 : 280;
    const maxH = opts.maxHeight || baseH;
    container.innerHTML = `<div class="ia-wrap" aria-hidden="true"><div class="ia-stage">${scene.html.split(ICON).join(opts.icon || 'icons/icon-192.png')}<div class="ia-ptr ${scene.kind === 'phone' ? 'finger' : 'cursor'}">${scene.kind === 'phone' ? '' : CURSOR}</div></div></div>`;
    const wrap = container.firstChild;
    const stage = wrap.firstChild;
    const ptr = stage.querySelector('.ia-ptr');
    const fit = () => {
      const scale = Math.min(1, (wrap.clientWidth || baseW) / baseW, maxH / baseH);
      stage.style.transform = `translateX(-50%) scale(${scale})`;
      wrap.style.height = Math.round(baseH * scale) + 12 + 'px'; // + plats för skuggan
      return scale;
    };
    fit();
    window.addEventListener('resize', fit);

    let running = true;
    const alive = () => running && wrap.isConnected && wrap.offsetParent !== null;
    const stop = () => { running = false; window.removeEventListener('resize', fit); };
    const set = (keys, on) => (keys || []).forEach(k => stage.querySelectorAll(`[data-ia="${k}"]`).forEach(el => el.classList.toggle('ia-on', on)));
    const moveTo = (el) => {
      const s = fit();
      const r = el.getBoundingClientRect(), sr = stage.getBoundingClientRect();
      const x = (r.left - sr.left + r.width / 2) / s, y = (r.top - sr.top + r.height / 2) / s;
      ptr.style.transform = `translate(${x}px, ${y}px)`;
    };

    (async () => {
      await sleep(50);
      while (alive()) {
        stage.querySelectorAll('[data-ia]').forEach(el => el.classList.toggle('ia-on', el.dataset.ia === 'dockbar'));
        stage.querySelector('.ia-dock')?.classList.remove('ia-grow');
        ptr.classList.remove('ia-show');
        ptr.style.transition = 'none';
        ptr.style.transform = `translate(${baseW * 0.55}px, ${baseH * 0.62}px)`;
        void ptr.offsetWidth; ptr.style.transition = '';
        opts.onStep?.(-1);
        await sleep(700); if (!alive()) break;
        ptr.classList.add('ia-show');
        for (const st of scene.steps) {
          const target = stage.querySelector(`[data-t="${st.tap}"]`);
          opts.onStep?.(st.li);
          moveTo(target);
          await sleep(900); if (!alive()) break;
          target.classList.add('ia-press'); ptr.classList.add('ia-tap');
          await sleep(350);
          target.classList.remove('ia-press'); ptr.classList.remove('ia-tap');
          set(st.hide, false); set(st.show, true);
          if (st.grow) stage.querySelector('.ia-dock').classList.add('ia-grow');
          await sleep(st.hold || 1100); if (!alive()) break;
        }
        ptr.classList.remove('ia-show');
        if (opts.loop === false) break;
        await sleep(600);
      }
      stop();
      opts.onDone?.();
    })();
    return { stop };
  }

  window.InstallAnimation = { mount, scenes: Object.keys(SCENES), label: (id) => SCENES[id]?.label || id };
})();
