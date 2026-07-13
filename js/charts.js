// ── Delade diagram-hjälpfunktioner ──────────────────────────────────────────
// Används av js/statistics.js och js/overview.js (Chart.js-instanser).
// Klassiskt script (ej type="module") — se js/progress.js för motivering.

    // På mobil kan en legend med många formulärtyper ta nästan hela grafytan.
    // Döljer legenden som standard på mobil och lägger till en liten knapp för
    // att fälla ut/in den vid behov. containerEl = elementet direkt ovanför/
    // runt <canvas> (knappen läggs efter det).
    function addMobileLegendToggle(chart, containerEl) {
      if (window.innerWidth > 600 || !containerEl) return;
      containerEl.querySelectorAll('.mobile-legend-toggle-btn').forEach(b => b.remove());
      chart.options.plugins = chart.options.plugins || {};
      chart.options.plugins.legend = chart.options.plugins.legend || {};
      chart.options.plugins.legend.display = false;
      chart.update();
      const btn = document.createElement('button');
      btn.className = 'btn-secondary btn-small mobile-legend-toggle-btn';
      btn.style.cssText = 'margin-top:8px;width:100%;';
      btn.textContent = 'Visa etiketter';
      btn.onclick = () => {
        const showing = chart.options.plugins.legend.display === true;
        chart.options.plugins.legend.display = !showing;
        chart.update();
        btn.textContent = showing ? 'Visa etiketter' : 'Dölj etiketter';
      };
      containerEl.appendChild(btn);
    }

    function makeLegendClick(chart) {
      return function(e, legendItem) {
        const i = legendItem.datasetIndex;
        if (!chart._selDs) chart._selDs = new Set();
        const sel = chart._selDs;
        if (sel.size === 0) {
          sel.add(i);
          chart.data.datasets.forEach((_, j) => chart.setDatasetVisibility(j, j === i));
        } else if (sel.has(i)) {
          sel.delete(i);
          chart.setDatasetVisibility(i, false);
          if (sel.size === 0)
            chart.data.datasets.forEach((_, j) => chart.setDatasetVisibility(j, true));
        } else {
          sel.add(i);
          chart.setDatasetVisibility(i, true);
        }
        chart.update();
      };
    }
    // Pajdiagram: en enda dataset, segmenten styrs via data-index (inte datasetIndex).
    // Samma isolera-vid-klick-princip som stapel/linje-diagrammen ovan.
    function makePieLegendClick(chart) {
      return function(e, legendItem) {
        const i = legendItem.index;
        const n = chart.data.labels.length;
        const setVisible = (idx, visible) => { if (chart.getDataVisibility(idx) !== visible) chart.toggleDataVisibility(idx); };
        if (!chart._selIdx) chart._selIdx = new Set();
        const sel = chart._selIdx;
        if (sel.size === 0) {
          sel.add(i);
          for (let j = 0; j < n; j++) setVisible(j, j === i);
        } else if (sel.has(i)) {
          sel.delete(i);
          setVisible(i, false);
          if (sel.size === 0) for (let j = 0; j < n; j++) setVisible(j, true);
        } else {
          sel.add(i);
          setVisible(i, true);
        }
        chart.update();
      };
    }
    function attachLegendTouch(chart) {
      chart.canvas.addEventListener('touchend', function(ev) {
        const touch = ev.changedTouches[0];
        const rect  = chart.canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        const legendItems = chart.legend.legendItems;
        if (!legendItems) return;
        const hitboxes = chart.legend.legendHitBoxes;
        if (!hitboxes) return;
        for (let i = 0; i < hitboxes.length; i++) {
          const b = hitboxes[i];
          if (x >= b.left && x <= b.left + b.width && y >= b.top && y <= b.top + b.height) {
            makeLegendClick(chart)(null, legendItems[i]);
            return;
          }
        }
      }, { passive: true });
    }
    const CHART_COLORS = [
      '#00e5ff','#ff1266','#00ff9d','#ffd500','#b026ff',
      '#ff5e00','#2e4a5f','#8b3a9e','#1a8fa0','#e87db3'
    ];
    function makeTotalLine(barDatasets, n) {
      const totals = Array.from({length: n}, (_, i) =>
        barDatasets.reduce((s, d) => s + (Number(d.data[i]) || 0), 0)
      );
      return {
        type: 'line', label: 'Totalt', data: totals,
        borderColor: '#c4292a', backgroundColor: 'transparent',
        borderWidth: 2.5, pointRadius: 3, pointBackgroundColor: '#c4292a',
        tension: 0.2, fill: false, order: -1,
      };
    }
