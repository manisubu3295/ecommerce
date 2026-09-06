/* =========================================================
   MAADHAVI — interactions.  Demo build · Aadhirai Innovations
   Real contact details go in CONFIG; sample prices in SERVICES.
   ========================================================= */
'use strict';

const CONFIG = {
  whatsapp: '919442210108',              // country code + number, digits only (sample)
  email: 'hello@maadhavistudio.in',
  instagram: 'https://instagram.com/maadhavi.bridal'
};
const THEMES = ['traditional', 'jewel', 'soft', 'gold'];
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

document.addEventListener('DOMContentLoaded', () => {
  themeSwitch();
  contactLinks();
  stickyBar();
  drawer();
  reveal();
  heroDepth();
  tilt3d();
  filter();
  lightbox();
  serviceTabs();
  accordions();
  areaMap();
  bookingButtons();
  bookingForm();
  $('#year').textContent = new Date().getFullYear();
});

/* ---- hero: entrance + pointer / scroll parallax ---- */
function heroDepth() {
  const hero = $('.hero');
  if (!hero) return;
  requestAnimationFrame(() => requestAnimationFrame(() => hero.classList.add('ready')));
  if (REDUCED) return;

  let tx = 0, ty = 0, x = 0, y = 0, raf = 0, onScreen = true;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const loop = () => {
    x += (tx - x) * 0.12; y += (ty - y) * 0.12;
    hero.style.setProperty('--hx', x.toFixed(3));
    hero.style.setProperty('--hy', y.toFixed(3));
    raf = (Math.abs(tx - x) > 0.001 || Math.abs(ty - y) > 0.001) ? requestAnimationFrame(loop) : 0;
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };
  if (fine) {
    hero.addEventListener('pointermove', e => {
      const r = hero.getBoundingClientRect();
      tx = (e.clientX - r.left) / r.width - 0.5;
      ty = (e.clientY - r.top) / r.height - 0.5;
      kick();
    });
    hero.addEventListener('pointerleave', () => { tx = ty = 0; kick(); });
  }
  const onScroll = () => {
    if (!onScreen) return;
    hero.style.setProperty('--hs', Math.min(1, Math.max(0, scrollY / (hero.offsetHeight || innerHeight))).toFixed(3));
  };
  onScroll();
  addEventListener('scroll', onScroll, { passive: true });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(es => { onScreen = es[0].isIntersecting; }, { threshold: 0 }).observe(hero);
  }
}

