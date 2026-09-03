/* ==========================================================================
   CapyCrew - the CapyCity Dispatch
   Editorial behaviour for the whole site. Loaded on every page from base.html,
   so every block below is guarded: if the page has no running order, no contact
   sheet, no folio rail, that feature simply never arms. Behaviour is
   deliberately quiet - type leads, the page never moves under the reader, and
   every effect degrades to a plain page.

   The city plate is not in here. capycity.js mounts itself into #scene-stage,
   reads its palette off that element, and flies the camera on page scroll.
   ========================================================================== */
(() => {
  'use strict';

  const doc = document.documentElement;
  const q = (sel, root = document) => root.querySelector(sel);
  const qa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const saveData = !!(navigator.connection && navigator.connection.saveData);
  const lite = reduceMotion || saveData;          /* no ambient motion at all */

  /* -------------------------------------------------------------- 1. reveal
     Ink meets paper: a short rise on first sight, then the observer lets go. */
  const revealables = qa('[data-reveal], [data-rule], .route-list li');

  if ('IntersectionObserver' in window && !reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.14 });
    revealables.forEach((el) => io.observe(el));
  } else {
    revealables.forEach((el) => el.classList.add('is-in'));
  }
  /* ------------------------------------------------------------ 2. counters
     Standing figures tick up once, then stay put as plain numerals. */
  const countUp = (el) => {
    const target = parseInt(el.dataset.count, 10);
    if (!target || lite) return;
    const started = performance.now();
    const tick = (now) => {
      const p = clamp((now - started) / 1100, 0, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased).toLocaleString('en-US');
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  const counters = qa('[data-count]');
  if ('IntersectionObserver' in window && counters.length) {
    const co = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        countUp(entry.target);
        co.unobserve(entry.target);
      });
    }, { threshold: 0.6 });
    counters.forEach((el) => co.observe(el));
  }

  /* --------------------------------------------------- 3. running head + rail
     One rAF-throttled scroll pass drives the masthead condense, the folio
     progress rule, the current section marker, and the route fill. */
  const masthead = q('#masthead');
  const routeList = q('.route-list');
  const districts = qa('[data-district]');
  const railLinks = new Map(qa('.folio a').map((a) => [a.dataset.rail, a]));
  let here = '';

  const onScroll = () => {
    const y = window.scrollY;
    if (masthead) masthead.classList.toggle('is-stuck', y > 46);

    const scrollable = document.body.scrollHeight - window.innerHeight;
    doc.style.setProperty('--page-progress', scrollable > 0 ? (y / scrollable).toFixed(4) : '0');

    /* current section: the last one whose top has passed the reading line */
    const line = window.innerHeight * 0.42;
    let current = districts.length ? districts[0].dataset.district : '';
    districts.forEach((section) => {
      if (section.getBoundingClientRect().top <= line) current = section.dataset.district;
    });
    if (current !== here) {
      /* aria-current follows is-here: the rail is a nav, so the marker has to be
         announced, not only drawn. */
      if (railLinks.has(here)) {
        railLinks.get(here).classList.remove('is-here');
        railLinks.get(here).removeAttribute('aria-current');
      }
      if (railLinks.has(current)) {
        railLinks.get(current).classList.add('is-here');
        railLinks.get(current).setAttribute('aria-current', 'true');
      }
      here = current;
    }
    /* the route rule fills as the list passes the reading line */
    if (routeList) {
      const box = routeList.getBoundingClientRect();
      const filled = clamp((window.innerHeight * 0.72 - box.top) / box.height, 0, 1);
      routeList.style.setProperty('--route-progress', filled.toFixed(4));
    }
  };

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { onScroll(); ticking = false; });
  }, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  onScroll();
  /* ------------------------------------------------------------- 4. dispatch
     The running order behaves like a tablist: one clip on the plate at a
     time, captions swapped with it, and a slow auto-advance that any
     interaction cancels for good. */
  const stage = q('.deck-stage');
  const player = q('#deck-player');
  const figLabel = q('#deck-fig');
  const subLabel = q('#deck-sub');
  const tabs = qa('.running-order button');

  if (stage && player && tabs.length) {
    let autoTimer = null;
    let index = 0;

    const select = (next, focus) => {
      const btn = tabs[next];
      if (!btn || next === index) return;
      index = next;

      tabs.forEach((t) => {
        const on = t === btn;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
      });

      stage.classList.add('is-swapping');
      window.setTimeout(() => {
        player.src = btn.dataset.src;
        const play = player.play();
        if (play && play.catch) play.catch(() => {});
        if (figLabel) figLabel.textContent = btn.dataset.fig;
        if (subLabel) subLabel.textContent = btn.dataset.sub;
        stage.classList.remove('is-swapping');
      }, 240);

      if (focus) btn.focus();
    };
    const stopAuto = () => {
      if (autoTimer) window.clearInterval(autoTimer);
      autoTimer = null;
    };

    tabs.forEach((btn, i) => {
      btn.tabIndex = i === 0 ? 0 : -1;
      btn.addEventListener('click', () => { stopAuto(); select(i); });
      btn.addEventListener('keydown', (event) => {
        const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key];
        if (!step) return;
        event.preventDefault();
        stopAuto();
        select((index + step + tabs.length) % tabs.length, true);
      });
    });

    if (!lite) {
      autoTimer = window.setInterval(() => select((index + 1) % tabs.length), 9000);
      const deck = q('.deck');
      if (deck) deck.addEventListener('pointerenter', stopAuto, { once: true });
    }
  }
  /* -------------------------------------------------------- 5. contact sheet
     A horizontal sheet of frames. Drag it, scroll it, or use the arrow keys;
     whichever frame sits nearest the centre is the one in focus. */
  const sheet = q('.sheet');
  const frames = qa('.frame');

  if (sheet && frames.length) {
    let raf = 0;

    const markFocus = () => {
      const mid = sheet.getBoundingClientRect().left + sheet.clientWidth / 2;
      let best = null;
      let bestGap = Infinity;
      frames.forEach((frame) => {
        const box = frame.getBoundingClientRect();
        const gap = Math.abs(box.left + box.width / 2 - mid);
        if (gap < bestGap) { bestGap = gap; best = frame; }
      });
      frames.forEach((frame) => frame.classList.toggle('is-focus', frame === best));
    };

    sheet.addEventListener('scroll', () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { markFocus(); raf = 0; });
    }, { passive: true });
    let dragging = false;
    let dragFrom = 0;
    let scrollFrom = 0;

    sheet.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      dragging = true;
      dragFrom = event.clientX;
      scrollFrom = sheet.scrollLeft;
      sheet.classList.add('is-dragging');
      if (sheet.setPointerCapture) sheet.setPointerCapture(event.pointerId);
    });

    sheet.addEventListener('pointermove', (event) => {
      if (!dragging) return;
      sheet.scrollLeft = scrollFrom - (event.clientX - dragFrom);
    });

    const endDrag = () => {
      dragging = false;
      sheet.classList.remove('is-dragging');
    };
    sheet.addEventListener('pointerup', endDrag);
    sheet.addEventListener('pointercancel', endDrag);
    sheet.addEventListener('pointerleave', endDrag);

    sheet.addEventListener('keydown', (event) => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
      if (!step) return;
      event.preventDefault();
      const frame = frames[0].getBoundingClientRect();
      sheet.scrollBy({ left: step * (frame.width + 20), behavior: reduceMotion ? 'auto' : 'smooth' });
    });

    markFocus();
  }

  /* --------------------------------------------------------------- 6. spread
     The product study leans a couple of degrees toward the pointer - enough
     to read as a physical spread on a desk, not enough to distract. */
  qa('[data-tilt]').forEach((el) => {
    if (lite) return;
    const reset = () => {
      el.style.setProperty('--tx', '0deg');
      el.style.setProperty('--ty', '0deg');
    };
    el.addEventListener('pointermove', (event) => {
      const box = el.getBoundingClientRect();
      const x = (event.clientX - box.left) / box.width - 0.5;
      const y = (event.clientY - box.top) / box.height - 0.5;
      el.style.setProperty('--tx', (x * 5).toFixed(2) + 'deg');
      el.style.setProperty('--ty', (-y * 3.4).toFixed(2) + 'deg');
    });
    el.addEventListener('pointerleave', reset);
    reset();
  });
})();
