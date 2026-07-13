// ── Förfrågningsöversikt ─────────────────────────────────────────────────────
// Utbruten från index.html (Fas 2, modularisering). Klassiskt script (ej
// type="module") — se js/progress.js för motivering och beroendemodell.
//
// Beroenden som förutsätts finnas redan (huvudfilen): api(), esc(), currentUser,
// activeKlinikId.

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
        renderRequestStats(data);
      } catch(err) {
        el.innerHTML = html`<p class="status-err">Fel: ${err.message}</p>`;
      }
    }

    function renderRequestStats(data) {
      const el = document.getElementById('reqstat-content');
      const s = data.summary;
      let html = '';

      // Sammanfattning
      html += '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:20px;">';
      html += `<div style="background:#2e4a5f;color:#eef1f3;border-radius:8px;padding:14px 20px;min-width:120px;text-align:center;"><div style="font-size:11px;opacity:0.8;letter-spacing:1px;">TOTALT</div><div style="font-size:28px;font-weight:bold;">${s.total}</div></div>`;
      html += `<div style="background:#4a9e62;color:#eef1f3;border-radius:8px;padding:14px 20px;min-width:120px;text-align:center;"><div style="font-size:11px;opacity:0.8;letter-spacing:1px;">UTFÖRDA</div><div style="font-size:28px;font-weight:bold;">${s.done}</div></div>`;
      if (s.inaktuell) html += `<div style="background:#8a97a0;color:#eef1f3;border-radius:8px;padding:14px 20px;min-width:120px;text-align:center;"><div style="font-size:11px;opacity:0.8;letter-spacing:1px;">INAKTUELLA</div><div style="font-size:28px;font-weight:bold;">${s.inaktuell}</div></div>`;
      html += `<div style="background:#c8a96e;color:#eef1f3;border-radius:8px;padding:14px 20px;min-width:120px;text-align:center;"><div style="font-size:11px;opacity:0.8;letter-spacing:1px;">VÄNTANDE</div><div style="font-size:28px;font-weight:bold;">${s.pending}</div></div>`;
      html += '</div>';

      // Per formulärtyp
      if (Object.keys(s.byFormType).length) {
        html += '<div class="section-header" style="margin-bottom:10px;">Per formulärtyp</div>';
        html += '<div style="background:#eef1f3;border:1.5px solid #c7d1d7;border-radius:8px;padding:14px;margin-bottom:20px;max-width:500px;">';
        Object.entries(s.byFormType).sort((a,b) => b[1].total - a[1].total).forEach(([ft, v], i, arr) => {
          const pct = v.total > 0 ? Math.round(v.done / v.total * 100) : 0;
          const color = pct >= 100 ? '#4a9e62' : pct > 0 ? '#c8a96e' : '#9e2a18';
          if (i > 0) html += '<div style="height:1px;background:#c7d1d7;margin:8px 0;"></div>';
          html += `<div style="display:flex;align-items:center;gap:10px;">
            <span style="flex:1;font-size:14px;">${esc(ft)}</span>
            <span style="font-size:13px;color:#5b6b75;">${v.done}/${v.total}</span>
            <span style="font-size:13px;font-weight:bold;color:${color};">${pct}%</span>
          </div>`;
        });
        html += '</div>';
      }

      // Per yrkesroll
      if (Object.keys(s.byRole).length) {
        html += '<div class="section-header" style="margin-bottom:10px;">Per yrkesroll (mottagare)</div>';
        html += '<div style="background:#eef1f3;border:1.5px solid #c7d1d7;border-radius:8px;padding:14px;margin-bottom:20px;max-width:500px;">';
        Object.entries(s.byRole).sort((a,b) => a[0].localeCompare(b[0])).forEach(([role, v], i) => {
          if (i > 0) html += '<div style="height:1px;background:#c7d1d7;margin:8px 0;"></div>';
          html += `<div style="display:flex;align-items:center;gap:10px;">
            <span style="flex:1;font-size:14px;font-weight:bold;">${esc(role)}</span>
            <span style="font-size:13px;color:#5b6b75;">${v.done} av ${v.total} utförda</span>
          </div>`;
        });
        html += '</div>';
      }

      // Senaste förfrågningar
      if (data.requests.length) {
        html += '<div class="section-header" style="margin-bottom:10px;">Senaste förfrågningar</div>';
        html += '<div style="display:flex;flex-direction:column;gap:8px;">';
        data.requests.slice(0, 20).forEach(r => {
          const statusColor = r.status === 'Utförd' ? '#4a9e62' : r.status === 'Inaktuell' ? '#8a97a0' : '#c8a96e';
          const statusText  = r.status === 'Utförd' ? '✓ Utförd' : r.status === 'Inaktuell' ? '✕ Inaktuell' : '⏳ Väntande';
          html += `<div style="background:#eef1f3;border:1.5px solid #c7d1d7;border-radius:6px;padding:10px 14px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
            <div style="flex:1;min-width:180px;">
              <span style="font-weight:bold;">${esc(r.toName)}</span>
              <span style="font-size:13px;color:#5b6b75;"> (${esc(r.toRole)})</span>
              ${r.isSelf ? '<span style="font-size:12px;background:#e8f4ea;color:#2e4a5f;border-radius:4px;padding:1px 6px;margin-left:4px;">självskattning</span>' : ''}
              <div style="font-size:12px;color:#8a97a0;margin-top:2px;">${esc(r.formType || '')} · från ${esc(r.fromName)} · ${esc(r.timestamp)}</div>
            </div>
            <span style="font-size:13px;font-weight:bold;color:${statusColor};">${statusText}</span>
          </div>`;
        });
        html += '</div>';
      }

      el.innerHTML = html;
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