/* ---- mouse-follow 3D tilt on cards ---- */
function tilt3d() {
  if (REDUCED || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const MAX = 7;
  $$('.why__card, .price-card, .look__card, .rev-card, .about__img').forEach(card => {
    card.classList.add('tilt3d');
    let raf = 0, ex = 0, ey = 0;
    const apply = () => {
      const r = card.getBoundingClientRect();
      const px = Math.min(1, Math.max(0, (ex - r.left) / r.width));
      const py = Math.min(1, Math.max(0, (ey - r.top) / r.height));
      card.style.setProperty('--ry', ((px - 0.5) * MAX).toFixed(2) + 'deg');
      card.style.setProperty('--rx', ((0.5 - py) * MAX).toFixed(2) + 'deg');
      card.style.setProperty('--ty', '-8px');
      card.style.setProperty('--gx', (px * 100).toFixed(1) + '%');
      card.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
      raf = 0;
    };
    card.addEventListener('pointerenter', () => card.classList.add('tilting'));
    card.addEventListener('pointermove', e => { ex = e.clientX; ey = e.clientY; if (!raf) raf = requestAnimationFrame(apply); });
    card.addEventListener('pointerleave', () => {
      card.classList.remove('tilting');
      ['--rx', '--ry', '--ty', '--gx', '--gy'].forEach(v => card.style.removeProperty(v));
    });
  });
}

/* ---- colour theme ---- */
function themeSwitch() {
  const root = document.documentElement;
  const selects = ['#themeSelect', '#themeSelectM'].map(s => $(s)).filter(Boolean);
  let current = THEMES.find(t => root.classList.contains('t-' + t)) || 'traditional';
  const meta = { traditional: '#5C1A2B', jewel: '#0F5C4A', soft: '#6E2233', gold: '#5C1A2B' };
  const apply = (t, save) => {
    if (!THEMES.includes(t)) t = 'traditional';
    THEMES.forEach(x => root.classList.toggle('t-' + x, x === t));
    selects.forEach(s => { if (s.value !== t) s.value = t; });
    current = t;
    if (save) { try { localStorage.setItem('maadhavi-theme', t); } catch (e) {} }
    const m = $('meta[name="theme-color"]'); if (m) m.content = meta[t];
  };
  selects.forEach(s => s.addEventListener('change', () => apply(s.value, true)));
  apply(current, false);
}

/* ---- contact links ---- */
function contactLinks() {
  $$('[data-role="wa"]').forEach(a => { a.href = 'https://wa.me/' + CONFIG.whatsapp; a.target = '_blank'; a.rel = 'noopener'; });
  $$('[data-role="mail"]').forEach(a => { a.href = 'mailto:' + CONFIG.email; });
  $$('[data-role="ig"]').forEach(a => { a.href = CONFIG.instagram; a.target = '_blank'; a.rel = 'noopener'; });
}

/* ---- sticky header ---- */
function stickyBar() {
  const el = $('#topbar');
  const f = () => el.classList.toggle('stuck', window.scrollY > 6);
  f();
  addEventListener('scroll', f, { passive: true });
}

/* ---- mobile drawer ---- */
function drawer() {
  const b = $('#burger'), d = $('#drawer');
  const set = o => { b.setAttribute('aria-expanded', String(o)); d.hidden = !o; };
  b.addEventListener('click', () => set(b.getAttribute('aria-expanded') !== 'true'));
  d.addEventListener('click', e => { if (e.target.closest('a')) set(false); });
  addEventListener('keydown', e => { if (e.key === 'Escape') set(false); });
}

/* ---- reveal on scroll ---- */
function reveal() {
  const items = $$('.reveal');
  if (REDUCED || !('IntersectionObserver' in window)) { items.forEach(el => el.classList.add('in')); return; }
  const io = new IntersectionObserver(es => {
    es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  items.forEach(el => io.observe(el));
}

/* ---- portfolio filter ---- */
function filter() {
  const chips = $$('.filters .chip'), shots = $$('#gallery .shot');
  chips.forEach(c => c.addEventListener('click', () => {
    chips.forEach(x => { x.classList.remove('active'); x.setAttribute('aria-pressed', 'false'); });
    c.classList.add('active'); c.setAttribute('aria-pressed', 'true');
    const f = c.dataset.filter;
    shots.forEach(s => s.classList.toggle('hidden', f !== 'all' && s.dataset.cat !== f));
  }));
}

/* ---- lightbox ---- */
function lightbox() {
  const box = $('#lightbox'), img = $('#lightboxImg'), cap = $('#lightboxCap'), x = $('#lightboxClose');
  let last = null;
  const open = fig => {
    const src = fig.querySelector('img');
    last = fig;
    img.src = src.src; img.alt = src.alt || '';
    cap.textContent = (fig.querySelector('figcaption') || {}).textContent || '';
    box.hidden = false; document.body.style.overflow = 'hidden'; x.focus();
  };
  const close = () => { box.hidden = true; document.body.style.overflow = ''; if (last) last.focus(); };
  $$('#gallery .shot').forEach(f => f.addEventListener('click', () => open(f)));
  x.addEventListener('click', close);
  box.addEventListener('click', e => { if (e.target === box) close(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !box.hidden) close(); });
}

/* ---- services tabs ---- */
const SERVICES = [
  { name: 'Bridal — muhurtham',
    blurb: 'The full wedding-morning chair: skin prep, an HD or airbrush base, eyes built to your outfit, lash, lip, and a setting routine tested against Tamil Nadu heat.',
    price: '₹ 18,000', priceNote: 'one event, at the studio; on-location quoted separately',
    coverage: 'HD or airbrush', time: '≈ 90 minutes',
    includes: ['Pre-wedding skin consult and face mapping', 'HD or airbrush base, your choice', 'Individual or strip lashes', 'Draping of one outfit — saree or lehenga', 'A small touch-up kit to keep'],
    add: ['Hair styling', 'Jewellery setting', 'Call before 5 am', 'Second outfit drape'] },
  { name: 'Reception',
    blurb: 'A separate look for the stage — lifted contour, satin skin, and a stronger eye or lip that still reads under photography light and video.',
    price: '₹ 12,000', priceNote: 'as a same-day change from bridal, or on its own',
    coverage: 'HD, glow finish', time: '≈ 60 minutes',
    includes: ['A full change from the muhurtham look', 'Contour and highlight for stage light', 'A bold eye or a bold lip — your call', 'Fresh lash', 'Set for six to eight hours of photos'],
    add: ['Hair restyle', 'Cut-crease or glitter eye', 'Body makeup — arms, back', 'Colour-matched nails'] },
  { name: 'Engagement & seer',
    blurb: 'Softer, daytime makeup for the engagement, nichayathartham or seer — polished, but a long way short of full bridal.',
    price: '₹ 9,000', priceNote: 'at the studio; travel quoted upfront',
    coverage: 'medium, natural', time: '≈ 50 minutes',
    includes: ['Skin prep and a light-to-medium base', 'A soft, defined eye', 'A nude or berry lip', 'Strip lash', 'Saree or half-saree drape'],
    add: ['Hair styling', 'Mother and sister makeup', 'Location travel', 'A look trial'] },
  { name: 'Party & guest',
    blurb: 'For sisters, cousins and friends at the wedding — quick, camera-ready, and scheduled around the bride so no one runs late.',
    price: '₹ 3,500 per face', priceNote: 'minimum two faces; group rate on request',
    coverage: 'light to medium', time: '≈ 30 minutes each',
    includes: ['A base matched to skin tone', 'One coordinated eye look for the group', 'Lip and blush', 'Strip lash', 'A quick drape or dupatta set'],
    add: ['Hair — open, braid or bun', 'On-location team booking', 'Flower girls', 'Saree pre-pleating'] },
  { name: 'Groom',
    blurb: 'Matte, undetectable grooming — even skin tone, controlled shine, and a tidy beard for the muhurtham and the reception.',
    price: '₹ 4,000', priceNote: 'add to any bridal booking',
    coverage: 'sheer, matte', time: '≈ 25 minutes',
    includes: ['Cleanse and a de-tan touch', 'A sheer even-tone base', 'Beard tidy and fill', 'Shine-control powder', 'A reception refresh'],
    add: ['Hair styling', 'Both events, same day', 'Groomsmen, per face', 'On-location'] }
];
function serviceTabs() {
  const tabs = $$('.tabs .tab'), panel = $('#servicePanel');
  const tick = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 13l4 4L19 7"/></svg>';
  const draw = i => {
    const s = SERVICES[i];
    panel.innerHTML =
      '<div>' +
        '<h3>' + s.name + '</h3>' +
        '<p class="panel__blurb">' + s.blurb + '</p>' +
        '<p class="panel__lbl">In the chair</p>' +
        '<ul class="panel__list">' + s.includes.map(x => '<li>' + tick + '<span>' + x + '</span></li>').join('') + '</ul>' +
        '<p class="panel__lbl">Add on</p>' +
        '<div class="panel__add">' + s.add.map(a => '<span>' + a + '</span>').join('') + '</div>' +
      '</div>' +
      '<aside class="panel__aside">' +
        '<p class="panel__lbl">From</p>' +
        '<div class="panel__price">' + s.price + '</div>' +
        '<p class="muted">' + s.priceNote + '</p>' +
        '<div class="panel__meta">Coverage — ' + s.coverage + '<br>Ready in — ' + s.time + '<br>Travel — quoted upfront</div>' +
        '<a class="btn btn-primary btn-block" href="#contact">Ask about this</a>' +
      '</aside>';
  };
  tabs.forEach((t, i) => t.addEventListener('click', () => {
    tabs.forEach(x => { x.classList.remove('active'); x.setAttribute('aria-selected', 'false'); });
    t.classList.add('active'); t.setAttribute('aria-selected', 'true');
    draw(i);
  }));
  draw(0);
}

/* ---- accordions ---- */
function accordions() {
  $$('.accordion').forEach(group => {
    const qs = $$('.ac-q', group);
    qs.forEach(q => q.addEventListener('click', () => {
      const open = q.getAttribute('aria-expanded') === 'true';
      qs.forEach(o => { o.setAttribute('aria-expanded', 'false'); o.nextElementSibling.style.maxHeight = null; });
      if (!open) { q.setAttribute('aria-expanded', 'true'); q.nextElementSibling.style.maxHeight = (q.nextElementSibling.scrollHeight + 24) + 'px'; }
    }));
  });
  addEventListener('resize', () => $$('.ac-q[aria-expanded="true"]').forEach(q => {
    q.nextElementSibling.style.maxHeight = (q.nextElementSibling.scrollHeight + 24) + 'px';
  }));
}

/* ---- service-area map ---- */
function areaMap() {
  const pin = $('#cityPin'), cities = $$('#cities .city');
  cities.forEach(c => c.addEventListener('click', () => {
    cities.forEach(x => x.classList.remove('active'));
    c.classList.add('active');
    pin.setAttribute('cx', c.dataset.x); pin.setAttribute('cy', c.dataset.y);
  }));
}

/* ---- pricing "Book X" buttons prefill the form ---- */
function bookingButtons() {
  const sel = $('#bkEvent');
  $$('[data-book]').forEach(b => b.addEventListener('click', () => {
    if (!sel) return;
    const v = b.dataset.book;
    if ([...sel.options].some(o => o.value === v || o.text === v)) sel.value = v;
  }));
}

/* ---- booking form -> WhatsApp / email ---- */
function bookingForm() {
  const form = $('#bookingForm'), status = $('#bookingStatus'), emailBtn = $('#emailInstead');
  const F = {
    name:  { el: $('#bkName'),  msg: 'Please tell me who I’m speaking with.' },
    phone: { el: $('#bkPhone'), msg: 'A number I can reach you on.', test: v => /\d{6,}/.test(v) },
    date:  { el: $('#bkDate'),  msg: 'Which day is the wedding?' },
    event: { el: $('#bkEvent'), msg: 'Pick the closest option.' },
    city:  { el: $('#bkCity'),  msg: 'The town the venue is in.' }
  };
  const mark = (k, on) => {
    const f = F[k].el.closest('.field');
    f.classList.toggle('bad', on);
    f.querySelector('.err').textContent = on ? F[k].msg : '';
  };
  const ok = () => {
    let good = true;
    Object.keys(F).forEach(k => {
      const v = F[k].el.value.trim();
      const bad = F[k].test ? !F[k].test(v) : !v;
      mark(k, bad); if (bad) good = false;
    });
    return good;
  };
  const text = () => {
    const g = id => $(id).value.trim();
    const n = g('#bkNote');
    return ['Hi Maadhavi,', '',
      'Name: ' + g('#bkName'),
      'WhatsApp: ' + g('#bkPhone'),
      'Wedding date: ' + g('#bkDate'),
      'For: ' + g('#bkEvent'),
      'Venue town: ' + g('#bkCity'),
      n ? 'Notes: ' + n : null,
      '', 'Could you let me know if you’re free, and roughly what it costs?'
    ].filter(x => x !== null).join('\n');
  };
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (!ok()) { status.textContent = 'Just fix the highlighted fields.'; return; }
    open('https://wa.me/' + CONFIG.whatsapp + '?text=' + encodeURIComponent(text()), '_blank', 'noopener');
    status.textContent = 'Opening WhatsApp with your details filled in…';
  });
  emailBtn.addEventListener('click', () => {
    if (!ok()) { status.textContent = 'Just fix the highlighted fields.'; return; }
    location.href = 'mailto:' + CONFIG.email + '?subject=' +
      encodeURIComponent('Bridal enquiry — ' + $('#bkDate').value) + '&body=' + encodeURIComponent(text());
    status.textContent = 'Opening your email app…';
  });
  Object.keys(F).forEach(k => F[k].el.addEventListener('input', () => {
    if (F[k].el.closest('.field').classList.contains('bad')) ok();
  }));
}
