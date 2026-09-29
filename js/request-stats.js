// ── Förfrågningsöversikt ─────────────────────────────────────────────────────
// Utbruten från index.html (Fas 2, modularisering). Klassiskt script (ej
// type="module") — se js/progress.js för motivering och beroendemodell.
//
// Beroenden som förutsätts finnas redan (huvudfilen): api(), esc(), html(), safe(),
// currentUser, activeKlinikId, appData, show(), setStatus(), newOption(), customAlert(),
// customConfirm(), lockUI()/unlockUI(), _isProcessing.

    let _lastRequestStats = null;

    async function loadRequestStats() {
      const el = document.getElementById('reqstat-content');
      el.innerHTML = '<p style="color:#8a97a0;font-size:13px;">Hämtar innehåll…</p>';
      try {
        const klinikId = activeKlinikId || currentUser.klinikId || '*';
        // Samma klinikId-uträkning som saveRequestExpiry (annars visas/sparas fel klinik i "alla kliniker"-vyn)
        const settingsKlinikId = activeKlinikId && activeKlinikId !== '*' ? activeKlinikId : currentUser.klinikId;
        const [data, settings] = await Promise.all([
          api('getRequestStats', { klinikId }),
          api('getKlinikSettings', { klinikId: settingsKlinikId })
        ]);
        const sel = document.getElementById('expiry-select');
        if (sel) sel.value = String(settings.requestExpiry || 0);
        _lastRequestStats = data;
        renderRequestStats(data);
      } catch(err) {
        el.innerHTML = html`<p class="status-err">Fel: ${err.message}</p>`;
      }
    }

    function renderRequestStats(data) {
      if (!data) return;
      const el = document.getElementById('reqstat-content');
      const s = data.summary;
      let out = '';

      // Sammanfattning
      out += '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:20px;">';
      out += html`<div style="background:#2e4a5f;color:#eef1f3;border-radius:8px;padding:14px 20px;min-width:120px;text-align:center;"><div style="font-size:11px;opacity:0.8;letter-spacing:1px;">TOTALT</div><div style="font-size:28px;font-weight:bold;">${s.total}</div></div>`;
      out += html`<div style="background:#4a9e62;color:#eef1f3;border-radius:8px;padding:14px 20px;min-width:120px;text-align:center;"><div style="font-size:11px;opacity:0.8;letter-spacing:1px;">UTFÖRDA</div><div style="font-size:28px;font-weight:bold;">${s.done}</div></div>`;
      if (s.inaktuell) out += html`<div style="background:#8a97a0;color:#eef1f3;border-radius:8px;padding:14px 20px;min-width:120px;text-align:center;"><div style="font-size:11px;opacity:0.8;letter-spacing:1px;">INAKTUELLA</div><div style="font-size:28px;font-weight:bold;">${s.inaktuell}</div></div>`;
      out += html`<div style="background:#c8a96e;color:#eef1f3;border-radius:8px;padding:14px 20px;min-width:120px;text-align:center;"><div style="font-size:11px;opacity:0.8;letter-spacing:1px;">VÄNTANDE</div><div style="font-size:28px;font-weight:bold;">${s.pending}</div></div>`;
      out += '</div>';

      // Per formulärtyp
      if (Object.keys(s.byFormType).length) {
        out += '<div class="section-header" style="margin-bottom:10px;">Per formulärtyp</div>';
        out += '<div style="background:#eef1f3;border:1.5px solid #c7d1d7;border-radius:8px;padding:14px;margin-bottom:20px;max-width:500px;">';
        Object.entries(s.byFormType).sort((a,b) => b[1].total - a[1].total).forEach(([ft, v], i, arr) => {
          const pct = v.total > 0 ? Math.round(v.done / v.total * 100) : 0;
          const color = pct >= 100 ? '#4a9e62' : pct > 0 ? '#c8a96e' : '#9e2a18';
          if (i > 0) out += '<div style="height:1px;background:#c7d1d7;margin:8px 0;"></div>';
          out += html`<div style="display:flex;align-items:center;gap:10px;">
            <span style="flex:1;font-size:14px;">${ft}</span>
            <span style="font-size:13px;color:#5b6b75;">${v.done}/${v.total}</span>
            <span style="font-size:13px;font-weight:bold;color:${safe(color)};">${pct}%</span>
          </div>`;
        });
        out += '</div>';
      }

      // Per yrkesroll
      if (Object.keys(s.byRole).length) {
        out += '<div class="section-header" style="margin-bottom:10px;">Per yrkesroll (mottagare)</div>';
        out += '<div style="background:#eef1f3;border:1.5px solid #c7d1d7;border-radius:8px;padding:14px;margin-bottom:20px;max-width:500px;">';
        Object.entries(s.byRole).sort((a,b) => a[0].localeCompare(b[0])).forEach(([role, v], i) => {
          if (i > 0) out += '<div style="height:1px;background:#c7d1d7;margin:8px 0;"></div>';
          out += html`<div style="display:flex;align-items:center;gap:10px;">
            <span style="flex:1;font-size:14px;font-weight:bold;">${formatJobRole(role)}</span>
            <span style="font-size:13px;color:#5b6b75;">${v.done} av ${v.total} utförda</span>
          </div>`;
        });
        out += '</div>';
      }

      // Senaste förfrågningar ("Visa bara mina utskick" filtrerar listan, inte summeringen ovan)
      const mineOnly = document.getElementById('reqstat-mine-only')?.checked;
      const list = mineOnly ? data.requests.filter(r => r.sentByMe) : data.requests;
      if (mineOnly && !list.length) out += '<p style="color:#888;">Du har inte skickat några förfrågningar.</p>';
      if (list.length) {
        out += html`<div class="section-header" style="margin-bottom:10px;">${mineOnly ? 'Mina utskick' : 'Senaste förfrågningar'}</div>`;
        out += '<div style="display:flex;flex-direction:column;gap:8px;">';
        list.slice(0, mineOnly ? 100 : 20).forEach(r => {
          const statusColor = r.status === 'Utförd' ? '#4a9e62' : r.status === 'Inaktuell' ? '#8a97a0' : '#c8a96e';
          const statusText  = r.status === 'Utförd' ? '✓ Utförd' : r.status === 'Inaktuell' ? '✕ Inaktuell' : '⏳ Väntande';
          out += html`<div style="background:#eef1f3;border:1.5px solid #c7d1d7;border-radius:6px;padding:10px 14px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
            <div style="flex:1;min-width:180px;">
              <span style="font-weight:bold;">${r.toName}</span>
              <span style="font-size:13px;color:#5b6b75;"> (${formatJobRole(r.toRole)})</span>
              ${r.kind === 'obtain' ? safe('<span style="font-size:12px;background:#f3ecdc;color:#2e4a5f;border-radius:4px;padding:1px 6px;margin-left:4px;">inhämta bedömning</span>') : r.isSelf ? safe('<span style="font-size:12px;background:#e8f4ea;color:#2e4a5f;border-radius:4px;padding:1px 6px;margin-left:4px;">självskattning</span>') : ''}
              <div style="font-size:12px;color:#8a97a0;margin-top:2px;">${r.formType || ''} · ${_requestParties(r)} · ${r.timestamp}${r.dueDate ? ' · sista datum ' + r.dueDate : ''}</div>
            </div>
            <span style="font-size:13px;font-weight:bold;color:${safe(statusColor)};">${safe(statusText)}</span>
          </div>`;
        });
        out += '</div>';
      }

      el.innerHTML = out;
    }
    // Vem som gör vad, för tre-partsförfrågningar (v4.50.0): "bedömer X · begärd av Y".
    // Ursprungligt fall (den bedömda skickade själv) oförändrat: "från X".
    function _requestParties(r) {
      if (r.kind === 'obtain' || r.isSelf) return 'begärd av ' + r.fromName;
      if (r.subjectName && r.subjectName !== r.fromName) return 'bedömer ' + r.subjectName + ' · begärd av ' + r.fromName;
      return 'från ' + r.fromName;
    }

    // ── Ny förfrågan (Studierektor/Administratör) ──────────────────────────
    let _mrUsers = [];
    let _mrKlinikId = null;
    const _mrName = u => `${u.firstName || ''} ${u.lastName || ''}`.trim();
    const _mrSort = (a, b) => (a.lastName || '').localeCompare(b.lastName || '', 'sv') || (a.firstName || '').localeCompare(b.firstName || '', 'sv');

    async function showManagedRequestForm() {
      _mrKlinikId = activeKlinikId && activeKlinikId !== '*' ? activeKlinikId : null;
      if (!_mrKlinikId) { await customAlert('Välj en specifik klinik först — förfrågningar skickas inom en klinik.'); return; }
      show('managed-request-form', true);
      setStatus('mr-status', '', false);
      const ft = document.getElementById('mr-formtype');
      ft.innerHTML = '<option value="">-- Välj formulär --</option>';
      [...new Set(Object.values(appData?.formTypes || {}).flat())].sort((a, b) => a.localeCompare(b, 'sv'))
        .forEach(f => ft.appendChild(newOption(f, f)));
      const due = document.getElementById('mr-due');
      const t = new Date();
      due.min = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
      try {
        _mrUsers = (await api('getAllUsers', { klinikId: _mrKlinikId })).filter(u => !u.pendingActivation).sort(_mrSort);
      } catch (err) { setStatus('mr-status', err.message, true); return; }
      const subj = document.getElementById('mr-subject');
      subj.innerHTML = '<option value="">-- Välj person --</option>';
      _mrUsers.filter(u => ['ST', 'Spec', 'AT', 'BT'].includes(u.jobRole))
        .forEach(u => subj.appendChild(newOption(u.id, `${_mrName(u)} (${formatJobRole(u.jobRole)})`)));
      // Bedömare: alla som kan registrera bedömningar (inte rena Mottagare).
      const ass = document.getElementById('mr-assessor');
      ass.innerHTML = '<option value="">-- Välj bedömare --</option>';
      _mrUsers.filter(u => !/^Mottagare/.test(u.userRole || ''))
        .forEach(u => ass.appendChild(newOption(u.id, `${_mrName(u)}${u.jobRole ? ' (' + formatJobRole(u.jobRole) + ')' : ''}`)));
      updateManagedRequestForm();
    }

    function hideManagedRequestForm() { show('managed-request-form', false); }

    function _mrMode() { return document.querySelector('input[name="mr-mode"]:checked')?.value || 'directed'; }

    function updateManagedRequestForm() {
      const mass = _mrMode() !== 'directed';
      show('mr-directed-fields', !mass);
      show('mr-mass-fields', mass);
      document.getElementById('mr-formtype-label').textContent = mass ? 'Formulär *' : 'Formulär (valfritt)';
      const remind = document.getElementById('mr-remind');
      remind.disabled = !document.getElementById('mr-due').value;
      if (remind.disabled) remind.value = '0';
    }

    function populateManagedRecipients() {
      const role = document.getElementById('mr-role').value;
      const container = document.getElementById('mr-recipients');
      container.innerHTML = '';
      _mrUsers.filter(u => role && u.jobRole === role).forEach(u => {
        const label = document.createElement('label');
        label.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:14px;cursor:pointer;background:#eef1f3;border:1px solid #c7d1d7;border-radius:4px;padding:4px 10px;';
        const cb = document.createElement('input');
        cb.type = 'checkbox'; cb.value = u.id; cb.checked = true; cb.className = 'mr-recipient-cb';
        label.appendChild(cb);
        label.appendChild(document.createTextNode(_mrName(u)));
        container.appendChild(label);
      });
      if (role && !container.children.length) container.innerHTML = '<p style="color:#888;font-size:13px;">Inga aktiva användare i gruppen.</p>';
    }

    async function sendManagedRequest() {
      if (_isProcessing) return;
      const mode = _mrMode();
      const body = {
        clinicId: _mrKlinikId, mode,
        formType: document.getElementById('mr-formtype').value,
        message: document.getElementById('mr-message').value.trim(),
        dueDate: document.getElementById('mr-due').value || null,
        remindDaysBefore: parseInt(document.getElementById('mr-remind').value) || 0
      };
      if (mode === 'directed') {
        body.subjectId = document.getElementById('mr-subject').value;
        body.assessorId = document.getElementById('mr-assessor').value;
        if (!body.subjectId || !body.assessorId) { setStatus('mr-status', 'Välj både person som ska bedömas och bedömare.', true); return; }
        if (body.subjectId === body.assessorId) { setStatus('mr-status', 'Bedömaren kan inte vara samma person — använd självskattning för det.', true); return; }
      } else {
        body.userIds = [...document.querySelectorAll('.mr-recipient-cb:checked')].map(cb => cb.value);
        if (!body.userIds.length) { setStatus('mr-status', 'Välj minst en mottagare.', true); return; }
        if (!body.formType) { setStatus('mr-status', 'Välj formulär.', true); return; }
      }
      if (!body.message) { setStatus('mr-status', 'Skriv ett meddelande.', true); return; }
      if (mode !== 'directed' && !await customConfirm(`Skicka till ${body.userIds.length} ${body.userIds.length === 1 ? 'person' : 'personer'}? Var och en får ett mejl.`, 'Skicka', 'Avbryt')) return;
      lockUI();
      try {
        const res = await api('sendManagedRequest', body);
        unlockUI();
        setStatus('mr-status', `✓ Skickad till ${res.sent} ${res.sent === 1 ? 'person' : 'personer'}.`, false);
        document.getElementById('mr-message').value = '';
        setTimeout(() => { hideManagedRequestForm(); loadRequestStats(); }, 1500);
      } catch (err) { unlockUI(); setStatus('mr-status', err.message, true); }
    }

    function saveRequestExpiry(weeks) {
      const kid = activeKlinikId && activeKlinikId !== '*' ? activeKlinikId : currentUser.klinikId;
      const statusEl = document.getElementById('expiry-save-status');
      if (statusEl) { statusEl.textContent = 'Sparar…'; statusEl.style.color = '#5b6b75'; }
      api('saveKlinikSettings', { klinikId: kid, settings: { requestExpiry: parseInt(weeks) || 0 } })
        .then(() => {
          bgInvalidate('inbox_' + currentUser.email); loadInbox();
          if (statusEl) { statusEl.style.color = '#2e4a5f'; statusEl.textContent = '✓ Sparat'; setTimeout(() => statusEl.textContent = '', 2500); }
        })
        .catch(e => { console.error('saveRequestExpiry:', e); if (statusEl) { statusEl.style.color = '#9e2a18'; statusEl.textContent = 'Kunde inte spara: ' + e.message; } });
    }
