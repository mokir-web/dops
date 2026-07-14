// ── Klinikens bedömningar ────────────────────────────────────────────────────
// Utbruten från index.html (Fas 2, modularisering). Klassiskt script (ej
// type="module") — se js/progress.js för motivering och beroendemodell.
// Beroenden (huvudfilen): api(), esc(), show(), customAlert(), setStatus(),
// currentUser, activeKlinikId, clinicAssessments, lockUI()/unlockUI(), _isProcessing.

    function toggleCoFilter() {
      const panel = document.getElementById('co-filter-panel');
      const btn   = document.getElementById('co-filter-toggle-btn');
      const open  = panel.classList.toggle('hidden') === false;
      btn.textContent = open ? 'Stäng filter' : 'Filtrera';
    }

    async function loadClinicOverview() {
      // Visa klinikväljare för global admin
      const coKlinikRow = document.getElementById('co-klinik-row');
      if (coKlinikRow && activePrivilege === 'Administratör' && activeKlinikId === '*') {
        coKlinikRow.classList.remove('hidden');
        const sel = document.getElementById('co-klinik-select');
        if (sel && sel.options.length <= 1 && appData && appData.klinikIdMap) {
          Object.entries(appData.klinikIdMap).forEach(([namn, kid]) => {
            const opt = document.createElement('option'); opt.value = kid; opt.textContent = namn; sel.appendChild(opt);
          });
        }
      } else if (coKlinikRow) { coKlinikRow.classList.add('hidden'); }
      const selectedKlinik = document.getElementById('co-klinik-select')?.value;
      const klinikId = (activePrivilege === 'Administratör' && activeKlinikId === '*')
        ? (selectedKlinik || '*')
        : (activeKlinikId || currentUser.klinikId || '*');
      const filters = {
        dateFrom:  document.getElementById('co-date-from')?.value || null,
        dateTo:    document.getElementById('co-date-to')?.value || null,
        category:  document.getElementById('co-category')?.value || '',
        recipient: document.getElementById('co-recipient')?.value || '',
        formTypes: [...document.querySelectorAll('#co-formtypes input:checked')].map(cb => cb.value)
      };
      const list = document.getElementById('co-list');
      list.innerHTML = '<p style="color:#8a97a0;font-size:13px;">Hämtar innehåll…</p>';
      show('co-select-wrap', false);
      try {
        const assessments = await api('getClinicAssessments', { klinikId, filters });
        clinicAssessments = assessments;
        if (_clinicAllTimeKlinikId !== klinikId) {
          _clinicAllTimeKlinikId = klinikId;
          api('getClinicAssessments', { klinikId, filters: {} }).then(all => {
            _clinicAllTimeMinutes = all.reduce((sum, a) => sum + (appData?.timeSavings?.[a.formType] || 0), 0);
            renderClinicAssessments(clinicAssessments);
          }).catch(() => { _clinicAllTimeMinutes = null; });
        }
        renderClinicAssessments(assessments);
        updateCoFormTypeFilters(assessments);
      } catch(err) {
        list.innerHTML = `<p class="status-err">Fel: ${esc(err.message)}</p>`;
      }
    }

    function resetClinicFilters() {
      document.getElementById('co-date-from').value = '';
      document.getElementById('co-date-to').value = '';
      document.getElementById('co-category').value = '';
      document.getElementById('co-recipient').value = '';
      document.querySelectorAll('#co-formtypes input').forEach(cb => cb.checked = false);
      loadClinicOverview();
    }

    function filterCoFormTypesByCategory() {
      const cat = document.getElementById('co-category')?.value || '';
      const filtered = cat
        ? clinicAssessments.filter(a => a.category === cat)
        : clinicAssessments;
      updateCoFormTypeFilters(filtered);
    }

    function updateCoFormTypeFilters(assessments) {
      const types = [...new Set(assessments.map(a => a.formType))].sort();
      const container = document.getElementById('co-formtypes');
      container.innerHTML = '';
      const counts = {};
      assessments.forEach(a => { counts[a.formType] = (counts[a.formType]||0)+1; });
      types.forEach(t => {
        const lbl = document.createElement('label');
        lbl.className = 'filter-chip';
        const cb = document.createElement('input');
        cb.type = 'checkbox'; cb.value = t;
        lbl.appendChild(cb);
        lbl.appendChild(document.createTextNode(`${t} (${counts[t]})`));
        container.appendChild(lbl);
      });
    }

    function renderClinicAssessments(assessments) {
      const list = document.getElementById('co-list');
      if (!assessments.length) {
        const hasFilter = document.getElementById('co-date-from')?.value || document.getElementById('co-date-to')?.value
          || document.getElementById('co-category')?.value || document.getElementById('co-recipient')?.value
          || document.querySelectorAll('#co-formtypes input:checked').length > 0;
        list.innerHTML = hasFilter
          ? '<p style="color:#888;">Inga bedömningar hittades för vald filtrering.</p>'
          : '<p style="color:#888;">Inga bedömningar hittades.</p>';
        show('co-select-wrap', false);
        return;
      }
      const totalMinutes = assessments.reduce((sum, a) => sum + (appData?.timeSavings?.[a.formType] || 0), 0);
      const timeStr = m => { const h = Math.floor(m / 60), mm = m % 60; return h > 0 ? `${h} tim ${mm > 0 ? mm + ' min' : ''}`.trim() : `${mm} min`; };
      let headerHtml = `<p style="color:#5b6b75;font-size:13px;">${assessments.length} bedömning(ar)</p>`;
      if (totalMinutes > 0 || _clinicAllTimeMinutes) {
        headerHtml += '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:10px;">';
        if (totalMinutes > 0) {
          headerHtml += `<div style="background:#2e4a5f;color:#eef1f3;border-radius:8px;padding:12px 18px;display:inline-block;">
            <div style="font-size:11px;opacity:0.8;letter-spacing:1px;">SPARAD TID (URVAL)</div>
            <div style="font-size:22px;font-weight:bold;">${timeStr(totalMinutes)}</div>
          </div>`;
        }
        if (_clinicAllTimeMinutes) {
          headerHtml += `<div style="background:#5b6b75;color:#eef1f3;border-radius:8px;padding:12px 18px;display:inline-block;">
            <div style="font-size:11px;opacity:0.8;letter-spacing:1px;">SPARAD TID (ALLT)</div>
            <div style="font-size:22px;font-weight:bold;">${timeStr(_clinicAllTimeMinutes)}</div>
          </div>`;
        }
        headerHtml += '</div>';
      }
      list.innerHTML = headerHtml;
      show('co-select-wrap', true);
      updateCoSelectedCount();
      assessments.forEach((a, idx) => {
        const card = document.createElement('div');
        card.className = 'assessment-card';
        const topRow = document.createElement('div');
        topRow.style.cssText = 'display:flex;align-items:center;gap:10px;';
        const cb = document.createElement('input');
        cb.type = 'checkbox'; cb.className = 'co-checkbox'; cb.dataset.idx = idx;
        cb.onchange = updateCoSelectedCount;
        topRow.appendChild(cb);
        const title = document.createElement('h4');
        title.textContent = a.formType; title.style.margin = '0';
        topRow.appendChild(title);
        if (a.isAiDemo) {
          const badge = document.createElement('span');
          badge.textContent = 'DEMO — exempel skapat av AI';
          badge.style.cssText = 'background:#b026ff;color:#fff;font-size:11px;font-weight:bold;padding:2px 8px;border-radius:10px;';
          topRow.appendChild(badge);
        }
        card.appendChild(topRow);
        const meta = document.createElement('div');
        meta.className = 'meta';
        meta.textContent = `${a.timestamp || ''} · ${a.recipient ? a.recipient.split(' -- ')[0] : ''} (${a.category || ''}) · Registr: ${a.registrar || ''}`;
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
          const dashIdx = displayAnswer.indexOf(' — ');
          if (dashIdx !== -1) {
            r.textContent = `${ans.question}: ${displayAnswer.slice(0, dashIdx)}`;
            const dl = document.createElement('div');
            dl.className = 'ans-desc';
            dl.textContent = displayAnswer.slice(dashIdx + 3);
            answersDiv.appendChild(r);
            answersDiv.appendChild(dl);
          } else {
            r.textContent = `${ans.question}: ${displayAnswer}`;
            answersDiv.appendChild(r);
          }
          answersDiv.appendChild(r);
        });
        card.onclick = (e) => {
          if (e.target === cb || e.target.tagName === 'BUTTON') return;
          answersDiv.classList.toggle('hidden');
        };
        if (activePrivilege === 'Studierektor' || activePrivilege === 'Administratör') {
          const delBtn = document.createElement('button');
          delBtn.className = 'btn-danger btn-small';
          delBtn.textContent = 'Radera';
          delBtn.style.marginLeft = '8px';
          delBtn.onclick = async () => {
            if (!await customConfirm('Radera denna bedömning? En eventuell tillhörande förfrågan återgår till öppen. Kan inte ångras.')) return;
            try {
              await api('deleteAssessment', { id: a.id });
              loadClinicOverview();
            } catch (err) { await customAlert(err.message); }
          };
          card.appendChild(delBtn);
        }
        card.appendChild(answersDiv);
        list.appendChild(card);
      });
    }

    function toggleCoSelectAll(checked) {
      document.querySelectorAll('.co-checkbox').forEach(cb => cb.checked = checked);
      updateCoSelectedCount();
    }

    function updateCoSelectedCount() {
      const count = document.querySelectorAll('.co-checkbox:checked').length;
      document.getElementById('co-selected-count').textContent = count > 0 ? `${count} markerade` : '';
    }

    async function exportCoSelected() {
      if (_isProcessing) return;
      const btn = document.querySelector('#co-actions .btn-primary');
      const origBtnText = btn?.textContent || 'Exportera';
      if (btn) { btn.textContent = 'Exporterar\u2026'; btn.disabled = true; }
      lockUI();
      const selected = [...document.querySelectorAll('.co-checkbox:checked')]
        .map(cb => clinicAssessments[parseInt(cb.dataset.idx)]);
      if (!selected.length) { await customAlert('Markera minst en bedömning.'); if (btn) { btn.textContent = origBtnText; btn.disabled = false; } unlockUI(); return; }
      const filterInfo = {
        name: 'Klinikens bedömningar',
        clinic: currentUser.clinic,
        period: `${document.getElementById('co-date-from').value || '\u2026'} \u2013 ${document.getElementById('co-date-to').value || new Date().toISOString().slice(0,10)}`
      };
      try {
        const result = await api('exportAssessmentsToDoc', { email: currentUser.email, assessments: selected, filterInfo });
        if (btn) { btn.textContent = '\u2713 Skickat!'; }
        document.querySelectorAll('.co-checkbox:checked').forEach(cb => { cb.checked = false; });
        document.getElementById('co-select-all').checked = false;
        updateCoSelectedCount();
        document.getElementById('co-export-status').textContent = '';
        setTimeout(() => { if (btn) { btn.textContent = origBtnText; btn.disabled = false; } unlockUI(); }, 2000);
      } catch(err) { setStatus('co-export-status', err.message, true); if (btn) { btn.textContent = origBtnText; btn.disabled = false; } unlockUI(); }
    }
