/**
 * index.js — Sistem Presensi Elektronik Pusbangkom
 * Halaman: Daftar Kegiatan (index.html)
 *
 * Logika kategorisasi kegiatan:
 *
 *  NOW = waktu saat ini
 *  GRACE = 24 jam setelah jamSelesai kegiatan
 *
 *  ┌─────────────────────────────────────────────────────────────┐
 *  │ "Kegiatan Hari Ini"                                         │
 *  │   Kegiatan yang tanggalnya = hari ini DAN belum melewati    │
 *  │   jamSelesai (atau belum ada jamSelesai).                    │
 *  │   Tombol presensi & konfirmasi aktif.                        │
 *  ├─────────────────────────────────────────────────────────────┤
 *  │ "Kegiatan Akan Datang"                                      │
 *  │   Kegiatan dengan tanggal > hari ini.                        │
 *  │   Tombol presensi & konfirmasi TIDAK ditampilkan.            │
 *  ├─────────────────────────────────────────────────────────────┤
 *  │ "Kegiatan Lainnya"                                          │
 *  │   Kegiatan yang sudah melewati jamSelesai (termasuk         │
 *  │   kegiatan hari ini yang sudah selesai), TAPI masih dalam   │
 *  │   grace period 24 jam → tombol presensi & konfirmasi masih  │
 *  │   aktif.                                                     │
 *  │   Setelah grace period habis → tombol tidak ditampilkan.    │
 *  └─────────────────────────────────────────────────────────────┘
 */

'use strict';

/* ============================================================
   KONFIGURASI
   ============================================================ */
const SPREADSHEET_URL =
  'https://script.google.com/macros/s/AKfycbzXnuyvcNt6Z9NSoavRjKFIWSgK45-rweqNGYy2WneFn1-G4hu-OCqNsvgxaVyTYePQjg/exec';

const FETCH_TIMEOUT  = 15000; // ms
const GRACE_PERIOD_MS = 24 * 60 * 60 * 1000; // 24 jam dalam milidetik

/* ============================================================
   UTILITIES
   ============================================================ */

/** "2026-08-22" → Date object tengah malam lokal */
function parseDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  return isNaN(d) ? null : d;
}

/**
 * Gabungkan tanggal + jam menjadi Date object.
 * jam bisa "08:00" atau kosong.
 * Jika jam kosong → kembalikan tengah malam tanggal tersebut.
 */
function parseDateTime(dateStr, jamStr) {
  if (!dateStr) return null;
  const base = jamStr ? `${dateStr}T${jamStr}:00` : `${dateStr}T00:00:00`;
  const d = new Date(base);
  return isNaN(d) ? parseDate(dateStr) : d;
}

/** Format tanggal panjang: "Jumat, 22 Agustus 2026" */
function formatTanggalPanjang(dateStr) {
  const d = parseDate(dateStr);
  if (!d) return dateStr || '-';
  return d.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Format jam "08:00" → "08.00" */
function formatJam(jam) {
  return jam ? jam.replace(':', '.') : '';
}

/** Escape HTML */
function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Encode URL parameter */
function enc(str) {
  return encodeURIComponent(str || '');
}

/** Apakah dateStr adalah hari ini? */
function isToday(dateStr) {
  const d = parseDate(dateStr);
  if (!d) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth()    === now.getMonth()    &&
    d.getDate()     === now.getDate()
  );
}

/** Apakah tanggal sudah lewat dari hari ini? */
function isPastDate(dateStr) {
  const d = parseDate(dateStr);
  if (!d) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

/** Apakah tanggal di masa depan (bukan hari ini)? */
function isFutureDate(dateStr) {
  const d = parseDate(dateStr);
  if (!d) return false;
  const tomorrow = new Date();
  tomorrow.setHours(0, 0, 0, 0);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return d >= tomorrow;
}

/**
 * Apakah kegiatan sudah melewati jam selesainya?
 * Jika tidak ada jamSelesai, anggap belum selesai (sepanjang hari).
 */
function isPastEndTime(dateStr, jamSelesai) {
  if (!jamSelesai) return false; // tidak ada jam selesai → belum selesai
  const endDt = parseDateTime(dateStr, jamSelesai);
  if (!endDt) return false;
  return new Date() > endDt;
}

/**
 * Apakah masih dalam grace period (24 jam setelah jam selesai)?
 * Kembali true jika NOW < (jamSelesai + 24 jam).
 */
function isInGracePeriod(dateStr, jamSelesai) {
  // Jika tidak ada jamSelesai: gunakan akhir hari (23:59) sebagai baseline
  const endDt = jamSelesai
    ? parseDateTime(dateStr, jamSelesai)
    : parseDateTime(dateStr, '23:59');
  if (!endDt) return false;
  const graceEnd = new Date(endDt.getTime() + GRACE_PERIOD_MS);
  return new Date() <= graceEnd;
}

/** Fetch dengan timeout */
async function fetchWithTimeout(url, ms) {
  const ctrl = new AbortController();
  const tid  = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(tid);
    return res;
  } catch (err) {
    clearTimeout(tid);
    throw err;
  }
}

