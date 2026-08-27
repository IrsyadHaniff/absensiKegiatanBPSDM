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

"use strict";

(function () {
  /* ============================================================
     1. QUERY STRING — nama & lokasi dari URL
     ============================================================ */
  function getQueryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  const kegiatanName = getQueryParam("kegiatan");
  const kegiatanLokasi = getQueryParam("lokasi");

  const titleEl = document.getElementById("kegiatan-title-presensi");
  const lokasiEl = document.getElementById("kegiatan-lokasi-presensi");

  if (titleEl && kegiatanName) titleEl.textContent = decodeURIComponent(kegiatanName);
  if (lokasiEl && kegiatanLokasi) lokasiEl.textContent = decodeURIComponent(kegiatanLokasi);

  /* ============================================================
     2. SIGNATURE PAD
     ============================================================ */
  const canvas = document.getElementById("signature-canvas");
  const ctx = canvas ? canvas.getContext("2d") : null;
  const placeholder = document.getElementById("signature-placeholder");
  const clearBtn = document.getElementById("btn-clear-signature");

  let isDrawing = false;
  let hasSignature = false;
  let lastX = 0,
    lastY = 0;

  if (canvas && ctx) {
    // Set warna garis
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 2.8;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Fill background canvas
    function fillDarkBg() {
      ctx.save();
      ctx.resetTransform ? ctx.resetTransform() : ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = "rgba(250, 192, 0, 0.29)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }

    // Isi background saat pertama load (tanpa resize)
    fillDarkBg();

    /* Dapatkan posisi relatif terhadap canvas */
    function getPos(e) {
      const rect = canvas.getBoundingClientRect();
      const src = e.touches ? e.touches[0] : e;
      return {
        x: src.clientX - rect.left,
        y: src.clientY - rect.top,
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
        placeholder && placeholder.classList.add("hidden");
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
    canvas.addEventListener("mousedown", startDraw);
    canvas.addEventListener("mousemove", draw);
    canvas.addEventListener("mouseup", stopDraw);
    canvas.addEventListener("mouseleave", stopDraw);

    // Touch events
    canvas.addEventListener("touchstart", startDraw, { passive: false });
    canvas.addEventListener("touchmove", draw, { passive: false });
    canvas.addEventListener("touchend", stopDraw);

    /* Tombol hapus tanda tangan */
    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        fillDarkBg();
        hasSignature = false;
        placeholder && placeholder.classList.remove("hidden");
        checkFormReady();
      });
    }
  }

  /* ============================================================
     3. TURNSTILE MOCK — simulasi UX verifikasi Cloudflare
     ============================================================ */
  const turnstileMock = document.getElementById("presensi-turnstile-mock");
  const turnstileText = document.getElementById("presensi-turnstile-text");
  const turnstileCb = document.getElementById("presensi-turnstile-checkbox");

  let isVerified = false;
  let isLoading = false;

  if (turnstileMock) {
    function triggerVerify() {
      if (isVerified || isLoading) return;

      isLoading = true;
      turnstileMock.classList.add("is-loading");
      if (turnstileText) turnstileText.textContent = "Memverifikasi...";

      setTimeout(function () {
        isLoading = false;
        isVerified = true;
        turnstileMock.classList.remove("is-loading");
        turnstileMock.classList.add("is-verified");
        if (turnstileText) turnstileText.textContent = "Berhasil!";
        turnstileMock.setAttribute("aria-label", "Verifikasi berhasil");
        checkFormReady();
      }, 1200);
    }

    turnstileMock.addEventListener("click", triggerVerify);
    turnstileMock.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        triggerVerify();
      }
    });
  }

  /* ============================================================
     4. VALIDASI FORM — aktifkan tombol submit
     ============================================================ */
  const form = document.getElementById("form-presensi");
  const btnSubmit = document.getElementById("btn-submit-presensi");
  const hint = document.getElementById("presensi-submit-hint");

  /* Field wajib teks */
  const requiredInputs = [document.getElementById("nama-peserta"), document.getElementById("jabatan-presensi"), document.getElementById("instansi-presensi"), document.getElementById("unit-kerja")];

  /* Checkbox pernyataan */
  const checkboxPernyataan = document.getElementById("checkbox-pernyataan");

  function checkFormReady() {
    const allFilled = requiredInputs.every(function (el) {
      return el && el.value.trim().length >= (el.minLength > 0 ? el.minLength : 1);
    });

    const jenisOk = !!document.querySelector('input[name="jenis-peserta"]:checked');
    const tipeOk = !!document.querySelector('input[name="tipe-kehadiran"]:checked');
    const pernyataanOk = checkboxPernyataan ? checkboxPernyataan.checked : false;

    const ready = allFilled && jenisOk && tipeOk && hasSignature && pernyataanOk && isVerified;

    if (btnSubmit) {
      btnSubmit.disabled = !ready;
      btnSubmit.setAttribute("aria-disabled", String(!ready));
    }

    if (hint) {
      if (ready) {
        hint.textContent = "Semua data telah dilengkapi. Silakan kirim kehadiran Anda.";
      } else {
        const missing = [];
        if (!allFilled) missing.push("isi semua kolom wajib");
        if (!jenisOk) missing.push("pilih jenis peserta");
        if (!tipeOk) missing.push("pilih tipe kehadiran");
        if (!hasSignature) missing.push("tambahkan tanda tangan");
        if (!pernyataanOk) missing.push("centang pernyataan");
        if (!isVerified) missing.push("selesaikan verifikasi");
        hint.textContent = missing.length ? "Harap: " + missing.join(", ") + "." : "Lengkapi form untuk mengirim.";
      }
    }
  }

  /* Listen pada semua perubahan input */
  requiredInputs.forEach(function (el) {
    if (el) el.addEventListener("input", checkFormReady);
  });

  document.querySelectorAll('input[name="jenis-peserta"], input[name="tipe-kehadiran"]').forEach(function (el) {
    el.addEventListener("change", checkFormReady);
  });

  if (checkboxPernyataan) {
    checkboxPernyataan.addEventListener("change", checkFormReady);
  }

  // Cek awal
  checkFormReady();

  /* ============================================================
     5. SUBMIT FORM — Upload TTD ke Google Drive
     ============================================================ */

  /**
   * URL Google Apps Script Web App.
   * Script ini yang menangani upload TTD ke Google Drive.
   * Pastikan Apps Script sudah di-deploy dengan akses "Anyone".
   */
  var APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzXnuyvcNt6Z9NSoavRjKFIWSgK45-rweqNGYy2WneFn1-G4hu-OCqNsvgxaVyTYePQjg/exec";

  /** Reset form ke kondisi awal setelah submit berhasil */
  function resetForm() {
    form.reset();
    // Bersihkan canvas tanpa mengubah dimensi (agar layout tidak bergeser)
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "rgba(250, 192, 0, 0.29)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 2.8;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      placeholder && placeholder.classList.remove("hidden");
    }
    hasSignature = false;
    isVerified = false;
    isLoading = false;
    if (turnstileMock) {
      turnstileMock.classList.remove("is-verified", "is-loading");
      if (turnstileText) turnstileText.textContent = "Saya bukan robot";
      turnstileMock.setAttribute("aria-label", "Verifikasi: Saya bukan robot");
    }
    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.setAttribute("aria-disabled", "true");
      btnSubmit.innerHTML =
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<line x1="22" y1="2" x2="11" y2="13"/>' +
        '<polygon points="22 2 15 22 11 13 2 9 22 2"/>' +
        "</svg>" +
        " Kirim Kehadiran";
    }
    checkFormReady();
  }

  /**
   * Tampilkan halaman sukses penuh menggantikan konten form.
   * @param {string} nama  - Nama peserta
   * @param {string} kegiatan - Nama kegiatan
   * @param {string} waktu - Waktu presensi (ISO string)
   */
  function showSuccessPage(nama, kegiatan, waktu) {
    /* Sembunyikan elemen form utama */
    var formWrap = document.querySelector(".presensi-form-card") || document.querySelector(".form-card") || (form ? form.parentElement : null);

    /* Format waktu yang mudah dibaca */
    var tgl = new Date(waktu);
    var opsiTgl = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
    var opsiJam = { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false };
    var tglStr = tgl.toLocaleDateString("id-ID", opsiTgl);
    var jamStr = tgl.toLocaleTimeString("id-ID", opsiJam) + " WIB";

    /* Buat overlay sukses */
    var existing = document.getElementById("presensi-success-overlay");
    if (existing) existing.remove();

    /* Inject style animasi jika belum ada */
    if (!document.getElementById("presensi-success-style")) {
      var styleEl = document.createElement("style");
      styleEl.id = "presensi-success-style";
      styleEl.textContent = [
        "@keyframes successFadeIn{from{opacity:0;transform:translateY(32px)}to{opacity:1;transform:translateY(0)}}",
        "@keyframes successCheckPop{0%{transform:scale(0) rotate(-20deg);opacity:0}60%{transform:scale(1.2) rotate(4deg)}100%{transform:scale(1) rotate(0);opacity:1}}",
        "@keyframes successRingPulse{0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,0.4)}70%{box-shadow:0 0 0 18px rgba(34,197,94,0)}}",
        "@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}",
        "@keyframes fadeInUp{from{opacity:0;transform:translate(-50%,20px)}to{opacity:1;transform:translate(-50%,0)}}",
        ".presensi-success-overlay{animation:successFadeIn .5s cubic-bezier(.22,.68,0,1.2) both}",
        ".success-check-ring{animation:successRingPulse 1.8s ease-out 0.3s infinite}",
        ".success-check-icon{animation:successCheckPop .5s cubic-bezier(.22,.68,0,1.4) 0.15s both}",
      ].join("");
      document.head.appendChild(styleEl);
    }

    var overlay = document.createElement("div");
    overlay.id = "presensi-success-overlay";
    overlay.className = "presensi-success-overlay";
    overlay.setAttribute("role", "status");
    overlay.setAttribute("aria-live", "polite");
    overlay.style.cssText = ["display:flex", "flex-direction:column", "align-items:center", "justify-content:center", "text-align:center", "padding:48px 24px", "min-height:60vh"].join(";");

    overlay.innerHTML = [
      /* Ikon centang */
      '<div class="success-check-ring" style="width:96px;height:96px;border-radius:50%;background:linear-gradient(135deg,#22c55e,#16a34a);display:flex;align-items:center;justify-content:center;margin:0 auto 32px;">',
      '<svg class="success-check-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">',
      '<polyline points="20 6 9 17 4 12"/>',
      "</svg>",
      "</div>",

      /* Judul */
      '<h2 style="font-size:1.7rem;font-weight:700;color:#111;margin:0 0 8px;">Presensi Berhasil!</h2>',
      '<p style="font-size:1rem;color:#555;margin:0 0 32px;max-width:380px;line-height:1.6;">',
      "Kamu telah berhasil melakukan absensi pada kegiatan",
      "</p>",

      /* Card info kegiatan */
      '<div style="background:#fff;border:1.5px solid #e5e7eb;border-radius:16px;padding:24px 28px;max-width:420px;width:100%;box-shadow:0 4px 24px rgba(0,0,0,0.07);margin-bottom:32px;">',

      /* Nama kegiatan */
      '<div style="background:linear-gradient(135deg,#fef9c3,#fef08a);border-radius:10px;padding:12px 16px;margin-bottom:16px;">',
      '<p style="font-size:0.75rem;font-weight:600;color:#92400e;letter-spacing:.06em;text-transform:uppercase;margin:0 0 4px;">Nama Kegiatan</p>',
      '<p style="font-size:1.05rem;font-weight:700;color:#78350f;margin:0;" id="success-kegiatan-name">' + escHtml(kegiatan) + "</p>",
      "</div>",

      /* Baris info */
      '<div style="display:flex;flex-direction:column;gap:10px;">',

      /* Nama peserta */
      '<div style="display:flex;align-items:center;gap:10px;">',
      '<div style="width:36px;height:36px;border-radius:50%;background:#eff6ff;display:flex;align-items:center;justify-content:center;flex-shrink:0;">',
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
      "</div>",
      '<div style="text-align:left;">',
      '<p style="font-size:0.7rem;color:#888;margin:0;font-weight:500;">Nama Peserta</p>',
      '<p style="font-size:0.95rem;font-weight:600;color:#111;margin:0;">' + escHtml(nama) + "</p>",
      "</div>",
      "</div>",

      /* Tanggal */
      '<div style="display:flex;align-items:center;gap:10px;">',
      '<div style="width:36px;height:36px;border-radius:50%;background:#f0fdf4;display:flex;align-items:center;justify-content:center;flex-shrink:0;">',
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
      "</div>",
      '<div style="text-align:left;">',
      '<p style="font-size:0.7rem;color:#888;margin:0;font-weight:500;">Tanggal</p>',
      '<p style="font-size:0.95rem;font-weight:600;color:#111;margin:0;">' + tglStr + "</p>",
      "</div>",
      "</div>",

      /* Jam */
      '<div style="display:flex;align-items:center;gap:10px;">',
      '<div style="width:36px;height:36px;border-radius:50%;background:#fff7ed;display:flex;align-items:center;justify-content:center;flex-shrink:0;">',
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f97316" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
      "</div>",
      '<div style="text-align:left;">',
      '<p style="font-size:0.7rem;color:#888;margin:0;font-weight:500;">Waktu Presensi</p>',
      '<p style="font-size:0.95rem;font-weight:600;color:#111;margin:0;">' + jamStr + "</p>",
      "</div>",
      "</div>",

      "</div>",
      "</div>",

      /* Tombol kembali */
      '<a href="/" style="display:inline-flex;align-items:center;gap:8px;padding:12px 28px;background:linear-gradient(135deg,#fac000,#f59e0b);color:#fff;font-weight:700;font-size:0.95rem;border-radius:12px;text-decoration:none;box-shadow:0 4px 16px rgba(250,192,0,0.35);transition:transform .15s;">',
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>',
      "Kembali ke Daftar Kegiatan",
      "</a>",
    ].join("");

    /* Ganti seluruh konten <main> langsung — cara paling andal,
       tidak ada risiko elemen lama masih terlihat */
    var mainEl = document.getElementById("main-content") || document.querySelector("main");

    if (mainEl) {
      /* Kosongkan semua child dari main lalu sisipkan overlay */
      while (mainEl.firstChild) {
        mainEl.removeChild(mainEl.firstChild);
      }
      mainEl.appendChild(overlay);
    } else {
      /* Fallback jika main tidak ditemukan */
      document.body.innerHTML = "";
      document.body.appendChild(overlay);
    }

    /* Scroll ke atas */
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /** Helper: escape HTML untuk mencegah XSS */
  function escHtml(str) {
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /** Tampilkan notifikasi error */
  function showErrorMessage(msg) {
    var existing = document.getElementById("presensi-error-toast");
    if (existing) existing.remove();

    var toast = document.createElement("div");
    toast.id = "presensi-error-toast";
    toast.setAttribute("role", "alert");
    toast.style.cssText = [
      "position:fixed",
      "bottom:28px",
      "left:50%",
      "transform:translateX(-50%)",
      "background:linear-gradient(135deg,#ef4444,#dc2626)",
      "color:#fff",
      "padding:14px 28px",
      "border-radius:12px",
      "font-size:14px",
      "font-weight:600",
      "box-shadow:0 8px 30px rgba(239,68,68,0.35)",
      "z-index:9999",
      "display:flex",
      "align-items:center",
      "gap:10px",
      "max-width:90vw",
      "text-align:center",
    ].join(";");

    toast.innerHTML =
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="10"/>' +
      '<line x1="12" y1="8" x2="12" y2="12"/>' +
      '<line x1="12" y1="16" x2="12.01" y2="16"/>' +
      "</svg>" +
      "<span>" +
      msg +
      "</span>";

    document.body.appendChild(toast);
    setTimeout(function () {
      toast.style.opacity = "0";
      toast.style.transition = "opacity .4s";
      setTimeout(function () {
        toast.remove();
      }, 400);
    }, 7000);
  }

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();

      if (!hasSignature || !isVerified) return;

      /* Kumpulkan data form */
      var namaPeserta = (document.getElementById("nama-peserta") || {}).value || "";
      var kegiatanNama = titleEl ? titleEl.textContent.trim() : "";
      var tanggalHari = new Date().toISOString().split("T")[0]; // "2026-08-24"

      var formData = {
        action: "uploadTTD",
        signature: canvas ? canvas.toDataURL("image/png") : null,
        namaPeserta: namaPeserta,
        kegiatan: kegiatanNama,
        tanggal: tanggalHari,
        /* Data presensi lainnya (untuk keperluan logging di Apps Script) */
        lokasi: lokasiEl ? lokasiEl.textContent.trim() : "",
        jenisPeserta: (document.querySelector('input[name="jenis-peserta"]:checked') || {}).value || "",
        tipeKehadiran: (document.querySelector('input[name="tipe-kehadiran"]:checked') || {}).value || "",
        jabatan: (document.getElementById("jabatan-presensi") || {}).value || "",
        instansi: (document.getElementById("instansi-presensi") || {}).value || "",
        unitKerja: (document.getElementById("unit-kerja") || {}).value || "",
        nip: (document.getElementById("nip-presensi") || {}).value || "",
        whatsapp: (document.getElementById("whatsapp-presensi") || {}).value || "",
        email: (document.getElementById("email-presensi") || {}).value || "",
        waktu: new Date().toISOString(),
      };

      if (!formData.signature) {
        showErrorMessage("Gagal membaca tanda tangan. Coba lagi.");
        return;
      }

      console.log("[Presensi] Mengirim TTD ke Google Drive...", {
        nama: namaPeserta,
        kegiatan: kegiatanNama,
        tanggal: tanggalHari,
      });

      /* Tampilkan state loading */
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML =
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="animation:spin 1s linear infinite" aria-hidden="true">' +
          '<line x1="12" y1="2" x2="12" y2="6"/>' +
          '<line x1="12" y1="18" x2="12" y2="22"/>' +
          '<line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/>' +
          '<line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>' +
          '<line x1="2" y1="12" x2="6" y2="12"/>' +
          '<line x1="18" y1="12" x2="22" y2="12"/>' +
          '<line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/>' +
          '<line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>' +
          "</svg>" +
          " Mengupload TTD...";
      }
      if (hint) {
        hint.textContent = "Sedang mengupload tanda tangan ke Google Drive...";
      }

      /* Tambahkan style animasi spin jika belum ada */
      if (!document.getElementById("presensi-spin-style")) {
        var styleEl = document.createElement("style");
        styleEl.id = "presensi-spin-style";
        styleEl.textContent = "@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}} @keyframes fadeInUp{from{opacity:0;transform:translate(-50%,20px)}to{opacity:1;transform:translate(-50%,0)}}";
        document.head.appendChild(styleEl);
      }

      /* Kirim ke Google Apps Script via fetch */
      fetch(APPS_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain" }, // Apps Script butuh text/plain untuk CORS
        body: JSON.stringify(formData),
      })
        .then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.json();
        })
        .then(function (result) {
          if (result.success) {
            console.log("[Presensi] TTD berhasil diupload:", result.fileUrl);

            /* Tampilkan halaman sukses dengan info peserta & kegiatan */
            showSuccessPage(formData.namaPeserta, formData.kegiatan, formData.waktu);
          } else {
            throw new Error(result.error || "Upload gagal");
          }
        })
        .catch(function (err) {
          console.error("[Presensi] Error upload TTD:", err);
          showErrorMessage("Gagal mengupload tanda tangan: " + err.message + ". Coba lagi.");
          /* Kembalikan tombol submit agar bisa coba lagi */
          if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML =
              '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
              '<line x1="22" y1="2" x2="11" y2="13"/>' +
              '<polygon points="22 2 15 22 11 13 2 9 22 2"/>' +
              "</svg>" +
              " Kirim Kehadiran";
          }
          if (hint) {
            hint.textContent = "Terjadi kesalahan. Periksa koneksi dan coba kirim ulang.";
          }
        });
    });
  }
})();
