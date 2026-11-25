/* MENU LATERAL (mobile e app): área do usuário no topo (Economizei.Auth), itens do menu do Blogger com ícone, redes, download do app e logo no fim */
(function () {
  'use strict';
  var PLAY = 'https://play.google.com/store/apps/details?id=br.com.economizeirioclaro.app&pcampaignid=web_share';
  var SOCIAIS = [
    ['fa-brands fa-instagram', 'Instagram', 'https://www.instagram.com/economizeirioclaro/'],
    ['fa-brands fa-facebook', 'Facebook', 'https://www.facebook.com/economizeirioclaro'],
    ['fa-brands fa-youtube', 'YouTube', 'https://www.youtube.com/@economizeirioclaro'],
    ['fa-brands fa-whatsapp', 'WhatsApp', 'https://wa.me/5524998808647']
  ];
  var URL_GUIA = 'https://www.economizeirioclaro.com.br/p/categorias.html';
  var URL_CADASTRO = 'https://www.economizeirioclaro.com.br/p/cadastro.html';
  var timer = null;

  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function ic(cl) { var i = el('i', cl); i.setAttribute('aria-hidden', 'true'); return i; }
  function limpa(s) { return (s || '').replace(/^_+/, '').replace(/\s+/g, ' ').trim(); }
  function norm(s) { return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }

  function iconeDe(rot, href) {
    var s = norm(rot + ' ' + href);
    var mapa = [
      [/cadastr|negocio/, 'fa-circle-plus'], [/onibus|horario/, 'fa-bus'], [/emprego|estagio|vaga/, 'fa-briefcase'],
      [/festa|evento/, 'fa-calendar-days'], [/turismo|trilha/, 'fa-mountain-sun'], [/vitrine|escritor|livro/, 'fa-book-open'],
      [/artigo|noticia|blog/, 'fa-newspaper'], [/plano|preco/, 'fa-tags'], [/privacidade/, 'fa-shield-halved'],
      [/cookie/, 'fa-cookie-bite'], [/publicidade/, 'fa-bullhorn'], [/editorial/, 'fa-pen-nib'], [/termos/, 'fa-file-contract'],
      [/politica/, 'fa-file-lines'], [/contato|fale/, 'fa-envelope'], [/quem somos|sobre|autor/, 'fa-circle-info'],
      [/guia|comercial|categoria/, 'fa-store'], [/home|inicio/, 'fa-house']
    ];
    for (var i = 0; i < mapa.length; i++) if (mapa[i][0].test(s)) return 'fa-solid ' + mapa[i][1];
    return 'fa-solid fa-link';
  }

  function item(rot, href, extra) {
    var a = el('a', 'ea-mn-item' + (extra ? ' ' + extra : ''));
    a.href = href;
    a.appendChild(ic(iconeDe(rot, href)));
    a.appendChild(document.createTextNode(rot));
    try {
      var u = new URL(href, location.href);
      if (u.origin === location.origin && u.pathname === location.pathname && !u.hash) { a.classList.add('on'); a.setAttribute('aria-current', 'page'); }
    } catch (e) {}
    return a;
  }

  /* Lê o menu que o tema já montou (o do Blogger): grupos com "_" viram títulos de seção */
  function coletar() {
    var ul = document.querySelector('.mobile-menu-ul');
    if (!ul) return null;
    var secoes = [{ titulo: null, links: [] }], vistos = {};
    function add(sec, rot, href) {
      if (!rot || !href || href.indexOf('javascript') === 0 || href === '#') return;
      if (href.indexOf('/p/cadastro.html') > -1) return;
      if (vistos[href]) return;
      vistos[href] = 1; sec.links.push([rot, href]);
    }
    [].forEach.call(ul.children, function (li) {
      var a = null, sub = null;
      [].forEach.call(li.children, function (c) { if (c.tagName === 'A' && !a) a = c; if (c.tagName === 'UL' && !sub) sub = c; });
      var rot = limpa(a && a.textContent);
      if (sub) {
        var sec = { titulo: rot, links: [] };
        [].forEach.call(sub.querySelectorAll('a'), function (x) { add(sec, limpa(x.textContent), x.href); });
        if (sec.links.length) secoes.push(sec);
      } else if (a) {
        add(secoes[0], rot, a.href);
      }
    });
    return secoes;
  }

  function montar() {
    var wrap = document.querySelector('.mobile-menu-wrap');
    var secoes = coletar();
    if (!wrap || !secoes) return;
    var tem = function (parte) { return secoes.some(function (s) { return s.links.some(function (l) { return l[1].indexOf(parte) > -1; }); }); };
    if (!tem('/p/categorias.html')) secoes[0].links.splice(secoes[0].links.length ? 1 : 0, 0, ['Guia Comercial', URL_GUIA]);

    var nav = el('nav', null);
    nav.id = 'eaMenuNovo'; nav.setAttribute('aria-label', 'Menu principal');
    secoes.forEach(function (s) {
      if (s.titulo) nav.appendChild(el('div', 'ea-mn-grupo', s.titulo));
      s.links.forEach(function (l) { nav.appendChild(item(l[0], l[1])); });
    });
    nav.appendChild(item('Cadastre seu negócio', URL_CADASTRO, 'ea-mn-cta'));

    var soc = el('div', 'ea-mn-social');
    SOCIAIS.forEach(function (s) {
      var a = el('a'); a.href = s[2]; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.setAttribute('aria-label', s[1]);
      a.appendChild(ic(s[0])); soc.appendChild(a);
    });
    nav.appendChild(soc);

    var app = el('a', 'ea-mn-app'); app.href = PLAY; app.target = '_blank'; app.rel = 'noopener noreferrer';
    app.appendChild(ic('fa-brands fa-google-play')); app.appendChild(document.createTextNode('Baixar o app'));
    nav.appendChild(app);

    var img = document.querySelector('#header-wrap .header-image-wrapper img');
    if (img && img.src) {
      var lg = el('a', 'ea-mn-logo'); lg.href = location.origin + '/'; lg.setAttribute('aria-label', 'Economizei! Rio Claro - início');
      var im = el('img'); im.src = img.src; im.alt = 'Economizei! Rio Claro'; im.loading = 'lazy'; im.decoding = 'async';
      lg.appendChild(im); nav.appendChild(lg);
    }

    var antigo = document.getElementById('eaMenuNovo');
    if (antigo) antigo.replaceWith(nav); else wrap.appendChild(nav);
    wrap.classList.add('ea-mn-pronto');
  }

  function agendar() { clearTimeout(timer); timer = setTimeout(montar, 60); }
  function iniciar() {
    montar();
    var m = document.querySelector('.mobile-menu');
    if (m) new MutationObserver(agendar).observe(m, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