/* ============================================================
   DERIVE STATUS OTOMATIS BERDASARKAN WAKTU NYATA
   ============================================================
   Override status dari spreadsheet dengan kalkulasi real-time:
   - Belum mulai (now < jamMulai)        → "Akan Datang"
   - Sedang berjalan (jamMulai ≤ now ≤ jamSelesai) → "Sedang Berlangsung"
   - Sudah lewat (now > jamSelesai)      → "Selesai"
   ============================================================ */
function deriveStatus(dateStr, jam, jamSelesai) {
  const now = new Date();

  // Jika tanggal belum tiba sama sekali
  if (isFutureDate(dateStr)) return 'Akan Datang';

  // Jika tanggal sudah lewat (kemarin atau lebih lama)
  if (isPastDate(dateStr)) return 'Selesai';

  // Tanggal = hari ini, cek jam
  const startDt = jam      ? parseDateTime(dateStr, jam)       : null;
  const endDt   = jamSelesai ? parseDateTime(dateStr, jamSelesai) : null;

  if (endDt && now > endDt)   return 'Selesai';
  if (startDt && now < startDt) return 'Akan Datang';

  // now >= startDt dan (endDt null atau now <= endDt)
  return 'Sedang Berlangsung';
}

  //  Setiap kegiatan masuk ke tepat satu bucket:

  //  todayActive  → Hari Ini: tanggal = hari ini DAN belum lewat jam selesai
  //  todayPast    → Lainnya:  tanggal = hari ini TAPI sudah lewat jam selesai
  //                           (masuk "Lainnya" tapi masih grace period)
  //  upcoming     → Akan Datang: tanggal > hari ini
  //  past         → Lainnya: tanggal < hari ini
  //                           (bisa masih grace period atau sudah habis)
function kategorikan(kegiatan) {
  const todayActive = [];
  const upcoming    = [];
  const others      = []; // sudah lewat / hari ini tapi jam sudah habis

  for (const k of kegiatan) {
    if (isFutureDate(k.tanggal)) {
      // Tanggal besok atau setelahnya → Akan Datang
      upcoming.push(k);
    } else if (isToday(k.tanggal)) {
      if (isPastEndTime(k.tanggal, k.jamSelesai)) {
        // Hari ini tapi jam sudah lewat → Lainnya (grace period)
        others.push(k);
      } else {
        // Hari ini dan belum selesai → Kegiatan Hari Ini
        todayActive.push(k);
      }
    } else {
      // Tanggal sudah lewat → Lainnya
      others.push(k);
    }
  }

  // Sort masing-masing
  const byJam  = (a, b) => (a.jam || '').localeCompare(b.jam || '');
  const byDate = (a, b) => {
    const t = (a.tanggal || '').localeCompare(b.tanggal || '');
    return t !== 0 ? t : byJam(a, b);
  };
  const byDateDesc = (a, b) => -byDate(a, b); // terbaru dulu di "Lainnya"

  todayActive.sort(byJam);
  upcoming.sort(byDate);
  others.sort(byDateDesc);

  return { todayActive, upcoming, others };
}

/* ============================================================
   FETCH DATA
   ============================================================ */
