// ── Min progress / Progress (Studierektor) ─────────────────────────────────
// Utbruten från den stora index.html-filen som ett första steg i modulariseringen
// (Fas 2). Klassiskt <script>-taggat (INTE type="module") med avsikt: browsern delar
// samma globala scope mellan alla klassiska scripts på sidan, så funktioner och
// let/const-variabler här är fortfarande synliga för resten av appen (t.ex. showPanel()
// i huvudfilen anropar initProgress() och läser _progressCharts direkt), och alla
// onchange="..."-attribut i HTML:en fungerar oförändrat.
//
// Beroenden som förutsätts finnas redan (definieras i huvudfilens <script>, laddas
// före denna fil): activePrivilege, activeKlinikId, currentUser, show(), api(),
// bgGet(), bgSet(), esc(), CHART_COLORS, samt Chart (Chart.js, laddas via CDN).

    let _progressCharts = [];

    function clearProgressAiResult() {
      const resultEl = document.getElementById('progress-ai-result');
      if (resultEl) { resultEl.classList.add('hidden'); resultEl.textContent = ''; }
    }

    async function initProgress() {
      clearProgressAiResult();
      const isStudierektor = activePrivilege === 'Studierektor';
      const titleEl = document.getElementById('progress-title');
      if (titleEl) titleEl.textContent = isStudierektor ? 'Progress' : 'Min progress';
      show('progress-recipient-row', isStudierektor);

      const statusEl  = document.getElementById('progress-swr-status');
      const SPIN = '<span style="font-size:12px;color:#8a97a0;display:flex;align-items:center;gap:5px;"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation:spin 1.2s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>H\u00e4mtar inneh\u00e5ll\u2026</span>';

      // Fyll läkarväljare för studierektor (en gång)
      if (isStudierektor) {
        const recSel = document.getElementById('progress-recipient');
        if (recSel && recSel.options.length === 0) {
          recSel.innerHTML = '<option value="">-- Välj läkare --</option>';
          if (statusEl) statusEl.innerHTML = SPIN;
          try {
            const users = await api('getProgressUsers', { klinikId: activeKlinikId || currentUser.klinikId });
            users.forEach(u => recSel.appendChild(new Option(u.name, u.email)));
          } catch(e) { console.warn('getProgressUsers:', e); }
          if (statusEl) statusEl.innerHTML = '';
          recSel.disabled = recSel.options.length <= 1;
        }
      }

      // Fyll formulärtypsväljare — bara formulär användaren faktiskt fått bedömningar på
      const ftSel = document.getElementById('progress-formtype');
      if (ftSel && ftSel.options.length === 0) {
        ftSel.innerHTML = '<option value="">-- Välj formulärtyp --</option>';
        if (!isStudierektor) {
          const cachedFts = bgGet('progressFormTypes_' + currentUser.email);
          if (cachedFts) {
            cachedFts.forEach(ft => ftSel.appendChild(new Option(ft, ft)));
          } else {
            if (statusEl) statusEl.innerHTML = SPIN;
            try {
              const fts = await api('getProgressFormTypes', { recipientEmail: currentUser.email });
              bgSet('progressFormTypes_' + currentUser.email, fts);
              fts.forEach(ft => ftSel.appendChild(new Option(ft, ft)));
            } catch(e) { console.warn('getProgressFormTypes:', e); }
            if (statusEl) statusEl.innerHTML = '';
          }
        }
        ftSel.disabled = ftSel.options.length <= 1;
      }
      loadProgressData();
    }

    async function onProgressRecipientChange() {
      clearProgressAiResult();
      const ftSel = document.getElementById('progress-formtype');
      ftSel.innerHTML = '<option value="">-- Välj formulärtyp --</option>';
      ftSel.disabled = true;
      document.getElementById('progress-content').innerHTML = '';
      const email = document.getElementById('progress-recipient')?.value;
      if (email) {
        try {
          const fts = await api('getProgressFormTypes', { recipientEmail: email });
          fts.forEach(ft => ftSel.appendChild(new Option(ft, ft)));
        } catch(e) { console.warn('getProgressFormTypes:', e); }
        ftSel.disabled = ftSel.options.length <= 1;
      }
    }

    async function loadProgressData() {
      clearProgressAiResult();
      const isStudierektor = activePrivilege === 'Studierektor';
      const recipientEmail = isStudierektor
        ? (document.getElementById('progress-recipient')?.value || '')
        : currentUser.email;
      const formType = document.getElementById('progress-formtype')?.value || '';
      const dateFrom = document.getElementById('progress-from')?.value  || null;
      const dateTo   = document.getElementById('progress-to')?.value    || null;

      const el       = document.getElementById('progress-content');
      const statusEl = document.getElementById('progress-swr-status');

      if (!formType || (isStudierektor && !recipientEmail)) {
        if (el) {
          const showGuide = !formType && (!isStudierektor || !!recipientEmail);
          el.innerHTML = showGuide ? '<p style="color:#8a97a0;margin-top:8px;">V\u00e4lj formulärtyp ovan f\u00f6r att visa din progress.</p>' : '';
        }
        if (statusEl) statusEl.innerHTML = '';
        return;
      }

      _progressCharts.forEach(c => { try { c.destroy(); } catch(_){} });
      _progressCharts = [];

      const cacheKey = 'progressData_' + recipientEmail + '_' + formType + '_' + (dateFrom || 'x') + '_' + (dateTo || 'x');
      const cachedData = bgGet(cacheKey);
      const SPIN = '<span style="font-size:12px;color:#8a97a0;display:flex;align-items:center;gap:5px;"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation:spin 1.2s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>H\u00e4mtar inneh\u00e5ll\u2026</span>';

      if (cachedData) {
        renderProgress(cachedData);
        if (statusEl) statusEl.innerHTML = SPIN; // revalidera alltid i bakgrunden
      } else {
        if (statusEl) statusEl.innerHTML = SPIN;
        el.innerHTML = '';
      }

      try {
        const data = await api('getProgressData', { recipientEmail, formType, dateFrom, dateTo });
        bgSet(cacheKey, data);
        if (statusEl) statusEl.innerHTML = '';
        if (cachedData && JSON.stringify(data) === JSON.stringify(cachedData)) return; // oförändrat
        _progressCharts.forEach(c => { try { c.destroy(); } catch(_){} });
        _progressCharts = [];
        renderProgress(data);
      } catch(e) {
        if (statusEl) statusEl.innerHTML = '';
        if (!cachedData) el.innerHTML = html`<p class="status-err">${e.message}</p>`;
      }
    }

    async function runProgressAiSummary() {
      const isStudierektor = activePrivilege === 'Studierektor';
      const recipientEmail = isStudierektor
        ? (document.getElementById('progress-recipient')?.value || '')
        : currentUser.email;
      const formType = document.getElementById('progress-formtype')?.value || '';
      const resultEl = document.getElementById('progress-ai-result');
      const btn = document.getElementById('progress-ai-btn');
      if (isStudierektor && !recipientEmail) {
        await customAlert('Välj läkare först.');
        return;
      }
      const origText = btn.textContent;
      btn.disabled = true; btn.textContent = 'Analyserar…';
      resultEl.classList.remove('hidden');
      resultEl.textContent = formType
        ? 'Hämtar och analyserar bedömningsdata…'
        : 'Hämtar och analyserar bedömningsdata från alla formulärtyper…';
      try {
        const res = await api('getProgressAiSummary', { recipientEmail, formType });
        resultEl.textContent = res.summary || res.error || 'Inget svar.';
        if (res.truncated) resultEl.textContent += '\n\n[Obs: svaret klipptes av — testa gärna igen, eller hör av dig om det upprepas.]';
      } catch (err) {
        resultEl.textContent = 'Kunde inte hämta AI-sammanställning: ' + err.message;
      } finally {
        btn.disabled = false; btn.textContent = origText;
      }
    }

    function renderProgress({ submissions, formDef }) {
      const el = document.getElementById('progress-content');
      if (!submissions || !submissions.length) {
        el.innerHTML = '<p style="color:#8a97a0;margin-top:8px;">Inga bed\u00f6mningar hittades f\u00f6r valt urval.</p>';
        return;
      }

      const sorted = [...submissions].sort((a, b) => new Date(a.ts) - new Date(b.ts));
      const pendingCharts = [];
      let out = '<div class="progress-charts-grid">';

      formDef.forEach((q, qi) => {
        if (q.typ === 'skala') {
          const points = sorted.map(s => {
            const a = s.answers.find(a => a.question === q.question);
            return a ? (parseFloat(a.answer) || null) : null;
          });
          const valid = points.filter(p => p !== null);
          if (!valid.length) return; // inget att visa
          const avg = valid.length
            ? (valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(1)
            : null;

          // Detektera skalans max genom att hitta det högsta talet i beskrivningen
          const allNums = [...q.beskrivning.matchAll(/(\d+):/g)].map(m => parseInt(m[1]));
          const minScale = allNums.length ? Math.min(...allNums) : 1;
          const maxScale = allNums.length ? Math.max(...allNums) : 5;

          // Plocka ut beskrivningar per nivå (ta bort mellannivåer utan text)
          const descParts = q.beskrivning
            .split(' | ')
            .map(p => p.trim())
            .filter(p => /^\d+:\s*.+/.test(p));

          const canvasId = `pgc_${qi}`;
          out += `<div style="background:#eef1f3;border:1.5px solid #c7d1d7;border-radius:8px;padding:16px;">
            <div style="display:flex;align-items:baseline;justify-content:space-between;flex-wrap:wrap;gap:4px;margin-bottom:10px;">
              <span style="font-weight:bold;font-size:14px;">${esc(q.question)}</span>
              <span style="font-size:12px;color:#8a97a0;">n=${valid.length}</span>
              ${avg !== null ? `<span style="font-size:13px;color:#2e4a5f;font-weight:bold;">\u00d8\u00a0${avg}</span>` : ''}
            </div>
            <div class="progress-chart-wrap" style="width:100%;"><canvas id="${canvasId}"></canvas></div>
            ${descParts.length ? `<div style="margin-top:10px;font-size:11px;color:#8a97a0;line-height:1.6;">${descParts.map(p => esc(p)).join('&nbsp;&nbsp;&bull;&nbsp;&nbsp;')}</div>` : ''}
          </div>`;

          pendingCharts.push({ canvasId, points, sorted, avg, minScale, maxScale, categorical: false, categories: null });

        } else if (q.typ === 'radio' && q.options && q.options.length) {
          // Textvärden (t.ex. Roll: Assistent/Blandbild/Operatör) — kategoriordning = ordningen
          // frågan är definierad med i formulärbyggaren, samma varje gång.
          const categories = q.options;
          const points = sorted.map(s => {
            const a = s.answers.find(a => a.question === q.question);
            if (!a || !a.answer) return null;
            const idx = categories.indexOf(a.answer.trim());
            return idx === -1 ? null : idx;
          });
          const valid = points.filter(p => p !== null);
          if (!valid.length) return; // inget att visa

          const canvasId = `pgc_${qi}`;
          out += `<div style="background:#eef1f3;border:1.5px solid #c7d1d7;border-radius:8px;padding:16px;">
            <div style="display:flex;align-items:baseline;justify-content:space-between;flex-wrap:wrap;gap:4px;margin-bottom:10px;">
              <span style="font-weight:bold;font-size:14px;">${esc(q.question)}</span>
              <span style="font-size:12px;color:#8a97a0;">n=${valid.length}</span>
            </div>
            <div class="progress-chart-wrap" style="width:100%;"><canvas id="${canvasId}"></canvas></div>
          </div>`;

          pendingCharts.push({ canvasId, points, sorted, avg: null, minScale: 0, maxScale: categories.length - 1, categorical: true, categories });
        }
        // fritext hanteras separat nedan (pool-metod)
      });
      out += '</div>'; // .progress-charts-grid

      // Fritextpool: samla ALLA icke-numeriska textsvar oavsett frågenamn
      // (fångar även svar från äldre formulärversioner med andra frågenamn)
      const _skalaRadioQs = new Set(
        formDef.filter(q => q.typ === 'skala' || q.typ === 'radio').map(q => q.question.trim().toLowerCase())
      );
      const _structuralNames = new Set(['roll','ingrepp','källa','datum','procedur']);
      const freeTextPool = {};
      sorted.forEach(s => {
        s.answers.forEach(a => {
          if (!a.answer || !a.answer.trim() || a.answer.trim().length < 3) return;
          const qLower = a.question.trim().toLowerCase();
          if (_skalaRadioQs.has(qLower)) return;          // hoppa skalafrågor
          if (_structuralNames.has(qLower)) return;        // hoppa strukturella
          if (/^\d+(\.\d+)?$/.test(a.answer.trim())) return; // hoppa rena siffror
          const key = a.question.trim();
          if (!freeTextPool[key]) freeTextPool[key] = [];
          freeTextPool[key].push({ ts: s.ts, text: a.answer.trim(), registrar: s.registrar });
        });
      });


      // Fritextsvar
      const ftKeys = Object.keys(freeTextPool).filter(k => freeTextPool[k].length);
      if (ftKeys.length) {
        out += `<div class="section-header" style="margin-top:4px;margin-bottom:14px;">Fritextsvar</div>`;
        ftKeys.forEach(question => {
          out += `<div style="font-weight:bold;font-size:14px;margin:12px 0 6px;">${esc(question)}</div>`;
          freeTextPool[question].forEach(a => {
            out += `<div style="background:#fff;border:1.5px solid #c7d1d7;border-radius:8px;padding:10px 14px;margin-bottom:8px;max-width:700px;">
              <div style="font-size:11px;color:#8a97a0;margin-bottom:4px;">${esc(a.ts)} \u2014 ${esc(a.registrar)}</div>
              <div style="font-size:14px;">${esc(a.text)}</div>
            </div>`;
          });
        });
      }

      el.innerHTML = out;

      requestAnimationFrame(() => {
        pendingCharts.forEach(({ canvasId, points, sorted, avg, minScale, maxScale, categorical, categories }) => {
          const ctx = document.getElementById(canvasId)?.getContext('2d');
          if (!ctx) return;

          const dataPoints = sorted
            .map((s, i) => ({ x: new Date(s.ts).getTime(), y: points[i] }))
            .filter(d => d.y !== null && !isNaN(d.x));

          if (!dataPoints.length) return;

          const avgVal = avg !== null ? parseFloat(avg) : null;
          const xMin = dataPoints[0].x;
          const xMax = dataPoints[dataPoints.length - 1].x;

          const datasets = [{
            label: categorical ? 'Svar' : 'Po\u00e4ng',
            data: dataPoints,
            borderColor: CHART_COLORS[0],
            backgroundColor: CHART_COLORS[0] + '33',
            fill: !categorical,
            stepped: categorical ? 'middle' : false,
            tension: categorical ? 0 : 0.3,
            borderWidth: 2,
            pointBackgroundColor: CHART_COLORS[0],
            pointRadius: 5,
            pointHoverRadius: 7,
            spanGaps: true
          }];

          if (avgVal !== null) {
            datasets.push({
              label: `Snitt ${avg}`,
              data: [{ x: xMin, y: avgVal }, { x: xMax, y: avgVal }],
              borderColor: CHART_COLORS[3],
              borderDash: [6, 4],
              borderWidth: 1.5,
              pointRadius: 0,
              fill: false,
              tension: 0
            });
          }

          const chart = new Chart(ctx, {
            type: 'line',
            data: { datasets },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              resizeDelay: 100,
              animation: false,
              scales: {
                x: {
                  type: 'linear',
                  ticks: {
                    maxTicksLimit: 7,
                    font: { size: 11 },
                    callback: v => {
                      const d = new Date(v);
                      return isNaN(d) ? '' : d.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' });
                    }
                  },
                  grid: { color: 'rgba(0,0,0,0.04)' }
                },
                y: {
                  min: minScale - 0.5,
                  max: maxScale + 0.5,
                  afterBuildTicks: scale => {
                    scale.ticks = [];
                    for (let i = minScale; i <= maxScale; i++) scale.ticks.push({ value: i });
                  },
                  ticks: { font: { size: 11 }, callback: v => categorical ? (categories[v] ?? '') : v },
                  grid: { color: 'rgba(0,0,0,0.13)', lineWidth: 1 }
                }
              },
              plugins: {
                legend: {
                  display: avgVal !== null,
                  labels: { font: { size: 11 }, boxWidth: 20, padding: 10 }
                },
                tooltip: {
                  callbacks: {
                    title: items => {
                      const d = new Date(items[0].parsed.x);
                      return isNaN(d) ? '' : d.toLocaleDateString('sv-SE', { year: 'numeric', month: 'short', day: 'numeric' });
                    },
                    label: item => categorical ? (categories[item.parsed.y] ?? '') : `Po\u00e4ng: ${item.parsed.y}`
                  }
                }
              }
            }
          });
          _progressCharts.push(chart);
        });
      });
    }
