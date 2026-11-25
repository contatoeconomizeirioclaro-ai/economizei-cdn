(function () {
  var doc = document.documentElement;
  var v3 = document.getElementById('v3Hero');
  var antigo = document.getElementById('intro-wrap');
  var track = document.getElementById('v3Track');
  // Na home o hero visivel e o #v3Hero; #intro-wrap fica oculto (display:none)
  var hero = (v3 && v3.offsetHeight > 0) ? v3 : ((antigo && antigo.offsetHeight > 0) ? antigo : null);
  if (!hero) return;

  // Acessibilidade: respeita "reduzir movimento"
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // ---- Modo "hero em cena": confere se o sticky vai funcionar (nenhum pai com overflow que o quebre)
  var scrub = doc.classList.contains('hero-scrub') && track && hero === v3;
  if (scrub) {
    for (var n = track.parentElement; n && n !== document.body && n !== doc; n = n.parentElement) {
      var cs = window.getComputedStyle(n);
      if (/(hidden|auto|scroll)/.test(cs.overflowX + ' ' + cs.overflowY)) { scrub = false; break; }
    }
    if (!scrub) doc.classList.remove('hero-scrub');
  }

  var cabecalho = document.getElementById('header-wrap');
  var hdr = 74;
  function medirCabecalho() {
    hdr = cabecalho ? Math.round(cabecalho.getBoundingClientRect().height) : 74;
    doc.style.setProperty('--hdr', hdr + 'px');
  }
  medirCabecalho();

  var copia = hero.querySelector('.v3-hero-copy');
  var elP = copia ? copia.children[2] : null;
  var elAcoes = copia ? copia.children[3] : null;
  var elKicker = copia ? copia.children[0] : null;

  // ---- Titulo "caminhante": comeca sozinho no centro e volta a posicao original.
  // Cada linha vira um bloco proprio para poder ser centralizada individualmente.
  var titulo = hero.querySelector('.v3-title');
  var tituloHTML = titulo ? titulo.innerHTML : '';

  function posicaoRelativa(el) {
    var x = 0, y = 0;
    while (el && el !== hero) { x += el.offsetLeft; y += el.offsetTop; el = el.offsetParent; }
    return { x: x, y: y };
  }

  function criarToken(k) {
    if (k.f) { var st = document.createElement('strong'); st.textContent = k.t; return st; }
    return document.createTextNode(k.t);
  }

  function prepararTitulo() {
    if (!scrub || !titulo) return;
    try {
      titulo.innerHTML = tituloHTML;
      var tokens = [];
      (function andar(no, forte) {
        for (var c = no.firstChild; c; c = c.nextSibling) {
          if (c.nodeType === 3) {
            c.nodeValue.split(/\s+/).forEach(function (w) { if (w) tokens.push({ t: w, f: forte }); });
          } else if (c.nodeType === 1) {
            andar(c, forte || c.tagName === 'STRONG');
          }
        }
      })(titulo, false);

      // 1) mede onde cada palavra cai naturalmente
      titulo.textContent = '';
      var spans = tokens.map(function (k, i) {
        var sp = document.createElement('span');
        sp.appendChild(criarToken(k));
        if (i) titulo.appendChild(document.createTextNode(' '));
        titulo.appendChild(sp);
        return sp;
      });
      var linhas = [], topoAnt = null;
      spans.forEach(function (sp, i) {
        var t = sp.offsetTop;
        if (topoAnt === null || Math.abs(t - topoAnt) > 4) { linhas.push([]); topoAnt = t; }
        linhas[linhas.length - 1].push(i);
      });

      // 2) reconstroi com uma linha por bloco
      titulo.textContent = '';
      linhas.forEach(function (idxs) {
        var ln = document.createElement('span');
        ln.className = 'ln';
        idxs.forEach(function (i, n) {
          if (n) ln.appendChild(document.createTextNode(' '));
          ln.appendChild(criarToken(tokens[i]));
        });
        titulo.appendChild(ln);
      });

      // 3) distancia de cada linha ate o centro do hero
      var cx = hero.clientWidth / 2, cy = hero.clientHeight / 2;
      var pt = posicaoRelativa(titulo);
      titulo.style.setProperty('--dy', (cy - (pt.y + titulo.offsetHeight / 2)).toFixed(1) + 'px');
      Array.prototype.forEach.call(titulo.querySelectorAll('.ln'), function (ln) {
        var pl = posicaoRelativa(ln);
        ln.style.setProperty('--dx', (cx - (pl.x + ln.offsetWidth / 2)).toFixed(1) + 'px');
      });
      if (typeof atual === 'number') aplicarCena(atual);
    } catch (e) {
      titulo.innerHTML = tituloHTML;   // se algo falhar, o titulo fica normal
    }
  }

  // ---- Ajustes ----
  var INERCIA_MS     = 180;   // maior = movimento mais macio/lento para acompanhar a rolagem
  var BLUR_MAX       = 14;    // desfoque inicial da imagem (px)
  var CURSO_IMAGEM   = 130;   // px que a imagem desce durante a cena
  var NITIDA_ATE     = 0.6;   // imagem fica 100% nitida quando 60% da cena passou
  var FATOR_FUNDO    = 0.55;  // fallback (sem cena): fundo desce 55% da rolagem
  var FATOR_CONTEUDO = -0.25; // fallback: texto sobe mais rapido que a pagina
  var FADE_ATE       = 0.55;  // fallback: texto some quando 55% do hero foi rolado

  function clamp(v, a, b) { return Math.min(Math.max(v, a), b); }
  function suave(t) { return t * t * (3 - 2 * t); }

  // progresso da cena (0..1) ou null se nao estamos em modo cena
  function progressoAlvo() {
    if (!scrub) return null;
    var curso = track.offsetHeight - hero.offsetHeight;
    if (curso <= 40) return null;
    return clamp((hdr - track.getBoundingClientRect().top) / curso, 0, 1);
  }

  function aplicarCena(p) {
    // 0.00-0.14: so o titulo, centralizado | 0.14-0.40: titulo volta a posicao original
    // 0.34-0.50: etiqueta | 0.44-0.62: paragrafo | 0.62-0.80: botoes
    var tt = suave(clamp((p - 0.14) / 0.26, 0, 1));
    var r1 = suave(clamp((p - 0.34) / 0.16, 0, 1));
    var r3 = suave(clamp((p - 0.44) / 0.18, 0, 1));
    var r4 = suave(clamp((p - 0.62) / 0.18, 0, 1));
    hero.style.setProperty('--hero-p', p.toFixed(4));
    hero.style.setProperty('--hero-parallax-y', (p * CURSO_IMAGEM).toFixed(1) + 'px');
    hero.style.setProperty('--hero-blur', ((1 - suave(clamp(p / NITIDA_ATE, 0, 1))) * BLUR_MAX).toFixed(2));
    hero.style.setProperty('--hero-content-y', '0px');
    hero.style.setProperty('--hero-content-o', '1');
    hero.style.setProperty('--tt', tt.toFixed(4));
    hero.style.setProperty('--r1', r1.toFixed(3));
    hero.style.setProperty('--r3', r3.toFixed(3));
    hero.style.setProperty('--r4', r4.toFixed(3));
    if (elP) elP.classList.toggle('rv-done', r3 >= 0.98);
    if (elAcoes) elAcoes.classList.toggle('rv-done', r4 >= 0.98);
  }

  function aplicarSemCena() {
    var rect = hero.getBoundingClientRect();
    var rolado = clamp(-rect.top, 0, rect.height);
    var frac = rect.height ? rolado / rect.height : 0;
    hero.style.setProperty('--hero-parallax-y', (rolado * FATOR_FUNDO) + 'px');
    hero.style.setProperty('--hero-content-y',  (rolado * FATOR_CONTEUDO) + 'px');
    hero.style.setProperty('--hero-content-o',  Math.max(1 - frac / FADE_ATE, 0).toFixed(3));
  }

  // ---- Inercia: o valor exibido persegue o valor real da rolagem (fluido, estilo referencia)
  var alvo = 0, atual = 0, raf = null, ultimo = 0;

  function quadro(t) {
    var dt = Math.min(t - ultimo, 64);
    ultimo = t;
    atual += (alvo - atual) * (1 - Math.exp(-dt / INERCIA_MS));
    if (Math.abs(alvo - atual) < 0.0003) { atual = alvo; raf = null; }
    else { raf = window.requestAnimationFrame(quadro); }
    aplicarCena(atual);
  }

  function onScroll() {
    var p = progressoAlvo();
    if (p === null) {
      if (!raf) raf = window.requestAnimationFrame(function () { raf = null; aplicarSemCena(); });
      return;
    }
    alvo = p;
    if (!raf) { ultimo = window.performance.now(); raf = window.requestAnimationFrame(quadro); }
  }

  function iniciar() {
    prepararTitulo();
    var p = progressoAlvo();
    if (p === null) { aplicarSemCena(); return; }
    alvo = atual = p;
    aplicarCena(p);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  var tResize = null;
  window.addEventListener('resize', function () {
    medirCabecalho();
    clearTimeout(tResize);
    tResize = setTimeout(function () { prepararTitulo(); onScroll(); }, 120);
  }, { passive: true });
  window.addEventListener('load', function () { medirCabecalho(); prepararTitulo(); onScroll(); });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { prepararTitulo(); onScroll(); });
  }
  iniciar();
})();
