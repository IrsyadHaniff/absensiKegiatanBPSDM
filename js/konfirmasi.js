/**
 * konfirmasi.js — Sistem Presensi Elektronik Biro ORTALAMR
 * Halaman: Form Konfirmasi Kehadiran (konfirmasi.html)
 *
 * TODO: inisialisasi Firebase App & Firestore di sini saat backend siap
 * import { initializeApp } from "firebase/app";
 * import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";
 *
 * TODO: inisialisasi Cloudflare Turnstile callback:
 * window.onTurnstileVerified = function(token) { ... }
 */

'use strict';

(function () {
  /* ============================================================
     QUERY STRING — ambil nama & lokasi kegiatan dari URL
     Contoh URL: konfirmasi.html?kegiatan=Nama+Kegiatan&lokasi=Tempat
     ============================================================ */
  function getQueryParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
  }

  const kegiatanName  = getQueryParam('kegiatan');
  const kegiatanLokasi = getQueryParam('lokasi');

  const titleEl  = document.getElementById('kegiatan-title');
  const lokasiEl = document.getElementById('kegiatan-lokasi');

  if (titleEl && kegiatanName) {
    titleEl.textContent = decodeURIComponent(kegiatanName);
  }

  if (lokasiEl && kegiatanLokasi) {
    lokasiEl.textContent = decodeURIComponent(kegiatanLokasi);
  }

  /* ============================================================
     TURNSTILE MOCK — simulasi UX verifikasi
     Klik → loading (1.2 detik) → verified → aktifkan tombol submit
     ============================================================ */
  const turnstileMock = document.getElementById('turnstile-mock');
  const turnstileText = document.getElementById('turnstile-text');
  const btnSubmit     = document.getElementById('btn-submit');
  const submitHint    = document.getElementById('submit-hint');

  let isVerified = false;
  let isLoading  = false;

  function setVerified() {
    isVerified = true;
    isLoading  = false;

    turnstileMock.classList.remove('is-loading');
    turnstileMock.classList.add('is-verified');
    turnstileMock.setAttribute('aria-pressed', 'true');
    turnstileMock.setAttribute('aria-label', 'Verifikasi berhasil – Anda bukan robot');

    if (turnstileText) turnstileText.textContent = 'Berhasil!';

    // Aktifkan tombol submit
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.removeAttribute('aria-disabled');
    }

    if (submitHint) {
      submitHint.textContent = 'Verifikasi berhasil. Klik "Kirim Konfirmasi" untuk mengirimkan data Anda.';
    }

    // TODO: saat integrasi Turnstile asli, token akan diterima via callback
    // window.onTurnstileVerified = function(token) {
    //   // simpan token untuk dikirim bersama form submission ke backend
    //   document.querySelector('input[name="cf-turnstile-response"]').value = token;
    //   setVerified();
    // };
  }

  function setLoading() {
    isLoading = true;
    turnstileMock.classList.add('is-loading');
    if (turnstileText) turnstileText.textContent = 'Memverifikasi...';
    turnstileMock.setAttribute('aria-label', 'Sedang memverifikasi...');
  }

  if (turnstileMock) {
    // Klik handler
    const handleVerify = () => {
      if (isVerified || isLoading) return;

      setLoading();

      // Simulasi delay verifikasi (1.2 detik)
      setTimeout(setVerified, 1200);
    };

    turnstileMock.addEventListener('click', handleVerify);

    // Keyboard accessibility (Enter / Space)
    turnstileMock.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleVerify();
      }
    });
  }

  /* ============================================================
     FORM VALIDATION — sisi klien
     ============================================================ */
  const form      = document.getElementById('konfirmasi-form');
  const inputNama = document.getElementById('nama-peserta');

  // Live validation: Nama Peserta minimal 3 karakter
  if (inputNama) {
    inputNama.addEventListener('input', () => {
      const val = inputNama.value.trim();
      if (val.length > 0 && val.length < 3) {
        inputNama.setCustomValidity('Nama peserta harus minimal 3 karakter.');
        inputNama.style.borderColor = 'rgba(231, 76, 60, 0.7)';
        inputNama.style.boxShadow   = '0 0 0 3px rgba(231, 76, 60, 0.15)';
      } else {
        inputNama.setCustomValidity('');
        inputNama.style.borderColor = '';
        inputNama.style.boxShadow   = '';
      }
    });
  }

  // Form submit handler
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();

      // Cek verifikasi Turnstile
      if (!isVerified) {
        if (turnstileMock) {
          turnstileMock.focus();
          turnstileMock.style.boxShadow = '0 0 0 3px rgba(240, 195, 50, 0.5)';
          setTimeout(() => {
            if (turnstileMock) turnstileMock.style.boxShadow = '';
          }, 2000);
        }
        return;
      }

      // HTML5 built-in validation
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      // Kumpulkan data form
      const formData = new FormData(form);
      const payload  = {};
      formData.forEach((value, key) => {
        payload[key] = value.trim();
      });

      payload.kegiatan = kegiatanName || titleEl?.textContent || '';
      payload.lokasi   = kegiatanLokasi || lokasiEl?.textContent || '';
      payload.timestamp = new Date().toISOString();

      // TODO: Kirim ke Firestore saat backend siap:
      // import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";
      // const db = getFirestore(app);
      // await addDoc(collection(db, "konfirmasi"), {
      //   ...payload,
      //   createdAt: serverTimestamp(),
      // });

      // Simulasi submit sukses
      console.info('[Presensi] Data konfirmasi siap dikirim:', payload);
      showSuccessState();
    });
  }

  /* ============================================================
     SUCCESS STATE — tampilan setelah submit berhasil
     ============================================================ */
  function showSuccessState() {
    const formCard = document.querySelector('.form-card');
    if (!formCard) return;

    formCard.innerHTML = `
      <div style="
        text-align:center;
        padding: 64px 32px;
        display:flex;
        flex-direction:column;
        align-items:center;
        gap: 20px;
      ">
        <div style="
          width:80px; height:80px; border-radius:50%;
          background: rgba(39,174,96,0.15);
          border: 2px solid rgba(39,174,96,0.5);
          display:flex; align-items:center; justify-content:center;
          animation: fadeInUp 0.5s ease both;
        ">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
               stroke="#27AE60" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
               aria-hidden="true">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <h2 style="
          font-family: 'Playfair Display', serif;
          font-size: 26px; font-weight: 700;
          color: #FFFFFF;
          animation: fadeInUp 0.5s 0.1s ease both; opacity:0;
          animation-fill-mode: forwards;
        ">Konfirmasi Terkirim!</h2>
        <p style="
          font-size: 15px; color: #AAAAAA; max-width: 420px; line-height:1.6;
          animation: fadeInUp 0.5s 0.2s ease both; opacity:0;
          animation-fill-mode: forwards;
        ">
          Terima kasih. Data kehadiran Anda telah berhasil dikirimkan dan akan segera diproses oleh panitia kegiatan.
        </p>
        <a href="index.html" class="btn btn-gold btn-lg" style="
          margin-top:8px;
          animation: fadeInUp 0.5s 0.3s ease both; opacity:0;
          animation-fill-mode: forwards;
        ">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="19" y1="12" x2="5" y2="12"/>
            <polyline points="12 19 5 12 12 5"/>
          </svg>
          Kembali ke Daftar Kegiatan
        </a>
      </div>
    `;

    // Scroll to top of card
    formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ============================================================
     RADIO BUTTON — visual enhancement via JS
     Tambahkan 'selected' class pada label saat radio berubah
     ============================================================ */
  const radioInputs = document.querySelectorAll('.radio-option input[type="radio"]');

  radioInputs.forEach((radio) => {
    radio.addEventListener('change', () => {
      // Reset semua dalam group
      const groupName = radio.name;
      document.querySelectorAll(`input[name="${groupName}"]`).forEach((r) => {
        r.closest('.radio-option')?.classList.remove('is-selected');
      });
      // Set active
      radio.closest('.radio-option')?.classList.add('is-selected');
    });
  });

  /* ============================================================
     FORM FIELD FOCUS — micro feedback
     ============================================================ */
  const formInputs = document.querySelectorAll('.form-input');

  formInputs.forEach((input) => {
    input.addEventListener('focus', () => {
      input.closest('.form-group')?.classList.add('is-focused');
    });
    input.addEventListener('blur', () => {
      input.closest('.form-group')?.classList.remove('is-focused');
      // Trigger validation on blur
      if (input.required && input.value.trim() === '') {
        input.style.borderColor = 'rgba(231, 76, 60, 0.5)';
      } else if (input.value.trim() !== '') {
        input.style.borderColor = 'rgba(39, 174, 96, 0.5)';
        input.style.boxShadow   = '';
      }
    });
    // Clear error color on input
    input.addEventListener('input', () => {
      if (input.validity.valid || input.value.trim() === '') {
        input.style.borderColor = '';
        input.style.boxShadow   = '';
      }
    });
  });

  /* ============================================================
     ANIMATE FORM SECTIONS on load
     ============================================================ */
  const sections = document.querySelectorAll('.form-section, .form-header-section');
  if ('IntersectionObserver' in window) {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.style.animationPlayState = 'running';
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -30px 0px' }
    );

    sections.forEach((s) => {
      s.style.animationPlayState = 'paused';
      obs.observe(s);
    });
  }

})();