async function fetchKegiatan() {
  const elLoading      = document.getElementById('today-loading');
  const elError        = document.getElementById('fetch-error');
  const secToday       = document.getElementById('today-section');
  const elTodayList    = document.getElementById('today-list');
  const elTodayEmpty   = document.getElementById('today-empty');
  const secUpcoming    = document.getElementById('upcoming-section');
  const elUpcomingList = document.getElementById('upcoming-list');
  const secOther       = document.getElementById('other-section');
  const elOtherList    = document.getElementById('other-list');

  // Reset state
  show(elLoading);
  hide(elError);
  hide(secToday);
  hide(secUpcoming);
  hide(secOther);

  try {
    const url = `${SPREADSHEET_URL}?t=${Date.now()}`;
    const res = await fetchWithTimeout(url, FETCH_TIMEOUT);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data     = await res.json();
    const kegiatan = (data.kegiatan || [])
      .filter(k => k.nama && k.nama.trim() !== '')
      .map(k => ({
        ...k,
        // Override status dengan kalkulasi real-time
        status: deriveStatus(k.tanggal, k.jam, k.jamSelesai),
      }));

    const { todayActive, upcoming, others } = kategorikan(kegiatan);

    // --- Section 1: Hari Ini ---
    show(secToday);
    if (todayActive.length === 0) {
      show(elTodayEmpty);
      hide(elTodayList);
    } else {
      hide(elTodayEmpty);
      show(elTodayList);
      renderKegiatanList(elTodayList, todayActive, 'today');
    }

    // --- Section 2: Akan Datang ---
    if (upcoming.length > 0) {
      show(secUpcoming);
      renderKegiatanList(elUpcomingList, upcoming, 'upcoming');
    }

    // --- Section 3: Lainnya ---
    if (others.length > 0) {
      show(secOther);
      renderKegiatanList(elOtherList, others, 'other');
    }

  } catch (err) {
    console.error('[fetchKegiatan]', err);
    show(elError);
  } finally {
    hide(elLoading);
  }
}

/* ============================================================
   RENDER KARTU
   ============================================================ */
/**
 * type: 'today' | 'upcoming' | 'other'
 *
 * Tombol aksi:
 *  - today    → selalu tampilkan presensi + konfirmasi
 *  - upcoming → tidak tampilkan tombol
 *  - other    → tampilkan hanya jika masih grace period
 */
function renderKegiatanList(container, list, type) {
  if (!container) return;

  container.innerHTML = list.map((k, i) => {
    const jamStr = k.jam
      ? `${formatJam(k.jam)}${k.jamSelesai ? ' – ' + formatJam(k.jamSelesai) : ''} WIB`
      : '';

    const isFeatured  = type === 'today';
    const cardClass   = isFeatured
      ? 'activity-card activity-card-featured animate-fade-up'
      : 'activity-card animate-fade-up';

    // Apakah tombol aksi ditampilkan?
    let showActions = false;
    if (type === 'today') {
      showActions = true;
    } else if (type === 'other') {
      showActions = isInGracePeriod(k.tanggal, k.jamSelesai);
    }
    // type 'upcoming' → showActions tetap false

    const qNama   = enc(k.nama);
    const qLokasi = enc(k.lokasi);

    // Label grace period (untuk "other" yang masih bisa presensi)
    const graceLabel = (type === 'other' && showActions)
      ? `<div class="activity-grace-notice" role="note">
           <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
           Presensi masih tersedia hingga 24 jam setelah kegiatan selesai
         </div>`
      : '';

    const actionsHtml = showActions
      ? `<div class="activity-card-actions">
           ${graceLabel}
           <div class="activity-card-btns">
             <a href="presensi.html?kegiatan=${qNama}&lokasi=${qLokasi}"
                class="btn btn-gold btn-sm"
                aria-label="Isi presensi untuk ${esc(k.nama)}">
               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                 <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                 <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
               </svg>
               Isi Presensi
             </a>
             <a href="konfirmasi.html?kegiatan=${qNama}&lokasi=${qLokasi}"
                class="btn btn-outline-dark btn-sm"
                aria-label="Konfirmasi kehadiran untuk ${esc(k.nama)}">
               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                 <polyline points="20 6 9 17 4 12"/>
               </svg>
               Konfirmasi Hadir
             </a>
           </div>
         </div>`
      : (type === 'upcoming'
          ? `<div class="activity-card-actions">
               <span class="activity-card-upcoming-label">
                 <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                   <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                   <line x1="16" y1="2" x2="16" y2="6"/>
                   <line x1="8" y1="2" x2="8" y2="6"/>
                   <line x1="3" y1="10" x2="21" y2="10"/>
                 </svg>
                 Presensi belum dibuka
               </span>
             </div>`
          : `<div class="activity-card-actions">
               <span class="activity-card-done">
                 <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                   <polyline points="20 6 9 17 4 12"/>
                 </svg>
                 Presensi sudah ditutup
               </span>
             </div>`
        );

    return `
      <li class="${cardClass}" role="article" style="animation-delay:${i * 0.07}s">
        <div class="activity-card-icon" aria-hidden="true">
          ${getStatusIcon(k.status, type)}
        </div>
        <div class="activity-card-body">
          <div class="activity-card-header-row">
            <h2 class="activity-card-name">${esc(k.nama)}</h2>
            ${renderStatusBadge(k.status)}
          </div>
          <div class="activity-card-meta" role="list">
            <div class="activity-card-meta-item" role="listitem">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <span>${formatTanggalPanjang(k.tanggal)}</span>
            </div>
            ${jamStr ? `
            <div class="activity-card-meta-item" role="listitem">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
              <span>${esc(jamStr)}</span>
            </div>` : ''}
            ${k.lokasi ? `
            <div class="activity-card-meta-item" role="listitem">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              <span>${esc(k.lokasi)}</span>
            </div>` : ''}
          </div>
          ${actionsHtml}
        </div>
      </li>`;
  }).join('');

  // Re-init animation observer untuk elemen yang baru dirender
  initAnimationObserver(container.querySelectorAll('.animate-fade-up'));
}

