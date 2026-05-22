/**
 * ============================================================
 *  ZENTARO — Premium Motorcycle & Scooter Brand
 *  Main Interactive Script  (vanilla ES6+, zero dependencies)
 * ============================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  /* --------------------------------------------------------
   *  0. UTILITY HELPERS
   * ------------------------------------------------------ */

  /** Safely query a single element */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);

  /** Safely query all matching elements */
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  /** Clamp a number between min and max */
  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

  /** EaseOutQuart curve for counter animation */
  const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);

  /** Navbar offset used for scroll calculations */
  const NAV_OFFSET = 80;

  /* --------------------------------------------------------
   *  1. PAGE LOADER
   * ------------------------------------------------------ */

  const loader = $('.loader');
  if (loader) {
    window.addEventListener('load', () => {
      loader.style.opacity = '0';
      loader.style.pointerEvents = 'none';
      setTimeout(() => {
        loader.style.display = 'none';
        document.body.classList.add('loaded');
      }, 500);
    });
  } else {
    document.body.classList.add('loaded');
  }

  /* --------------------------------------------------------
   *  2. NAVBAR SCROLL EFFECT  (transparent → glassmorphism)
   * ------------------------------------------------------ */

  const navbar = $('#navbar');

  const handleNavbarScroll = () => {
    if (!navbar) return;
    if (window.scrollY > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  };

  window.addEventListener('scroll', handleNavbarScroll, { passive: true });
  handleNavbarScroll(); // run once on load

  /* --------------------------------------------------------
   *  3. MOBILE MENU
   * ------------------------------------------------------ */

  const hamburger = $('.hamburger');
  const mobileMenu = $('.mobile-menu');

  const closeMobileMenu = () => {
    if (!hamburger || !mobileMenu) return;
    hamburger.classList.remove('active');
    mobileMenu.classList.remove('active');
    document.body.style.overflow = '';
  };

  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', () => {
      const isOpen = hamburger.classList.toggle('active');
      mobileMenu.classList.toggle('active');
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    // Close menu when any nav link inside it is clicked
    $$('a', mobileMenu).forEach((link) => {
      link.addEventListener('click', closeMobileMenu);
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeMobileMenu();
    });
  }

  /* --------------------------------------------------------
   *  4. SMOOTH SCROLL NAVIGATION
   * ------------------------------------------------------ */

  $$('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (e) => {
      const targetId = anchor.getAttribute('href');
      if (targetId === '#' || targetId === '') return;

      const target = $(targetId);
      if (!target) return;

      e.preventDefault();

      const top = target.getBoundingClientRect().top + window.scrollY - NAV_OFFSET;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });

  /* --------------------------------------------------------
   *  5. ACTIVE NAVIGATION HIGHLIGHTING
   * ------------------------------------------------------ */

  const navLinks = $$('a[href^="#"]').filter((a) => {
    const href = a.getAttribute('href');
    return href && href.length > 1 && $(href);
  });

  const sections = navLinks
    .map((a) => $(a.getAttribute('href')))
    .filter(Boolean);

  const highlightNav = () => {
    let currentId = '';

    sections.forEach((section) => {
      const rect = section.getBoundingClientRect();
      if (rect.top <= NAV_OFFSET + 60) {
        currentId = '#' + section.id;
      }
    });

    navLinks.forEach((link) => {
      link.classList.toggle('active', link.getAttribute('href') === currentId);
    });
  };

  window.addEventListener('scroll', highlightNav, { passive: true });
  highlightNav();

  /* --------------------------------------------------------
   *  6. SCROLL-REVEAL ANIMATIONS  (Intersection Observer)
   * ------------------------------------------------------ */

  const revealElements = $$('.reveal');

  if (revealElements.length) {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          const el = entry.target;
          const delay = parseInt(el.dataset.delay, 10) || 0;

          setTimeout(() => el.classList.add('active'), delay);
          revealObserver.unobserve(el); // reveal once only
        });
      },
      { threshold: 0.15 }
    );

    revealElements.forEach((el) => revealObserver.observe(el));
  }

  /* --------------------------------------------------------
   *  7. ANIMATED NUMBER COUNTERS
   * ------------------------------------------------------ */

  const counters = $$('.counter');

  const animateCounter = (el) => {
    const target = parseInt(el.dataset.target, 10);
    const suffix = el.dataset.suffix || '';
    const duration = 2000; // ms
    let start = null;

    const step = (timestamp) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const value = Math.floor(easeOutQuart(progress) * target);
      el.textContent = value + suffix;

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        el.textContent = target + suffix;
      }
    };

    requestAnimationFrame(step);
  };

  if (counters.length) {
    const counterObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          animateCounter(entry.target);
          counterObserver.unobserve(entry.target);
        });
      },
      { threshold: 0.3 }
    );

    counters.forEach((c) => counterObserver.observe(c));
  }

  /* --------------------------------------------------------
   *  8. HERO TYPEWRITER / WORD-BY-WORD FADE-IN
   * ------------------------------------------------------ */

  const heroTitle = $('#hero-title');

  if (heroTitle) {
    const text = heroTitle.textContent.trim();
    const words = text.split(/\s+/);
    heroTitle.textContent = '';
    heroTitle.style.visibility = 'visible';

    words.forEach((word, i) => {
      const span = document.createElement('span');
      span.textContent = word + ' ';
      span.style.cssText = `
        opacity: 0;
        display: inline-block;
        transform: translateY(12px);
        transition: opacity 0.45s ease, transform 0.45s ease;
        transition-delay: ${i * 0.1}s;
      `;
      heroTitle.appendChild(span);
    });

    // Trigger the animation after a tiny layout tick
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        $$('span', heroTitle).forEach((span) => {
          span.style.opacity = '1';
          span.style.transform = 'translateY(0)';
        });
      });
    });
  }

  /* --------------------------------------------------------
   *  9. PRODUCT COLOR SELECTOR — Generic Helper
   * ------------------------------------------------------ */

  /**
   * Wire up a color-selector widget.
   *
   * @param {string}  containerSel  – CSS selector for the detail container
   * @param {string}  imageSel      – CSS selector for the main image
   * @param {string}  cardImageSel  – CSS selector for the product-card image
   * @param {Object}  colorMap      – { colorName: imageSrc, … }
   */
  const initColorSelector = (containerSel, imageSel, cardImageSel, colorMap) => {
    const container = $(containerSel);
    if (!container) return;

    const dots = $$('.color-dot', container);
    const mainImage = $(imageSel);
    const cardImage = $(cardImageSel);

    if (!dots.length || !mainImage) return;

    const swapImage = (img, src) => {
      if (!img) return;
      img.style.opacity = '0';
      setTimeout(() => {
        img.src = src;
        img.style.opacity = '1';
      }, 300);
    };

    dots.forEach((dot) => {
      dot.addEventListener('click', () => {
        const color = dot.dataset.color;
        const src = colorMap[color];
        if (!src) return;

        // Toggle active dot
        dots.forEach((d) => d.classList.remove('active'));
        dot.classList.add('active');

        // Cross-fade images
        swapImage(mainImage, src);
        swapImage(cardImage, src);
      });
    });

    // Ensure images have transition styles
    [mainImage, cardImage].forEach((img) => {
      if (img) img.style.transition = 'opacity 0.3s ease';
    });
  };

  /* --- ZT 125 Detail --- */
  initColorSelector('#zt125-detail', '#zt125-image', '#zt125-card-image', {
    red: 'images/zt125-red.png',
    black: 'images/zt125-black.png',
    white: 'images/zt125-white.png',
  });

  /* --- ZE 2000 Scooter Detail --- */
  initColorSelector('#ze2000-detail', '#ze2000-image', '#ze2000-card-image', {
    red: 'images/scooter-red.png',
    blue: 'images/scooter-blue.jpg',
  });

  /* --- Card-level Color Dots (Product Overview) --- */
  const zt125ColorMap = {
    red: 'images/zt125-red.png',
    black: 'images/zt125-black.png',
    white: 'images/zt125-white.png',
  };

  const ze2000ColorMap = {
    red: 'images/scooter-red.png',
    blue: 'images/scooter-blue.jpg',
  };

  // Card dots for ZT 125
  $$('.color-dot[data-product="zt125-card"]').forEach((dot) => {
    dot.addEventListener('click', () => {
      const color = dot.dataset.color;
      const src = zt125ColorMap[color];
      if (!src) return;
      const cardImg = $('#zt125-card-image');
      if (cardImg) {
        cardImg.style.opacity = '0';
        setTimeout(() => { cardImg.src = src; cardImg.style.opacity = '1'; }, 300);
      }
      $$('.color-dot[data-product="zt125-card"]').forEach(d => d.classList.remove('active'));
      dot.classList.add('active');
    });
  });

  // Card dots for ZE 2000
  $$('.color-dot[data-product="ze2000-card"]').forEach((dot) => {
    dot.addEventListener('click', () => {
      const color = dot.dataset.color;
      const src = ze2000ColorMap[color];
      if (!src) return;
      const cardImg = $('#ze2000-card-image');
      if (cardImg) {
        cardImg.style.opacity = '0';
        setTimeout(() => { cardImg.src = src; cardImg.style.opacity = '1'; }, 300);
      }
      $$('.color-dot[data-product="ze2000-card"]').forEach(d => d.classList.remove('active'));
      dot.classList.add('active');
    });
  });

  // Wire up .color-btn buttons (detail sections) to also trigger swaps
  $$('.color-btn[data-target="zt125"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const color = btn.dataset.color;
      const src = zt125ColorMap[color];
      if (!src) return;
      const img = $('#zt125-image');
      const cardImg = $('#zt125-card-image');
      [img, cardImg].forEach(el => {
        if (el) { el.style.opacity = '0'; setTimeout(() => { el.src = src; el.style.opacity = '1'; }, 300); }
      });
      $$('.color-btn[data-target="zt125"]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  $$('.color-btn[data-target="ze2000"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const color = btn.dataset.color;
      const src = ze2000ColorMap[color];
      if (!src) return;
      const img = $('#ze2000-image');
      const cardImg = $('#ze2000-card-image');
      [img, cardImg].forEach(el => {
        if (el) { el.style.opacity = '0'; setTimeout(() => { el.src = src; el.style.opacity = '1'; }, 300); }
      });
      $$('.color-btn[data-target="ze2000"]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  /* --------------------------------------------------------
   *  10. PRODUCT CARD HOVER PARALLAX (3D Tilt)
   * ------------------------------------------------------ */

  const productCards = $$('.product-card');

  productCards.forEach((card) => {
    card.style.transition = 'transform 0.2s ease';

    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const cx = rect.width / 2;
      const cy = rect.height / 2;

      // Rotation capped at ±8 degrees
      const rotateY = clamp(((x - cx) / cx) * 8, -8, 8);
      const rotateX = clamp(((cy - y) / cy) * 8, -8, 8);

      card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(800px) rotateX(0) rotateY(0) scale3d(1, 1, 1)';
    });
  });

  /* --------------------------------------------------------
   *  11. CONTACT FORM HANDLING
   * ------------------------------------------------------ */

  const contactForm = $('#contact-form');

  /**
   * Basic Pakistani phone validation:
   * Accepts 03XXXXXXXXX, +923XXXXXXXXX, 923XXXXXXXXX
   */
  const isValidPakistaniPhone = (phone) => {
    const cleaned = phone.replace(/[\s\-()]/g, '');
    return /^(\+?92|0)3\d{9}$/.test(cleaned);
  };

  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const formData = new FormData(contactForm);
      const name = (formData.get('name') || '').trim();
      const phone = (formData.get('phone') || '').trim();
      const city = (formData.get('city') || '').trim();
      const product = (formData.get('product') || '').trim();

      // --- Validation ---
      const errors = [];
      if (!name) errors.push('Please enter your name.');
      if (!phone) {
        errors.push('Please enter your phone number.');
      } else if (!isValidPakistaniPhone(phone)) {
        errors.push('Please enter a valid Pakistani phone number (e.g. 03XXXXXXXXX).');
      }
      if (!city) errors.push('Please enter your city.');
      if (!product) errors.push('Please select a product of interest.');

      // Show errors
      const errorContainer = $('#form-errors', contactForm) || $('#form-errors');
      if (errors.length) {
        if (errorContainer) {
          errorContainer.innerHTML = errors.map((err) => `<p>${err}</p>`).join('');
          errorContainer.style.display = 'block';
        } else {
          alert(errors.join('\n'));
        }
        return;
      }

      if (errorContainer) {
        errorContainer.style.display = 'none';
        errorContainer.innerHTML = '';
      }

      // --- Success ---
      const successMessage = $('#form-success') || $('#form-success-message');
      if (successMessage) {
        successMessage.textContent = 'Thank you! We will get in touch soon.';
        successMessage.style.display = 'block';
      }
      contactForm.reset();

      // Redirect to WhatsApp with template message
      const waText = encodeURIComponent(
        `Hello Zentaro! My name is ${name} from ${city}. I'm interested in the ${product}. Please contact me at ${phone}. Thank you!`
      );
      const waURL = `https://wa.me/923000000000?text=${waText}`;

      setTimeout(() => {
        window.open(waURL, '_blank', 'noopener');
      }, 800);
    });
  }

  /* --------------------------------------------------------
   *  12. FLOATING WHATSAPP BUTTON (pulse animation)
   * ------------------------------------------------------ */

  const waFloat = $('.whatsapp-float');

  if (waFloat) {
    // Inject pulse keyframes once
    if (!$('#wa-pulse-style')) {
      const style = document.createElement('style');
      style.id = 'wa-pulse-style';
      style.textContent = `
        @keyframes waPulse {
          0%   { box-shadow: 0 0 0 0 rgba(37, 211, 102, 0.5); }
          70%  { box-shadow: 0 0 0 18px rgba(37, 211, 102, 0); }
          100% { box-shadow: 0 0 0 0 rgba(37, 211, 102, 0); }
        }
        .whatsapp-float {
          animation: waPulse 2s infinite;
        }
      `;
      document.head.appendChild(style);
    }
  }

  /* --------------------------------------------------------
   *  13. BACK TO TOP BUTTON
   * ------------------------------------------------------ */

  const backToTop = $('#back-to-top');

  if (backToTop) {
    const toggleBackToTop = () => {
      if (window.scrollY > 500) {
        backToTop.classList.add('visible');
        backToTop.style.opacity = '1';
        backToTop.style.pointerEvents = 'auto';
      } else {
        backToTop.classList.remove('visible');
        backToTop.style.opacity = '0';
        backToTop.style.pointerEvents = 'none';
      }
    };

    window.addEventListener('scroll', toggleBackToTop, { passive: true });
    toggleBackToTop();

    backToTop.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* --------------------------------------------------------
   *  14. THROTTLED SCROLL HANDLER (combines lightweight tasks)
   * ------------------------------------------------------ */

  let ticking = false;

  const onScroll = () => {
    if (ticking) return;
    ticking = true;

    requestAnimationFrame(() => {
      handleNavbarScroll();
      highlightNav();
      if (backToTop) {
        if (window.scrollY > 500) {
          backToTop.classList.add('visible');
          backToTop.style.opacity = '1';
          backToTop.style.pointerEvents = 'auto';
        } else {
          backToTop.classList.remove('visible');
          backToTop.style.opacity = '0';
          backToTop.style.pointerEvents = 'none';
        }
      }
      ticking = false;
    });
  };

  window.addEventListener('scroll', onScroll, { passive: true });

  /* --------------------------------------------------------
   *  15. PREVENT FOUC — Mark ready
   * ------------------------------------------------------ */

  document.documentElement.classList.add('js-ready');

  /* --------------------------------------------------------
   *  CONSOLE BRANDING
   * ------------------------------------------------------ */

  console.log(
    '%c ZENTARO %c Premium Motorcycles & Scooters ',
    'background:#e30613;color:#fff;font-weight:bold;padding:4px 8px;border-radius:4px 0 0 4px;',
    'background:#1a1a1a;color:#fff;padding:4px 8px;border-radius:0 4px 4px 0;'
  );
});
