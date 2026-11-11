/* EN / FR switch. English is the source text in the HTML. French lives in fr.js,
   keyed by the normalised innerHTML of each text unit, so the markup needs no changes. */
(function () {
  var FR = window.ZH_FR || {};
  var UI = window.ZH_UI || {};
  var lang = 'en';
  try { var saved = localStorage.getItem('zh-lang'); if (saved === 'fr' || saved === 'en') lang = saved; } catch (e) {}

  var BLOCK = 'div,p,ul,ol,li,h1,h2,h3,h4,h5,h6,figure,figcaption,section,table,thead,tbody,tr,nav,header,footer,main,aside,svg,video,canvas,button,input,select,textarea,label,form,details,summary';
  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, SVG: 1, VIDEO: 1, CANVAS: 1 };

  function norm(s) { return s.replace(/\s+/g, ' ').trim(); }

  var DYN = '[data-out],[data-act="spin"],.theme-toggle,.lang-toggle,[data-copy]';
  var units = [], texts = [];

  function walk(el) {
    if (SKIP[el.tagName.toUpperCase()] || el.matches('[data-no-i18n]') || el.matches(DYN)) return;
    if (!el.textContent.trim()) return;
    if (el.querySelector(BLOCK) || el.querySelector(DYN)) {
      el.childNodes.forEach(function (n) {
        if (n.nodeType === 1) walk(n);
        else if (n.nodeType === 3 && n.nodeValue.trim()) texts.push(n);
      });
    } else {
      units.push(el);
    }
  }
  walk(document.body);
  units.forEach(function (el) { el.__en = norm(el.innerHTML); });
  texts.forEach(function (n) {
    n.__en = norm(n.nodeValue);
    n.__lead = /^\s/.test(n.nodeValue) ? ' ' : '';
    n.__trail = /\s$/.test(n.nodeValue) ? ' ' : '';
  });

  var attrEls = [];
  document.querySelectorAll('[alt],[aria-label],[title]').forEach(function (el) {
    ['alt', 'aria-label', 'title'].forEach(function (a) {
      if (el.hasAttribute(a)) attrEls.push({ el: el, a: a, en: el.getAttribute(a) });
    });
  });
  var metas = [];
  document.querySelectorAll('meta[name="description"],meta[property="og:title"],meta[property="og:description"]').forEach(function (m) {
    metas.push({ el: m, en: m.getAttribute('content') });
  });
  var titleEn = document.title;

  function tr(s) { return Object.prototype.hasOwnProperty.call(FR, s) ? FR[s] : null; }

  function apply() {
    var fr = lang === 'fr';
    units.forEach(function (el) {
      var t = fr ? tr(el.__en) : null;
      var want = t !== null ? t : el.__en;
      if (norm(el.innerHTML) !== norm(want)) el.innerHTML = want;
    });
    texts.forEach(function (n) {
      var t = fr ? tr(n.__en) : null;
      n.nodeValue = n.__lead + (t !== null ? t : n.__en) + n.__trail;
    });
    attrEls.forEach(function (o) {
      var t = fr ? tr(o.en) : null;
      o.el.setAttribute(o.a, t !== null ? t : o.en);
    });
    metas.forEach(function (o) {
      var t = fr ? tr(o.en) : null;
      o.el.setAttribute('content', t !== null ? t : o.en);
    });
    var tt = fr ? tr(titleEn) : null;
    document.title = tt !== null ? tt : titleEn;
    document.documentElement.setAttribute('lang', lang);
    document.querySelectorAll('.lang-toggle').forEach(function (b) {
      b.textContent = fr ? 'EN' : 'FR';
      b.setAttribute('aria-label', fr ? 'Switch to English' : 'Passer en français');
      b.title = b.getAttribute('aria-label');
    });
    document.dispatchEvent(new CustomEvent('langchange', { detail: lang }));
  }

  window.zhT = function (s) { return lang === 'fr' && UI[s] ? UI[s] : s; };
  window.zhLang = function () { return lang; };
  window.zhKeys = function () {
    return {
      units: units.map(function (e) { return e.__en; }),
      texts: texts.map(function (n) { return n.__en; }),
      attrs: attrEls.map(function (o) { return o.en; }),
      metas: metas.map(function (o) { return o.en; }).concat([titleEn])
    };
  };

  var nav = document.querySelector('.nav');
  var themeBtn = document.querySelector('.theme-toggle');
  if (nav) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'lang-toggle';
    b.addEventListener('click', function () {
      lang = lang === 'fr' ? 'en' : 'fr';
      try { localStorage.setItem('zh-lang', lang); } catch (e) {}
      apply();
    });
    nav.insertBefore(b, themeBtn || null);
  }
  apply();
})();
