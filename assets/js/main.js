/* Aqua — home page interactions (index.html) */
(() => {
  window.aquaReady = true;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Photos: paths come from data/foto.properties ----------
     Every <img> (or <source>) with data-foto="key" gets "key.foto" and "key.alt";
     data-foto-variante="mobile" gets "key.foto.mobile". */
  let foto = null;         // the parsed file, once it has arrived
  let heroFinale = false;  // without video, the hero cover shows the finished drink
  const applyFoto = () => {
    if (!foto) return;
    $$('[data-foto]').forEach((el) => {
      const base = el.dataset.foto;
      const variante = el.dataset.fotoVariante;
      const key = (...parts) => [`${base}.foto`, ...parts].filter(Boolean).join('.');
      const path = (heroFinale && base === 'hero' && foto.get(key('finale', variante))) || foto.get(key(variante));
      if (path) el.setAttribute(el.tagName === 'SOURCE' ? 'srcset' : 'src', path);
      if (el.tagName === 'IMG' && foto.has(`${base}.alt`)) el.alt = foto.get(`${base}.alt`);
    });
  };
  const fotoReady = window.AquaProps.load('data/foto.properties')
    .then((p) => { foto = p; applyFoto(); return p; })
    .catch(() => null);

  /* ---------- Intro + hero entrance ---------- */
  const hero = $('.hero');
  $$('[data-hero-step]', hero).forEach((el, i) => el.style.setProperty('--i', i));
  const startHero = () => setTimeout(() => {
    hero.classList.add('is-loaded');
    if (heroVideo) setTimeout(heroVideo.start, 250);
  }, 30);

  const intro = $('.intro');
  if (root.classList.contains('has-intro') && !reduceMotion) {
    document.body.style.overflow = 'hidden';
    try { sessionStorage.setItem('aqua-intro', '1'); } catch (e) {}
    setTimeout(() => {
      intro.classList.add('is-leaving');
      setTimeout(startHero, 350);
      setTimeout(() => {
        root.classList.remove('has-intro');
        document.body.style.overflow = '';
      }, 1150);
    }, 2700); // the Q, then the word opening up, then a short pause on the full logo
  } else {
    root.classList.remove('has-intro');
    const heroImg = $('.hero__media img');
    if (heroImg.getAttribute('src') && heroImg.complete) startHero();
    else { heroImg.addEventListener('load', startHero, { once: true }); setTimeout(startHero, 1200); }
  }

  /* ---------- Hero video ----------
     Starts from the cover image (the empty glass, first frame); the cover fades out when
     the video plays and comes back at the end of each loop, before it restarts.
     If the browser blocks autoplay (iPhone in Low Power Mode), the same clip is loaded
     as an image: Safari plays MP4 files inside <img> like a GIF, and images are not blocked. */
  const heroVideo = (() => {
    const video = $('.hero__video');
    if (!video) return null;
    const media = $('.hero__media');
    // Without video, the cover shows the finished drink instead of the empty glass
    const stillFull = () => { heroFinale = true; applyFoto(); };
    const conn = navigator.connection;
    if (reduceMotion || (conn && conn.saveData) || !video.canPlayType('video/mp4')) {
      video.remove();
      stillFull();
      return null;
    }
    const small = window.matchMedia('(max-width: 640px)').matches;
    const FADE = 0.9;   // fade length in seconds, same as the CSS transition
    const PAUSE = 1400; // ms spent on the cover between two loops
    let started = false, inView = true, restartTimer = 0, asImage = false;

    video.muted = true;
    video.defaultMuted = true;
    // HEVC: same quality at roughly 30% smaller size (Safari, Chrome on Mac, iPhone);
    // otherwise H.264, which plays everywhere
    const hevc = video.canPlayType('video/mp4; codecs="hvc1.1.6.L123.B0"') !== '';
    // Files come from data/foto.properties (hero.video…): HEVC first, H.264 as the fallback
    let sources = [];
    let h264 = '';
    fotoReady.then((p) => {
      const key = small ? 'hero.video.mobile' : 'hero.video';
      h264 = (p && p.get(key)) || '';
      sources = [hevc && p && p.get(`${key}.hevc`), h264].filter(Boolean);
      if (!sources.length) { video.remove(); stillFull(); return; }
      video.src = sources.shift();
      video.preload = 'auto'; // start downloading right away, so it plays as soon as the page is ready
      play();
    });

    // Fallback: the clip as an animated image (only Safari can play it this way)
    let imageTried = false;
    const imageFallback = () => {
      if (imageTried) return;
      imageTried = true;
      const img = new Image();
      img.className = 'hero__video';
      img.alt = '';
      img.setAttribute('aria-hidden', 'true');
      img.onload = () => {
        if (!img.naturalWidth || !video.paused) return; // the video started in the meantime
        asImage = true;
        video.pause();
        video.replaceWith(img);
        media.classList.add('is-playing');
        gestureOff();
      };
      // If HEVC fails as an image, retry with H.264; otherwise the cover stays
      let retried = false;
      img.onerror = () => { if (!retried && h264) { retried = true; img.src = h264; } };
      img.src = video.currentSrc || video.src;
    };

    const play = () => {
      if (asImage || !started || !inView || document.hidden || restartTimer || !video.getAttribute('src')) return;
      const p = video.play();
      if (p) p.catch((err) => { if (err && err.name === 'NotAllowedError') imageFallback(); });
    };
    // In any case, the first tap retries the real video
    const onGesture = () => { if (video.paused && !video.ended) play(); };
    const gestureOff = () => ['touchend', 'click'].forEach((ev) => document.removeEventListener(ev, onGesture));
    ['touchend', 'click'].forEach((ev) => document.addEventListener(ev, onGesture, { passive: true }));
    video.addEventListener('playing', () => {
      media.classList.add('is-playing');
      gestureOff();
    });
    video.addEventListener('timeupdate', () => {
      if (video.duration && video.currentTime > video.duration - FADE - 0.3) media.classList.remove('is-playing');
    });
    video.addEventListener('ended', () => {
      restartTimer = setTimeout(() => {
        restartTimer = 0;
        video.currentTime = 0;
        play();
      }, PAUSE);
    });
    video.addEventListener('error', () => {
      // If the advertised HEVC cannot be decoded, retry once with H.264
      if (sources.length) { video.src = sources.shift(); play(); }
      else { video.remove(); media.classList.remove('is-playing'); stillFull(); }
    });

    new IntersectionObserver(([en]) => {
      inView = en.isIntersecting;
      if (asImage) return;
      if (inView) play(); else video.pause();
    }).observe(hero);
    document.addEventListener('visibilitychange', () => { if (!asImage) (document.hidden ? video.pause() : play()); });

    return { start() { started = true; play(); } };
  })();

  /* ---------- In-page links: scroll to the section without writing #… in the address ----------
     So reloading or reopening the site always starts from the top. */
  window.scrollTo({ top: 0, behavior: 'instant' });
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const id = a.getAttribute('href').slice(1);
    const target = id === 'top' || !id ? null : document.getElementById(id);
    if (id && id !== 'top' && !target) return;
    e.preventDefault();
    const behavior = reduceMotion ? 'auto' : 'smooth';
    if (!target) { window.scrollTo({ top: 0, behavior }); return; }
    // Align the section label ("01 — Filosofia"), not the section edge with its padding;
    // the header hides when scrolling down and comes back when scrolling up
    const GAP = 28;
    const anchor = target.matches('section') ? ($('.section-index', target) || target) : target;
    // Position in the page, ignoring reveal animations (they shift elements by a few px)
    let y = 0;
    for (let el = anchor; el; el = el.offsetParent) y += el.offsetTop;
    const goingDown = y - GAP > window.scrollY;
    const offset = goingDown && y - GAP > 600 ? GAP : $('.site-header').offsetHeight + GAP;
    window.scrollTo({ top: Math.max(0, y - offset), behavior });
    // Also move focus (keyboard and screen readers) without a second jump
    if (!target.matches('a, button, input, select, textarea, [tabindex]')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  });

  /* ---------- Header: background and show/hide on scroll ---------- */
  const header = $('.site-header');
  let lastY = window.scrollY;
  let ticking = false;
  const onScroll = () => {
    const y = window.scrollY;
    header.classList.toggle('is-scrolled', y > 40);
    const menuOpen = document.body.classList.contains('menu-open');
    if (!menuOpen && y > 600 && y > lastY + 4) header.classList.add('is-hidden');
    else if (y < lastY - 4 || y < 600) header.classList.remove('is-hidden');
    lastY = y;
    parallax();
    ticking = false;
  };
  window.addEventListener('scroll', () => {
    if (!ticking) { requestAnimationFrame(onScroll); ticking = true; }
  }, { passive: true });

  /* ---------- Quote band parallax ---------- */
  const para = $('[data-parallax]');
  function parallax() {
    if (!para || reduceMotion) return;
    const r = para.parentElement.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;
    const p = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;
    para.style.transform = `translate3d(0, ${p * -60}px, 0)`;
  }
  onScroll();

  /* ---------- Mobile menu ---------- */
  const burger = $('.burger');
  const mobileMenu = $('#mobile-menu');
  const cartaToggle = $('[data-carta-toggle]');
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
  const setMenu = (open) => {
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Chiudi il menu' : 'Apri il menu');
    document.body.classList.toggle('menu-open', open);
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) {
      mobileMenu.hidden = false;
      header.classList.remove('is-hidden');
      requestAnimationFrame(() => requestAnimationFrame(() => mobileMenu.classList.add('is-open')));
      setTimeout(() => $('a', mobileMenu).focus({ preventScroll: true }), 350);
    } else {
      mobileMenu.classList.remove('is-open');
      setCartaOpen(false);
      setTimeout(() => { if (!mobileMenu.classList.contains('is-open')) mobileMenu.hidden = true; }, 500);
    }
  };
  burger.addEventListener('click', () => setMenu(burger.getAttribute('aria-expanded') !== 'true'));
  // Any link closes the menu, except "La carta", which opens its categories (see below)
  mobileMenu.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (a && !a.matches('[data-carta-toggle]')) setMenu(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('menu-open')) { setMenu(false); burger.focus(); }
  });
  window.matchMedia('(min-width: 1025px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });
  // Coming from the menus' "Il sito" link (index.html#menu): open the navigation menu right away.
  // On wide screens the navigation is always visible in the header, so nothing to open.
  if (root.classList.contains('open-menu') && window.matchMedia('(max-width: 1024px)').matches) setMenu(true);

  /* ---------- "La carta" categories in the menus ----------
     Read from data/menu.properties, so they always match the menu (only categories with items).
     Phone menu: tapping "La carta" opens or closes the list, which starts with "Tutta la carta".
     Header (computers): the list appears under "La carta" on hover or keyboard focus. */
  const escHtml = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const cartaLists = $$('[data-carta-links]');
  if (cartaLists.length) {
    window.AquaProps.load('data/menu.properties').then((p) => {
      const keys = [...p.keys()];
      const cats = (p.get('categorie') || '').split(',').map((c) => c.trim()).filter(Boolean)
        .filter((id) => keys.some((k) => k.startsWith(`${id}.`) && k.endsWith('.nome')))
        .map((id) => ({ id, titolo: p.get(`categoria.${id}.titolo`) || id }));
      if (!cats.length) return;
      // --i staggers the entrance of each item in the phone menu
      const items = cats.map((c, i) => `<li style="--i:${i}"><a href="carta.html#${encodeURIComponent(c.id)}">${escHtml(c.titolo)}</a></li>`).join('');
      cartaLists.forEach((ul) => {
        ul.innerHTML = items + (ul.dataset.cartaLinks === 'tutta'
          ? `<li class="mobile-menu__all" style="--i:${cats.length}"><a href="carta.html">Tutta la carta <span aria-hidden="true">→</span></a></li>` : '');
      });
    }).catch(() => {});
  }

  /* ---------- Active navigation item ---------- */
  const navLinks = $$('.nav__list a');
  const navObs = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      navLinks.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === '#' + en.target.id));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  $$('main > section[id]').forEach((s) => navObs.observe(s));

  /* ---------- Counting numbers (24 / 12 / 0) ---------- */
  const countUp = (el) => {
    const target = Number(el.dataset.count);
    if (reduceMotion || target === 0) { el.textContent = target; return; }
    const dur = 1600;
    const t0 = performance.now();
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      el.textContent = Math.round(target * (1 - Math.pow(1 - k, 4)));
      if (k < 1) requestAnimationFrame(tick);
    };
    el.textContent = '0';
    requestAnimationFrame(tick);
  };

  /* ---------- Reveal on scroll ---------- */
  const revealObs = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      en.target.classList.add('is-visible');
      $$('[data-count]', en.target).forEach(countUp);
      revealObs.unobserve(en.target);
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
  $$('.reveal').forEach((el) => {
    const siblings = $$(':scope > .reveal', el.parentElement);
    const idx = siblings.indexOf(el);
    if (idx > 0) el.style.transitionDelay = `${Math.min(idx, 4) * 90}ms`;
    revealObs.observe(el);
  });

  /* ---------- Opening hours: open/closed status ----------
     Always computed in Italian time, even for visitors in another time zone.
     Before the opening night it says "Inaugurazione …"; afterwards it is computed from the
     hours below and refreshed every minute (and when the countdown ends). */
  // day 0=Sun..6=Sat → [opening, closing] in minutes; above 1440 = after midnight
  // Tue–Fri 17:00–22:00 · Sat and Sun 10:00–02:00 · Monday closed
  const HOURS = { 0: [600, 1560], 1: null, 2: [1020, 1320], 3: [1020, 1320], 4: [1020, 1320], 5: [1020, 1320], 6: [600, 1560] };
  const DAYS = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
  const romeClock = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Rome', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  const rome = () => {
    const p = Object.fromEntries(romeClock.formatToParts(new Date()).map((x) => [x.type, x.value]));
    return { day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday), mins: Number(p.hour) * 60 + Number(p.minute) };
  };
  const fmt = (m) => `${String(Math.floor((m % 1440) / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

  const countdown = $('[data-countdown]');
  const opening = countdown ? new Date(countdown.dataset.countdown) : null;
  const beforeOpening = () => !!opening && Date.now() < opening.getTime();

  const openStatus = () => {
    // Before the opening night, no status may say "open"
    if (beforeOpening()) {
      const openingDay = opening.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', timeZone: 'Europe/Rome' });
      return { open: false, text: `Inaugurazione ${openingDay}` };
    }
    const { day, mins } = rome();
    const today = HOURS[day];
    const yesterday = HOURS[(day + 6) % 7];
    if (yesterday && yesterday[1] > 1440 && mins < yesterday[1] - 1440) return { open: true, text: `Aperto ora · fino alle ${fmt(yesterday[1])}` };
    if (today && mins >= today[0] && mins < today[1]) return { open: true, text: `Aperto ora · fino alle ${fmt(today[1])}` };
    // "Stasera" only for evening openings; weekend mornings (10:00) say "Oggi"
    if (today && mins < today[0]) return { open: false, text: `${today[0] >= 1020 ? 'Stasera' : 'Oggi'} dalle ${fmt(today[0])}` };
    let d = 1;
    while (!HOURS[(day + d) % 7]) d++;
    const label = d === 1 ? 'Domani' : DAYS[(day + d) % 7].replace(/^./, (c) => c.toUpperCase());
    return { open: false, text: `${label} dalle ${fmt(HOURS[(day + d) % 7][0])}` };
  };

  const updateStatus = () => {
    // Anything announcing the opening (photo badge, mobile menu line) disappears afterwards
    $$('[data-only-before-opening]').forEach((el) => { el.hidden = !beforeOpening(); });
    const { open, text } = openStatus();
    $$('[data-open-status]').forEach((el) => {
      if (el.textContent !== text) el.textContent = text;
      const status = el.closest('.status');
      if (status) status.classList.toggle('is-closed', !open);
    });
  };
  updateStatus();
  // Re-check at the start of every minute: at 17:00 it becomes "Aperto ora", at 22:00 it closes
  const nextMinute = () => setTimeout(() => { updateStatus(); nextMinute(); }, 60000 - (Date.now() % 60000) + 50);
  nextMinute();

  /* ---------- Countdown to the opening night ---------- */
  if (countdown) {
    const heroStatus = $('.hero__meta .status');
    const nums = Object.fromEntries($$('[data-unit]', countdown).map((el) => [el.dataset.unit, el]));
    const pad = (n) => String(n).padStart(2, '0');
    const set = (key, value) => {
      const el = nums[key];
      if (el.textContent === value) return;
      el.textContent = value;
      if (!reduceMotion) {
        el.classList.remove('is-tick');
        void el.offsetWidth; // restart the animation
        el.classList.add('is-tick');
      }
    };
    // When it ends, the countdown makes room for the open/closed status computed from the hours
    const finish = () => {
      countdown.hidden = true;
      heroStatus.hidden = false;
      updateStatus();
    };
    const render = () => {
      const diff = opening.getTime() - Date.now();
      if (diff <= 0) { finish(); return; }
      const sec = Math.floor(diff / 1000);
      set('d', pad(Math.floor(sec / 86400)));
      set('h', pad(Math.floor((sec % 86400) / 3600)));
      set('m', pad(Math.floor((sec % 3600) / 60)));
      set('s', pad(sec % 60));
      // re-align to the next exact second
      setTimeout(render, 1000 - (Date.now() % 1000) + 5);
    };
    if (beforeOpening()) render(); else finish();
  }

  /* ---------- Year in the footer ---------- */
  $('[data-year]').textContent = new Date().getFullYear();
})();
