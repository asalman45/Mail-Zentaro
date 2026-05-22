/* ═══════════════════════════════════════════════════════════
   ZENTARO — Complete Redesign v2 Script
   ═══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  const $ = (s, p) => (p || document).querySelector(s);
  const $$ = (s, p) => [...(p || document).querySelectorAll(s)];

  // ── 1. LOADER ──
  const loader = $('#loader');
  if (loader) {
    window.addEventListener('load', () => {
      setTimeout(() => {
        loader.classList.add('done');
        setTimeout(() => loader.remove(), 600);
      }, 800);
    });
    // Fallback: hide after 3s no matter what
    setTimeout(() => { if (loader) { loader.classList.add('done'); } }, 3000);
  }

  // ── 2. NAVBAR SCROLL ──
  const nav = $('#nav');
  if (nav) {
    const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // ── 3. MOBILE MENU ──
  const burger = $('.hamburger');
  const mobMenu = $('.mob-menu');
  if (burger && mobMenu) {
    burger.addEventListener('click', () => {
      burger.classList.toggle('open');
      mobMenu.classList.toggle('open');
      document.body.style.overflow = mobMenu.classList.contains('open') ? 'hidden' : '';
    });
    $$('.mob-link', mobMenu).forEach(link => {
      link.addEventListener('click', () => {
        burger.classList.remove('open');
        mobMenu.classList.remove('open');
        document.body.style.overflow = '';
      });
    });
  }

  // ── 4. SMOOTH SCROLL ──
  $$('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      if (id === '#') return;
      const el = $(id);
      if (el) {
        e.preventDefault();
        const top = el.getBoundingClientRect().top + window.scrollY - 72;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });

  // ── 5. SCROLL REVEAL ──
  const revealObs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const delay = entry.target.dataset.delay || 0;
        setTimeout(() => entry.target.classList.add('show'), +delay);
        revealObs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
  $$('.reveal').forEach(el => revealObs.observe(el));

  // ── 6. ACTIVE NAV LINK ──
  const sections = $$('section[id]');
  const navLinks = $$('.nav-link');
  const activeObs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        navLinks.forEach(link => {
          link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
        });
      }
    });
  }, { threshold: 0.3 });
  sections.forEach(s => activeObs.observe(s));

  // ── 7. COLOR SELECTORS (Card dots) ──
  const imgMap = {
    zt125: { red: 'images/zt125-red.png', black: 'images/zt125-black.png', white: 'images/zt125-white.png' },
    ze2000: { red: 'images/scooter-red.png', blue: 'images/scooter-blue.jpg' }
  };

  // Card color dots
  $$('.cdot').forEach(dot => {
    dot.addEventListener('click', () => {
      const product = dot.dataset.product;
      const color = dot.dataset.color;
      if (!product || !color || !imgMap[product] || !imgMap[product][color]) return;

      // Update card dot active state
      $$('.cdot').filter(d => d.dataset.product === product).forEach(d => d.classList.remove('on'));
      dot.classList.add('on');

      // Update card image
      const cardImg = $(`#${product}-card-img`);
      if (cardImg) { cardImg.style.opacity = '0'; setTimeout(() => { cardImg.src = imgMap[product][color]; cardImg.style.opacity = '1'; }, 200); }

      // Update detail image
      const detailImg = $(`#${product}-detail-img`);
      if (detailImg) { detailImg.style.opacity = '0'; setTimeout(() => { detailImg.src = imgMap[product][color]; detailImg.style.opacity = '1'; }, 200); }
    });
  });

  // Detail color buttons
  $$('.cbtn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.target;
      const color = btn.dataset.color;
      if (!target || !color || !imgMap[target] || !imgMap[target][color]) return;

      // Update button active state
      $$('.cbtn').filter(b => b.dataset.target === target).forEach(b => b.classList.remove('on'));
      btn.classList.add('on');

      // Update detail image
      const detailImg = $(`#${target}-detail-img`);
      if (detailImg) { detailImg.style.opacity = '0'; setTimeout(() => { detailImg.src = imgMap[target][color]; detailImg.style.opacity = '1'; }, 200); }

      // Update card image
      const cardImg = $(`#${target}-card-img`);
      if (cardImg) { cardImg.style.opacity = '0'; setTimeout(() => { cardImg.src = imgMap[target][color]; cardImg.style.opacity = '1'; }, 200); }

      // Sync card dots
      $$('.cdot').filter(d => d.dataset.product === target).forEach(d => {
        d.classList.toggle('on', d.dataset.color === color);
      });
    });
  });

  // ── 8. ANIMATED COUNTERS ──
  const counterObs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = parseInt(el.dataset.target) || 0;
        const suffix = el.dataset.suffix || '';
        const duration = 1800;
        const start = performance.now();

        const animate = (now) => {
          const elapsed = now - start;
          const progress = Math.min(elapsed / duration, 1);
          const ease = 1 - Math.pow(1 - progress, 4); // easeOutQuart
          const current = Math.round(target * ease);
          el.textContent = current + suffix;
          if (progress < 1) requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
        counterObs.unobserve(el);
      }
    });
  }, { threshold: 0.5 });
  $$('.counter').forEach(c => counterObs.observe(c));

  // ── 9. CONTACT FORM ──
  const form = $('#contact-form');
  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const fd = new FormData(form);
      const name = fd.get('name')?.trim();
      const phone = fd.get('phone')?.trim();
      const city = fd.get('city')?.trim();
      const product = fd.get('product');

      if (!name || !phone || !city || !product) return;

      // Show success
      const ok = $('#form-ok');
      if (ok) ok.classList.add('visible');
      form.reset();

      // Open WhatsApp
      const msg = encodeURIComponent(`Hi Zentaro! I'm ${name} from ${city}. I'm interested in ${product}. Phone: ${phone}`);
      setTimeout(() => {
        window.open(`https://wa.me/923000000000?text=${msg}`, '_blank');
      }, 1000);
    });
  }

  // ── 10. BACK TO TOP ──
  const btt = $('#btt');
  if (btt) {
    window.addEventListener('scroll', () => {
      btt.classList.toggle('show', window.scrollY > 500);
    }, { passive: true });
    btt.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  console.log('%cZENTARO%c v2.0 — Built for Pakistan 🏍️', 'background:#E11D48;color:#fff;font-weight:bold;padding:4px 8px;border-radius:4px 0 0 4px;', 'background:#18181B;color:#fff;padding:4px 8px;border-radius:0 4px 4px 0;');
});
