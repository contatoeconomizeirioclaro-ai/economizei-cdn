(function () {
  'use strict';
  var R = window.RICO_CONFIG, D = window.RICO_DADOS, T = window.RICO_TREINO || {};
  if (!R || !R.ligado || !D) return;

  function ss(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) {} return null; }
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) { localStorage.removeItem(k); return null; } localStorage.setItem(k, v); } catch (e) {} return null; }
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function track(evt, dados) { try { window.dataLayer = window.dataLayer || []; window.dataLayer.push(Object.assign({ event: evt }, dados || {})); } catch (e) {} }

  /* ---------- texto ---------- */
  var STOP = ('onde eu como quero preciso tem para uma uns por que qual quais esta estou achar encontrar procuro perto aqui tudo algum alguma pode voce voces com dos das nos nas mais meu minha ola bom dia boa tarde noite sim nao agora hoje diga fala mostra manda conta saber gostaria queria opcoes opcao lista tipos tipo existe cidade rio claro de da do um os as em no na ao ou ja ate sao ser foi vai vem ter tenho alguem atende atendimento atendimentos buscar busco procure procuro gostaria queria fica me fale pouco sobre ele ela dele dela sabe detalhes informacao informacoes aberto aberto aberta abertos abertas abre abrem funciona').split(' ');
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function tokens(q) { return norm(q).split(' ').filter(function (t) { return t.length > 1 && STOP.indexOf(t) === -1; }); }
  function normQ(q) { return norm(q); }
  function lev(a, b) { if (a === b) return 0; if (!a.length) return b.length; if (!b.length) return a.length; var ant = [], i, j, at; for (i = 0; i <= b.length; i++) ant.push(i); for (i = 0; i < a.length; i++) { at = [i + 1]; for (j = 0; j < b.length; j++) at.push(Math.min(ant[j + 1] + 1, at[j] + 1, ant[j] + (a[i] === b[j] ? 0 : 1))); ant = at; } return ant[b.length]; }
  function lim(t) { return t.length <= 3 ? 0 : t.length <= 5 ? 1 : t.length <= 8 ? 2 : 3; }
  function dist(t, texto) { var m = lev(t, texto), p = texto.split(' '), i; for (i = 0; i < p.length; i++) m = Math.min(m, lev(t, p[i])); return m; }
  function singular(t) { return t.length > 3 && /s$/.test(t) ? t.slice(0, -1) : t; }
  function temPalavra(texto, t) { return t.length <= 2 ? (' ' + texto + ' ').indexOf(' ' + t + ' ') > -1 : texto.indexOf(t) > -1; }
  function seguro(u) { try { var x = new URL(String(u).trim()); return (x.protocol === 'http:' || x.protocol === 'https:') ? x.href : ''; } catch (e) { return ''; } }

  /* ---------- categorias ---------- */
  var CATS = [];
  D.grupos.forEach(function (g) {
    g[3].forEach(function (c) {
      var sin = (c[2] + '|' + ((D.extras && D.extras[c[1]]) || '') + '|' + ((T.extras && T.extras[c[1]]) || '')).split('|').filter(Boolean);
      CATS.push({ nome: c[0], filtro: c[1], grupo: g[1], gid: g[0], pagina: g[2], textos: [c[0]].concat(sin, [g[1]]).map(norm) });
    });
  });
  function tituloGrupo(gid) { for (var i = 0; i < D.grupos.length; i++) if (D.grupos[i][0] === gid) return D.grupos[i][1]; return gid; }
  function pontuarCat(c, toks, q) {
    var tot = 0, ach = 0, i, j, t, tS, best, x, forte = false;
    for (i = 0; i < toks.length; i++) {
      t = toks[i]; tS = singular(t); best = 0;
      for (j = 0; j < c.textos.length; j++) {
        x = c.textos[j];
        if ((' ' + x + ' ').indexOf(' ' + t + ' ') > -1) best = Math.max(best, 2);
        else if (t.length > 3 && x.indexOf(t) > -1) best = Math.max(best, 1.5);
        else if (tS !== t && x.indexOf(tS) > -1) best = Math.max(best, 1.5);
        else if (lim(t) > 0 && dist(t, x) <= lim(t)) best = Math.max(best, 1);
      }
      if (best >= 2) forte = true;
      if (best) { ach++; tot += best; }
    }
    if (toks.length > 1 && c.textos.indexOf(q) > -1) { tot += 3; forte = true; }
    return { s: tot, forte: forte, cheio: ach === toks.length };
  }
  function acharCats(toks) {
    var vazio = { lista: [], cheio: false, forte: false };
    if (!toks.length) return vazio;
    var q = toks.join(' '), r = CATS.map(function (c) { var p = pontuarCat(c, toks, q); return { c: c, s: p.s, forte: p.forte, cheio: p.cheio }; })
      .filter(function (x) { return x.s > 0; }).sort(function (a, b) { return b.s - a.s; });
    if (!r.length) return vazio;
    var top = r[0].s, ok = r.filter(function (x) { return x.s >= Math.max(1, top * 0.7); });
    if (ok.length > 3 && ok.every(function (x) { return x.c.gid === ok[0].c.gid && x.s === top; })) /* pergunta de grupo inteiro */
      return { lista: [{ nome: ok[0].c.grupo, grupo: ok[0].c.grupo, pagina: ok[0].c.pagina, filtro: null, gid: ok[0].c.gid }], cheio: true, forte: true };
    return { lista: ok.slice(0, 3).map(function (x) { return x.c; }), cheio: r[0].cheio, forte: r[0].forte };
  }
  function proximas(q) {
    var seen = {};
    return CATS.map(function (c) { var d = 99, i; for (i = 0; i < c.textos.length; i++) d = Math.min(d, dist(q, c.textos[i])); return { c: c, d: d }; })
      .sort(function (a, b) { return a.d - b.d; })
      .filter(function (x) { return x.d <= Math.max(1, lim(q)) && !seen[x.c.nome] && (seen[x.c.nome] = 1); }).slice(0, 3).map(function (x) { return x.c; });
  }
  function urlCat(c) { return R.base + c.pagina + (c.filtro ? '?cat=' + encodeURIComponent(c.filtro) : ''); }
  function urlGrupo(c) { return R.base + c.pagina; }

  /* ---------- planilhas ---------- */
  function paginaAtual() { return (R.paginaAtual || location.pathname).replace(/\/$/, '') || '/'; }
  function planilhaDaPagina() { var p = paginaAtual(); for (var i = 0; i < R.planilhas.length; i++) if (R.planilhas[i].pagina === p) return R.planilhas[i]; return null; }
  function planilhaDoGrupo(gid) { for (var i = 0; i < R.planilhas.length; i++) if (R.planilhas[i].gid === gid) return R.planilhas[i]; return null; }
  function nomesPlanilhas() { return R.planilhas.map(function (p) { return tituloGrupo(p.gid); }).join(' e '); }
  function parseCSV(t) {
    var L = [], a = false, c = '', l = [], i, ch, p;
    for (i = 0; i < t.length; i++) {
      ch = t[i]; p = t[i + 1];
      if (ch === '"') { if (!a) a = true; else if (p === '"') { c += '"'; i++; } else a = false; }
      else if (ch === ',' && !a) { l.push(c); c = ''; }
      else if ((ch === '\n' || ch === '\r') && !a) { if (c || l.length) { l.push(c); L.push(l); } c = ''; l = []; if (ch === '\r' && p === '\n') i++; }
      else c += ch;
    }
    if (c || l.length) L.push(l.concat(c));
    return L;
  }
  var EXTRA = ['whatsapp', 'maps', 'delivery', 'cardapio', 'instagram'];
  var CSV_CACHE = {};
  function carregarCSV(pl) {
    if (CSV_CACHE[pl.gid]) return CSV_CACHE[pl.gid];
    var key = 'rico_csv34_' + pl.gid;
    try { var s = JSON.parse(ss(key) || 'null'); if (s && Date.now() - s.t < 1800000) { CSV_CACHE[pl.gid] = Promise.resolve(s.r); return CSV_CACHE[pl.gid]; } } catch (e) {}
    CSV_CACHE[pl.gid] = fetch(pl.csv).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); }).then(function (t) {
      var k = pl.col;
      var rows = parseCSV(t).slice(1).filter(function (l) { return l[k.ativo] && String(l[k.ativo]).toLowerCase() === 'sim'; }).map(function (l) {
        var x = {}; EXTRA.forEach(function (n) { if (typeof k[n] === 'number' && k[n] >= 0) x[n] = String(l[k[n]] || '').trim(); });
        var buscaExtra = (k.busca || []).map(function (i) { return l[i] || ''; }).join(' ');
        return { n: (l[k.nome] || '').trim(), cat: l[k.cat] || '', sub: ((l[k.sub] || '') + ' ' + buscaExtra).trim(), obs: (l[k.obs] || '').slice(0, 300), slug: l[k.slug] || '', h: l[k.hor] || '',
          d: k.dias.map(function (i) { return l[i] || ''; }), ver: k.verificado >= 0 ? String(l[k.verificado] || '').toLowerCase() === 'sim' : false, x: x };
      });
      ss(key, JSON.stringify({ t: Date.now(), r: rows }));
      return rows;
    }).catch(function (e) { CSV_CACHE[pl.gid] = null; throw e; });
    return CSV_CACHE[pl.gid];
  }
  function todasLinhas() { /* [{r, pl}] de todas as planilhas; falha vira lista vazia */
    return Promise.all(R.planilhas.map(function (pl) { return carregarCSV(pl).then(function (rows) { return rows.map(function (r) { return { r: r, pl: pl }; }); }).catch(function () { return []; }); }))
      .then(function (g) { return [].concat.apply([], g); });
  }

  function datasEvento(v) {
    var out = [], m, re = /(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/g;
    while ((m = re.exec(String(v || '')))) out.push(new Date(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10)));
    return out;
  }
  function mesmoDia(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
  function eventoAtual(v) {
    var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    return datasEvento(v).some(function (d) { d.setHours(0, 0, 0, 0); return d >= hoje; });
  }
  function eventoHoje(v) {
    var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    return datasEvento(v).some(function (d) { return mesmoDia(d, hoje); });
  }
  /* ---------- fontes especiais: agenda, vagas e ônibus ---------- */
  var ESPECIAIS_CACHE = {};
  function carregarEspecial(nome) {
    var cfg = R.especiais && R.especiais[nome];
    if (!cfg) return Promise.resolve([]);
    if (ESPECIAIS_CACHE[nome]) return ESPECIAIS_CACHE[nome];
    ESPECIAIS_CACHE[nome] = fetch(cfg.csv).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); }).then(function (t) {
      var rows = parseCSV(t), h = (rows.shift() || []).map(norm);
      var ativos = rows.filter(function (l) { var ai = h.indexOf('ativo'); return l.length && (ai < 0 || String(l[ai] || '').toLowerCase() !== 'nao'); }).map(function (l) {
        var o = {}; h.forEach(function (k, i) { if (k) o[k] = String(l[i] || '').trim(); }); return o;
      });
      if (nome === 'eventos') ativos = ativos.filter(function (o) { return eventoAtual(o.data); });
      return ativos;
    }).catch(function (e) { ESPECIAIS_CACHE[nome] = null; throw e; });
    return ESPECIAIS_CACHE[nome];
  }
  function acharEspecial(q, nome, campos) {
    return carregarEspecial(nome).then(function (rows) {
      var toks = tokens(q), base = rows, genericos = nome === 'onibus' ? ['onibus','linha','linhas','horario','horarios','passagem','tarifa','itinerario'] : nome === 'eventos' ? ['evento','eventos','show','shows','festa','festas','agenda'] : ['vaga','vagas','emprego','empregos','trabalho','estagio','estagio'];
      toks = toks.filter(function (t) { return genericos.indexOf(t) < 0; });
      if (nome === 'eventos' && /\bhoje\b/.test(norm(q))) base = base.filter(function (o) { return eventoHoje(o.data); });
      return base.filter(function (o) { var s = campos.map(function (k) { return o[k] || ''; }).join(' '); return toks.some(function (t) { return temPalavra(norm(s), t); }); }).slice(0, 8);
    });
  }
  function ehEvento(q) { return /\b(evento|eventos|show|shows|festa|festas|feira|exposicao|exposição|agenda|rolando|acontece)\b/.test(q); }
  function ehVaga(q) { return /\b(vaga|vagas|emprego|empregos|trabalho|estagio|estágio|contratando|oportunidade)\b/.test(q); }
  function ehOnibus(q) { return /\b(onibus|ônibus|linha|linhas|passagem|tarifa|itinerario|itinerário)\b/.test(q); }
  function ehVitrine(q) { return /\b(livro|livros|autor|autora|autores|vitrine do escritor|escritor)\b/.test(q); }
  function responderVitrine(q) {
    if (!ehVitrine(q)) return null;
    var n = norm(q);
    if (/\b(livro|livros|autor|autora|autores|vitrine|escritor)\b/.test(n)) { ULTIMO_GUIA = 'Eu quis dizer que ainda não localizei esse título ou autor na Vitrine. Posso te mostrar a Vitrine, ajudar a encontrar outros autores ou orientar o autor sobre como solicitar a inclusão.'; return ok([{ t: 'Ainda não localizei esse título ou autor na Vitrine do Escritor.' }, { t: 'Mas posso te ajudar a continuar: você pode conhecer os autores e livros disponíveis, ou avisar o autor para solicitar a inclusão da obra.' }, { l: [['Abrir a Vitrine do Escritor', R.base + '/p/vitrine-do-escritor.html'], ['Falar com a equipe', 'https://wa.me/' + R.whatsapp]] }]); }
    return null;
  }
  function responderEspecial(q) {
    var nome, campos, titulo, vazio;
    if (ehEvento(q)) { nome = 'eventos'; campos = ['titulo','local','descricao','categoria']; titulo = 'eventos'; vazio = 'Ainda não localizei esse evento na agenda.'; }
    else if (ehVaga(q)) { nome = 'vagas'; campos = ['empresa','cargo','descricao','local','tipo','requisitos']; titulo = 'vagas'; vazio = 'Ainda não localizei uma vaga com esse perfil.'; }
    else if (ehOnibus(q)) { nome = 'onibus'; campos = ['empresa','itinerario','tipo']; titulo = 'linhas de ônibus'; vazio = 'Ainda não localizei essa linha nos horários disponíveis.'; }
    else return null;
    return acharEspecial(q, nome, campos).then(function (rows) {
      var cfg = R.especiais[nome], b = [];
      if (!rows.length) { ULTIMO_GUIA = 'Eu não consegui localizar esse item agora, mas ainda posso abrir a página correspondente ou ajudar a avisar a equipe.'; return { blocos: [{ t: vazio + ' Posso abrir a página para você conferir os filtros. Se perceber que algo precisa ser atualizado, fale com a equipe por aqui.' }, { l: [['Abrir ' + titulo, R.base + cfg.pagina], ['Falar com a equipe', 'https://wa.me/' + R.whatsapp]] }], achou: false }; }
      b.push({ t: 'Encontrei ' + rows.length + (rows.length === 1 ? ' resultado:' : ' resultados:') });
      b.push({ l: rows.map(function (o) {
        var label = nome === 'eventos' ? (o.titulo || 'Evento') + (o.data ? ' · ' + o.data : '') : nome === 'vagas' ? (o.cargo || 'Vaga') + (o.empresa ? ' · ' + o.empresa : '') : (o.itinerario || 'Linha') + (o.empresa ? ' · ' + o.empresa : '');
        return [label, R.base + cfg.pagina];
      }) });
      b.push({ t: 'A página tem filtros e detalhes atualizados:', l: [['Abrir ' + titulo, R.base + cfg.pagina]] });
      return { blocos: b, achou: true };
    }).catch(function () { return { blocos: [{ t: 'Tive um probleminha para consultar ' + titulo + ' agora. Se quiser, tente de novo daqui a pouco.' }], achou: false }; });
  }

  /* ---------- horário (mesma lógica da página, modo 7 dias) ---------- */
  function fechado(v) { var s = String(v || '').trim().toLowerCase(); return s === '' || s === 'nao' || s === 'não' || s === 'fechado' || s === 'closed'; }
  function hojeH(r) { var h = r.d[new Date().getDay()]; if (!fechado(h)) return h.trim(); return fechado(r.h) ? null : r.h.trim(); }
  function analisar(hr) {
    if (!hr) return { aberto: false };
    var h = hr.trim().toLowerCase();
    if (['marcado', 'agendamento', 'consultar', 'combinar', 'agendar', 'marcar'].some(function (p) { return h.indexOf(p) > -1; })) return { marcado: true };
    if (h === '24h' || h === '0h-24h' || h === '0:00-24:00' || h === '24hrs' || h === '24 horas') return { aberto: true, h24: true };
    var ag = new Date(), am = ag.getHours() * 60 + ag.getMinutes(), TT = hr.split(/[\/,;]| e /), i, m, ini, fh, fm, fim, ab, wrap;
    for (i = 0; i < TT.length; i++) {
      m = TT[i].trim().match(/(\d{1,2})(?:h|:)?(\d{0,2})\s*(?:-|–|às|a)\s*(\d{1,2})(?:h|:)?(\d{0,2})/);
      if (!m) continue;
      ini = parseInt(m[1], 10) * 60 + (m[2] ? parseInt(m[2], 10) : 0);
      fh = parseInt(m[3], 10); fm = m[4] ? parseInt(m[4], 10) : 0;
      wrap = fh >= 24 || ini > (fh * 60 + fm);
      if (fh >= 24) fh -= 24;
      fim = fh * 60 + fm; if (fh === 0 && fm === 0) fim = 1440;
      ab = wrap ? (am >= ini || am <= fim) : (am >= ini && am <= fim);
      if (ab) return { aberto: true, fecha: ('0' + fh).slice(-2) + ':' + ('0' + fm).slice(-2) };
    }
    return { aberto: false };
  }
  function status(r) { var a = analisar(hojeH(r)); return a.marcado ? 'por agendamento' : a.aberto ? (a.h24 ? '24 horas' : 'aberto até ' + a.fecha) : 'fechado'; }
  function aberto(r) { return !!analisar(hojeH(r)).aberto; }
  function urlLugar(it) { return R.base + it.pl.pagina + '?qr=' + encodeURIComponent(it.r.slug); }
  function linkLugar(it) { return [it.r.n + ' · ' + status(it.r), urlLugar(it)]; }

  /* ---------- achar o lugar pelo NOME (nunca chuta: exato, quase ou parcial) ---------- */
  function nomeMatch(r, toks) {
    var tn = norm(r.n), exato = 0, aprox = 0;
    toks.forEach(function (t) {
      var tS = singular(t);
      if (temPalavra(tn, t) || (tS !== t && temPalavra(tn, tS))) exato++;
      else if (lim(t) > 0 && dist(t, tn) <= lim(t)) aprox++;
    });
    return { exato: exato, aprox: aprox };
  }
  function resolverAlvo(itens, toks) {
    var res = itens.map(function (it) { var m = nomeMatch(it.r, toks); return { r: it.r, pl: it.pl, e: m.exato, a: m.aprox }; });
    var exatos = res.filter(function (x) { return x.e === toks.length; });
    if (exatos.length === 1) return { tipo: 'unico', item: exatos[0] };
    if (exatos.length > 1) return { tipo: 'opcoes', nivel: 'exato', lista: exatos.slice(0, 4), pergunta: 'Achei mais de um. Qual deles?' };
    var quase = res.filter(function (x) { return x.e + x.a === toks.length; });
    if (quase.length) return { tipo: 'opcoes', nivel: 'quase', lista: quase.slice(0, 4), pergunta: 'Você quis dizer:' };
    var parcial = res.filter(function (x) { return x.e + x.a > 0; }).sort(function (a, b) { return (b.e + b.a) - (a.e + a.a); }).slice(0, 4);
    if (parcial.length) return { tipo: 'opcoes', nivel: 'parcial', lista: parcial, pergunta: 'Não achei exatamente. Você quis dizer:' };
    return { tipo: 'nenhum' };
  }

  /* ---------- perguntas sobre um lugar (tudo vem da planilha) ---------- */
  var FU = {
    telefone: { re: 'telefone|fone|numero|celular|whatsapp|whats|zap|contato|ligar', campo: 'whatsapp', label: 'telefone' },
    endereco: { re: 'endereco|onde fica|localiza|rua|bairro|local', campo: 'maps', label: 'localização' },
    mapa: { re: 'mapa|como chegar|rota|localizacao', campo: 'maps', label: 'localização' },
    delivery: { re: 'delivery|entrega|entregam|domicilio', campo: 'delivery', label: 'informação de delivery' },
    cardapio: { re: 'cardapio|menu|preco|precos|valores|valor', campo: 'cardapio', label: 'cardápio' },
    instagram: { re: 'instagram|insta', campo: 'instagram', label: 'Instagram' },
    horario: { re: 'horario|horarios|funcionamento|que horas', campo: '', label: 'horário' },
    sobre: { re: 'sobre|fale sobre|me fale|detalhes|informacao|informacoes|o que sabe|quem e', campo: '', label: 'informações' }
  };
  if (T.followups) Object.keys(T.followups).forEach(function (k) { if (FU[k] && T.followups[k].re) FU[k].re = T.followups[k].re; });
  var FU_WORDS = {};
  Object.keys(FU).forEach(function (k) { FU[k].re.split('|').forEach(function (w) { w.split(' ').forEach(function (x) { FU_WORDS[x] = 1; }); }); });
  function ehFollowUp(q) { for (var k in FU) if (new RegExp('\\b(' + FU[k].re + ')\\b', 'i').test(q)) return k; return null; }

  function celula(row, campo) { return (row.x && row.x[campo]) || ''; }
  function numeros(cel) {
    return String(cel || '').split(/[,;\n]+/).map(function (p) {
      var pr = p.split('|'), nome = pr.length > 1 ? pr[0].trim() : '', n = (pr.length > 1 ? pr.slice(1).join('|') : p).replace(/\D/g, '');
      if (n.length > 11 && n.indexOf('55') === 0) n = n.slice(2);
      return n.length >= 10 ? { nome: nome, n: n } : null;
    }).filter(Boolean);
  }
  function fmtTel(n) { return n.length === 11 ? '(' + n.slice(0, 2) + ') ' + n.slice(2, 7) + '-' + n.slice(7) : n.length === 10 ? '(' + n.slice(0, 2) + ') ' + n.slice(2, 6) + '-' + n.slice(6) : n; }
  function listaNomeValor(v) {
    return String(v || '').split(/[,\n;]+/).map(function (s) { return s.trim(); }).filter(Boolean).map(function (p) {
      if (p.indexOf('|') < 0) return { nome: '', url: p };
      var a = p.split('|'); return { nome: a[0].trim(), url: a.slice(1).join('|').trim() };
    }).filter(function (i) { return seguro(i.url); });
  }
  function alternativas(row, exceto) { /* o que o lugar tem, quando falta o que a pessoa pediu */
    var l = [], nums = numeros(celula(row, 'whatsapp')), ig = seguro(celula(row, 'instagram')), mp = seguro(celula(row, 'maps'));
    if (nums.length && exceto !== 'telefone') l.push(['WhatsApp ' + fmtTel(nums[0].n), 'https://wa.me/55' + nums[0].n]);
    if (ig && exceto !== 'instagram') l.push(['Instagram', ig]);
    if (mp && exceto !== 'endereco' && exceto !== 'mapa') l.push(['Localização', mp]);
    return l;
  }
  function falta(kind, row) {
    var b = [{ t: 'A informação de ' + FU[kind].label + ' não está disponível para o cadastro de ' + row.n + '.' }], alt = alternativas(row, kind);
    if (alt.length) b.push({ t: 'Enquanto isso, você pode falar com ele por estes canais:', l: alt });
    else b.push({ t: 'Se quiser avisar a equipe que essa informação precisa ser melhorada, você pode deixar sua opinião ou pedir uma atualização por estes canais:', l: [['Falar pelo WhatsApp', 'https://wa.me/' + R.whatsapp], ['Enviar e-mail', 'mailto:' + R.email]] });
    return b;
  }
  function respostaFU(kind, row) {
    var v = FU[kind].campo ? celula(row, FU[kind].campo) : '', i, u, its, nums;
    if (kind === 'sobre') {
      var resumo = [row.n];
      if (row.cat) resumo.push(row.cat);
      if (row.sub) resumo.push(row.sub);
      if (row.obs) resumo.push(row.obs);
      var extras = alternativas(row, 'sobre');
      return [{ t: resumo.join(' — ') + '.' }, { t: extras.length ? 'Também posso abrir estes contatos:' : 'Outras informações não estão disponíveis para este cadastro.', l: extras.length ? extras : null }];
    }
    if (kind === 'horario') {
      var hj = hojeH(row), a = analisar(hj), prox = proximoHorario(row), bH = [];
      if (!hj) {
        bH.push({ t: 'Hoje eu não consegui confirmar um horário de funcionamento para ' + row.n + '.' });
        if (prox) bH.push({ t: 'O próximo horário informado é ' + prox.dia + ': ' + prox.horario + '.' });
        bH.push({ t: 'Se ele estiver funcionando hoje, esse detalhe ainda não aparece para mim. Posso te ajudar por outro caminho:', l: alternativas(row, 'horario').length ? alternativas(row, 'horario') : [['Falar pelo WhatsApp', 'https://wa.me/' + R.whatsapp], ['Enviar e-mail', 'mailto:' + R.email]] });
        return bH;
      }
      return [{ t: row.n + ' hoje: ' + (a.marcado ? 'atende com horário marcado' : hj + ' (' + status(row) + ')') + '.' }];
    }
    if (kind === 'telefone') {
      nums = numeros(v); if (!nums.length) return falta(kind, row);
      var ls_ = []; nums.forEach(function (x) { ls_.push(['WhatsApp ' + fmtTel(x.n), 'https://wa.me/55' + x.n]); });
      if (nums.length === 1) ls_.push(['Ligar', 'tel:+55' + nums[0].n]);
      return [{ t: row.n + ': ' + nums.map(function (x) { return (x.nome ? x.nome + ' ' : '') + fmtTel(x.n); }).join(' e '), l: ls_ }];
    }
    if (kind === 'endereco' || kind === 'mapa') { u = seguro(v); return u ? [{ t: row.n + ':', l: [['Abrir localização', u]] }] : falta(kind, row); }
    if (kind === 'delivery') { return v ? [{ t: row.n + ': ' + (norm(v).charAt(0) === 's' ? 'faz delivery.' : 'não faz delivery.') }] : falta(kind, row); }
    if (kind === 'instagram') { u = seguro(v); return u ? [{ t: row.n + ':', l: [['Abrir Instagram', u]] }] : falta(kind, row); }
    if (kind === 'cardapio') {
      its = listaNomeValor(v); if (!its.length) return falta(kind, row);
      return [{ t: 'Cardápio de ' + row.n + ':', l: its.map(function (x) { return [x.nome || 'Cardápio', seguro(x.url)]; }) }];
    }
    return falta(kind, row);
  }

  /* ---------- contexto da conversa ---------- */
  var CTX = { termo: '', planilha: null, lista: null, item: null, ts: 0, vazias: 0 };
  var ULTIMA_ACAO = null, ULTIMO_GUIA = null;
  function ctxAtivo() { return CTX.termo && (Date.now() - CTX.ts < 300000) && CTX.vazias < 3; }
  function ctxReset() { CTX = { termo: '', planilha: null, lista: null, item: null, ts: 0, vazias: 0 }; ULTIMA_ACAO = null; }
  function ctxSet(termo, lista, item) { CTX = { termo: termo || 'x', planilha: (item && item.pl) || (lista && lista[0] && lista[0].pl) || CTX.planilha, lista: lista || null, item: item || null, ts: Date.now(), vazias: 0 }; }
  function salvarUltimo(termo, gid) { if (termo) ls('rico_ultimo34', JSON.stringify({ termo: termo, gid: gid, ts: Date.now() })); }
  function lerUltimo() { try { return JSON.parse(ls('rico_ultimo34') || 'null'); } catch (e) { return null; } }
  function limparUltimo() { ls('rico_ultimo34', null); }

  /* ---------- interface ---------- */
  var raiz, fab, painel, msgs, inp;
  function descer() { if (msgs) msgs.scrollTop = msgs.scrollHeight; }
  function msg(t, quem) { var p = el('p', 'rico-m rico-' + quem); p.textContent = t; msgs.appendChild(p); descer(); return p; }
  function typing() { var p = el('p', 'rico-m rico-bot rico-typing'); p.innerHTML = '<span></span><span></span><span></span>'; msgs.appendChild(p); descer(); return p; }
  function links(arr) {
    arr = arr.filter(function (l) { return l && l[1]; });
    if (!arr.length) return;
    var box = el('div', 'rico-links');
    arr.forEach(function (l, i) { var a = el('a', 'rico-bt'); a.href = l[1]; a.textContent = l[0]; a.style.animationDelay = (i * 30) + 'ms'; box.appendChild(a); });
    box.addEventListener('click', function (e) { var a = e.target.closest('a.rico-bt'); if (a) track('rico_link_clicado', { destino: a.getAttribute('href'), pagina: tipoPagina() }); });
    msgs.appendChild(box); descer();
  }
  function acoes(arr) {
    var box = el('div', 'rico-links');
    arr.forEach(function (a) { var b = el('button', 'rico-bt'); b.type = 'button'; b.textContent = a[0]; b.addEventListener('click', function () { box.remove(); a[1](); }); box.appendChild(b); });
    msgs.appendChild(box); descer();
  }
  function mostrar(blocos) { blocos.forEach(function (b) { if (b.t) msg(b.t, 'bot'); if (b.l) links(b.l); if (b.a) acoes(b.a); }); }

  function tipoPagina() {
    var p = paginaAtual();
    if (p === '/' || p === '') return 'home';
    if (/categorias/.test(p)) return 'categorias';
    if (/vitrine/.test(p)) return 'vitrine';
    if (/empregos/.test(p)) return 'vagas';
    if (/onibus|horario-de-onibus/.test(p)) return 'onibus';
    if (/trilhas/.test(p)) return 'trilhas';
    if (/festas-e-eventos/.test(p)) return 'festas';
    if (/turismo-e-hospedagem/.test(p)) return 'turismo';
    if (/onde-comer|mercados|casa-e-decoracao|construcao|servicos-profissionais|saude|beleza|automotivo|transporte|educacao|residenciais|solucoes|pets|campo-e-grandes|moda|destaques/.test(p)) return 'grupo';
    return 'default';
  }
  function saudacao() { var h = new Date().getHours(); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; }
  function atalhos() { return R.atalhos.map(function (a) { return [a[0], R.base + a[1]]; }); }
  function ehPedidoCategorias(q) { return /\b(categoria|categorias|tipos|opcoes|opções)\b/.test(q) || /^(e\s+)?(almoçar|almoco|almocar|lanchar|comer|tomar cafe|tomar café)\b/.test(q); }
  function categoriasDisponiveis(q) {
    var n = norm(q), escolhidas = [];
    if (/\b(almoco|almocar|refeicao|comida|comer)\b/.test(n)) escolhidas = CATS.filter(function (c) { return c.gid === 'onde-comer' && c.filtro === 'restaurantes-e-marmitarias'; });
    else if (/\b(lanche|lanchar|hamburguer|pizza|pizzaria)\b/.test(n)) escolhidas = CATS.filter(function (c) { return c.gid === 'onde-comer' && c.filtro === 'lanchonetes-e-pizzarias'; });
    else if (/\b(cafe|padaria|bolo)\b/.test(n)) escolhidas = CATS.filter(function (c) { return c.gid === 'onde-comer' && c.filtro === 'padarias-confeitarias-e-cafes'; });
    if (escolhidas.length) return { titulo: 'Para esse tipo de busca, estas são as categorias mais relacionadas:', cats: escolhidas };
    var grupos = D.grupos.map(function (g) { return { nome: g[1], pagina: g[2], filtro: null, gid: g[0] }; });
    return { titulo: 'Estas são as categorias e grupos disponíveis no guia:', grupos: grupos };
  }
  function respostaCategorias(q) {
    var r = categoriasDisponiveis(q);
    if (r.cats) return { blocos: [{ t: r.titulo }, { l: r.cats.map(function (c) { return [c.nome, urlCat(c)]; }) }], achou: true };
    return { blocos: [{ t: r.titulo }, { l: r.grupos.map(function (g) { return [g.nome, urlGrupo(g)]; }) }], achou: true };
  }
  function ehEsclarecimento(q) { return /^(como assim|o que quer dizer|nao entendi|não entendi|explica|explique)\b/.test(q); }
  function ehPagina(q) { return /\b(como funciona|onde estou|em que pagina|qual pagina|o que tem nesta pagina|o que tem nessa pagina)\b/.test(q); }
  function ehSaudacao(q) { return /^(oi|ola|olá|bom dia|boa tarde|boa noite|e ai|e aí|tudo bem)\b/.test(q); }
  function ehPedidoAmplo(q) { return /\b(quero um lugar|preciso de um lugar|me ajuda|pode me ajudar|estou procurando algo|quero encontrar algo)\b/.test(q); }
  function respostaPagina(q) {
    if (!ehPagina(q)) return null;
    var tipo = tipoPagina(), b;
    if (tipo === 'turismo') b = [{ t: 'Você está na área de Turismo e Hospedagem. Aqui dá para descobrir onde ficar, encontrar guias e conhecer passeios e experiências de Rio Claro.' }, { t: 'Se você estiver planejando uma visita, posso te ajudar a procurar hospedagem, guias, excursões e lugares para comer.' }, { l: [['Ver Turismo e Hospedagem', R.base + '/p/turismo-e-hospedagem.html'], ['Onde Comer', R.base + '/p/onde-comer_13.html']] }];
    else if (tipo === 'grupo') b = [{ t: 'Você está em uma página de serviços e lugares de Rio Claro. Aqui eu posso te ajudar a encontrar opções, consultar detalhes e procurar alternativas próximas.' }, { l: atalhos() }];
    else if (tipo === 'vagas') b = [{ t: 'Você está na área de Empregos e Estágios. Aqui você pode procurar oportunidades e conferir os detalhes das vagas.' }, { l: [['Abrir Empregos e Estágios', R.base + '/p/empregos-e-estagios.html'], ['Falar com a equipe', 'https://wa.me/' + R.whatsapp]] }];
    else if (tipo === 'onibus') b = [{ t: 'Você está na área de Horários de Ônibus. Posso ajudar a procurar uma linha ou mostrar caminhos alternativos, como táxi e motoristas particulares.' }, { l: [['Falar com a equipe', 'https://wa.me/' + R.whatsapp]] }];
    else if (tipo === 'festas') b = [{ t: 'Você está na área de Festas e Eventos. Posso ajudar a encontrar serviços para uma comemoração ou procurar o que está acontecendo na cidade.' }, { l: [['Abrir Festas e Eventos', R.base + '/p/festas-e-eventos.html'], ['Abrir a agenda', R.base + '/p/festas-e-eventos_27.html']] }];
    else b = [{ t: 'Você está no Economizei! Rio Claro. Esta área ajuda a encontrar lugares, serviços e informações da cidade.' }, { t: 'Me diga o que você está procurando e eu te ajudo a escolher o melhor caminho.', l: atalhos() }];
    return ok(b);
  }
  function proximoHorario(r) {
    var hoje = new Date().getDay(), nomes = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'], i, idx, h;
    for (i = 1; i <= 7; i++) { idx = (hoje + i) % 7; h = r.d[idx]; if (!fechado(h)) return { dia: nomes[idx], horario: String(h).trim() }; }
    return null;
  }
  function respostaEsclarecimento() {
    if (!CTX.item && ULTIMO_GUIA) return { blocos: [{ t: ULTIMO_GUIA }], achou: true };
    if (!CTX.item) return null;
    var r = CTX.item.r, h = hojeH(r), prox = proximoHorario(r), b = [];
    if (!h) {
      b.push({ t: 'Quis dizer que hoje eu não consegui confirmar um horário de funcionamento para ' + r.n + '.' });
      if (prox) b.push({ t: 'O próximo horário informado é ' + prox.dia + ': ' + prox.horario + '.' });
      b.push({ t: 'Se ele estiver funcionando hoje, esse detalhe ainda não aparece para mim. Posso te ajudar por outro caminho:', l: alternativas(r, 'horario').length ? alternativas(r, 'horario') : [['Falar pelo WhatsApp', 'https://wa.me/' + R.whatsapp], ['Enviar e-mail', 'mailto:' + R.email]] });
    } else b.push({ t: 'O horário informado para ' + r.n + ' é: ' + h + '. A indicação de aberto ou fechado depende do horário atual.' });
    return { blocos: b, achou: true };
  }

  /* ---------- entender a frase ---------- */
  function ehSim(q) {
    var n = normQ(q);
    if (T.sinonimos && T.sinonimos[n]) return T.sinonimos[n] === 'sim';
    return /^(sim|pode|quero|manda|mostra|claro|beleza|ok|okay|vamos|continua|continuar|bora|isso|pode falar|fala|manda ver|conta|diz|vai|certeza|com certeza|pode ser|ta bom)\b/.test(n);
  }
  function ehNao(q) { return /^(nao|agora nao|depois|deixa|deixa pra depois|cancela|nem)\b/.test(normQ(q)); }
  function ehMais(q) { return /^(mais|tem mais|quais os outros|outros|outras|proximos|proximas|ver mais)\b/.test(normQ(q)); }
  function ehAberto(q) { return /\b(abert[oa]s?|abre|abrem|abrir|fecha|fecham|funciona|funcionando)\b/.test(q) || /\bagora\b/.test(q) && /\b(tem|tá|ta|esta|estao|quais|qual)\b/.test(q); }
  function ehNaoComercial(q) { if (!T.naoComercial) return false; for (var i = 0; i < T.naoComercial.length; i++) if (q.indexOf(norm(T.naoComercial[i])) > -1) return true; return false; }
  var SITE_WORDS = ['economizei', 'renan', 'rico', 'site', 'equipe', 'projeto'];
  var GENERICO = /\b(comercio|comercios|negocio|negocios|estabelecimento|estabelecimentos|empresa|empresas)\b/;
  function acharRespostaFixa(q) {
    if (!T.respostas) return null;
    for (var i = 0; i < T.respostas.length; i++) for (var j = 0; j < T.respostas[i].termos.length; j++)
      if (new RegExp('\\b' + norm(T.respostas[i].termos[j]) + '\\b', 'i').test(q)) return T.respostas[i];
    return null;
  }

  /* ---------- montar respostas ---------- */
  function ok(blocos) { return Promise.resolve({ blocos: blocos, achou: true }); }
  function setItem(it, termo) { ctxSet(termo || CTX.termo, null, it); }
  function opcoesFU(kind, itens, pergunta) {
    return [{ t: pergunta }, { a: itens.map(function (it) { return [it.r.n, function () { setItem(it); mostrar(respostaFU(kind, it.r)); }]; }) }];
  }
  function listaAbertos(itens, cat) {
    var ver = itens.filter(function (i) { return i.r.ver; }), out = itens.filter(function (i) { return !i.r.ver; }), b = [];
    if (ver.length) { b.push({ t: ver.length === 1 ? 'Esta é a opção:' : 'Estas são as opções:' }); b.push({ l: ver.slice(0, 5).map(linkLugar) }); if (out.length) b.push({ t: 'Outras opções:' }); }
    if (out.length) { if (!ver.length) b.push({ t: 'Achei ' + out.length + (out.length === 1 ? ' opção:' : ' opções:') }); b.push({ l: out.slice(0, 5).map(linkLugar) }); }
    if (cat) b.push({ t: 'Tem mais. Quer ver na categoria?', l: [[cat.nome + ' — todas', urlCat(cat)]] });
    CTX.lista = itens; CTX.item = null; CTX.ts = Date.now();
    return b;
  }
  function comCategorias(blocos, ach) {
    if (ach.lista.length && ach.cheio && ach.forte && ach.lista[0].filtro) blocos.push({ t: 'Ou veja a categoria:', l: ach.lista.map(function (c) { return [c.nome, urlCat(c)]; }) });
    return blocos;
  }

  function responderIntencao(txt) {
    var q = normQ(txt), toksAll = tokens(txt), kind = ehFollowUp(q);
    var toks = kind ? toksAll.filter(function (t) { return !FU_WORDS[t]; }) : toksAll;
    var ach = acharCats(toks);
    if (ehEsclarecimento(q) && ((ctxAtivo() && CTX.item) || ULTIMO_GUIA)) return Promise.resolve(respostaEsclarecimento());
    var pagina = respostaPagina(q);
    if (pagina) return pagina;
    if (ehSaudacao(q)) return ok([{ t: saudacao() + '! Eu sou o Rico. Quer descobrir um lugar, serviço, evento ou oportunidade em Rio Claro?' }, { l: atalhos() }]);
    if (ehPedidoAmplo(q)) return ok([{ t: 'Claro! Eu posso te ajudar a encontrar um lugar ou serviço em Rio Claro. Você está pensando em comer, cuidar da saúde, trabalhar, passear ou outra coisa?' }, { l: atalhos() }]);

    function resto() {
      var vit = responderVitrine(q);
      if (vit) return vit;
      var esp = responderEspecial(q);
      if (esp) return esp;
      if (/\bonibus\b/.test(q) && /\b(horario|horarios|passa|sai|linha|linhas|tarifa|passagem)\b/.test(q))
        return ok([{ t: 'Os horários de ônibus eu ainda não consulto por aqui.', l: R.paginaOnibus ? [['Horários de ônibus', R.base + R.paginaOnibus]] : null }]);
      var fixa = acharRespostaFixa(q);
      if (fixa) return ok([{ t: fixa.resposta, l: fixa.link ? [fixa.link] : null }]);

      if (ehMais(q) && ctxAtivo() && CTX.lista && CTX.lista.length > 5) return ok(listaAbertos(CTX.lista.slice(5), null));

      if (ehPedidoCategorias(q)) return ok([].concat(respostaCategorias(q).blocos));

      if (ehAberto(q)) {
        var c0 = ach.lista[0] && ach.lista[0].filtro ? ach.lista[0] : null, pl;
        if (ach.lista[0]) pl = planilhaDoGrupo(ach.lista[0].gid);
        else pl = planilhaDaPagina() || (ctxAtivo() ? CTX.planilha : null) || R.planilhas[0];
        if (!pl) return ok([{ t: 'Eu consigo consultar horários de alguns lugares do guia, mas essa opção não está disponível nesta página. Posso te ajudar por outro caminho:', l: ach.lista.filter(function (c) { return c.filtro; }).map(function (c) { return [c.nome, urlCat(c)]; }) }]);
        return carregarCSV(pl).then(function (rows) {
          var itens = rows.filter(function (r) { return !c0 || norm(r.cat) === norm(c0.nome); }).map(function (r) { return { r: r, pl: pl }; });
          var abertos = itens.filter(function (i) { return aberto(i.r); }).sort(function (a, b) { return a.r.n.localeCompare(b.r.n); });
          var depois = itens.filter(function (i) { var h = hojeH(i.r); return !aberto(i.r) && h && analisar(h).aberto === false && !analisar(h).marcado; });
          ctxSet(txt, null, null);
          if (abertos.length) {
            ULTIMA_ACAO = function () { mostrar(listaAbertos(abertos, c0)); };
            return { blocos: [{ t: 'Tem ' + abertos.length + (abertos.length === 1 ? ' opção aberta' : ' opções abertas') + ' agora em ' + tituloGrupo(pl.gid) + '. Quer ver?' },
              { a: [['Sim, mostrar', function () { var f = ULTIMA_ACAO; ULTIMA_ACAO = null; if (f) f(); }], ['Agora não', function () { ULTIMA_ACAO = null; msg('Tudo bem. Se precisar, é só falar.', 'bot'); }]] }], achou: true };
          }
          ULTIMA_ACAO = null;
          if (depois.length) return { blocos: [{ t: 'Agora não tem nada aberto. Estes abrem mais tarde:' }, { l: depois.slice(0, 5).map(function (i) { return [i.r.n + ' · ' + hojeH(i.r), urlLugar(i)]; }) }], achou: true };
          return { blocos: [{ t: 'Olhei as opções dessa categoria e, neste momento, não encontrei nenhuma aberta. Talvez seja melhor tentar outro horário ou escolher uma categoria diferente.' }].concat(c0 ? [{ l: [[c0.nome + ' — ver opções', urlCat(c0)]] }] : []), achou: false };
        }).catch(function () { return { blocos: [{ t: 'Tive um probleminha para consultar os horários agora. Tente de novo em instantes.' }], achou: false }; });
      }

      if (GENERICO.test(q) && !toks.filter(function (t) { return !GENERICO.test(t); }).length)
        return ok([{ t: 'O guia comercial reúne tudo por categoria. Por onde você quer começar?', l: [['Todas as categorias', R.base + R.paginaCategorias]].concat(atalhos().slice(0, 1)) }]);

      if (!toks.length) {
        if (CTX.termo) CTX.vazias++;
        return ok([{ t: 'O que você procura? Um lugar, um serviço, uma vaga?', l: atalhos() }]);
      }

      var soCategoria = ach.forte && ach.cheio && ach.lista.length && !ach.lista.some(function (c) { return planilhaDoGrupo(c.gid); });
      return (soCategoria ? Promise.resolve([]) : todasLinhas()).then(function (itens) {
        var nomes = itens.length ? resolverAlvo(itens, toks) : { tipo: 'nenhum' };

        if (nomes.tipo === 'unico') {
          ctxSet(txt, null, nomes.item); salvarUltimo(txt, nomes.item.pl.gid);
          return { blocos: comCategorias([{ t: 'Achei:', l: [linkLugar(nomes.item)] }], ach), achou: true };
        }
        if (nomes.tipo === 'opcoes' && nomes.nivel !== 'parcial') {
          ctxSet(txt, nomes.lista, null); salvarUltimo(txt, nomes.lista[0].pl.gid);
          return { blocos: comCategorias([{ t: nomes.pergunta }, { l: nomes.lista.map(linkLugar) }], ach), achou: true };
        }

        if (ach.lista.length && ach.forte) {
          var c0 = ach.lista[0];
          if (!c0.filtro) {
            salvarUltimo(txt, c0.gid);
            return { blocos: [{ t: 'Em ' + c0.nome + ' tem estas categorias:' }, { l: [[c0.nome + ' — tudo', urlGrupo(c0)]].concat(CATS.filter(function (x) { return x.gid === c0.gid; }).map(function (x) { return [x.nome, urlCat(x)]; })) }], achou: true };
          }
          if (ach.lista.length > 1) {
            salvarUltimo(txt, c0.gid);
            return { blocos: [{ t: 'Achei mais de uma categoria. Qual delas?' }, { l: ach.lista.map(function (c) { return [c.nome, urlCat(c)]; }) }], achou: true };
          }
          var pl = planilhaDoGrupo(c0.gid), lin = pl ? itens.filter(function (i) { return i.pl === pl && norm(i.r.cat) === norm(c0.nome); }) : [];
          salvarUltimo(txt, c0.gid);
          if (lin.length) {
            ctxSet(txt, lin, lin.length === 1 ? lin[0] : null);
            var b = [{ t: 'Achei em ' + c0.grupo + ' — ' + c0.nome + ':' }, { l: lin.slice(0, 5).map(linkLugar) }];
            if (lin.length > 5) b.push({ t: 'Mostrando 5 de ' + lin.length + '. Veja todos na categoria:' });
            b.push({ l: [[c0.nome + ' — ver todas', urlCat(c0)]] });
            return { blocos: b, achou: true };
          }
          return { blocos: [{ t: 'Ainda não encontrei uma opção nessa categoria: ' + c0.nome + '. Talvez ela esteja sem opções disponíveis agora.' }, { t: 'Você pode dar uma olhada nessa categoria ou me dizer o que gostaria de encontrar em ' + c0.grupo + '. O que você prefere?', l: [[c0.nome, urlCat(c0)], ['Falar com a equipe', 'https://wa.me/' + R.whatsapp]] }], achou: false };
        }

        if (ehNaoComercial(q)) return { blocos: [{ t: 'Essa eu não sei responder. Mas posso te ajudar a achar lugares e serviços em Rio Claro. O que você procura?', l: atalhos() }], achou: false };

        var sub = itens.filter(function (i) {
          var sx = norm(i.r.sub + ' ' + i.r.obs), uteis = toks.filter(function (t) { return t.length > 2; });
          return uteis.length && uteis.some(function (t) { return temPalavra(sx, t) || (singular(t) !== t && temPalavra(sx, singular(t))); });
        });
        if (sub.length) {
          ctxSet(txt, sub, sub.length === 1 ? sub[0] : null);
          return { blocos: [{ t: 'Achei ' + (sub.length === 1 ? '1 lugar' : sub.length + ' lugares') + ' ligados a "' + toks.join(' ') + '":' }, { l: sub.slice(0, 5).map(linkLugar) }], achou: true };
        }

        if (nomes.tipo === 'opcoes') { /* só parcial */
          ctxSet(txt, nomes.lista, null);
          return { blocos: [{ t: nomes.pergunta }, { l: nomes.lista.map(linkLugar) }], achou: true };
        }

        var prox = proximas(toks.join(' '));
        ULTIMO_GUIA = 'Eu quis dizer que ainda não consegui localizar essa informação do jeito que você pediu. Posso tentar com outra palavra, mostrar opções parecidas ou indicar um caminho para avisar a equipe.';
        var blocos = [{ t: 'Hmm… ainda não consegui localizar isso. Você pode me explicar de outro jeito? Às vezes uma palavra diferente já me ajuda a encontrar.' + (prox.length ? ' Talvez você esteja procurando por:' : '') }];
        if (prox.length) blocos.push({ l: prox.map(function (c) { return [c.nome, urlCat(c)]; }) });
        blocos.push({ t: 'Se quiser, eu posso te mostrar os caminhos que conheço ou você pode me dizer um pouco mais do que está procurando.', l: [['Ver Categorias', R.base + R.paginaCategorias], ['Falar com a equipe', 'https://wa.me/' + R.whatsapp]] });
        ctxReset();
        return { blocos: blocos, achou: false };
      });
    }

    /* pergunta sobre um lugar: o dado só sai da planilha */
    if (kind) {
      if (!toks.length) {
        if (CTX.item && ctxAtivo()) return ok(respostaFU(kind, CTX.item.r));
        if (CTX.lista && CTX.lista.length && ctxAtivo()) return ok(opcoesFU(kind, CTX.lista.slice(0, 5), 'De qual deles?'));
      } else {
        return todasLinhas().then(function (itens) {
          var r = itens.length ? resolverAlvo(itens, toks) : { tipo: 'nenhum' };
          if (r.tipo === 'unico') { setItem(r.item, txt); return { blocos: respostaFU(kind, r.item.r), achou: true }; }
          if (r.tipo === 'opcoes') return { blocos: opcoesFU(kind, r.lista, r.pergunta), achou: true };
          if (toks.some(function (t) { return SITE_WORDS.indexOf(t) > -1; })) return resto();
          return { blocos: [{ t: 'Não consegui encontrar um lugar correspondente a "' + toks.join(' ') + '" para consultar ' + FU[kind].label + '.' }, { t: 'Mas não vamos parar por aí. Posso te orientar por outro caminho:', l: [['Ver Categorias', R.base + R.paginaCategorias], ['Falar com a equipe', 'https://wa.me/' + R.whatsapp]] }], achou: false };
        });
      }
    }
    return resto();
  }

  function enviar(v) {
    v = (v || '').trim();
    if (!v) return;
    msg(v, 'eu');
    inp.value = '';
    if (ehSim(v) && ULTIMA_ACAO) { var acao = ULTIMA_ACAO; ULTIMA_ACAO = null; acao(); track('rico_pergunta', { pagina: tipoPagina(), achou: 'sim' }); return; }
    if (ehNao(v) && ULTIMA_ACAO) { ULTIMA_ACAO = null; msg('Tudo bem. Se precisar, é só falar.', 'bot'); track('rico_pergunta', { pagina: tipoPagina(), achou: 'nao' }); return; }
    ULTIMA_ACAO = null;
    var t = typing();
    Promise.all([responderIntencao(v), new Promise(function (r) { setTimeout(r, 380); })]).then(function (res) {
      var r = res[0];
      t.remove(); mostrar(r.blocos);
      track('rico_pergunta', { pagina: tipoPagina(), achou: r.achou ? 'sim' : 'nao' });
      if (!r.achou) { var palavras = tokens(v).join(' ').slice(0, 60); if (palavras) track('rico_sem_resultado', { pagina: tipoPagina(), palavras: palavras }); }
    }).catch(function () { t.remove(); msg('Ihh, travei aqui. Tenta de novo?', 'bot'); });
    inp.focus();
  }

  function mostrarUltimoEstado() {
    var u = lerUltimo();
    if (!u || !u.termo) { msg(saudacao() + '! Sou o Rico. O que você procura?', 'bot'); links(atalhos()); return; }
    msg(saudacao() + '! Se quiser, posso continuar sua última busca: "' + u.termo + '". Se preferir, é só me dizer o que procura agora.', 'bot');
    links(atalhos());
  }

  function abrirPainel() {
    raiz.classList.add('rico-open'); fab.setAttribute('aria-expanded', 'true');
    if (!msgs.childNodes.length) mostrarUltimoEstado();
    setTimeout(function () { inp.focus(); descer(); }, 60);
    document.dispatchEvent(new CustomEvent('rico:abrir'));
  }
  function fecharPainel() { raiz.classList.remove('rico-open'); fab.setAttribute('aria-expanded', 'false'); document.dispatchEvent(new CustomEvent('rico:fechar')); }
  window.Rico = { abrir: abrirPainel, fechar: fecharPainel, estaAberto: function () { return raiz && raiz.classList.contains('rico-open'); } };

  var balaoEl = null, balaoTimer = null;
  function esconderBalao() { if (balaoEl) { balaoEl.remove(); balaoEl = null; } if (balaoTimer) { clearTimeout(balaoTimer); balaoTimer = null; } }
  function mostrarBalao(texto, cb) {
    if (ls('rico_mudo') === '1' || (raiz && raiz.classList.contains('rico-open'))) return;
    esconderBalao();
    balaoEl = el('div', 'rico-balao');
    var t = el('button', 'rico-balao-t'); t.type = 'button'; t.textContent = texto;
    t.addEventListener('click', function () {
      esconderBalao(); abrirPainel();
      if (cb) { msg('Dica: ' + cb.texto, 'bot'); if (cb.link) links([cb.link]); acoes([['Achou útil?', function () { msg('Que bom!', 'bot'); }], ['Não', function () { msg('Tudo bem.', 'bot'); }]]); }
    });
    var x = el('button', 'rico-balao-x'); x.type = 'button'; x.textContent = '×'; x.setAttribute('aria-label', 'Fechar');
    x.addEventListener('click', function () { esconderBalao(); ss('rico_recolhido', '1'); aplicarRecolhido(); });
    var m = el('button', 'rico-balao-m'); m.type = 'button'; m.textContent = 'Silenciar';
    m.addEventListener('click', function () { ls('rico_mudo', '1'); esconderBalao(); });
    balaoEl.appendChild(t); balaoEl.appendChild(x); balaoEl.appendChild(m);
    raiz.appendChild(balaoEl);
    balaoTimer = setTimeout(esconderBalao, 9000);
  }
  function agendarBalao() {
    if (ls('rico_mudo') === '1') return;
    var tipo = tipoPagina(), lista = (R.dicas && R.dicas[tipo]) || (R.dicas && R.dicas.default) || [];
    var escolhida = lista.length ? lista[Math.floor(Math.random() * lista.length)] : null;
    setTimeout(function () { if (escolhida) mostrarBalao(escolhida.b, { texto: escolhida.t, link: escolhida.l || null }); else mostrarBalao('Posso ajudar?'); }, 4000);
  }
  function aplicarRecolhido() { if (ss('rico_recolhido') === '1') raiz.classList.add('rico-recolhido'); else raiz.classList.remove('rico-recolhido'); }

  function montar() {
    raiz = el('div'); raiz.id = 'rico';
    fab = el('button', 'rico-fab'); fab.type = 'button'; fab.setAttribute('aria-label', 'Abrir o chat do Rico'); fab.setAttribute('aria-expanded', 'false');
    var img = el('img'); img.src = R.imgBolha; img.alt = ''; img.width = 64; img.height = 64; img.decoding = 'async'; fab.appendChild(img);
    var lb = el('span', 'rico-fab-label'); lb.textContent = 'Rico'; fab.appendChild(lb);
    painel = el('div', 'rico-panel'); painel.setAttribute('role', 'dialog'); painel.setAttribute('aria-modal', 'true'); painel.setAttribute('aria-label', 'Chat do Rico');
    var top = el('div', 'rico-top');
    var iP = el('img'); iP.src = R.imgPainel; iP.alt = ''; iP.width = 44; iP.height = 44; iP.loading = 'lazy';
    var nome = el('div', 'rico-nome'); nome.textContent = 'Rico'; var small = el('small'); small.textContent = 'Guia do Economizei! Rio Claro'; nome.appendChild(small);
    var h = el('button', 'rico-hide'); h.type = 'button'; h.textContent = '−'; h.setAttribute('aria-label', 'Recolher o Rico');
    var x = el('button', 'rico-x'); x.type = 'button'; x.textContent = '×'; x.setAttribute('aria-label', 'Fechar o chat');
    top.appendChild(iP); top.appendChild(nome); top.appendChild(h); top.appendChild(x);
    msgs = el('div', 'rico-msgs'); msgs.setAttribute('aria-live', 'polite'); msgs.setAttribute('aria-atomic', 'false');
    var form = el('form', 'rico-form');
    inp = el('input', 'rico-in'); inp.type = 'text'; inp.placeholder = 'Digite sua pergunta'; inp.setAttribute('aria-label', 'Sua pergunta'); inp.autocomplete = 'off'; inp.maxLength = 140; inp.setAttribute('inputmode', 'search'); inp.setAttribute('enterkeyhint', 'send');
    var btn = el('button', 'rico-send'); btn.type = 'submit'; btn.textContent = 'Enviar';
    form.appendChild(inp); form.appendChild(btn);
    painel.appendChild(top); painel.appendChild(msgs); painel.appendChild(form);
    raiz.appendChild(fab); raiz.appendChild(painel);
    document.body.appendChild(raiz);
    fab.addEventListener('click', function () {
      if (raiz.classList.contains('rico-recolhido')) { ss('rico_recolhido', null); aplicarRecolhido(); abrirPainel(); }
      else if (raiz.classList.contains('rico-open')) fecharPainel();
      else abrirPainel();
    });
    x.addEventListener('click', fecharPainel);
    h.addEventListener('click', function () { ss('rico_recolhido', '1'); fecharPainel(); aplicarRecolhido(); });
    raiz.addEventListener('keydown', function (e) { if (e.key === 'Escape' && raiz.classList.contains('rico-open')) fecharPainel(); });
    form.addEventListener('submit', function (e) { e.preventDefault(); enviar(inp.value); });
    aplicarRecolhido();
    agendarBalao();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar); else montar();
})();
