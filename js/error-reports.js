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

    async function loadErrorReports() {
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

