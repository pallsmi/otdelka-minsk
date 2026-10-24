/* Отделка Минск — поведение страницы. Без зависимостей. */
(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* ---------- Год в подвале ---------- */
  $$('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });

  /* ---------- Меню на телефоне ---------- */
  var burger = $('.burger');
  var nav = $('#nav');
  if (burger && nav) {
    var setMenu = function (open) {
      nav.classList.toggle('open', open);
      document.documentElement.classList.toggle('menu-open', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      burger.setAttribute('aria-label', open ? burger.dataset.close : burger.dataset.open);
    };
    burger.addEventListener('click', function () { setMenu(!nav.classList.contains('open')); });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
    // Нажатие мимо открытого меню закрывает его
    document.addEventListener('click', function (e) {
      if (nav.classList.contains('open') && !nav.contains(e.target) && !burger.contains(e.target)) setMenu(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('open')) { setMenu(false); burger.focus(); }
    });
    window.matchMedia('(min-width: 1120px)').addEventListener('change', function () { setMenu(false); });
  }

  /* ---------- Фильтр работ ---------- */
  var grid = $('#grid');
  var filterButtons = $$('.filters [data-filter]');
  filterButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var key = btn.dataset.filter;
      filterButtons.forEach(function (b) { b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'); });
      $$('li', grid).forEach(function (li) {
        var cats = (li.dataset.cats || '').split(' ');
        li.hidden = !(key === 'all' || cats.indexOf(key) !== -1);
      });
    });
  });

  /* ---------- Просмотр фото и видео ---------- */
  var dataEl = $('#gallery-data');
  var items = dataEl ? JSON.parse(dataEl.textContent) : [];
  var lb = $('#lightbox');
  if (lb && items.length) {
    var stage = $('.lb-stage', lb);
    var caption = $('.lb-caption', lb);
    var current = 0;
    var opener = null;

    var visibleOrder = function () {
      var order = [];
      $$('li', grid).forEach(function (li) {
        if (li.hidden) return;
        var b = $('.tile', li);
        if (b) order.push(+b.dataset.index);
      });
      return order.indexOf(current) === -1 ? items.map(function (_, i) { return i; }) : order;
    };

    var render = function () {
      var it = items[current];
      var old = $('video', stage);
      if (old) { old.pause(); old.removeAttribute('src'); old.load(); }
      stage.textContent = '';
      var el;
      if (it.kind === 'video') {
        el = document.createElement('video');
        el.src = it.video;
        el.poster = it.src;
        el.controls = true;
        el.muted = true;
        el.playsInline = true;
        el.setAttribute('playsinline', '');
        el.preload = 'metadata';
        el.autoplay = true;
      } else {
        el = document.createElement('img');
        el.src = it.src;
        el.alt = it.caption;
      }
      el.width = it.w;
      el.height = it.h;
      stage.appendChild(el);
      caption.textContent = it.caption;
    };

    var open = function (index, from) {
      current = index;
      opener = from || null;
      render();
      document.documentElement.classList.add('lb-open');
      if (typeof lb.showModal === 'function') lb.showModal(); else lb.setAttribute('open', '');
      $('.lb-close', lb).focus();
    };

    var close = function () {
      if (typeof lb.close === 'function' && lb.open) lb.close();
      else lb.removeAttribute('open');
    };

    var step = function (dir) {
      var order = visibleOrder();
      var pos = order.indexOf(current);
      current = order[(pos + dir + order.length) % order.length];
      render();
    };

    lb.addEventListener('close', function () {
      var v = $('video', stage);
      if (v) v.pause();
      stage.textContent = '';
      document.documentElement.classList.remove('lb-open');
      if (opener) opener.focus();
    });

    document.addEventListener('click', function (e) {
      var tile = e.target.closest('.tile[data-index]');
      if (tile) open(+tile.dataset.index, tile);
    });
    $('.lb-close', lb).addEventListener('click', close);
    $('.lb-prev', lb).addEventListener('click', function () { step(-1); });
    $('.lb-next', lb).addEventListener('click', function () { step(1); });
    // Клик по тёмному фону вокруг фото закрывает просмотр
    lb.addEventListener('click', function (e) { if (e.target === lb || e.target === stage) close(); });
    lb.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    });

    // Свайп влево/вправо
    var sx = 0, sy = 0, tracking = false;
    stage.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse') return;
      tracking = true; sx = e.clientX; sy = e.clientY;
    });
    stage.addEventListener('pointerup', function (e) {
      if (!tracking) return;
      tracking = false;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
    });
    stage.addEventListener('pointercancel', function () { tracking = false; });
  }

  /* ---------- Телефон: формат +375 XX XXX-XX-XX ---------- */
  var phone = $('#f-phone');
  var phoneDigits = function (v) {
    var d = (v || '').replace(/\D/g, '');
    if (/^80\d/.test(d)) d = '375' + d.slice(2);          // 80 29 ... → 375 29 ...
    else if (/^(25|29|33|44|17)\d/.test(d) && d.length <= 9) d = '375' + d;
    if (/^37580/.test(d)) d = '375' + d.slice(5);          // набрали 80… после подставленного +375
    if (/^375375/.test(d)) d = d.slice(3);                 // вставили полный номер после +375
    return d;
  };
  var formatBY = function (d) {
    d = d.slice(0, 12);
    var p = [d.slice(0, 3), d.slice(3, 5), d.slice(5, 8), d.slice(8, 10), d.slice(10, 12)];
    var out = '+' + p[0];
    if (p[1]) out += ' ' + p[1];
    if (p[2]) out += ' ' + p[2];
    if (p[3]) out += '-' + p[3];
    if (p[4]) out += '-' + p[4];
    return out;
  };
  var phoneValid = function (v) {
    var d = phoneDigits(v);
    if (d.indexOf('375') === 0) return d.length === 12;
    return d.length >= 10 && d.length <= 15;              // номер другой страны
  };
  if (phone) {
    phone.addEventListener('focus', function () { if (!phone.value) phone.value = '+375 '; });
    phone.addEventListener('blur', function () {
      if (phone.value.trim() === '+375') { phone.value = ''; return; }
      var d = phoneDigits(phone.value);
      if (d.indexOf('375') === 0 && d.length === 12) phone.value = formatBY(d);   // привести к единому виду после правок
    });
    phone.addEventListener('input', function (e) {
      if (e.inputType && e.inputType.indexOf('delete') === 0) return;
      var atEnd = phone.selectionStart === phone.value.length;
      var d = phoneDigits(phone.value);
      if (atEnd && d.indexOf('375') === 0) phone.value = formatBY(d);
    });
  }

  /* ---------- Заявка ---------- */
  var form = $('#lead-form');
  if (!form) return;
  var status = $('.form-status', form);
  var submitBtn = $('button[type="submit"]', form);
  var sheet = $('#offline');

  var labelText = function (id) {
    var l = form.querySelector('label[for="' + id + '"]');
    if (!l) return '';
    var clone = l.cloneNode(true);
    $$('.hint, a', clone).forEach(function (n) { n.remove(); });
    return clone.textContent.trim();
  };

  var setError = function (field, ok) {
    var wrap = field.closest('.field');
    var err = wrap && wrap.querySelector('.err');
    if (wrap) wrap.classList.toggle('invalid', !ok);
    if (err) err.textContent = ok ? '' : err.dataset.msg;
    field.setAttribute('aria-invalid', ok ? 'false' : 'true');
    return ok;
  };

  var areaValue = function (v) {
    v = (v || '').trim().replace(',', '.');
    if (!v) return null;
    var n = Number(v);
    return /^\d+(\.\d+)?$/.test(v) && n > 0 && n <= 10000 ? n : NaN;
  };

  var checks = {
    name: function (f) { return f.value.trim().length >= 2; },
    phone: function (f) { return phoneValid(f.value); },
    area: function (f) { return !isNaN(areaValue(f.value)); },
    consent: function (f) { return f.checked; }
  };
  var order = ['name', 'phone', 'area', 'consent'];
  var checkField = function (n) { return setError(form.elements[n], checks[n](form.elements[n])); };

  // Полная проверка — только при отправке; фокус уходит на первое поле с ошибкой.
  var validate = function () {
    var firstBad = null;
    order.forEach(function (n) { if (!checkField(n) && !firstBad) firstBad = form.elements[n]; });
    if (firstBad) firstBad.focus();
    return !firstBad;
  };

  // После неудачной отправки поле перепроверяется само по себе и фокус не трогает.
  ['name', 'phone', 'area'].forEach(function (n) {
    var f = form.elements[n];
    f.addEventListener('blur', function () {
      if (f.getAttribute('aria-invalid') === 'true') checkField(n);
    });
    f.addEventListener('input', function () {
      if (f.getAttribute('aria-invalid') === 'true' && checks[n](f)) setError(f, true);
    });
  });
  form.elements.consent.addEventListener('change', function () {
    if (form.elements.consent.checked) setError(form.elements.consent, true);
  });

  var collect = function () {
    var f = form.elements;
    return {
      name: f.name.value.trim(),
      phone: f.phone.value.trim(),
      work: f.work.value,
      area: f.area.value.trim(),
      message: f.message.value.trim(),
      lang: document.documentElement.lang,
      page: location.href
    };
  };

  var composeText = function (d) {
    var lines = [form.dataset.header + ' — ' + form.dataset.brand];
    lines.push(labelText('f-name') + ': ' + d.name);
    lines.push(labelText('f-phone') + ': ' + d.phone);
    if (d.work) lines.push(labelText('f-work') + ': ' + d.work);
    if (d.area) lines.push(labelText('f-area') + ': ' + d.area);
    if (d.message) lines.push(labelText('f-msg') + ': ' + d.message);
    return lines.join('\n');
  };

  var copyText = function (text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    var ta = $('#offline-text');
    ta.focus(); ta.select();
    try { document.execCommand('copy'); } catch (e) { /* пользователь скопирует вручную */ }
    return Promise.resolve();
  };

  var openSheet = function (text) {
    if (!sheet) return;
    var ta = $('#offline-text', sheet);
    ta.value = text;
    $$('[data-msg-kind]', sheet).forEach(function (a) {
      var base = a.getAttribute('href').split('?')[0];
      if (a.dataset.msgKind === 'round') a.href = base + '?text=' + encodeURIComponent(text);  // WhatsApp подставит текст сам
    });
    if (typeof sheet.showModal === 'function') sheet.showModal(); else sheet.setAttribute('open', '');
  };

  if (sheet) {
    var copyBtn = $('#offline-copy', sheet);
    var copyLabel = copyBtn.textContent;
    copyBtn.addEventListener('click', function () {
      copyText($('#offline-text', sheet).value).then(function () {
        copyBtn.textContent = copyBtn.dataset.done;
        setTimeout(function () { copyBtn.textContent = copyLabel; }, 2000);
      });
    });
    $$('[data-msg-kind]', sheet).forEach(function (a) {
      a.addEventListener('click', function () { copyText($('#offline-text', sheet).value); });
    });
    $('.sheet-close', sheet).addEventListener('click', function () {
      if (typeof sheet.close === 'function') sheet.close(); else sheet.removeAttribute('open');
    });
  }

  var send = function (d) {
    var provider = form.dataset.provider;
    var endpoint = form.dataset.endpoint;
    var payload = {};
    Object.keys(d).forEach(function (k) { payload[k] = d[k]; });
    if (provider === 'web3forms') {
      endpoint = endpoint || 'https://api.web3forms.com/submit';
      payload.access_key = form.elements.access_key ? form.elements.access_key.value : '';
      payload.subject = form.elements.subject ? form.elements.subject.value : form.dataset.header;
      payload.from_name = form.dataset.brand;
    }
    return fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json().catch(function () { return {}; });
    }).then(function (json) {
      if (json && json.success === false) throw new Error('rejected');
    });
  };

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    status.textContent = '';
    status.className = 'form-status';
    if (form.elements.website && form.elements.website.value) return;   // бот
    if (!validate()) return;

    var d = collect();
    var configured = form.dataset.provider && (form.dataset.endpoint || form.dataset.provider === 'web3forms');
    if (!configured) { openSheet(composeText(d)); return; }

    var label = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = form.dataset.sending;
    send(d).then(function () {
      form.reset();
      status.textContent = form.dataset.ok;
      status.classList.add('ok');
    }).catch(function () {
      status.textContent = form.dataset.err;
      status.classList.add('bad');
      openSheet(composeText(d));
    }).then(function () {
      submitBtn.disabled = false;
      submitBtn.textContent = label;
    });
  });
})();
