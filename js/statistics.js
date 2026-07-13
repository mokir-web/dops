// ── Klinikens statistik ──────────────────────────────────────────────────────
// Utbruten från index.html (Fas 2, modularisering). Klassiskt script (ej
// type="module") — se js/progress.js för motivering och beroendemodell.
//
// Beroenden som förutsätts finnas redan: CHART_COLORS, makeLegendClick,
// makePieLegendClick (js/charts.js, laddas före denna fil), samt api(), esc(),
// currentUser, activeKlinikId, activePrivilege, escapeHtml (huvudfilen).

    let lineChart = null;
    let pieChart  = null;
    function resetStatFilters() {
      document.getElementById('stat-date-from').value = '';
      document.getElementById('stat-date-to').value   = '';
      document.getElementById('stat-formtype-filter').innerHTML = ''; // byggs om med aggregerade typer
      loadStatistics();
    }
    function aggregateFormTypes(byFormType) {
      // Returnera alla formulärtyper individuellt (ingen DOPS-aggregering)
      return Object.fromEntries(Object.entries(byFormType));
    }
    function aggregateByMonth(byFormTypeByMonth) {
      // Returnera per-månad utan aggregering
      const agg = {};
      Object.entries(byFormTypeByMonth).forEach(([month, data]) => {
        agg[month] = { ...data };
      });
      return agg;
    }
    async function loadStatistics() {
      const dateFrom     = document.getElementById('stat-date-from')?.value || null;
      const dateTo       = document.getElementById('stat-date-to')?.value || null;
      const checkedForms = [...document.querySelectorAll('#stat-formtype-filter input:checked')].map(cb => cb.value);
      const el           = document.getElementById('statistics-content');
      const statusEl     = document.getElementById('statistics-swr-status');
      const statKlinikId = document.getElementById('stat-klinik-select')?.value;
      // Klinikens statistik visar alltid användarens egen klinik om inte Admin med global access väljer annat
      const effectiveStatKlinik = (activePrivilege === 'Administratör')
        ? (statKlinikId || activeKlinikId || currentUser.klinikId || '*')
        : (currentUser.klinikId || '*');
      const noFilter = !dateFrom && !dateTo && !checkedForms.length;
      const cacheKey = 'statistics_' + effectiveStatKlinik;

      el.innerHTML = '';
      try {
        let stats;
        if (noFilter) {
          await swr(
            cacheKey,
            () => api('getStatistics', { filters: { dateFrom, dateTo }, klinikId: effectiveStatKlinik }),
            data => { if (data) { el.innerHTML = ''; renderStatistics(data, checkedForms); } },
            statusEl
          );
          return;
        }
        if (statusEl) statusEl.innerHTML = '<span style="font-size:12px;color:#8a97a0;display:flex;align-items:center;gap:5px;"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation:spin 1.2s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Hämtar innehåll…</span>';
        stats = await api('getStatistics', { filters: { dateFrom, dateTo }, klinikId: effectiveStatKlinik });
        renderStatistics(stats, checkedForms);
        if (statusEl) statusEl.innerHTML = '';
      } catch(err) {
        el.innerHTML = html`<p class="status-err">Fel: ${err.message}</p>`;
      }
    }

    function renderStatistics(stats, checkedForms = []) {
      const el = document.getElementById('statistics-content');
        // Uppdatera formulärfilter-chips (aggregerade typer)
        const aggByFormType = aggregateFormTypes(stats.byFormType);
        const aggByMonth    = aggregateByMonth(stats.byFormTypeByMonth || {});
        const filterContainer = document.getElementById('stat-formtype-filter');
        filterContainer.innerHTML = ''; // bygg alltid om med aggregerade typer
        Object.keys(aggByFormType).sort().forEach(ft => {
            const lbl = document.createElement('label');
            lbl.className = 'filter-chip';
            const cb = document.createElement('input');
            cb.type = 'checkbox'; cb.value = ft;
            if (checkedForms.includes(ft)) cb.checked = true;
            lbl.appendChild(cb);
            lbl.appendChild(document.createTextNode(ft));
            filterContainer.appendChild(lbl);
          });

        // Filtrera data på valda formulär (aggregerade)
        const activeFormFilter = [...document.querySelectorAll('#stat-formtype-filter input:checked')].map(cb => cb.value);

        // ── Areadiagram: alla formulärtyper, ej aggregerade, minst nederst ──
        const months = Object.values(aggByMonth);
        const monthLabels = months.map(m => m.label);

        // Använd icke-aggregerad data för alla subtyper
        const rawByFormType = stats.byFormType || {};
        const rawByMonth    = stats.byFormTypeByMonth || {};
        const allFormTypes  = activeFormFilter.length > 0 ? activeFormFilter
          : Object.keys(rawByFormType).sort((a,b) => rawByFormType[a] - rawByFormType[b]); // minst → mest

        const areaDatasets = allFormTypes.map((ft, i) => ({
          label: ft,
          data: Object.values(rawByMonth).map(m => m[ft] || 0),
          borderColor: CHART_COLORS[i % CHART_COLORS.length],
          backgroundColor: CHART_COLORS[i % CHART_COLORS.length] + 'cc',
          tension: 0.3, fill: true, pointRadius: 2,
        }));

        if (lineChart) lineChart.destroy();
        const lineCtx = document.getElementById('chart-line').getContext('2d');
        const lineBarDs = areaDatasets.map(d => ({ ...d, fill: undefined, tension: undefined, pointRadius: undefined }));
        lineChart = new Chart(lineCtx, {
          type: 'bar',
          data: { labels: Object.values(rawByMonth).map(m => m.label), datasets: [...lineBarDs, makeTotalLine(lineBarDs, lineBarDs[0]?.data.length || 0)] },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 12 }, onClick: (e, li) => makeLegendClick(lineChart)(e, li) } },
            scales: {
              y: { beginAtZero: true, stacked: true, ticks: { stepSize: 1 }, grid: { color: '#c7d1d7' } },
              x: { stacked: true, grid: { color: '#c7d1d7' } }
            }
          }
        });
        attachLegendTouch(lineChart);

        // ── Pajdiagram (aggregerade) ─────────────────────────────
        const pieLabels = Object.keys(aggByFormType).filter(ft =>
          activeFormFilter.length === 0 || activeFormFilter.includes(ft)
        );
        const pieData = pieLabels.map(ft => aggByFormType[ft]);
        if (pieChart) pieChart.destroy();
        const pieCtx = document.getElementById('chart-pie').getContext('2d');
        pieChart = new Chart(pieCtx, {
          type: 'pie',
          data: { labels: pieLabels, datasets: [{ data: pieData, backgroundColor: CHART_COLORS.slice(0, pieLabels.length), borderColor: '#eef1f3', borderWidth: 2 }] },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 12 }, onClick: (e, li) => makePieLegendClick(pieChart)(e, li) } } }
        });

        // ── Tabeller ──────────────────────────────────────────────
        let html = '';
        html += '<div class="section-header">Totalt antal bedömningar</div>';
        html += '<p style="font-size:28px;font-weight:bold;color:#2e4a5f;margin:12px 0;">' + stats.total + '</p>';
        html += '<div class="section-header">Mest aktiva registrerare</div>';
        html += '<table style="width:100%;max-width:600px;border-collapse:collapse;margin-top:10px;">';
        Object.entries(stats.byRegistrar).sort((a,b)=>b[1]-a[1]).slice(0,10).forEach(([k,v]) => {
          html += '<tr><td style="padding:7px 0;border-bottom:1px solid #c7d1d7;">' + k + '</td><td style="padding:7px 0;border-bottom:1px solid #c7d1d7;text-align:right;font-weight:bold;">' + v + '</td></tr>';
        });
        html += '</table>';
        html += '<div class="section-header">Mest bedömda</div>';
        html += '<table style="width:100%;max-width:600px;border-collapse:collapse;margin-top:10px;">';
        Object.entries(stats.byRecipient).sort((a,b)=>b[1]-a[1]).slice(0,10).forEach(([k,v]) => {
          html += '<tr><td style="padding:7px 0;border-bottom:1px solid #c7d1d7;">' + k + '</td><td style="padding:7px 0;border-bottom:1px solid #c7d1d7;text-align:right;font-weight:bold;">' + v + '</td></tr>';
        });
        html += '</table>';
        el.innerHTML = html;
    }
