// ── Administration ───────────────────────────────────────────────────────────
// Utbruten från index.html (Fas 2, modularisering). Klassiskt script (ej
// type="module") — se js/progress.js för motivering och beroendemodell.
// OBS: koden var utspridd i tre separata block i originalfilen (samma mönster
// som Min översikt/Förfrågningar tidigare) — plockades ut funktion för funktion.
// Beroenden (huvudfilen): api(), esc(), show(), customConfirm(), customAlert(),
// setStatus(), currentUser, appData, activeKlinikId, refreshAppData(),
// buildCsvCellTable() (delas med js/form-builder.js, ligger kvar i huvudfilen).

    let allAdminUsers = [];
    let currentAdminKlinikId = null;

    async function loadAdminPanel() {
      showClinicList();
      const el = document.getElementById('admin-clinic-list');
      el.innerHTML = '<p style="color:#8a97a0;font-size:13px;">Hämtar innehåll…</p>';
      try {
        // Hämta alltid alla användare för admin (filtrera lokalt)
        const result = await api('getAllUsers', { klinikId: '*', includeInaktiverade: true });
        const allUsers = result || [];
        allAdminUsers = allUsers;

        // Bygg lista av kliniker admin har tillgång till
        const adminPrivKliniker = (currentUser.privileges || [])
          .filter(p => p.privilege === 'Administratör')
          .map(p => p.klinikId)
          .filter(Boolean);
        const isGlobalAdmin = adminPrivKliniker.includes('*') || activeKlinikId === '*';
        document.getElementById('new-clinic-btn')?.classList.toggle('hidden', !isGlobalAdmin);

        let klinikIds;
        if (isGlobalAdmin) {
          klinikIds = appData?.klinikIdMap ? Object.values(appData.klinikIdMap) : [...new Set(allUsers.map(u => u.klinikId).filter(Boolean))];
        } else {
          // Lokal admin: alla kliniker från Administratör-privilegier
          klinikIds = [...new Set(adminPrivKliniker)];
          // Lägg till aktuell klinik om den saknas
          if (currentUser.klinikId && !klinikIds.includes(currentUser.klinikId)) {
            klinikIds.push(currentUser.klinikId);
          }
        }
        if (!klinikIds.length) { el.innerHTML = '<p style="color:#888;">Inga kliniker.</p>'; return; }
        el.innerHTML = '';
        // Lägg till "Alla"-knapp bara för global admin
        if (isGlobalAdmin) {
          const allBtn = document.createElement('div');
          allBtn.className = 'assessment-card';
          allBtn.style.cssText = 'cursor:pointer;';
          allBtn.innerHTML = '<strong style="font-size:17px;">Alla kliniker</strong><div style="font-size:14px;color:#5b6b75;margin-top:3px;">' + allAdminUsers.length + ' användare totalt</div>';
          allBtn.onclick = () => loadClinicDetail('*');
          el.appendChild(allBtn);

          const noneCount = allAdminUsers.filter(u => !u.klinikId).length;
          if (noneCount > 0) {
            const noneBtn = document.createElement('div');
            noneBtn.className = 'assessment-card';
            noneBtn.style.cssText = 'cursor:pointer;';
            noneBtn.innerHTML = '<strong style="font-size:17px;">Ingen klinik</strong><div style="font-size:14px;color:#5b6b75;margin-top:3px;">' + noneCount + ' användare</div>';
            noneBtn.onclick = () => loadClinicDetail('__none__');
            el.appendChild(noneBtn);
          }
        }
        // Bygg klinikId → namn-mappning från appData
        const kidToName = {};
        if (appData && appData.klinikIdMap) {
          Object.entries(appData.klinikIdMap).forEach(([namn, kid]) => { kidToName[kid] = namn; });
        }
        klinikIds.sort((a, b) => (kidToName[a] || a).localeCompare(kidToName[b] || b, 'sv')).forEach(kid => {
          const users = allAdminUsers.filter(u => u.klinikId === kid);
          const displayName = kidToName[kid] || kid || '(okänd)';
          const card = document.createElement('div');
          card.className = 'assessment-card';
          card.style.cssText = 'cursor:pointer; margin-top:10px;';
          card.innerHTML = html`<strong style="font-size:17px;">${displayName}</strong><div style="font-size:14px;color:#5b6b75;margin-top:3px;">${users.length} användare</div>`;
          card.onclick = () => loadClinicDetail(kid);
          el.appendChild(card);
        });
      } catch(err) {
        el.innerHTML = html`<p class="status-err">${err.message}</p>`;
      }
    }

    function openNewClinicModal() {
      document.getElementById('newclinic-name').value = '';
      document.getElementById('newclinic-contact').value = '';
      document.getElementById('newclinic-status').textContent = '';
      const el = document.getElementById('new-clinic-modal');
      el.style.display = 'flex'; el.classList.remove('hidden');
    }
    function closeNewClinicModal() {
      const el = document.getElementById('new-clinic-modal');
      el.style.display = 'none'; el.classList.add('hidden');
    }
    async function submitNewClinic() {
      const name = document.getElementById('newclinic-name').value.trim();
      const contactPerson = document.getElementById('newclinic-contact').value.trim();
      const statusEl = document.getElementById('newclinic-status');
      if (!name) { statusEl.textContent = 'Ange ett namn.'; statusEl.style.color = '#9e2a18'; return; }
      statusEl.textContent = 'Skapar…'; statusEl.style.color = '#5b6b75';
      try {
        const res = await api('createClinic', { name, contactPerson });
        if (res.error) { statusEl.textContent = res.error; statusEl.style.color = '#9e2a18'; return; }
        localStorage.removeItem('dops_appdata');
        await refreshAppData();
        closeNewClinicModal();
        loadAdminPanel();
      } catch (err) { statusEl.textContent = err.message; statusEl.style.color = '#9e2a18'; }
    }

    function showClinicList() {
      show('admin-clinic-view', true);
      show('admin-detail-view', false);
    }

    async function loadClinicDetail(klinikId) {
      currentAdminKlinikId = klinikId;
      show('admin-clinic-view', false);
      show('admin-detail-view', true);
      const infoEl = document.getElementById('admin-clinic-info');
      infoEl.innerHTML = '';
      try {
        const [data, settings] = await Promise.all([
          api('getClinicInfo', { klinikId }),
          (klinikId !== '*' && klinikId !== '__none__') ? api('getKlinikSettings', { klinikId }) : Promise.resolve({ inaktiveringsMånader: 24 })
        ]);
        let out = '';
        if (data.info) {
          out += '<div class="assessment-card">';
          out += html`<div style="font-size:18px;font-weight:bold;">${data.info.namn}</div>`;
          out += html`<div style="font-size:14px;margin-top:4px;">Kontakt: ${data.info.kontakt}</div>`;
          out += html`<div style="font-size:14px;margin-top:4px;">Status: <strong>${safe(data.info.aktiv ? '✓ Aktiv' : '✗ Inaktiv')}</strong></div>`;
          const toggleLabel = data.info.aktiv ? 'Stäng tillgång' : 'Aktivera';
          const toggleActive = !data.info.aktiv;
          out += html`<div class="btn-row" style="margin-top:12px;"><button class="btn-${safe(toggleActive ? 'primary' : 'danger')} btn-small" onclick="toggleClinicAccess('${klinikId}',${toggleActive})">${toggleLabel}</button>`;
          if (activeKlinikId === '*') {
            out += html`<button class="btn-danger btn-small" onclick="deleteClinicAction('${klinikId}','${data.info.namn}')">Radera klinik</button>`;
          }
          out += '</div>';
          // Inaktiveringsgräns
          const månader = settings?.inaktiveringsMånader || 24;
          out += '<div style="margin-top:16px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">';
          out += '<label style="font-size:14px;color:#5b6b75;">Inaktivera användare efter</label>';
          out += html`<input type="number" id="klinik-inaktiv-månader" value="${månader}" min="1" max="120" style="width:70px;padding:6px;border:1.5px solid #c7d1d7;border-radius:5px;font-size:14px;">`;
          out += '<label style="font-size:14px;color:#5b6b75;">månaders inaktivitet</label>';
          out += html`<button class="btn-secondary btn-small" onclick="saveInaktiveringsgräns('${klinikId}')">Spara</button>`;
          out += '</div>';
          out += '</div>';
        } else {
          out = html`<div class="assessment-card"><strong>${safe(klinikId === '*' ? 'Alla kliniker' : klinikId === '__none__' ? 'Ingen klinik' : esc(klinikId))}</strong></div>`;
        }
        infoEl.innerHTML = out;
        allAdminUsers = data.users || [];
        filterAdminUsers();
      } catch(err) {
        infoEl.innerHTML = html`<p class="status-err">${err.message}</p>`;
      }
    }

    async function saveInaktiveringsgräns(klinikId) {
      const månader = parseInt(document.getElementById('klinik-inaktiv-månader')?.value) || 24;
      await api('saveKlinikSettings', { klinikId, settings: { inaktiveringsMånader: månader } });
    }

    async function toggleClinicAccess(klinikId, active) {
      if (!await customConfirm((active ? 'Aktivera' : 'Stäng') + ' tillgång för ' + klinikId + '?')) return;
      try {
        const res = await api('setClinicActive', { klinikId, active });
        if (res.error) { await customAlert(res.error); return; }
        loadClinicDetail(klinikId);
      } catch(err) { await customAlert(err.message); }
    }

    async function deleteClinicAction(klinikId, namn) {
      if (!await customConfirm(`Radera kliniken "${namn}"? Kan inte ångras.`)) return;
      try {
        const res = await api('deleteClinic', { klinikId });
        if (res.error) { await customAlert(res.error); return; }
        localStorage.removeItem('dops_appdata');
        await refreshAppData();
        showClinicList();
        loadAdminPanel();
      } catch (err) { await customAlert(err.message); }
    }

    function filterAdminUsers() {
      const q = document.getElementById('admin-user-search')?.value.toLowerCase() || '';
      const el = document.getElementById('admin-users-list');
      if (!el) return;
      const filtered = allAdminUsers.filter(u =>
        `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(q)
      ).sort((a, b) => a.lastName.localeCompare(b.lastName, 'sv') || a.firstName.localeCompare(b.firstName, 'sv'));
      if (!filtered.length) { el.innerHTML = '<p style="color:#888;">Inga användare hittades.</p>'; return; }
      el.innerHTML = '';
      filtered.forEach(u => {
        const card = document.createElement('div');
        card.className = 'assessment-card';
        card.style.cssText = 'margin-top:10px; cursor:pointer;';
        card.innerHTML = html`<div style="font-weight:bold;font-size:16px;">${u.firstName} ${u.lastName}${safe(u.inaktiverad ? ' <span style="font-size:12px;background:#f0d8d0;color:#9e2a18;padding:2px 6px;border-radius:8px;">Inaktiverad</span>' : '')}${safe(u.pendingActivation ? ' <span style="font-size:12px;background:#f0e0b0;color:#7a5a10;padding:2px 6px;border-radius:8px;">Inväntar aktivering</span>' : '')}${safe(u.mustChangePin ? ' <span style="font-size:12px;background:#e0d8f0;color:#4a2a9e;padding:2px 6px;border-radius:8px;">Väntar på lösenordsbyte</span>' : '')}</div><div style="font-size:14px;color:#5b6b75;margin-top:3px;">${u.email}</div><div style="font-size:14px;margin-top:4px;">${u.jobRole} · ${u.clinic} · ${u.userRole}</div>${safe(u.senastAktiv ? '<div style="font-size:12px;color:#8a97a0;margin-top:2px;">Senast aktiv: ' + esc(u.senastAktiv) + '</div>' : '')}`;
        if (u.pendingActivation) {
          const approveBtn = document.createElement('button');
          approveBtn.className = 'btn-primary btn-small';
          approveBtn.textContent = 'Godkänn';
          approveBtn.style.marginTop = '8px';
          approveBtn.onclick = async (ev) => {
            ev.stopPropagation();
            try {
              await api('updateUserByAdmin', { targetId: u.id, updates: { pendingActivation: false } });
              loadClinicDetail(currentAdminKlinikId);
            } catch (err) { await customAlert(err.message); }
          };
          card.appendChild(approveBtn);
        }
        card.onclick = () => openUserEdit(u);
        el.appendChild(card);
      });
    }

    function openUserEdit(u) {
      document.getElementById('admin-edit-overlay').style.display = 'flex';
      document.getElementById('edit-firstname').value = u.firstName || '';
      document.getElementById('edit-lastname').value  = u.lastName  || '';
      document.getElementById('edit-klinikid').value  = u.klinikId  || '';
      document.getElementById('edit-pin').value       = '';
      document.getElementById('edit-reset-password').checked = false;
      document.getElementById('edit-email').value     = u.email     || '';
      document.getElementById('edit-id').value        = u.id        || '';
      document.getElementById('edit-status').textContent = '';
      // Populera klinikdropdown
      const clinicSel = document.getElementById('edit-clinic');
      clinicSel.innerHTML = '<option value="">-- Välj klinik --</option>';
      if (appData && appData.klinikIdMap) {
        Object.entries(appData.klinikIdMap).sort((a,b) => a[0].localeCompare(b[0])).forEach(([namn, kid]) => {
          const opt = document.createElement('option');
          opt.value = namn; opt.textContent = namn;
          clinicSel.appendChild(opt);
        });
      }
      // Lägg till aktuell klinik om den saknas
      if (u.clinic && !clinicSel.querySelector(`option[value="${u.clinic}"]`)) {
        const opt = document.createElement('option'); opt.value = u.clinic; opt.textContent = u.clinic;
        clinicSel.appendChild(opt);
      }
      clinicSel.value = u.clinic || '';
      // Uppdatera klinikId när klinik byts
      clinicSel.onchange = () => {
        const kid = appData?.klinikIdMap?.[clinicSel.value] || u.klinikId || '';
        document.getElementById('edit-klinikid').value = kid;
      };
      const jobRoleSel  = document.getElementById('edit-jobrole');
      const userRoleSel = document.getElementById('edit-userrole');
      if (jobRoleSel)  { jobRoleSel.value  = u.jobRole  || ''; }
      if (userRoleSel) { userRoleSel.value = u.userRole || ''; }
      const inaktChk = document.getElementById('edit-inaktiverad');
      if (inaktChk) inaktChk.checked = !!(u.inaktiverad);
      show('admin-edit-overlay', true);
      loadUserPrivileges(u.id);
    }

    async function loadUserPrivileges(id) {
      const el = document.getElementById('edit-privileges-list');
      el.innerHTML = '';
      try {
        const privs = await api('getPrivilegesForUser', { targetId: id });
        if (!privs.length) { el.innerHTML = '<span style="color:#888;font-size:14px;">Inga privilegier</span>'; return; }
        el.innerHTML = privs.map(p =>
          `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
            <span style="font-size:15px;">${esc(p.privilege)} <span style="color:#5b6b75;">(${esc(p.klinikId) || 'Global'})</span></span>
            <button class="btn-danger btn-small" onclick="removePrivilege('${esc(id)}','${esc(p.privilege)}')">Ta bort</button>
          </div>`
        ).join('');
      } catch(err) { el.innerHTML = '<span style="color:#c00;font-size:14px;">' + esc(err.message) + '</span>'; }
    }

    async function addPrivilegeToUser() {
      const id       = document.getElementById('edit-id').value;
      const priv     = document.getElementById('edit-priv-type').value;
      let klinikId   = document.getElementById('edit-priv-klinik').value.trim();
      if (!klinikId) { await customAlert('Välj en klinik (eller Global).'); return; }
      const isGlobal = klinikId === '__global__';
      // Lokal admin kan bara ge privilegier till sin egen klinik
      if (!isGlobal && activeKlinikId && activeKlinikId !== '*' && klinikId !== activeKlinikId) {
        await customAlert('Du kan bara tilldela privilegier för klinik: ' + activeKlinikId);
        return;
      }
      await api('setUserPrivilege', { targetId: id, privilege: priv, klinikId: isGlobal ? '' : klinikId, remove: false });
      loadUserPrivileges(id);
    }

    async function removePrivilege(id, privilege) {
      await api('setUserPrivilege', { targetId: id, privilege, klinikId: '', remove: true });
      loadUserPrivileges(id);
    }

    function closeUserEdit() { const el = document.getElementById('admin-edit-overlay'); el.style.display = 'none'; el.classList.add('hidden'); }

    async function saveUserEdit() {
      const id = document.getElementById('edit-id').value;
      const clinic = document.getElementById('edit-clinic').value.trim();
      const klinikId = document.getElementById('edit-klinikid').value.trim()
        || (appData?.klinikIdMap?.[clinic] || '');
      const updates = {
        firstName: document.getElementById('edit-firstname').value.trim(),
        lastName:  document.getElementById('edit-lastname').value.trim(),
        jobRole:   document.getElementById('edit-jobrole').value,
        userRole:  document.getElementById('edit-userrole').value,
        clinic, klinikId,
        inaktiverad: !!(document.getElementById('edit-inaktiverad')?.checked),
      };
      const pin = document.getElementById('edit-pin').value.trim();
      if (pin) { if (!/^\d{4,6}$/.test(pin)) { setStatus('edit-status', 'PIN måste vara 4–6 siffror.', true); return; } updates.newPin = pin; }
      if (document.getElementById('edit-reset-password')?.checked) updates.resetPassword = true;
      setStatus('edit-status', '⏳ Sparar...', false);
      try {
        const result = await api('updateUserByAdmin', { targetId: id, updates });
        if (result.error) { setStatus('edit-status', result.error, true); return; }
        setStatus('edit-status', '✓ Sparat!', false);
        // Invalidera appData-cache så ny klinik syns
        localStorage.removeItem('dops_appdata');
        setTimeout(() => { closeUserEdit(); loadClinicDetail(currentAdminKlinikId); }, 800);
      } catch(err) { setStatus('edit-status', err.message, true); }
    }

    // ── Registrera användare (admin) ────────────────────────────────────
    function openAddUserModal() {
      ['addu-firstname','addu-lastname','addu-email','addu-pin'].forEach(id => document.getElementById(id).value = '');
      document.getElementById('addu-temppin').checked = true;
      toggleAddUserPinField();
      document.getElementById('addu-status').textContent = '';
      const el = document.getElementById('add-user-modal');
      el.style.display = 'flex'; el.classList.remove('hidden');
    }
    function closeAddUserModal() {
      const el = document.getElementById('add-user-modal');
      el.style.display = 'none'; el.classList.add('hidden');
    }
    function toggleAddUserPinField() {
      show('addu-pin-field', !document.getElementById('addu-temppin').checked);
    }
    async function submitAddUser() {
      const firstName = document.getElementById('addu-firstname').value.trim();
      const lastName = document.getElementById('addu-lastname').value.trim();
      const email = document.getElementById('addu-email').value.trim().toLowerCase();
      const jobRole = document.getElementById('addu-jobrole').value;
      const userRole = document.getElementById('addu-userrole').value;
      const tempPin = document.getElementById('addu-temppin').checked;
      const pin = document.getElementById('addu-pin').value.trim();
      const statusEl = document.getElementById('addu-status');
      if (!firstName || !lastName || !email) { statusEl.textContent = 'Fyll i namn och e-post.'; statusEl.style.color = '#9e2a18'; return; }
      if (!tempPin && !/^\d{4,6}$/.test(pin)) { statusEl.textContent = 'PIN måste vara 4–6 siffror.'; statusEl.style.color = '#9e2a18'; return; }
      const clinicName = Object.entries(appData?.klinikIdMap || {}).find(([, kid]) => kid === currentAdminKlinikId)?.[0] || currentUser.clinic;
      statusEl.textContent = 'Registrerar…'; statusEl.style.color = '#5b6b75';
      try {
        const user = { firstName, lastName, email, jobRole, userRole, clinic: clinicName, klinikId: currentAdminKlinikId !== '*' ? currentAdminKlinikId : '' };
        if (tempPin) user.generatePin = true; else user.pin = pin;
        const result = await api('registerUser', { user });
        if (result.error) { statusEl.textContent = result.error; statusEl.style.color = '#9e2a18'; return; }
        if (result.generatedPin) {
          statusEl.textContent = '✓ Skapad! Användaren skriver in sin mejladress vid inloggning för att sätta eget lösenord.';
        } else {
          statusEl.textContent = '✓ Skapad!';
        }
        setTimeout(closeAddUserModal, 1500);
        statusEl.style.color = '#2e4a5f';
        loadClinicDetail(currentAdminKlinikId);
      } catch (err) { statusEl.textContent = err.message; statusEl.style.color = '#9e2a18'; }
    }

    // ── CSV-import ───────────────────────────────────────────────────────
    function openCsvImportModal() {
      document.getElementById('csv-file-input').value = '';
      document.getElementById('csv-import-status').textContent = '';
      document.getElementById('user-csv-editor').classList.add('hidden');
      userCsvRows = [];
      const el = document.getElementById('csv-import-modal');
      el.style.display = 'flex'; el.classList.remove('hidden');
    }
    function closeCsvImportModal() {
      const el = document.getElementById('csv-import-modal');
      el.style.display = 'none'; el.classList.add('hidden');
    }

    // Enkel CSV-parser (hanterar citerade fält, komma ELLER semikolon som avgränsare,
    // samt \r\n/\n/\r-radbrytningar — svensk Excel exporterar ofta med semikolon).
    function parseCsv(text) {
      const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const delimiter = (normalized.split('\n')[0] || '').split(';').length > (normalized.split('\n')[0] || '').split(',').length ? ';' : ',';
      const rows = [];
      let row = [], field = '', inQuotes = false;
      for (let i = 0; i < normalized.length; i++) {
        const c = normalized[i];
        if (inQuotes) {
          if (c === '"' && normalized[i + 1] === '"') { field += '"'; i++; }
          else if (c === '"') { inQuotes = false; }
          else { field += c; }
        } else {
          if (c === '"') inQuotes = true;
          else if (c === delimiter) { row.push(field); field = ''; }
          else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
          else field += c;
        }
      }
      if (field.length || row.length) { row.push(field); rows.push(row); }
      return rows.filter(r => r.some(f => f.trim() !== ''));
    }

    async function submitCsvImport() {
      const fileInput = document.getElementById('csv-file-input');
      const statusEl = document.getElementById('csv-import-status');
      if (!fileInput.files.length) { statusEl.textContent = 'Välj en CSV-fil.'; statusEl.style.color = '#9e2a18'; return; }
      statusEl.textContent = 'Läser fil…'; statusEl.style.color = '#5b6b75';
      try {
        const text = await fileInput.files[0].text();
        const rows = parseCsv(text.replace(/^\uFEFF/, ''));
        if (rows.length < 2) { statusEl.textContent = 'Filen verkar tom.'; statusEl.style.color = '#9e2a18'; return; }
        const dataRows = rows.slice(1).map(r => ({
          firstName: r[0] || '', lastName: r[1] || '', email: r[2] || '',
          jobRole: r[3] || '', userRole: r[4] || '', inaktiverad: r[5] || '', privileges: r[6] || ''
        }));
        statusEl.textContent = 'Laddar upp…';
        const res = await api('bulkImportUsers', { clinicId: currentAdminKlinikId, rows: dataRows });
        if (res.error) { statusEl.textContent = res.error; statusEl.style.color = '#9e2a18'; return; }
        let msg = `✓ ${res.created} skapade, ${res.updated} uppdaterade, ${res.skipped} överhoppade.`;
        if (res.skippedRows?.length) {
          msg += '<br><br><strong>Överhoppade rader:</strong><br>' + res.skippedRows.map(sr =>
            `Rad ${sr.row} (${esc(sr.email) || 'ingen e-post'}): ${esc(sr.reason)}`
          ).join('<br>');
        }
        statusEl.innerHTML = msg;
        statusEl.style.color = '#2e4a5f';
        loadClinicDetail(currentAdminKlinikId);
        if (!res.skippedRows?.length) setTimeout(closeCsvImportModal, 2500);
      } catch (err) { statusEl.textContent = err.message; statusEl.style.color = '#9e2a18'; }
    }

    // ── Delad cellbaserad tabellredigerare (Excel-liknande klistra in rad/kolumn) ──
    function buildCsvCellTable(tableEl, columns, rows) {
      function render() {
        tableEl.innerHTML = '';
        const thead = document.createElement('tr');
        columns.forEach(c => {
          const th = document.createElement('th');
          th.textContent = c.label;
          th.style.cssText = 'text-align:left;padding:4px 6px;font-size:12px;color:#5b6b75;white-space:nowrap;';
          thead.appendChild(th);
        });
        thead.appendChild(document.createElement('th'));
        tableEl.appendChild(thead);
        rows.forEach((row, r) => {
          const tr = document.createElement('tr');
          columns.forEach((c, ci) => {
            const td = document.createElement('td'); td.style.padding = '2px';
            const inp = document.createElement('input');
            inp.type = 'text'; inp.value = row[c.key] || '';
            inp.style.cssText = 'width:100%;min-width:80px;padding:5px 6px;font-size:13px;border:1px solid #c7d1d7;border-radius:3px;';
            inp.addEventListener('input', () => { row[c.key] = inp.value; });
            inp.addEventListener('paste', e => handleGridPaste(e, r, ci));
            td.appendChild(inp);
            tr.appendChild(td);
          });
          const delTd = document.createElement('td');
          const delBtn = document.createElement('button'); delBtn.type = 'button'; delBtn.className = 'btn-danger btn-small'; delBtn.textContent = '✕';
          delBtn.onclick = () => { rows.splice(r, 1); render(); };
          delTd.appendChild(delBtn);
          tr.appendChild(delTd);
          tableEl.appendChild(tr);
        });
      }
      function handleGridPaste(e, startRow, startCol) {
        const text = (e.clipboardData || window.clipboardData).getData('text');
        if (!text.includes('\t') && !text.includes('\n')) return; // enkel inklistring i en cell — låt webbläsaren sköta det
        e.preventDefault();
        const lines = text.replace(/\r/g, '').split('\n').filter((l, i, arr) => !(i === arr.length - 1 && l === ''));
        lines.forEach((line, li) => {
          const cells = line.split('\t');
          cells.forEach((val, ci) => {
            const r = startRow + li, c = startCol + ci;
            if (c >= columns.length) return;
            while (rows.length <= r) rows.push({});
            rows[r][columns[c].key] = val;
          });
        });
        render();
      }
      function addRow() { rows.push({}); render(); }
      render();
      return { addRow, getRows: () => rows };
    }

    // ── In-app CSV-redigerare: användare (cellbaserad Excel-lik tabell) ──
    const USER_JOB_ROLES = ['ST', 'Spec', 'AT', 'BT', 'Admin'];
    const USER_USER_ROLES = ['Registrerare', 'Mottagare', 'Blandbild', 'Administratör'];
    const USER_CSV_COLUMNS = [
      { key: 'firstName', label: 'Förnamn' }, { key: 'lastName', label: 'Efternamn' },
      { key: 'email', label: 'E-post' }, { key: 'jobRole', label: 'Yrkesroll' },
      { key: 'userRole', label: 'Användarroll' }, { key: 'inaktiverad', label: 'Inaktiverad' },
      { key: 'privileges', label: 'Privilegier' }
    ];
    let userCsvGrid = null;

    function toggleUserCsvEditor() {
      const el = document.getElementById('user-csv-editor');
      const willShow = el.classList.contains('hidden');
      el.classList.toggle('hidden');
      if (willShow) {
        const users = allAdminUsers || [];
        const rows = users.map(u => ({
          firstName: u.firstName || '', lastName: u.lastName || '', email: u.email || '',
          jobRole: u.jobRole || '', userRole: u.userRole || '', inaktiverad: u.inaktiverad ? 'Ja' : 'Nej', privileges: ''
        }));
        if (!rows.length) rows.push({});
        userCsvGrid = buildCsvCellTable(document.getElementById('user-csv-table'), USER_CSV_COLUMNS, rows);
        document.getElementById('user-csv-validation').textContent = '';
      }
    }

    function addUserCsvRow() { userCsvGrid?.addRow(); }
    function cancelUserCsvEditor() { document.getElementById('user-csv-editor').classList.add('hidden'); }

    function validateUserCsvRow(row) {
      const errs = [];
      if (!row.firstName) errs.push('Förnamn saknas');
      if (!row.lastName) errs.push('Efternamn saknas');
      if (!row.email || !row.email.includes('@')) errs.push('E-post ogiltig');
      if (!USER_JOB_ROLES.includes(row.jobRole)) errs.push(`Yrkesroll "${row.jobRole}" ogiltig`);
      if (!USER_USER_ROLES.includes(row.userRole)) errs.push(`Användarroll "${row.userRole}" ogiltig`);
      if (row.privileges && row.privileges.split(',').map(p => p.trim()).filter(Boolean).some(p => !/^(Studierektor|Administratör)(\s*\(global\))?$/i.test(p))) {
        errs.push('Privilegier har fel format');
      }
      return errs;
    }

    async function submitUserCsvEditor() {
      const validationEl = document.getElementById('user-csv-validation');
      const rows = (userCsvGrid?.getRows() || []).filter(r => Object.values(r).some(v => (v || '').toString().trim()));
      const problems = [];
      rows.forEach((row, i) => {
        const errs = validateUserCsvRow(row);
        if (errs.length) problems.push(`Rad ${i + 1}: ${errs.join('; ')}`);
      });
      if (problems.length) { validationEl.innerHTML = problems.join('<br>'); return; }
      validationEl.style.color = '#5b6b75'; validationEl.textContent = 'Laddar upp…';
      try {
        const res = await api('bulkImportUsers', { clinicId: currentAdminKlinikId, rows });
        if (res.error) { validationEl.style.color = '#9e2a18'; validationEl.textContent = res.error; return; }
        let msg = `✓ ${res.created} skapade, ${res.updated} uppdaterade, ${res.skipped} överhoppade.`;
        if (res.skippedRows?.length) {
          msg += '<br><br><strong>Överhoppade rader:</strong><br>' + res.skippedRows.map(sr => `Rad ${sr.row}: ${esc(sr.reason)}`).join('<br>');
        }
        validationEl.style.color = '#2e4a5f';
        validationEl.innerHTML = msg;
        loadClinicDetail(currentAdminKlinikId);
      } catch (err) { validationEl.style.color = '#9e2a18'; validationEl.textContent = err.message; }
    }

    async function downloadUsersTemplate() {
      if (!currentAdminKlinikId || currentAdminKlinikId === '*') { await customAlert('Välj en specifik klinik först.'); return; }
      const stored = currentUser || JSON.parse(localStorage.getItem('dops_user') || 'null');
      try {
        const res = await fetch(API_BASE + '/clinics/' + encodeURIComponent(currentAdminKlinikId) + '/users-template', {
          headers: stored?.token ? { 'Authorization': 'Bearer ' + stored.token } : {}
        });
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'anvandare.csv';
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
      } catch (err) { await customAlert('Kunde inte ladda ner mallen: ' + err.message); }
    }

    async function deleteUserFromAdmin() {
      const email = document.getElementById('edit-email').value;
      const id = document.getElementById('edit-id').value;
      if (!await customConfirm('Radera ' + email + '? Detta kan inte ångras.')) return;
      try {
        const res = await api('deleteUser', { id });
        if (res.error) { setStatus('edit-status', res.error, true); return; }
        closeUserEdit();
        loadClinicDetail(currentAdminKlinikId);
      } catch(err) { setStatus('edit-status', err.message, true); }
    }
    async function updatePendingUsersBadge() {
      const btn = document.getElementById('nav-btn-pending-users');
      const badge = document.getElementById('pending-users-badge');
      if (!btn) return;
      const isAdmin = (currentUser?.privileges || []).some(p => p.privilege === 'Administratör');
      if (!isAdmin) { btn.classList.add('hidden'); return; }
      try {
        const res = await api('getPendingCount');
        const n = res.count || 0;
        btn.classList.toggle('hidden', n === 0);
        if (badge) { badge.textContent = n; badge.classList.toggle('hidden', n === 0); }
      } catch (e) { /* tyst */ }
    }
    async function loadPendingUsers() {
      const el = document.getElementById('pending-users-list');
      el.innerHTML = '<p style="color:#8a97a0;font-size:13px;">Hämtar innehåll…</p>';
      try {
        const users = await api('getPendingUsers');
        if (!users.length) { el.innerHTML = '<p style="color:#888;">Inga användare väntar på godkännande.</p>'; return; }
        el.innerHTML = '';
        users.forEach(u => {
          const card = document.createElement('div');
          card.className = 'assessment-card';
          card.style.marginTop = '10px';
          card.innerHTML = `<div style="font-weight:bold;font-size:16px;">${esc(u.firstName)} ${esc(u.lastName)}</div>
            <div style="font-size:14px;color:#5b6b75;margin-top:3px;">${esc(u.email)}</div>
            <div style="font-size:14px;margin-top:4px;">${esc(u.jobRole)} · ${esc(u.clinic)} · ${esc(u.userRole)}</div>`;
          const approveBtn = document.createElement('button');
          approveBtn.className = 'btn-primary btn-small';
          approveBtn.textContent = 'Godkänn';
          approveBtn.style.marginTop = '8px';
          approveBtn.onclick = async () => {
            try {
              await api('updateUserByAdmin', { targetId: u.id, updates: { pendingActivation: false } });
              loadPendingUsers();
              updatePendingUsersBadge();
            } catch (err) { await customAlert(err.message); }
          };
          card.appendChild(approveBtn);
          el.appendChild(card);
        });
      } catch (err) { el.innerHTML = html`<p class="status-err">${err.message}</p>`; }
    }
