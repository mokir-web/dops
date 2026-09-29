// ── Felanmälningar ───────────────────────────────────────────────────────────
// Utbruten från index.html (Fas 2, modularisering). Klassiskt script (ej
// type="module") — se js/progress.js för motivering och beroendemodell.
// Beroenden (huvudfilen): api(), esc().

    function renderErrorReportsList(container, reports, showClinic) {
      if (!reports.length) { container.innerHTML = html`<p style="color:#888;">Inga felanmälningar.</p>`; return; }
      container.innerHTML = reports.map(r => {
        const namn = (r.first_name || '') + ' ' + (r.last_name || '');
        const datum = new Date(r.created_at).toLocaleString('sv-SE');
        const sysInfo = JSON.stringify(r.system_info, null, 2);
        return html`
          <div class="assessment-card" style="margin-bottom:10px;">
            <div style="font-weight:bold;">${namn} &middot; ${r.email || ''}</div>
            ${showClinic ? safe(html`<div style="font-size:12px;color:#5b6b75;">${r.clinic_name || ''}</div>`) : ''}
            <div style="font-size:12px;color:#5b6b75;margin-bottom:6px;">${datum}</div>
            <div style="font-size:14px;white-space:pre-wrap;margin-bottom:8px;">${r.message}</div>
            <details><summary style="cursor:pointer;font-size:12px;color:#5b6b75;">Systeminformation</summary>
            <pre style="font-size:11px;white-space:pre-wrap;background:#eef1f3;padding:8px;border-radius:5px;margin-top:6px;">${sysInfo}</pre></details>
          </div>`;
      }).join('');
    }

    function renderClientErrorsList(container, errors) {
      if (!errors.length) { container.innerHTML = html`<p style="color:#888;">Inga automatiskt rapporterade fel.</p>`; return; }
      const fmt = (d) => new Date(d).toLocaleString('sv-SE');
      container.innerHTML = errors.map(e => {
        const resolved = !!e.resolved_at;
        const versions = e.first_version === e.last_version ? (e.last_version || '?') : `${e.first_version || '?'} → ${e.last_version || '?'}`;
        const who = ((e.first_name || '') + ' ' + (e.last_name || '')).trim();
        return html`
          <div class="assessment-card" style="margin-bottom:10px;${resolved ? 'opacity:0.55;' : ''}">
            <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
              <div style="font-weight:bold;font-family:monospace;font-size:13px;word-break:break-word;">${e.message}</div>
              <span style="flex-shrink:0;background:${resolved ? '#c7d1d7' : '#9e2a18'};color:#fff;border-radius:10px;padding:1px 9px;font-size:12px;">${e.count} ggr</span>
            </div>
            <div style="font-size:12px;color:#5b6b75;margin:6px 0;line-height:1.6;">
              ${e.source || ''}${e.source ? safe(html`<br>`) : ''}
              Först ${fmt(e.first_seen)} · senast ${fmt(e.last_seen)} · ${versions} · panel: ${e.last_panel || '?'}${e.error_type ? ` · ${e.error_type}` : ''}
              ${who ? safe(html`<br>Senast drabbad: ${who}`) : ''}
              ${resolved ? safe(html`<br>Åtgärdat ${fmt(e.resolved_at)}`) : ''}
            </div>
            <details><summary style="cursor:pointer;font-size:12px;color:#5b6b75;">Webbläsare</summary>
            <pre style="font-size:11px;white-space:pre-wrap;background:#eef1f3;padding:8px;border-radius:5px;margin-top:6px;">${e.last_user_agent || ''}</pre></details>
            <div class="btn-row" style="margin-top:8px;"><button class="btn-secondary btn-small" onclick="setClientErrorResolved('${e.id}', ${!resolved})">${resolved ? 'Öppna igen' : 'Markera som åtgärdat'}</button></div>
          </div>`;
      }).join('');
    }

    async function loadClientErrors() {
      const el = document.getElementById('client-errors-list');
      try {
        renderClientErrorsList(el, await api('getClientErrors'));
      } catch (err) { el.innerHTML = html`<p class="status-err">${err.message}</p>`; }
    }

    async function setClientErrorResolved(id, resolved) {
      await api('setClientErrorResolved', { id, resolved });
      loadClientErrors();
    }

    async function loadErrorReports() {
      loadClientErrors();
      const globalList = document.getElementById('error-reports-global-list');
      try {
        const [global, settings] = await Promise.all([
          api('getErrorReports'),
          api('getGlobalFeedbackSettings')
        ]);
        renderErrorReportsList(globalList, global, true);
        document.getElementById('global-feedback-email').value = settings?.feedbackEmail || '';
      } catch (err) { globalList.innerHTML = html`<p class="status-err">${err.message}</p>`; }
    }

    async function saveGlobalFeedbackEmail() {
      const email = document.getElementById('global-feedback-email')?.value.trim() || '';
      await api('saveGlobalFeedbackSettings', { feedbackEmail: email });
    }

