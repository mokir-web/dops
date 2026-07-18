// ── Användningsstatistik (global admin) ─────────────────────────────────────
// Utbruten från index.html (Fas 2, modularisering). Klassiskt script (ej
// type="module") — se js/progress.js för motivering och beroendemodell.
//
// Beroenden som förutsätts finnas redan (huvudfilen): api(), esc(), html(),
// safe(), jsAttr(), show(), appData, currentUser.

    function toggleUsageStatsFilter() {
      const panel = document.getElementById('us-filter-panel');
      const btn = document.getElementById('us-filter-toggle-btn');
      const open = panel.classList.toggle('hidden') === false;
      btn.textContent = open ? 'Stäng filter' : 'Filtrera';
    }

    function _usageStatsFilters() {
      const f = {};
      const from = document.getElementById('us-date-from')?.value;
      const to = document.getElementById('us-date-to')?.value;
      const clinic = document.getElementById('us-clinic-filter')?.value;
      const jobRole = document.getElementById('us-jobrole-filter')?.value;
      const priv = document.getElementById('us-privilege-filter')?.value;
      const includeDemo = document.getElementById('us-include-demo')?.checked;
      if (from) f.dateFrom = from;
      if (to) f.dateTo = to;
      if (clinic) f.clinicId = clinic;
      if (jobRole) f.jobRole = jobRole;
      if (priv) f.activePrivilege = priv;
      if (includeDemo) f.includeDemo = 'true';
      return f;
    }

    function resetUsageStatsFilters() {
      ['us-date-from', 'us-date-to', 'us-clinic-filter', 'us-jobrole-filter', 'us-privilege-filter'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      const demo = document.getElementById('us-include-demo');
      if (demo) demo.checked = false;
      loadUsageStats();
    }

    function _fillUsageClinicOptions() {
      const sel = document.getElementById('us-clinic-filter');
      if (!sel || sel.options.length > 1 || !appData?.klinikIdMap) return;
      Object.entries(appData.klinikIdMap).sort((a, b) => a[0].localeCompare(b[0], 'sv')).forEach(([namn, kid]) => {
        sel.appendChild(new Option(namn, kid));
      });
    }

    function _formatDuration(seconds) {
      const s = parseInt(seconds) || 0;
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      if (h > 0) return `${h} h ${m} min`;
      if (m > 0) return `${m} min`;
      return `${s} s`;
    }

    async function loadUsageStats() {
      _fillUsageClinicOptions();
      document.getElementById('us-sessions-view').classList.add('hidden');
      const statusEl = document.getElementById('us-summary-status');
      const listEl = document.getElementById('us-summary-list');
      statusEl.innerHTML = '<span style="font-size:12px;color:#8a97a0;">Hämtar…</span>';
      try {
        const rows = await api('getUsageSummary', { filters: _usageStatsFilters() });
        statusEl.innerHTML = '';
        renderUsageSummary(rows);
      } catch (err) {
        statusEl.innerHTML = '';
        listEl.innerHTML = html`<p class="status-err">${err.message}</p>`;
      }
      loadUsageDevices();
    }

    async function loadUsageDevices() {
      const el = document.getElementById('us-devices-list');
      if (!el) return;
      el.innerHTML = '<p style="color:#888;font-size:13px;">Hämtar…</p>';
      try {
        const data = await api('getUsageDevices', { filters: _usageStatsFilters() });
        renderUsageDevices(data);
      } catch (err) {
        el.innerHTML = html`<p class="status-err">${err.message}</p>`;
      }
    }

    function renderUsageDevices(data) {
      const el = document.getElementById('us-devices-list');
      if (!data.total) { el.innerHTML = '<p style="color:#888;">Inga sessioner för valt filter.</p>'; return; }
      const bar = (name, count) => {
        const pct = Math.round((count / data.total) * 100);
        return html`<div style="margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:2px;"><span>${name}</span><span style="color:#5b6b75;">${count} (${pct}%)</span></div>
          <div style="background:#c7d1d7;border-radius:4px;height:6px;overflow:hidden;"><div style="background:#2e4a5f;height:100%;width:${pct}%;"></div></div>
        </div>`;
      };
      let out = '<div style="display:flex;gap:32px;flex-wrap:wrap;max-width:600px;">';
      out += '<div style="flex:1;min-width:220px;"><div class="section-header" style="margin-bottom:8px;">Enhet</div>' + data.devices.map(d => bar(d.name, d.count)).join('') + '</div>';
      out += '<div style="flex:1;min-width:220px;"><div class="section-header" style="margin-bottom:8px;">Webbläsare</div>' + data.browsers.map(b => bar(b.name, b.count)).join('') + '</div>';
      out += '</div>';
      el.innerHTML = out;
    }

    function renderUsageSummary(rows) {
      const listEl = document.getElementById('us-summary-list');
      if (!rows.length) { listEl.innerHTML = '<p style="color:#888;">Inga händelser för valt filter.</p>'; return; }
      let out = '<table style="width:100%;border-collapse:collapse;max-width:920px;">';
      out += '<tr style="text-align:left;font-size:12px;color:#5b6b75;border-bottom:1.5px solid #c7d1d7;">'
        + '<th style="padding:6px 8px;">Namn</th><th>Klinik</th><th>Roll</th><th>Sessioner</th>'
        + '<th>Aktiv tid</th><th class="us-desktop-only">Mest besökt</th><th class="us-desktop-only">Rollbyten</th><th>Senast aktiv</th></tr>';
      rows.forEach(r => {
        out += html`<tr style="cursor:pointer;border-bottom:1px solid #e4e9ec;" onclick="openUsageSessionsView('${safe(jsAttr(r.userId))}','${safe(jsAttr(r.name))}')">
          <td style="padding:6px 8px;font-weight:bold;">${r.name}</td>
          <td>${r.clinicName}</td>
          <td>${r.jobRole}</td>
          <td>${r.sessionCount}</td>
          <td>${_formatDuration(r.activeSeconds)}</td>
          <td class="us-desktop-only">${r.topPanel}</td>
          <td class="us-desktop-only">${r.privilegeSwitches}</td>
          <td style="font-size:12px;color:#5b6b75;">${r.lastSeen ? new Date(r.lastSeen).toLocaleString('sv-SE') : ''}</td>
        </tr>`;
      });
      out += '</table>';
      listEl.innerHTML = out;
    }

    async function openUsageSessionsView(userId, name) {
      document.getElementById('us-sessions-view').classList.remove('hidden');
      document.getElementById('us-sessions-title').textContent = 'Sessioner — ' + name;
      const listEl = document.getElementById('us-sessions-list');
      listEl.innerHTML = '<p style="color:#888;">Hämtar…</p>';
      try {
        const filters = _usageStatsFilters();
        filters.userId = userId;
        const rows = await api('getUsageSessions', { filters });
        renderUsageSessions(rows);
      } catch (err) {
        listEl.innerHTML = html`<p class="status-err">${err.message}</p>`;
      }
      document.getElementById('us-sessions-view').scrollIntoView({ block: 'start', behavior: 'smooth' });
    }

    function closeUsageSessionsView() {
      document.getElementById('us-sessions-view').classList.add('hidden');
    }

    function renderUsageSessions(rows) {
      const listEl = document.getElementById('us-sessions-list');
      if (!rows.length) { listEl.innerHTML = '<p style="color:#888;">Inga sessioner.</p>'; return; }
      let out = '<table style="width:100%;border-collapse:collapse;max-width:760px;">';
      out += '<tr style="text-align:left;font-size:12px;color:#5b6b75;border-bottom:1.5px solid #c7d1d7;">'
        + '<th style="padding:6px 8px;">Start</th><th>Total tid</th><th>Aktiv tid</th><th>Händelser</th><th class="us-desktop-only">Enhet/webbläsare</th></tr>';
      rows.forEach(r => {
        const totalSeconds = Math.max(0, Math.round((new Date(r.endedAt) - new Date(r.startedAt)) / 1000));
        out += html`<tr style="cursor:pointer;border-bottom:1px solid #e4e9ec;" onclick="openUsageSessionModal('${safe(jsAttr(r.sessionId))}')">
          <td style="padding:6px 8px;">${new Date(r.startedAt).toLocaleString('sv-SE')}</td>
          <td>${_formatDuration(totalSeconds)}</td>
          <td>${_formatDuration(r.activeSeconds)}</td>
          <td>${r.eventCount}</td>
          <td class="us-desktop-only" style="font-size:12px;color:#5b6b75;">${r.browser} · ${r.deviceType}</td>
        </tr>`;
      });
      out += '</table>';
      listEl.innerHTML = out;
    }

    async function openUsageSessionModal(sessionId) {
      const el = document.getElementById('usage-session-modal');
      el.style.display = 'flex'; el.classList.remove('hidden');
      const eventsEl = document.getElementById('usage-session-events');
      eventsEl.innerHTML = '<p style="color:#888;">Hämtar…</p>';
      try {
        const events = await api('getUsageSessionEvents', { sessionId });
        eventsEl.innerHTML = events.map(e => html`<div style="font-size:13px;padding:4px 0;border-bottom:1px solid #e4e9ec;">
          <span style="color:#8a97a0;">${new Date(e.createdAt).toLocaleTimeString('sv-SE')}</span>
          — <strong>${e.eventType}</strong>${e.eventDetail ? ': ' + e.eventDetail : ''}
        </div>`).join('');
      } catch (err) {
        eventsEl.innerHTML = html`<p class="status-err">${err.message}</p>`;
      }
    }
    function closeUsageSessionModal() {
      const el = document.getElementById('usage-session-modal');
      el.style.display = 'none'; el.classList.add('hidden');
    }

    // Filnedladdning kan inte gå via den generiska api()-wrappern (den förväntar sig JSON),
    // så samma fetch+blob-mönster som downloadUsersTemplate() i admin.js används här.
    async function downloadUsageExport() {
      const stored = currentUser || JSON.parse(localStorage.getItem('dops_user') || 'null');
      const qs = Object.entries(_usageStatsFilters())
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&');
      try {
        const res = await fetch(API_BASE + '/usage-events/export' + (qs ? '?' + qs : ''), {
          headers: stored?.token ? { 'Authorization': 'Bearer ' + stored.token } : {}
        });
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'anvandningsstatistik.csv';
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
      } catch (err) { await customAlert('Kunde inte exportera: ' + err.message); }
    }
