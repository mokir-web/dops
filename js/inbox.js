// ── Förfrågningar (Inbox) ────────────────────────────────────────────────────
// Utbruten från index.html (Fas 2, modularisering). Klassiskt script (ej
// type="module") — se js/progress.js för motivering och beroendemodell.
//
// Beroenden som förutsätts finnas redan (huvudfilen): api(), esc(), show(),
// swr(), currentUser, activePrivilege, activeKlinikId, appData, _isProcessing,
// lockUI()/unlockUI(), setStatus(), customAlert(), showPanel(), renderForm(),
// updateFaviconNotification(), samt clearAssessmentBadge() (js/my-assessments.js,
// laddas efter denna fil men det spelar ingen roll — klassiska scripts delar
// scope och funktionsanrop slås upp först när de faktiskt körs).

    let currentInboxTab = 'inbox';
    let inboxData = null;
    function setInboxTab(tab) {
      currentInboxTab = tab;
      const ib = document.getElementById('inbox-tab-inbox');
      const ob = document.getElementById('inbox-tab-outbox');
      const rb = document.getElementById('inbox-tab-request');
      if (ib) { ib.className = tab==='inbox'  ? 'tab-btn active' : 'tab-btn'; ib.disabled = false; }
      if (ob) { ob.className = tab==='outbox' ? 'tab-btn active' : 'tab-btn'; ob.disabled = false; }
      if (rb) { rb.className = tab==='request' ? 'tab-btn active' : 'tab-btn'; }
      show('inbox-list', tab !== 'request');
      show('request-form', tab === 'request');
      if (tab === 'request') { showRequestForm(); }
      else { renderInbox(); }
    }
    async function loadInboxBadge() {
      try {
        inboxData = await api('getAssessmentRequests', { email: currentUser.email });
        updateInboxBadge();
      } catch(err) { console.error('Förfrågningar:', err); }
      return inboxData;
    }
    function updateInboxBadge() {
      const total = (inboxData?.inbox || []).length;
      // Visa/dölj bulk-knapp
      const bulkWrap = document.getElementById('bulk-request-btn-wrap');
      if (bulkWrap) bulkWrap.classList.toggle('hidden', !activePrivilege); // visa så länge det finns förfrågningar
      const badge = document.getElementById('inbox-badge');
      if (badge) {
        badge.textContent = total;
        badge.classList.toggle('hidden', total === 0);
      }
      updateFaviconNotification();
    }
    async function loadInbox() {
      const notifyChk = document.getElementById('inbox-email-notify');
      if (notifyChk) notifyChk.checked = currentUser.emailNotifyRequests !== false;
      await swr(
        'inbox_' + currentUser.email,
        () => api('getAssessmentRequests', { email: currentUser.email, klinikId: currentUser.klinikId }),
        data => {
          if (!data) return;
          inboxData = data;
          renderInbox();
          updateInboxBadge();
        },
        document.getElementById('inbox-swr-status'),
        (fresh, old) => Math.max(0, (fresh.inbox?.length||0) - (old.inbox?.length||0))
      );
    }
    function renderInbox() {
      const el = document.getElementById('inbox-list');
      const items = currentInboxTab === 'inbox' ? (inboxData?.inbox || []) : (inboxData?.outbox || []);
      if (!items.length) { el.innerHTML = '<p style="color:#888;">Inga förfrågningar.</p>'; return; }
      el.innerHTML = '';
      items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'assessment-card';
        card.style.marginTop = '12px';
        if (currentInboxTab === 'inbox' && !item.read) card.style.borderLeft = '4px solid #2e4a5f';
        const isInbox = currentInboxTab === 'inbox';
        const personName = isInbox ? item.fromName : item.toName;
        card.innerHTML = html`<div style="font-weight:bold;font-size:16px;">${personName}</div>${item.formType ? safe(html`<div style="font-size:13px;color:#2e4a5f;font-weight:bold;margin-top:2px;">📋 ${item.formType}</div>`) : ''}<div style="font-size:13px;color:#5b6b75;margin-top:2px;">${item.timestamp}</div><div style="margin-top:8px;font-size:15px;">${item.message}</div>`;
        if (isInbox) {
          const btn = document.createElement('button');
          btn.className = 'btn-primary btn-small';
          btn.style.marginTop = '10px';
          btn.textContent = 'Utför bedömning';
          btn.onclick = () => startRequestedAssessment(item);
          card.appendChild(btn);
        } else if (!isInbox && item.status === 'Inaktuell') {
          const tag = document.createElement('div');
          tag.style.cssText = 'margin-top:8px;font-size:13px;color:#8a97a0;font-weight:bold;';
          tag.textContent = '× Inaktuell — förfrågan har passerat tidsgränsen';
          card.appendChild(tag);
        } else if (!isInbox && item.status !== 'Utförd') {
          const doneBtn = document.createElement('button');
          doneBtn.className = 'btn-secondary btn-small';
          doneBtn.style.marginTop = '10px';
          doneBtn.textContent = '✓ Markera utförd';
          doneBtn.onclick = () => {
            api('markRequestDone', { id: item.id }).then(() => {
              bgInvalidate('inbox_' + currentUser.email);
              loadInbox();
            }).catch(() => {});
          };
          card.appendChild(doneBtn);
        } else if (!isInbox && item.status === 'Utförd') {
          const tag = document.createElement('div');
          tag.style.cssText = 'margin-top:8px;font-size:13px;color:#4a9e62;font-weight:bold;';
          tag.textContent = '✓ Utförd';
          card.appendChild(tag);
        }
        el.appendChild(card);
        // Markera som läst
        if (isInbox && !item.read) api('markRequestRead', { id: item.id }).catch(()=>{});
      });
    }
    function showRequestForm() {
      show('request-form', true);
      // Fyll formulärtyper
      const ftSel = document.getElementById('request-formtype');
      if (ftSel && ftSel.options.length <= 1 && appData && appData.formTypes) {
        const allForms = [...new Set(Object.values(appData.formTypes).flat())].sort((a, b) => a.localeCompare(b, 'sv'));
        allForms.forEach(ft => {
          const opt = document.createElement('option');
          opt.value = ft; opt.textContent = ft; ftSel.appendChild(opt);
        });
      }
      const sel = document.getElementById('request-to');
      sel.innerHTML = '<option value="">-- Välj kollega --</option>';
      if (appData && appData.lists) {
        const clinic = currentUser.clinic;
        const myName = (currentUser.firstName + ' ' + currentUser.lastName).trim();
        const allNames = new Set();
        // Hämta från alla kategorier och Registrerare/Mottagare
        ['Registrerare','Mottagare','ST','Spec','AT','BT'].forEach(cat => {
          const names = appData.lists[cat]?.[clinic] || [];
          names.forEach(n => {
            const shortName = n.split(' -- ')[0].trim();
            if (shortName && shortName !== myName) allNames.add(n);
          });
        });
        if (allNames.size === 0) {
          // Fallback: försök utan klinikfilter
          ['Registrerare','Mottagare','ST','Spec','AT','BT'].forEach(cat => {
            const byClinic = appData.lists[cat] || {};
            Object.values(byClinic).flat().forEach(n => {
              const shortName = n.split(' -- ')[0].trim();
              if (shortName && shortName !== myName) allNames.add(n);
            });
          });
        }
        sortByLastName([...allNames]).forEach(name => {
          const opt = document.createElement('option');
          opt.value = name;
          opt.textContent = name.split(' -- ')[0].trim();
          sel.appendChild(opt);
        });
      }
    }
    function hideRequestForm() {
      const ft = document.getElementById('request-formtype');
      if (ft) ft.value = '';
      const msg = document.getElementById('request-message');
      if (msg) msg.value = '';
      setInboxTab('inbox');
    }
    async function sendRequest() {
      if (_isProcessing) return;
      const btn = document.querySelector('#request-form .btn-primary');
      const origBtnText = btn?.textContent || 'Skicka f\u00f6rfr\u00e5gan';
      if (btn) btn.textContent = 'Skickar\u2026';
      lockUI();
      const toName   = document.getElementById('request-to').value;
      const message  = document.getElementById('request-message').value.trim();
      const formType = document.getElementById('request-formtype')?.value || '';
      if (!toName)   { setStatus('request-status', 'Välj en kollega.', true); if (btn) btn.textContent = origBtnText; unlockUI(); return; }
      if (!message)  { setStatus('request-status', 'Skriv ett meddelande.', true); if (btn) btn.textContent = origBtnText; unlockUI(); return; }
      try {
        const toEmail = await api('getRecipientEmail', { recipientFullName: toName });
        if (!toEmail) { setStatus('request-status', 'Kunde inte hitta e-post för ' + esc(toName), true); if (btn) btn.textContent = origBtnText; unlockUI(); return; }
        await api('sendAssessmentRequest', { fromEmail: currentUser.email, toEmail, message, formType });
        document.getElementById('request-message').value = '';
        document.getElementById('request-to').value = '';
        if (btn) btn.textContent = origBtnText;
        unlockUI();
        setTimeout(() => { hideRequestForm(); loadInbox(); }, 1500);
      } catch(err) { setStatus('request-status', err.message, true); if (btn) btn.textContent = origBtnText; unlockUI(); }
    }
    function startRequestedAssessment(item) {
      // Om formulärtyp är känd: hoppa direkt till formuläret
      if (item.formType) {
        startRequestedAssessmentDirect(item);
        return;
      }

      // Annars: visa val-sidan med förifylld mottagare
      showPanel('assessment');
      resetAssessment();
      // Sätt EFTER resetAssessment så de inte nollställs
      pendingRequestId = item.id;
      pendingRequestFrom = item.fromName;
      pendingRequestFormType = item.formType || '';
      setTimeout(() => {
        const fromName = item.fromName;
        const clinic = currentUser.clinic;
        let senderCategory = null;
        if (appData && appData.lists) {
          ['Spec','ST','AT','BT'].forEach(cat => {
            const names = appData.lists[cat]?.[clinic] || [];
            if (names.some(n => n.startsWith(fromName.split(' -- ')[0]))) senderCategory = cat;
          });
        }
        if (senderCategory) {
          const catRadio = document.querySelector(`input[name="category"][value="${senderCategory}"]`);
          if (catRadio) { catRadio.checked = true; catRadio.dispatchEvent(new Event('change')); }
        }
        setTimeout(() => {
          const sel = document.getElementById('recipient');
          let found = false;
          for (let opt of sel.options) {
            if (opt.value.startsWith(fromName.split(' -- ')[0])) { opt.selected = true; found = true; break; }
          }
          if (!found) {
            const opt = document.createElement('option');
            opt.value = fromName; opt.textContent = fromName.split(' -- ')[0]; opt.selected = true;
            sel.appendChild(opt);
          }
          document.querySelectorAll('input[name="category"]').forEach(r => r.disabled = true);
          sel.disabled = true;
          updateFormTypes();
          updateTillBedomningBtn();
          show('f5', true); show('f-till-bedomning', true);
        }, 400);
      }, 300);
    }
    async function startRequestedAssessmentDirect(item) {
      // Sätt pending-state DIREKT (resetAssessment anropas inte här)
      pendingRequestId       = item.id;
      pendingRequestFrom     = item.fromName;
      pendingRequestFormType = item.formType || '';

      // Hitta kategori för avsändaren
      const fromName = item.fromName.split(' -- ')[0].trim();
      const clinic = currentUser.clinic;
      let senderCategory = 'ST';
      if (appData && appData.lists) {
        ['Spec','ST','AT','BT'].forEach(cat => {
          const names = appData.lists[cat]?.[clinic] || [];
          if (names.some(n => n.split(' -- ')[0].trim() === fromName)) senderCategory = cat;
        });
      }

      // Sätt metadata INNAN resetAssessment
      window._pendingAssessmentMeta = {
        recipient: item.fromName,
        formType:  item.formType,
        category:  senderCategory
      };

      // Visa assessment-panelen och nollställ
      showPanel('assessment');
      // Dölj alla val-fält
      ['f-intro','f1','f2','f3','f4','f5','f-till-bedomning'].forEach(id => show(id, false));
      show('f6-container', true);
      document.getElementById('form-questions').innerHTML = '<p style="color:#888">Laddar frågor...</p>';
      window._formStartTime = new Date().toISOString();
      _sectionHistory = [];

      try {
        const data = await api('getFormQuestions', { formName: item.formType });
        if (!data || !data.length) {
          await customAlert('Inga frågor hittades för: ' + item.formType);
          showPanel('inbox'); return;
        }
        renderForm(data);
      } catch(err) { await customAlert('Fel: ' + err.message); showPanel('inbox'); }
    }
    function showBulkRequestForm() {
      show('bulk-request-form', true);
      // Fyll formulärtyper
      const ftSel = document.getElementById('bulk-formtype');
      ftSel.innerHTML = '<option value="">-- Välj formulärtyp --</option>';
      if (appData && appData.formTypes) {
        const allForms = [...new Set(Object.values(appData.formTypes).flat())].sort((a, b) => a.localeCompare(b, 'sv'));
        allForms.forEach(ft => {
          const opt = document.createElement('option');
          opt.value = ft; opt.textContent = ft;
          if (ft === 'Självskattning inför specialistkollegium') opt.selected = true;
          ftSel.appendChild(opt);
        });
      }
    }
    function hideBulkRequestForm() { show('bulk-request-form', false); }
    function populateBulkRecipients() {
      const role = document.getElementById('bulk-role-filter').value;
      const container = document.getElementById('bulk-recipients');
      container.innerHTML = '';
      if (!role || !appData || !appData.lists) return;
      const clinic = currentUser.clinic;
      const names = (appData.lists[role]?.[clinic] || []);
      names.forEach(name => {
        const shortName = name.split(' -- ')[0].trim();
        const label = document.createElement('label');
        label.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:14px;cursor:pointer;background:#eef1f3;border:1px solid #c7d1d7;border-radius:4px;padding:4px 10px;';
        const cb = document.createElement('input');
        cb.type = 'checkbox'; cb.value = name; cb.checked = true;
        cb.className = 'bulk-recipient-cb';
        label.appendChild(cb);
        label.appendChild(document.createTextNode(shortName));
        container.appendChild(label);
      });
    }
    function toggleBulkAll(checked) {
      document.querySelectorAll('.bulk-recipient-cb').forEach(cb => cb.checked = checked);
    }
    async function sendBulkRequest() {
      if (_isProcessing) return;
      const btn = document.querySelector('#bulk-request-form .btn-primary');
      const origBtnText = btn?.textContent || 'Skicka till markerade';
      if (btn) btn.textContent = 'Skickar\u2026';
      lockUI();
      const formType = document.getElementById('bulk-formtype').value;
      const message  = document.getElementById('bulk-message').value.trim();
      const selected = [...document.querySelectorAll('.bulk-recipient-cb:checked')].map(cb => cb.value);
      if (!formType)       { setStatus('bulk-status', 'Välj formulärtyp.', true); if (btn) btn.textContent = origBtnText; unlockUI(); return; }
      if (!selected.length){ setStatus('bulk-status', 'Markera minst en mottagare.', true); if (btn) btn.textContent = origBtnText; unlockUI(); return; }
      if (!message)        { setStatus('bulk-status', 'Skriv ett meddelande.', true); if (btn) btn.textContent = origBtnText; unlockUI(); return; }

      try {
        const toEmails = await Promise.all(
          selected.map(name => api('getRecipientEmail', { recipientFullName: name }).catch(() => null))
        ).then(emails => emails.filter(Boolean));

        const result = await api('sendBulkRequest', {
          fromEmail: currentUser.email,
          toEmails,
          message,
          formType
        });
        if (btn) btn.textContent = origBtnText;
        unlockUI();
        setTimeout(() => { hideBulkRequestForm(); loadInbox(); }, 1500);
      } catch(err) { setStatus('bulk-status', err.message, true); if (btn) btn.textContent = origBtnText; unlockUI(); }
    }
