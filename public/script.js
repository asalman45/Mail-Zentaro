/* ═══════════════════════════════════════════════════════════
   ZENTARO v3 — Interactive Premium Script
   ═══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  const $ = (s, p) => (p || document).querySelector(s);
  const $$ = (s, p) => [...(p || document).querySelectorAll(s)];

  // ── 1. LOADER ──
  const loader = $('#loader');
  if (loader) {
    window.addEventListener('load', () => {
      setTimeout(() => { loader.classList.add('done'); setTimeout(() => loader.remove(), 700); }, 600);
    });
    setTimeout(() => { if (loader && !loader.classList.contains('done')) loader.classList.add('done'); }, 3000);
  }

  // ── 2. NAVBAR ──
  const nav = $('#nav');
  let lastY = 0;
  if (nav) {
    const tick = () => {
      const y = window.scrollY;
      nav.classList.toggle('scrolled', y > 50);
      lastY = y;
    };
    window.addEventListener('scroll', tick, { passive: true });
    tick();
  }

  // ── 3. MOBILE MENU ──
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

  // ── 4. SMOOTH SCROLL ──
  $$('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      if (!id || id === '#') return;
      const el = $(id);
      if (el) { e.preventDefault(); window.scrollTo({ top: el.offsetTop - 72, behavior: 'smooth' }); }
    });
  });

  // ── 5. SCROLL REVEAL — with stagger support ──
  const revealObs = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        const d = +(entry.target.dataset.delay || 0);
        setTimeout(() => entry.target.classList.add('show'), d);
        revealObs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -60px 0px' });
  $$('.reveal, .reveal-left, .reveal-right, .reveal-scale').forEach((el, i) => {
    // Auto-stagger cards in grids
    if (el.parentElement && el.parentElement.children.length > 2) {
      const idx = [...el.parentElement.children].indexOf(el);
      if (!el.dataset.delay) el.dataset.delay = idx * 100;
    }
    revealObs.observe(el);
  });

  // ── 6. ACTIVE NAV ──
  const navLinks = $$('.nav-link');
  const secObs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        navLinks.forEach(l => l.classList.toggle('active', l.getAttribute('href') === '#' + e.target.id));
      }
    });
  }, { threshold: 0.25 });
  $$('section[id]').forEach(s => secObs.observe(s));

  // ── 7. COLOR SELECTORS ──
  const imgMap = {
    zt125: { red: 'images/zt125-red.png', black: 'images/zt125-black.png', white: 'images/zt125-white.png' },
    ze2000: { red: 'images/scooter-red.png', blue: 'images/scooter-blue.jpg' }
  };

  const swapImage = (imgEl, src) => {
    if (!imgEl) return;
    imgEl.style.opacity = '0';
    imgEl.style.transform = 'scale(.95)';
    setTimeout(() => {
      imgEl.src = src;
      imgEl.onload = () => {
        imgEl.style.opacity = '1';
        imgEl.style.transform = 'scale(1)';
      };
    }, 250);
  };

  const syncColor = (product, color) => {
    if (!imgMap[product] || !imgMap[product][color]) return;
    const src = imgMap[product][color];
    swapImage($(`#${product}-card-img`), src);
    swapImage($(`#${product}-detail-img`), src);
    $$('.cdot').filter(d => d.dataset.product === product).forEach(d => d.classList.toggle('on', d.dataset.color === color));
    $$('.cbtn').filter(b => b.dataset.target === product).forEach(b => b.classList.toggle('on', b.dataset.color === color));
  };

  $$('.cdot').forEach(d => d.addEventListener('click', () => syncColor(d.dataset.product, d.dataset.color)));
  $$('.cbtn').forEach(b => b.addEventListener('click', () => syncColor(b.dataset.target, b.dataset.color)));

  // ── 8. ANIMATED COUNTERS ──
  const counterObs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target;
      const target = +el.dataset.target || 0;
      const suffix = el.dataset.suffix || '';
      const start = performance.now();
      const dur = 2000;
      const tick = now => {
        const p = Math.min((now - start) / dur, 1);
        const ease = 1 - Math.pow(1 - p, 4);
        el.textContent = Math.round(target * ease) + suffix;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      counterObs.unobserve(el);
    });
  }, { threshold: 0.5 });
  $$('.counter').forEach(c => counterObs.observe(c));

  // ── 9. 3D TILT on product cards ──
  $$('.prod-card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = `perspective(800px) rotateX(${-y * 6}deg) rotateY(${x * 6}deg) translateY(-8px)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
      card.style.transition = 'transform .5s cubic-bezier(.4,0,.2,1)';
      setTimeout(() => card.style.transition = '', 500);
    });
    card.addEventListener('mouseenter', () => { card.style.transition = 'none'; });
  });

  // ── 10. PARALLAX on hero visual ──
  const heroImg = $('.hero-visual img');
  if (heroImg) {
    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      if (y < window.innerHeight) {
        heroImg.style.transform = `translateY(${y * 0.08}px)`;
      }
    }, { passive: true });
  }

  // ── 11. MAGNETIC BUTTONS ──
  $$('.btn-accent, .btn-outline').forEach(btn => {
    btn.addEventListener('mousemove', e => {
      const r = btn.getBoundingClientRect();
      const x = e.clientX - r.left - r.width / 2;
      const y = e.clientY - r.top - r.height / 2;
      btn.style.transform = `translate(${x * 0.15}px, ${y * 0.15}px) translateY(-3px)`;
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = '';
    });
  });

  // ── 12. SPEC BOX HOVER GLOW ──
  $$('.spec-box').forEach(box => {
    box.addEventListener('mousemove', e => {
      const r = box.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      box.style.background = `radial-gradient(circle 80px at ${x}px ${y}px, rgba(225,29,72,.08), var(--bg2))`;
    });
    box.addEventListener('mouseleave', () => { box.style.background = ''; });
  });

  // ── 13. FEATURE CARD CURSOR GLOW ──
  $$('.feat-card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      card.style.setProperty('--mx', x + 'px');
      card.style.setProperty('--my', y + 'px');
      card.style.background = `radial-gradient(circle 120px at ${x}px ${y}px, rgba(225,29,72,.06), transparent), linear-gradient(145deg,var(--bg2),var(--bg3))`;
    });
    card.addEventListener('mouseleave', () => { card.style.background = ''; });
  });

  // ── 14. REVIEW TRACK AUTO-SCROLL ──
  const track = $('.review-track');
  if (track) {
    let scrollDir = 1;
    let autoScroll;
    const startAuto = () => {
      autoScroll = setInterval(() => {
        track.scrollLeft += scrollDir;
        if (track.scrollLeft >= track.scrollWidth - track.clientWidth - 2) scrollDir = -1;
        if (track.scrollLeft <= 2) scrollDir = 1;
      }, 30);
    };
    startAuto();
    track.addEventListener('mouseenter', () => clearInterval(autoScroll));
    track.addEventListener('mouseleave', startAuto);
    track.addEventListener('touchstart', () => clearInterval(autoScroll), { passive: true });
    track.addEventListener('touchend', () => setTimeout(startAuto, 3000));
  }

  // ── 15. CONTACT FORM ──
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
      const ok = $('#form-ok');
      if (ok) ok.classList.add('visible');
      form.reset();
      const msg = encodeURIComponent(`Hi Zentaro! I'm ${name} from ${city}. Interested in ${product}. Phone: ${phone}`);
      setTimeout(() => window.open(`https://wa.me/923000000000?text=${msg}`, '_blank'), 1200);
    });
  }

  // ── 16. BACK TO TOP ──
  const btt = $('#btt');
  if (btt) {
    window.addEventListener('scroll', () => btt.classList.toggle('show', window.scrollY > 500), { passive: true });
    btt.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  // ── 17. HERO TITLE WORD ANIMATION ──
  const heroTitle = $('.hero-title');
  if (heroTitle) {
    const html = heroTitle.innerHTML;
    const lines = html.split('<br>');
    let newHtml = '';
    lines.forEach((line, li) => {
      // Preserve HTML tags like <span class="grad">
      const parts = line.split(/(<[^>]+>)/);
      let inTag = false;
      parts.forEach(part => {
        if (part.startsWith('<')) {
          newHtml += part;
          if (part.startsWith('</')) inTag = false;
          else inTag = true;
        } else {
          const words = part.split(/(\s+)/);
          words.forEach((w, wi) => {
            if (w.trim()) {
              newHtml += `<span style="display:inline-block;opacity:0;transform:translateY(20px);animation:wordIn .5s ${(li * 3 + wi) * .08 + .3}s forwards var(--ease)">${w}</span>`;
            } else {
              newHtml += w;
            }
          });
        }
      });
      if (li < lines.length - 1) newHtml += '<br>';
    });
    heroTitle.innerHTML = newHtml;

    // Inject keyframes
    if (!$('#word-anim-style')) {
      const s = document.createElement('style');
      s.id = 'word-anim-style';
      s.textContent = '@keyframes wordIn{to{opacity:1;transform:translateY(0)}}';
      document.head.appendChild(s);
    }
  }

  // ── 18. IMAGE LOADING TRANSITIONS ──
  $$('img[loading="lazy"]').forEach(img => {
    img.style.opacity = '0';
    img.style.transition = 'opacity .6s';
    if (img.complete) { img.style.opacity = '1'; }
    else { img.addEventListener('load', () => { img.style.opacity = '1'; }); }
  });

  // ── 19. TYPING EFFECT ON STAT VALUES ──
  $$('.stat').forEach((s, i) => {
    s.style.animationDelay = (i * 0.1) + 's';
  });

  console.log('%cZENTARO%c v3.0 — Premium Interactive', 'background:linear-gradient(135deg,#E11D48,#F97316);color:#fff;font-weight:bold;padding:4px 12px;border-radius:4px 0 0 4px;', 'background:#18181B;color:#fff;padding:4px 12px;border-radius:0 4px 4px 0;');
});
