// ── Kvartalstävling (v4.53.0) ────────────────────────────────────────────────
// Fliken Kvartalstävling (Studierektor/Administratör) och den preliminära prispallen
// överst i Klinikens statistik (alla i kliniken). Klassiskt script (ej type="module") —
// se js/progress.js för motivering och beroendemodell.
//
// Beroenden (huvudfilen/andra scripts): api(), html(), safe(), jsAttr(), show(), setStatus(),
// newOption(), customAlert(), customConfirm(), lockUI()/unlockUI(), _isProcessing,
// currentUser, activeKlinikId, appData, _mrClinicChoices() (js/request-stats.js).

    let _compKlinikId = null;
    let _compData = null;

    function _compDate(d) {
      const [y, m, day] = (d || '').split('-').map(Number);
      if (!y) return '';
      return `${day} ${['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'][m - 1]} ${y}`;
    }

    // Prispall för en topplista: plats 2 – 1 – 3 i trappform. Delade placeringar visas
    // tillsammans på samma trappsteg ("Per Ek, Stina Rektor").
    function competitionPodiumHtml(title, list) {
      const byPlace = {};
      (list || []).filter(r => r.place <= 3).forEach(r => { (byPlace[r.place] ||= []).push(r); });
      const step = (place, height, color) => {
        const people = byPlace[place];
        if (!people) return html`<div class="comp-step"><div class="comp-block comp-empty" style="height:${height}px;"></div></div>`;
        return html`<div class="comp-step">
          <div class="comp-name">${people.map(p => p.name).join(', ')}</div>
          <div class="comp-count">${people[0].count} st</div>
          <div class="comp-block" style="height:${height}px;background:${safe(color)};">${place}</div>
        </div>`;
      };
      const empty = !Object.keys(byPlace).length;
      return html`<div class="comp-board"><div class="comp-board-title">${title}</div>
        ${empty ? safe('<p class="comp-none">Inga bedömningar ännu i omgången.</p>')
          : safe(`<div class="comp-podium">${step(2, 46, '#9aa6ae')}${step(1, 64, '#c8a13e')}${step(3, 32, '#b07a4a')}</div>`)}</div>`;
    }

    function competitionPodiumsHtml(podium) {
      return `<div class="comp-podiums">${competitionPodiumHtml('Flitigaste bedömare', podium.registrars)}${competitionPodiumHtml('Flest mottagna bedömningar', podium.recipients)}</div>`;
    }

    // ── Klinikens statistik: preliminär prispall överst (alla användare) ─────
    async function loadStatCompetition(klinikId) {
      const el = document.getElementById('stat-competition');
      if (!el) return;
      if (!klinikId || klinikId === '*') { el.innerHTML = ''; return; }
      try {
        const d = await api('getCompetition', { klinikId });
        if (!d?.current) { el.innerHTML = ''; return; }
        const c = d.current;
        el.innerHTML = html`<div class="comp-card">
          <div class="comp-head"><strong>🏆 Kvartalstävling</strong>
            <span>${_compDate(c.startDate)} – ${_compDate(c.endDate)} · ${c.daysLeft === 0 ? 'sista dagen' : c.daysLeft + ' dagar kvar'} · preliminärt resultat</span></div>
          ${safe(competitionPodiumsHtml(c.podium))}
        </div>`;
      } catch (e) { el.innerHTML = ''; /* tävlingen är en bonus — statistiken ska visas ändå */ }
    }

    // ── Fliken Kvartalstävling (Studierektor/Administratör) ───────────────────
    async function loadCompetition() {
      const el = document.getElementById('competition-content');
      const fixed = activeKlinikId && activeKlinikId !== '*' ? activeKlinikId : null;
      const choices = fixed ? [] : _mrClinicChoices();
      show('comp-clinic-field', !fixed);
      if (!fixed) {
        if (!choices.length) { el.innerHTML = '<p style="color:#8a97a0;">Hittade ingen klinik du har behörighet för.</p>'; return; }
        const sel = document.getElementById('comp-clinic');
        const prev = _compKlinikId && choices.some(c => c.id === _compKlinikId) ? _compKlinikId : null;
        sel.innerHTML = '';
        choices.forEach(c => sel.appendChild(newOption(c.id, c.name)));
        sel.value = prev || (choices.some(c => c.id === currentUser.klinikId) ? currentUser.klinikId : choices[0].id);
      }
      _compKlinikId = fixed || document.getElementById('comp-clinic').value;
      el.innerHTML = '<p style="color:#8a97a0;font-size:13px;">Hämtar…</p>';
      try {
        _compData = await api('getCompetition', { klinikId: _compKlinikId });
        renderCompetition();
      } catch (err) { el.innerHTML = html`<p class="status-err">${err.message}</p>`; }
    }

    function _compList(title, list) {
      if (!list?.length) return '';
      return html`<div class="comp-list"><div class="comp-board-title">${title}</div>
        <table>${safe(list.map(r => html`<tr class="${r.place <= 3 ? 'top' : ''}"><td class="pl">${r.place}.</td><td>${r.name}</td><td class="ct">${r.count}</td></tr>`).join(''))}</table></div>`;
    }

    function renderCompetition() {
      const el = document.getElementById('competition-content');
      const d = _compData;
      if (!el || !d) return;
      let out = '';
      const c = d.current;
      if (c) {
        out += html`<div class="comp-card">
          <div class="comp-head"><strong>Pågående omgång</strong>
            <span>${_compDate(c.startDate)} – ${_compDate(c.endDate)} · ${c.daysLeft === 0 ? 'sista dagen' : c.daysLeft + ' dagar kvar'}</span></div>
          ${safe(competitionPodiumsHtml(c.podium))}
          <div class="comp-lists">${safe(_compList('Alla bedömare', c.registrars))}${safe(_compList('Alla bedömda', c.recipients))}</div>
        </div>`;
      } else {
        out += '<p style="color:#5b6b75;">Ingen pågående omgång. Välj ett startdatum nedan för att starta tävlingen.</p>';
      }
      if (d.upcoming) {
        out += html`<div class="comp-upcoming">Nästa omgång är planerad: <strong>${_compDate(d.upcoming.startDate)} – ${_compDate(d.upcoming.endDate)}</strong>
          <button class="btn-secondary btn-small" onclick="deleteCompetitionRound('${safe(jsAttr(d.upcoming.id))}')">Ta bort</button></div>`;
      }
      out += html`<div class="section-header" style="margin-top:22px;">Starta ny omgång</div>
        <div class="filter-box" style="max-width:560px;margin-top:10px;">
          <div class="field" style="margin-top:0;"><label class="field-label">Startdatum</label>
            <input type="date" id="comp-start" value="${d.today}" onchange="updateCompetitionHint()" style="max-width:220px;"></div>
          <p id="comp-hint" style="font-size:13px;color:#5b6b75;margin:4px 0 10px;"></p>
          <button class="btn-primary" onclick="startCompetitionRound()">Starta omgång</button>
          <div id="comp-status"></div>
        </div>`;
      if (d.history?.length) {
        out += '<div class="section-header" style="margin-top:22px;">Tidigare omgångar</div>';
        d.history.forEach(h => {
          out += html`<div class="comp-card comp-past"><div class="comp-head"><strong>${_compDate(h.startDate)} – ${_compDate(h.endDate)}</strong>${h.endedEarly ? safe('<span>avslutad i förtid</span>') : ''}</div>
            ${safe(competitionPodiumsHtml(h.podium))}</div>`;
        });
      }
      el.innerHTML = out;
      updateCompetitionHint();
    }

    // Förklarar vad som händer innan man trycker: 3 månader, och om en pågående avbryts.
    function updateCompetitionHint() {
      const hint = document.getElementById('comp-hint');
      const start = document.getElementById('comp-start')?.value;
      if (!hint || !start) return;
      const [y, m, day] = start.split('-').map(Number);
      const end = new Date(Date.UTC(y, m - 1 + 3, day));
      if (end.getUTCDate() !== day) end.setUTCDate(0); else end.setUTCDate(end.getUTCDate() - 1);
      let t = `Omgången pågår ${_compDate(start)} – ${_compDate(end.toISOString().slice(0, 10))}.`;
      const c = _compData?.current;
      if (c && start > c.startDate && start <= c.endDate) t += ` Pågående omgång avslutas ${_compDate(new Date(Date.parse(start) - 86400000).toISOString().slice(0, 10))} och sparas i historiken.`;
      if (start > (_compData?.today || '')) t += ' Omgången är planerad och startar automatiskt.';
      hint.textContent = t;
    }

    async function startCompetitionRound() {
      if (_isProcessing) return;
      const startDate = document.getElementById('comp-start')?.value;
      if (!startDate) { setStatus('comp-status', 'Välj ett startdatum.', true); return; }
      const c = _compData?.current;
      if (c && startDate > c.startDate && startDate <= c.endDate
          && !await customConfirm('Den pågående omgången avslutas och sparas med resultatet så här långt. Starta ny omgång?', 'Starta', 'Avbryt')) return;
      lockUI();
      try {
        await api('startCompetitionRound', { klinikId: _compKlinikId, startDate });
        unlockUI();
        await loadCompetition();
        setStatus('comp-status', '✓ Omgången är sparad.', false);
      } catch (err) { unlockUI(); setStatus('comp-status', err.message, true); }
    }

    async function deleteCompetitionRound(id) {
      if (!await customConfirm('Ta bort den planerade omgången?', 'Ta bort', 'Avbryt')) return;
      try { await api('deleteCompetitionRound', { id }); await loadCompetition(); }
      catch (err) { await customAlert(err.message); }
    }
