// ── Klinikens inställningar ──────────────────────────────────────────────────
// Utbruten från index.html (Fas 2, modularisering). Klassiskt script (ej
// type="module") — se js/progress.js för motivering och beroendemodell.
// Beroenden (huvudfilen): api(), esc(), show(), customConfirm(), setStatus(),
// currentUser, activeKlinikId, refreshAppData() (delas med js/admin.js).

    // ══════════════ KLINIKENS INSTÄLLNINGAR (Studierektor + Admin) ══════════════
    const ROLE_LIST = ['ST', 'Spec', 'AT', 'BT'];

    function currentSettingsKlinikId() {
      if (activeKlinikId === '*') {
        return document.getElementById('cs-klinik-select')?.value || '';
      }
      return activeKlinikId || currentUser.klinikId || '';
    }

    let csGroupsCache = [];

    async function loadClinicSettings() {
      const row = document.getElementById('cs-klinik-row');
      const sel = document.getElementById('cs-klinik-select');
      if (activeKlinikId === '*') {
        row.classList.remove('hidden');
        if (sel.options.length === 0 && appData?.klinikIdMap) {
          sel.appendChild(newOption('', '-- Alla kliniker (välj en) --'));
          Object.entries(appData.klinikIdMap).sort((a, b) => a[0].localeCompare(b[0], 'sv')).forEach(([namn, kid]) => {
            sel.appendChild(newOption(kid, namn));
          });
        }
      } else {
        row.classList.add('hidden');
      }
      const klinikId = currentSettingsKlinikId();
      const list = document.getElementById('cs-list');
      const groupsList = document.getElementById('cs-groups-list');
      document.getElementById('cs-groups-apply-all').classList.toggle('hidden', !(activeKlinikId === '*' && klinikId));
      if (!klinikId) { list.innerHTML = '<p style="color:#888;">Välj en klinik.</p>'; groupsList.innerHTML = ''; return; }
      list.innerHTML = '<p style="color:#8a97a0;font-size:13px;">Hämtar innehåll…</p>';
      try {
        const [settings, groups] = await Promise.all([
          api('getClinicFormSettings', { klinikId }),
          api('getClinicFormGroups', { klinikId })
        ]);
        csGroupsCache = groups;
        renderGroupsList(klinikId);
        renderClinicSettings(settings, klinikId);
      } catch (err) { list.innerHTML = html`<p class="status-err">${err.message}</p>`; }
    }

    function renderGroupsList(klinikId) {
      const el = document.getElementById('cs-groups-list');
      if (!csGroupsCache.length) { el.innerHTML = html`<p style="color:#888;font-size:13px;">Inga sektioner ännu — alla formulär visas ogrupperat.</p>`; return; }
      el.innerHTML = csGroupsCache.map((g, idx) => html`
        <div style="display:flex;align-items:center;gap:8px;padding:4px 0;">
          <div style="display:flex;flex-direction:column;gap:1px;">
            <button class="btn-secondary btn-small" style="padding:1px 7px;min-height:0;" ${safe(idx === 0 ? 'disabled' : '')} onclick="moveClinicFormGroup('${klinikId}',${idx},-1)">▲</button>
            <button class="btn-secondary btn-small" style="padding:1px 7px;min-height:0;" ${safe(idx === csGroupsCache.length - 1 ? 'disabled' : '')} onclick="moveClinicFormGroup('${klinikId}',${idx},1)">▼</button>
          </div>
          <span style="flex:1;font-size:14px;">${g.name}</span>
          <label style="font-size:12px;color:#5b6b75;display:flex;align-items:center;gap:4px;cursor:pointer;">
            <input type="checkbox" ${safe(g.hidden ? 'checked' : '')} onchange="toggleClinicFormGroupHidden('${klinikId}',${idx})"> Dölj för klinikens användare
          </label>
          <button class="btn-danger btn-small" onclick="removeClinicFormGroup('${klinikId}',${idx})">Ta bort</button>
        </div>`).join('');
    }

    async function refreshAppData() {
      try {
        appData = await api('getData', { klinikId: currentUser.klinikId });
        localStorage.setItem('dops_appdata', JSON.stringify({ ts: Date.now(), data: appData }));
      } catch (e) { /* tyst */ }
    }

    async function saveClinicFormGroupsOrder(klinikId) {
      try {
        await api('saveClinicFormGroups', { klinikId, groups: csGroupsCache });
        await refreshAppData();
        loadClinicSettings();
      } catch (err) { await customAlert(err.message); }
    }

    function addClinicFormGroup() {
      const klinikId = currentSettingsKlinikId();
      const input = document.getElementById('cs-new-group');
      const name = input.value.trim();
      if (!name) return;
      if (csGroupsCache.some(g => g.name === name)) { input.value = ''; return; }
      csGroupsCache.push({ name, hidden: false });
      input.value = '';
      saveClinicFormGroupsOrder(klinikId);
    }

    function moveClinicFormGroup(klinikId, idx, dir) {
      const swapIdx = idx + dir;
      if (swapIdx < 0 || swapIdx >= csGroupsCache.length) return;
      [csGroupsCache[idx], csGroupsCache[swapIdx]] = [csGroupsCache[swapIdx], csGroupsCache[idx]];
      saveClinicFormGroupsOrder(klinikId);
    }

    function toggleClinicFormGroupHidden(klinikId, idx) {
      csGroupsCache[idx].hidden = !csGroupsCache[idx].hidden;
      saveClinicFormGroupsOrder(klinikId);
    }

    async function removeClinicFormGroup(klinikId, idx) {
      if (!await customConfirm(`Ta bort sektionen "${csGroupsCache[idx].name}"? Formulär i den flyttas till Övrigt.`)) return;
      csGroupsCache.splice(idx, 1);
      saveClinicFormGroupsOrder(klinikId);
    }

    async function applyClinicFormGroupsToAll() {
      const klinikId = currentSettingsKlinikId();
      const overwrite = document.getElementById('cs-groups-overwrite').checked;
      const msg = overwrite
        ? 'Skriva över ALLA klinikers sektionsstrukturer med denna klinikens?'
        : 'Applicera denna sektionsstruktur på kliniker som ännu inte har egna sektioner?';
      if (!await customConfirm(msg)) return;
      const statusEl = document.getElementById('cs-groups-apply-status');
      statusEl.textContent = 'Applicerar…';
      try {
        const res = await api('applyFormGroupsToAllClinics', { klinikId, overwrite });
        await refreshAppData();
        statusEl.textContent = `✓ Applicerat på ${res.applied} klinik(er)${res.skipped ? `, ${res.skipped} hoppade över` : ''}`;
        setTimeout(() => statusEl.textContent = '', 4000);
      } catch (err) { statusEl.textContent = 'Fel: ' + err.message; statusEl.style.color = '#9e2a18'; }
    }

    function renderClinicSettings(settings, klinikId) {
      const list = document.getElementById('cs-list');
      list.innerHTML = '';
      settings.forEach(s => {
        const card = document.createElement('div');
        card.className = 'assessment-card';
        let html = `<div style="font-weight:bold;font-size:16px;margin-bottom:8px;">${s.formType}</div>`;
        html += '<div style="overflow-x:auto;"><table style="border-collapse:collapse;font-size:13px;">';
        html += '<tr><td></td>' + ROLE_LIST.map(r => `<td style="padding:2px 8px;font-weight:bold;text-align:center;">${r}</td>`).join('') + '</tr>';
        ['mottagen', 'registrerad'].forEach(metric => {
          html += `<tr><td style="padding:2px 8px;color:#5b6b75;">${metric === 'mottagen' ? 'Mål mottagna' : 'Mål registrerade'}</td>`;
          ROLE_LIST.forEach(role => {
            const val = s.targets?.[role]?.[metric] || '';
            html += `<td style="padding:2px 4px;"><input type="number" min="0" style="width:56px;padding:3px;" data-role="${role}" data-metric="${metric}" value="${val}"></td>`;
          });
          html += '</tr>';
        });
        html += '</table></div>';
        html += '<div style="margin-top:10px;font-size:13px;">';
        html += '<label style="font-weight:bold;">Synlig för: </label>';
        const allSelected = s.categories === null;
        html += `<label style="margin-left:8px;"><input type="checkbox" class="cs-cat-all" ${allSelected ? 'checked' : ''}> Alla (default)</label>`;
        const selectedCats = s.categories ? s.categories.split(',').map(c => c.trim()) : [];
        ROLE_LIST.forEach(cat => {
          html += `<label style="margin-left:10px;"><input type="checkbox" class="cs-cat" value="${cat}" ${selectedCats.includes(cat) ? 'checked' : ''} ${allSelected ? 'disabled' : ''}> ${cat}</label>`;
        });
        html += '</div>';
        html += '<div style="margin-top:10px;font-size:13px;display:flex;align-items:center;gap:8px;">';
        html += '<label style="font-weight:bold;">Sektion:</label>';
        html += '<select class="cs-group-select" style="font-size:13px;padding:3px;">';
        html += `<option value="">Övrigt (ingen sektion)</option>`;
        csGroupsCache.forEach(g => { html += `<option value="${esc(g.name)}" ${s.groupName === g.name ? 'selected' : ''}>${esc(g.name)}</option>`; });
        html += '</select></div>';
        html += '<div class="btn-row" style="margin-top:10px;align-items:center;">';
        html += '<button class="btn-primary btn-small">Spara</button>';
        if (activeKlinikId === '*') {
          html += '<label style="font-size:12px;color:#5b6b75;display:flex;align-items:center;gap:5px;margin-left:8px;"><input type="checkbox" class="cs-overwrite"> Skriv över kliniker med egna inställningar</label>';
          html += '<button class="btn-secondary btn-small cs-apply-all">Applicera på alla kliniker</button>';
        }
        html += '<span class="cs-save-status" style="margin-left:4px;font-size:13px;"></span></div>';
        card.innerHTML = html;

        const allCb = card.querySelector('.cs-cat-all');
        const catCbs = card.querySelectorAll('.cs-cat');
        const groupSel = card.querySelector('.cs-group-select');
        allCb.onchange = () => catCbs.forEach(cb => cb.disabled = allCb.checked);

        const readTargets = () => {
          const targets = {};
          ROLE_LIST.forEach(role => { targets[role] = {}; });
          card.querySelectorAll('input[type="number"]').forEach(inp => {
            targets[inp.dataset.role][inp.dataset.metric] = parseInt(inp.value) || 0;
          });
          return targets;
        };

        card.querySelector('.btn-primary').onclick = async () => {
          const targets = readTargets();
          const categories = allCb.checked ? null : [...catCbs].filter(cb => cb.checked).map(cb => cb.value);
          const groupName = groupSel.value || null;
          const statusEl = card.querySelector('.cs-save-status');
          statusEl.textContent = 'Sparar…';
          try {
            await api('saveClinicFormSettings', { klinikId, formTypeId: s.formTypeId, targets, categories, groupName });
            await refreshAppData();
            statusEl.textContent = '✓ Sparat';
            setTimeout(() => statusEl.textContent = '', 2000);
          } catch (err) { statusEl.textContent = 'Fel: ' + err.message; statusEl.style.color = '#9e2a18'; }
        };

        const applyAllBtn = card.querySelector('.cs-apply-all');
        if (applyAllBtn) {
          applyAllBtn.onclick = async () => {
            const overwrite = card.querySelector('.cs-overwrite').checked;
            const msg = overwrite
              ? `Skriva över ALLA klinikers inställningar (inklusive egna anpassningar) för "${s.formType}"?`
              : `Sätta detta som default för "${s.formType}" på alla kliniker som saknar egen anpassning?`;
            if (!await customConfirm(msg)) return;
            const targets = readTargets();
            const categories = allCb.checked ? null : [...catCbs].filter(cb => cb.checked).map(cb => cb.value);
            const statusEl = card.querySelector('.cs-save-status');
            statusEl.textContent = 'Applicerar…';
            try {
              const res = await api('applyFormTypeToAllClinics', { formTypeId: s.formTypeId, targets, categories, overwrite });
              await refreshAppData();
              statusEl.textContent = `✓ Applicerat på ${res.applied} klinik(er)${res.skipped ? `, ${res.skipped} hoppade över (egen anpassning)` : ''}`;
              setTimeout(() => statusEl.textContent = '', 4000);
            } catch (err) { statusEl.textContent = 'Fel: ' + err.message; statusEl.style.color = '#9e2a18'; }
          };
        }
        list.appendChild(card);
      });
    }
