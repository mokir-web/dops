// ── Profil ────────────────────────────────────────────────────────────────────
// Utbruten från index.html (Fas 2, modularisering). Klassiskt script (ej
// type="module") — se js/progress.js för motivering och beroendemodell.
// Beroenden (huvudfilen): api(), esc(), show(), customConfirm(), setStatus(),
// currentUser, appData.

    let _profileSnapshot = null;

    function _snapshotProfile() {
      const g = id => document.getElementById(id);
      _profileSnapshot = {
        firstName:           (g('profile-firstname')?.value   || '').trim(),
        lastName:            (g('profile-lastname')?.value    || '').trim(),
        email:               (g('profile-email-input')?.value || '').trim().toLowerCase(),
        clinic:              g('profile-clinic-input')?.value  || '',
        jobRole:             g('profile-jobrole')?.value       || '',
        userRole:            g('profile-userrole')?.value      || '',
        emailNotify:         !!(g('profile-email-notify')?.checked),
        emailNotifyRequests: !!(g('profile-email-notify-requests')?.checked),
        startPage:           g('profile-startpage')?.value     || '',
      };
    }

    function _checkProfileDirty() {
      const g   = id => document.getElementById(id);
      const btn = document.getElementById('profile-save-btn');
      if (!btn || !_profileSnapshot) return;
      const p = _profileSnapshot;
      const dirty =
        (g('profile-firstname')?.value   || '').trim()              !== p.firstName ||
        (g('profile-lastname')?.value    || '').trim()              !== p.lastName  ||
        (g('profile-email-input')?.value || '').trim().toLowerCase() !== p.email    ||
        (g('profile-clinic-input')?.value || '')                    !== p.clinic    ||
        (g('profile-jobrole')?.value     || '')                     !== p.jobRole   ||
        (g('profile-userrole')?.value    || '')                     !== p.userRole  ||
        !!(g('profile-email-notify')?.checked)                      !== p.emailNotify ||
        !!(g('profile-email-notify-requests')?.checked)             !== p.emailNotifyRequests ||
        (g('profile-startpage')?.value   || '')                     !== p.startPage ||
        !!(g('profile-current-pin')?.value) ||
        !!(g('profile-new-pin')?.value);
      if (dirty) {
        btn.textContent = 'Spara \u00e4ndringar';
        btn.disabled = false;
      } else {
        btn.disabled = true;
      }
    }

    function prefillProfile() {
      const s = id => document.getElementById(id);
      if (s('profile-firstname'))    s('profile-firstname').value    = currentUser.firstName  || '';
      if (s('profile-lastname'))     s('profile-lastname').value     = currentUser.lastName   || '';
      if (s('profile-email-input'))  s('profile-email-input').value  = currentUser.email      || '';
      const clinicSel = s('profile-clinic-input');
      if (clinicSel) {
        if (clinicSel.options.length <= 1 && appData && appData.klinikIdMap) {
          Object.entries(appData.klinikIdMap).sort((a,b) => a[0].localeCompare(b[0])).forEach(([namn]) => {
            const opt = document.createElement('option');
            opt.value = namn; opt.textContent = namn;
            clinicSel.appendChild(opt);
          });
        }
        // Lägg till aktuell klinik om den inte finns i listan
        const currentClinic = currentUser.clinic || '';
        if (currentClinic && !clinicSel.querySelector(`option[value="${currentClinic}"]`)) {
          const opt = document.createElement('option'); opt.value = currentClinic; opt.textContent = currentClinic;
          clinicSel.appendChild(opt);
        }
        clinicSel.value = currentClinic || clinicSel.options[1]?.value || '';
      }
      if (s('profile-jobrole'))      s('profile-jobrole').value      = currentUser.jobRole    || '';
      if (s('profile-userrole'))     s('profile-userrole').value     = currentUser.userRole   || '';
      if (s('profile-email-notify'))
        s('profile-email-notify').checked = currentUser.emailNotify === true || currentUser.emailNotify === 'Ja';
      if (s('profile-email-notify-requests'))
        s('profile-email-notify-requests').checked = currentUser.emailNotifyRequests !== false && currentUser.emailNotifyRequests !== 'Nej';
      if (s('profile-sound-notify'))
        s('profile-sound-notify').checked = localStorage.getItem('dops_sound_notify') === '1';
      // Startsida-dropdown
      const startSel = s('profile-startpage');
      if (startSel) {
        startSel.innerHTML = '';
        getStartPageOptions().forEach(o => {
          const opt = document.createElement('option');
          opt.value = o.value; opt.textContent = o.label; startSel.appendChild(opt);
        });
        const saved = localStorage.getItem('dops_startpage_' + (currentUser?.email || '')) || currentUser?.startPage || '';
        startSel.value = saved;
      }
      if (s('profile-current-pin'))  s('profile-current-pin').value  = '';
      if (s('profile-new-pin'))      s('profile-new-pin').value      = '';
      const statusEls = ['profile-role-status','profile-pin-status'];
      statusEls.forEach(id => { if (s(id)) s(id).textContent = ''; });
      // Snapshot + inaktivera knappen tills något ändras
      _snapshotProfile();
      const profileSaveBtn = document.getElementById('profile-save-btn');
      if (profileSaveBtn) profileSaveBtn.disabled = true;
      // Koppla dirty-kontroll (avregistrera först för att undvika dubletter)
      ['profile-firstname','profile-lastname','profile-email-input','profile-clinic-input',
       'profile-jobrole','profile-userrole','profile-email-notify','profile-email-notify-requests',
       'profile-startpage','profile-current-pin','profile-new-pin'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.removeEventListener('input',  _checkProfileDirty);
        el.removeEventListener('change', _checkProfileDirty);
        el.addEventListener('input',  _checkProfileDirty);
        el.addEventListener('change', _checkProfileDirty);
      });
    }

    async function saveProfile() {
      const s = id => document.getElementById(id);
      const saveBtn = document.getElementById('profile-save-btn');
      const origSaveBtnText = saveBtn?.textContent || 'Spara \u00e4ndringar';
      const firstName   = (s('profile-firstname')?.value    || '').trim();
      const lastName    = (s('profile-lastname')?.value     || '').trim();
      const newEmail    = (s('profile-email-input')?.value  || '').trim().toLowerCase();
      const clinic      = (s('profile-clinic-input')?.value || '').trim();
      // Hitta klinikId från valt kliniknamn
      const newKlinikId = (appData && appData.klinikIdMap && clinic) ? (appData.klinikIdMap[clinic] || currentUser.klinikId) : currentUser.klinikId;
      const jobRole     = s('profile-jobrole')?.value  || '';
      const userRole    = s('profile-userrole')?.value || '';
      const emailNotify         = s('profile-email-notify')?.checked ? 'Ja' : 'Nej';
      const emailNotifyRequests = s('profile-email-notify-requests')?.checked ? 'Ja' : 'Nej';
      const startPage           = s('profile-startpage')?.value || '';
      const currentPin  = (s('profile-current-pin')?.value || '').trim();
      const newPin      = (s('profile-new-pin')?.value     || '').trim();

      if (!firstName || !lastName) { setStatus('profile-role-status', 'Namn får inte vara tomt.', true); return; }
      if (!clinic) { setStatus('profile-role-status', 'Välj en klinik.', true); return; }

      if (saveBtn) { saveBtn.textContent = 'Sparar\u2026'; saveBtn.disabled = true; }

      try {
        // Verifiera PIN om byte önskas
        if (newPin) {
          if (!/^\d{4,6}$/.test(newPin)) { setStatus('profile-pin-status', 'Ny PIN måste vara 4–6 siffror.', true); if (saveBtn) { saveBtn.textContent = origSaveBtnText; saveBtn.disabled = false; } return; }
          if (!currentPin) { setStatus('profile-pin-status', 'Ange nuvarande PIN för att byta.', true); if (saveBtn) { saveBtn.textContent = origSaveBtnText; saveBtn.disabled = false; } return; }
          const check = await api('login', { email: currentUser.email, pin: currentPin });
          if (!check || check.locked || check.failed) { setStatus('profile-pin-status', 'Nuvarande PIN är felaktig.', true); if (saveBtn) { saveBtn.textContent = origSaveBtnText; saveBtn.disabled = false; } return; }
        }

        const result = await api('updateProfile', {
          email: currentUser.email,
          updates: { firstName, lastName, newEmail, clinic, klinikId: newKlinikId, jobRole, userRole,
            emailNotify, emailNotifyRequests, startPage,
            ...(newPin ? { newPin } : {}) }
        });
        if (result.error) { setStatus('profile-role-status', result.error, true); if (saveBtn) { saveBtn.textContent = origSaveBtnText; saveBtn.disabled = false; } return; }

        currentUser.firstName          = firstName;
        currentUser.lastName           = lastName;
        currentUser.email              = newEmail || currentUser.email;
        currentUser.clinic             = clinic;
        if (newKlinikId) currentUser.klinikId = newKlinikId;
        currentUser.jobRole            = jobRole;
        currentUser.userRole           = userRole;
        currentUser.emailNotify        = emailNotify === 'Ja';
        currentUser.emailNotifyRequests = emailNotifyRequests === 'Ja';
        localStorage.setItem('dops_user', JSON.stringify(currentUser));
        if (startPage !== undefined) {
          if (startPage) localStorage.setItem('dops_startpage_' + currentUser.email, startPage);
          else localStorage.removeItem('dops_startpage_' + currentUser.email);
        }
        const fullName = `${firstName} ${lastName}`;
        document.getElementById('nav-user').textContent  = fullName;
        document.getElementById('nav-clinic').textContent = clinic;
        prefillAssessment();
        if (newPin) setStatus('profile-pin-status', '✓ PIN ändrad!', false);
        localStorage.removeItem('dops_appdata');
        // Rensa PIN-fält, ta ny snapshot och inaktivera knappen (inga osparade ändringar kvar)
        const s3 = id => document.getElementById(id);
        if (s3('profile-current-pin')) s3('profile-current-pin').value = '';
        if (s3('profile-new-pin'))     s3('profile-new-pin').value     = '';
        if (saveBtn) { saveBtn.textContent = '\u00c4ndringar sparade'; saveBtn.disabled = true; }
        _snapshotProfile();
      } catch(err) { setStatus('profile-role-status', err.message, true); if (saveBtn) { saveBtn.textContent = origSaveBtnText; saveBtn.disabled = false; } }
    }

    async function confirmDeleteProfile() {
      const confirmed = await customConfirm('Är du säker? Detta raderar ditt konto permanent. Åtgärden kan inte ångras.');
      if (!confirmed) return;
      const pin = await customPrompt('Bekräfta med din PIN:', 'password');
      if (!pin) return;
      try {
        const user = await api('login', { email: currentUser.email, pin });
        if (!user) { setStatus('profile-delete-status', 'Felaktig PIN.', true); return; }
        setStatus('profile-delete-status', '⏳ Raderar...', false);
        const result = await api('deleteMyAccount');
        if (result.error) { setStatus('profile-delete-status', result.error, true); return; }
        localStorage.removeItem('dops_user');
        await customAlert('Ditt konto har raderats.');
        location.reload();
      } catch(err) { setStatus('profile-delete-status', err.message, true); }
    }



    // ── Registration ──────────────────────────────────────────────
    function updateProfileClinicId() {
      // Synka klinikId när klinik byts i profilen
      const sel = document.getElementById('profile-clinic-input');
      if (!sel || !appData || !appData.klinikIdMap) return;
      // klinikId uppdateras vid saveProfile via backend
    }
