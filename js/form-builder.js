// ── Formulärbyggare ──────────────────────────────────────────────────────────
// Utbruten från index.html (Fas 2, modularisering). Klassiskt script (ej
// type="module") — se js/progress.js för motivering och beroendemodell.
// OBS: koden var uppdelad i två block i originalfilen med Administration/
// Felanmälningar-funktioner emellan — plockades ut funktion för funktion.
// Beroenden (huvudfilen): api(), esc(), show(), customConfirm(), setStatus(),
// buildCsvCellTable() (delas med js/admin.js).

    // ══════════════ FORMULÄRBYGGARE (endast global Admin) ══════════════
    const FB_CATEGORIES = ['Registrerare', 'Mottagare', 'ST', 'Spec', 'AT', 'BT'];
    const FB_QTYPES = ['rubrik', 'radio', 'fritext', 'multi', 'skala'];

    let fbFormTypesCache = [];
    let fbQuestionsCache = [];
    let fbCurrentFormTypeId = null;
    let fbCurrentFormTypeName = '';
    let fbExpandedTypeId = null;
    let fbEditingTypeId = null;
    let fbExpandedQId = null;
    let fbEditingQId = null;

    function fbCategoryCheckboxesHtml(prefix, selected) {
      const sel = (selected || '').split(',').map(s => s.trim()).filter(Boolean);
      return FB_CATEGORIES.map(cat =>
        `<label style="margin-right:10px;font-size:14px;"><input type="checkbox" class="${prefix}-cat" value="${cat}" ${sel.includes(cat) ? 'checked' : ''}> ${cat}</label>`
      ).join('');
    }
    function fbReadCategoryCheckboxes(container, prefix) {
      return [...container.querySelectorAll('.' + prefix + '-cat:checked')].map(cb => cb.value).join(',');
    }
    async function loadFormBuilder() {
      show('fb-type-view', true);
      show('fb-questions-view', false);
      fbExpandedTypeId = null; fbEditingTypeId = null;
      const list = document.getElementById('fb-types-list');
      list.innerHTML = '<p style="color:#8a97a0;font-size:13px;">Hämtar innehåll…</p>';
      try {
        fbFormTypesCache = await api('getFormTypesAdmin');
        renderFormTypesList();
      } catch (err) { list.innerHTML = `<p class="status-err">${esc(err.message)}</p>`; }
    }

    function renderFormTypesList() {
      const list = document.getElementById('fb-types-list');
      list.innerHTML = '';
      fbFormTypesCache.forEach((t, idx) => {
        const card = document.createElement('div');
        card.className = 'assessment-card';
        const expanded = fbExpandedTypeId === t.id;
        const editing = fbEditingTypeId === t.id;

        const header = document.createElement('div');
        header.style.cssText = 'display:flex;align-items:center;gap:8px;';
        header.innerHTML = `
          <div style="display:flex;flex-direction:column;gap:2px;">
            <button class="btn-secondary btn-small" style="padding:2px 8px;min-height:0;" ${idx === 0 ? 'disabled' : ''} onclick="moveFormType('${t.id}',-1)">▲</button>
            <button class="btn-secondary btn-small" style="padding:2px 8px;min-height:0;" ${idx === fbFormTypesCache.length - 1 ? 'disabled' : ''} onclick="moveFormType('${t.id}',1)">▼</button>
          </div>
          <div style="flex:1;cursor:pointer;" onclick="toggleFormTypeExpand('${t.id}')"><strong>${esc(t.name)}</strong> <span style="font-size:13px;color:#5b6b75;">— ${t.questionCount} fråga(or)</span></div>
        `;
        const btnRow = document.createElement('div');
        btnRow.className = 'btn-row'; btnRow.style.margin = '0';
        const toggleBtn = document.createElement('button'); toggleBtn.className = 'btn-secondary btn-small'; toggleBtn.textContent = expanded ? 'Dölj' : 'Redigera';
        toggleBtn.onclick = () => toggleFormTypeExpand(t.id);
        const qBtn = document.createElement('button'); qBtn.className = 'btn-secondary btn-small'; qBtn.textContent = 'Frågor';
        qBtn.onclick = () => openFormQuestions(t.id, t.name);
        const delBtn = document.createElement('button'); delBtn.className = 'btn-danger btn-small'; delBtn.textContent = 'Radera';
        delBtn.onclick = async () => {
          if (!await customConfirm(`Radera formulärtypen "${t.name}" och alla dess frågor?`)) return;
          try {
            const res = await api('deleteFormType', { id: t.id });
            if (res.error) { await customAlert(res.error); return; }
            loadFormBuilder();
          } catch (err) { await customAlert(err.message); }
        };
        btnRow.append(toggleBtn, qBtn, delBtn);
        header.appendChild(btnRow);
        card.appendChild(header);

        if (expanded) {
          const body = document.createElement('div');
          body.style.cssText = 'margin-top:12px;border-top:1px solid #c7d1d7;padding-top:12px;';
          if (editing) {
            body.innerHTML = `
              <div class="field"><label class="field-label">Namn</label><input type="text" id="fbt-edit-name-${t.id}" value="${esc(t.name)}"></div>
              <div class="field"><label class="field-label">Synlig för</label><div id="fbt-edit-cats-${t.id}">${fbCategoryCheckboxesHtml('fbt-edit-' + t.id, t.categories)}</div></div>
              <div class="field"><label class="field-label">Tidsbesparing (minuter)</label><input type="number" id="fbt-edit-time-${t.id}" value="${t.timeSavingsMinutes ?? ''}"></div>
              <div class="btn-row" style="margin-top:10px;">
                <button class="btn-primary btn-small">Spara</button>
                <button class="btn-secondary btn-small">Avbryt</button>
              </div>
              <div class="fbt-edit-status" style="margin-top:6px;"></div>
            `;
            body.querySelector('.btn-primary').onclick = () => saveFormTypeEdit(t, body);
            body.querySelector('.btn-secondary').onclick = () => { fbEditingTypeId = null; renderFormTypesList(); };
          } else {
            body.innerHTML = `
              <div style="font-size:14px;color:#5b6b75;line-height:1.8;">
                <div><strong>Synlig för:</strong> ${esc(t.categories || 'alla (ingen begränsning)')}</div>
                <div><strong>Tidsbesparing:</strong> ${t.timeSavingsMinutes ? t.timeSavingsMinutes + ' min' : '—'}</div>
              </div>
              <div class="btn-row" style="margin-top:10px;"><button class="btn-secondary btn-small">Redigera</button></div>
            `;
            body.querySelector('.btn-secondary').onclick = () => { fbEditingTypeId = t.id; renderFormTypesList(); };
          }
          card.appendChild(body);
        }
        list.appendChild(card);
      });
    }

    function toggleFormTypeExpand(id) {
      fbExpandedTypeId = fbExpandedTypeId === id ? null : id;
      fbEditingTypeId = null;
      renderFormTypesList();
    }

    async function moveFormType(id, dir) {
      const idx = fbFormTypesCache.findIndex(t => t.id === id);
      const swapIdx = idx + dir;
      if (swapIdx < 0 || swapIdx >= fbFormTypesCache.length) return;
      const a = fbFormTypesCache[idx], b = fbFormTypesCache[swapIdx];
      const aOrder = a.orderIndex ?? idx, bOrder = b.orderIndex ?? swapIdx;
      try {
        await api('updateFormType', { id: a.id, name: a.name, categories: a.categories, orderIndex: bOrder, timeSavingsMinutes: a.timeSavingsMinutes });
        await api('updateFormType', { id: b.id, name: b.name, categories: b.categories, orderIndex: aOrder, timeSavingsMinutes: b.timeSavingsMinutes });
        loadFormBuilder();
      } catch (err) { await customAlert(err.message); }
    }

    async function saveFormTypeEdit(t, body) {
      const name = body.querySelector(`#fbt-edit-name-${t.id}`).value.trim();
      const categories = fbReadCategoryCheckboxes(body, 'fbt-edit-' + t.id);
      const timeSavingsMinutes = parseInt(body.querySelector(`#fbt-edit-time-${t.id}`).value) || null;
      const statusEl = body.querySelector('.fbt-edit-status');
      try {
        const res = await api('updateFormType', { id: t.id, name, categories, orderIndex: t.orderIndex, timeSavingsMinutes });
        if (res.error) { statusEl.textContent = res.error; statusEl.style.color = '#9e2a18'; return; }
        fbEditingTypeId = null;
        loadFormBuilder();
      } catch (err) { statusEl.textContent = err.message; statusEl.style.color = '#9e2a18'; }
    }

    function openNewFormTypeModal() {
      document.getElementById('newtype-name').value = '';
      document.getElementById('newtype-time-savings').value = '';
      document.getElementById('newtype-categories').innerHTML = fbCategoryCheckboxesHtml('newtype', '');
      document.getElementById('newtype-status').textContent = '';
      const el = document.getElementById('fb-newtype-modal');
      el.style.display = 'flex'; el.classList.remove('hidden');
    }
    function closeNewFormTypeModal() {
      const el = document.getElementById('fb-newtype-modal');
      el.style.display = 'none'; el.classList.add('hidden');
    }
    async function createNewFormType() {
      const name = document.getElementById('newtype-name').value.trim();
      if (!name) { setStatus('newtype-status', 'Ange ett namn.', true); return; }
      const categories = fbReadCategoryCheckboxes(document.getElementById('newtype-categories'), 'newtype');
      const timeSavingsMinutes = parseInt(document.getElementById('newtype-time-savings').value) || null;
      try {
        const res = await api('createFormType', { name, categories, orderIndex: fbFormTypesCache.length, timeSavingsMinutes });
        if (res.error) { setStatus('newtype-status', res.error, true); return; }
        closeNewFormTypeModal();
        loadFormBuilder();
      } catch (err) { setStatus('newtype-status', err.message, true); }
    }

    // ── Frågor ────────────────────────────────────────────────────────────
    async function openFormQuestions(formTypeId, formTypeName) {
      fbCurrentFormTypeId = formTypeId;
      fbCurrentFormTypeName = formTypeName;
      fbExpandedQId = null; fbEditingQId = null;
      document.getElementById('question-csv-editor').classList.add('hidden');
      show('fb-type-view', false);
      show('fb-questions-view', true);
      document.getElementById('fbq-title').textContent = formTypeName;
      const list = document.getElementById('fb-questions-list');
      list.innerHTML = '<p style="color:#8a97a0;font-size:13px;">Hämtar innehåll…</p>';
      try {
        fbQuestionsCache = await api('getFormTypeQuestionsAdmin', { formTypeId });
        renderQuestionsList();
      } catch (err) { list.innerHTML = `<p class="status-err">${esc(err.message)}</p>`; }
    }

    function fbAvailableSections() {
      return [...new Set(fbQuestionsCache.map(q => q.section).filter(Boolean))];
    }

    function renderQuestionsList() {
      const list = document.getElementById('fb-questions-list');
      list.innerHTML = '';
      fbQuestionsCache.forEach((q, idx) => {
        const card = document.createElement('div');
        card.className = 'assessment-card';
        const expanded = fbExpandedQId === q.id;
        const editing = fbEditingQId === q.id;
        let body = null;

        const header = document.createElement('div');
        header.style.cssText = 'display:flex;align-items:center;gap:8px;';
        header.innerHTML = `
          <div style="display:flex;flex-direction:column;gap:2px;">
            <button class="btn-secondary btn-small" style="padding:2px 8px;min-height:0;" ${idx === 0 ? 'disabled' : ''} onclick="moveQuestion('${q.id}',-1)">▲</button>
            <button class="btn-secondary btn-small" style="padding:2px 8px;min-height:0;" ${idx === fbQuestionsCache.length - 1 ? 'disabled' : ''} onclick="moveQuestion('${q.id}',1)">▼</button>
          </div>
          <div style="flex:1;cursor:pointer;" onclick="toggleQuestionExpand('${q.id}')">
            <strong>${esc(q.section || '')}</strong> — ${esc(q.question)} <span style="color:#5b6b75;font-size:13px;">(${esc(q.type)})</span>
          </div>
        `;
        const btnRow = document.createElement('div');
        btnRow.className = 'btn-row'; btnRow.style.margin = '0';
        const toggleBtn = document.createElement('button'); toggleBtn.className = 'btn-secondary btn-small'; toggleBtn.textContent = expanded ? 'Dölj' : 'Redigera';
        toggleBtn.onclick = () => toggleQuestionExpand(q.id);
        const delBtn = document.createElement('button'); delBtn.className = 'btn-danger btn-small'; delBtn.textContent = 'Radera';
        delBtn.onclick = async () => {
          if (!await customConfirm('Radera denna fråga?')) return;
          await api('deleteFormQuestion', { formTypeId: fbCurrentFormTypeId, id: q.id });
          openFormQuestions(fbCurrentFormTypeId, fbCurrentFormTypeName);
        };
        btnRow.append(toggleBtn, delBtn);
        header.appendChild(btnRow);
        card.appendChild(header);

        if (expanded) {
          body = document.createElement('div');
          body.style.cssText = 'margin-top:12px;border-top:1px solid #c7d1d7;padding-top:12px;';
          if (editing) {
            const prefix = 'fbq-edit-' + q.id;
            body.innerHTML = fbQuestionFormHtml(prefix, q);
            const btnRow2 = document.createElement('div');
            btnRow2.className = 'btn-row'; btnRow2.style.marginTop = '10px';
            const saveBtn = document.createElement('button'); saveBtn.className = 'btn-primary btn-small'; saveBtn.textContent = 'Spara';
            saveBtn.onclick = () => saveQuestionEdit(q, body);
            const cancelBtn = document.createElement('button'); cancelBtn.className = 'btn-secondary btn-small'; cancelBtn.textContent = 'Avbryt';
            cancelBtn.onclick = () => { fbEditingQId = null; renderQuestionsList(); };
            btnRow2.append(saveBtn, cancelBtn);
            body.appendChild(btnRow2);
            const statusEl = document.createElement('div'); statusEl.className = 'fbq-edit-status'; statusEl.style.marginTop = '6px';
            body.appendChild(statusEl);
          } else {
            body.innerHTML = `
              <div style="font-size:14px;color:#5b6b75;line-height:1.8;">
                ${q.nextSection ? `<div><strong>Nästa avsnitt:</strong> ${esc(q.nextSection)}</div>` : ''}
                ${q.description ? `<div><strong>Beskrivning:</strong> ${esc(q.description)}</div>` : ''}
                ${q.options ? `<div><strong>Alternativ:</strong> ${esc(q.options)}</div>` : ''}
                ${q.jumpTo ? `<div><strong>Hoppa till:</strong> ${esc(q.jumpTo)}</div>` : ''}
                ${q.autofill ? `<div><strong>Autofyll:</strong> ${esc(q.autofill)}</div>` : ''}
              </div>
              <div class="btn-row" style="margin-top:10px;"><button class="btn-secondary btn-small">Redigera</button></div>
            `;
            body.querySelector('.btn-secondary').onclick = () => { fbEditingQId = q.id; renderQuestionsList(); };
          }
          card.appendChild(body);
        }
        list.appendChild(card);
        if (expanded && editing) wireQuestionForm(body, 'fbq-edit-' + q.id, q);
      });
    }

    function toggleQuestionExpand(id) {
      fbExpandedQId = fbExpandedQId === id ? null : id;
      fbEditingQId = null;
      renderQuestionsList();
    }

    async function moveQuestion(id, dir) {
      const idx = fbQuestionsCache.findIndex(q => q.id === id);
      const swapIdx = idx + dir;
      if (swapIdx < 0 || swapIdx >= fbQuestionsCache.length) return;
      const a = fbQuestionsCache[idx], b = fbQuestionsCache[swapIdx];
      const aOrder = a.orderIndex ?? idx, bOrder = b.orderIndex ?? swapIdx;
      try {
        await api('updateFormQuestion', { formTypeId: fbCurrentFormTypeId, id: a.id, question: { ...a, orderIndex: bOrder } });
        await api('updateFormQuestion', { formTypeId: fbCurrentFormTypeId, id: b.id, question: { ...b, orderIndex: aOrder } });
        openFormQuestions(fbCurrentFormTypeId, fbCurrentFormTypeName);
      } catch (err) { await customAlert(err.message); }
    }

    // ── In-app CSV-redigerare: frågor (cellbaserad Excel-lik tabell) ─────
    const QUESTION_CSV_COLUMNS = [
      { key: 'id', label: 'Id (tom=ny)' }, { key: 'section', label: 'Avsnitt' },
      { key: 'nextSection', label: 'Nästa avsnitt' }, { key: 'question', label: 'Fråga' },
      { key: 'type', label: 'Typ' }, { key: 'description', label: 'Beskrivning' },
      { key: 'options', label: 'Alternativ' }, { key: 'jumpTo', label: 'Hoppa till' },
      { key: 'autofill', label: 'Autofyll' }
    ];
    let questionCsvGrid = null;

    function toggleQuestionCsvEditor() {
      const el = document.getElementById('question-csv-editor');
      const willShow = el.classList.contains('hidden');
      el.classList.toggle('hidden');
      if (willShow) {
        const qs = fbQuestionsCache || [];
        const rows = qs.map(q => ({
          id: q.id || '', section: q.section || '', nextSection: q.nextSection || '',
          question: q.question || '', type: q.type || 'radio', description: q.description || '',
          options: q.options || '', jumpTo: q.jumpTo || '', autofill: q.autofill || ''
        }));
        if (!rows.length) rows.push({ type: 'radio' });
        questionCsvGrid = buildCsvCellTable(document.getElementById('question-csv-table'), QUESTION_CSV_COLUMNS, rows);
        document.getElementById('question-csv-status').textContent = '';
      }
    }

    function addQuestionCsvRow() { questionCsvGrid?.addRow(); }
    function cancelQuestionCsvEditor() { document.getElementById('question-csv-editor').classList.add('hidden'); }

    function validateQuestionCsvRow(row) {
      const errs = [];
      if (!row.question) errs.push('Fråga saknas');
      if (!FB_QTYPES.includes(row.type)) errs.push(`Typ "${row.type}" ogiltig`);
      return errs;
    }

    async function submitQuestionCsvEditor() {
      const statusEl = document.getElementById('question-csv-status');
      const rows = (questionCsvGrid?.getRows() || [])
        .filter(r => Object.values(r).some(v => (v || '').toString().trim()))
        .map((r, i) => ({ ...r, orderIndex: i }));
      const problems = [];
      rows.forEach((row, i) => {
        const errs = validateQuestionCsvRow(row);
        if (errs.length) problems.push(`Rad ${i + 1}: ${errs.join('; ')}`);
      });
      if (problems.length) { statusEl.style.color = '#9e2a18'; statusEl.innerHTML = problems.join('<br>'); return; }
      statusEl.style.color = '#5b6b75'; statusEl.textContent = 'Sparar…';
      try {
        const res = await api('bulkImportQuestions', { formTypeId: fbCurrentFormTypeId, rows });
        if (res.error) { statusEl.style.color = '#9e2a18'; statusEl.textContent = res.error; return; }
        let msg = `✓ ${res.created} skapade, ${res.updated} uppdaterade, ${res.skipped} överhoppade.`;
        if (res.skippedRows?.length) {
          msg += '<br><br><strong>Överhoppade rader:</strong><br>' + res.skippedRows.map(sr => `Rad ${sr.row}: ${esc(sr.reason)}`).join('<br>');
        }
        statusEl.style.color = '#2e4a5f';
        statusEl.innerHTML = msg;
        openFormQuestions(fbCurrentFormTypeId, fbCurrentFormTypeName);
      } catch (err) { statusEl.style.color = '#9e2a18'; statusEl.textContent = err.message; }
    }

    function closeFormQuestionsView() {
      show('fb-questions-view', false);
      show('fb-type-view', true);
      loadFormBuilder();
    }

    // ── Delat frågeformulär (används av inline-redigering OCH ny-fråga-modalen) ──
    function fbQuestionFormHtml(prefix, q) {
      return `
        <div class="field"><label class="field-label">Avsnitt</label><input type="text" id="${prefix}-section" value="${esc(q?.section || '')}"></div>
        <div class="field"><label class="field-label">Nästa avsnitt</label><input type="text" id="${prefix}-next-section" value="${esc(q?.nextSection || '')}"></div>
        <div class="field"><label class="field-label">Fråga</label><input type="text" id="${prefix}-question" value="${esc(q?.question || '')}"></div>
        <div class="field"><label class="field-label">Beskrivning</label><textarea id="${prefix}-description" rows="2">${esc(q?.description || '')}</textarea></div>
        <div class="field">
          <label class="field-label">Typ</label>
          <select id="${prefix}-type">
            ${FB_QTYPES.map(t => `<option value="${t}" ${((q?.type) || 'radio') === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label class="field-label">Alternativ (kommaseparerat, eller t.ex. 1-5 för skala)</label><input type="text" id="${prefix}-options" value="${esc(q?.options || '')}"></div>
        <div class="field hidden" id="${prefix}-jumpto-wrap">
          <label class="field-label">Hoppa till</label>
          <div id="${prefix}-jumpto-rows"></div>
          <button type="button" class="btn-secondary btn-small" style="margin-top:6px;" onclick="addJumpToRow('${prefix}')">+ Lägg till villkor</button>
        </div>
        <div class="field"><label class="field-label">Autofyll</label><input type="text" id="${prefix}-autofill" value="${esc(q?.autofill || '')}"></div>
        <div class="field"><label class="field-label">Ordning</label><input type="number" id="${prefix}-order" value="${q?.orderIndex ?? ''}"></div>
      `;
    }

    function wireQuestionForm(container, prefix, q) {
      const optionsInput = container.querySelector(`#${prefix}-options`);
      if (optionsInput) optionsInput.addEventListener('input', () => refreshJumpToOptionDropdowns(prefix));
      const typeSelect = container.querySelector(`#${prefix}-type`);
      const jumpWrap = container.querySelector(`#${prefix}-jumpto-wrap`);
      const updateJumpVisibility = () => {
        if (jumpWrap) jumpWrap.classList.toggle('hidden', !['radio', 'skala'].includes(typeSelect?.value));
      };
      if (typeSelect) typeSelect.addEventListener('change', () => { refreshJumpToOptionDropdowns(prefix); updateJumpVisibility(); });
      updateJumpVisibility();
      parseJumpToIntoRows(prefix, q?.jumpTo || '');
    }

    const JUMPTO_OPERATORS = { radio: ['=', '!='], skala: ['<', '<=', '=', '>=', '>', '!='] };

    // ── Hoppa till: villkorsbyggare (svar → avsnitt) ─────────────────────
    function jumpToOptionsList(prefix) {
      const raw = document.getElementById(`${prefix}-options`)?.value || '';
      const type = document.getElementById(`${prefix}-type`)?.value;
      if (type === 'skala') {
        const parts = raw.trim().split('-').map(Number);
        const min = isNaN(parts[0]) ? 1 : parts[0];
        const max = isNaN(parts[1]) ? 5 : parts[1];
        const out = [];
        for (let i = min; i <= max; i++) out.push(String(i));
        return out;
      }
      return raw.split(',').map(s => s.trim()).filter(Boolean);
    }

    function addJumpToRow(prefix, op, answer, section) {
      const container = document.getElementById(`${prefix}-jumpto-rows`);
      if (!container) return;
      const type = document.getElementById(`${prefix}-type`)?.value;
      const ops = JUMPTO_OPERATORS[type] || ['='];
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:6px;align-items:center;margin-top:6px;';
      const opSel = document.createElement('select');
      opSel.className = 'jumpto-op';
      opSel.style.cssText = 'font-size:14px;padding:4px;width:56px;';
      ops.forEach(o => {
        const opt = document.createElement('option'); opt.value = o; opt.textContent = o;
        if (o === (op || '=')) opt.selected = true;
        opSel.appendChild(opt);
      });
      const answerSel = document.createElement('select');
      answerSel.className = 'jumpto-answer';
      answerSel.style.cssText = 'flex:1;font-size:14px;padding:4px;';
      jumpToOptionsList(prefix).forEach(opt => {
        const o = document.createElement('option'); o.value = opt; o.textContent = opt;
        if (opt === answer) o.selected = true;
        answerSel.appendChild(o);
      });
      const arrow = document.createElement('span'); arrow.textContent = '→'; arrow.style.color = '#5b6b75';
      const sectionSel = document.createElement('select');
      sectionSel.className = 'jumpto-section';
      sectionSel.style.cssText = 'flex:1;font-size:14px;padding:4px;';
      fbAvailableSections().forEach(sec => {
        const o = document.createElement('option'); o.value = sec; o.textContent = sec;
        if (sec === section) o.selected = true;
        sectionSel.appendChild(o);
      });
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button'; removeBtn.className = 'btn-danger btn-small'; removeBtn.textContent = '✕';
      removeBtn.onclick = () => row.remove();
      row.append(opSel, answerSel, arrow, sectionSel, removeBtn);
      container.appendChild(row);
    }

    function refreshJumpToOptionDropdowns(prefix) {
      const opts = jumpToOptionsList(prefix);
      document.querySelectorAll(`#${prefix}-jumpto-rows .jumpto-answer`).forEach(sel => {
        const current = sel.value;
        sel.innerHTML = '';
        opts.forEach(opt => {
          const o = document.createElement('option'); o.value = opt; o.textContent = opt;
          if (opt === current) o.selected = true;
          sel.appendChild(o);
        });
      });
    }

    function parseJumpToIntoRows(prefix, jumpToValue) {
      const container = document.getElementById(`${prefix}-jumpto-rows`);
      if (!container) return;
      container.innerHTML = '';
      (jumpToValue || '').split(',').map(s => s.trim()).filter(Boolean).forEach(rule => {
        const [left, section] = rule.split('→').map(s => s.trim());
        const colonIdx = left.indexOf(':');
        const knownOps = ['<=', '>=', '!=', '<', '>', '='];
        const opCandidate = colonIdx > -1 ? left.slice(0, colonIdx) : null;
        const op = knownOps.includes(opCandidate) ? opCandidate : '=';
        const answer = knownOps.includes(opCandidate) ? left.slice(colonIdx + 1) : left;
        if (answer) addJumpToRow(prefix, op, answer, section);
      });
    }

    function collectJumpToValue(prefix) {
      const container = document.getElementById(`${prefix}-jumpto-rows`);
      if (!container) return '';
      return [...container.children].map(row => {
        const op = row.querySelector('.jumpto-op')?.value || '=';
        const answer = row.querySelector('.jumpto-answer')?.value || '';
        const section = row.querySelector('.jumpto-section')?.value || '';
        return answer && section ? `${op}:${answer}→${section}` : '';
      }).filter(Boolean).join(',');
    }

    function readQuestionForm(prefix) {
      return {
        section: document.getElementById(`${prefix}-section`).value.trim(),
        nextSection: document.getElementById(`${prefix}-next-section`).value.trim(),
        question: document.getElementById(`${prefix}-question`).value.trim(),
        description: document.getElementById(`${prefix}-description`).value.trim(),
        type: document.getElementById(`${prefix}-type`).value,
        options: document.getElementById(`${prefix}-options`).value.trim(),
        jumpTo: collectJumpToValue(prefix),
        autofill: document.getElementById(`${prefix}-autofill`).value.trim(),
        orderIndex: parseInt(document.getElementById(`${prefix}-order`).value) || null
      };
    }

    async function saveQuestionEdit(q, body) {
      const prefix = 'fbq-edit-' + q.id;
      const question = readQuestionForm(prefix);
      const statusEl = body.querySelector('.fbq-edit-status');
      try {
        const res = await api('updateFormQuestion', { formTypeId: fbCurrentFormTypeId, id: q.id, question });
        if (res.error) { statusEl.textContent = res.error; statusEl.style.color = '#9e2a18'; return; }
        fbEditingQId = null;
        openFormQuestions(fbCurrentFormTypeId, fbCurrentFormTypeName);
      } catch (err) { statusEl.textContent = err.message; statusEl.style.color = '#9e2a18'; }
    }

    // ── Ny fråga (modal) ──────────────────────────────────────────────────
    function openNewQuestionModal() {
      document.getElementById('newq-fields').innerHTML = fbQuestionFormHtml('newq', null);
      wireQuestionForm(document.getElementById('newq-fields'), 'newq', null);
      document.getElementById('newq-status').textContent = '';
      const el = document.getElementById('fb-newq-modal');
      el.style.display = 'flex'; el.classList.remove('hidden');
    }
    function closeNewQuestionModal() {
      const el = document.getElementById('fb-newq-modal');
      el.style.display = 'none'; el.classList.add('hidden');
    }
    async function createNewQuestion() {
      const question = readQuestionForm('newq');
      if (!question.question) { setStatus('newq-status', 'Ange frågetext.', true); return; }
      try {
        const res = await api('createFormQuestion', { formTypeId: fbCurrentFormTypeId, question });
        if (res.error) { setStatus('newq-status', res.error, true); return; }
        closeNewQuestionModal();
        openFormQuestions(fbCurrentFormTypeId, fbCurrentFormTypeName);
      } catch (err) { setStatus('newq-status', err.message, true); }
    }
