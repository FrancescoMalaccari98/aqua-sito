/* Aqua — the site's navigation menu (the full-screen one), shared by every page that has it
   index.html: opened by the burger in the header (phones and tablets).
   carta.html, food.html: opened by "Il sito" at the top, on any screen, without leaving the menu.
   Any [data-menu-toggle] button opens or closes it; window.AquaMenu.open() / .close() also work. */
(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const menu = $('#mobile-menu');
  if (!menu) return;
  const toggles = $$('[data-menu-toggle]');
  const header = $('.site-header');
  // On the home the header has the navigation on wide screens, so the menu is only for small ones;
  // on the menu pages it is the only way to reach the site's sections, so it works everywhere
  const everywhere = menu.hasAttribute('data-menu-everywhere');

  /* ---------- "La carta": opens its categories inside the menu ---------- */
  const cartaToggle = $('[data-carta-toggle]', menu);
  const cartaSub = cartaToggle && document.getElementById(cartaToggle.getAttribute('aria-controls'));
  const setCartaOpen = (open) => {
    if (!cartaSub) return;
    cartaToggle.setAttribute('aria-expanded', String(open));
    cartaToggle.parentElement.classList.toggle('is-expanded', open);
    cartaSub.hidden = !open;
  };
  if (cartaToggle) {
    cartaToggle.addEventListener('click', (e) => {
      if (!cartaSub || !cartaSub.children.length) return; // categories not loaded: plain link to the menu
      e.preventDefault();
      setCartaOpen(cartaSub.hidden);
    });
  }

  /* ---------- Open / close ---------- */
  let lastFocus = null;
  const isOpen = () => document.body.classList.contains('menu-open');
  const setMenu = (open) => {
    toggles.forEach((t) => {
      t.setAttribute('aria-expanded', String(open));
      if (t.dataset.menuToggle !== 'close') t.setAttribute('aria-label', open ? 'Chiudi il menu' : (t.dataset.labelOpen || 'Apri il menu'));
    });
    document.body.classList.toggle('menu-open', open);
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) {
      lastFocus = document.activeElement;
      menu.hidden = false;
      if (header) header.classList.remove('is-hidden');
      requestAnimationFrame(() => requestAnimationFrame(() => menu.classList.add('is-open')));
      setTimeout(() => { const first = $('.mobile-menu__list a', menu); if (first) first.focus({ preventScroll: true }); }, 350);
    } else {
      menu.classList.remove('is-open');
      setCartaOpen(false);
      setTimeout(() => { if (!menu.classList.contains('is-open')) menu.hidden = true; }, 500);
    }
  };
  toggles.forEach((t) => t.addEventListener('click', () => {
    const open = t.dataset.menuToggle === 'close' ? false : !isOpen();
    setMenu(open);
    if (!open && lastFocus && lastFocus !== document.body) lastFocus.focus({ preventScroll: true });
  }));

  /* ---------- Links ----------
     Any link closes the menu, except "La carta" (it opens its categories).
     A link to a section of the page already open (e.g. carta.html#vini while on the carta) does not
     reload it: the page is told to show that section ("aqua:section" event, handled by carta.js). */
  menu.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a || a.matches('[data-carta-toggle]')) return;
    setMenu(false);
    const url = new URL(a.href, location.href);
    const samePage = url.origin === location.origin && url.pathname === location.pathname;
    if (!samePage || a.getAttribute('href').startsWith('#')) return; // other pages, and the home's own #links
    e.preventDefault();
    const id = decodeURIComponent(url.hash.slice(1));
    if (id) window.dispatchEvent(new CustomEvent('aqua:section', { detail: id }));
    else window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !isOpen()) return;
    setMenu(false);
    if (lastFocus && lastFocus !== document.body) lastFocus.focus({ preventScroll: true });
  });
  if (!everywhere) {
    window.matchMedia('(min-width: 1025px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });
  }

  window.AquaMenu = { open: () => setMenu(true), close: () => setMenu(false) };

  /* ---------- "La carta" categories ----------
     Read from data/menu.properties, so they always match the menu (only categories with items).
     Inside this menu the list ends with "Tutta la carta"; in the home's header (computers)
     the same list appears under "La carta" on hover or keyboard focus. */
  const escHtml = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const cartaLists = $$('[data-carta-links]');
  if (cartaLists.length && window.AquaProps) {
    window.AquaProps.load('data/menu.properties').then((p) => {
      const keys = [...p.keys()];
      const cats = (p.get('categorie') || '').split(',').map((c) => c.trim()).filter(Boolean)
        .filter((id) => keys.some((k) => k.startsWith(`${id}.`) && k.endsWith('.nome')))
        .map((id) => ({ id, titolo: p.get(`categoria.${id}.titolo`) || id }));
      if (!cats.length) return;
      // --i staggers the entrance of each item in the menu
      const items = cats.map((c, i) => `<li style="--i:${i}"><a href="carta.html#${encodeURIComponent(c.id)}">${escHtml(c.titolo)}</a></li>`).join('');
      cartaLists.forEach((ul) => {
        ul.innerHTML = items + (ul.dataset.cartaLinks === 'tutta'
          ? `<li class="mobile-menu__all" style="--i:${cats.length}"><a href="carta.html">Tutta la carta <span aria-hidden="true">→</span></a></li>` : '');
      });
    }).catch(() => {});
  }
})();
