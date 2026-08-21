/**
 * presensi.js - Sistem Presensi Elektronik Pusbangkom
 * Halaman: Form Presensi (presensi.html)
 *
 * Fitur:
 * - Ambil nama & lokasi kegiatan dari URL query string
 * - Signature pad (canvas) dengan dukungan mouse & touch
 * - Turnstile mock (simulasi verifikasi)
 * - Validasi form sebelum submit diaktifkan
 */

'use strict';

(function () {

  /* ============================================================
     1. QUERY STRING — nama & lokasi dari URL
     ============================================================ */
  function getQueryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  const kegiatanName  = getQueryParam('kegiatan');
  const kegiatanLokasi = getQueryParam('lokasi');

  const titleEl  = document.getElementById('kegiatan-title-presensi');
  const lokasiEl = document.getElementById('kegiatan-lokasi-presensi');

  if (titleEl && kegiatanName)  titleEl.textContent  = decodeURIComponent(kegiatanName);
  if (lokasiEl && kegiatanLokasi) lokasiEl.textContent = decodeURIComponent(kegiatanLokasi);


  /* ============================================================
     2. SIGNATURE PAD
     ============================================================ */
  const canvas      = document.getElementById('signature-canvas');
  const ctx         = canvas ? canvas.getContext('2d') : null;
  const placeholder = document.getElementById('signature-placeholder');
  const clearBtn    = document.getElementById('btn-clear-signature');

  let isDrawing    = false;
  let hasSignature = false;
  let lastX = 0, lastY = 0;

  if (canvas && ctx) {
    // Set warna garis
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth   = 2.8;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';

    // Fill background gelap
    function fillDarkBg() {
      ctx.save();
      ctx.resetTransform ? ctx.resetTransform() : ctx.setTransform(1,0,0,1,0,0);
      // bg ttd
      ctx.fillStyle = 'rgba(250, 192, 0, 0.29)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }

    /* Ukuran canvas sesuai tampilan agar tidak blur */
    function resizeCanvas() {
      const rect = canvas.getBoundingClientRect();
      const dpr  = window.devicePixelRatio || 1;

      // Simpan gambar sebelum resize
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      canvas.width  = rect.width  * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);

      // Fill background gelap
      fillDarkBg();

      // Kembalikan style
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth   = 2.8;
      ctx.lineCap     = 'round';
      ctx.lineJoin    = 'round';

      // Restore gambar
      if (hasSignature) ctx.putImageData(imgData, 0, 0);
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    /* Dapatkan posisi relatif terhadap canvas */
    function getPos(e) {
      const rect = canvas.getBoundingClientRect();
      const src  = e.touches ? e.touches[0] : e;
      return {
        x: src.clientX - rect.left,
        y: src.clientY - rect.top
      };
    }

    /* Mulai menggambar */
    function startDraw(e) {
      e.preventDefault();
      isDrawing = true;
      const pos = getPos(e);
      lastX = pos.x;
      lastY = pos.y;
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
    }

    /* Menggambar */
    function draw(e) {
      if (!isDrawing) return;
      e.preventDefault();
      const pos = getPos(e);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      lastX = pos.x;
      lastY = pos.y;

      if (!hasSignature) {
        hasSignature = true;
        placeholder && placeholder.classList.add('hidden');
        checkFormReady();
      }
    }

    /* Berhenti menggambar */
    function stopDraw(e) {
      if (!isDrawing) return;
      isDrawing = false;
      ctx.closePath();
    }

    // Mouse events
    canvas.addEventListener('mousedown',  startDraw);
    canvas.addEventListener('mousemove',  draw);
    canvas.addEventListener('mouseup',    stopDraw);
    canvas.addEventListener('mouseleave', stopDraw);

    // Touch events
    canvas.addEventListener('touchstart', startDraw, { passive: false });
    canvas.addEventListener('touchmove',  draw,      { passive: false });
    canvas.addEventListener('touchend',   stopDraw);

    /* Tombol hapus tanda tangan */
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        fillDarkBg();
        hasSignature = false;
        placeholder && placeholder.classList.remove('hidden');
        checkFormReady();
      });
    }
  }


  /* ============================================================
     3. TURNSTILE MOCK — simulasi UX verifikasi Cloudflare
     ============================================================ */
  const turnstileMock = document.getElementById('presensi-turnstile-mock');
  const turnstileText = document.getElementById('presensi-turnstile-text');
  const turnstileCb   = document.getElementById('presensi-turnstile-checkbox');

  let isVerified = false;
  let isLoading  = false;

  if (turnstileMock) {
    function triggerVerify() {
      if (isVerified || isLoading) return;

      isLoading = true;
      turnstileMock.classList.add('is-loading');
      if (turnstileText) turnstileText.textContent = 'Memverifikasi...';

      setTimeout(function () {
        isLoading  = false;
        isVerified = true;
        turnstileMock.classList.remove('is-loading');
        turnstileMock.classList.add('is-verified');
        if (turnstileText) turnstileText.textContent = 'Berhasil!';
        turnstileMock.setAttribute('aria-label', 'Verifikasi berhasil');
        checkFormReady();
      }, 1200);
    }

    turnstileMock.addEventListener('click', triggerVerify);
    turnstileMock.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        triggerVerify();
      }
    });
  }


  /* ============================================================
     4. VALIDASI FORM — aktifkan tombol submit
     ============================================================ */
  const form      = document.getElementById('form-presensi');
  const btnSubmit = document.getElementById('btn-submit-presensi');
  const hint      = document.getElementById('presensi-submit-hint');

  /* Field wajib teks */
  const requiredInputs = [
    document.getElementById('nama-peserta'),
    document.getElementById('jabatan-presensi'),
    document.getElementById('instansi-presensi'),
    document.getElementById('unit-kerja')
  ];

  /* Checkbox pernyataan */
  const checkboxPernyataan = document.getElementById('checkbox-pernyataan');

  function checkFormReady() {
    const allFilled = requiredInputs.every(function (el) {
      return el && el.value.trim().length >= (el.minLength > 0 ? el.minLength : 1);
    });

    const jenisOk   = !!document.querySelector('input[name="jenis-peserta"]:checked');
    const tipeOk    = !!document.querySelector('input[name="tipe-kehadiran"]:checked');
    const pernyataanOk = checkboxPernyataan ? checkboxPernyataan.checked : false;

    const ready = allFilled && jenisOk && tipeOk && hasSignature && pernyataanOk && isVerified;

    if (btnSubmit) {
      btnSubmit.disabled    = !ready;
      btnSubmit.setAttribute('aria-disabled', String(!ready));
    }

    if (hint) {
      if (ready) {
        hint.textContent = 'Semua data telah dilengkapi. Silakan kirim kehadiran Anda.';
      } else {
        const missing = [];
        if (!allFilled)       missing.push('isi semua kolom wajib');
        if (!jenisOk)         missing.push('pilih jenis peserta');
        if (!tipeOk)          missing.push('pilih tipe kehadiran');
        if (!hasSignature)    missing.push('tambahkan tanda tangan');
        if (!pernyataanOk)    missing.push('centang pernyataan');
        if (!isVerified)      missing.push('selesaikan verifikasi');
        hint.textContent = missing.length
          ? 'Harap: ' + missing.join(', ') + '.'
          : 'Lengkapi form untuk mengirim.';
      }
    }
  }

  /* Listen pada semua perubahan input */
  requiredInputs.forEach(function (el) {
    if (el) el.addEventListener('input', checkFormReady);
  });

  document.querySelectorAll('input[name="jenis-peserta"], input[name="tipe-kehadiran"]')
    .forEach(function (el) { el.addEventListener('change', checkFormReady); });

  if (checkboxPernyataan) {
    checkboxPernyataan.addEventListener('change', checkFormReady);
  }

  // Cek awal
  checkFormReady();


  /* ============================================================
     5. SUBMIT FORM
     ============================================================ */
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      if (!hasSignature || !isVerified) return;

      /* Kumpulkan data */
      const data = {
        kegiatan:      titleEl  ? titleEl.textContent.trim()  : '',
        lokasi:        lokasiEl ? lokasiEl.textContent.trim() : '',
        jenisPeserta:  (document.querySelector('input[name="jenis-peserta"]:checked') || {}).value  || '',
        tipeKehadiran: (document.querySelector('input[name="tipe-kehadiran"]:checked') || {}).value || '',
        namaPeserta:   (document.getElementById('nama-peserta')    || {}).value || '',
        jabatan:       (document.getElementById('jabatan-presensi') || {}).value || '',
        instansi:      (document.getElementById('instansi-presensi') || {}).value || '',
        unitKerja:     (document.getElementById('unit-kerja')       || {}).value || '',
        nip:           (document.getElementById('nip-presensi')     || {}).value || '',
        whatsapp:      (document.getElementById('whatsapp-presensi') || {}).value || '',
        email:         (document.getElementById('email-presensi')   || {}).value || '',
        tandaTangan:   canvas ? canvas.toDataURL('image/png') : null,
        waktu:         new Date().toISOString()
      };

      console.log('[Presensi] Data yang akan dikirim:', data);

      /* Tampilkan feedback sukses */
      if (btnSubmit) {
        btnSubmit.textContent = 'Mengirim...';
        btnSubmit.disabled    = true;
      }

      /* TODO: Ganti simulasi dengan integrasi Firebase Firestore */
      setTimeout(function () {
        alert('Presensi Anda berhasil dikirim! Terima kasih telah mengisi kehadiran.');
        form.reset();
        if (ctx && canvas) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        hasSignature = false;
        isVerified   = false;
        isLoading    = false;
        placeholder && placeholder.classList.remove('hidden');
        if (turnstileMock) {
          turnstileMock.classList.remove('is-verified', 'is-loading');
          if (turnstileText) turnstileText.textContent = 'Saya bukan robot';
        }
        if (btnSubmit) {
          btnSubmit.textContent = 'Kirim Kehadiran';
        }
        checkFormReady();
      }, 1500);
    });
  }

})();
