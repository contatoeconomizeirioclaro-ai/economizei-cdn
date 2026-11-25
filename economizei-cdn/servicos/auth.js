(function(){
  var E=window.Economizei=window.Economizei||{};
  if(E.Auth)return;
  var FIREBASE_CONFIG={apiKey:"AIzaSyDrNlMrrlYJhC78ALOBUdr8bSJ7ykLs_O4",authDomain:"economizeirioclaro.firebaseapp.com",projectId:"economizeirioclaro",storageBucket:"economizeirioclaro.firebasestorage.app",messagingSenderId:"243852155427",appId:"1:243852155427:web:57bcc18ca6b329f1bc6f96"};
  var SDK='https://www.gstatic.com/firebasejs/10.8.0/';
  var usuario=null,disponivel=false,resolvido=false,ouvintes=[],auth=null,provider=null,pendente=null,emAndamento=null;
  var resolverPronto,pronto=new Promise(function(r){resolverPronto=r});
  var modalAtivo=null,focoAnterior=null,ov=null,toastEl=null,toastT=null;

  function el(tag,cls,txt){var n=document.createElement(tag);if(cls)n.className=cls;if(txt!=null)n.textContent=txt;return n}
  function icone(cls){var i=el('i',cls);i.setAttribute('aria-hidden','true');return i}
  function erro(code,msg){var e=new Error(msg);e.code=code;return e}
  function noApp(){return !!(window.Android&&typeof window.Android.iniciarLoginGoogle==='function')}
  function nomeCompleto(u){return u.displayName||(u.email?u.email.split('@')[0]:'')||'Usuário'}
  function nomeCurto(u){return nomeCompleto(u).split(' ')[0]}
  function toast(msg){
    if(!toastEl){toastEl=el('div','ea-toast');toastEl.setAttribute('role','status');document.body.appendChild(toastEl)}
    toastEl.textContent=msg;toastEl.classList.add('on');clearTimeout(toastT);
    toastT=setTimeout(function(){toastEl.classList.remove('on')},3000);
  }
  function overlay(on){
    if(on&&!ov){ov=el('div','ea-overlay');ov.setAttribute('role','alert');ov.setAttribute('aria-live','assertive');ov.appendChild(el('div','ea-spin'));ov.appendChild(el('span',null,'Autenticando...'));document.body.appendChild(ov)}
    if(ov)ov.style.display=on?'flex':'none';
  }

  /* ===== Botões de conta: item do menu desktop e bloco do drawer mobile/app ===== */
  function pintarBotao(b){
    b.classList.remove('ea-carregando');b.textContent='';
    if(usuario){
      if(usuario.photoURL){
        var img=el('img','ea-foto');img.alt='';img.width=24;img.height=24;img.referrerPolicy='no-referrer';img.src=usuario.photoURL;
        img.onerror=function(){img.replaceWith(icone('fa-solid fa-circle-user'))};b.appendChild(img);
      }else b.appendChild(icone('fa-solid fa-circle-user'));
      b.appendChild(el('span','ea-nome',nomeCurto(usuario)));
      b.setAttribute('aria-label','Minha conta: '+nomeCurto(usuario));b.setAttribute('aria-haspopup','dialog');
    }else{
      b.appendChild(icone('fa-solid fa-right-to-bracket'));
      b.appendChild(el('span',null,'Entrar'));
      b.setAttribute('aria-label','Entrar');b.removeAttribute('aria-haspopup');
    }
  }
  function fecharMenu(){
    var t=document.querySelector('.mobile-menu-toggle');
    if(document.body.classList.contains('nav-active')&&t)t.click();
  }
  function pintarDrawer(box){
    box.classList.remove('ea-carregando');box.textContent='';
    var linha=el('div','ea-dr-linha'),x=el('button','ea-dr-x','×');
    x.type='button';x.setAttribute('aria-label','Fechar menu');x.onclick=fecharMenu;
    if(usuario){
      var perfil=el('div','ea-dr-perfil');
      if(usuario.photoURL){
        var img=el('img','ea-dr-foto');img.alt='';img.width=44;img.height=44;img.referrerPolicy='no-referrer';img.src=usuario.photoURL;
        img.onerror=function(){img.replaceWith(icone('fa-solid fa-circle-user ea-dr-foto'))};perfil.appendChild(img);
      }else perfil.appendChild(icone('fa-solid fa-circle-user ea-dr-foto'));
      var d=el('div','ea-dr-dados');d.appendChild(el('strong',null,nomeCompleto(usuario)));
      if(usuario.email)d.appendChild(el('span',null,usuario.email));
      perfil.appendChild(d);linha.appendChild(perfil);linha.appendChild(x);box.appendChild(linha);
      var s=el('button','ea-dr-btn ea-dr-sair');s.type='button';s.appendChild(icone('fa-solid fa-right-from-bracket'));s.appendChild(document.createTextNode(' Sair'));
      box.appendChild(s);
    }else{
      var t=el('div','ea-dr-dados');t.appendChild(el('strong',null,'Sua conta'));t.appendChild(el('span',null,'Entre para avaliar os estabelecimentos.'));
      linha.appendChild(t);linha.appendChild(x);box.appendChild(linha);
      var e=el('button','ea-dr-btn ea-entrar');e.type='button';e.appendChild(icone('fa-solid fa-right-to-bracket'));e.appendChild(document.createTextNode(' Entrar'));
      box.appendChild(e);
    }
  }
  function atualizar(){
    if(!resolvido)return;
    [].forEach.call(document.querySelectorAll('.ea-conta'),pintarBotao);
    var box=document.getElementById('eaDrawerConta');if(box)pintarDrawer(box);
  }
  /* Os menus são montados por theme-functions.js (desktop apaga e recria #main-menu; o drawer copia o desktop):
     por isso o item de login entra depois da montagem, observando os dois contêineres. */
  function ajustarMenus(){
    var nav=document.getElementById('main-menu-nav');
    if(nav&&!nav.querySelector('.menu-conta')){
      var li=el('li','menu-conta'),b=el('button','ea-conta ea-carregando');b.type='button';li.appendChild(b);nav.appendChild(li);
      if(resolvido)pintarBotao(b);
    }
    var ul=document.querySelector('.mobile-menu-ul'),a=ul&&ul.querySelector('a[href*="/p/cadastro.html"]'),item=a&&a.closest('li');
    if(item&&!item.classList.contains('ea-cta')){item.classList.add('ea-cta');ul.appendChild(item)}
  }
  function iniciarMenus(){
    var wrap=document.querySelector('.mobile-menu-wrap');
    if(wrap&&!document.getElementById('eaDrawerConta')){
      var box=el('div','ea-drawer-conta ea-carregando');box.id='eaDrawerConta';wrap.insertBefore(box,wrap.firstChild);
    }
    ['main-menu'].forEach(function(id){var c=document.getElementById(id);if(c)new MutationObserver(ajustarMenus).observe(c,{childList:true})});
    var m=document.querySelector('.mobile-menu');if(m)new MutationObserver(ajustarMenus).observe(m,{childList:true});
    ajustarMenus();atualizar();
  }
  function notificar(){ouvintes.slice().forEach(function(fn){try{fn(usuario)}catch(e){console.error(e)}})}

  /* ===== Firebase Auth (sem Firestore) ===== */
  function carregar(src){return new Promise(function(ok,ko){var s=document.createElement('script');s.src=src;s.async=false;s.onload=ok;s.onerror=function(){ko(new Error('Falha ao carregar '+src))};document.head.appendChild(s)})}
  Promise.all([carregar(SDK+'firebase-app-compat.js'),carregar(SDK+'firebase-auth-compat.js')]).then(function(){
    if(!firebase.apps.length)firebase.initializeApp(FIREBASE_CONFIG);
    auth=firebase.auth();provider=new firebase.auth.GoogleAuthProvider();disponivel=true;
    auth.onAuthStateChanged(function(u){if(lojistaCache&&(!u||lojistaCache.uid!==u.uid))lojistaCache=null;usuario=u;resolvido=true;resolverPronto();atualizar();notificar()});
  }).catch(function(e){console.error(e);resolvido=true;resolverPronto();atualizar()});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',iniciarMenus);else iniciarMenus();
  window.addEventListener('load',ajustarMenus);

  /* ===== Contrato do app Android (únicos handlers da página) ===== */
  window.onLoginSuccess=function(idToken){
    var p=pendente;pendente=null;
    pronto.then(function(){
      if(!idToken||!auth){var e=erro('app/sem-token','Não foi possível obter o token do Google.');if(p)p.reject(e);else console.error(e.message);return}
      return auth.signInWithCredential(firebase.auth.GoogleAuthProvider.credential(idToken)).then(
        function(r){if(p)p.resolve(r.user)},
        function(err){if(p)p.reject(err);else{console.error(err);toast('Erro ao fazer login. Tente novamente.')}});
    });
  };
  window.onLoginError=function(msg){
    var p=pendente;pendente=null;
    var e=erro('app/login-error',msg||'Falha no login.');
    if(p)p.reject(e);else{console.error(e.message);toast('Erro ao fazer login: '+e.message)}
  };

  /* ===== API ===== */
  function entrar(opts){
    opts=opts||{};
    if(usuario)return Promise.resolve(usuario);
    if(emAndamento)return emAndamento;
    if(!disponivel)return Promise.reject(erro('auth/indisponivel','Login indisponível no momento.'));
    var limite;
    overlay(true);
    emAndamento=new Promise(function(resolve,reject){
      limite=setTimeout(function(){pendente=null;reject(erro('auth/timeout','O login demorou demais. Tente novamente.'))},30000);
      if(!noApp()){auth.signInWithPopup(provider).then(function(r){resolve(r.user)},reject);return}
      pendente={resolve:resolve,reject:reject};
      try{window.Android.iniciarLoginGoogle(opts.rating!=null?String(opts.rating):'','',opts.nome?String(opts.nome):'')}catch(e){pendente=null;reject(e)}
    });
    var fim=function(){clearTimeout(limite);overlay(false);emAndamento=null};
    emAndamento.then(fim,fim);
    return emAndamento;
  }
  function sair(){return auth?auth.signOut():Promise.resolve()}
  function mensagemErro(e){
    var c=e&&e.code;
    if(['auth/popup-closed-by-user','auth/cancelled-popup-request','auth/user-cancelled'].indexOf(c)>-1)return '';
    if(c==='auth/popup-blocked')return 'O pop-up foi bloqueado. Permita pop-ups para este site.';
    if(c==='auth/timeout'||c==='auth/indisponivel')return e.message;
    if(['auth/invalid-credential','auth/user-not-found','auth/wrong-password'].indexOf(c)>-1)return 'E-mail ou senha incorretos.';
    if(c==='auth/email-already-in-use')return 'Este e-mail já está cadastrado. Use a aba Entrar.';
    if(c==='auth/weak-password')return 'A senha deve ter pelo menos 6 caracteres.';
    if(c==='auth/invalid-email')return 'E-mail inválido.';
    if(c==='auth/too-many-requests')return 'Muitas tentativas. Tente novamente mais tarde.';
    return 'Erro ao fazer login: '+((e&&e.message)||e);
  }
  function aoMudar(fn){
    if(typeof fn!=='function')return function(){};
    ouvintes.push(fn);
    if(resolvido)try{fn(usuario)}catch(e){console.error(e)}
    return function(){var i=ouvintes.indexOf(fn);if(i>-1)ouvintes.splice(i,1)};
  }

  /* ===== Modal "Minha conta" ===== */
  function focaveis(){return [].slice.call(modalAtivo.querySelectorAll('button,[href],input,[tabindex]:not([tabindex="-1"])')).filter(function(x){return !x.disabled&&x.offsetParent!==null})}
  function fecharConta(){
    if(!modalAtivo)return;
    modalAtivo.remove();modalAtivo=null;
    if(focoAnterior&&focoAnterior.focus)focoAnterior.focus();focoAnterior=null;
  }
  function abrirConta(){
    if(!usuario)return;
    fecharConta();focoAnterior=document.activeElement;
    var m=el('div','ea-mo'),c=el('div','ea-mc'),cab=el('div','ea-mh'),h=el('h3',null,'Minha conta'),x=el('button','ea-x','×');
    m.setAttribute('role','dialog');m.setAttribute('aria-modal','true');m.setAttribute('aria-labelledby','eaContaTit');h.id='eaContaTit';
    x.type='button';x.setAttribute('aria-label','Fechar');x.onclick=fecharConta;
    cab.appendChild(h);cab.appendChild(x);
    var perfil=el('div','ea-perfil'),dados=el('div','ea-dados');
    if(usuario.photoURL){
      var img=el('img','ea-foto-g');img.alt='';img.width=64;img.height=64;img.referrerPolicy='no-referrer';img.src=usuario.photoURL;
      img.onerror=function(){img.replaceWith(icone('fa-solid fa-circle-user ea-foto-g'))};perfil.appendChild(img);
    }else perfil.appendChild(icone('fa-solid fa-circle-user ea-foto-g'));
    dados.appendChild(el('strong',null,nomeCompleto(usuario)));
    if(usuario.email)dados.appendChild(el('span',null,usuario.email));
    perfil.appendChild(dados);
    var s=el('button','ea-sair');s.type='button';s.appendChild(icone('fa-solid fa-right-from-bracket'));s.appendChild(document.createTextNode(' Sair'));
    s.onclick=function(){sair().then(function(){fecharConta();toast('Você saiu da sua conta.')},function(e){toast('Erro ao sair: '+e.message)})};
    c.appendChild(cab);c.appendChild(perfil);c.appendChild(s);m.appendChild(c);
    m.addEventListener('click',function(e){if(e.target===m)fecharConta()});
    document.body.appendChild(m);modalAtivo=m;x.focus();
  }
  document.addEventListener('keydown',function(e){
    if(!modalAtivo)return;
    if(e.key==='Escape'){fecharConta();return}
    if(e.key!=='Tab')return;
    var f=focaveis();if(!f.length)return;
    var a=f[0],z=f[f.length-1];
    if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus()}
    else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus()}
  });
  /* ===== Login por e-mail e senha ===== */
  function comOverlay(p){overlay(true);return p.then(function(r){overlay(false);return r},function(e){overlay(false);throw e})}
  function semAuth(){return Promise.reject(erro('auth/indisponivel','Login indisponível no momento.'))}
  function entrarEmail(email,senha){return disponivel?comOverlay(auth.signInWithEmailAndPassword(email,senha).then(function(r){return r.user})):semAuth()}
  function criarConta(email,senha){return disponivel?comOverlay(auth.createUserWithEmailAndPassword(email,senha).then(function(r){return r.user})):semAuth()}
  function recuperarSenha(email){return disponivel?comOverlay(auth.sendPasswordResetEmail(email)):semAuth()}

  /* ===== Modal de login (abas Entrar e Criar conta; igual para visitante e empreendedor) ===== */
  function abrirLogin(modo){
    if(usuario){abrirConta();return}
    fecharConta();focoAnterior=document.activeElement;
    var m=el('div','ea-mo'),c=el('div','ea-mc'),cab=el('div','ea-mh'),h=el('h3',null,'Entrar'),x=el('button','ea-x','×');
    m.setAttribute('role','dialog');m.setAttribute('aria-modal','true');m.setAttribute('aria-labelledby','eaLoginTit');h.id='eaLoginTit';
    x.type='button';x.setAttribute('aria-label','Fechar');x.onclick=fecharConta;
    cab.appendChild(h);cab.appendChild(x);
    var abas=el('div','ea-tabs'),corpo=el('div','ea-corpo');abas.setAttribute('role','tablist');
    c.appendChild(cab);c.appendChild(abas);c.appendChild(corpo);m.appendChild(c);
    m.addEventListener('click',function(e){if(e.target===m)fecharConta()});
    document.body.appendChild(m);modalAtivo=m;
    function sucesso(msg){fecharConta();toast(msg)}
    function pintar(cad){
      h.textContent=cad?'Criar conta':'Entrar';abas.textContent='';corpo.textContent='';
      [['Entrar',false],['Criar conta',true]].forEach(function(a){
        var b=el('button','ea-tab'+(a[1]===cad?' on':''),a[0]);b.type='button';b.setAttribute('role','tab');b.setAttribute('aria-selected',String(a[1]===cad));
        b.onclick=function(){pintar(a[1])};abas.appendChild(b);
      });
      var erroMsg=el('div','ea-erro');erroMsg.setAttribute('role','alert');
      var g=el('button','ea-g-btn');g.type='button';g.appendChild(icone('fa-brands fa-google'));g.appendChild(document.createTextNode(' Continuar com Google'));
      g.onclick=function(){erroMsg.textContent='';entrar().then(function(){sucesso('Login realizado com sucesso!')},function(err){erroMsg.textContent=mensagemErro(err)||''})};
      var f=el('form','ea-form');f.noValidate=true;
      function campo(id,rot,tipo,auto){var d=el('div','ea-campo'),l=el('label',null,rot),i=el('input');l.htmlFor=id;i.id=id;i.type=tipo;i.autocomplete=auto;d.appendChild(l);d.appendChild(i);f.appendChild(d);return i}
      var ie=campo('eaEmail','E-mail','email','email'),is=campo('eaSenha','Senha','password',cad?'new-password':'current-password'),ic=cad?campo('eaSenha2','Confirmar senha','password','new-password'):null;
      var env=el('button','ea-pri',cad?'Criar conta':'Entrar');env.type='submit';
      f.appendChild(erroMsg);f.appendChild(env);
      f.onsubmit=function(ev){
        ev.preventDefault();erroMsg.textContent='';
        var em=ie.value.trim(),se=is.value;
        if(!em||!se){erroMsg.textContent='Preencha o e-mail e a senha.';return}
        if(cad&&se!==ic.value){erroMsg.textContent='As senhas não conferem.';return}
        (cad?criarConta(em,se):entrarEmail(em,se)).then(function(){sucesso(cad?'Conta criada com sucesso!':'Login realizado com sucesso!')},function(err){erroMsg.textContent=mensagemErro(err)||''});
      };
      if(!cad){
        var esq=el('button','ea-link','Esqueci minha senha');esq.type='button';
        esq.onclick=function(){
          erroMsg.textContent='';var em=ie.value.trim();
          if(!em){erroMsg.textContent='Digite seu e-mail para receber o link.';return}
          recuperarSenha(em).then(function(){toast('Enviamos o link de recuperação para o seu e-mail.')},function(err){erroMsg.textContent=mensagemErro(err)||''});
        };
        f.appendChild(esq);
      }
      corpo.appendChild(g);corpo.appendChild(el('div','ea-sep','ou'));corpo.appendChild(f);
    }
    pintar(modo==='cadastrar');x.focus();
  }

  /* ===== Dados (Economizei.DB): Firestore só é carregado quando uma página pede; o login do tema não depende dele ===== */
  var fsPromise=null,lojistaCache=null;
  function firestore(){
    if(!fsPromise){
      fsPromise=pronto.then(function(){
        if(!disponivel)throw erro('db/indisponivel','Dados indisponíveis no momento.');
        return typeof firebase.firestore==='function'?null:carregar(SDK+'firebase-firestore-compat.js');
      }).then(function(){
        var f=firebase.firestore();
        try{f.settings({experimentalAutoDetectLongPolling:true,merge:true})}catch(e){}
        return f;
      });
      fsPromise.catch(function(){fsPromise=null});
    }
    return fsPromise;
  }
  /* Cadastro de empreendedor (lojistas/{e-mail}) do usuário logado: dados brutos ou null. Uma leitura por página; o tema não exibe nada daqui. */
  function lojista(){
    return pronto.then(function(){
      if(!usuario||!usuario.email)return null;
      if(!lojistaCache||lojistaCache.uid!==usuario.uid){
        var uid=usuario.uid,email=usuario.email;
        lojistaCache={uid:uid,promessa:firestore().then(function(f){return f.collection('lojistas').doc(email).get()}).then(function(d){return d.exists?d.data():null})};
        lojistaCache.promessa.catch(function(){lojistaCache=null});
      }
      return lojistaCache.promessa;
    });
  }
  function recarregarLojista(){lojistaCache=null;return lojista()}
  document.addEventListener('click',function(e){
    var t=e.target.closest?e.target:e.target.parentElement;if(!t)return;
    if(t.closest('.ea-conta')){if(usuario)abrirConta();else abrirLogin();return}
    if(t.closest('.ea-entrar')){fecharMenu();abrirLogin();return}
    if(t.closest('.ea-dr-sair')){sair().then(function(){toast('Você saiu da sua conta.')},function(err){toast('Erro ao sair: '+err.message)})}
  });

  E.Auth={get usuario(){return usuario},get disponivel(){return disponivel},pronto:pronto,entrar:entrar,entrarEmail:entrarEmail,criarConta:criarConta,recuperarSenha:recuperarSenha,sair:sair,abrirLogin:abrirLogin,abrirConta:abrirConta,aoMudar:aoMudar,mensagemErro:mensagemErro};
  E.DB={firestore:firestore,lojista:lojista,recarregar:recarregarLojista};
})();
