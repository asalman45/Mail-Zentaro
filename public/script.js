/* ═══════════════════════════════════════════════════════════
   ZENTARO v4 — Ultra Premium Interactive Script
   ═══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  const $ = (s, p) => (p || document).querySelector(s);
  const $$ = (s, p) => [...(p || document).querySelectorAll(s)];

  // ═══ 1. PARTICLE BACKGROUND ═══
  const canvas = $('#particles');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    let W, H, particles = [];
    const resize = () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    class Particle {
      constructor() { this.reset(); }
      reset() {
        this.x = Math.random() * W;
        this.y = Math.random() * H;
        this.size = Math.random() * 1.5 + 0.3;
        this.speedX = (Math.random() - 0.5) * 0.3;
        this.speedY = (Math.random() - 0.5) * 0.3;
        this.opacity = Math.random() * 0.4 + 0.05;
        this.color = Math.random() > 0.7 ? '225,29,72' : '255,255,255';
      }
      update() {
        this.x += this.speedX;
        this.y += this.speedY;
        if (this.x < 0 || this.x > W || this.y < 0 || this.y > H) this.reset();
      }
      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${this.color},${this.opacity})`;
        ctx.fill();
      }
    }

    for (let i = 0; i < 60; i++) particles.push(new Particle());

    const animate = () => {
      ctx.clearRect(0, 0, W, H);
      particles.forEach(p => { p.update(); p.draw(); });

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.strokeStyle = `rgba(225,29,72,${0.03 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }
      requestAnimationFrame(animate);
    };
    animate();
  }

  // ═══ 2. LOADER ═══
  const loader = $('#loader');
  if (loader) {
    window.addEventListener('load', () => {
      setTimeout(() => { loader.classList.add('done'); setTimeout(() => loader.remove(), 800); }, 800);
    });
    setTimeout(() => { if (loader && !loader.classList.contains('done')) loader.classList.add('done'); }, 3500);
  }

  // ═══ 3. NAVBAR ═══
  const nav = $('#nav');
  if (nav) {
    const tick = () => nav.classList.toggle('scrolled', window.scrollY > 50);
    window.addEventListener('scroll', tick, { passive: true });
    tick();
  }

  // ═══ 4. MOBILE MENU ═══
  const burger = $('.hamburger');
  const mob = $('.mob-menu');
  if (burger && mob) {
    burger.addEventListener('click', () => {
      burger.classList.toggle('open'); mob.classList.toggle('open');
      document.body.style.overflow = mob.classList.contains('open') ? 'hidden' : '';
    });
    $$('.mob-link', mob).forEach(l => l.addEventListener('click', () => {
      burger.classList.remove('open'); mob.classList.remove('open'); document.body.style.overflow = '';
    }));
  }

  // ═══ 5. SMOOTH SCROLL ═══
  $$('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      if (!id || id === '#') return;
      const el = $(id);
      if (el) { e.preventDefault(); window.scrollTo({ top: el.offsetTop - 76, behavior: 'smooth' }); }
    });
  });

  // ═══ 6. SCROLL REVEAL with stagger ═══
  const revealObs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const d = +(entry.target.dataset.delay || 0);
        setTimeout(() => entry.target.classList.add('show'), d);
        revealObs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.06, rootMargin: '0px 0px -50px 0px' });

  $$('.reveal, .reveal-left, .reveal-right').forEach((el, i) => {
    const parent = el.parentElement;
    if (parent && parent.children.length > 2) {
      const idx = [...parent.children].indexOf(el);
      if (!el.dataset.delay) el.dataset.delay = idx * 120;
    }
    revealObs.observe(el);
  });

  // ═══ 7. ACTIVE NAV ═══
  const navLinks = $$('.nav-link');
  const secObs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) navLinks.forEach(l => l.classList.toggle('active', l.getAttribute('href') === '#' + e.target.id));
    });
  }, { threshold: 0.2 });
  $$('section[id]').forEach(s => secObs.observe(s));

  // ═══ 8. COLOR SWAP ═══
  const imgMap = {
    zt125: { red: 'images/zt125-red.png', black: 'images/zt125-black.png', white: 'images/zt125-white.png' },
    ze2000: { red: 'images/scooter-red.png', blue: 'images/scooter-blue.jpg' }
  };

  const swapImg = (el, src) => {
    if (!el) return;
    el.style.opacity = '0'; el.style.transform = 'scale(.94)';
    setTimeout(() => { el.src = src; el.onload = () => { el.style.opacity = '1'; el.style.transform = ''; }; }, 280);
  };

  const syncColor = (product, color) => {
    if (!imgMap[product]?.[color]) return;
    const src = imgMap[product][color];
    swapImg($(`#${product}-card-img`), src);
    swapImg($(`#${product}-detail-img`), src);
    $$('.cdot').filter(d => d.dataset.product === product).forEach(d => d.classList.toggle('on', d.dataset.color === color));
    $$('.cbtn').filter(b => b.dataset.target === product).forEach(b => b.classList.toggle('on', b.dataset.color === color));
  };

  $$('.cdot').forEach(d => d.addEventListener('click', () => syncColor(d.dataset.product, d.dataset.color)));
  $$('.cbtn').forEach(b => b.addEventListener('click', () => syncColor(b.dataset.target, b.dataset.color)));

  // ═══ 9. COUNTERS ═══
  const counterObs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target, target = +el.dataset.target || 0, suffix = el.dataset.suffix || '';
      const start = performance.now();
      const tick = now => {
        const p = Math.min((now - start) / 2000, 1);
        el.textContent = Math.round(target * (1 - Math.pow(1 - p, 4))) + suffix;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      counterObs.unobserve(el);
    });
  }, { threshold: 0.5 });
  $$('.counter').forEach(c => counterObs.observe(c));

  // ═══ 10. 3D TILT on cards ═══
  $$('[data-tilt]').forEach(card => {
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = `perspective(900px) rotateX(${-y * 8}deg) rotateY(${x * 8}deg) translateY(-8px)`;
      // Glow follow
      const glow = card.querySelector('.prod-card-glow, .feat-card-bg');
      if (glow) {
        glow.style.background = `radial-gradient(circle 200px at ${e.clientX - r.left}px ${e.clientY - r.top}px, rgba(225,29,72,.06), transparent 60%)`;
        glow.style.opacity = '1';
      }
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
      card.style.transition = 'transform .6s cubic-bezier(.4,0,.2,1)';
      setTimeout(() => card.style.transition = '', 600);
      const glow = card.querySelector('.prod-card-glow, .feat-card-bg');
      if (glow) glow.style.opacity = '0';
    });
    card.addEventListener('mouseenter', () => { card.style.transition = 'none'; });
  });

  // ═══ 11. PARALLAX hero bike ═══
  const heroBike = $('.hero-bike img');
  if (heroBike) {
    window.addEventListener('scroll', () => {
      if (window.scrollY < window.innerHeight) {
        heroBike.style.transform = `translateY(${window.scrollY * 0.1}px)`;
      }
    }, { passive: true });
  }

  // ═══ 12. MAGNETIC BUTTONS ═══
  $$('.btn-glow, .btn-ghost').forEach(btn => {
    btn.addEventListener('mousemove', e => {
      const r = btn.getBoundingClientRect();
      const x = e.clientX - r.left - r.width / 2;
      const y = e.clientY - r.top - r.height / 2;
      btn.style.transform = `translate(${x * 0.12}px, ${y * 0.12}px) translateY(-4px) scale(1.02)`;
    });
    btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });
  });

  // ═══ 13. SPEC BOX CURSOR GLOW ═══
  $$('.spec-box').forEach(box => {
    box.addEventListener('mousemove', e => {
      const r = box.getBoundingClientRect();
      box.style.background = `radial-gradient(circle 60px at ${e.clientX - r.left}px ${e.clientY - r.top}px, rgba(225,29,72,.06), var(--bg2))`;
    });
    box.addEventListener('mouseleave', () => { box.style.background = ''; });
  });

  // ═══ 14. REVIEW AUTO-SCROLL ═══
  const track = $('.review-track');
  if (track) {
    let dir = 1, auto;
    const go = () => { auto = setInterval(() => {
      track.scrollLeft += dir * 0.8;
      if (track.scrollLeft >= track.scrollWidth - track.clientWidth - 2) dir = -1;
      if (track.scrollLeft <= 2) dir = 1;
    }, 20); };
    go();
    track.addEventListener('mouseenter', () => clearInterval(auto));
    track.addEventListener('mouseleave', go);
    track.addEventListener('touchstart', () => clearInterval(auto), { passive: true });
    track.addEventListener('touchend', () => setTimeout(go, 3000));
  }

  // ═══ 15. HERO TITLE ANIMATION ═══
  const heroTitle = $('.hero-title');
  if (heroTitle) {
    const lines = heroTitle.querySelectorAll('.hero-line');
    lines.forEach((line, li) => {
      const text = line.textContent;
      const span = line.querySelector('.dot-accent');
      let html = '';
      text.split('').forEach((ch, ci) => {
        if (ch === ' ') html += ' ';
        else html += `<span style="display:inline-block;opacity:0;transform:translateY(30px);animation:charIn .5s ${li * 0.3 + ci * 0.04 + 0.5}s forwards var(--ease)">${ch}</span>`;
      });
      if (span) html += `<span class="dot-accent" style="display:inline-block;opacity:0;animation:charIn .5s ${li * 0.3 + text.length * 0.04 + 0.5}s forwards var(--ease)">.</span>`;
      line.innerHTML = html;
    });

    if (!$('#char-anim')) {
      const s = document.createElement('style');
      s.id = 'char-anim';
      s.textContent = '@keyframes charIn{to{opacity:1;transform:translateY(0)}}';
      document.head.appendChild(s);
    }
  }

  // ═══ 16. FORM ═══
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
      setTimeout(() => window.open(`https://wa.me/923000000000?text=${msg}`, '_blank'), 1200);
    });
  }

  // ═══ 17. BACK TO TOP ═══
  const btt = $('#btt');
  if (btt) {
    window.addEventListener('scroll', () => btt.classList.toggle('show', window.scrollY > 500), { passive: true });
    btt.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  // ═══ 18. SECTION DIVIDER GLOW ═══
  $$('.section-divider').forEach(div => {
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { div.style.opacity = e.isIntersecting ? '.35' : '.1'; });
    }, { threshold: 0.5 });
    obs.observe(div);
  });

  console.log('%c⚡ ZENTARO%c v4.0', 'background:linear-gradient(135deg,#E11D48,#F97316);color:#fff;font-weight:900;padding:6px 14px;border-radius:6px 0 0 6px;font-size:14px', 'background:#111;color:#9CA3AF;padding:6px 14px;border-radius:0 6px 6px 0;font-size:14px');
});
