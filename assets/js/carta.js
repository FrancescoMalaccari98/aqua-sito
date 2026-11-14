/* Aqua — drinks menu built from data/menu.properties
   Used by carta.html (the page linked by the QR code).
   To change the menu, edit only the .properties file. */
(() => {
  const SOURCE = 'data/menu.properties';
  const ICONS = 'assets/icons/bicchieri.svg';

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

  let cache;
  const load = () => {
    if (!cache) {
      cache = window.AquaProps.load(SOURCE).then(build);
    }
    return cache;
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

  const legend = (model) => {
    const used = [...new Set(model.categorie.flatMap((c) => c.voci.map((v) => v.bicchiere)).filter(Boolean))];
    return used.map((id) => `<li>${glass(model, id, 'legend__glass')}<span>${esc(model.bicchieri[id] || id)}</span></li>`).join('');
  };

  /* ---------- carta.html page ---------- */
  const page = document.querySelector('[data-carta-page]');
  if (page) {
    const nav = page.querySelector('[data-carta-nav]');
    const body = page.querySelector('[data-carta-body]');
    load().then((model) => {
      nav.innerHTML = model.categorie.map((c) => `<a href="#${esc(c.id)}">${esc(c.titolo)}</a>`).join('');
      body.innerHTML = model.categorie.map((c) => `
        <section class="carta__cat" id="${esc(c.id)}" aria-labelledby="t-${esc(c.id)}">
          <h2 class="carta__title" id="t-${esc(c.id)}">${esc(c.titolo)}</h2>
          ${c.descrizione ? `<p class="carta__desc">${esc(c.descrizione)}</p>` : ''}
          <ul class="drinks${c.voci.some((v) => v.bicchiere) ? '' : ' drinks--plain'}">${c.voci.map((v) => drink(model, v)).join('')}</ul>
        </section>`).join('');
      page.querySelector('[data-carta-legend]').innerHTML = legend(model);
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

  window.AquaCarta = { load, parse, build, drink, glass, legend, esc };
})();
