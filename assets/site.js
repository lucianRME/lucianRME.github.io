(() => {
  'use strict';
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.getElementById('site-navigation');
  if (toggle && nav) {
    document.documentElement.classList.add('js');
    toggle.hidden = false;
    const closeMenu = () => {
      toggle.setAttribute('aria-expanded', 'false');
      toggle.textContent = 'Menu';
      nav.classList.remove('is-open');
    };
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      toggle.textContent = open ? 'Close' : 'Menu';
      nav.classList.toggle('is-open', open);
    });
    nav.addEventListener('click', event => {
      if (event.target.closest('a')) closeMenu();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        closeMenu();
        toggle.focus();
      }
    });
    document.addEventListener('click', event => {
      if (!event.target.closest('.site-header')) closeMenu();
    });
    window.matchMedia('(max-width: 720px)').addEventListener('change', closeMenu);
  }
  document.querySelectorAll('[data-year]').forEach(element => {
    element.textContent = String(new Date().getFullYear());
  });
  // The privacy-page anchor is a working fallback when Zaraz is unavailable.
  document.querySelectorAll('[data-cookie-choices]').forEach(link => {
    link.addEventListener('click', event => {
      if (window.zaraz && typeof window.zaraz.showConsentModal === 'function') {
        event.preventDefault();
        window.zaraz.showConsentModal();
      }
    });
  });
})();
