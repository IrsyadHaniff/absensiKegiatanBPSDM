/**
 * presensi.js - Sistem Presensi Elektronik Pusbangkom
 * Halaman: Form Presensi (presensi.html)
 *
 * Fitur:
 * - Ambil nama & lokasi kegiatan dari URL query string
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
     2. TURNSTILE MOCK — simulasi UX verifikasi Cloudflare
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

    const ready = allFilled && jenisOk && tipeOk && pernyataanOk && isVerified;

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
     4. SUBMIT FORM — langsung tampil halaman sukses
     ============================================================ */

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

      if (!isVerified) return;

      /* Kumpulkan data yang dibutuhkan untuk halaman sukses */
      var namaPeserta = (document.getElementById("nama-peserta") || {}).value || "";
      var kegiatanNama = titleEl ? titleEl.textContent.trim() : "";
      var waktu = new Date().toISOString();

      console.log("[Presensi] Submit berhasil:", {
        nama: namaPeserta,
        kegiatan: kegiatanNama,
        waktu: waktu,
      });

      /* Langsung tampilkan halaman sukses */
      showSuccessPage(namaPeserta, kegiatanNama, waktu);
    });
  }
})();
