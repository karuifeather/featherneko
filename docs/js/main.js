/**
 * FeatherNeko Landing Page — Scroll reveal and navigation
 */

(function () {
  'use strict';

  // Section reveal on scroll
  const reveals = document.querySelectorAll('.reveal');
  const options = {
    root: null,
    rootMargin: '0px 0px 0px 0px',
    threshold: 0,
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, options);

  reveals.forEach((el) => observer.observe(el));

  // Fallback: if page loads with hash (e.g. #screens), section may be in view before observer fires
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      reveals.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const vh = window.innerHeight;
        if (rect.top < vh - 80 && rect.bottom > 80) el.classList.add('visible');
      });
    });
  });

  // Smooth scroll for anchor links + close mobile drawer when nav link clicked
  const navToggle = document.getElementById('nav-toggle');
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (href === '#') return;
      e.preventDefault();
      const target = document.querySelector(href);
      if (target) target.scrollIntoView({ behavior: 'smooth' });
      if (navToggle && navToggle.checked) navToggle.checked = false;
    });
  });

  // Close drawer when any nav link is clicked (for hash or same-page links)
  document.querySelectorAll('.nav__links a').forEach((link) => {
    link.addEventListener('click', () => {
      if (navToggle && navToggle.checked) navToggle.checked = false;
    });
  });

})();
