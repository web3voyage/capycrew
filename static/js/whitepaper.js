// Whitepaper reading aids: scroll progress, active section highlighting in the
// section rail, and one-time section reveals. The progress bar and active link
// always run; the reveal animation is opt-in so a reduced-motion reader (or a
// visitor without scripting) still gets the document at full opacity.
(() => {
  const paper = document.querySelector('.paper');
  const rail = document.querySelector('.paper-rail');
  if (!paper || !rail) return;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const bar = document.querySelector('.paper-progress span');
  const entries = Array.from(rail.querySelectorAll('a[href^="#"]'))
    .map((link) => ({ link, target: document.getElementById(decodeURIComponent(link.hash.slice(1))) }))
    .filter((entry) => entry.target);

  const ACTIVE_LINE = 150; // Viewport offset at which a section counts as the one being read.
  let active = null;
  let queued = false;

  function paint() {
    queued = false;
    if (bar) {
      const scrollable = document.documentElement.scrollHeight - innerHeight;
      const ratio = scrollable > 0 ? Math.min(1, Math.max(0, scrollY / scrollable)) : 0;
      bar.style.transform = `scaleX(${ratio})`;
    }
    let current = entries[0];
    entries.forEach((entry) => { if (entry.target.getBoundingClientRect().top - ACTIVE_LINE <= 0) current = entry; });
    if (!current || current === active) return;
    if (active) { active.link.classList.remove('is-active'); active.link.removeAttribute('aria-current'); }
    current.link.classList.add('is-active');
    current.link.setAttribute('aria-current', 'true');
    active = current;
  }

  const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(paint); } };
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule, { passive: true });
  paint();

  if (reduced || !('IntersectionObserver' in window)) return;
  paper.dataset.reveal = 'on';
  const observer = new IntersectionObserver((records) => {
    records.forEach((record) => {
      if (!record.isIntersecting) return;
      record.target.classList.add('is-revealed');
      observer.unobserve(record.target);
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0 }); // Threshold 0: the tokenomics section is far taller than the viewport.
  paper.querySelectorAll('.paper-section').forEach((section) => observer.observe(section));
})();
