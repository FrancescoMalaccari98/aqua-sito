/* Aqua — menus built from .properties files
   carta.html → data/menu.properties (drinks, the page linked by the QR code)
   food.html  → data/food.properties (food)
   The page names its file in data-source; to change a menu, edit only its .properties file. */
(() => {
  const SOURCE = 'data/menu.properties';
  const ICONS = 'assets/icons/bicchieri.svg?v=2';

  // The .properties parser lives in assets/js/properties.js
  const { parse } = window.AquaProps;

  /* ---------- From the file to the menu model ---------- */
  const build = (props) => {
    const get = (k, d = '') => (props.has(k) ? props.get(k) : d);
    const list = (k) => get(k).split(',').map((s) => s.trim()).filter(Boolean);

    const bicchieri = {};
    props.forEach((v, k) => { const m = k.match(/^bicchiere\.([\w-]+)$/); if (m) bicchieri[m[1]] = v; });

    const categorie = list('categorie').map((id) => {
      const nums = new Set();
      props.forEach((_, k) => {
        const m = k.match(new RegExp(`^${id}\\.(\\d+)\\.`));
        if (m) nums.add(Number(m[1]));
      });
      const voci = [...nums].sort((a, b) => a - b).map((n) => {
        const f = (campo) => get(`${id}.${n}.${campo}`);
        return {
          nome: f('nome'),
          ingredienti: f('ingredienti'),
          prezzo: f('prezzo'),
          bottiglia: f('prezzo.bottiglia'),
          bicchiere: f('bicchiere').toLowerCase(),
          gruppo: f('gruppo'),
        };
      }).filter((v) => v.nome);
      return {
        id,
        titolo: get(`categoria.${id}.titolo`, id),
        descrizione: get(`categoria.${id}.descrizione`),
        voci,
      };
    }).filter((c) => c.voci.length);

    return {
      valuta: get('carta.valuta', '€'),
      bicchieri,
      categorie,
    };
  };

  const cache = {};
  const load = (source = SOURCE) => {
    if (!cache[source]) cache[source] = window.AquaProps.load(source).then(build);
    return cache[source];
  };

  /* ---------- HTML snippets ---------- */
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  const glass = (model, id, cls = 'glass') => {
    if (!id) return '';
    const nome = model.bicchieri[id] || id;
    return `<span class="${cls}" title="Servito in ${esc(nome.toLowerCase())}">`
      + `<svg aria-hidden="true" focusable="false"><use href="${ICONS}#${esc(id)}"></use></svg>`
      + `<span class="sr-only">Servito in ${esc(nome.toLowerCase())}</span></span>`;
  };

  // "da 4" in the file becomes "da € 4" (starting price); an empty price leaves the slot empty
  const price = (model, v) => {
    if (!v.prezzo) return '<span class="drink__price"></span>';
    const m = v.prezzo.match(/^da\s+(.+)$/i);
    const cur = `<span class="drink__cur">${esc(model.valuta)}</span>`;
    return m
      ? `<span class="drink__price"><span class="drink__from">da</span> ${cur} ${esc(m[1])}</span>`
      : `<span class="drink__price">${cur} ${esc(v.prezzo)}</span>`;
  };

  const drink = (model, v) => `
    <li class="drink"${v.bicchiere ? ` data-glass="${esc(v.bicchiere)}"` : ''}>
      ${glass(model, v.bicchiere, 'drink__glass')}
      <span class="drink__name">${esc(v.nome)}</span>${v.prezzo ? `<span class="drink__leader" aria-hidden="true"></span>${price(model, v)}` : ''}
      ${v.ingredienti ? `<span class="drink__notes">${esc(v.ingredienti)}</span>` : ''}
      ${v.bottiglia ? `<span class="drink__bottle">Bottiglia ${esc(model.valuta)} ${esc(v.bottiglia)}</span>` : ''}
    </li>`;

  // A category's items, with a small heading each time the group changes (e.g. the gin families)
  const drinks = (model, voci) => {
    let last = '';
    return voci.map((v) => {
      const head = v.gruppo && v.gruppo !== last ? `<li class="drinks__group">${esc(v.gruppo)}</li>` : '';
      if (v.gruppo) last = v.gruppo;
      return head + drink(model, v);
    }).join('');
  };

  const legend = (model) => {
    const used = [...new Set(model.categorie.flatMap((c) => c.voci.map((v) => v.bicchiere)).filter(Boolean))];
    return used.map((id) => `<li>${glass(model, id, 'legend__glass')}<span>${esc(model.bicchieri[id] || id)}</span></li>`).join('');
  };

  /* ---------- carta.html page ---------- */
  const page = document.querySelector('[data-carta-page]');
  if (page) {
    const nav = page.querySelector('[data-carta-nav]');
    const body = page.querySelector('[data-carta-body]');
    load(page.dataset.source || SOURCE).then((model) => {
      // a menu with a single category needs no category bar
      nav.hidden = model.categorie.length < 2;
      nav.innerHTML = model.categorie.map((c) => `<a href="#${esc(c.id)}">${esc(c.titolo)}</a>`).join('');
      // with a single category the page title already says it all: no category heading
      const single = model.categorie.length < 2;
      body.innerHTML = model.categorie.map((c) => `
        <section class="carta__cat" id="${esc(c.id)}" aria-labelledby="t-${esc(c.id)}">
          <h2 class="carta__title${single ? ' sr-only' : ''}" id="t-${esc(c.id)}">${esc(c.titolo)}</h2>
          ${c.descrizione ? `<p class="carta__desc">${esc(c.descrizione)}</p>` : ''}
          <ul class="drinks${c.voci.some((v) => v.bicchiere) ? '' : ' drinks--plain'}">${drinks(model, c.voci)}</ul>
        </section>`).join('');
      const legendEl = page.querySelector('[data-carta-legend]');
      if (legendEl) legendEl.innerHTML = legend(model);
      page.classList.add('is-ready');

      // Active category in the sticky bar at the top
      const links = [...nav.querySelectorAll('a')];
      let jumping = 0; // while jumping to a category the bar does not update itself
      const setActive = (id, smooth) => links.forEach((a) => {
        const on = a.getAttribute('href') === `#${id}`;
        a.classList.toggle('is-active', on);
        // Centre the active category in the bar without moving the page
        if (on) nav.scrollTo({ left: a.offsetLeft - (nav.clientWidth - a.offsetWidth) / 2, behavior: smooth ? 'smooth' : 'auto' });
      });
      const obs = new IntersectionObserver((entries) => {
        if (jumping) return;
        entries.forEach((en) => { if (en.isIntersecting) setActive(en.target.id, true); });
      }, { rootMargin: '-30% 0px -60% 0px' });

      // Jump to a category: its title stops just below the category bar
      const jumpTo = (id, smooth) => {
        const sec = document.getElementById(id);
        if (!sec) return;
        const title = sec.querySelector('.carta__title') || sec;
        let y = 0;
        for (let el = title; el; el = el.offsetParent) y += el.offsetTop;
        setActive(id, false);
        clearTimeout(jumping);
        jumping = setTimeout(() => { jumping = 0; }, smooth ? 1200 : 100);
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({ top: Math.max(0, y - nav.offsetHeight - 22), behavior: smooth && !reduce ? 'smooth' : 'auto' });
      };
      nav.addEventListener('click', (e) => {
        const a = e.target.closest('a');
        if (!a) return;
        e.preventDefault();
        const id = a.getAttribute('href').slice(1);
        history.replaceState(null, '', `#${id}`);
        jumpTo(id, true);
      });
      body.querySelectorAll('.carta__cat').forEach((s) => obs.observe(s));
      // At the bottom of the page the last category never reaches mid-screen, so activate it here
      window.addEventListener('scroll', () => {
        if (window.innerHeight + window.scrollY < document.documentElement.scrollHeight - 4) return;
        const last = links[links.length - 1];
        if (last && !last.classList.contains('is-active')) {
          if (jumping) return;
          links.forEach((a) => a.classList.toggle('is-active', a === last));
          nav.scrollTo({ left: nav.scrollWidth, behavior: 'smooth' });
        }
      }, { passive: true });

      /* Next / previous category without the bar: swipe left or right on the menu (phones),
         or the ← → keys (computers). Swiping left goes forward (Pre dinner → After dinner),
         as when browsing photos; swiping right goes back. */
      const ids = model.categorie.map((c) => c.id);
      const currentIndex = () => {
        const active = links.findIndex((a) => a.classList.contains('is-active'));
        if (active >= 0) return active;
        // nothing highlighted yet: the last category whose title has passed 40% of the screen,
        // or the first one at the top of the page (it is the one already in view)
        let idx = 0;
        body.querySelectorAll('.carta__cat').forEach((s, i) => { if (s.getBoundingClientRect().top < window.innerHeight * 0.4) idx = i; });
        return idx;
      };
      const step = (dir) => {
        if (ids.length < 2) return;
        const from = currentIndex();
        const to = Math.min(ids.length - 1, Math.max(0, from + dir));
        if (to === from) return;
        history.replaceState(null, '', `#${ids[to]}`);
        jumpTo(ids[to], true);
      };
      const SWIPE_MIN = 60;  // px of horizontal movement
      const EDGE = 24;       // px from the screen edges, left to the browser's own back/forward gestures
      let touch = null;
      page.addEventListener('touchstart', (e) => {
        const t = e.touches[0];
        // one finger, not on the category bar (it scrolls sideways by itself), not on the screen edges
        touch = e.touches.length === 1 && !e.target.closest('[data-carta-nav]')
          && t.clientX > EDGE && t.clientX < window.innerWidth - EDGE
          ? { x: t.clientX, y: t.clientY, time: performance.now() } : null;
      }, { passive: true });
      page.addEventListener('touchend', (e) => {
        if (!touch) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - touch.x;
        const dy = t.clientY - touch.y;
        const quick = performance.now() - touch.time < 700;
        touch = null;
        // a clear sideways gesture: long enough and much more horizontal than vertical (not a page scroll)
        if (quick && Math.abs(dx) >= SWIPE_MIN && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
      }, { passive: true });
      page.addEventListener('touchcancel', () => { touch = null; }, { passive: true });
      document.addEventListener('keydown', (e) => {
        if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
        if (e.target.closest('input, textarea, select, [contenteditable], [data-carta-nav]')) return;
        if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
      });

      if (location.hash) jumpTo(decodeURIComponent(location.hash.slice(1)), false);
    }).catch(() => {
      body.innerHTML = '<p class="carta__error">Non riusciamo a caricare la carta in questo momento. Chiedete al bancone: ve la raccontiamo noi.</p>';
      page.classList.add('is-ready');
    });
  }

  /* ---------- Menu background photo: the path is in data/foto.properties ---------- */
  const sfondi = document.querySelectorAll('img[data-foto]');
  if (sfondi.length) {
    window.AquaProps.load('data/foto.properties').then((p) => {
      sfondi.forEach((img) => {
        const path = p.get(`${img.dataset.foto}.foto`);
        if (!path) return;
        img.addEventListener('load', () => img.classList.add('is-loaded'), { once: true });
        img.src = path;
      });
    }).catch(() => {});
  }

  window.AquaCarta = { load, parse, build, drink, drinks, glass, legend, esc };
})();
