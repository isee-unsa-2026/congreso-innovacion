// Interacciones minimas del sitio. Sin dependencias.
// El revelado al hacer scroll se desactiva con prefers-reduced-motion. Solo transform/opacity.
const root = document.documentElement;
const mq = window.matchMedia('(prefers-reduced-motion: reduce)');

// Si el navegador ya pinto la pagina antes de que corra este script, lo que esta a la vista
// se deja visible (sin ocultar y volver a mostrar). El resto entra al hacer scroll.
(function marcarVisibles() {
  let pintado = false;
  try { pintado = performance.getEntriesByType('paint').length > 0; } catch (_) { /* sin Paint Timing */ }
  if (!pintado) return;
  const alto = window.innerHeight;
  document.querySelectorAll('[data-reveal]').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.top < alto && r.bottom > 0) el.classList.add('is-in', 'is-quieto');
  });
})();
root.classList.add('js');

/* ---------- Revelado suave al hacer scroll ---------- */
function initReveal() {
  const els = [...document.querySelectorAll('[data-reveal]:not(.is-in)')];
  if (!els.length) return;
  els.forEach((el) => el.style.setProperty('--rd', el.dataset.revealDelay || '0'));
  if (mq.matches || !('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    });
  }, { rootMargin: '0px 0px -6% 0px', threshold: 0.05 });
  els.forEach((el) => io.observe(el));
}

/* ---------- Menu movil ---------- */
function initMenu() {
  const cab = document.querySelector('[data-cab]');
  if (!cab) return;
  const btn = cab.querySelector('[data-menu-btn]');
  const nav = cab.querySelector('[data-menu]');
  if (!btn || !nav) return;
  const set = (open) => {
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    cab.classList.toggle('cab--abierto', open);
  };
  btn.addEventListener('click', () => set(btn.getAttribute('aria-expanded') !== 'true'));
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') { set(false); btn.focus(); }
  });
}

function init() { initMenu(); initReveal(); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
