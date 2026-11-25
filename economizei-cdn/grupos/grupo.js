(function(){
'use strict';
const $=id=>document.getElementById(id);

/* ===== UTILIDADES (mesmos nomes de EconomizeiUtils: na externalização basta trocar por EconomizeiUtils.*) ===== */
const sanitize=s=>s?String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'):'';
function ensureHttps(url){if(!url)return'';const u=String(url).trim();return /^https?:\/\//i.test(u)?u:'https://'+u}
const gerarSlug=t=>(t||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
function parseCSV(texto){
  const linhas=[];let aspas=false,campo='',linha=[];
  for(let i=0;i<texto.length;i++){
    const c=texto[i],p=texto[i+1];
    if(c==='"'){if(!aspas)aspas=true;else if(p==='"'){campo+='"';i++}else aspas=false}
    else if(c===','&&!aspas){linha.push(campo);campo=''}
    else if((c==='\n'||c==='\r')&&!aspas){if(campo||linha.length){linha.push(campo);linhas.push(linha)}campo='';linha=[];if(c==='\r'&&p==='\n')i++}
    else campo+=c;
  }
  if(campo||linha.length){linhas.push(linha.concat(campo))}
  return linhas;
}
function criarCacheCSV(chave,ms){
  return{
    ler(vencido){try{const c=localStorage.getItem(chave),t=localStorage.getItem(chave+'_timestamp');if(!c||!t||(!vencido&&Date.now()-t>=ms))return null;return JSON.parse(c)}catch(e){try{localStorage.removeItem(chave);localStorage.removeItem(chave+'_timestamp')}catch(x){}return null}},
    salvar(linhas){try{localStorage.setItem(chave,JSON.stringify(linhas));localStorage.setItem(chave+'_timestamp',Date.now().toString())}catch(e){}}
  };
}
function criarGerenciadorFavoritos(chave){
  const todos=()=>{try{return JSON.parse(localStorage.getItem(chave))||[]}catch(e){return[]}};
  const salvar=l=>{try{localStorage.setItem(chave,JSON.stringify(l))}catch(e){}};
  return{getTodos:todos,tem:id=>todos().includes(id),toggle(id){const l=todos(),i=l.indexOf(id);if(i>-1)l.splice(i,1);else l.push(id);salvar(l);return l.includes(id)}};
}
const gerarURLQRCode=(base,slug)=>base+(base.includes('?')?'&':'?')+'qr='+encodeURIComponent(slug);
const gerarImagemQRCode=(url,t)=>{t=t||200;return'https://api.qrserver.com/v1/create-qr-code/?size='+t+'x'+t+'&data='+encodeURIComponent(url)};

/* ===== LOGIN (Economizei.Auth, do tema) + FIRESTORE (só avaliações) =====
   O login, o overlay, os handlers do app (onLoginSuccess/onLoginError) e o modal Minha conta vivem no tema.
   O tema carrega só Firebase app+auth; o Firestore é carregado aqui, depois do Auth, no app já iniciado. */
const AUTH=window.Economizei&&window.Economizei.Auth;
let db=null;
function carregarScript(src){return new Promise((ok,erro)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=()=>erro(new Error('Falha ao carregar '+src));document.head.appendChild(s)})}
const firestorePronto=(AUTH?AUTH.pronto:Promise.resolve()).then(()=>{
  if(typeof firebase==='undefined'||!firebase.apps||!firebase.apps.length)return;
  return carregarScript('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore-compat.js').then(()=>{
    firebase.firestore().settings({experimentalAutoDetectLongPolling:true,merge:true});
    db=firebase.firestore();
  });
}).catch(e=>console.error('Firestore indisponível:',e));
const esperar=(p,ms)=>Promise.race([p,new Promise(r=>setTimeout(r,ms))]);

/* ===== MODAIS (mesmo comportamento de Festas/Trilhas, com foco preso e devolvido) ===== */
let modalAtivo=null,focoAnterior=null;
const focaveis=el=>[...el.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(x=>!x.disabled&&x.offsetParent!==null);
function abrir(x){focoAnterior=document.activeElement;modalAtivo=typeof x==='string'?$(x):x;modalAtivo.style.display='flex';const f=focaveis(modalAtivo)[0];if(f)f.focus()}
function fechar(){if(!modalAtivo)return;modalAtivo.style.display='none';if(modalAtivo.dataset.dyn)modalAtivo.remove();modalAtivo=null;if(focoAnterior&&focoAnterior.focus)focoAnterior.focus();focoAnterior=null}
document.addEventListener('keydown',e=>{
  if(!modalAtivo)return;
  if(e.key==='Escape')fechar();
  else if(e.key==='Tab'){const f=focaveis(modalAtivo);if(!f.length)return;const a=f[0],z=f[f.length-1];if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus()}else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus()}}
});
document.addEventListener('click',e=>{if(!modalAtivo)return;const x=e.target.closest('[data-fechar]');if(e.target===modalAtivo||(x&&modalAtivo.contains(x)))fechar()});
function criarModal(html,label){
  const m=document.createElement('div');m.className='ev-mo';m.dataset.dyn='1';
  m.setAttribute('role','dialog');m.setAttribute('aria-modal','true');m.setAttribute('aria-label',label);
  m.innerHTML='<div class="ev-mc">'+html+'</div>';document.body.appendChild(m);abrir(m);return m;
}
function toast(msg){let t=$('evToast');if(!t){t=document.createElement('div');t.id='evToast';t.className='ev-toast';t.setAttribute('role','status');document.body.appendChild(t)}t.textContent=msg;t.classList.add('on');clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove('on'),3000)}
const cabecalhoModal=(titulo,icone)=>`<div class="ev-mh"><h3><i class="${icone}" aria-hidden="true"></i> ${sanitize(titulo)}</h3><button class="ev-x" data-fechar type="button" aria-label="Fechar">×</button></div>`;
function abrirModalMulti(titulo,itens,icone){
  if(!itens.length)return;
  criarModal(cabecalhoModal(titulo,icone)+'<div class="ev-lks">'+itens.map(it=>`<a class="ev-lk ${sanitize(it.classe||'')}" href="${sanitize(it.url)}" target="_blank" rel="noopener noreferrer" aria-label="Abrir ${sanitize(it.nome)}"><i class="${sanitize(it.icone||icone)}"${it.cor?` style="color:${sanitize(it.cor)}"`:''} aria-hidden="true"></i><span>${sanitize(it.nome)}${it.sublabel?`<small>${sanitize(it.sublabel)}</small>`:''}</span><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></a>`).join('')+'</div>',titulo);
}


/* ===== CONFIGURAÇÃO DA PÁGINA (window.GRUPO_CONFIG: o que muda de um grupo para outro) ===== */
const CFG=window.GRUPO_CONFIG||{};
const C=Object.assign({},CFG.colunas);if(C.ESTILO===undefined)C.ESTILO=31;
const FILTROS=CFG.filtros||[];
const BOTOES=CFG.botoes||[{tipo:'whatsapp'},{tipo:'maps'},{tipo:'qrcode'}];
const MODO_HORARIO=CFG.modoHorario||'7dias';
const PAGINA_CATEGORIAS='https://www.economizeirioclaro.com.br/p/categorias.html';
const PAGINA_CADASTRO='https://www.economizeirioclaro.com.br/p/cadastro.html';
const MAX_BOTOES_FILTRO=4;
const cache=criarCacheCSV(CFG.cacheKey||'economizeiCacheGrupo',3600000);
const gerFav=criarGerenciadorFavoritos(CFG.favoritosKey||'economizeiFavoritosGrupo');
const ICONES={'btn-whatsapp':'fa-brands fa-whatsapp','btn-mapa':'fa-solid fa-location-dot','btn-cardapio':'fa-solid fa-book-open','btn-encarte':'fa-solid fa-file-lines','btn-catalogo':'fa-solid fa-box','btn-portfolio':'fa-solid fa-folder-open','btn-site':'fa-solid fa-globe','btn-site-pedido':'fa-solid fa-cart-shopping','btn-facebook':'fa-brands fa-facebook','btn-instagram':'fa-brands fa-instagram','btn-pinterest':'fa-brands fa-pinterest','btn-promocao':'fa-solid fa-fire','btn-reserva':'fa-solid fa-calendar-check','btn-compartilhar':'fa-solid fa-share-nodes'};
const icone=classe=>ICONES[classe]?`<i class="${ICONES[classe]}" aria-hidden="true"></i>`:'';

/* ===== ESTADO ===== */
let currentUser=null,userDisplayName='';
let dados=[],cards=[],visiveis=[],meta=[];
let estatisticasGlobais={},notasUsuario={};
const filtrosAtivos=new Map();
let categoriaGlobal=null,estabelecimentoViaQR=null;
let pertoMimAtivo=false,usuarioPosicao=null,ordenarPorMedia=false;
const POR_PAGINA=20;let pagina=1,vigia=null;

/* ===== AVALIAÇÕES (Firestore, coleção "avaliacoes"; sem Firestore a página abre normalmente, só sem notas) ===== */
async function getEstatisticasAvaliacoes() {
  if (!db) return {};
  try {
    const snap = await db.collection('avaliacoes').get();
    const stats = {};
    snap.forEach(doc => {
      const d = doc.data();
      if (!stats[d.estabelecimentoId]) stats[d.estabelecimentoId] = { soma: 0, total: 0 };
      stats[d.estabelecimentoId].soma += d.pontuacao;
      stats[d.estabelecimentoId].total += 1;
    });
    const r = {};
    for (const [id, v] of Object.entries(stats)) r[id] = { media: v.soma / v.total, total: v.total };
    return r;
  } catch (e) { console.error('Erro ao buscar estatísticas:', e); return {}; }
}
async function getAvaliacoesUsuario() {
  if (!currentUser || !db) return {};
  try {
    const snap = await db.collection('avaliacoes').where('userId', '==', currentUser.uid).get();
    const map = {};
    snap.forEach(doc => { map[doc.data().estabelecimentoId] = doc.data().pontuacao; });
    return map;
  } catch (e) { console.error('Erro ao buscar avaliações do usuário:', e); return {}; }
}
async function salvarAvaliacaoFirebase(id, pontuacao) {
  if (!currentUser) throw new Error('Faça login para avaliar.');
  if (!db) throw new Error('Avaliações indisponíveis no momento.');
  await db.collection('avaliacoes').doc(`${currentUser.uid}_${id}`).set({
    userId: currentUser.uid, estabelecimentoId: id, pontuacao,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
}
function definirUsuario(user) {
  currentUser = user || null;
  userDisplayName = user ? (user.displayName || user.email?.split('@')[0] || 'Usuário') : '';
}

/* ===== HELPERS DE DADOS ===== */
const splitValores=v=>v?v.split(',').map(x=>x.trim()).filter(Boolean):[];
const atende=(celula,valor)=>splitValores(celula).includes(valor);
function linkSeguro(url){if(!url)return'#';try{const u=new URL(url,location.href);if(u.protocol==='http:'||u.protocol==='https:')return u.href}catch(e){}return'#'}
function formatarTelefone(n){if(!n)return'';let d=n.replace(/\D/g,'');if(d.startsWith('55'))d=d.slice(2);return d.length>=10?`(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7,11)}`:n}
function sanitizarWhatsapp(n){let d=(n||'').replace(/\D/g,'');if(!d)return'';return d.startsWith('55')?d:'55'+d}
function listaNomeValor(valor){
  if(!valor)return[];
  return valor.split(/[,\n;]+/).map(s=>s.trim()).filter(Boolean).map(p=>{
    if(!p.includes('|'))return{nome:'',valor:p};
    const[nome,...resto]=p.split('|');return{nome:nome.trim(),valor:resto.join('|').trim()};
  }).filter(it=>it.valor);
}
function distanciaKm(lat1,lon1,lat2,lon2){
  const R=6371,dLat=(lat2-lat1)*Math.PI/180,dLon=(lon2-lon1)*Math.PI/180;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
const formatarDistancia=km=>km<1?Math.round(km*1000)+' m':km.toFixed(1)+' km';
function parseData(s){
  if(!s)return null;
  if(s.includes('/')){const p=s.split('/');return p.length===3?new Date(+p[2],+p[1]-1,+p[0]):null}
  if(s.includes('-')){const d=new Date(s+'T00:00:00');return isNaN(d)?null:d}
  return null;
}
const dataVerificacao=c=>parseData(c[C.DATA_VERIFICACAO]);
function estaVerificado(c){
  const d=dataVerificacao(c);
  return !!(c[C.VERIFICADO]&&c[C.VERIFICADO].toLowerCase()==='sim'&&d&&(new Date()-d)<365*24*60*60*1000);
}
const urlQR=nome=>gerarURLQRCode(CFG.urlBaseQR||PAGINA_CATEGORIAS,gerarSlug(nome));
const imagemQR=nome=>gerarImagemQRCode(urlQR(nome),200);

/* ===== HORÁRIO (modos "7dias" e "3blocos") ===== */
const horarioFechado=v=>{if(!v)return true;const s=String(v).trim().toLowerCase();return s===''||s==='não'||s==='nao'};
function horarioDoDia(est,dia){
  const col=MODO_HORARIO==='3blocos'
    ?(dia===0?C.HORARIO_DOM:dia===6?C.HORARIO_SAB:C.HORARIO_SEG_SEX)
    :[C.HORARIO_DOM,C.HORARIO_SEG,C.HORARIO_TER,C.HORARIO_QUA,C.HORARIO_QUI,C.HORARIO_SEX,C.HORARIO_SAB][dia];
  return horarioFechado(est[col])?null:est[col].trim();
}
function horarioDeHoje(est){
  const esp=horarioDoDia(est,new Date().getDay());
  if(esp!==null)return esp;
  if(MODO_HORARIO==='3blocos'&&[C.HORARIO_SEG_SEX,C.HORARIO_SAB,C.HORARIO_DOM].some(col=>!horarioFechado(est[col])))return null;
  return horarioFechado(est[C.HORARIO])?null:est[C.HORARIO].trim();
}
function horarioParaExibir(est){
  if(MODO_HORARIO==='3blocos'){
    const partes=[['Segunda a Sexta',C.HORARIO_SEG_SEX],['Sábado',C.HORARIO_SAB],['Domingo',C.HORARIO_DOM]].filter(([,col])=>!horarioFechado(est[col])).map(([rot,col])=>rot+': '+est[col].trim());
    if(partes.length)return partes.join(' | ');
  }else{
    const nomes=['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
    const hrs=nomes.map((n,i)=>{const h=horarioDoDia(est,i);return h?n+': '+h:null}).filter(Boolean);
    if(hrs.length)return hrs.join(' | ');
  }
  return horarioFechado(est[C.HORARIO])?'Horário não informado':est[C.HORARIO].trim();
}
function analisarHorario(hr){
  if(!hr)return null;
  const h=hr.trim().toLowerCase();
  if(['marcado','agendamento','consultar','combinar','agendar'].some(p=>h.includes(p)))return{marcado:true};
  if(h==='24h'||h==='0h-24h'||h==='0:00-24:00')return{h24:true,aberto:true};
  const agora=new Date(),agoraMin=agora.getHours()*60+agora.getMinutes();
  for(const turno of hr.split('/').map(t=>t.trim())){
    const m=turno.match(/(\d{1,2})(?:h|:)?(\d{0,2})\s*-\s*(\d{1,2})(?:h|:)?(\d{0,2})/);
    if(!m)continue;
    const ini=parseInt(m[1],10)*60+(m[2]?parseInt(m[2],10):0);
    const fimH=parseInt(m[3],10),fimM=m[4]?parseInt(m[4],10):0;
    let fim=fimH*60+fimM;if(fimH===0&&fimM===0)fim=24*60;
    let aberto=false,resta=Infinity;
    if(ini<=fim){if(agoraMin>=ini&&agoraMin<=fim){aberto=true;resta=fim-agoraMin}}
    else if(agoraMin>=ini||agoraMin<=fim){aberto=true;resta=agoraMin>=ini?(24*60-agoraMin)+fim:fim-agoraMin}
    if(aberto)return{aberto:true,breve:resta<=60&&resta>0,fechamento:String(fimH).padStart(2,'0')+':'+String(fimM).padStart(2,'0')};
  }
  return{aberto:false};
}
function statusHorario(hr){
  const r=analisarHorario(hr);
  if(!r||r.aberto===false)return{classe:'status-fechado',texto:'Fechado'};
  if(r.marcado)return{classe:'status-marcado',texto:'Atendimento agendado'};
  if(r.h24)return{classe:'status-24h',texto:'24 horas'};
  if(r.breve)return{classe:'status-breve',texto:'Fecha em breve ('+r.fechamento+')'};
  return{classe:'status-aberto',texto:'Aberto agora'};
}

/* ===== MÓDULOS: PONTO DE ENCAIXE (a atualizar no pente fino dos módulos) =====
   Os módulos se penduram em window.Economizei.Cards:
   - registrarModulo(estilo, {label, ariaLabel, icone, abrir(idx)}) → botão na seção "Economizei Módulos" dos cards cujo ESTILO é igual a "estilo".
   - registrarBadge(estilo, {label, desc, icone}) → selo no card (com tooltip) para o mesmo estilo.
   - getCardByIndex(idx), dadosProcessados (somente leitura), colunas e dadosProntos (Promise resolvida após a primeira renderização).
   O card expõe em dataset: nome, categoria, subcategoria, distrito, idUnico, slug, latitude, longitude, index, verificado e estilo.
   Mudanças em relação ao motor anterior (módulos precisam ser ajustados): onClick(idx) que devolvia texto de onclick virou abrir(idx);
   Core/UI/Horario.COLUNAS deixaram de ser globais (use Economizei.Cards.colunas). */
const modulosRegistrados={},badgesRegistrados={};
let resolverDados;const dadosProntos=new Promise(r=>{resolverDados=r});
const chaveEstilo=e=>String(e||'').toLowerCase().trim();
function botaoModulo(estilo,idx){
  const def=modulosRegistrados[estilo];if(!def)return'';
  return `<button type="button" class="btn-acao btn-modulo" data-acao="modulo" data-modulo="${sanitize(estilo)}" data-index="${idx}" aria-label="${sanitize(def.ariaLabel||def.label||'Abrir')}">${def.icone?`<i class="${sanitize(def.icone)}" aria-hidden="true"></i> `:''}${sanitize(def.label||'Abrir')}</button>`;
}
const moduloVazio='<div class="modulo-vazio">Este cadastro ainda não possui módulo ativo</div>';
function registrarModulo(estilo,def){
  const chave=chaveEstilo(estilo);
  if(!chave||!def||typeof def.abrir!=='function'){console.error('[registrarModulo] inválido:',estilo,def);return}
  modulosRegistrados[chave]=def;
  cards.forEach((it,idx)=>{if(meta[idx].estilo===chave)it.wrapper.querySelector('.modulo-section').innerHTML=botaoModulo(chave,idx)});
}
function registrarBadge(estilo,def){
  const chave=chaveEstilo(estilo);
  if(!chave||!def||!def.label){console.error('[registrarBadge] inválido:',estilo,def);return}
  badgesRegistrados[chave]=def;
  atualizarBadges();
}
function atualizarBadges(){
  cards.forEach((it,idx)=>{
    const def=badgesRegistrados[meta[idx].estilo],slot=it.wrapper.querySelector('.badge-modulo-slot');
    slot.innerHTML=def?`<button type="button" class="badge-modulo-card" data-acao="badge" data-modulo="${sanitize(meta[idx].estilo)}" aria-label="${sanitize(def.label)}. Clique para saber mais."><i class="${sanitize(def.icone||'fa-solid fa-cube')}" aria-hidden="true"></i><span>${sanitize(def.label)}</span></button>`:'';
  });
}

/* ===== CARDS ===== */
function dadosDoCard(c){
  const whats=listaNomeValor(c[C.WHATSAPP]).map(it=>({nome:it.nome,numero:sanitizarWhatsapp(it.valor)})).filter(it=>it.numero);
  const reservas=C.RESERVA!==undefined&&c[C.RESERVA]?c[C.RESERVA].split(',').map(s=>s.trim()).filter(Boolean).map(item=>{
    if(item.includes('|')){const[n,...r]=item.split('|');return{nome:n.trim(),url:r.join('|').trim()}}
    let n=item;try{n=new URL(item).hostname.replace(/^www\./,'')}catch(e){}
    return{nome:n,url:item};
  }):[];
  return{whats,reservas,estilo:chaveEstilo(c[C.ESTILO]),itens:{}};
}
function montarAcoes(c,idx,m,nome){
  const html=[];let compartilhar='';
  BOTOES.forEach(b=>{
    if(b.tipo==='whatsapp'){
      if(m.whats.length===1)html.push(`<a href="https://wa.me/${m.whats[0].numero}" target="_blank" rel="noopener noreferrer" class="btn-acao btn-whatsapp" aria-label="WhatsApp ${sanitize(m.whats[0].nome||formatarTelefone(m.whats[0].numero))}">${icone('btn-whatsapp')} WhatsApp</a>`);
      else if(m.whats.length>1)html.push(`<button type="button" class="btn-acao btn-whatsapp" data-acao="whatsapp" data-index="${idx}">${icone('btn-whatsapp')} WhatsApp</button>`);
    }else if(b.tipo==='maps'){
      if(c[C.MAPS])html.push(`<a href="${sanitize(linkSeguro(c[C.MAPS]))}" target="_blank" rel="noopener noreferrer" class="btn-acao btn-mapa">${icone('btn-mapa')} ${sanitize(b.rotulo||'Localização')}</a>`);
    }else if(b.tipo==='qrcode'){
      compartilhar=`<button type="button" class="btn-acao btn-compartilhar" data-acao="compartilhar" data-index="${idx}" aria-label="Compartilhar ${sanitize(nome)}">${icone('btn-compartilhar')} Compartilhar</button>`;
    }else if(b.tipo==='reserva'){
      if(m.reservas.length)html.push(`<button type="button" class="btn-acao btn-reserva" data-acao="reserva" data-index="${idx}">${icone('btn-reserva')} Reservas</button>`);
    }else if(b.tipo==='link'||b.tipo==='multis'){
      const itens=listaNomeValor(c[b.coluna]).map(it=>({nome:it.nome||'Abrir',url:it.valor}));
      if(!itens.length)return;
      const classe=b.classe||'btn-link-'+b.coluna,idBtn=b.id||classe,rotulo=b.rotulo||'Abrir';
      if(itens.length===1)html.push(`<a href="${sanitize(linkSeguro(ensureHttps(itens[0].url)))}" target="_blank" rel="noopener noreferrer" class="btn-acao ${sanitize(classe)}">${icone(classe)} ${sanitize(rotulo)}</a>`);
      else{m.itens[idBtn]={rotulo,classe,itens};html.push(`<button type="button" class="btn-acao ${sanitize(classe)}" data-acao="itens" data-index="${idx}" data-botao="${sanitize(idBtn)}">${icone(classe)} ${sanitize(rotulo)}</button>`)}
    }
  });
  return html.join('')+compartilhar;
}
const estrelasTexto=media=>Array.from({length:5},(_,i)=>i<Math.round(media)?'★':'☆').join('');
const textoVotos=t=>t+' '+(t===1?'voto':'votos');
function htmlLogin(){
  return currentUser
    ?`<div class="ev-login">Logado como <strong>${sanitize((userDisplayName||'').split(' ')[0])}</strong> · <a href="#" class="link-sair">Sair</a></div>`
    :'<div class="ev-login"><button type="button" class="ev-b link-entrar">Entrar com Google</button><span>para avaliar os estabelecimentos</span></div>';
}
function htmlEstrelasUsuario(idx,nota){
  return Array.from({length:5},(_,i)=>`<button type="button" class="estrela-btn${i<nota?' ativa':''}" data-rating="${i+1}" data-index="${idx}" role="radio" aria-checked="${i<nota}" aria-label="${i+1} estrela${i?'s':''}">★</button>`).join('');
}
const textoNota=n=>n?`Sua nota: ${n} estrela${n>1?'s':''}`:'';
function renderizarCards(){
  const favs=gerFav.getTodos();
  meta=[];
  cards=dados.map((c,idx)=>{
    const nome=c[C.NOME]||'',categoria=c[C.CATEGORIA]||'',subcategoria=c[C.SUBCATEGORIA]||'',distrito=c[C.DISTRITO]||'';
    const imagem=ensureHttps(c[C.IMAGEM])||CFG.imagemFallback||'';
    const status=statusHorario(horarioDeHoje(c)),verificado=estaVerificado(c),isFav=favs.includes(nome);
    const stats=estatisticasGlobais[nome]||{media:0,total:0},mediaF=stats.media>0?stats.media.toFixed(1):'0.0';
    const m=dadosDoCard(c);meta.push(m);
    let distancia='';
    if(pertoMimAtivo&&usuarioPosicao){
      const lat=parseFloat(c[C.LATITUDE]),lng=parseFloat(c[C.LONGITUDE]);
      if(!isNaN(lat)&&!isNaN(lng))distancia=`<div class="card-distancia"><i class="fa-solid fa-location-dot" aria-hidden="true"></i> ${formatarDistancia(distanciaKm(usuarioPosicao.lat,usuarioPosicao.lng,lat,lng))}</div>`;
    }
    let dataVerif='';if(verificado){const d=dataVerificacao(c);if(d)dataVerif=d.toLocaleDateString('pt-BR')}
    const detalhes=(CFG.camposDetalhe||[]).map(campo=>{
      const val=campo.especial==='horario'?horarioParaExibir(c):c[campo.coluna];
      return val&&String(val).trim()?`<div class="detalhe-item"><strong>${sanitize(campo.rotulo)}</strong> ${sanitize(String(val))}</div>`:'';
    }).join('');
    const wrapper=document.createElement('div');wrapper.className='card-wrapper';wrapper.dataset.index=idx;
    wrapper.innerHTML=`<div class="card${isFav?' card-favorito':''}" role="button" tabindex="0" aria-expanded="false" aria-label="${sanitize(nome)}${verificado?', verificado':''}${isFav?', favorito':''}, ${status.texto}"
        data-nome="${sanitize(nome)}" data-categoria="${sanitize(categoria)}" data-subcategoria="${sanitize(subcategoria)}" data-distrito="${sanitize(distrito)}" data-id-unico="${sanitize(c[C.ID_UNICO]||'')}" data-slug="${sanitize(c[C.SLUG]||'')}" data-latitude="${sanitize(c[C.LATITUDE]||'')}" data-longitude="${sanitize(c[C.LONGITUDE]||'')}" data-index="${idx}" data-verificado="${verificado}" data-estilo="${sanitize(m.estilo)}">
      <div class="card-img-container"><img class="card-img" src="${sanitize(imagem)}" alt="${sanitize(nome)}" loading="${idx<8?'eager':'lazy'}" decoding="async"></div>
      <div class="card-status ${status.classe}">${status.texto}</div>
      <button type="button" class="btn-favorito${isFav?' ativo':''}" aria-pressed="${isFav}" aria-label="${isFav?'Remover':'Adicionar'} ${sanitize(nome)} ${isFav?'dos':'aos'} favoritos"><i class="${isFav?'fa-solid':'fa-regular'} fa-heart" aria-hidden="true"></i></button>
      <div class="card-content">
        ${verificado?`<div class="badge-verificado-container"><span class="badge-tooltip" data-tooltip="Verificado em ${sanitize(dataVerif)}" tabindex="0"><i class="fa-solid fa-circle-check" aria-hidden="true"></i> Verificado</span></div>`:''}
        <div class="badge-modulo-slot"></div>
        <h3 class="card-title">${sanitize(nome)}</h3>
        <div class="card-categoria-container">${categoria?`<span class="card-categoria">${sanitize(categoria)}</span>`:''}${categoria&&subcategoria?'<span class="card-categoria-separador">|</span>':''}${subcategoria?`<span class="card-subcategoria">${sanitize(subcategoria)}</span>`:''}</div>
        ${distrito?`<div class="card-distrito">${sanitize(distrito)}</div>`:''}
        ${distancia}
        <div class="card-avaliacao-header"><div class="estrelas-header" aria-hidden="true">${estrelasTexto(stats.media)}</div><div class="nota-header">${mediaF} (${textoVotos(stats.total||0)})</div></div>
        <button type="button" class="card-toggle">Ver detalhes</button>
      </div></div>
      <div class="card-expanded-container" role="region" aria-label="Detalhes de ${sanitize(nome)}">
        <button type="button" class="btn-recolher" aria-label="Recolher detalhes" title="Recolher"><i class="fa-solid fa-minus" aria-hidden="true"></i></button>
        <div class="detalhes-grid">${detalhes}</div>
        <div class="avaliacao-section">
          <div class="avaliacao-conteudo">
            <div class="avaliacao-texto-instrucao"><div class="avaliacao-titulo"><span><i class="fa-solid fa-star" aria-hidden="true"></i> Avalie este estabelecimento</span><span class="avaliacao-separador">•</span><span class="avaliacao-instrucao">Clique nas estrelas para avaliar</span></div></div>
            <div class="avaliacao-login">${htmlLogin()}</div>
          </div>
          <div class="avaliacao-estrelas" role="radiogroup" aria-label="Avaliar ${sanitize(nome)}">${htmlEstrelasUsuario(idx,notasUsuario[nome]||0)}</div>
          <div class="avaliacao-resultado">${textoNota(notasUsuario[nome]||0)}</div>
        </div>
        <div class="secao-titulo">Economizei Módulos</div>
        <div class="modulo-section">${m.estilo&&modulosRegistrados[m.estilo]?botaoModulo(m.estilo,idx):moduloVazio}</div>
        <div class="card-acoes">${montarAcoes(c,idx,m,nome)}</div>
      </div>`;
    const im=wrapper.querySelector('.card-img');
    im.addEventListener('load',()=>im.classList.add('loaded'));
    im.addEventListener('error',()=>{im.classList.add('error');if(CFG.imagemFallback&&im.src!==CFG.imagemFallback)im.src=CFG.imagemFallback});
    if(im.complete&&im.naturalWidth)im.classList.add('loaded');
    return{wrapper,card:wrapper.querySelector('.card'),expanded:wrapper.querySelector('.card-expanded-container')};
  });
  atualizarBadges();
  if(resolverDados){resolverDados();resolverDados=null}
}
function alternar(card){
  const w=card.closest('.card-wrapper'),ex=w.querySelector('.card-expanded-container'),btn=card.querySelector('.card-toggle'),ativo=ex.classList.contains('active');
  document.querySelectorAll('.card-expanded-container.active').forEach(c=>{
    if(c===ex)return;c.classList.remove('active');
    const o=c.closest('.card-wrapper');o.querySelector('.card-toggle').textContent='Ver detalhes';o.querySelector('.card').setAttribute('aria-expanded','false');
  });
  ex.classList.toggle('active',!ativo);card.setAttribute('aria-expanded',String(!ativo));btn.textContent=ativo?'Ver detalhes':'Ocultar detalhes';
  if(!ativo)setTimeout(()=>ex.scrollIntoView({behavior:'smooth',block:'nearest'}),50);
}
const getCardByIndex=idx=>cards[idx]?cards[idx].card:null;

/* ===== LOGIN E NOTAS (atualização no lugar, sem recarregar a página) ===== */
function atualizarLoginNosCards(){
  cards.forEach((it,idx)=>{
    const nome=dados[idx][C.NOME],nota=notasUsuario[nome]||0;
    it.wrapper.querySelector('.avaliacao-login').innerHTML=htmlLogin();
    it.wrapper.querySelector('.avaliacao-estrelas').innerHTML=htmlEstrelasUsuario(idx,nota);
    it.wrapper.querySelector('.avaliacao-resultado').textContent=textoNota(nota);
  });
}
async function sincronizarUsuario(user){
  definirUsuario(user);
  notasUsuario=user?await getAvaliacoesUsuario():{};
  atualizarLoginNosCards();
}
function aplicarNotaNoCard(idx,nota){
  const it=cards[idx];if(!it)return;
  it.expanded.querySelectorAll('.estrela-btn').forEach((s,i)=>{s.classList.toggle('ativa',i<nota);s.setAttribute('aria-checked',String(i<nota))});
  it.expanded.querySelector('.avaliacao-resultado').textContent=textoNota(nota);
}
async function salvarNota(idx,nome,nota){
  const anterior=notasUsuario[nome]||0;
  try{
    await salvarAvaliacaoFirebase(nome,nota);
    const st=estatisticasGlobais[nome]||{media:0,total:0};
    let soma=st.media*st.total;
    if(anterior>0)soma=soma-anterior+nota;else{soma+=nota;st.total+=1}
    st.media=st.total>0?soma/st.total:0;estatisticasGlobais[nome]=st;notasUsuario[nome]=nota;
    const card=cards[idx].card;
    card.querySelector('.estrelas-header').textContent=estrelasTexto(st.media);
    card.querySelector('.nota-header').textContent=`${st.media>0?st.media.toFixed(1):'0.0'} (${textoVotos(st.total)})`;
    toast('Avaliação salva. Obrigado!');
  }catch(e){aplicarNotaNoCard(idx,anterior);toast('Erro ao salvar avaliação: '+e.message)}
}
function avaliar(btn){
  const idx=parseInt(btn.dataset.index,10),nota=parseInt(btn.dataset.rating,10),nome=dados[idx][C.NOME];
  if(!currentUser){executarLogin({idx,nome,rating:nota});return}
  aplicarNotaNoCard(idx,nota);salvarNota(idx,nome,nota);
}
function executarLogin(pendente){
  if(!AUTH){toast('Login indisponível no momento.');return}
  AUTH.entrar(pendente?{rating:pendente.rating,nome:pendente.nome}:{})
    .then(async user=>{
      await sincronizarUsuario(user);
      if(pendente){aplicarNotaNoCard(pendente.idx,pendente.rating);salvarNota(pendente.idx,pendente.nome,pendente.rating);toast('Login realizado! Salvando sua avaliação...')}
      else toast('Login realizado com sucesso!');
    })
    .catch(e=>{const m=AUTH.mensagemErro(e);if(m)toast(m)});
}
function sair(){
  if(!AUTH)return;
  AUTH.sair().then(()=>toast('Você saiu da sua conta.'),e=>toast('Erro ao sair: '+e.message));
}

/* ===== MODAIS DE LISTA E QR ===== */
function abrirQRCode(event,nome,qrCodeURL,urlQRCode){
  const m=criarModal(cabecalhoModal('QR Code','fa-solid fa-qrcode')+`<div class="ev-qr"><img src="${sanitize(qrCodeURL)}" alt="QR Code para ${sanitize(nome)}" decoding="async" width="220" height="220"><strong>${sanitize(nome)}</strong><div class="ev-mb"><button class="ev-b" data-acao-qr="compartilhar" type="button"><i class="fa-solid fa-share-nodes" aria-hidden="true"></i> Compartilhar</button><button class="ev-b pri" data-acao-qr="copiar" type="button"><i class="fa-solid fa-copy" aria-hidden="true"></i> Copiar</button></div></div>`,'QR Code de '+nome);
  m.addEventListener('click',e=>{
    const b=e.target.closest('[data-acao-qr]');if(!b)return;
    if(b.dataset.acaoQr==='compartilhar'){if(navigator.share)navigator.share({title:nome,url:urlQRCode}).catch(()=>{});else toast('Compartilhamento não suportado')}
    else navigator.clipboard.writeText(urlQRCode).then(()=>toast('URL copiada!')).catch(()=>prompt('Copie o link:',urlQRCode));
  });
}
function abrirListaWhatsapp(idx){
  abrirModalMulti('WhatsApp',meta[idx].whats.map(w=>({nome:w.nome||'WhatsApp',sublabel:formatarTelefone(w.numero),url:'https://wa.me/'+w.numero,classe:'item-whatsapp',icone:'fa-brands fa-whatsapp'})),'fa-brands fa-whatsapp');
}
function abrirListaReservas(idx){
  abrirModalMulti('Opções de Reserva',meta[idx].reservas.map(r=>{let host='';try{host=new URL(r.url).hostname.replace(/^www\./,'')}catch(e){}return{nome:r.nome,sublabel:host,url:r.url}}),'fa-solid fa-calendar-check');
}
function abrirListaItens(idx,idBotao){
  const b=meta[idx].itens[idBotao];if(!b)return;
  abrirModalMulti(b.rotulo,b.itens.map(it=>({nome:it.nome,url:ensureHttps(it.url)})),ICONES[b.classe]||'fa-solid fa-list');
}

/* ===== FILTROS, ORDEM E PAGINAÇÃO ===== */
const categoriaDe=c=>c[C.CATEGORIA];
const baseDeOpcoes=()=>categoriaGlobal?dados.filter(c=>categoriaDe(c)===categoriaGlobal):dados;
const opcoesDoFiltro=f=>[...new Set(baseDeOpcoes().flatMap(c=>splitValores(c[f.coluna])))].sort();
const filtrosComValores=()=>FILTROS.filter(f=>baseDeOpcoes().some(c=>splitValores(c[f.coluna]).length));
function montarControlesFiltro(){
  const vis=filtrosComValores(),cont=$('evFiltros');
  cont.innerHTML=vis.length>MAX_BOTOES_FILTRO
    ?'<button class="ev-b" data-filtros="todos" type="button">Filtros</button>'
    :vis.map(f=>`<button class="ev-b" data-filtros="${sanitize(f.id)}" type="button">${sanitize(f.nome)}</button>`).join('');
  atualizarMarcasFiltro();
}
function atualizarMarcasFiltro(){
  const todos=filtrosComValores();
  document.querySelectorAll('#evFiltros [data-filtros]').forEach(b=>{
    const ids=b.dataset.filtros==='todos'?todos.map(f=>f.id):[b.dataset.filtros];
    b.classList.toggle('sel',ids.some(id=>filtrosAtivos.has(id)));
  });
}
function abrirModalFiltros(qual){
  const lista=qual==='todos'?filtrosComValores():filtrosComValores().filter(f=>f.id===qual);
  const secoes=lista.map(f=>`<strong>${sanitize(f.nome)}</strong><div class="ev-mb" data-filtro="${sanitize(f.id)}">${['',...opcoesDoFiltro(f)].map(o=>`<button class="ev-b${(filtrosAtivos.get(f.id)||'')===o?' sel':''}" data-val="${sanitize(o)}" type="button">${o?sanitize(o):'Qualquer'}</button>`).join('')}</div>`).join('');
  const m=criarModal(`<h3>Filtrar por</h3>${secoes}<button class="ev-b pri" data-aplicar type="button">Aplicar e fechar</button>`,'Filtrar por');
  m.addEventListener('click',e=>{
    const b=e.target.closest('.ev-mb .ev-b');
    if(b){b.parentElement.querySelectorAll('.ev-b').forEach(x=>x.classList.remove('sel'));b.classList.add('sel');return}
    if(!e.target.closest('[data-aplicar]'))return;
    m.querySelectorAll('.ev-mb').forEach(box=>{const s=box.querySelector('.sel');if(s&&s.dataset.val)filtrosAtivos.set(box.dataset.filtro,s.dataset.val);else filtrosAtivos.delete(box.dataset.filtro)});
    aplicarFiltros();fechar();
  });
}
function aplicarFiltros(){
  if(!dados.length||!cards.length)return;
  const busca=$('busca').value.toLowerCase().trim();
  let ids=[];
  dados.forEach((c,idx)=>{
    if(estabelecimentoViaQR){if(c[C.NOME]===estabelecimentoViaQR[C.NOME])ids.push(idx);return}
    if(busca&&!c[C.NOME].toLowerCase().includes(busca))return;
    if(categoriaGlobal&&categoriaDe(c)!==categoriaGlobal)return;
    for(const[id,valor]of filtrosAtivos){const f=FILTROS.find(x=>x.id===id);if(f&&!atende(c[f.coluna]||'',valor))return}
    ids.push(idx);
  });
  if(ordenarPorMedia){
    const media=i=>(estatisticasGlobais[dados[i][C.NOME]]||{}).media||0;
    ids.sort((a,b)=>media(b)-media(a));
  }else{
    const favs=gerFav.getTodos(),ehFav=i=>favs.includes(dados[i][C.NOME]);
    const porData=(a,b)=>{const da=dataVerificacao(dados[a]),db_=dataVerificacao(dados[b]);return !da&&!db_?0:!da?1:!db_?-1:da-db_};
    const ver=ids.filter(i=>estaVerificado(dados[i])).sort(porData),nao=ids.filter(i=>!estaVerificado(dados[i]));
    const grupos=[ver.filter(ehFav),ver.filter(i=>!ehFav(i)),nao.filter(ehFav),nao.filter(i=>!ehFav(i))];
    const porDistancia=l=>l.map(i=>{const lat=parseFloat(dados[i][C.LATITUDE]),lng=parseFloat(dados[i][C.LONGITUDE]);return{i,d:isNaN(lat)||isNaN(lng)?Infinity:distanciaKm(usuarioPosicao.lat,usuarioPosicao.lng,lat,lng)}}).sort((a,b)=>a.d-b.d).map(x=>x.i);
    ids=[].concat(...grupos.map(g=>pertoMimAtivo&&usuarioPosicao?porDistancia(g):g));
  }
  visiveis=ids;pagina=1;
  $('btnMelhoresAvaliados').classList.toggle('sel',ordenarPorMedia);$('btnMelhoresAvaliados').setAttribute('aria-pressed',String(ordenarPorMedia));
  $('btnPertoMim').classList.toggle('sel',pertoMimAtivo);
  $('filtros-ativos').innerHTML=[...filtrosAtivos].map(([id,v])=>{const f=FILTROS.find(x=>x.id===id);return f?`<span>${sanitize(f.nome)}: ${sanitize(v)}</span>`:''}).join('');
  atualizarMarcasFiltro();
  renderizarPagina();
}
function semResultados(){
  const temCat=!!categoriaGlobal||new URLSearchParams(location.search).has('cat');
  const semFiltros=$('busca').value.trim()===''&&!filtrosAtivos.size;
  const icone=CFG.iconeSemResultados||'';
  if(temCat&&semFiltros)return `<div class="ev-semres"><h3>${icone?sanitize(icone)+' ':''}Ainda não há estabelecimentos cadastrados nesta categoria</h3><p>Se você tem um negócio nesta área em Rio Claro, seja o primeiro a aparecer aqui!</p><div class="ev-mb" style="justify-content:center"><a class="ev-b ouro" href="${sanitize(PAGINA_CADASTRO)}" target="_blank" rel="noopener noreferrer">Cadastrar meu estabelecimento</a><a class="ev-b" href="${sanitize(PAGINA_CATEGORIAS)}">← Voltar para categorias</a></div></div>`;
  return `<div class="ev-semres"><h3>Nenhum estabelecimento encontrado</h3><p>Tente alterar os filtros de busca.</p>${temCat?`<a class="ev-b pri" href="${sanitize(PAGINA_CATEGORIAS)}">← Voltar para categorias</a>`:'<button class="ev-b pri" data-acao="limpar" type="button">Limpar filtros</button>'}</div>`;
}
function renderizarPagina(){
  const lista=$('lista');
  if(vigia){vigia.disconnect();vigia=null}
  lista.innerHTML='';
  if(!visiveis.length){lista.innerHTML=semResultados();return}
  const fim=pagina*POR_PAGINA;
  visiveis.slice(0,fim).forEach(i=>lista.appendChild(cards[i].wrapper));
  if(fim<visiveis.length){
    const esp=document.createElement('div');esp.style.cssText='height:10px;grid-column:1/-1';esp.setAttribute('aria-hidden','true');lista.appendChild(esp);
    vigia=new IntersectionObserver(en=>{if(en[0].isIntersecting){pagina++;renderizarPagina()}});vigia.observe(esp);
  }
}
function limparUrlQR(){const url=new URL(location);url.searchParams.delete('qr');history.replaceState({},'',url)}
function limparTudo(){
  filtrosAtivos.clear();categoriaGlobal=null;estabelecimentoViaQR=null;ordenarPorMedia=false;
  $('indicadorCategoriaContainer').innerHTML='';$('indicadorQRCodeContainer').innerHTML='';
  $('busca').value='';$('btnLimparBusca').classList.remove('visible');limparUrlQR();
  if(pertoMimAtivo){pertoMimAtivo=false;usuarioPosicao=null;$('btnPertoMim').textContent='Perto de mim';renderizarCards()}
  montarControlesFiltro();aplicarFiltros();
}
function definirCategoria(cat){
  categoriaGlobal=cat;
  $('indicadorCategoriaContainer').innerHTML=cat?`<div class="ev-ind ev-ind-cat"><div><small>Você está explorando</small><strong>${sanitize(cat)}</strong></div><a class="ev-b" href="${sanitize(PAGINA_CATEGORIAS)}">← Voltar para página de categorias</a></div>`:'';
  montarControlesFiltro();
}
function fecharQR(categoria){
  estabelecimentoViaQR=null;$('indicadorQRCodeContainer').innerHTML='';$('busca').value='';$('btnLimparBusca').classList.remove('visible');limparUrlQR();
  definirCategoria(categoria||null);aplicarFiltros();
}

/* ===== PERTO DE MIM ===== */
function obterLocalizacao(){
  return new Promise((resolve,reject)=>{
    if(!navigator.geolocation){reject('Geolocalização não suportada');return}
    navigator.geolocation.getCurrentPosition(
      pos=>{usuarioPosicao={lat:pos.coords.latitude,lng:pos.coords.longitude};resolve()},
      err=>reject(err.code===1?'Permissão negada. Habilite a localização nas configurações do navegador.':err.code===2?'Localização indisponível':err.code===3?'Tempo esgotado':'Erro ao obter localização'),
      {enableHighAccuracy:true,timeout:10000,maximumAge:0});
  });
}
function alternarPertoMim(){
  const btn=$('btnPertoMim');
  if(pertoMimAtivo){pertoMimAtivo=false;usuarioPosicao=null;btn.textContent='Perto de mim';renderizarCards();aplicarFiltros();return}
  btn.textContent='Buscando...';
  obterLocalizacao().then(()=>{pertoMimAtivo=true;btn.textContent='Perto de mim';renderizarCards();aplicarFiltros()}).catch(msg=>{btn.textContent='Perto de mim';toast(msg)});
}

/* ===== ENTRADAS POR URL (?cat= e ?qr=: contrato do app) ===== */
function aplicarCategoriaURL(){
  const params=new URLSearchParams(location.search);if(!params.has('cat'))return;
  const norm=s=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
  const slug=norm(params.get('cat'));
  let cat=(CFG.mapeamentoExato||{})[slug]||null;
  if(!cat){
    const mapa=new Map(dados.filter(c=>categoriaDe(c)).map(c=>[norm(categoriaDe(c)),categoriaDe(c)]));
    cat=mapa.get(slug)||([...mapa].find(([k])=>k.includes(slug)||slug.includes(k))||[])[1]||null;
  }
  if(cat)definirCategoria(cat);
}
function aplicarQRURL(){
  const params=new URLSearchParams(location.search);if(!params.has('qr'))return;
  const v=params.get('qr').toLowerCase().trim().replace(/-+$/,'');
  const igual=(a,b)=>a&&a.toLowerCase().trim().replace(/-+$/,'')===b;
  const est=dados.find(c=>c[C.ID_UNICO]&&c[C.ID_UNICO].toLowerCase().trim()===v)||dados.find(c=>igual(c[C.SLUG],v))||dados.find(c=>gerarSlug(c[C.NOME]).replace(/-+$/,'')===v);
  if(!est)return;
  estabelecimentoViaQR=est;
  const cat=est[C.CATEGORIA];
  categoriaGlobal=cat;$('busca').value=est[C.NOME];$('btnLimparBusca').classList.add('visible');
  $('indicadorQRCodeContainer').innerHTML=`<div class="ev-ind ev-ind-qr"><div><small>Você está acessando:</small><strong>${sanitize(est[C.NOME])}</strong></div><button class="ev-b botao-fechar-qr" data-categoria="${sanitize(cat||'')}" type="button">← Voltar para ${sanitize(cat||'todos')}</button></div>`;
  aplicarFiltros();
  const idx=dados.findIndex(c=>c[C.NOME]===est[C.NOME]);
  if(idx>=0&&cards[idx])setTimeout(()=>{alternar(cards[idx].card);cards[idx].expanded.scrollIntoView({behavior:'smooth',block:'start'})},200);
}

/* ===== CARGA DOS DADOS ===== */
function mostrarErro(msg){
  $('loading').style.display='flex';
  $('loading').innerHTML=`<div class="ev-semres" style="width:100%"><h3>Não foi possível carregar os estabelecimentos</h3><p>${sanitize(msg)}</p><button class="ev-b pri" data-acao="recarregar" type="button">Tentar novamente</button></div>`;
}
async function carregarDados(){
  $('loading').style.display='flex';
  $('loading').innerHTML='<div class="ev-spin" aria-hidden="true"></div><span>'+sanitize(CFG.textoCarregando||'Carregando estabelecimentos...')+'</span>';
  let linhas=cache.ler(),aviso=false;
  if(!linhas){
    try{
      const resp=await fetch(CFG.csvUrl);if(!resp.ok)throw new Error('Erro HTTP '+resp.status);
      linhas=parseCSV(await resp.text()).slice(1).filter(c=>c[C.ATIVO]&&c[C.ATIVO].toLowerCase()==='sim');
      cache.salvar(linhas);
    }catch(e){
      console.error('Erro no carregamento:',e);
      linhas=cache.ler(true);aviso=true;
      if(!linhas||!linhas.length){mostrarErro(e.message);return}
    }
  }
  dados=linhas;
  /* espera o Auth do tema e o Firestore, no máximo 8 s: se falhar, a página abre sem notas */
  await esperar(Promise.all([AUTH?AUTH.pronto:null,firestorePronto]),8000);
  definirUsuario(AUTH?AUTH.usuario:null);
  [estatisticasGlobais,notasUsuario]=await Promise.all([getEstatisticasAvaliacoes(),getAvaliacoesUsuario()]);
  renderizarCards();montarControlesFiltro();aplicarCategoriaURL();aplicarFiltros();aplicarQRURL();
  $('loading').style.display='none';$('lista').style.display='';
  if(aviso)toast('Dados desatualizados. Verifique sua conexão.');
  /* login/logout feito aqui, no menu do tema ou na conta: atualiza as notas e os cards no lugar */
  if(AUTH)AUTH.aoMudar(u=>{
    if((u&&u.uid)===(currentUser&&currentUser.uid))return;
    sincronizarUsuario(u).catch(e=>console.error(e));
  });
}

/* ===== EVENTOS ===== */
$('lista').addEventListener('click',e=>{
  const t=e.target;
  const fav=t.closest('.btn-favorito');
  if(fav){
    const card=fav.closest('.card'),on=gerFav.toggle(card.dataset.nome);
    fav.classList.toggle('ativo',on);fav.setAttribute('aria-pressed',String(on));fav.innerHTML=`<i class="${on?'fa-solid':'fa-regular'} fa-heart" aria-hidden="true"></i>`;
    card.classList.toggle('card-favorito',on);aplicarFiltros();return;
  }
  const rec=t.closest('.btn-recolher');
  if(rec){const c=rec.closest('.card-wrapper').querySelector('.card');alternar(c);c.scrollIntoView({behavior:'smooth',block:'nearest'});return}
  const est=t.closest('.estrela-btn');if(est){avaliar(est);return}
  if(t.closest('.link-entrar')){executarLogin(null);return}
  if(t.closest('.link-sair')){e.preventDefault();sair();return}
  if(t.closest('.badge-modulo-card')){const b=t.closest('.badge-modulo-card'),def=badgesRegistrados[b.dataset.modulo];toast((def&&(def.desc||def.label))||'');return}
  const ac=t.closest('[data-acao]');
  if(ac){
    const idx=ac.dataset.index,a=ac.dataset.acao;
    if(a==='whatsapp')abrirListaWhatsapp(idx);
    else if(a==='reserva')abrirListaReservas(idx);
    else if(a==='itens')abrirListaItens(idx,ac.dataset.botao);
    else if(a==='modulo')modulosRegistrados[ac.dataset.modulo].abrir(parseInt(idx,10));
    else if(a==='compartilhar'){const nome=dados[idx][C.NOME];window.abrirQRCode(e,nome,imagemQR(nome),urlQR(nome))}
    else if(a==='limpar')limparTudo();
    return;
  }
  if(t.closest('a'))return;
  const c=t.closest('.card');if(c)alternar(c);
});
$('lista').addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.classList.contains('card')){e.preventDefault();alternar(e.target)}});
$('lista').addEventListener('mouseover',e=>{
  const b=e.target.closest('.estrela-btn');if(!b)return;
  b.parentElement.querySelectorAll('.estrela-btn').forEach((s,i)=>s.classList.toggle('preview',i<parseInt(b.dataset.rating,10)));
});
$('lista').addEventListener('mouseout',e=>{if(e.target.closest('.avaliacao-estrelas')&&!e.target.closest('.avaliacao-estrelas').contains(e.relatedTarget))e.target.closest('.avaliacao-estrelas').querySelectorAll('.estrela-btn').forEach(s=>s.classList.remove('preview'))});
$('loading').addEventListener('click',e=>{if(e.target.closest('[data-acao="recarregar"]'))carregarDados()});
$('evFiltros').addEventListener('click',e=>{const b=e.target.closest('[data-filtros]');if(b)abrirModalFiltros(b.dataset.filtros)});
$('btnLimparFiltros').onclick=limparTudo;
$('btnPertoMim').onclick=alternarPertoMim;
$('btnMelhoresAvaliados').onclick=()=>{ordenarPorMedia=!ordenarPorMedia;aplicarFiltros()};
$('busca').addEventListener('input',()=>{$('btnLimparBusca').classList.toggle('visible',$('busca').value.length>0);aplicarFiltros()});
$('busca').addEventListener('keypress',e=>{if(e.key==='Enter'){e.preventDefault();$('busca').blur()}});
$('btnLimparBusca').onclick=()=>{$('busca').value='';$('btnLimparBusca').classList.remove('visible');aplicarFiltros();$('busca').focus()};
$('indicadorQRCodeContainer').addEventListener('click',e=>{const b=e.target.closest('.botao-fechar-qr');if(b)fecharQR(b.dataset.categoria)});

/* modo app/PWA (classes usadas pelo CSS dos módulos e do app) */
(function(){
  const s=location.search,ua=(navigator.userAgent||'').toLowerCase();
  const app=s.includes('app=1')||s.includes('app=true')||navigator.standalone===true||(window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches)||ua.includes('wv')||ua.includes('webview');
  if(app){document.documentElement.classList.add('modo-app-inicial');document.body.classList.add('modo-app')}
})();

window.Economizei=window.Economizei||{};
window.Economizei.Cards={registrarModulo,registrarBadge,getCardByIndex,dadosProntos,colunas:C,get dadosProcessados(){return dados}};
carregarDados();

/* Contrato do app Android: o app sequestra window.abrirQRCode (AndroidQR) e abre a QrCodeActivity nativa.
   Assinatura fixa: (event, nome, qrCodeURL=imagem, urlQRCode=link). Manter por último. */
window.abrirQRCode=abrirQRCode;
})();
