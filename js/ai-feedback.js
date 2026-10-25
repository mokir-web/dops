// ── AI-feedback (global admin) ─────────────────────────────────────────────
// v4.59.3: AI-sammanställningar per omfattning, tumme upp/ner och kommentarer.
// Klassiskt script (ej type="module") — se js/progress.js för motivering och beroendemodell.
//
// Beroenden som förutsätts finnas redan: api(), esc() (huvudfilen), renderAiMarkdown() (progress.js).

    // Uppskattad kostnad: Claude Opus 5.5, USD per miljon tokens (input / output).
    const AI_PRICE_PER_MTOK = { in: 4, out: 20 };

    async function loadAiFeedback() {
      const el = document.getElementById('aif-content');
      el.innerHTML = '<p style="color:#8a97a0;">Hämtar…</p>';
      let data;
      try {
        data = await api('getAiFeedback');
      } catch (e) {
        el.innerHTML = '<p class="status-err">' + esc(e.message) + '</p>';
        return;
      }
      const { byScope, rated, followups: fu, ratedFollowups } = data;
      if (!byScope.length) { el.innerHTML = '<p style="color:#8a97a0;">Inga AI-sammanställningar har gjorts än.</p>'; return; }

      const sum = k => byScope.reduce((s, r) => s + (r[k] || 0), 0);
      const total = sum('total'), up = sum('up'), down = sum('down');
      // Följdfrågor läser det mesta av underlaget ur cachen (10 % av inputpriset).
      const fuCost = ((fu.sum_in - fu.sum_cache_read) * AI_PRICE_PER_MTOK.in + fu.sum_cache_read * AI_PRICE_PER_MTOK.in * 0.1 + fu.sum_out * AI_PRICE_PER_MTOK.out) / 1e6;
      const cost = (sum('sum_in') * AI_PRICE_PER_MTOK.in + sum('sum_out') * AI_PRICE_PER_MTOK.out) / 1e6 + fuCost;
      const pct = n => (up + down) ? Math.round(100 * n / (up + down)) + ' %' : '–';

      let out = '<p style="font-size:14px;">' + total + ' sammanställningar · ' + (up + down) + ' betygsatta · 👍 ' + up + ' (' + pct(up) + ') · 👎 ' + down + ' (' + pct(down) + ')'
        + ' · uppskattad kostnad ' + cost.toFixed(2) + ' USD</p>'
        + '<p style="font-size:14px;">' + fu.total + ' följdfrågor · 👍 ' + fu.up + ' · 👎 ' + fu.down + ' · kostnad ' + fuCost.toFixed(2) + ' USD (ingår ovan)</p>';

      out += '<div style="overflow-x:auto;"><table class="aif-table"><thead><tr><th>Omfattning</th><th>Antal</th><th>👍</th><th>👎</th><th>Snitt tokens in / ut</th><th>Senast</th></tr></thead><tbody>';
      byScope.forEach(r => {
        out += '<tr><td>' + esc(r.scope) + '</td><td>' + r.total + '</td><td>' + r.up + '</td><td>' + r.down + '</td><td>'
          + (r.avg_in ?? '–') + ' / ' + (r.avg_out ?? '–') + '</td><td>' + esc(r.latest.slice(0, 10)) + '</td></tr>';
      });
      out += '</tbody></table></div>';

      out += '<h3 style="margin-top:24px;">Betygsatta sammanställningar</h3>';
      if (!rated.length) out += '<p style="color:#8a97a0;">Inga betyg än.</p>';
      el.innerHTML = out;

      rated.forEach(r => {
        const card = document.createElement('div');
        card.className = 'assessment-card';
        const title = document.createElement('h4');
        title.style.margin = '0';
        title.textContent = (r.rating === 1 ? '👍 ' : '👎 ') + r.scope;
        const meta = document.createElement('div');
        meta.className = 'meta';
        meta.textContent = 'Betygsatt ' + r.ratedAt + ' · skapad ' + r.createdAt + ' · ' + r.assessmentCount + ' bedömningar · ' + r.model;
        card.append(title, meta);
        if (r.comment) {
          const c = document.createElement('div');
          c.style.cssText = 'margin-top:6px;font-style:italic;';
          c.textContent = '”' + r.comment + '”';
          card.append(c);
        }
        const content = document.createElement('div');
        content.className = 'ai-box hidden';
        content.innerHTML = renderAiMarkdown(r.content, null);
        const toggle = document.createElement('button');
        toggle.className = 'btn-secondary btn-small';
        toggle.style.marginTop = '8px';
        toggle.textContent = 'Visa sammanställningen';
        toggle.onclick = () => {
          const open = content.classList.toggle('hidden') === false;
          toggle.textContent = open ? 'Dölj sammanställningen' : 'Visa sammanställningen';
        };
        card.append(toggle, content);
        el.append(card);
      });

      // v4.60.0: betygsatta svar på följdfrågor.
      const h = document.createElement('h3');
      h.style.marginTop = '24px';
      h.textContent = 'Betygsatta svar på följdfrågor';
      el.append(h);
      if (!ratedFollowups.length) el.insertAdjacentHTML('beforeend', '<p style="color:#8a97a0;">Inga betyg än.</p>');
      ratedFollowups.forEach(r => {
        const card = document.createElement('div');
        card.className = 'assessment-card';
        const title = document.createElement('h4');
        title.style.margin = '0';
        title.textContent = (r.rating === 1 ? '👍 ' : '👎 ') + r.question;
        const meta = document.createElement('div');
        meta.className = 'meta';
        meta.textContent = 'Betygsatt ' + r.ratedAt + ' · frågad ' + r.createdAt;
        card.append(title, meta);
        if (r.comment) {
          const c = document.createElement('div');
          c.style.cssText = 'margin-top:6px;font-style:italic;';
          c.textContent = '”' + r.comment + '”';
          card.append(c);
        }
        const answer = document.createElement('div');
        answer.className = 'ai-box';
        answer.innerHTML = renderAiMarkdown(r.answer, null);
        card.append(answer);
        el.append(card);
      });
    }
