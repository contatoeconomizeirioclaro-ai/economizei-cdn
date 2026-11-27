/* Economizei! Rio Claro — "Economizei indica"
   Monta o carrossel a partir dos gadgets HTML das seções #indica-home e #indica-pagina
   (cada oferta é um <a class="ind-of">) e posiciona cada seção no lugar certo. */
(function () {
  'use strict';
  var INTERVALO = 6500;
  var reduzir = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function el(t, c) { var e = document.createElement(t); if (c) e.className = c; return e; }

  function posicionar(sec, seletor) {
    var alvo = document.querySelector(seletor);
    if (alvo && alvo.parentNode) alvo.parentNode.insertBefore(sec, alvo);
  }

  function prepararOferta(a) {
    var img = a.querySelector('img'), topo = img, info = el('div', 'ind-info'), foto = el('div', 'ind-foto'), nos, i;
    while (topo && topo.parentNode !== a) topo = topo.parentNode;
    if (img) { img.setAttribute('loading', 'lazy'); img.setAttribute('decoding', 'async'); if (!img.hasAttribute('alt')) img.setAttribute('alt', ''); }
    nos = [].slice.call(a.childNodes);
    for (i = 0; i < nos.length; i++) if (nos[i] !== topo) info.appendChild(nos[i]);
    if (topo) foto.appendChild(topo);
    var cta = el('span', 'ind-cta'); cta.textContent = a.getAttribute('data-cta') || 'Ver oferta';
    a.appendChild(foto); a.appendChild(info); a.appendChild(cta);
  }

  function montar(secao, seletorAlvo) {
    if (!secao || secao.getAttribute('data-ind')) return;
    var ofertas = [].slice.call(secao.querySelectorAll('a.ind-of'));
    if (!ofertas.length) return;
    secao.setAttribute('data-ind', '1');

    var raiz = el('div', 'ind'), rotulo = el('div', 'ind-rotulo'), card = el('div', 'ind-card'), slides = el('div', 'ind-slides'), dots = el('div', 'ind-dots');
    raiz.setAttribute('role', 'region'); raiz.setAttribute('aria-roledescription', 'carrossel'); raiz.setAttribute('aria-label', 'Economizei indica');
    rotulo.textContent = 'Economizei indica';

    var botoes = [], atual = 0, pausado = false, timer = null;
    ofertas.forEach(function (a, i) {
      prepararOferta(a);
      slides.appendChild(a);
      var b = el('button', 'ind-dot'); b.type = 'button'; b.setAttribute('aria-label', 'Ir para a oferta ' + (i + 1));
      b.addEventListener('click', function () { ir(i); });
      botoes.push(b); dots.appendChild(b);
    });

    function ir(n) {
      atual = (n + ofertas.length) % ofertas.length;
      ofertas.forEach(function (a, i) {
        var on = i === atual;
        a.classList.toggle('ativo', on); a.setAttribute('aria-hidden', on ? 'false' : 'true'); a.tabIndex = on ? 0 : -1;
        botoes[i].classList.toggle('ativo', on); botoes[i].setAttribute('aria-current', on ? 'true' : 'false');
      });
    }

    card.appendChild(slides);
    if (ofertas.length > 1) card.appendChild(dots);
    raiz.appendChild(rotulo); raiz.appendChild(card);
    secao.appendChild(raiz);
    secao.classList.add('ind-js');
    ir(0);

    if (ofertas.length > 1) {
      var x0 = null;
      card.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; pausado = true; }, { passive: true });
      card.addEventListener('touchend', function (e) {
        if (x0 !== null) { var dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) ir(atual + (dx < 0 ? 1 : -1)); }
        x0 = null; pausado = false;
      }, { passive: true });
      card.addEventListener('mouseenter', function () { pausado = true; });
      card.addEventListener('mouseleave', function () { pausado = false; });
      card.addEventListener('focusin', function () { pausado = true; });
      card.addEventListener('focusout', function () { pausado = false; });
      if (!reduzir) timer = setInterval(function () { if (!pausado && !document.hidden) ir(atual + 1); }, INTERVALO);
    }
    if (seletorAlvo) posicionar(secao, seletorAlvo);
    return { ir: ir, parar: function () { if (timer) clearInterval(timer); } };
  }

  function iniciar() {
    var cl = document.body.classList;
    if (cl.contains('home')) montar(document.getElementById('indica-home'), '.main-section-title');
    if (cl.contains('static_page')) montar(document.getElementById('indica-pagina'), '.ev-sb');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
