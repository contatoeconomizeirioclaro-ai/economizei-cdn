/* Economizei! Rio Claro — "Economizei indica"
   Monta o carrossel a partir dos gadgets das seções #indica-home e #indica-pagina:
   - gadget "Imagem": imagem (upload/URL), link, título e legenda;
   - gadget "HTML": blocos <a class="ind-of"> (com selo, local e preços).
   Cada seção é posicionada no lugar certo da página. */
(function () {
  'use strict';
  var INTERVALO = 6500;
  var AVISO = 'Link de afiliado \u2014 podemos ganhar uma comiss\u00e3o em compras feitas por aqui, sem custo extra pra voc\u00ea.';
  var reduzir = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function txt(n) { return n ? (n.textContent || '').replace(/\s+/g, ' ').trim() : ''; }
  function tem(n, c) { return n.nodeType === 1 && (' ' + n.className + ' ').indexOf(' ' + c + ' ') > -1; }

  function posicionar(sec, seletor) {
    var alvo = document.querySelector(seletor);
    if (alvo && alvo.parentNode) alvo.parentNode.insertBefore(sec, alvo);
  }

  /* gadget "Imagem" -> oferta */
  function deImagem(w) {
    var img = w.querySelector('img');
    if (!img || !img.getAttribute('src')) return null;
    var link = img.parentNode && img.parentNode.tagName === 'A' ? img.parentNode : w.querySelector('a');
    var titulo = (img.getAttribute('alt') || '').trim() || txt(w.querySelector('h2,h3,.title'));
    var legenda = txt(w.querySelector('.caption'));
    var a = el('a', 'ind-of');
    if (link && link.getAttribute('href')) { a.href = link.getAttribute('href'); a.target = '_blank'; a.rel = 'noopener sponsored'; }
    var im = el('img'); im.src = img.getAttribute('src'); a.appendChild(im);
    if (titulo || legenda) a.appendChild(el('strong', 'ind-titulo', titulo || legenda));
    if (titulo && legenda) a.appendChild(el('span', 'ind-local', legenda));
    return a;
  }

  function ofertasDe(secao) {
    var lista = [], nos = secao.querySelectorAll('a.ind-of, .widget.Image'), i, n, o;
    for (i = 0; i < nos.length; i++) {
      n = nos[i];
      if (n.tagName === 'A') lista.push(n);
      else { o = deImagem(n); if (o) lista.push(o); }
    }
    return lista;
  }

  function prepararOferta(a) {
    var img = a.querySelector('img'), topo = img, info = el('div', 'ind-info'), acao = el('div', 'ind-acao'), precos = el('div', 'ind-precos'), foto = el('div', 'ind-foto'), nos, i;
    while (topo && topo.parentNode !== a) topo = topo.parentNode;
    if (img) { img.setAttribute('loading', 'lazy'); img.setAttribute('decoding', 'async'); if (!img.hasAttribute('alt')) img.setAttribute('alt', ''); }
    nos = [].slice.call(a.childNodes);
    for (i = 0; i < nos.length; i++) {
      if (nos[i] === topo) continue;
      if (tem(nos[i], 'ind-de') || tem(nos[i], 'ind-por')) precos.appendChild(nos[i]); else info.appendChild(nos[i]);
    }
    if (precos.childNodes.length) acao.appendChild(precos);
    acao.appendChild(el('span', 'ind-cta', a.getAttribute('data-cta') || 'Ver oferta'));
    if (topo) foto.appendChild(topo);
    a.appendChild(foto); a.appendChild(info); a.appendChild(acao);
  }

  function montar(secao, seletorAlvo) {
    if (!secao || secao.getAttribute('data-ind')) return;
    var ofertas = ofertasDe(secao);
    if (!ofertas.length) return;
    secao.setAttribute('data-ind', '1');

    var raiz = el('div', 'ind'), card = el('div', 'ind-card'), slides = el('div', 'ind-slides'), dots = el('div', 'ind-dots');
    raiz.setAttribute('role', 'region'); raiz.setAttribute('aria-roledescription', 'carrossel'); raiz.setAttribute('aria-label', 'Economizei indica');

    var botoes = [], atual = 0, pausado = false;
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
    raiz.appendChild(el('div', 'ind-rotulo', 'Economizei indica'));
    raiz.appendChild(card);
    raiz.appendChild(el('p', 'ind-aviso', AVISO));
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
      if (!reduzir) setInterval(function () { if (!pausado && !document.hidden) ir(atual + 1); }, INTERVALO);
    }
    if (seletorAlvo) posicionar(secao, seletorAlvo);
  }

  function iniciar() {
    var cl = document.body.classList;
    if (cl.contains('home')) montar(document.getElementById('indica-home'), '.main-section-title');
    if (cl.contains('static_page')) montar(document.getElementById('indica-pagina'), '.ev-sb');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
