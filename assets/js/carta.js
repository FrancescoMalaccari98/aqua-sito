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

      /* ---------- Category bar and position in the menu ----------
         The page position is the only source of truth: the highlighted category is the one on screen.
         During a jump the target stays highlighted until the page has really stopped moving; then the
         bar is read again from the real position (so it can never stay on a category that is not shown). */
      const links = [...nav.querySelectorAll('a')];
      const ids = model.categorie.map((c) => c.id);
      const sections = [...body.querySelectorAll('.carta__cat')];
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const titleOf = (sec) => sec.querySelector('.carta__title') || sec;
      let activeId = null;
      let jumpTarget = null; // category being reached by a jump: the bar stays on it meanwhile
      let pinned = null;     // last category reached by a jump, kept while its title is in view
      let settleTimer = 0;
      let jumpLimit = 0;

      // Highlight a category and centre it in the bar (the bar scrolls smoothly, it never snaps)
      const setActive = (id) => {
        if (!id || id === activeId) return;
        activeId = id;
        links.forEach((a) => {
          const on = a.getAttribute('href') === `#${id}`;
          a.classList.toggle('is-active', on);
          if (on) nav.scrollTo({ left: a.offsetLeft - (nav.clientWidth - a.offsetWidth) / 2, behavior: reduce ? 'auto' : 'smooth' });
        });
      };
      // The category on screen: the last one whose top has passed 35% of the screen
      // (at the very bottom of the page, the last category, which can never get that high)
      const indexAt = () => {
        if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) return sections.length - 1;
        const limit = window.innerHeight * 0.35;
        let idx = 0;
        sections.forEach((sec, i) => { if (sec.getBoundingClientRect().top <= limit) idx = i; });
        return idx;
      };
      const update = () => {
        if (jumpTarget) return;
        if (pinned) {
          // near the bottom several short categories fit on one screen: keep the one just chosen
          const top = titleOf(document.getElementById(pinned)).getBoundingClientRect().top;
          if (top >= 0 && top <= window.innerHeight * 0.6) { setActive(pinned); return; }
          pinned = null;
        }
        setActive(ids[indexAt()]);
      };
      // A jump is over when the page has not moved for a moment (or after 3 s in any case)
      const settle = (wait) => {
        clearTimeout(settleTimer);
        settleTimer = setTimeout(() => {
          clearTimeout(jumpLimit);
          if (jumpTarget) pinned = jumpTarget;
          jumpTarget = null;
          update();
        }, wait);
      };

      // Jump to a category: its title stops just below the category bar
      const jumpTo = (id, smooth) => {
        const sec = document.getElementById(id);
        if (!sec) return;
        let y = 0;
        for (let el = titleOf(sec); el; el = el.offsetParent) y += el.offsetTop;
        const top = Math.max(0, y - nav.offsetHeight - 22);
        jumpTarget = id;
        setActive(id);
        window.scrollTo({ top, behavior: smooth && !reduce ? 'smooth' : 'auto' });
        settle(400); // give the smooth scroll time to start
        clearTimeout(jumpLimit);
        jumpLimit = setTimeout(() => settle(0), 3000);
      };
      let ticking = false;
      window.addEventListener('scroll', () => {
        if (jumpTarget) { settle(180); return; } // still moving: the jump is not over
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => { ticking = false; update(); });
      }, { passive: true });
      nav.addEventListener('click', (e) => {
        const a = e.target.closest('a');
        if (!a) return;
        e.preventDefault();
        const id = a.getAttribute('href').slice(1);
        history.replaceState(null, '', `#${id}`);
        jumpTo(id, true);
      });

      /* Next / previous category without the bar: swipe left or right on the menu (phones),
         or the ← → keys (computers). Swiping left goes forward (Pre dinner → After dinner),
         as when browsing photos; swiping right goes back. */
      const step = (dir) => {
        if (ids.length < 2) return;
        // start from the category being reached (fast repeated swipes), else from the one on screen
        const current = jumpTarget || pinned || ids[indexAt()];
        const to = Math.min(ids.length - 1, Math.max(0, ids.indexOf(current) + dir));
        if (ids[to] === current) return;
        history.replaceState(null, '', `#${ids[to]}`);
        jumpTo(ids[to], true);
      };
      const EDGE = 24;      // px from the screen edges, left to the browser's own back/forward gestures
      const LOCK = 10;      // px of movement before deciding whether the gesture is sideways or vertical
      const SWIPE_MIN = 50; // px of sideways movement to change category
      let gesture = null;
      page.addEventListener('touchstart', (e) => {
        const t = e.touches[0];
        const zoomed = window.visualViewport && window.visualViewport.scale > 1.01; // zoomed in: sideways pans move the view
        // one finger, not on the category bar (it scrolls sideways by itself), not on the screen edges
        gesture = e.touches.length === 1 && !zoomed && !e.target.closest('[data-carta-nav]')
          && t.clientX > EDGE && t.clientX < window.innerWidth - EDGE
          ? { x: t.clientX, y: t.clientY, axis: '' } : null;
      }, { passive: true });
      page.addEventListener('touchmove', (e) => {
        if (!gesture) return;
        if (e.touches.length > 1) { gesture = null; return; } // a second finger: pinch zoom
        const t = e.touches[0];
        const dx = t.clientX - gesture.x;
        const dy = t.clientY - gesture.y;
        if (!gesture.axis) {
          if (Math.abs(dx) < LOCK && Math.abs(dy) < LOCK) return;
          gesture.axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y';
        }
        // A sideways gesture must not scroll the page: on iPhone a small vertical drift would start a
        // scroll that keeps going (momentum) after the finger lifts and cancels the jump to the category.
        // Vertical gestures are left alone and scroll the page as usual.
        if (gesture.axis === 'x' && e.cancelable) e.preventDefault();
      }, { passive: false });
      page.addEventListener('touchend', (e) => {
        if (!gesture) return;
        const dx = e.changedTouches[0].clientX - gesture.x;
        const sideways = gesture.axis === 'x';
        gesture = null;
        if (sideways && Math.abs(dx) >= SWIPE_MIN) step(dx < 0 ? 1 : -1);
      }, { passive: true });
      page.addEventListener('touchcancel', () => { gesture = null; }, { passive: true });
      document.addEventListener('keydown', (e) => {
        if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
        if (document.body.classList.contains('menu-open')) return; // the site's menu is open on top
        if (e.target.closest('input, textarea, select, [contenteditable], [data-carta-nav]')) return;
        if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
      });

      // A category chosen in the site's menu while already on this page (see assets/js/menu.js)
      window.addEventListener('aqua:section', (e) => {
        if (!ids.includes(e.detail)) return;
        history.replaceState(null, '', `#${e.detail}`);
        jumpTo(e.detail, true);
      });

      if (location.hash) jumpTo(decodeURIComponent(location.hash.slice(1)), false);
      else update();
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