/* ============================================================
   BADGE & ICON
   ============================================================ */
function renderStatusBadge(status) {
  const map = {
    'Sedang Berlangsung': ['badge-status badge-berlangsung', 'Sedang Berlangsung'],
    'Akan Datang':        ['badge-status badge-datang',      'Akan Datang'],
    'Selesai':            ['badge-status badge-selesai',     'Selesai'],
  };
  const [cls, label] = map[status] || ['badge-status badge-default', status || ''];
  return `<span class="${cls}">${esc(label)}</span>`;
}

function getStatusIcon(status, type) {
  if (type === 'upcoming') {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>`;
  }
  if (status === 'Selesai' || type === 'other') {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>`;
  }
  // Sedang berlangsung / hari ini
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>`;
}

/* ============================================================
   DOM HELPERS
   ============================================================ */
function show(el) { if (el) el.style.display = ''; }
function hide(el) { if (el) el.style.display = 'none'; }

/* ============================================================
   INTERSECTION OBSERVER — animate on scroll
   ============================================================ */
function initAnimationObserver(elements) {
  if (!('IntersectionObserver' in window)) return;
  const obs = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.style.animationPlayState = 'running';
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
  );
  elements.forEach((el) => {
    el.style.animationPlayState = 'paused';
    obs.observe(el);
  });
}

/* ============================================================
   REALTIME CLOCK
   ============================================================ */
function initClock() {
  updateClock();
  setInterval(updateClock, 1000);
}

function updateClock() {
  const now     = new Date();
  const elTime  = document.getElementById('header-time');
  const elDate  = document.getElementById('header-date');

  if (elTime) {
    elTime.textContent = now.toLocaleTimeString('id-ID', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  }

  if (elDate) {
    const days   = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
    const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des'];
    elDate.textContent = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
  }
}

/* ============================================================
   STICKY HEADER
   ============================================================ */
function initStickyHeader() {
  const header = document.querySelector('.site-header');
  if (!header) return;
  window.addEventListener('scroll', () => {
    header.style.boxShadow = window.scrollY > 8
      ? '0 4px 24px rgba(0,0,0,0.12)'
      : '0 2px 12px rgba(0,0,0,0.06)';
  }, { passive: true });
}

/* ============================================================
   LOGIN BUTTON (placeholder)
   ============================================================ */
function initLoginButton() {
  const btn = document.getElementById('btn-login');
  if (!btn) return;
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    alert('Fitur login belum tersedia.');
  });
}

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  initClock();
  initStickyHeader();
  initLoginButton();
  document.querySelectorAll('.badge-dot').forEach(d => d.setAttribute('aria-hidden', 'true'));
  fetchKegiatan();
});

window.fetchKegiatan = fetchKegiatan;
