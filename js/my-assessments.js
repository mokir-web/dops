// ── Mina bedömningar ─────────────────────────────────────────────────────────
// Utbruten från index.html (Fas 2, modularisering). Klassiskt script (ej
// type="module") — se js/progress.js för motivering och beroendemodell.
//
// Beroenden som förutsätts finnas redan (huvudfilen): api(), esc(), show(),
// swr(), currentUser, currentAssessmentRole, currentAssessments,
// availableFormTypes, _resetFormTypeFilterOnNextRender, _pendingFormFilter
// (den sistnämnda skrivs av navigateToAssessments i js/overview.js), _isProcessing,
// lockUI()/unlockUI(), customAlert(), bgGet(), updateFaviconNotification().
// Dessa ligger kvar i huvudfilen eftersom de även läses/skrivs därifrån
// (t.ex. showPanel()) — fungerar som vanligt eftersom klassiska scripts delar
// samma globala scope, oavsett var en variabel råkar vara deklarerad.

    function toggleAssessmentFilter() {
      const panel = document.getElementById('assessment-filter-panel');
      const btn   = document.getElementById('filter-toggle-btn');
      const open  = panel.classList.toggle('hidden') === false;
      btn.textContent = open ? 'Stäng filter' : 'Filtrera';
    }
    function setAssessmentTab(role) {
      currentAssessmentRole = role;
      document.getElementById('tab-sent').className     = role === 'sent'     ? 'tab-btn active' : 'tab-btn';
      document.getElementById('tab-received').className = role === 'received' ? 'tab-btn active' : 'tab-btn';
      document.getElementById('my-assessments-list').innerHTML = '';
      document.getElementById('filter-date-from').value = '';
      document.getElementById('filter-date-to').value   = '';
      _resetFormTypeFilterOnNextRender = true;
      if (role === 'received') clearAssessmentBadge();
      applyFilters();
    }
    async function applyFilters() {
      const dateFrom     = document.getElementById('filter-date-from').value;
      const dateTo       = document.getElementById('filter-date-to').value;
      const checkedTypes = [...document.querySelectorAll('#filter-formtypes input:checked')].map(cb => cb.value);
      const allTypesChecked = availableFormTypes.length > 0 && checkedTypes.length === availableFormTypes.length;
      // "Alla ikryssade" motsvarar inget filter alls (samma resultat, samma snabba SWR-väg).
      const effectiveTypes = allTypesChecked ? [] : checkedTypes;
      const filters = { dateFrom: dateFrom || null, dateTo: dateTo || null, formTypes: effectiveTypes };
      const noFilter = !dateFrom && !dateTo && effectiveTypes.length === 0;
      const cacheKey = 'myAssessments_' + currentAssessmentRole;
      const statusEl = document.getElementById('assessment-swr-status');

      if (noFilter) {
        await swr(
          cacheKey,
          () => api('getMyAssessments', { email: currentUser.email, role: currentAssessmentRole, filters }),
          data => {
            if (!data) return;
            currentAssessments = data;
            renderAssessments(data, currentAssessmentRole);
            updateFormTypeFilters(data);
          },
          statusEl,
          (fresh, old) => Math.max(0, fresh.length - old.length)
        );
        return;
      }
      if (statusEl) statusEl.innerHTML = '<span style="font-size:12px;color:#8a97a0;">Söker efter uppdateringar…</span>';
      document.getElementById('select-all').checked = false;
      show('assessment-actions', false);
      try {
        const assessments = await api('getMyAssessments', { email: currentUser.email, role: currentAssessmentRole, filters });
        currentAssessments = assessments;
        renderAssessments(assessments, currentAssessmentRole);
        updateFormTypeFilters(assessments);
      } catch(err) {
        document.getElementById('my-assessments-list').innerHTML = `<p class="status-err">${esc(err.message)}</p>`;
      } finally {
        if (statusEl) statusEl.innerHTML = '';
      }
    }
    function resetFilters() {
      document.getElementById('filter-date-from').value = '';
      document.getElementById('filter-date-to').value   = '';
      document.querySelectorAll('#filter-formtypes input').forEach(cb => cb.checked = true);
      applyFilters();
    }
    function updateFormTypeFilters(assessments) {
      const types = [...new Set(assessments.map(a => a.formType))].sort();
      availableFormTypes = types;
      const counts = {};
      assessments.forEach(a => { counts[a.formType] = (counts[a.formType]||0)+1; });
      const container = document.getElementById('filter-formtypes');
      if (!container) return;
      // Spara befintligt val innan rebuild så SWR-revalidering inte nollställer filter
      const prevChecked = new Set([...container.querySelectorAll('input[type=checkbox]:checked')].map(cb => cb.value));
      const forceAllChecked = _resetFormTypeFilterOnNextRender;
      _resetFormTypeFilterOnNextRender = false;
      container.innerHTML = '';
      types.forEach(t => {
        const lbl = document.createElement('label'); lbl.className = 'filter-chip';
        const cb = document.createElement('input'); cb.type = 'checkbox'; cb.value = t;
        cb.checked = forceAllChecked ? true : prevChecked.has(t);
        lbl.appendChild(cb);
        lbl.appendChild(document.createTextNode(`${t} (${counts[t]})`));
        container.appendChild(lbl);
      });
      // Tillämpa pending filter från navigateToAssessments (överskriver sparat val)
      if (_pendingFormFilter) {
        const pf = _pendingFormFilter; _pendingFormFilter = null;
        container.querySelectorAll('input[type=checkbox]').forEach(cb => { cb.checked = cb.value === pf; });
        applyFilters(); // kör om med filtret satt
      }
    }
    function renderAssessments(assessments, role) {
      const list = document.getElementById('my-assessments-list');
      if (!assessments.length) {
        const hasFilter = document.getElementById('filter-date-from')?.value || document.getElementById('filter-date-to')?.value
          || document.querySelectorAll('#filter-formtypes input:checked').length > 0;
        list.innerHTML = hasFilter
          ? '<p style="color:#888">Inga bedömningar hittades för vald filtrering.</p>'
          : '<p style="color:#888">Inga bedömningar hittades.</p>';
        show('assessment-actions', false);
        return;
      }
      list.innerHTML = `<p style="color:#666; font-size:13px;">${assessments.length} bedömning(ar) — ${role === 'sent' ? 'skickade' : 'mottagna'}</p>`;
      show('assessment-actions', true);
      updateSelectedCount();
      assessments.forEach((a, idx) => {
        const card = document.createElement('div');
        card.className = 'assessment-card';
        const topRow = document.createElement('div');
        topRow.style.cssText = 'display:flex; align-items:center; gap:10px;';
        const cb = document.createElement('input');
        cb.type = 'checkbox'; cb.className = 'assessment-checkbox'; cb.dataset.idx = idx;
        cb.onchange = updateSelectedCount;
        if (document.getElementById('select-all').checked) cb.checked = true;
        topRow.appendChild(cb);
        const title = document.createElement('h4');
        title.textContent = a.formType; title.style.margin = '0';
        topRow.appendChild(title);
        card.appendChild(topRow);
        const meta = document.createElement('div');
        meta.className = 'meta';
        meta.textContent = role === 'sent'
          ? `${a.timestamp} — Mottagare: ${(a.recipient || '').split(' -- ')[0]}`
          : `${a.timestamp} — Registrerare: ${a.registrar || ''}`;
        card.appendChild(meta);
        card.style.cursor = 'pointer';
        const answersDiv = document.createElement('div');
        answersDiv.className = 'assessment-answers hidden';
        let lastSection = '';
        a.answers.forEach(ans => {
          if (ans.section !== lastSection) {
            lastSection = ans.section;
            const s = document.createElement('div');
            s.className = 'ans-section'; s.textContent = ans.section;
            answersDiv.appendChild(s);
          }
          const r = document.createElement('div');
          r.className = 'ans-row';
          const desc = appData?.formDescriptions?.[a.formType]?.[ans.question] || '';
          const displayAnswer = formatScaleAnswer(a.formType, ans.question, ans.answer, desc);
          // Separera "Fråga: värde (skala)" från eventuell lång beskrivningstext
          const dashIdx = displayAnswer.indexOf(' — ');
          if (dashIdx !== -1) {
            r.textContent = `${ans.question || ''}: ${displayAnswer.slice(0, dashIdx)}`;
            const dl = document.createElement('div');
            dl.className = 'ans-desc';
            dl.textContent = displayAnswer.slice(dashIdx + 3);
            answersDiv.appendChild(r);
            answersDiv.appendChild(dl);
          } else {
            r.textContent = `${ans.question || ''}: ${displayAnswer}`;
            answersDiv.appendChild(r);
          }
        });
        card.onclick = (e) => {
          if (e.target === cb || e.target.tagName === 'BUTTON') return;
          answersDiv.classList.toggle('hidden');
        };
        if (role === 'sent') {
          const delBtn = document.createElement('button');
          delBtn.className = 'btn-danger btn-small';
          delBtn.textContent = 'Radera';
          delBtn.style.marginLeft = '8px';
          delBtn.onclick = async () => {
            if (!await customConfirm('Radera denna bedömning? En eventuell tillhörande förfrågan återgår till öppen. Kan inte ångras.')) return;
            try {
              await api('deleteAssessment', { id: a.id });
              bgMarkStale('myAssessments_sent');
              applyFilters();
            } catch (err) { await customAlert(err.message); }
          };
          card.appendChild(delBtn);
        }
        card.appendChild(answersDiv);
        list.appendChild(card);
      });
    }
    function toggleSelectAll(checked) {
      document.querySelectorAll('.assessment-checkbox').forEach(cb => cb.checked = checked);
      updateSelectedCount();
    }
    function updateSelectedCount() {
      const count = document.querySelectorAll('.assessment-checkbox:checked').length;
      document.getElementById('selected-count').textContent = count > 0 ? `${count} markerade` : '';
    }
    async function exportSelected() {
      if (_isProcessing) return;
      const btn = document.querySelector('#assessment-actions .btn-primary');
      const origBtnText = btn?.textContent || 'Exportera';
      if (btn) { btn.textContent = 'Exporterar\u2026'; btn.disabled = true; }
      lockUI();
      const selected = [...document.querySelectorAll('.assessment-checkbox:checked')]
        .map(cb => currentAssessments[parseInt(cb.dataset.idx)]);
      if (!selected.length) { await customAlert('Markera minst en bedömning.'); if (btn) { btn.textContent = origBtnText; btn.disabled = false; } unlockUI(); return; }
      const dateFrom = document.getElementById('filter-date-from').value;
      const dateTo   = document.getElementById('filter-date-to').value;
      const period   = (dateFrom || dateTo)
        ? `${dateFrom || '\u2026'} \u2013 ${dateTo || new Date().toISOString().slice(0,10)}`
        : `Alla \u2014 ${new Date().toISOString().slice(0,10)}`;
      const filterInfo = {
        name:   `${currentUser.firstName} ${currentUser.lastName}`,
        clinic:  currentUser.clinic,
        period
      };
      try {
        const result = await api('exportAssessmentsToDoc', { email: currentUser.email, assessments: selected, filterInfo });
        // Bekräftelse på knappen, avmarkera alla
        if (btn) { btn.textContent = '\u2713 Skickat!'; }
        document.querySelectorAll('.assessment-checkbox:checked').forEach(cb => { cb.checked = false; });
        document.getElementById('export-status').textContent = '';
        setTimeout(() => { if (btn) { btn.textContent = origBtnText; btn.disabled = false; } unlockUI(); }, 2000);
      } catch(err) { setStatus('export-status', err.message, true); if (btn) { btn.textContent = origBtnText; btn.disabled = false; } unlockUI(); }
    }
    function updateAssessmentBadge() {
      const data = bgGet('myAssessments_received');
      if (!data || !currentUser) return;
      const lastReadAt = currentUser.lastReadAt
        || localStorage.getItem('dops_last_read_' + currentUser.email)
        || '';
      const newCount = lastReadAt
        ? data.filter(a => (a.timestamp || '') > lastReadAt).length
        : data.length;
      const badge = document.getElementById('my-assessments-badge');
      if (!badge) return;
      badge.textContent = newCount > 0 ? String(newCount) : '';
      badge.classList.toggle('hidden', newCount === 0);
      updateFaviconNotification();
    }
    function clearAssessmentBadge() {
      if (!currentUser) return;
      const pad = n => String(n).padStart(2, '0');
      const now = new Date();
      const lastReadAt = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
      localStorage.setItem('dops_last_read_' + currentUser.email, lastReadAt);
      currentUser.lastReadAt = lastReadAt;
      localStorage.setItem('dops_user', JSON.stringify(currentUser));
      api('setLastReadAt', { email: currentUser.email, lastReadAt }).catch(() => {});
      updateAssessmentBadge();
    }
