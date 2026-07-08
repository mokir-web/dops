// ── Min översikt ─────────────────────────────────────────────────────────────
// Utbruten från index.html (Fas 2, modularisering). Klassiskt script (ej
// type="module") — se js/progress.js för motivering och beroendemodell.
//
// Beroenden som förutsätts finnas redan: CHART_COLORS, makeLegendClick,
// attachLegendTouch, makeTotalLine (js/charts.js, laddas före denna fil), samt
// api(), esc(), show(), swr(), currentUser, showPanel(), samt _pendingFormFilter
// (deklareras i huvudfilen, skrivs här av navigateToAssessments, läses av
// updateFormTypeFilters i huvudfilen — medvetet kvar där).
//
// OBS: setTrendPeriod() i huvudfilen ser ut att vara död kod (ingen HTML-knapp
// eller annat anrop refererar till den, eller till #period-7d/30d/... som den
// förutsätter) — lämnad orörd i huvudfilen, flaggad separat, inte flyttad hit.

    function goalColor(count, goal) {
      if (count >= goal) return '#00ff9d';
      if (count > 0)      return '#ffd500';
      return '#ff1266';
    }
    async function loadMyOverview() {
      await swr(
        'myOverview',
        () => api('getMyOverview', { email: currentUser.email, klinikId: currentUser.klinikId }),
        data => { if (data) renderOverview(data); },
        document.getElementById('overview-swr-status')
      );
    }
    function renderFormGroup(title, forms, subGoals, periodCounts, allTimeCounts, role, periodMonths) {
      if (!Object.keys(forms).length) return '';
      const nM = periodMonths || 0;
      const periodLabel = nM === -1 ? 'totalt' : nM === 0 ? 'senaste 6 mån' : (nM <= 1 ? 'senaste månaden' : 'senaste ' + nM + ' mån');
      const scaledGoal = (goal) => (nM === 0 || nM === -1) ? goal : Math.round(goal * nM / 6);
      let s = `<div class="section-header" data-overview-goalgroup="1" style="margin-top:24px;">${title}</div>`;
      s += '<div style="background:#eef1f3;border:1.5px solid #c7d1d7;border-radius:8px;padding:14px;margin-top:14px;max-width:600px;">';
      const dopsForms  = Object.entries(forms).filter(([ft]) => ft.startsWith('DOPS:') || ft.startsWith('DOPS '));
      const otherForms = Object.entries(forms).filter(([ft]) => !ft.startsWith('DOPS:') && !ft.startsWith('DOPS ') && ft !== 'Operationsspecifik DOPS');
      if (dopsForms.length) {
        s += '<div style="font-size:15px;font-weight:bold;color:#1c2b36;margin-bottom:4px;">DOPS</div>';
        dopsForms.sort((a,b) => a[0].localeCompare(b[0])).forEach(([ft, v]) => {
          const subName  = ft.replace('DOPS: ','').replace('DOPS:','');
          const countP   = periodCounts?.[ft] || 0;
          const countAll = allTimeCounts?.[ft] || v.count;
          const g        = scaledGoal(v.goal);
          const color    = g ? goalColor(countP, g) : '#5b6b75';
          s += `<div style="display:flex;align-items:center;gap:10px;padding:3px 0 3px 14px;cursor:pointer;" onclick="navigateToAssessments('${esc(ft)}','${role||'received'}')">`;
          s += `<div style="font-size:14px;color:#5b6b75;flex:1;">${esc(subName)}</div>`;
          s += `<div style="flex:2;max-width:160px;">${goalBar(countP, countAll, g, periodLabel)}</div>`;
          s += `<div style="font-size:16px;font-weight:bold;color:${color};min-width:28px;text-align:right;">${countP}</div>`;
          s += '</div>';
        });
        if (otherForms.length) s += '<div style="height:1px;background:#c7d1d7;margin:10px 0;"></div>';
      }
      otherForms.sort((a,b) => a[0].localeCompare(b[0])).forEach(([ft, v]) => {
        const countP   = periodCounts?.[ft] || 0;
        const countAll = allTimeCounts?.[ft] || v.count;
        const g        = scaledGoal(v.goal);
        const color    = g ? goalColor(countP, g) : '#5b6b75';
        s += `<div style="display:flex;align-items:center;gap:10px;padding:4px 0;cursor:pointer;" onclick="navigateToAssessments('${esc(ft)}','${role||'received'}')">`;
        s += `<div style="font-size:14px;font-weight:bold;color:#1c2b36;flex:1;">${esc(ft)}</div>`;
        s += `<div style="flex:2;max-width:160px;">${goalBar(countP, countAll, g, periodLabel)}</div>`;
        s += `<div style="font-size:16px;font-weight:bold;color:${color};min-width:28px;text-align:right;">${countP}</div>`;
        s += '</div>';
      });
      s += '</div>';
      return s;
    }
    function goalBar(countPeriod, countAll, goal, periodLabel) {
      if (!goal) return '';
      const lbl = periodLabel || 'senaste 6 mån';
      const pct   = Math.min(100, Math.round(countPeriod / goal * 100));
      const color = goalColor(countPeriod, goal);
      return `<div style="margin-top:4px;background:#c7d1d7;border-radius:4px;height:8px;max-width:200px;">
          <div style="background:${color};border-radius:4px;height:8px;width:${pct}%;transition:width 0.4s;"></div>
        </div>
        <div style="font-size:11px;color:#8a97a0;margin-top:2px;">${countPeriod} / ${goal} ${lbl} <span style="color:${color};">${countPeriod >= goal ? '✓' : ''}</span></div>`;
    }
    function renderOverview(data) {
      const el = document.getElementById('overview-content');
      const userRole = currentUser.userRole;
      let html = '';

      // Tidsramsknappar längst upp — styr både graf och formulärgrupper
      const months = Object.values(data.byMonth || {});
      if (months.length > 0) {
        html += '<div id="trend-filter-btns" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px;">';
        [['1 vecka',7],['1 månad',30],['3 månader',90],['6 månader',180],['1 år',365],['MAX',0]].forEach(([label, days], i) => {
          const active = i === 3 ? 'background:#2e4a5f;color:#eef1f3;' : 'background:#c7d1d7;color:#1c2b36;';
          html += `<button onclick="filterTrend(${days},this)" style="border:none;border-radius:4px;padding:4px 10px;font-size:13px;cursor:pointer;${active}">${label}</button>`;
        });
        html += '</div>';
      }

      // Totalt sparat-banner
      if (data.totalMinutesSaved > 0 && (userRole === 'Registrerare' || userRole === 'Blandbild')) {
        const h = Math.floor(data.totalMinutesSaved / 60), m = data.totalMinutesSaved % 60;
        const totStr = h > 0 ? `${h} tim ${m} min` : `${m} min`;
        html += `<div style="background:#2e4a5f;color:#eef1f3;border-radius:8px;padding:16px 20px;margin-bottom:8px;display:inline-block;min-width:220px;">
          <div style="font-size:12px;opacity:0.8;letter-spacing:1px;">TOTALT SPARAT MED MORADOPS</div>
          <div style="font-size:28px;font-weight:bold;margin-top:4px;">${totStr}</div>
        </div>`;
      }

      const showSent     = userRole === 'Registrerare' || userRole === 'Blandbild';
      const showReceived = userRole === 'Mottagare'    || userRole === 'Blandbild';

      // Målstapler använder 6-månadersvärden
      const rec6m  = data.received_6m || {};
      const sent6m = data.sent_6m     || {};

      // goalBar definierad på modul-nivå nedan

      // renderFormGroup definierad på modul-nivå

      // Trendgrafer — en per riktning (mottagna/registrerade); Blandbild får båda
      const chartSpecs = [];
      if (showReceived) chartSpecs.push({ key: 'received', label: 'Mottagna bed\u00f6mningar',    ftByMonth: data.byMonthRecFt  || {} });
      if (showSent)     chartSpecs.push({ key: 'sent',     label: 'Registrerade bed\u00f6mningar', ftByMonth: data.byMonthSentFt || {} });
      if (months.length > 0) {
        chartSpecs.forEach(spec => {
          html += `<div class="section-header">${spec.label}</div>`;
          html += '<div style="background:#eef1f3;border:1.5px solid #c7d1d7;border-radius:8px;padding:16px;margin-top:14px;">';
          html += '<div style="width:100%;aspect-ratio:4/3;"><canvas id="overview-chart-' + spec.key + '"></canvas></div>';
          html += '<p style="font-size:11px;color:#8a97a0;margin-top:6px;margin-bottom:0;">Klicka på en etikett för att isolera den, klicka igen för att visa alla.</p></div>';
        });
      }

      // Initial render med 6-månaders period (periodMonths=0 → label "senaste 6 mån")
      const isSentRegistrar = userRole === 'Registrerare';
      const sentForRender = (forms) => Object.fromEntries(Object.entries(forms).map(([ft, v]) => [ft, { ...v, goal: isSentRegistrar ? (v.sentGoal || 0) : 0 }]));
      if (showReceived) html += renderFormGroup('Mottagna bedömningar',     data.received, data.subGoals, rec6m,  rec6m,  'received', 0);
      if (showSent)     html += renderFormGroup('Registrerade bedömningar', sentForRender(data.sent), data.subGoals, sent6m, sent6m, 'sent', 0);

      el.innerHTML = html;
      // Spara data globalt för filterTrend
      // Bygg all-time count maps för renderFormGroup
      const recAllTime = {};  Object.entries(data.received).forEach(([ft,v]) => { recAllTime[ft] = v.count; });
      const sentAllTime = {}; Object.entries(data.sent).forEach(([ft,v])     => { sentAllTime[ft] = v.count; });
      window._overviewData = { data, showSent, showReceived, recAllTime, sentAllTime, rec6m, sent6m };

      // Rita staplad area-graf per formulärtyp (som i Klinikens statistik) — en per riktning
      window._overviewCharts = {};
      window._overviewChartDatas = {};
      window._overviewChartKeys = chartSpecs.map(s => s.key);
      if (months.length > 0) {
        chartSpecs.forEach(spec => {
          const ctx = document.getElementById('overview-chart-' + spec.key)?.getContext('2d');
          if (!ctx) return;
          const ftByMonth = spec.ftByMonth;
          const allMonthKeys = Object.keys(ftByMonth).sort();
          const allFtRaw = {};
          allMonthKeys.forEach(mk => {
            Object.keys(ftByMonth[mk]).forEach(k => { if (k !== 'label') allFtRaw[k] = (allFtRaw[k]||0) + (ftByMonth[mk][k]||0); });
          });
          const sortedFt = Object.keys(allFtRaw).sort((a,b) => allFtRaw[a]-allFtRaw[b]);
          const datasets = sortedFt.map((ft, i) => ({
            label: ft,
            data: allMonthKeys.map(mk => ftByMonth[mk]?.[ft] || 0),
            borderColor: CHART_COLORS[i % CHART_COLORS.length],
            backgroundColor: CHART_COLORS[i % CHART_COLORS.length] + 'cc',
            tension: 0.3, fill: true, pointRadius: 2,
          }));
          window._overviewChartDatas[spec.key] = { allMonthKeys, ftByMonth, allFtRaw };
          const ovBarDs = datasets.map(d => ({ ...d, fill: undefined, tension: undefined, pointRadius: undefined }));
          window._overviewCharts[spec.key] = new Chart(ctx, {
            type: 'bar',
            data: { labels: allMonthKeys.map(mk => ftByMonth[mk]?.label || mk), datasets: [...ovBarDs, makeTotalLine(ovBarDs, allMonthKeys.length)] },
            options: {
              responsive: true, maintainAspectRatio: false,
              plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 12 }, onClick: (e, li) => makeLegendClick(window._overviewCharts[spec.key])(e, li) } },
              scales: { y: { beginAtZero: true, stacked: true, ticks: { stepSize: 1 }, grid: { color: '#c7d1d7' } }, x: { stacked: true, grid: { color: '#c7d1d7' } } }
            }
          });
          attachLegendTouch(window._overviewCharts[spec.key]);
        });
      }
    }
    function filterTrend(days, btn) {
      document.querySelectorAll('#trend-filter-btns button').forEach(b => {
        b.style.background = b === btn ? '#2e4a5f' : '#c7d1d7';
        b.style.color = b === btn ? '#eef1f3' : '#1c2b36';
      });
      const keys = window._overviewChartKeys || [];
      const filteredKeysByDirection = {};
      keys.forEach(key => {
        const d = window._overviewChartDatas?.[key];
        if (!d || !d.allMonthKeys) return;
        const nMonths = days === 0 ? d.allMonthKeys.length : Math.max(1, Math.ceil(days / 30));
        const filteredKeys = days === 0 ? d.allMonthKeys.slice() : d.allMonthKeys.slice(-nMonths);
        filteredKeysByDirection[key] = filteredKeys;
        const ctx = document.getElementById('overview-chart-' + key)?.getContext('2d');
        if (!ctx) return;
        window._overviewCharts[key]?.destroy();
        const sortedFt = Object.keys(d.allFtRaw||{}).sort((a,b) => d.allFtRaw[a]-d.allFtRaw[b]);
        const datasets = sortedFt.map((ft, i) => ({
          label: ft,
          data: filteredKeys.map(mk => d.ftByMonth?.[mk]?.[ft] || 0),
          borderColor: CHART_COLORS[i % CHART_COLORS.length],
          backgroundColor: CHART_COLORS[i % CHART_COLORS.length] + 'cc',
          tension: 0.3, fill: true, pointRadius: 2,
        }));
        window._overviewCharts[key] = new Chart(ctx, {
          type: 'bar',
          data: { labels: filteredKeys.map(mk => d.ftByMonth?.[mk]?.label || mk), datasets: [...datasets.map(ds => ({ ...ds, fill: undefined, tension: undefined, pointRadius: undefined })), makeTotalLine(datasets, filteredKeys.length)] },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 12 }, onClick: (e, li) => makeLegendClick(window._overviewCharts[key])(e, li) } },
            scales: { y: { beginAtZero: true, stacked: true, ticks: { stepSize: 1 }, grid: { color: '#c7d1d7' } }, x: { stacked: true, grid: { color: '#c7d1d7' } } }
          }
        });
        attachLegendTouch(window._overviewCharts[key]);
      });
      // Uppdatera formulärgrupper per valt tidsintervall
      _reRenderFormGroups(days === 0 ? -1 : Math.max(1, Math.ceil(days / 30)), filteredKeysByDirection);
    }
    function _reRenderFormGroups(nMonths, filteredKeysByDirection) {
      const od = window._overviewData;
      if (!od) return;
      const { data, showSent, showReceived, recAllTime, sentAllTime } = od;
      // Summera per-period counts från byMonthSentFt / byMonthRecFt — mottagna och
      // registrerade måste summeras med VARSIN periodfönster (de kan ha olika
      // aktiva månader), annars blandas de ihop och siffrorna blir missvisande.
      const recP = {}, sentP = {};
      (filteredKeysByDirection.sent || []).forEach(mk => {
        const sf = data.byMonthSentFt?.[mk] || {};
        Object.entries(sf).forEach(([ft, n]) => { if (ft !== 'label') sentP[ft] = (sentP[ft] || 0) + n; });
      });
      (filteredKeysByDirection.received || []).forEach(mk => {
        const rf = data.byMonthRecFt?.[mk] || {};
        Object.entries(rf).forEach(([ft, n]) => { if (ft !== 'label') recP[ft]  = (recP[ft]  || 0) + n; });
      });
      // Hitta container och ersätt formulärgrupperna
      const el = document.getElementById('overview-content');
      if (!el) return;
      // Ta bort gamla section-headers och deras kort
      el.querySelectorAll('.section-header[data-overview-goalgroup]').forEach(sh => {
        const txt = sh.textContent.trim();
        if (txt === 'Mottagna bedömningar' || txt === 'Registrerade bedömningar') {
          // Ta bort header + nästa syskon (kortet)
          const next = sh.nextElementSibling;
          if (next) next.remove();
          sh.remove();
        }
      });
      // Lägg till uppdaterade grupper
      const frag = document.createElement('div');
      const isSentReg = currentUser?.userRole === 'Registrerare';
      const sentFR = (forms) => Object.fromEntries(Object.entries(forms).map(([ft, v]) => [ft, { ...v, goal: isSentReg ? (v.sentGoal || 0) : 0 }]));
      const effRecP = nMonths === 0 ? (od.rec6m || recP) : recP;
      const effSentP = nMonths === 0 ? (od.sent6m || sentP) : sentP;
      // Vid en vald period (inte grundvyn) visas formulär med antal >0 den perioden,
      // eller formulär som har ett aktivt målvärde (oavsett uppfyllt eller ej).
      const received = nMonths === -1 || nMonths > 0
        ? Object.fromEntries(Object.entries(data.received).filter(([ft, v]) => (effRecP[ft] || 0) > 0 || v.goal))
        : data.received;
      const sentFRData = sentFR(data.sent);
      const sent = nMonths === -1 || nMonths > 0
        ? Object.fromEntries(Object.entries(sentFRData).filter(([ft, v]) => (effSentP[ft] || 0) > 0 || v.goal))
        : sentFRData;
      if (showReceived) frag.innerHTML += renderFormGroup('Mottagna bedömningar',     received, data.subGoals, effRecP,  recAllTime, 'received', nMonths);
      if (showSent)     frag.innerHTML += renderFormGroup('Registrerade bedömningar', sent,     data.subGoals, effSentP, sentAllTime, 'sent',     nMonths);
      el.appendChild(frag);
    }
    function navigateToAssessments(formType, role) {
      _pendingFormFilter = formType;
      currentAssessmentRole = role || 'received';
      showPanel('my-assessments');
    }
