/**
 * index.js — Sistem Presensi Elektronik Biro ORTALAMR
 * Halaman: Daftar Kegiatan (index.html)
 *
 * TODO: inisialisasi Firebase App & Auth di sini saat backend siap
 * import { initializeApp } from "firebase/app";
 * import { getAuth, onAuthStateChanged } from "firebase/auth";
 */

'use strict';

(function () {
  /* ============================================================
     INTERSECTION OBSERVER — Animate on scroll
     Tambahkan class 'is-visible' saat elemen masuk viewport
     ============================================================ */
  const animatedElements = document.querySelectorAll(
    '.animate-fade-up, .activity-card'
  );

  if ('IntersectionObserver' in window) {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -40px 0px',
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.style.animationPlayState = 'running';
          observer.unobserve(entry.target);
        }
      });
    }, observerOptions);

    animatedElements.forEach((el) => {
      // Pause animation until element is in viewport
      el.style.animationPlayState = 'paused';
      observer.observe(el);
    });
  }

  /* ============================================================
     STICKY HEADER — shadow on scroll
     ============================================================ */
  const header = document.querySelector('.site-header');

  if (header) {
    const scrollHandler = () => {
      if (window.scrollY > 8) {
        header.style.boxShadow = '0 4px 24px rgba(0,0,0,0.12)';
      } else {
        header.style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)';
      }
    };

    window.addEventListener('scroll', scrollHandler, { passive: true });
  }

  /* ============================================================
     CARD HOVER — micro animation feedback
     ============================================================ */
  const cards = document.querySelectorAll('.activity-card');

  cards.forEach((card) => {
    card.addEventListener('mouseenter', () => {
      card.style.willChange = 'transform, box-shadow';
    });
    card.addEventListener('mouseleave', () => {
      card.style.willChange = 'auto';
    });
  });

  /* ============================================================
     LOGIN BUTTON — placeholder (TODO: Firebase Auth)
     ============================================================ */
  const btnLogin = document.getElementById('btn-login');

  if (btnLogin) {
    btnLogin.addEventListener('click', (e) => {
      e.preventDefault();
      // TODO: Implementasi Firebase Auth (Google Sign-In / SSO)
      // import { getAuth, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
      // const provider = new GoogleAuthProvider();
      // signInWithPopup(auth, provider).then(...).catch(...);
      alert(
        'Untuk saat ini, masih UI doang.'
      );
    });
  }

  /* ============================================================
     BADGE DOT — pulse animation sudah via CSS,
     pastikan accessibility: announce ke screen reader jika ada notifikasi baru
     ============================================================ */
  const badgeDots = document.querySelectorAll('.badge-dot');
  badgeDots.forEach((dot) => {
    dot.setAttribute('aria-hidden', 'true'); // dekoratif
  });

})();
