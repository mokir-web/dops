// ── Min progress / Progress (Studierektor) ─────────────────────────────────
// Utbruten från den stora index.html-filen som ett första steg i modulariseringen
// (Fas 2). Klassiskt <script>-taggat (INTE type="module") med avsikt: browsern delar
// samma globala scope mellan alla klassiska scripts på sidan, så funktioner och
// let/const-variabler här är fortfarande synliga för resten av appen (t.ex. showPanel()
// i huvudfilen anropar initProgress() och läser _progressCharts direkt), och alla
// onchange="..."-attribut i HTML:en fungerar oförändrat.
//
// Beroenden som förutsätts finnas redan (definieras i huvudfilens <script>, laddas
// före denna fil): activePrivilege, activeKlinikId, currentUser, show(), api(),
// bgGet(), bgSet(), esc(), CHART_COLORS, samt Chart (Chart.js, laddas via CDN).

    let _progressCharts = [];

    // v4.59.0: AI-sammanställningen strömmas (texten växer fram), visas med rubriker och sparas
    // per omfattning (vald formulärtyp, eller översikt) med historik och tumme upp/ner.
    let _aiHistory = [];
    let _aiScopeKey = '';
    let _aiNewSinceLatest = 0;
    let _aiShownRefs = null; // refs för sammanställningen som visas: [nr, datum] → bedömningens id

    function clearProgressAiResult() {
      const resultEl = document.getElementById('progress-ai-result');
      if (resultEl) resultEl.classList.add('hidden');
      ['progress-ai-meta', 'progress-ai-body', 'progress-ai-actions', 'progress-ai-followups', 'progress-ai-history'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '';
      });
      _aiHistory = [];
    }

    function progressAiScope() {
      const isStudierektor = activePrivilege === 'Studierektor';
      return {
        recipientEmail: isStudierektor ? (document.getElementById('progress-recipient')?.value || '') : currentUser.email,
        formType: document.getElementById('progress-formtype')?.value || ''
      };
    }

    // Enkel markdown för AI-svaret: ## rubriker, - punktlistor, **fetstil**. Allt escapas först.
    // Hänvisningar [nr, datum] blir länkar till just den bedömningen (refs[nr-1] = id); utan
    // refs (äldre sammanställningar) visas bara datumet.
    function renderAiMarkdown(md, refs) {
      let out = '', inList = false;
      for (const raw of md.split('\n')) {
        const line = esc(raw).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          .replace(/\[(\d{1,3}), (\d{4}-\d{2}-\d{2})\]/g, (m, nr, date) => {
            const id = refs?.[nr - 1];
            return id ? '<a href="#" class="ai-date" data-id="' + esc(id) + '">' + date + '</a>' : date;
          });
        const li = line.match(/^\s*[-*] (.*)$/);
        if (li) {
          if (!inList) { out += '<ul class="ai-list">'; inList = true; }
          out += '<li>' + li[1] + '</li>';
          continue;
        }
        if (inList) { out += '</ul>'; inList = false; }
        const h = line.match(/^#{1,4} (.*)$/);
        if (h) out += '<h4 class="ai-h">' + h[1] + '</h4>';
        else if (line.trim()) out += '<p class="ai-p">' + line + '</p>';
      }
      return out + (inList ? '</ul>' : '');
    }

    // v4.59.4: statusrad som tydligt visar om den sparade sammanställningen täcker all data.
    // Bara den senaste har ett uträknat antal nya bedömningar (_aiNewSinceLatest).
    function showProgressAiSummary(item) {
      _aiShownRefs = item.refs || null;
      document.getElementById('progress-ai-result').classList.remove('hidden');
      const n = item.assessmentCount;
      const meta = document.getElementById('progress-ai-meta');
      meta.textContent = 'Sparad ' + item.createdAt + ' · baserad på ' + n + (n === 1 ? ' bedömning' : ' bedömningar') + ' ';
      const status = document.createElement('span');
      if (item !== _aiHistory[0]) {
        status.className = 'ai-status ai-status-old';
        status.textContent = 'Äldre sammanställning';
      } else if (_aiNewSinceLatest > 0) {
        status.className = 'ai-status ai-status-new';
        status.textContent = _aiNewSinceLatest + (_aiNewSinceLatest === 1 ? ' ny bedömning' : ' nya bedömningar')
          + ' sedan dess — gör en ny sammanställning för att ta med ' + (_aiNewSinceLatest === 1 ? 'den' : 'dem');
      } else {
        status.className = 'ai-status ai-status-ok';
        status.textContent = '✓ Aktuell — omfattar alla bedömningar';
      }
      meta.append(status);
      document.getElementById('progress-ai-body').innerHTML = renderAiMarkdown(item.content, item.refs)
        + (item.truncated ? '<p class="ai-p" style="color:#9e2a18;">Obs: svaret klipptes av. Gör gärna en ny sammanställning.</p>' : '');
      const actions = document.getElementById('progress-ai-actions');
      actions.innerHTML = '';
      if (item.canRate) renderAiRating(actions, item, 'rateProgressAiSummary', 'Var den till hjälp?');
      renderAiFollowups(item);
    }

    // Tumme upp/ner + diskret kommentarsfält (v4.59.4). target = sammanställning eller följdfrågesvar.
    function renderAiRating(container, target, action, label) {
      container.innerHTML = '';
      const row = document.createElement('div');
      row.className = 'ai-rate-row';
      row.append(label);
      [[1, '👍'], [-1, '👎']].forEach(([value, emoji]) => {
        const b = document.createElement('button');
        b.className = 'btn-secondary btn-small' + (target.rating === value ? ' ai-rated' : '');
        b.textContent = emoji;
        b.onclick = async () => {
          const rating = target.rating === value ? null : value; // samma tumme igen = ångra
          try {
            // Ny tumme = ny kommentar (en 👍-kommentar passar sällan till 👎); fältet visas tomt.
            await api(action, { id: target.id, rating, comment: null });
            target.rating = rating;
            target.ratingComment = null;
            renderAiRating(container, target, action, label);
          } catch (e) { await customAlert('Kunde inte spara: ' + e.message); }
        };
        row.append(b);
      });
      container.append(row);
      if (target.rating !== 1 && target.rating !== -1) return;
      const commentRow = document.createElement('div');
      commentRow.className = 'ai-comment-row';
      const input = document.createElement('input');
      input.type = 'text';
      input.maxLength = 1000;
      input.placeholder = target.rating === 1 ? 'Vad var bra? (valfritt)' : 'Vad kunde ha varit bättre? (valfritt)';
      input.value = target.ratingComment || '';
      const save = document.createElement('button');
      save.className = 'btn-secondary btn-small';
      save.textContent = 'Spara';
      const note = document.createElement('span');
      const submit = async () => {
        try {
          await api(action, { id: target.id, rating: target.rating, comment: input.value.trim() });
          target.ratingComment = input.value.trim() || null;
          note.textContent = 'Sparat';
        } catch (e) { note.textContent = 'Kunde inte spara: ' + e.message; }
      };
      save.onclick = submit;
      input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
      input.addEventListener('input', () => { note.textContent = ''; });
      commentRow.append(input, save, note);
      container.append(commentRow);
    }

    // v4.60.0: följdfrågor — tidigare frågor och svar, och ett frågefält (bara för den som
    // skapade sammanställningen, högst AI_FOLLOWUP_MAX per sammanställning).
    const AI_FOLLOWUP_MAX = 10;
    function renderAiFollowups(item) {
      const el = document.getElementById('progress-ai-followups');
      el.innerHTML = '';
      const list = item.followups || [];
      list.forEach(f => el.append(aiFollowupBlock(f, item.refs)));
      if (item.canAsk && list.length < AI_FOLLOWUP_MAX) {
        const form = document.createElement('div');
        form.className = 'ai-fu-form';
        const ta = document.createElement('textarea');
        ta.rows = 2;
        ta.maxLength = 500;
        ta.placeholder = 'Ställ en följdfråga om sammanställningen, t.ex. "Vad ska jag fokusera på vid nästa operation?"';
        const row = document.createElement('div');
        row.className = 'ai-rate-row';
        const btn = document.createElement('button');
        btn.className = 'btn-secondary btn-small';
        btn.textContent = 'Fråga';
        const count = document.createElement('span');
        count.textContent = list.length + ' av ' + AI_FOLLOWUP_MAX + ' frågor · högst 500 tecken';
        btn.onclick = () => askAiFollowup(item, ta, btn);
        ta.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) askAiFollowup(item, ta, btn); });
        row.append(btn, count);
        form.append(ta, row);
        el.append(form);
      } else if (item.canAsk) {
        el.insertAdjacentHTML('beforeend', '<p class="ai-fu-note">Max antal frågor på den här sammanställningen. Gör en ny sammanställning för att fortsätta.</p>');
      } else if (item.canRate && item === _aiHistory[0]) {
        el.insertAdjacentHTML('beforeend', '<p class="ai-fu-note">Följdfrågor kan ställas på sammanställningar som görs från och med nu. Gör en ny sammanställning för att kunna fråga.</p>');
      }
    }

    function aiFollowupBlock(f, refs) {
      const block = document.createElement('div');
      block.className = 'ai-fu';
      const q = document.createElement('div');
      q.className = 'ai-fu-q';
      q.textContent = 'Du frågade: ' + f.question;
      const a = document.createElement('div');
      a.className = 'ai-fu-a';
      a.innerHTML = renderAiMarkdown(f.answer || '', refs);
      block.append(q, a);
      if (f.id) {
        const rating = document.createElement('div');
        rating.className = 'ai-actions';
        renderAiRating(rating, f, 'rateProgressAiFollowup', 'Hjälpte svaret?');
        block.append(rating);
      }
      return block;
    }

    async function askAiFollowup(item, ta, btn) {
      const question = ta.value.trim();
      if (!question || btn.disabled) return;
      btn.disabled = true; ta.disabled = true;
      const pending = { question, answer: '' };
      const block = aiFollowupBlock(pending, item.refs);
      const answerEl = block.querySelector('.ai-fu-a');
      answerEl.innerHTML = '<p class="ai-p" style="color:#8a97a0;">Tänker…</p>';
      ta.closest('.ai-fu-form').before(block);
      let text = '', done = null, error = null;
      try {
        await apiStream('/progress/ai-summaries/' + encodeURIComponent(item.id) + '/followups', { question }, ev => {
          if (ev.t === 'delta') { text += ev.text; answerEl.innerHTML = renderAiMarkdown(text, item.refs); }
          else if (ev.t === 'done') done = ev;
          else if (ev.t === 'error') error = ev.error;
        });
      } catch (err) { error = err.message; }
      if (error || !done) {
        block.remove();
        btn.disabled = false; ta.disabled = false;
        ta.closest('.ai-fu-form').insertAdjacentHTML('afterbegin', '<p class="ai-fu-note" style="color:#9e2a18;">' + esc(error || 'Inget svar.') + '</p>');
        return;
      }
      (item.followups ||= []).push({ id: done.id, createdAt: done.createdAt, question, answer: text.trim(), rating: null, ratingComment: null });
      renderAiFollowups(item);
    }

    function renderProgressAiHistory(activeId) {
      const el = document.getElementById('progress-ai-history');
      if (!el) return;
      el.innerHTML = '';
      const older = _aiHistory.filter(i => i.id !== activeId);
      if (!older.length) return;
      el.append('Tidigare sammanställningar: ');
      older.forEach(item => {
        const b = document.createElement('button');
        b.textContent = item.createdAt.slice(0, 10);
        b.onclick = () => { showProgressAiSummary(item); renderProgressAiHistory(item.id); };
        el.append(b);
      });
    }

    async function loadProgressAiHistory() {
      const { recipientEmail, formType } = progressAiScope();
      const key = recipientEmail + '|' + formType;
      _aiScopeKey = key;
      if (!recipientEmail) return;
      try {
        const res = await api('getProgressAiSummaries', { recipientEmail, formType });
        if (_aiScopeKey !== key) return; // användaren hann byta urval
        _aiHistory = res.items || [];
        _aiNewSinceLatest = res.newSinceLatest || 0;
        if (_aiHistory[0]) {
          showProgressAiSummary(_aiHistory[0]);
          renderProgressAiHistory(_aiHistory[0].id);
        }
      } catch (e) { console.warn('getProgressAiSummaries:', e); }
    }

    function onAiBodyClick(e) {
      const link = e.target.closest('a.ai-date');
      if (!link) return;
      e.preventDefault();
      showAiRefAssessment(link.dataset.id, link.textContent);
    }

    function closeAiAssessmentModal() {
      const modal = document.getElementById('ai-assessment-modal');
      modal.style.display = 'none'; modal.classList.add('hidden');
    }

    // v4.59.3: visar bedömningen som en hänvisning [nr, datum] i AI-sammanställningen pekar på.
    async function showAiRefAssessment(id, date) {
      const modal = document.getElementById('ai-assessment-modal');
      const body = document.getElementById('ai-assessment-modal-body');
      body.innerHTML = '<p style="color:#8a97a0;margin:0;">Hämtar bedömningen från ' + esc(date) + '…</p>';
      modal.style.display = 'flex'; modal.classList.remove('hidden');
      try {
        const list = await api('getAssessmentsByIds', { recipientEmail: progressAiScope().recipientEmail, ids: id });
        body.innerHTML = '';
        if (!list.length) { body.innerHTML = '<p style="margin:0;">Bedömningen från ' + esc(date) + ' finns inte längre.</p>'; return; }
        list.forEach(a => {
          const card = document.createElement('div');
          card.className = 'assessment-card';
          card.style.cursor = 'default';
          const title = document.createElement('h4');
          title.textContent = a.formType; title.style.margin = '0';
          const meta = document.createElement('div');
          meta.className = 'meta';
          meta.textContent = a.timestamp + (a.registrar ? ' — Registrerare: ' + a.registrar : '');
          card.append(title, meta);
          let lastSection = '';
          a.answers.forEach(ans => {
            if (!ans.answer) return;
            if (ans.section && ans.section !== lastSection) {
              lastSection = ans.section;
              const sec = document.createElement('div');
              sec.className = 'ans-section'; sec.textContent = ans.section;
              card.append(sec);
            }
            const row = document.createElement('div');
            row.className = 'ans-row';
            const desc = appData?.formDescriptions?.[a.formType]?.[ans.question] || '';
            const shown = formatScaleAnswer(a.formType, ans.question, ans.answer, desc);
            const dashIdx = shown.indexOf(' — ');
            row.textContent = (ans.question || '') + ': ' + (dashIdx !== -1 ? shown.slice(0, dashIdx) : shown);
            card.append(row);
          });
          body.append(card);
        });
      } catch (err) {
        body.innerHTML = '<p class="status-err" style="margin:0;">' + esc(err.message) + '</p>';
      }
    }

    async function initProgress() {
      clearProgressAiResult();
      const isStudierektor = activePrivilege === 'Studierektor';
      const titleEl = document.getElementById('progress-title');
      if (titleEl) titleEl.textContent = isStudierektor ? 'Progress' : 'Min progress';
      show('progress-recipient-row', isStudierektor);

      const statusEl  = document.getElementById('progress-swr-status');
      const SPIN = '<span style="font-size:12px;color:#8a97a0;display:flex;align-items:center;gap:5px;"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation:spin 1.2s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>H\u00e4mtar inneh\u00e5ll\u2026</span>';

      // Fyll läkarväljare för studierektor (en gång)
      if (isStudierektor) {
        const recSel = document.getElementById('progress-recipient');
        if (recSel && recSel.options.length === 0) {
          recSel.innerHTML = '<option value="">-- Välj läkare --</option>';
          if (statusEl) statusEl.innerHTML = SPIN;
          try {
            const users = await api('getProgressUsers', { klinikId: activeKlinikId || currentUser.klinikId });
            users.forEach(u => recSel.appendChild(new Option(u.name, u.email)));
          } catch(e) { console.warn('getProgressUsers:', e); }
          if (statusEl) statusEl.innerHTML = '';
          recSel.disabled = recSel.options.length <= 1;
        }
      }

      // Fyll formulärtypsväljare — bara formulär användaren faktiskt fått bedömningar på
      const ftSel = document.getElementById('progress-formtype');
      if (ftSel && ftSel.options.length === 0) {
        ftSel.innerHTML = '<option value="">-- Välj formulärtyp --</option>';
        if (!isStudierektor) {
          const cachedFts = bgGet('progressFormTypes_' + currentUser.email);
          if (cachedFts) {
            cachedFts.forEach(ft => ftSel.appendChild(new Option(ft, ft)));
          } else {
            if (statusEl) statusEl.innerHTML = SPIN;
            try {
              const fts = await api('getProgressFormTypes', { recipientEmail: currentUser.email });
              bgSet('progressFormTypes_' + currentUser.email, fts);
              fts.forEach(ft => ftSel.appendChild(new Option(ft, ft)));
            } catch(e) { console.warn('getProgressFormTypes:', e); }
            if (statusEl) statusEl.innerHTML = '';
          }
        }
        ftSel.disabled = ftSel.options.length <= 1;
      }
      loadProgressData();
    }

    async function onProgressRecipientChange() {
      clearProgressAiResult();
      loadProgressAiHistory();
      const ftSel = document.getElementById('progress-formtype');
      ftSel.innerHTML = '<option value="">-- Välj formulärtyp --</option>';
      ftSel.disabled = true;
      document.getElementById('progress-content').innerHTML = '';
      const email = document.getElementById('progress-recipient')?.value;
      if (email) {
        try {
          const fts = await api('getProgressFormTypes', { recipientEmail: email });
          fts.forEach(ft => ftSel.appendChild(new Option(ft, ft)));
        } catch(e) { console.warn('getProgressFormTypes:', e); }
        ftSel.disabled = ftSel.options.length <= 1;
      }
    }

    async function loadProgressData() {
      clearProgressAiResult();
      loadProgressAiHistory();
      const isStudierektor = activePrivilege === 'Studierektor';
      const recipientEmail = isStudierektor
        ? (document.getElementById('progress-recipient')?.value || '')
        : currentUser.email;
      const formType = document.getElementById('progress-formtype')?.value || '';
      const dateFrom = document.getElementById('progress-from')?.value  || null;
      const dateTo   = document.getElementById('progress-to')?.value    || null;

      const el       = document.getElementById('progress-content');
      const statusEl = document.getElementById('progress-swr-status');

      if (!formType || (isStudierektor && !recipientEmail)) {
        if (el) {
          const showGuide = !formType && (!isStudierektor || !!recipientEmail);
          el.innerHTML = showGuide ? '<p style="color:#8a97a0;margin-top:8px;">V\u00e4lj formulärtyp ovan f\u00f6r att visa din progress.</p>' : '';
        }
        if (statusEl) statusEl.innerHTML = '';
        return;
      }

      _progressCharts.forEach(c => { try { c.destroy(); } catch(_){} });
      _progressCharts = [];

      const cacheKey = 'progressData_' + recipientEmail + '_' + formType + '_' + (dateFrom || 'x') + '_' + (dateTo || 'x');
      const cachedData = bgGet(cacheKey);
      const SPIN = '<span style="font-size:12px;color:#8a97a0;display:flex;align-items:center;gap:5px;"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation:spin 1.2s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>H\u00e4mtar inneh\u00e5ll\u2026</span>';

      if (cachedData) {
        renderProgress(cachedData);
        if (statusEl) statusEl.innerHTML = SPIN; // revalidera alltid i bakgrunden
      } else {
        if (statusEl) statusEl.innerHTML = SPIN;
        el.innerHTML = '';
      }

      try {
        const data = await api('getProgressData', { recipientEmail, formType, dateFrom, dateTo });
        bgSet(cacheKey, data);
        if (statusEl) statusEl.innerHTML = '';
        if (cachedData && JSON.stringify(data) === JSON.stringify(cachedData)) return; // oförändrat
        _progressCharts.forEach(c => { try { c.destroy(); } catch(_){} });
        _progressCharts = [];
        renderProgress(data);
      } catch(e) {
        if (statusEl) statusEl.innerHTML = '';
        if (!cachedData) el.innerHTML = html`<p class="status-err">${e.message}</p>`;
      }
    }

    async function runProgressAiSummary() {
      const { recipientEmail, formType } = progressAiScope();
      if (!recipientEmail) {
        await customAlert('Välj läkare först.');
        return;
      }
      const btn = document.getElementById('progress-ai-btn');
      const body = document.getElementById('progress-ai-body');
      const origText = btn.textContent;
      btn.disabled = true; btn.textContent = 'Analyserar…';
      document.getElementById('progress-ai-result').classList.remove('hidden');
      document.getElementById('progress-ai-meta').textContent = formType ? 'Ny sammanställning: ' + formType : 'Ny sammanställning: alla formulärtyper';
      document.getElementById('progress-ai-actions').innerHTML = '';
      document.getElementById('progress-ai-followups').innerHTML = '';
      body.innerHTML = '<p class="ai-p" style="color:#8a97a0;">Läser underlaget och analyserar… Texten börjar visas efter några sekunder.</p>';
      _aiShownRefs = null;
      let text = '', done = null, error = null;
      try {
        await apiStream('/progress/ai-summary', { recipientEmail, formType }, ev => {
          if (ev.t === 'refs') _aiShownRefs = ev.refs;
          else if (ev.t === 'delta') { text += ev.text; body.innerHTML = renderAiMarkdown(text, _aiShownRefs); }
          else if (ev.t === 'done') done = ev;
          else if (ev.t === 'error') error = ev.error;
          else if (ev.summary) body.innerHTML = '<p class="ai-p">' + esc(ev.summary) + '</p>'; // inget underlag
        });
      } catch (err) {
        error = err.message;
      } finally {
        btn.disabled = false; btn.textContent = origText;
      }
      if (error) {
        body.insertAdjacentHTML('beforeend', '<p class="ai-p" style="color:#9e2a18;">Kunde inte slutföra AI-sammanställningen: ' + esc(error) + '</p>');
        return;
      }
      if (done) await loadProgressAiHistory(); // visar den sparade versionen med tumme upp/ner
    }

    function renderProgress({ submissions, formDef }) {
      const el = document.getElementById('progress-content');
      if (!submissions || !submissions.length) {
        el.innerHTML = '<p style="color:#8a97a0;margin-top:8px;">Inga bed\u00f6mningar hittades f\u00f6r valt urval.</p>';
        return;
      }

      const sorted = [...submissions].sort((a, b) => new Date(a.ts) - new Date(b.ts));
      const pendingCharts = [];
      let out = '<div class="progress-charts-grid">';

      formDef.forEach((q, qi) => {
        if (q.typ === 'skala') {
          const points = sorted.map(s => {
            const a = s.answers.find(a => a.question === q.question);
            return a ? (parseFloat(a.answer) || null) : null;
          });
          const valid = points.filter(p => p !== null);
          if (!valid.length) return; // inget att visa
          const avg = valid.length
            ? (valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(1)
            : null;

          // Detektera skalans max genom att hitta det högsta talet i beskrivningen
          const allNums = [...q.beskrivning.matchAll(/(\d+):/g)].map(m => parseInt(m[1]));
          const minScale = allNums.length ? Math.min(...allNums) : 1;
          const maxScale = allNums.length ? Math.max(...allNums) : 5;

          // Plocka ut beskrivningar per nivå (ta bort mellannivåer utan text)
          const descParts = q.beskrivning
            .split(' | ')
            .map(p => p.trim())
            .filter(p => /^\d+:\s*.+/.test(p));

          const canvasId = `pgc_${qi}`;
          out += `<div style="background:#eef1f3;border:1.5px solid #c7d1d7;border-radius:8px;padding:16px;">
            <div style="display:flex;align-items:baseline;justify-content:space-between;flex-wrap:wrap;gap:4px;margin-bottom:10px;">
              <span style="font-weight:bold;font-size:14px;">${esc(q.question)}</span>
              <span style="font-size:12px;color:#8a97a0;">n=${valid.length}</span>
              ${avg !== null ? `<span style="font-size:13px;color:#2e4a5f;font-weight:bold;">\u00d8\u00a0${avg}</span>` : ''}
            </div>
            <div class="progress-chart-wrap" style="width:100%;"><canvas id="${canvasId}"></canvas></div>
            ${descParts.length ? `<div style="margin-top:10px;font-size:11px;color:#8a97a0;line-height:1.6;">${descParts.map(p => esc(p)).join('&nbsp;&nbsp;&bull;&nbsp;&nbsp;')}</div>` : ''}
          </div>`;

          pendingCharts.push({ canvasId, points, sorted, avg, minScale, maxScale, categorical: false, categories: null });

        } else if (q.typ === 'radio' && q.options && q.options.length) {
          // Textvärden (t.ex. Roll: Assistent/Blandbild/Operatör) — kategoriordning = ordningen
          // frågan är definierad med i formulärbyggaren, samma varje gång.
          const categories = q.options;
          const points = sorted.map(s => {
            const a = s.answers.find(a => a.question === q.question);
            if (!a || !a.answer) return null;
            const idx = categories.indexOf(a.answer.trim());
            return idx === -1 ? null : idx;
          });
          const valid = points.filter(p => p !== null);
          if (!valid.length) return; // inget att visa

          const canvasId = `pgc_${qi}`;
          out += `<div style="background:#eef1f3;border:1.5px solid #c7d1d7;border-radius:8px;padding:16px;">
            <div style="display:flex;align-items:baseline;justify-content:space-between;flex-wrap:wrap;gap:4px;margin-bottom:10px;">
              <span style="font-weight:bold;font-size:14px;">${esc(q.question)}</span>
              <span style="font-size:12px;color:#8a97a0;">n=${valid.length}</span>
            </div>
            <div class="progress-chart-wrap" style="width:100%;"><canvas id="${canvasId}"></canvas></div>
          </div>`;

          pendingCharts.push({ canvasId, points, sorted, avg: null, minScale: 0, maxScale: categories.length - 1, categorical: true, categories });
        }
        // fritext hanteras separat nedan (pool-metod)
      });
      out += '</div>'; // .progress-charts-grid

      // Fritextpool: samla ALLA icke-numeriska textsvar oavsett frågenamn
      // (fångar även svar från äldre formulärversioner med andra frågenamn)
      const _skalaRadioQs = new Set(
        formDef.filter(q => q.typ === 'skala' || q.typ === 'radio').map(q => q.question.trim().toLowerCase())
      );
      const _structuralNames = new Set(['roll','ingrepp','källa','datum','procedur']);
      const freeTextPool = {};
      sorted.forEach(s => {
        s.answers.forEach(a => {
          if (!a.answer || !a.answer.trim() || a.answer.trim().length < 3) return;
          const qLower = a.question.trim().toLowerCase();
          if (_skalaRadioQs.has(qLower)) return;          // hoppa skalafrågor
          if (_structuralNames.has(qLower)) return;        // hoppa strukturella
          if (/^\d+(\.\d+)?$/.test(a.answer.trim())) return; // hoppa rena siffror
          const key = a.question.trim();
          if (!freeTextPool[key]) freeTextPool[key] = [];
          freeTextPool[key].push({ ts: s.ts, text: a.answer.trim(), registrar: s.registrar });
        });
      });


      // Fritextsvar
      const ftKeys = Object.keys(freeTextPool).filter(k => freeTextPool[k].length);
      if (ftKeys.length) {
        out += `<div class="section-header" style="margin-top:4px;margin-bottom:14px;">Fritextsvar</div>`;
        ftKeys.forEach(question => {
          out += `<div style="font-weight:bold;font-size:14px;margin:12px 0 6px;">${esc(question)}</div>`;
          freeTextPool[question].forEach(a => {
            out += `<div style="background:#fff;border:1.5px solid #c7d1d7;border-radius:8px;padding:10px 14px;margin-bottom:8px;max-width:700px;">
              <div style="font-size:11px;color:#8a97a0;margin-bottom:4px;">${esc(a.ts)} \u2014 ${esc(a.registrar)}</div>
              <div style="font-size:14px;">${esc(a.text)}</div>
            </div>`;
          });
        });
      }

      el.innerHTML = out;

      requestAnimationFrame(() => {
        pendingCharts.forEach(({ canvasId, points, sorted, avg, minScale, maxScale, categorical, categories }) => {
          const ctx = document.getElementById(canvasId)?.getContext('2d');
          if (!ctx) return;

          const dataPoints = sorted
            .map((s, i) => ({ x: new Date(s.ts).getTime(), y: points[i] }))
            .filter(d => d.y !== null && !isNaN(d.x));

          if (!dataPoints.length) return;

          const avgVal = avg !== null ? parseFloat(avg) : null;
          const xMin = dataPoints[0].x;
          const xMax = dataPoints[dataPoints.length - 1].x;

          const datasets = [{
            label: categorical ? 'Svar' : 'Po\u00e4ng',
            data: dataPoints,
            borderColor: CHART_COLORS[0],
            backgroundColor: CHART_COLORS[0] + '33',
            fill: !categorical,
            stepped: categorical ? 'middle' : false,
            tension: categorical ? 0 : 0.3,
            borderWidth: 2,
            pointBackgroundColor: CHART_COLORS[0],
            pointRadius: 5,
            pointHoverRadius: 7,
            spanGaps: true
          }];

          if (avgVal !== null) {
            datasets.push({
              label: `Snitt ${avg}`,
              data: [{ x: xMin, y: avgVal }, { x: xMax, y: avgVal }],
              borderColor: CHART_COLORS[3],
              borderDash: [6, 4],
              borderWidth: 1.5,
              pointRadius: 0,
              fill: false,
              tension: 0
            });
          }

          const chart = new Chart(ctx, {
            type: 'line',
            data: { datasets },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              resizeDelay: 100,
              animation: false,
              scales: {
                x: {
                  type: 'linear',
                  ticks: {
                    maxTicksLimit: 7,
                    font: { size: 11 },
                    callback: v => {
                      const d = new Date(v);
                      return isNaN(d) ? '' : d.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' });
                    }
                  },
                  grid: { color: 'rgba(0,0,0,0.04)' }
                },
                y: {
                  min: minScale - 0.5,
                  max: maxScale + 0.5,
                  afterBuildTicks: scale => {
                    scale.ticks = [];
                    for (let i = minScale; i <= maxScale; i++) scale.ticks.push({ value: i });
                  },
                  ticks: { font: { size: 11 }, callback: v => categorical ? (categories[v] ?? '') : v },
                  grid: { color: 'rgba(0,0,0,0.13)', lineWidth: 1 }
                }
              },
              plugins: {
                legend: {
                  display: avgVal !== null,
                  labels: { font: { size: 11 }, boxWidth: 20, padding: 10 }
                },
                tooltip: {
                  callbacks: {
                    title: items => {
                      const d = new Date(items[0].parsed.x);
                      return isNaN(d) ? '' : d.toLocaleDateString('sv-SE', { year: 'numeric', month: 'short', day: 'numeric' });
                    },
                    label: item => categorical ? (categories[item.parsed.y] ?? '') : `Po\u00e4ng: ${item.parsed.y}`
                  }
                }
              }
            }
          });
          _progressCharts.push(chart);
        });
      });
    }
