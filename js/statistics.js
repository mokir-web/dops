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

    // Räknar ut standarduppl\u00f6sningen f\u00f6r det valda datumspannet (eller hela historiken
    // om inget filter \u00e4r satt, d\u00e5 anv\u00e4nds m\u00e5nadsvis precis som MAX i Min \u00f6versikt).
    function setStatResolutionDefault(dateFrom, dateTo) {
      let resolution;
      if (dateFrom) {
        const spanDays = (new Date(dateTo || Date.now()) - new Date(dateFrom)) / 86400000;
        resolution = defaultResolutionForDays(Math.round(spanDays));
      } else {
        resolution = 'month';
      }
      const sel = document.getElementById('stat-resolution');
      if (sel) sel.value = resolution;
    }

    // Manuell \u00e4ndring av uppl\u00f6snings-dropdownen \u2014 bygger om graferna med redan h\u00e4mtad data.
    function onStatResolutionChange() {
      const checkedForms = [...document.querySelectorAll('#stat-formtype-filter input:checked')].map(cb => cb.value);
      if (window._statData) renderStatistics(window._statData, checkedForms);
    }

    // Hittar tidigaste/senaste faktiska dagspost i statistikdatan (för komplett
    // tidslinje när inget datumfilter är satt).
    function statDataDateRange(stats) {
      const dayKeys = Object.keys(stats.byDay || {}).sort();
      const today = new Date();
      if (!dayKeys.length) return { start: today, end: today };
      return { start: new Date(dayKeys[0] + 'T00:00:00'), end: today };
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
            data => { if (data) { el.innerHTML = ''; window._statData = data; setStatResolutionDefault(dateFrom, dateTo); renderStatistics(data, checkedForms); } },
            statusEl
          );
          return;
        }
        if (statusEl) statusEl.innerHTML = '<span style="font-size:12px;color:#8a97a0;display:flex;align-items:center;gap:5px;"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation:spin 1.2s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Hämtar innehåll…</span>';
        stats = await api('getStatistics', { filters: { dateFrom, dateTo }, klinikId: effectiveStatKlinik });
        window._statData = stats;
        setStatResolutionDefault(dateFrom, dateTo);
        renderStatistics(stats, checkedForms);
        if (statusEl) statusEl.innerHTML = '';
      } catch(err) {
        el.innerHTML = html`<p class="status-err">Fel: ${err.message}</p>`;
      }
    }

    function renderStatistics(stats, checkedForms = []) {
      const el = document.getElementById('statistics-content');
        const resolution = document.getElementById('stat-resolution')?.value || 'month';
        const byFormTypeByRes = resolution === 'day' ? (stats.byFormTypeByDay || {})
          : resolution === 'week' ? (stats.byFormTypeByWeek || {}) : (stats.byFormTypeByMonth || {});

        // Datumspann: valt filter om satt, annars tidigaste faktiska dagspost till idag.
        const dateFromVal = document.getElementById('stat-date-from')?.value;
        const dateToVal   = document.getElementById('stat-date-to')?.value;
        let rangeStart, rangeEnd;
        if (dateFromVal) {
          rangeStart = new Date(dateFromVal + 'T00:00:00');
          rangeEnd   = dateToVal ? new Date(dateToVal + 'T00:00:00') : new Date();
        } else {
          const r = statDataDateRange(stats);
          rangeStart = r.start; rangeEnd = r.end;
        }
        const timelineKeys = generateTimelineKeys(resolution, rangeStart, rangeEnd).map(o => o.key);

        // Uppdatera formulärfilter-chips (aggregerade typer)
        const aggByFormType = aggregateFormTypes(stats.byFormType);
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

        // ── Areadiagram: alla formulärtyper, ej aggregerade, minst nederst, komplett tidslinje ──
        const rawByFormType = stats.byFormType || {};
        const allFormTypes  = activeFormFilter.length > 0 ? activeFormFilter
          : Object.keys(rawByFormType).sort((a,b) => rawByFormType[a] - rawByFormType[b]); // minst → mest

        const areaDatasets = allFormTypes.map((ft, i) => ({
          label: ft,
          data: timelineKeys.map(k => byFormTypeByRes[k]?.[ft] || 0),
          borderColor: CHART_COLORS[i % CHART_COLORS.length],
          backgroundColor: CHART_COLORS[i % CHART_COLORS.length] + 'cc',
          tension: 0.3, fill: true, pointRadius: 2,
        }));

        if (lineChart) lineChart.destroy();
        const lineCtx = document.getElementById('chart-line').getContext('2d');
        const lineBarDs = areaDatasets.map(d => ({ ...d, fill: undefined, tension: undefined, pointRadius: undefined }));
        lineChart = new Chart(lineCtx, {
          type: 'bar',
          data: { labels: timelineKeys.map(k => byFormTypeByRes[k]?.label || k), datasets: [...lineBarDs, makeTotalLine(lineBarDs, lineBarDs[0]?.data.length || 0)] },
          options: {
            responsive: true, maintainAspectRatio: false, resizeDelay: 100,
            plugins: { legend: { display: window.innerWidth > 600, position: 'bottom', labels: { font: { size: 11 }, boxWidth: 12 }, onClick: (e, li) => makeLegendClick(lineChart)(e, li) } },
            scales: {
              y: { beginAtZero: true, stacked: true, ticks: { stepSize: 1 }, grid: { color: '#c7d1d7' } },
              x: { stacked: true, grid: { color: '#c7d1d7' } }
            }
          }
        });
        attachLegendTouch(lineChart);
        addMobileLegendToggle(lineChart, document.getElementById('chart-line-card'));

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
          options: { responsive: true, maintainAspectRatio: false, resizeDelay: 100, plugins: { legend: { display: window.innerWidth > 600, position: 'bottom', labels: { font: { size: 11 }, boxWidth: 12 }, onClick: (e, li) => makePieLegendClick(pieChart)(e, li) } } }
        });
        addMobileLegendToggle(pieChart, document.getElementById('chart-pie-card'));

        // ── Tabeller ──────────────────────────────────────────────
        let out = '';
        out += '<div class="section-header">Totalt antal bedömningar</div>';
        out += html`<p style="font-size:28px;font-weight:bold;color:#2e4a5f;margin:12px 0;">${stats.total}</p>`;
        out += '<div class="section-header">Mest aktiva registrerare</div>';
        out += '<table style="width:100%;max-width:600px;border-collapse:collapse;margin-top:10px;">';
        Object.entries(stats.byRegistrar).sort((a,b)=>b[1]-a[1]).slice(0,10).forEach(([k,v]) => {
          out += html`<tr><td style="padding:7px 0;border-bottom:1px solid #c7d1d7;">${k}</td><td style="padding:7px 0;border-bottom:1px solid #c7d1d7;text-align:right;font-weight:bold;">${v}</td></tr>`;
        });
        out += '</table>';
        out += '<div class="section-header">Mest bedömda</div>';
        out += '<table style="width:100%;max-width:600px;border-collapse:collapse;margin-top:10px;">';
        Object.entries(stats.byRecipient).sort((a,b)=>b[1]-a[1]).slice(0,10).forEach(([k,v]) => {
          out += html`<tr><td style="padding:7px 0;border-bottom:1px solid #c7d1d7;">${k}</td><td style="padding:7px 0;border-bottom:1px solid #c7d1d7;text-align:right;font-weight:bold;">${v}</td></tr>`;
        });
        out += '</table>';
        el.innerHTML = out;
    }
