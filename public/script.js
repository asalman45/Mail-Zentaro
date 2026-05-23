/* ═══════════════════════════════════════════════════════════
   ZENTARO v5 — Clean Editorial Script
   ═══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  const $ = (s, p) => (p || document).querySelector(s);
  const $$ = (s, p) => [...(p || document).querySelectorAll(s)];

  // 1. LOADER
  const loader = $('#loader');
  if (loader) {
    window.addEventListener('load', () => {
      setTimeout(() => { loader.classList.add('done'); setTimeout(() => loader.remove(), 700); }, 600);
    });
    setTimeout(() => { if (loader) loader.classList.add('done'); }, 3000);
  }

  // 2. NAVBAR + SCROLL PROGRESS
  const nav = $('#nav');
  const prog = $('#scroll-progress');
  const onScroll = () => {
    if (nav) nav.classList.toggle('scrolled', window.scrollY > 50);
    if (prog) {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      prog.style.transform = `scaleX(${h > 0 ? window.scrollY / h : 0})`;
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // 3. MOBILE MENU
  const burger = $('.hamburger');
  const mob = $('.mob-menu');
  if (burger && mob) {
    burger.addEventListener('click', () => {
      burger.classList.toggle('open');
      mob.classList.toggle('open');
      document.body.style.overflow = mob.classList.contains('open') ? 'hidden' : '';
    });
    $$('.mob-link', mob).forEach(l => l.addEventListener('click', () => {
      burger.classList.remove('open'); mob.classList.remove('open'); document.body.style.overflow = '';
    }));
  }

  // 4. SMOOTH SCROLL
  $$('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      if (!id || id === '#') return;
      const el = $(id);
      if (el) { e.preventDefault(); window.scrollTo({ top: el.offsetTop - 72, behavior: 'smooth' }); }
    });
  });

  // 5. SCROLL REVEAL
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const d = +(e.target.dataset.delay || 0);
        setTimeout(() => e.target.classList.add('show'), d);
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

  $$('.reveal, .reveal-left, .reveal-right').forEach((el, i) => {
    // Auto-stagger grid children
    const parent = el.parentElement;
    if (parent && parent.children.length > 2 && !el.dataset.delay) {
      const idx = [...parent.children].indexOf(el);
      el.dataset.delay = idx * 100;
    }
    obs.observe(el);
  });

  // 6. ACTIVE NAV
  const navLinks = $$('.nav-link');
  const secObs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) navLinks.forEach(l => l.classList.toggle('active', l.getAttribute('href') === '#' + e.target.id));
    });
  }, { threshold: 0.2 });
  $$('section[id]').forEach(s => secObs.observe(s));

  // 7. COLOR SWAP
  const imgMap = {
    zt125: { red: 'images/zt125-red.png', black: 'images/zt125-black.png', white: 'images/zt125-white.png' },
    ze2000: { red: 'images/scooter-red.png', blue: 'images/scooter-blue.jpg' }
  };

  const swap = (el, src) => {
    if (!el) return;
    el.style.opacity = '0';
    setTimeout(() => { el.src = src; el.onload = () => { el.style.opacity = '1'; }; }, 200);
  };

  const syncColor = (product, color) => {
    if (!imgMap[product]?.[color]) return;
    const src = imgMap[product][color];
    swap($(`#${product}-card-img`), src);
    swap($(`#${product}-detail-img`), src);
    $$('.cdot').filter(d => d.dataset.product === product).forEach(d => d.classList.toggle('on', d.dataset.color === color));
    $$('.cbtn').filter(b => b.dataset.target === product).forEach(b => b.classList.toggle('on', b.dataset.color === color));
  };

  $$('.cdot').forEach(d => d.addEventListener('click', () => syncColor(d.dataset.product, d.dataset.color)));
  $$('.cbtn').forEach(b => b.addEventListener('click', () => syncColor(b.dataset.target, b.dataset.color)));

  // 8. COUNTERS
  const counterObs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target, target = +el.dataset.target || 0, suffix = el.dataset.suffix || '';
      const start = performance.now();
      const tick = now => {
        const p = Math.min((now - start) / 1800, 1);
        el.textContent = Math.round(target * (1 - Math.pow(1 - p, 4))) + suffix;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      counterObs.unobserve(el);
    });
  }, { threshold: 0.5 });
  $$('.counter').forEach(c => counterObs.observe(c));

  // 9. REVIEW AUTO-SCROLL
  const track = $('.review-track');
  if (track) {
    let dir = 1, auto;
    const go = () => { auto = setInterval(() => {
      track.scrollLeft += dir * 0.6;
      if (track.scrollLeft >= track.scrollWidth - track.clientWidth - 2) dir = -1;
      if (track.scrollLeft <= 2) dir = 1;
    }, 25); };
    go();
    track.addEventListener('mouseenter', () => clearInterval(auto));
    track.addEventListener('mouseleave', go);
    track.addEventListener('touchstart', () => clearInterval(auto), { passive: true });
    track.addEventListener('touchend', () => setTimeout(go, 3000));
  }

  // 10. FORM
  const form = $('#contact-form');
  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const fd = new FormData(form);
      const name = fd.get('name')?.trim(), phone = fd.get('phone')?.trim(), city = fd.get('city')?.trim(), product = fd.get('product');
      if (!name || !phone || !city || !product) return;
      const ok = $('#form-ok');
      if (ok) ok.classList.add('visible');
      form.reset();
      const msg = encodeURIComponent(`Hi Zentaro! I'm ${name} from ${city}. Interested in ${product}. Phone: ${phone}`);
      setTimeout(() => window.open(`https://wa.me/923000000000?text=${msg}`, '_blank'), 1000);
    });
  }

  // 11. BACK TO TOP
  const btt = $('#btt');
  if (btt) {
    window.addEventListener('scroll', () => btt.classList.toggle('show', window.scrollY > 500), { passive: true });
    btt.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  // 12. PARALLAX BREAK IMAGE
  const pxBg = document.querySelector('.parallax-bg img');
  if (pxBg) {
    window.addEventListener('scroll', () => {
      const sec = pxBg.closest('.parallax-break');
      if (!sec) return;
      const r = sec.getBoundingClientRect();
      if (r.bottom > 0 && r.top < window.innerHeight) {
        const ratio = (window.innerHeight - r.top) / (window.innerHeight + r.height);
        pxBg.style.transform = `translateY(${(ratio - 0.5) * -60}px) scale(1.15)`;
      }
    }, { passive: true });
  }

  // 13. MARQUEE PAUSE ON HOVER
  const marquee = $('.marquee-track');
  if (marquee) {
    marquee.addEventListener('mouseenter', () => { marquee.style.animationPlayState = 'paused'; });
    marquee.addEventListener('mouseleave', () => { marquee.style.animationPlayState = 'running'; });
  }

  console.log('%c⚡ ZENTARO%c v5.2', 'background:#E11D48;color:#fff;font-weight:900;padding:4px 10px', 'background:#18181B;color:#A1A1AA;padding:4px 10px');
});
