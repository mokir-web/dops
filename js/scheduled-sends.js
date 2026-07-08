// ── Schemalagda utskick ──────────────────────────────────────────────────────
// Utbruten från index.html (Fas 2, modularisering). Klassiskt script (ej
// type="module") — se js/progress.js för motivering och beroendemodell.
//
// Beroenden som förutsätts finnas redan (huvudfilen): api(), esc(), show(),
// currentUser, appData, activeKlinikId, customConfirm(), setStatus().

    // ── Schemalagda utskick ───────────────────────────────────────────────
    let _currentScheduleId = null;

    async function loadSchedules() {
      const el = document.getElementById('schedule-list');
      if (!el) return;
      el.innerHTML = '<p style="color:#8a97a0;font-size:13px;">Hämtar innehåll…</p>';
      const klinikId = activeKlinikId || currentUser.klinikId || '*';
      try {
        const schedules = await api('getScheduledEmails', { klinikId });
        if (!schedules.length) { el.innerHTML = '<p style="color:#888;font-size:14px;">Inga schemalagda påminnelser.</p>'; return; }
        el.innerHTML = schedules.map(s => {
          // Formatera tid: "Söndag" + "kl 07:00" – hanterar Date-objekt från Sheets
          const dag = s.dag || '';
          let tidStr = s.tid || '';
          if (tidStr && tidStr.includes('1899')) {
            // Sheets returnerade Date-sträng – extrahera HH:MM
            const m = tidStr.match(/(\d{2}):(\d{2})/);
            tidStr = m ? m[1] + ':' + m[2] : '?';
          }
          const dagLabel = dag === 'Varje dag' ? 'Varje dag' : dag + 'ar';
          const tidLabel = tidStr ? 'kl ' + tidStr : '';
          return `<div class="assessment-card" style="margin-top:10px;max-width:560px;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <div style="font-weight:bold;font-size:15px;">${esc(s.namn)}</div>
              <span style="font-size:12px;padding:2px 8px;border-radius:10px;background:${s.aktiv?'#e8f4ec':'#eef1f3'};color:${s.aktiv?'#2e4a5f':'#8a97a0'};">${s.aktiv?'Aktiv':'Inaktiv'}</span>
            </div>
            <div style="font-size:13px;color:#5b6b75;margin-top:4px;">${esc(dagLabel)} ${tidLabel} · ${s.mottagare.length} mottagare</div>
            <div style="margin-top:8px;display:flex;gap:8px;">
              <button class="btn-secondary btn-small" onclick='editSchedule(${JSON.stringify(s).replace(/'/g,"&#39;")})'>Redigera</button>
              <button class="btn-secondary btn-small" onclick="toggleSchedule('${s.id}')">${s.aktiv ? 'Pausa' : 'Aktivera'}</button>
              <button class="btn-secondary btn-small" onclick="deleteSchedule('${s.id}')">Ta bort</button>
            </div>
          </div>`;
        }).join('');
      } catch(err) { if (el) el.innerHTML = '<p class="status-err">' + esc(err.message) + '</p>'; }
    }

    async function showScheduleForm(existing) {
      _currentScheduleId = existing?.id || null;
      const titleEl = document.getElementById('sch-form-title');
      if (titleEl) titleEl.textContent = existing ? 'Redigera påminnelse' : 'Ny påminnelse';
      document.getElementById('sch-namn').value = existing?.namn || '';
      document.getElementById('sch-dag').value  = existing?.dag  || 'Måndag';
      let tid = existing?.tid || '07:00';
      if (tid && tid.length > 5) { const m = tid.match(/(\d{2}):(\d{2})/); tid = m ? m[1]+':'+m[2] : '07:00'; }
      document.getElementById('sch-tid').value  = tid;
      document.getElementById('sch-typ').value  = existing?.mottagarTyp || 'Registrerare';
      const innehall = existing?.innehall || 'sent,received,formtypes';
      const sc = document.getElementById('sch-content-sent');
      const rc = document.getElementById('sch-content-received');
      const fc = document.getElementById('sch-content-formtypes');
      const stc = document.getElementById('sch-content-sent-to');
      const rfc = document.getElementById('sch-content-received-from');
      if (sc)  sc.checked  = innehall.includes('sent');
      if (rc)  rc.checked  = innehall.includes('received');
      if (fc)  fc.checked  = innehall.includes('formtypes');
      if (stc) stc.checked = innehall.includes('sent_to');
      if (rfc) rfc.checked = innehall.includes('received_from');
      const pEl = document.getElementById('sch-period');
      if (pEl) pEl.value = existing?.periodVeckor || 1;
      // Klinikval
      const klinikSel = document.getElementById('sch-klinik');
      if (klinikSel) {
        klinikSel.innerHTML = '';
        const idToNamn = {};
        if (appData?.klinikIdMap) Object.entries(appData.klinikIdMap).forEach(([n,k]) => { idToNamn[k] = n; });
        const kliniker = new Map([[currentUser.klinikId, currentUser.clinic || idToNamn[currentUser.klinikId] || currentUser.klinikId]]);
        (currentUser.privileges || []).forEach(p => {
          if ((p.privilege === 'Administratör' || p.privilege === 'Studierektor') && p.klinikId && p.klinikId !== '*')
            kliniker.set(p.klinikId, idToNamn[p.klinikId] || p.klinikId);
        });
        kliniker.forEach((namn, kid) => {
          const opt = document.createElement('option'); opt.value = kid; opt.textContent = namn; klinikSel.appendChild(opt);
        });
        klinikSel.value = existing?.klinikId || currentUser.klinikId;
      }
      show('schedule-form', true);
      if (!allAdminUsers || !allAdminUsers.length) {
        try {
          const res = await api('getAllUsers', { klinikId: klinikSel?.value || currentUser.klinikId || '*' });
          allAdminUsers = res || [];
        } catch(e) { allAdminUsers = []; }
      }
      populateScheduleRecipients(existing?.mottagare || []);
    }

    function editSchedule(s) { showScheduleForm(s); }

    function populateScheduleRecipients(checked = []) {
      const typ = document.getElementById('sch-typ')?.value || '';
      const klinikId = document.getElementById('sch-klinik')?.value || currentUser.klinikId;
      const container = document.getElementById('sch-recipients');
      if (!container) return;
      container.innerHTML = '';
      const allUsers = allAdminUsers || [];
      const filtered = typ === 'Alla' ? allUsers : allUsers.filter(u =>
        u.userRole === typ || (typ === 'Registrerare' && u.userRole === 'Blandbild')
      );
      filtered.filter(u => !klinikId || klinikId === '*' || u.klinikId === klinikId)
        .sort((a, b) => a.lastName.localeCompare(b.lastName, 'sv') || a.firstName.localeCompare(b.firstName, 'sv'))
        .forEach(u => {
          const lbl = document.createElement('label');
          lbl.style.cssText = 'display:flex;align-items:center;gap:8px;padding:4px 0;font-size:14px;cursor:pointer;';
          const cb = document.createElement('input'); cb.type = 'checkbox'; cb.value = u.email;
          if (checked.includes(u.email)) cb.checked = true;
          lbl.appendChild(cb);
          lbl.appendChild(document.createTextNode(u.firstName + ' ' + u.lastName + ' (' + u.jobRole + ')'));
          container.appendChild(lbl);
        });
    }

    async function saveSchedule() {
      const mottagare = [...document.querySelectorAll('#sch-recipients input:checked')].map(cb => cb.value);
      const innehall = [
        document.getElementById('sch-content-sent')?.checked          ? 'sent'           : '',
        document.getElementById('sch-content-received')?.checked      ? 'received'       : '',
        document.getElementById('sch-content-formtypes')?.checked     ? 'formtypes'      : '',
        document.getElementById('sch-content-sent-to')?.checked       ? 'sent_to'        : '',
        document.getElementById('sch-content-received-from')?.checked ? 'received_from'  : '',
      ].filter(Boolean).join(',');
      const periodVeckor = parseInt(document.getElementById('sch-period')?.value) || 1;
      const schedule = {
        id: _currentScheduleId || undefined,
        namn:        document.getElementById('sch-namn').value.trim(),
        klinikId:    document.getElementById('sch-klinik')?.value || currentUser.klinikId || '',
        mottagarTyp: document.getElementById('sch-typ').value,
        dag:         document.getElementById('sch-dag').value,
        tid:         document.getElementById('sch-tid').value,
        innehall, mottagare, aktiv: true, periodVeckor
      };
      if (!schedule.namn) { setStatus('sch-status', 'Ange ett namn.', true); return; }
      if (!mottagare.length) { setStatus('sch-status', 'Välj minst en mottagare.', true); return; }
      try {
        await api('saveScheduledEmail', { schedule });
        setStatus('sch-status', '✓ Sparat!', false);
        setTimeout(() => { show('schedule-form', false); loadSchedules(); }, 800);
      } catch(err) { setStatus('sch-status', err.message, true); }
    }

    async function toggleSchedule(id) {
      try { await api('toggleScheduleActive', { id }); loadSchedules(); } catch(e) {}
    }
    async function deleteSchedule(id) {
      if (!await customConfirm('Ta bort detta schema?')) return;
      await api('deleteScheduledEmail', { id });
      loadSchedules();
    }
