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
      window._statKlinikId = effectiveStatKlinik; // för uppföljningen per person nedan
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
          data: { labels: timelineKeys.map(k => periodTickLabel(k, resolution, byFormTypeByRes[k]?.label || formatPeriodLabel(k, resolution))), datasets: [...lineBarDs, makeTotalLine(lineBarDs, lineBarDs[0]?.data.length || 0)] },
          options: {
            responsive: true, maintainAspectRatio: false, resizeDelay: 100,
            plugins: {
              legend: { display: window.innerWidth > 600, position: 'bottom', labels: { font: { size: 11 }, boxWidth: 12 }, onClick: (e, li) => makeLegendClick(lineChart)(e, li) },
              tooltip: { callbacks: { title: items => items.length ? periodTooltipTitle(timelineKeys[items[0].dataIndex], resolution, byFormTypeByRes[timelineKeys[items[0].dataIndex]]?.label || formatPeriodLabel(timelineKeys[items[0].dataIndex], resolution)) : '' } }
            },
            scales: {
              y: { beginAtZero: true, stacked: true, ticks: { stepSize: 1 }, grid: { color: '#c7d1d7' } },
              x: periodXScale(resolution)
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
        out += _renderTimeAndFeedback(stats);
        out += '<div id="stat-trainees"></div>';
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
        loadStatTrainees();
    }

    // ── Tidsåtgång, sparad tid och fritextåterkoppling per formulär (v4.52.0) ──────────
    const _statTd = 'padding:7px 8px 7px 0;border-bottom:1px solid #c7d1d7;';
    function _fmtDuration(sec) {
      if (!sec) return '–';
      const m = Math.floor(sec / 60), s2 = Math.round(sec % 60);
      return m ? `${m} min ${s2} s` : `${s2} s`;
    }
    function _fmtMinutes(min) {
      if (!min) return '–';
      const h = Math.floor(min / 60), m = min % 60;
      return h ? `${h} tim${m ? ' ' + m + ' min' : ''}` : `${m} min`;
    }
    function _renderTimeAndFeedback(stats) {
      let out = '';
      const time = Object.entries(stats.timeByFormType || {}).sort((a, b) => b[1].count - a[1].count);
      if (time.length) {
        const totSaved = time.reduce((s, [, v]) => s + v.savedMinutes, 0);
        const timed = time.reduce((s, [, v]) => s + v.timedCount, 0);
        const totElapsed = time.reduce((s, [, v]) => s + v.elapsedSeconds, 0);
        out += '<div class="section-header">Tidsåtgång och sparad tid</div>';
        out += html`<p style="font-size:14px;color:#5b6b75;margin:8px 0 0;">Sparad tid jämfört med pappersblankett: <strong style="color:#2f7d47;font-size:18px;">${_fmtMinutes(totSaved)}</strong>${timed ? safe(html` · snittid per bedömning <strong>${_fmtDuration(totElapsed / timed)}</strong>`) : ''}</p>`;
        out += '<table style="width:100%;max-width:600px;border-collapse:collapse;margin-top:10px;font-variant-numeric:tabular-nums;">';
        out += html`<tr style="font-size:12px;color:#5b6b75;text-align:left;"><th style="${safe(_statTd)}">Formulär</th><th style="${safe(_statTd)}text-align:right;">Antal</th><th style="${safe(_statTd)}text-align:right;">Snittid</th><th style="${safe(_statTd)}text-align:right;">Sparad tid</th></tr>`;
        time.forEach(([ft, v]) => {
          out += html`<tr><td style="${safe(_statTd)}">${ft}</td><td style="${safe(_statTd)}text-align:right;">${v.count}</td><td style="${safe(_statTd)}text-align:right;">${v.timedCount ? _fmtDuration(v.elapsedSeconds / v.timedCount) : '–'}</td><td style="${safe(_statTd)}text-align:right;font-weight:bold;">${_fmtMinutes(v.savedMinutes)}</td></tr>`;
        });
        out += '</table>';
        out += '<p style="font-size:12px;color:#8a97a0;margin:6px 0 0;">Sparad tid = antal × formulärets referenstid (samma som i Min översikt). Snittiden räknar bara mätningar mellan 10 s och 60 min.</p>';
      }
      const fb = Object.entries(stats.feedbackByFormType || {}).sort((a, b) => b[1].assessments - a[1].assessments);
      if (fb.length) {
        out += '<div class="section-header">Återkoppling i fritext</div>';
        out += '<table style="width:100%;max-width:600px;border-collapse:collapse;margin-top:10px;font-variant-numeric:tabular-nums;">';
        out += html`<tr style="font-size:12px;color:#5b6b75;text-align:left;"><th style="${safe(_statTd)}">Formulär</th><th style="${safe(_statTd)}text-align:right;">Med fritext</th><th style="${safe(_statTd)}text-align:right;">Snittlängd</th></tr>`;
        fb.forEach(([ft, v]) => {
          const pct = v.assessments ? Math.round(v.withText / v.assessments * 100) : 0;
          const color = pct >= 80 ? '#2f7d47' : pct >= 50 ? '#9a6b12' : '#9e2a18';
          out += html`<tr><td style="${safe(_statTd)}">${ft}</td><td style="${safe(_statTd)}text-align:right;"><strong style="color:${safe(color)};">${pct} %</strong> <span style="color:#8a97a0;font-size:12px;">(${v.withText} av ${v.assessments})</span></td><td style="${safe(_statTd)}text-align:right;">${v.withText ? v.avgChars + ' tecken' : '–'}</td></tr>`;
        });
        out += '</table>';
        out += '<p style="font-size:12px;color:#8a97a0;margin:6px 0 0;">Andel bedömningar där minst ett fritextfält fyllts i, och genomsnittlig fritextlängd i de bedömningarna.</p>';
      }
      return out;
    }

    // ── Uppföljning per person (Studierektor/Administratör, v4.52.0) ───────────────────
    let _statTrainees = null;
    async function loadStatTrainees() {
      const el = document.getElementById('stat-trainees');
      if (!el) return;
      if (!['Studierektor', 'Administratör'].includes(activePrivilege)) { el.innerHTML = ''; return; }
      const klinikId = window._statKlinikId;
      if (!klinikId || klinikId === '*') {
        el.innerHTML = '<div class="section-header">Uppföljning per person</div><p style="color:#8a97a0;font-size:14px;">Välj en klinik för att se uppföljning per person.</p>';
        return;
      }
      el.innerHTML = '<div class="section-header">Uppföljning per person</div><p style="color:#8a97a0;font-size:13px;">Hämtar…</p>';
      try {
        _statTrainees = await api('getStatisticsTrainees', {
          klinikId,
          dateFrom: document.getElementById('stat-date-from')?.value || null,
          dateTo: document.getElementById('stat-date-to')?.value || null
        });
        renderStatTrainees();
      } catch (err) {
        el.innerHTML = html`<div class="section-header">Uppföljning per person</div><p class="status-err">${err.message}</p>`;
      }
    }

    function renderStatTrainees() {
      const el = document.getElementById('stat-trainees');
      const d = _statTrainees;
      if (!el || !d) return;
      const who = p => html`${p.name} <span style="color:#8a97a0;font-size:12px;">(${formatJobRole(p.jobRole)})</span>`;
      let out = '';

      // 1. Måluppfyllelse
      out += '<div class="section-header">Måluppfyllelse — senaste 6 månaderna</div>';
      if (!d.targets.length) {
        out += '<p style="color:#8a97a0;font-size:14px;">Inga målvärden satta för kliniken (Klinikinställningar).</p>';
      } else {
        out += '<p style="font-size:12px;color:#8a97a0;margin:6px 0 0;">Mottagna bedömningar mot klinikens målvärden per yrkesroll. Lägst måluppfyllelse först. Formulär personen markerat "Ej aktuellt" räknas inte.</p>';
        out += '<div style="max-width:720px;margin-top:10px;display:grid;gap:8px;">';
        d.targets.forEach(t => {
          const color = t.pct >= 100 ? '#4a9e62' : t.pct >= 50 ? '#c8a96e' : '#9e2a18';
          const forms = t.forms.map(f => html`<span style="white-space:nowrap;color:${safe(f.count >= f.goal ? '#2f7d47' : '#5b6b75')};">${f.formType} ${f.count}/${f.goal}</span>`).join(' · ');
          out += html`<div style="background:#fff;border:1.5px solid #c7d1d7;border-radius:8px;padding:10px 12px;">
            <div style="display:flex;justify-content:space-between;gap:10px;align-items:baseline;flex-wrap:wrap;">
              <div style="font-weight:bold;">${safe(who(t))}</div>
              <div style="font-size:13px;color:#5b6b75;">${t.met} av ${t.total} mål uppnådda · <strong style="color:${safe(color)};">${t.pct} %</strong></div>
            </div>
            <div style="height:6px;background:#e3e8eb;border-radius:3px;margin:7px 0 6px;overflow:hidden;"><div style="height:100%;width:${Math.min(100, t.pct)}%;background:${safe(color)};"></div></div>
            <div style="font-size:12px;line-height:1.7;">${safe(forms)}</div>
          </div>`;
        });
        out += '</div>';
      }

      // 2. Utan bedömning på länge
      const weeks = parseInt(document.getElementById('stat-idle-weeks')?.value || '8');
      // Specialister döljs som standard — listan gäller i första hand ST/AT/BT.
      const inclSpec = !!document.getElementById('stat-idle-spec')?.checked;
      const idle = d.lastReceived.filter(p => (inclSpec || p.jobRole !== 'Spec') && (p.daysSince === null || p.daysSince >= weeks * 7));
      out += '<div class="section-header">Utan mottagen bedömning</div>';
      out += html`<label style="font-size:13px;color:#5b6b75;display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin-top:8px;">Ingen bedömning på minst
        <select id="stat-idle-weeks" onchange="renderStatTrainees()" style="width:auto;font-size:13px;padding:3px 6px;border:1px solid #c7d1d7;border-radius:4px;background:#eef1f3;">
          ${safe([4, 8, 12, 26].map(w => `<option value="${w}"${w === weeks ? ' selected' : ''}>${w} veckor</option>`).join(''))}
        </select>
        <span style="margin-left:12px;display:inline-flex;align-items:center;gap:5px;"><input type="checkbox" id="stat-idle-spec" onchange="renderStatTrainees()" ${safe(inclSpec ? 'checked' : '')}> Visa även specialister</span></label>`;
      if (!idle.length) out += '<p style="color:#2f7d47;font-size:14px;">Alla har fått minst en bedömning under perioden.</p>';
      else {
        out += '<table style="width:100%;max-width:600px;border-collapse:collapse;margin-top:10px;">';
        idle.forEach(p => {
          out += html`<tr><td style="${safe(_statTd)}">${safe(who(p))}</td><td style="${safe(_statTd)}text-align:right;color:#5b6b75;">${p.lastAt ? `senast ${p.lastAt} (${p.daysSince} dagar sedan)` : 'aldrig'}</td></tr>`;
        });
        out += '</table>';
        out += '<p style="font-size:12px;color:#8a97a0;margin:6px 0 0;">Tips: skicka en riktad förfrågan eller en uppmaning från Förfrågningsöversikten.</p>';
      }

      // 3. Spridning av bedömare
      out += '<div class="section-header">Spridning av bedömare</div>';
      if (!d.spread.length) out += '<p style="color:#8a97a0;font-size:14px;">Inga bedömningar i valt intervall.</p>';
      else {
        out += '<p style="font-size:12px;color:#8a97a0;margin:6px 0 0;">Antal olika bedömare per mottagare i valt intervall — färst först. Återkoppling från flera personer ger en säkrare bild.</p>';
        out += '<table style="width:100%;max-width:600px;border-collapse:collapse;margin-top:10px;font-variant-numeric:tabular-nums;">';
        out += html`<tr style="font-size:12px;color:#5b6b75;text-align:left;"><th style="${safe(_statTd)}">Mottagare</th><th style="${safe(_statTd)}text-align:right;">Bedömningar</th><th style="${safe(_statTd)}text-align:right;">Olika bedömare</th></tr>`;
        d.spread.forEach(p => {
          out += html`<tr><td style="${safe(_statTd)}">${safe(who(p))}</td><td style="${safe(_statTd)}text-align:right;">${p.assessments}</td><td style="${safe(_statTd)}text-align:right;font-weight:bold;color:${safe(p.assessors <= 1 ? '#9e2a18' : '#1c2b36')};">${p.assessors}</td></tr>`;
        });
        out += '</table>';
      }
      el.innerHTML = out;
    }
