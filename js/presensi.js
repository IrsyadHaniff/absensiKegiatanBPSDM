/**
 * presensi.js - Sistem Presensi Elektronik Pusbangkom
 * Halaman: Form Presensi (presensi.html)
 *
 * Fitur:
 * - Ambil nama & lokasi kegiatan dari URL query string
 * - Kanvas tanda tangan digital (mouse + layar sentuh)
 * - Upload tanda tangan ke Google Drive via Apps Script
 * - Cloudflare Turnstile (verifikasi token asli)
 * - Validasi form sebelum submit diaktifkan
 */

"use strict";

/* ──────────────────────────────────────────────
   URL Google Apps Script
   ────────────────────────────────────────────── */
var APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzXnuyvcNt6Z9NSoavRjKFIWSgK45-rweqNGYy2WneFn1-G4hu-OCqNsvgxaVyTYePQjg/exec";

(function () {
  /* ============================================================
     1. QUERY STRING - nama & lokasi dari URL
     ============================================================ */
  function getQueryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  const kegiatanName       = getQueryParam("kegiatan");
  const kegiatanLokasi     = getQueryParam("lokasi");
  const kegiatanTanggal    = getQueryParam("tanggal");    // format "yyyy-MM-dd"
  const kegiatanJam        = getQueryParam("jam");        // format "HH:MM"
  const kegiatanJamSelesai = getQueryParam("jamSelesai");
  const kegiatanStatus     = getQueryParam("status");     // "Sedang Berlangsung" | "Akan Datang" | "Selesai"

  const titleEl    = document.getElementById("kegiatan-title-presensi");
  const lokasiEl   = document.getElementById("kegiatan-lokasi-presensi");
  const tanggalEl  = document.getElementById("kegiatan-tanggal-presensi");
  const jamEl      = document.getElementById("kegiatan-jam-presensi");
  const jamWrap    = document.getElementById("kegiatan-jam-wrap");
  const badgeEl    = document.getElementById("kegiatan-status-badge");
  const statusTeks = document.getElementById("kegiatan-status-teks");

  if (titleEl  && kegiatanName)   titleEl.textContent  = decodeURIComponent(kegiatanName);
  if (lokasiEl && kegiatanLokasi) lokasiEl.textContent = decodeURIComponent(kegiatanLokasi);

  /* Tampilkan tanggal dalam format panjang: "Sabtu, 29 Agustus 2026" */
  if (tanggalEl && kegiatanTanggal) {
    var tgl = new Date(decodeURIComponent(kegiatanTanggal) + "T00:00:00");
    if (!isNaN(tgl)) {
      tanggalEl.textContent = tgl.toLocaleDateString("id-ID", {
        weekday: "long", day: "numeric", month: "long", year: "numeric"
      });
    }
  }

  /* Tampilkan jam: "13.00 – 14.00 WIB" atau sembunyikan jika kosong */
  if (jamEl) {
    var jam      = kegiatanJam        ? decodeURIComponent(kegiatanJam).replace(":", ".") : "";
    var jamSeles = kegiatanJamSelesai ? decodeURIComponent(kegiatanJamSelesai).replace(":", ".") : "";
    if (jam) {
      jamEl.textContent = jam + (jamSeles ? " – " + jamSeles : "") + " WIB";
    } else if (jamWrap) {
      jamWrap.style.display = "none"; // sembunyikan baris jam jika tidak ada data
    }
  }

  /* Tampilkan status badge sesuai nilai dari sheet/index
   * Nilai : "Sedang Berlangsung" | "Akan Datang" | "Selesai"
   */
  if (badgeEl && statusTeks && kegiatanStatus) {
    var statusAsli = decodeURIComponent(kegiatanStatus).trim();

    // Tentukan label teks, kelas CSS, dan apakah badge ditampilkan
    var labelMap = {
      "Sedang Berlangsung": { teks: "Sedang Berlangsung",  kelas: ""           },
      "Akan Datang":        { teks: "Akan Datang",         kelas: "--upcoming" },
      "Selesai":            { teks: "Kegiatan Telah Selesai", kelas: "--done"  }
    };

    var config = labelMap[statusAsli] || { teks: statusAsli, kelas: "" };

    // Hapus varian lama dulu, lalu pasang varian baru
    badgeEl.classList.remove("presensi-status-badge--upcoming", "presensi-status-badge--done");
    if (config.kelas) {
      badgeEl.classList.add("presensi-status-badge" + config.kelas);
    }

    statusTeks.textContent = config.teks;
  }

  /* ============================================================
     2. CLOUDFLARE TURNSTILE — explicit rendering (menghindari race condition)
     Cloudflare memanggil window.onloadTurnstileCallback setelah API siap.
     Lalu kita render widget secara manual dengan callbacks via closure,
     sehingga tidak ada risiko callback dipanggil sebelum variabel siap.
     ============================================================ */
  var turnstileToken = null;
  var isVerified     = false;

  /**
   * Dipanggil oleh Cloudflare API setelah scriptnya selesai dimuat.
   * Kita render widget di sini agar callbacks pasti sudah terdaftar.
   */
  window.onloadTurnstileCallback = function () {
    var container = document.getElementById("presensi-turnstile-widget");
    if (!container || !window.turnstile) return;

    window.turnstile.render(container, {
      sitekey : "0x4AAAAAAEZtRtiTrGMikxky",
      theme   : "light",

      /* Berhasil diverifikasi */
      callback: function (token) {
        turnstileToken = token;
        isVerified     = true;
        checkFormReady();
      },

      /* Error jaringan / challenge gagal */
      "error-callback": function () {
        turnstileToken = null;
        isVerified     = false;
        checkFormReady();
      },

      /* Token expired (>5 menit), widget auto-refresh */
      "expired-callback": function () {
        turnstileToken = null;
        isVerified     = false;
        checkFormReady();
      }
    });
  };

  /* ============================================================
     3. KANVAS TANDA TANGAN
     ============================================================ */
  var kanvasTandaTangan = (function () {
    var canvas      = document.getElementById("signature-canvas");
    var placeholder = document.getElementById("signature-placeholder");
    var btnHapus    = document.getElementById("btn-clear-signature");

    if (!canvas) return { sudahDiisi: function () { return false; }, ambilGambar: function () { return null; } };

    var ctx       = canvas.getContext("2d");
    var sedangMenulis = false;
    var adaGoresan    = false;

    /* Atur ukuran kanvas agar resolusinya tajam di layar HiDPI */
    function sesuaikanUkuranKanvas() {
      var rect   = canvas.getBoundingClientRect();
      var skala  = window.devicePixelRatio || 1;
      canvas.width  = rect.width  * skala;
      canvas.height = rect.height * skala;
      ctx.scale(skala, skala);
      ctx.strokeStyle = "#111827";
      ctx.lineWidth   = 2.2;
      ctx.lineCap     = "round";
      ctx.lineJoin    = "round";
    }
    sesuaikanUkuranKanvas();

    /* Ubah koordinat event menjadi posisi relatif terhadap kanvas */
    function posisiDiKanvas(event) {
      var rect = canvas.getBoundingClientRect();
      var sumber = event.touches ? event.touches[0] : event;
      return {
        x: sumber.clientX - rect.left,
        y: sumber.clientY - rect.top
      };
    }

    function mulaiMenulis(event) {
      event.preventDefault();
      sedangMenulis = true;
      var pos = posisiDiKanvas(event);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    }

    function lanjutMenulis(event) {
      if (!sedangMenulis) return;
      event.preventDefault();
      var pos = posisiDiKanvas(event);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();

      if (!adaGoresan) {
        adaGoresan = true;
        if (placeholder) placeholder.style.display = "none";
        checkFormReady();
      }
    }

    function selesaiMenulis() {
      sedangMenulis = false;
    }

    /* Event mouse */
    canvas.addEventListener("mousedown",  mulaiMenulis);
    canvas.addEventListener("mousemove",  lanjutMenulis);
    canvas.addEventListener("mouseup",    selesaiMenulis);
    canvas.addEventListener("mouseleave", selesaiMenulis);

    /* Event sentuh (mobile) */
    canvas.addEventListener("touchstart", mulaiMenulis,  { passive: false });
    canvas.addEventListener("touchmove",  lanjutMenulis, { passive: false });
    canvas.addEventListener("touchend",   selesaiMenulis);

    /* Tombol Hapus */
    if (btnHapus) {
      btnHapus.addEventListener("click", function () {
        var rect  = canvas.getBoundingClientRect();
        ctx.clearRect(0, 0, rect.width, rect.height);
        adaGoresan = false;
        if (placeholder) placeholder.style.display = "";
        checkFormReady();
      });
    }

    return {
      /** Kembalikan true jika peserta sudah menggambar tanda tangan */
      sudahDiisi: function () { return adaGoresan; },

      /** Kembalikan gambar tanda tangan sebagai string base64 PNG */
      ambilGambar: function () {
        return adaGoresan ? canvas.toDataURL("image/png") : null;
      }
    };
  })();

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
    const tandaTanganOk = kanvasTandaTangan.sudahDiisi();

    const ready = allFilled && jenisOk && tipeOk && pernyataanOk && isVerified && tandaTanganOk;

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
        if (!tandaTanganOk) missing.push("buat tanda tangan");
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
   * @param {string} waktu - Waktu presensi
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

    /* Ganti seluruh konten <main> langsung */
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

  /* ============================================================
     5. SUBMIT — upload tanda tangan ke Drive, lalu tampil sukses
     ============================================================ */
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();

      if (!isVerified || !kanvasTandaTangan.sudahDiisi()) return;

      var gambarTandaTangan = kanvasTandaTangan.ambilGambar();
      var namaPeserta  = (document.getElementById("nama-peserta")  || {}).value || "";
      var kegiatanNama = titleEl ? titleEl.textContent.trim() : "";
      var tanggalHari  = new Date().toISOString().slice(0, 10); // "yyyy-MM-dd"

      /* Tampilkan status loading pada tombol */
      tampilkanStatusLoading(btnSubmit, true);

      /* Validasi token Turnstile di server (Apps Script) sebelum menyimpan data */
      fetch(APPS_SCRIPT_URL, {
        method  : "POST",
        redirect: "follow",
        body    : JSON.stringify({
          action         : "verifyTurnstile",
          turnstileToken : turnstileToken
        })
      })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (json) {
        if (!json.success) throw new Error("Verifikasi Turnstile gagal: " + (json.error || ""));

        /* Token valid — lanjut upload tanda tangan */
        return kirimTandaTangan({
          signature  : gambarTandaTangan,
          namaPeserta: namaPeserta,
          kegiatan   : kegiatanNama,
          tanggal    : tanggalHari
        });
      })
      .then(function (hasil) {
        tampilkanStatusLoading(btnSubmit, false);
        showSuccessPage(namaPeserta, kegiatanNama, new Date().toISOString());
      })
      .catch(function (err) {
        tampilkanStatusLoading(btnSubmit, false);
        var pesanError = String(err.message || err);
        if (pesanError.indexOf("Turnstile") !== -1) {
          showErrorMessage("Verifikasi keamanan gagal. Muat ulang halaman dan coba lagi.");
          /* Reset widget Turnstile agar user bisa coba ulang */
          if (window.turnstile) window.turnstile.reset();
          isVerified     = false;
          turnstileToken = null;
          checkFormReady();
        } else {
          showErrorMessage("Gagal mengirim tanda tangan. Silakan coba lagi.");
        }
      });
    });
  }

  /**
   * Kirim tanda tangan (base64) ke Apps Script untuk disimpan di Drive.
   * @param {Object} data  - { signature, namaPeserta, kegiatan, tanggal }
   * @returns {Promise}    - resolve dengan respons JSON dari server
   */
  function kirimTandaTangan(data) {
    return fetch(APPS_SCRIPT_URL, {
      method  : "POST",
      redirect: "follow",          // otomatis dari Apps Script
      body    : JSON.stringify({
        action     : "uploadTTD",
        signature  : data.signature,
        namaPeserta: data.namaPeserta,
        kegiatan   : data.kegiatan,
        tanggal    : data.tanggal
      })
    })
    .then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then(function (json) {
      if (!json.success) throw new Error(json.error || "Upload gagal");
      return json;
    });
  }

  /**
   * Ubah tampilan tombol submit saat loading / selesai.
   * @param {HTMLElement} tombol  - elemen tombol
   * @param {boolean}     loading - true = sedang loading
   */
  function tampilkanStatusLoading(tombol, loading) {
    if (!tombol) return;
    tombol.disabled = loading;
    tombol.setAttribute("aria-disabled", String(loading));
    tombol.innerHTML = loading
      ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="animation:spin .8s linear infinite"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> Mengirim...'
      : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Kirim Kehadiran';
  }
})();
