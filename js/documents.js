// ── Dokument ──────────────────────────────────────────────────────────────────
// Utbruten från index.html (Fas 2, modularisering). Klassiskt script (ej
// type="module") — se js/progress.js för motivering och beroendemodell.
// Beroenden (huvudfilen): api().

    async function loadDocuments() {
      const el = document.getElementById('documents-list');
      el.innerHTML = '';
      try {
        const docs = await api('getDocuments');
        if (!docs.length) { el.innerHTML = '<p style="color:#888;">Inga dokument tillgängliga ännu.</p>'; return; }
        el.innerHTML = docs.map(d => `
          <div class="assessment-card" style="margin-top:12px;">
            <div style="font-weight:bold;font-size:17px;">${d.title}</div>
            ${d.description ? '<div style="font-size:15px;color:#5b6b75;margin-top:4px;">' + d.description + '</div>' : ''}
            <div style="font-size:13px;color:#8a97a0;margin-top:4px;">Version ${d.version || '–'} · ${d.date || ''}</div>
            ${d.url ? '<div class="btn-row" style="margin-top:10px;"><a href="' + d.url + '" target="_blank" class="btn-secondary btn-small" style="text-decoration:none;display:inline-block;padding:7px 14px;">Ladda ned</a></div>' : ''}
          </div>`).join('');
      } catch(err) { el.innerHTML = '<p class="status-err">' + err.message + '</p>'; }
    }
