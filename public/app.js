/* =====================================================================
   CASAL PERSONALIZADOS — app.js (versão final consolidada)
   ---------------------------------------------------------------------
   • WhatsApp FIXO: 555194222647 (+55 51 9422-2647)
   • O número do admin NÃO sobrescreve mais o número correto
   • Links: https://api.whatsapp.com/send/?phone=555194222647&text=...
   ---------------------------------------------------------------------
   MELHORIAS DESTA VERSÃO:
   1) Novo formulário "Vamos criar juntos" (drag & drop + WhatsApp + admin)
   2) Lightbox também abre as fotos do carrossel do topo (hero)
   3) Select de produto do novo formulário preenchido pelo catálogo
   4) Trava de rolagem com contador (carrinho + lightbox sem conflito)
   5) FALLBACK DE FOTO: foto quebrada vira emoji da categoria
   6) loading="lazy" nas fotos de produto (site mais rápido)
   ===================================================================== */
/* ============================================================
   1. CONFIGURAÇÃO DO WHATSAPP (ÚNICO LUGAR QUE DEFINE O NÚMERO)
   ============================================================ */
var whatsappPadrao = '555194222647'; // +55 51 9422-2647 — SEU NÚMERO REAL
var mensagemGeral = 'Olá! Vim pelo site da CASAL PERSONALIZADOS e gostaria de mais informações :)';
var settings = {};
var produtosGlobais = [];
/* ============================================================
   2. UTILITÁRIOS
   ============================================================ */
function formatarTelefoneWhats(digitos) {
  return String(digitos || whatsappPadrao).replace(/\D/g, '');
}
/* Remove caracteres quebrados que corrompem o link do WhatsApp */
function limparMensagem(texto) {
  return String(texto || '')
    .replace(/[\uD800-\uDFFF]/g, '')
    .replace(/[\uFFFD]/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim();
}
/* Monta o link SEMPRE com o número correto (whatsappPadrao) */
function montarLinkWhats(numero, mensagem) {
  var n = formatarTelefoneWhats(numero || whatsappPadrao);
  var t = encodeURIComponent(limparMensagem(mensagem));
  return 'https://api.whatsapp.com/send/?phone=' + n + '&text=' + t;
}
function escaparHTML(texto) {
  if (texto === undefined || texto === null) return '';
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function escapeAttr(texto) {
  return escaparHTML(texto).replace(/'/g, '&#39;');
}
function sanitizarUrl(url) {
  if (!url) return '';
  var u = String(url).trim();
  if (u.indexOf('data:image/') === 0) return u;
  if (u.charAt(0) === '/') return u;
  if (/^https?:\/\//i.test(u)) return u;
  return '';
}
function formatarReais(valor) {
  var n = Number(valor) || 0;
  return 'R$ ' + n.toFixed(2).replace('.', ',');
}
function primeiroNumero(texto) {
  if (!texto) return 0;
  var m = String(texto).match(/R\$\s*([\d.,]+)/);
  if (!m) return 0;
  return parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
}
function lerJSON(chave, padrao) {
  try {
    var v = JSON.parse(localStorage.getItem(chave));
    return v === undefined || v === null ? padrao : v;
  } catch (e) { return padrao; }
}
function gravarJSON(chave, valor) {
  try { localStorage.setItem(chave, JSON.stringify(valor)); } catch (e) {}
}
function setTexto(id, valor) {
  var el = document.getElementById(id);
  if (el) el.textContent = valor;
}
function bind(seletor, evento, fn) {
  var el = typeof seletor === 'string' ? document.querySelector(seletor) : seletor;
  if (el) el.addEventListener(evento, fn);
  return el;
}
function bindId(id, evento, fn) {
  var el = document.getElementById(id);
  if (el) el.addEventListener(evento, fn);
  return el;
}
function debounce(fn, espera) {
  var timer = null;
  return function () {
    var args = arguments;
    var ctx = this;
    clearTimeout(timer);
    timer = setTimeout(function () { fn.apply(ctx, args); }, espera || 120);
  };
}
function fetchJson(url, opcoes) {
  var controle = new AbortController();
  var timer = setTimeout(function () { controle.abort(); }, 9000);
  opcoes = opcoes || {};
  opcoes.signal = controle.signal;
  return fetch(url, opcoes)
    .then(function (r) {
      clearTimeout(timer);
      return r.json().catch(function () { return {}; });
    });
}
/* MELHORIA: trava de rolagem com contador (carrinho + lightbox sem conflito) */
var bloqueiosScroll = 0;
function travarScroll() {
  bloqueiosScroll++;
  document.body.style.overflow = 'hidden';
}
function destravarScroll() {
  bloqueiosScroll = Math.max(0, bloqueiosScroll - 1);
  if (!bloqueiosScroll) document.body.style.overflow = '';
}
/* ============================================================
   3. WHATSAPP — TODOS OS LINKS USAM O NÚMERO CORRETO
   ============================================================ */
function abrirWhatsApp(mensagem, digitos) {
  /* SEMPRE usa whatsappPadrao — ignora o número do admin */
  var link = montarLinkWhats(whatsappPadrao, mensagem);
  window.open(link, '_blank', 'noopener,noreferrer');
}
function atualizarLinksWhats() {
  /* SEMPRE usa whatsappPadrao — ignora settings.whatsapp */
  var link = montarLinkWhats(whatsappPadrao, mensagemGeral);
  ['linkWhatsNav','linkWhatsNav2','linkWhatsMobile','linkWhatsHero','linkWhatsFooter','whatsFloat'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.href = link;
  });
}
/* ============================================================
   4. PREÇOS / PATAMARES DE DESCONTO
   ============================================================ */
function extrairPatamares(texto) {
  var encontrados = [];
  if (!texto) return encontrados;
  var regex = /(\d+)\s*\+\s*(?:un|unidade|unid|und)?\.?:?\s*R\$\s*([\d.,]+)/gi;
  var m;
  while ((m = regex.exec(String(texto))) !== null) {
    var preco = parseFloat(m[2].replace(/\./g, '').replace(',', '.'));
    if (isFinite(preco)) encontrados.push({ min: parseInt(m[1], 10), preco: preco });
  }
  return encontrados;
}
function precoUnitario(produto, quantidade) {
  if (!produto) return 0;
  var qtd = Math.max(1, Math.min(999, Math.abs(parseInt(quantidade, 10) || 1)));
  var base = primeiroNumero(produto.preco);
  var patamares = extrairPatamares(String(produto.detalhes || '') + ' ' + String(produto.preco || ''));
  if (patamares.length) {
    patamares.sort(function (a, b) { return a.min - b.min; });
    var escolhido = null;
    patamares.forEach(function (p) { if (qtd >= p.min) escolhido = p; });
    if (escolhido && isFinite(escolhido.preco)) return escolhido.preco;
  }
  return base;
}
function temPatamarPara(produto, quantidade) {
  var qtd = Math.max(1, Math.min(999, Math.abs(parseInt(quantidade, 10) || 1)));
  var base = primeiroNumero(produto.preco);
  return extrairPatamares(String(produto.detalhes || '') + ' ' + String(produto.preco || ''))
    .some(function (p) { return qtd >= p.min && p.preco < base; });
}
function formatarPatamares(texto) {
  if (!texto) return '';
  var partes = String(texto).split('|').map(function (s) { return s.trim(); }).filter(Boolean);
  var html = '';
  partes.forEach(function (parte) {
    var eco = parte.match(/\(economize\s+([^)]*)\)/i);
    if (eco) {
      var limpo = parte.replace(/\(economize\s+([^)]*)\)/i, '').trim();
      var econ = eco[1].trim();
      if (limpo) html += '<span class="patamar">' + escaparHTML(limpo) + ' <b class="eco">Economize ' + escaparHTML(econ) + '</b></span>';
      else html += '<span class="patamar"><b class="eco">Economize ' + escaparHTML(econ) + '</b></span>';
    } else {
      html += '<span class="patamar">' + escaparHTML(parte) + '</span>';
    }
  });
  return html;
}
/* ============================================================
   5. CARRINHO
   ============================================================ */
var carrinho = {
  CHAVE: 'casal_carrinho',
  itens: [],
  carregar: function () {
    var bruto = lerJSON(this.CHAVE, []);
    if (!Array.isArray(bruto)) bruto = [];
    this.itens = bruto.filter(function (i) {
      return i && i.id !== undefined && i.id !== null && i.nome && i.qtd > 0;
    }).map(function (i) {
      i.qtd = Math.max(1, Math.min(999, i.qtd | 0));
      return i;
    });
  },
  salvar: function () {
    gravarJSON(this.CHAVE, this.itens);
  },
  adicionar: function (produto) {
    if (!produto || produto.id === undefined) return;
    var existente = null;
    for (var i = 0; i < this.itens.length; i++) {
      if (String(this.itens[i].id) === String(produto.id)) { existente = this.itens[i]; break; }
    }
    if (existente) existente.qtd = Math.min(999, existente.qtd + 1);
    else this.itens.push({ id: produto.id, nome: produto.nome, preco: produto.preco, detalhes: produto.detalhes, qtd: 1, foto: produto.foto });
    this.salvar();
    this.renderizar();
    this.abrir();
  },
  remover: function (id) {
    var alvo = String(id);
    this.itens = this.itens.filter(function (i) { return String(i.id) !== alvo; });
    this.salvar();
    this.renderizar();
  },
  mudarQtd: function (id, delta) {
    var alvo = String(id);
    var item = this.itens.filter(function (i) { return String(i.id) === alvo; })[0];
    if (!item) return;
    item.qtd += delta;
    if (item.qtd <= 0) { this.remover(id); return; }
    item.qtd = Math.min(999, item.qtd);
    this.salvar();
    this.renderizar();
  },
  totalItens: function () {
    return this.itens.reduce(function (acc, i) { return acc + i.qtd; }, 0);
  },
  totalValor: function () {
    var self = this;
    return this.itens.reduce(function (acc, i) { return acc + precoUnitario(i, i.qtd) * i.qtd; }, 0);
  },
  abrir: function () {
    var d = document.getElementById('cartDrawer');
    var o = document.getElementById('cartOverlay');
    if (d) d.classList.add('aberto');
    if (o) o.classList.add('aberto');
    travarScroll();
  },
  fechar: function () {
    var d = document.getElementById('cartDrawer');
    var o = document.getElementById('cartOverlay');
    if (d) d.classList.remove('aberto');
    if (o) o.classList.remove('aberto');
    destravarScroll();
  },
  renderizar: function () {
    var lista = document.getElementById('cartItems');
    var total = this.totalItens();
    setTexto('cartBadge', total);
    setTexto('cartBadgeMobile', total);
    setTexto('cartQtdTotal', total + ' un');
    setTexto('cartTotal', formatarReais(this.totalValor()));
    if (!lista) return;
    var vazio = document.getElementById('cartVazio');
    var rodape = document.getElementById('cartRodape') || document.querySelector('.cart-rodape');
    lista.innerHTML = '';
    if (!this.itens.length) {
      if (vazio) vazio.style.display = 'block';
      if (rodape) rodape.style.display = 'none';
      return;
    }
    if (vazio) vazio.style.display = 'none';
    if (rodape) rodape.style.display = 'flex';
    this.itens.forEach(function (i) {
      var un = precoUnitario(i, i.qtd);
      var comDesconto = temPatamarPara(i, i.qtd);
      var selo = '';
      if (comDesconto) selo = i.qtd >= 10 ? ' <b class="eco">Atacado</b>' : (i.qtd >= 3 ? ' <b class="eco">3+ un</b>' : '');
      var div = document.createElement('div');
      div.className = 'cart-item';
      var imgHtml = i.foto
        ? '<img class="cart-item-img" src="' + escapeAttr(sanitizarUrl(i.foto)) + '" alt="">'
        : '<div class="cart-item-img" style="display:flex;align-items:center;justify-content:center;font-size:1.3rem;">🎁</div>';
      div.innerHTML =
        imgHtml +
        '<div class="cart-item-info">' +
          '<div class="cart-item-nome">' + escaparHTML(i.nome) + '</div>' +
          '<div class="cart-item-preco">' + formatarReais(un) + ' cada' + selo + '</div>' +
          '<div class="cart-item-qtd">' +
            '<button data-carrinho-menos="' + i.id + '" aria-label="Diminuir">−</button>' +
            '<span>' + i.qtd + '</span>' +
            '<button data-carrinho-mais="' + i.id + '" aria-label="Aumentar">+</button>' +
          '</div>' +
        '</div>' +
        '<button class="cart-item-remover" data-carrinho-remove="' + i.id + '" aria-label="Remover">🗑</button>';
      lista.appendChild(div);
      /* FALLBACK: foto quebrada no carrinho vira 🎁 */
      var imgItem = div.querySelector('.cart-item-img');
      if (imgItem && imgItem.tagName === 'IMG') {
        imgItem.addEventListener('error', function () {
          this.outerHTML = '<div class="cart-item-img" style="display:flex;align-items:center;justify-content:center;font-size:1.3rem;">🎁</div>';
        });
      }
    });
    lista.querySelectorAll('[data-carrinho-mais]').forEach(function (b) {
      b.addEventListener('click', function () { carrinho.mudarQtd(Number(this.getAttribute('data-carrinho-mais')), 1); });
    });
    lista.querySelectorAll('[data-carrinho-menos]').forEach(function (b) {
      b.addEventListener('click', function () { carrinho.mudarQtd(Number(this.getAttribute('data-carrinho-menos')), -1); });
    });
    lista.querySelectorAll('[data-carrinho-remove]').forEach(function (b) {
      b.addEventListener('click', function () { carrinho.remover(Number(this.getAttribute('data-carrinho-remove'))); });
    });
  },
  finalizarWhats: function () {
    if (!this.itens.length) return;
    var linhas = this.itens.map(function (i) {
      var un = precoUnitario(i, i.qtd);
      return '• ' + i.qtd + 'x ' + i.nome + ' — ' + formatarReais(un * i.qtd) + ' (' + formatarReais(un) + '/un)';
    });
    var msg = 'Olá! Quero finalizar meu pedido pela loja :)\n\n' +
      linhas.join('\n') +
      '\n\nTotal estimado: ' + formatarReais(this.totalValor()) +
      '\n\nPode me passar os detalhes de pagamento e envio?';
    /* SEMPRE envia para o número correto */
    abrirWhatsApp(msg, whatsappPadrao);
  }
};
/* ============================================================
   6. LOGIN / CONTA (e-mail + senha com hash, Google, cadastro)
   ============================================================ */

var usuarios = [];
var CHAVE_USUARIOS = 'casal_usuarios';
var CHAVE_LOGADO = 'casal_logado';
var _googleInicializado = false;  // garante initialize() apenas 1x
var _googleTentativas = 0;        // retenta enquanto a lib não carrega

/* ---------- Botão Google: renderiza na hora em que a modal abre ---------- */
function renderizarBotaoGoogle() {
  var container = document.getElementById('googleButton');
  if (!container) return; // se o div não existe, nada a fazer

  // Se a biblioteca ainda não carregou, tenta de novo (até 10x, 300ms entre cada)
  if (typeof google === 'undefined' || !google.accounts) {
    _googleTentativas++;
    if (_googleTentativas > 10) { _googleTentativas = 0; return; }
    setTimeout(renderizarBotaoGoogle, 300);
    return;
  }
  _googleTentativas = 0;

  container.innerHTML = ''; // evita duplicar a cada abertura

  if (!_googleInicializado) {
    _googleInicializado = true;
    google.accounts.id.initialize({
      client_id: '582254635288-q6v30d14o9d7fhsrejl1il287n6qtnn1.apps.googleusercontent.com',
      callback: handleCredentialResponse
    });
  }

  google.accounts.id.renderButton(container, {
    type: 'standard',
    shape: 'pill',
    theme: 'outline',
    text: 'signin_with',
    size: 'large',
    logo_alignment: 'left',
    width: 260
  });
}

var CHAVE_USUARIOS_EXTRA = null; // (não usado — mantido para compatibilidade)

function carregarUsuarios() {
  var bruto = lerJSON(CHAVE_USUARIOS, []);
  usuarios = Array.isArray(bruto) ? bruto : [];
}
function salvarUsuarios() { gravarJSON(CHAVE_USUARIOS, usuarios); }
function usuarioAtual() {
  var u = lerJSON(CHAVE_LOGADO, null);
  return u && u.email ? u : null;
}
function setUsuarioAtual(u) {
  if (u) gravarJSON(CHAVE_LOGADO, u);
  else { try { localStorage.removeItem(CHAVE_LOGADO); } catch (e) {} }
  atualizarInterfaceConta();
}
function gerarSalt() {
  var arr = new Uint8Array(16);
  try { crypto.getRandomValues(arr); }
  catch (e) { for (var i = 0; i < 16; i++) arr[i] = Math.floor(Math.random() * 256); }
  return Array.from(arr).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
}
function digestFallback(texto) {
  var h = 2166136261;
  for (var i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ('00000000' + (h >>> 0).toString(16)).slice(-8);
}
function hashSenha(senha, salt) {
  if (window.crypto && crypto.subtle && window.TextEncoder) {
    var enc = new TextEncoder();
    return crypto.subtle.importKey('raw', enc.encode(senha), 'PBKDF2', false, ['deriveBits'])
      .then(function (chave) {
        return crypto.subtle.deriveBits(
          { name: 'PBKDF2', salt: enc.encode(salt), iterations: 60000, hash: 'SHA-256' },
          chave, 256
        );
      })
      .then(function (bits) {
        return Array.from(new Uint8Array(bits)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
      });
  }
  return Promise.resolve(digestFallback(senha + '::' + salt));
}
function primeiroNome(nome) {
  return String(nome || '').split(' ')[0] || 'cliente';
}
function atualizarInterfaceConta() {
  var u = usuarioAtual();
  var btn = document.getElementById('loginBtn');
  var btnM = document.getElementById('loginBtnMobile');
  var saudacao = document.getElementById('authSaudacao');
  var nome = document.getElementById('authNome');
  var sair = document.getElementById('authSair');
  if (u) {
    if (btn) btn.style.display = 'none';
    if (btnM) btnM.style.display = 'none';
    if (saudacao) saudacao.style.display = 'inline-flex';
    if (nome) nome.textContent = primeiroNome(u.nome);
    if (sair) sair.style.display = 'inline-flex';
  } else {
    if (btn) btn.style.display = 'inline-flex';
    if (btnM) btnM.style.display = 'block';
    if (saudacao) saudacao.style.display = 'none';
    if (sair) sair.style.display = 'none';
  }
}
function mostrarLogin() {
  var modal = document.getElementById('loginModal');
  if (modal) modal.classList.add('aberto');
  // IMPORTANTE: renderiza o botão do Google DEPOIS que a modal ficou visível
  setTimeout(renderizarBotaoGoogle, 250);
}
function fecharLogin() {
  var modal = document.getElementById('loginModal');
  if (modal) modal.classList.remove('aberto');
}
function mensagemAuth(texto, erro) {
  var el = document.getElementById('authMsg');
  if (!el) return;
  el.textContent = texto || '';
  el.className = 'auth-msg' + (erro ? ' erro' : '');
}
function emailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email);
}
function alternarCadastro() {
  var formC = document.getElementById('formCadastro');
  var formL = document.getElementById('formLoginConta');
  if (!formC || !formL) return;
  var visivel = formC.style.display === 'flex';
  formC.style.display = visivel ? 'none' : 'flex';
  formL.style.display = visivel ? 'flex' : 'none';
  mensagemAuth('');
  var toggle = document.querySelector('.login-toggle');
  if (toggle) {
    toggle.innerHTML = visivel
      ? 'Ainda não tem conta? <a href="#" data-toggle-cadastro>Cadastre-se</a>'
      : 'Já tem conta? <a href="#" data-toggle-cadastro>Entrar</a>';
  }
}
bind('.login-toggle', 'click', function (e) {
  var alvo = e.target;
  if (alvo && (alvo.id === 'btnMostrarCadastro' || alvo.hasAttribute('data-toggle-cadastro'))) {
    e.preventDefault();
    alternarCadastro();
  }
});
bindId('formLoginConta', 'submit', async function (e) {
  e.preventDefault();
  var email = String(document.getElementById('lgEmail').value || '').trim().toLowerCase();
  var senha = document.getElementById('lgSenha') ? document.getElementById('lgSenha').value : '';
  if (!emailValido(email)) { mensagemAuth('Informe um e-mail válido.', true); return; }
  var user = null;
  for (var i = 0; i < usuarios.length; i++) {
    if (usuarios[i].email === email) { user = usuarios[i]; break; }
  }
  if (!user) { mensagemAuth('E-mail ou senha incorretos.', true); return; }
  var ok = false;
  if (user.hash && user.salt) {
    var tentativa = await hashSenha(senha, user.salt);
    ok = tentativa === user.hash;
  } else if (typeof user.senha === 'string') {
    ok = user.senha === senha;
    if (ok) {
      user.salt = gerarSalt();
      user.hash = await hashSenha(senha, user.salt);
      delete user.senha;
      salvarUsuarios();
    }
  }
  if (!ok) { mensagemAuth('E-mail ou senha incorretos.', true); return; }
  setUsuarioAtual({ nome: user.nome, email: user.email });
  mensagemAuth('Bem-vindo(a) de volta, ' + primeiroNome(user.nome) + '!');
  setTimeout(fecharLogin, 900);
});
bindId('formCadastro', 'submit', async function (e) {
  e.preventDefault();
  var nome = String(document.getElementById('cdNome').value || '').trim();
  var email = String(document.getElementById('cdEmail').value || '').trim().toLowerCase();
  var senha = document.getElementById('cdSenha') ? document.getElementById('cdSenha').value : '';
  if (nome.length < 2 || nome.length > 60) { mensagemAuth('Informe seu nome (2 a 60 caracteres).', true); return; }
  if (!emailValido(email)) { mensagemAuth('Informe um e-mail válido.', true); return; }
  if (senha.length < 8) { mensagemAuth('A senha precisa de 8+ caracteres.', true); return; }
  var jaExiste = usuarios.some(function (u) { return u.email === email; });
  if (jaExiste) { mensagemAuth('Este e-mail já está cadastrado. Faça login.', true); return; }
  var salt = gerarSalt();
  var hash = await hashSenha(senha, salt);
  usuarios.push({ nome: nome, email: email, salt: salt, hash: hash, criado_em: new Date().toISOString() });
  salvarUsuarios();
  setUsuarioAtual({ nome: nome, email: email });
  mensagemAuth('Conta criada! Bem-vindo(a), ' + primeiroNome(nome) + '!');
  setTimeout(fecharLogin, 900);
});
bindId('authSair', 'click', function (e) {
  e.preventDefault();
  setUsuarioAtual(null);
});
window.handleCredentialResponse = function (response) {
  mensagemAuth('Autenticando com o Google...');
  fetch('/api/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential: response.credential })
  })
  .then(function (r) {
    return r.json().then(function (dados) {
      if (r.ok && dados.ok) {
        setUsuarioAtual({ nome: dados.nome, email: dados.email });
        mensagemAuth('Bem-vindo(a), ' + primeiroNome(dados.nome) + '! 🎉');
        setTimeout(fecharLogin, 1200);
      } else {
        mensagemAuth(dados.erro || 'Falha na autenticação com o Google.', true);
      }
    });
  })
  .catch(function (err) {
    console.error('Erro no login Google:', err);
    mensagemAuth('Erro ao conectar com o servidor.', true);
  });
};
/* ============================================================
   7. QUADRO DO TOPO
   ============================================================ */
function ajustarQuadroHero(url) {
  var quadro = document.getElementById('heroQuadro');
  if (!quadro) return;
  if (!url) { quadro.style.aspectRatio = '4 / 3'; return; }
  var img = new Image();
  img.onload = function () {
    quadro.style.aspectRatio = ((img.naturalWidth || 4) / (img.naturalHeight || 3)).toFixed(3);
  };
  img.onerror = function () { quadro.style.aspectRatio = '4 / 3'; };
  img.src = url;
}
/* ============================================================
   8. CARROSSEL (SWIPER)
   ============================================================ */
var heroSwiper = null;
var swipersProduto = [];
function destruirSwipersProduto() {
  swipersProduto.forEach(function (s) { try { if (s) s.destroy(true, true); } catch (e) {} });
  swipersProduto = [];
}
function carregarCarrosselHero() {
  return fetchJson('/api/galeria/hero/0')
    .then(function (fotos) {
      var wrapper = document.getElementById('heroSlides');
      if (!wrapper) return;
      fotos = Array.isArray(fotos) ? fotos : [];
      wrapper.innerHTML = '';
      var primeiraUrl = null;
      if (!fotos.length) {
        var heroImg = sanitizarUrl(settings.hero_imagem);
        if (heroImg) {
          primeiraUrl = heroImg;
          wrapper.innerHTML = '<div class="swiper-slide"><img src="' + escapeAttr(heroImg) + '" alt="Foto do topo"></div>';
          var imgUnica = wrapper.querySelector('img');
          if (imgUnica) {
            imgUnica.addEventListener('error', function () {
              this.outerHTML = '<div class="hero-placeholder"><span>🖼️</span><p>Foto indisponível<br>no momento</p></div>';
            });
          }
        } else {
          wrapper.innerHTML = '<div class="swiper-slide"><div class="hero-placeholder"><span>🖼️</span><p>Envie as fotos do carrossel do topo<br>pelo painel admin</p></div></div>';
        }
      } else {
        primeiraUrl = sanitizarUrl(fotos[0].url);
        fotos.forEach(function (f) {
          var url = sanitizarUrl(f.url);
          if (!url) return;
          var slide = document.createElement('div');
          slide.className = 'swiper-slide';
          slide.innerHTML = '<img src="' + escapeAttr(url) + '" alt="Foto do topo">';
          var imgHero = slide.querySelector('img');
          if (imgHero) {
            imgHero.addEventListener('error', function () {
              this.outerHTML = '<div class="hero-placeholder"><span>🖼️</span><p>Foto indisponível<br>no momento</p></div>';
            });
          }
          wrapper.appendChild(slide);
        });
      }
      if (typeof Swiper === 'undefined') return;
      if (heroSwiper) { try { heroSwiper.destroy(true, true); } catch (e) {} heroSwiper = null; }
      heroSwiper = new Swiper('.hero-swiper', {
        loop: fotos.length > 1,
        autoplay: { delay: 3500, disableOnInteraction: false },
        navigation: { nextEl: '.hero-swiper .swiper-button-next', prevEl: '.hero-swiper .swiper-button-prev' },
        pagination: { el: '.hero-swiper .swiper-pagination', clickable: true },
        speed: 600
      });
      ajustarQuadroHero(primeiraUrl);
    })
    .catch(function () {});
}
function carregarCarrosselProduto(id, emojiFallback, fotoUnica, cardEl) {
  if (!cardEl || typeof cardEl.querySelector !== 'function') return;
  var container = cardEl.querySelector('.produto-swiper');
  var wrapper = cardEl.querySelector('.swiper-wrapper');
  if (!container || !wrapper) return;
  return fetchJson('/api/galeria/produto/' + id)
    .then(function (fotos) {
      fotos = Array.isArray(fotos) ? fotos : [];
      wrapper.innerHTML = '';
      if (container.swiper) { try { container.swiper.destroy(true, true); } catch (e) {} delete container.swiper; }
      if (fotos.length > 1) container.classList.add('tem-multiplas');
      else container.classList.remove('tem-multiplas');
      if (!fotos.length) {
        var unica = sanitizarUrl(fotoUnica);
        if (unica) {
          wrapper.innerHTML = '<div class="swiper-slide"><img src="' + escapeAttr(unica) + '" alt="Foto do produto" loading="lazy"></div>';
          /* FALLBACK: se a foto única quebrar, mostra o emoji */
          wrapper.querySelectorAll('img').forEach(function (img) {
            img.addEventListener('error', function () {
              this.outerHTML = '<span>' + (emojiFallback || '🎁') + '</span>';
            });
          });
        }
        else wrapper.innerHTML = '<div class="swiper-slide"><span>' + (emojiFallback || '🎁') + '</span></div>';
        return;
      }
      fotos.forEach(function (f) {
        var url = sanitizarUrl(f.url);
        if (!url) return;
        var slide = document.createElement('div');
        slide.className = 'swiper-slide';
        slide.innerHTML = '<img src="' + escapeAttr(url) + '" alt="Foto do produto" loading="lazy">';
        /* FALLBACK: foto da galeria quebrada vira o emoji da categoria */
        var imgProd = slide.querySelector('img');
        if (imgProd) {
          imgProd.addEventListener('error', function () {
            this.outerHTML = '<span>' + (emojiFallback || '🎁') + '</span>';
          });
        }
        wrapper.appendChild(slide);
      });
      if (typeof Swiper === 'undefined') return;
      container.swiper = new Swiper(container, {
        loop: fotos.length > 1,
        autoplay: fotos.length > 1 ? { delay: 4000, disableOnInteraction: true } : false,
        navigation: { nextEl: container.querySelector('.swiper-button-next'), prevEl: container.querySelector('.swiper-button-prev') },
        pagination: { el: container.querySelector('.swiper-pagination'), clickable: true },
        speed: 500
      });
      swipersProduto.push(container.swiper);
    })
    .catch(function () {});
}
/* ============================================================
   9. CONFIGURAÇÕES (o número do WhatsApp NÃO é lido daqui)
   ============================================================ */
function carregarSettings() {
  return fetchJson('/api/settings')
    .then(function (s) {
      settings = s || {};
      if (s.site_nome) document.title = s.site_nome + ' — Presentes únicos';
      if (s.hero_tag) setTexto('heroTag', s.hero_tag);
      if (s.hero_titulo) {
        var t = document.getElementById('heroTitulo');
        if (t) t.innerHTML = s.hero_titulo;
      }
      if (s.hero_subtitulo) setTexto('heroSubtitulo', s.hero_subtitulo);
      if (s.atendimento) {
        setTexto('textoAtendimento', '⏰ ' + s.atendimento);
        setTexto('textoAtendimentoFooter', '⏰ ' + s.atendimento);
      }
      /* IMPORTANTE: NÃO usa settings.whatsapp para os links — sempre o número fixo */
      atualizarLinksWhats();
      return s;
    })
    .catch(function () { atualizarLinksWhats(); });
}
/* ============================================================
   10. PRODUTOS
   ============================================================ */
function carregarProdutos() {
  return fetchJson('/api/products')
    .then(function (produtos) {
      produtosGlobais = Array.isArray(produtos) ? produtos : [];
      var area = document.getElementById('produtosArea');
      if (!area) return;
      destruirSwipersProduto();
      area.innerHTML = '';
      var ordemCategorias = ['Camisetas','Canecas','Moletons','Quadros','Outros'];
      var emojiCategoria = { 'Camisetas':'👕', 'Canecas':'☕', 'Moletons':'🧥', 'Quadros':'🖼️', 'Outros':'🎁' };
      ordemCategorias.forEach(function (categoria) {
        var daCategoria = produtosGlobais.filter(function (p) { return p.categoria === categoria; });
        if (!daCategoria.length) return;
        var secao = document.createElement('div');
        secao.className = 'categoria-titulo reveal';
        secao.innerHTML = '<span style="font-size:1.6rem;">' + (emojiCategoria[categoria] || '🎁') + '</span><h3>' + escaparHTML(categoria) + '</h3>';
        var grid = document.createElement('div');
        grid.className = 'produtos-grid';
        daCategoria.forEach(function (p) {
          var card = document.createElement('div');
          card.className = 'card reveal';
          var emoji = emojiCategoria[categoria] || '🛍️';
          var fotoUnica = sanitizarUrl(p.foto);
          var fotoHtml = fotoUnica
            ? '<div class="swiper-slide"><img src="' + escapeAttr(fotoUnica) + '" alt="Foto do produto" loading="lazy"></div>'
            : '<div class="swiper-slide"><span>' + emoji + '</span></div>';
          card.innerHTML =
            '<div class="card-foto">' +
              '<div class="swiper produto-swiper"><div class="swiper-wrapper">' + fotoHtml + '</div><div class="swiper-pagination"></div><div class="swiper-button-prev"></div><div class="swiper-button-next"></div></div>' +
            '</div>' +
            '<div class="card-body">' +
              '<h4>' + escaparHTML(p.nome) + '</h4>' +
              '<div class="preco-unt">' + escaparHTML(p.preco) + '</div>' +
              (p.detalhes ? '<div class="patamares">' + formatarPatamares(p.detalhes) + '</div>' : '') +
              (p.brinde ? '<div class="brinde">' + escaparHTML(p.brinde) + '</div>' : '') +
              '<button class="btn" data-produto="' + p.id + '">Adicionar ao carrinho 🛒</button>' +
            '</div>';
          /* FALLBACK: foto principal quebrada vira o emoji da categoria */
          card.querySelectorAll('.produto-swiper img').forEach(function (img) {
            img.addEventListener('error', function () {
              this.outerHTML = '<span>' + emoji + '</span>';
            });
          });
          var btn = card.querySelector('button[data-produto]');
          if (btn) btn.addEventListener('click', function () { carrinho.adicionar(p); });
          grid.appendChild(card);
          carregarCarrosselProduto(p.id, emoji, p.foto, card);
        });
        area.appendChild(secao);
        area.appendChild(grid);
      });
      if (!area.children.length) {
        area.innerHTML = '<p class="carregando-produtos">Nenhum produto cadastrado ainda. Cadastre pelo painel admin.</p>';
      }
      preencherSelectProdutos();
      observarReveal();
    })
    .catch(function () {
      var area = document.getElementById('produtosArea');
      if (area) area.innerHTML = '<p class="carregando-produtos">Não foi possível carregar os produtos.</p>';
    });
}
function preencherSelectProdutos() {
  /* Select do formulário antigo (#pedidoProduto), se existir */
  var sel = document.getElementById('pedidoProduto');
  if (sel) {
    var atual = sel.value;
    sel.innerHTML = '<option value="">Selecione…</option>';
    produtosGlobais.forEach(function (p) {
      var opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.nome + (p.categoria ? ' (' + p.categoria + ')' : '');
      sel.appendChild(opt);
    });
    sel.value = atual;
  }
  /* MELHORIA: também preenche o select do novo formulário (#produto), se existir */
  var novoSel = document.getElementById('produto');
  if (novoSel && produtosGlobais.length) {
    var atualNovo = novoSel.value;
    novoSel.innerHTML = '<option value="" disabled>Selecione o produto...</option>';
    produtosGlobais.forEach(function (p) {
      var opt = document.createElement('option');
      opt.value = p.nome;
      opt.textContent = p.nome;
      novoSel.appendChild(opt);
    });
    if (atualNovo) novoSel.value = atualNovo;
  }
}
/* ============================================================
   11. FORMULÁRIO DE PEDIDO (antigo — mantido por compatibilidade)
   ============================================================ */
var arquivoFoto = null;
bindId('pedidoFoto', 'change', function () {
  var arquivo = this.files[0] || null;
  arquivoFoto = arquivo;
  if (!arquivo) return;
  if (!/^image\//.test(arquivo.type)) {
    alert('Envie apenas imagens (JPG, PNG, WEBP, GIF).');
    this.value = '';
    arquivoFoto = null;
    return;
  }
  if (arquivo.size > 5 * 1024 * 1024) {
    alert('A foto precisa ter no máximo 5MB. Escolha outra.');
    this.value = '';
    arquivoFoto = null;
    return;
  }
  var leitor = new FileReader();
  leitor.onload = function (ev) {
    var img = document.getElementById('previewImg');
    var wrap = document.getElementById('previewWrap');
    if (img) img.src = ev.target.result;
    if (wrap) wrap.style.display = 'block';
  };
  leitor.readAsDataURL(arquivoFoto);
});
bindId('btnRemoverFoto', 'click', function () {
  arquivoFoto = null;
  var foto = document.getElementById('pedidoFoto');
  var wrap = document.getElementById('previewWrap');
  if (foto) foto.value = '';
  if (wrap) wrap.style.display = 'none';
});
bindId('formPedido', 'submit', async function (e) {
  e.preventDefault();
  var getVal = function (id) {
    var el = document.getElementById(id);
    return el ? el.value : '';
  };
  var nome = getVal('pedidoNome').trim();
  var whats = getVal('pedidoWhats').trim();
  var produto = getVal('pedidoProduto');
  var quantidade = Math.max(1, Math.min(999, parseInt(getVal('pedidoQuantidade'), 10) || 1));
  var tamanho = getVal('pedidoTamanho');
  var texto = getVal('pedidoTexto').trim();
  if (!nome) { alert('Informe seu nome.'); return; }
  var telefone = whats.replace(/\D/g, '');
  if (telefone.length < 10 || telefone.length > 13) {
    alert('Informe um WhatsApp válido com DDD (ex: (51) 94222-2647).');
    return;
  }
  if (!produto) { alert('Selecione um produto.'); return; }
  if (texto.length > 600) { alert('A mensagem pode ter no máximo 600 caracteres.'); return; }
  var dados = {
    nome: nome.slice(0, 60),
    whatsapp: whats.slice(0, 20),
    produto: produto,
    quantidade: quantidade,
    tamanho: tamanho.slice(0, 10),
    texto: texto.slice(0, 600)
  };
  var btn = e.target.querySelector('button[type="submit"]');
  if (!btn) return;
  btn.disabled = true;
  btn.textContent = 'Enviando…';
  try {
    await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados)
    });
    var msg = document.getElementById('msgSucesso');
    if (msg) msg.style.display = 'block';
    e.target.reset();
    arquivoFoto = null;
    var wrap = document.getElementById('previewWrap');
    if (wrap) wrap.style.display = 'none';
    setTimeout(function () { if (msg) msg.style.display = 'none'; }, 6000);
  } catch (err) {
    alert('Não foi possível enviar o pedido. Tente novamente ou chame no WhatsApp.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Enviar pedido pelo site 🚀';
  }
});
/* ============================================================
   11b. NOVO FORMULÁRIO "VAMOS CRIAR JUNTOS" (MELHORIA)
   — drag & drop de foto + pedido organizado no WhatsApp
   — também tenta salvar no painel admin sem bloquear o envio
   ============================================================ */
(function () {
  var dropZone = document.getElementById('drop-zone');
  var fileInput = document.getElementById('file-input');
  var statusText = document.getElementById('upload-status-text');
  var formPersonalizado = document.getElementById('form-personalizado');
  if (!formPersonalizado) return;
  function atualizarStatusArquivo(arquivo) {
    if (!statusText || !arquivo) return;
    if (!/^image\//.test(arquivo.type)) {
      statusText.innerHTML = '⚠️ Envie apenas imagens (JPG, PNG, WEBP, GIF)';
      if (fileInput) fileInput.value = '';
      return;
    }
    if (arquivo.size > 5 * 1024 * 1024) {
      statusText.innerHTML = '⚠️ A foto precisa ter no máximo 5MB';
      if (fileInput) fileInput.value = '';
      return;
    }
    statusText.innerHTML = '✅ ' + escaparHTML(arquivo.name);
  }
  if (dropZone && fileInput) {
    dropZone.addEventListener('click', function () { fileInput.click(); });
    ['dragenter','dragover'].forEach(function (ev) {
      dropZone.addEventListener(ev, function (e) {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('dragover');
      }, false);
    });
    ['dragleave','drop'].forEach(function (ev) {
      dropZone.addEventListener(ev, function (e) {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('dragover');
      }, false);
    });
    dropZone.addEventListener('drop', function (e) {
      var arquivos = e.dataTransfer ? e.dataTransfer.files : null;
      if (arquivos && arquivos.length > 0) {
        fileInput.files = arquivos;
        atualizarStatusArquivo(arquivos[0]);
      }
    });
    fileInput.addEventListener('change', function () {
      if (this.files && this.files.length > 0) atualizarStatusArquivo(this.files[0]);
    });
  }
  formPersonalizado.addEventListener('submit', async function (e) {
    e.preventDefault();
    var getVal = function (id) {
      var el = document.getElementById(id);
      return el ? el.value : '';
    };
    var nome = getVal('nome').trim();
    var whats = getVal('whatsapp').trim();
    var produto = getVal('produto').trim();
    var quantidade = Math.max(1, Math.min(999, parseInt(getVal('quantidade'), 10) || 1));
    var tamanho = getVal('tamanho').trim() || 'Não se aplica';
    var mensagem = getVal('mensagem').trim();
    if (nome.length < 2) { alert('Informe seu nome.'); return; }
    var telefone = whats.replace(/\D/g, '');
    if (telefone.length < 10 || telefone.length > 13) {
      alert('Informe um WhatsApp válido com DDD (ex: (51) 94222-2647).');
      return;
    }
    if (!produto) { alert('Selecione um produto.'); return; }
    if (!mensagem) { alert('Escreva a mensagem ou tema da personalização.'); return; }
    var arquivo = fileInput && fileInput.files && fileInput.files.length > 0 ? fileInput.files[0] : null;
    /* Mensagem organizada para o WhatsApp */
    var linhas = [
      'Olá! Vim pelo site da CASAL PERSONALIZADOS e quero fazer um pedido personalizado :)',
      '',
      '👤 Nome: ' + nome,
      '📱 WhatsApp: ' + whats,
      '🛍️ Produto: ' + produto,
      '🔢 Quantidade: ' + quantidade,
      '📏 Tamanho: ' + tamanho,
      '💬 Mensagem/Tema: ' + mensagem
    ];
    if (arquivo) linhas.push('📎 Foto/referência: "' + arquivo.name + '" (enviarei a imagem no chat)');
    var textoFinal = linhas.join('\n');
    var btn = e.target.querySelector('button[type="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }
    try {
      /* 1) tenta salvar no painel admin (não bloqueia o envio) */
      await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: nome.slice(0, 60),
          whatsapp: whats.slice(0, 20),
          produto: produto,
          quantidade: quantidade,
          tamanho: tamanho,
          texto: mensagem.slice(0, 600)
        })
      }).catch(function () {});
      /* 2) abre o WhatsApp com o pedido organizado */
      abrirWhatsApp(textoFinal, whatsappPadrao);
      formPersonalizado.reset();
      if (statusText) statusText.textContent = 'Clique para anexar ou arraste sua foto aqui';
    } catch (err) {
      /* se qualquer coisa falhar, mesmo assim abre o WhatsApp */
      abrirWhatsApp(textoFinal, whatsappPadrao);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Enviar Pedido para Análise'; }
    }
  });
})();
/* ============================================================
   12. AVALIAÇÕES
   ============================================================ */
var notaEscolhida = 5;
var selecaoEstrelas = document.getElementById('selecaoEstrelas');
if (selecaoEstrelas) {
  selecaoEstrelas.querySelectorAll('span').forEach(function (span) {
    span.addEventListener('click', function () {
      notaEscolhida = Math.max(1, Math.min(5, parseInt(this.dataset.valor, 10) || 5));
      selecaoEstrelas.querySelectorAll('span').forEach(function (s) {
        s.classList.toggle('atual', parseInt(s.dataset.valor, 10) <= notaEscolhida);
      });
    });
  });
}
function carregarAvaliacoes() {
  return fetchJson('/api/reviews')
    .then(function (avaliacoes) {
      avaliacoes = Array.isArray(avaliacoes) ? avaliacoes : [];
      var grid = document.getElementById('avaliacoesGrid');
      if (!grid) return;
      grid.innerHTML = '';
      if (!avaliacoes.length) {
        grid.innerHTML = '<p style="text-align:center;color:#8d7a5e;grid-column:1/-1;font-weight:700;">Seja o primeiro a avaliar! 💛</p>';
        setTexto('mediaNum', '5,0');
        setTexto('mediaEstrelas', '★★★★★');
        setTexto('mediaCount', '0 avaliações');
        return;
      }
      var soma = 0;
      avaliacoes.forEach(function (a) {
        soma += Math.max(1, Math.min(5, Number(a.estrelas) || 5));
      });
      var media = soma / avaliacoes.length;
      var arredondada = Math.round(media);
      setTexto('mediaNum', media.toFixed(1).replace('.', ','));
      setTexto('mediaEstrelas', '★'.repeat(arredondada) + '☆'.repeat(5 - arredondada));
      setTexto('mediaCount', avaliacoes.length + (avaliacoes.length === 1 ? ' avaliação' : ' avaliações'));
      avaliacoes.forEach(function (a) {
        var estrelas = Math.max(1, Math.min(5, Number(a.estrelas) || 5));
        var div = document.createElement('div');
        div.className = 'avaliacao reveal';
        div.innerHTML =
          '<div class="estrelas">' + '★'.repeat(estrelas) + '☆'.repeat(5 - estrelas) + '</div>' +
          '<p class="comentario">"' + escaparHTML(a.comentario) + '"</p>' +
          '<div class="autor">' + escaparHTML(a.nome) + '</div>' +
          (a.data ? '<div class="data">' + escaparHTML(a.data) + '</div>' : '');
        grid.appendChild(div);
      });
      observarReveal();
    })
    .catch(function () {});
}
bindId('formAvaliacao', 'submit', async function (e) {
  e.preventDefault();
  var nome = String((document.getElementById('avNome') || {}).value || '').trim();
  var comentario = String((document.getElementById('avComentario') || {}).value || '').trim();
  var estrelas = Math.max(1, Math.min(5, notaEscolhida || 5));
  if (nome.length < 2 || nome.length > 60) { alert('Informe seu nome (2 a 60 caracteres).'); return; }
  if (!comentario) { alert('Escreva um comentário.'); return; }
  if (comentario.length > 1000) { alert('O comentário pode ter no máximo 1000 caracteres.'); return; }
  try {
    await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: nome.slice(0, 60), estrelas: estrelas, comentario: comentario.slice(0, 1000) })
    });
    e.target.reset();
    var titulo = e.target.querySelector('h3');
    if (titulo) titulo.textContent = '✅ Avaliação enviada! Obrigado 💛';
    setTimeout(function () {
      if (titulo) titulo.textContent = 'Deixe sua avaliação 💛';
      notaEscolhida = 5;
      if (selecaoEstrelas) {
        selecaoEstrelas.querySelectorAll('span').forEach(function (s) {
          s.classList.toggle('atual', parseInt(s.dataset.valor, 10) <= 5);
        });
      }
    }, 6000);
  } catch (err) {
    alert('Não foi possível enviar a avaliação. Tente novamente.');
  }
});
/* ============================================================
   13. HEADER / MENU MOBILE / ANIMAÇÕES
   ============================================================ */
window.addEventListener('scroll', debounce(function () {
  var header = document.getElementById('header');
  if (header) header.classList.toggle('scrolled', window.scrollY > 40);
}, 80), { passive: true });
bindId('hamburger', 'click', function () {
  var menu = document.getElementById('menuMobile');
  if (menu) menu.classList.toggle('open');
});
var linksMenuMobile = document.querySelectorAll('nav.mobile a');
linksMenuMobile.forEach(function (a) {
  a.addEventListener('click', function () {
    var menu = document.getElementById('menuMobile');
    if (menu) menu.classList.remove('open');
  });
});
var observerReveal = null;
function observarReveal() {
  var itens = document.querySelectorAll('.reveal:not(.visible)');
  if (!itens.length) return;
  if (!observerReveal) {
    observerReveal = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (entrada) {
        if (entrada.isIntersecting) {
          entrada.target.classList.add('visible');
          observerReveal.unobserve(entrada.target);
        }
      });
    }, { threshold: 0.12 });
  }
  itens.forEach(function (item) { observerReveal.observe(item); });
}
/* ============================================================
   14. LIGHTBOX — MELHORADO: produtos + carrossel do topo (hero)
   ============================================================ */
var lightboxEl = document.getElementById('lightbox');
var lightboxImg = document.getElementById('lightboxImg');
var lightboxFotos = [];
var lightboxIndex = 0;
function lightboxAberto() {
  return lightboxEl && lightboxEl.style.display === 'flex';
}
function atualizarLightbox() {
  if (!lightboxFotos.length || !lightboxImg) return;
  if (lightboxIndex < 0) lightboxIndex = lightboxFotos.length - 1;
  if (lightboxIndex >= lightboxFotos.length) lightboxIndex = 0;
  lightboxImg.src = lightboxFotos[lightboxIndex];
  var prev = document.getElementById('lbPrev');
  var next = document.getElementById('lbNext');
  var cont = document.getElementById('lbContador');
  if (prev) prev.style.display = lightboxFotos.length > 1 ? 'flex' : 'none';
  if (next) next.style.display = lightboxFotos.length > 1 ? 'flex' : 'none';
  if (cont) cont.textContent = (lightboxIndex + 1) + ' / ' + lightboxFotos.length;
}
function abrirLightbox(fotos, indice) {
  lightboxFotos = Array.isArray(fotos) ? fotos : [];
  if (!lightboxFotos.length || !lightboxEl) return;
  lightboxIndex = indice || 0;
  atualizarLightbox();
  lightboxEl.style.display = 'flex';
  travarScroll();
}
function fecharLightbox() {
  if (!lightboxEl) return;
  lightboxEl.style.display = 'none';
  destravarScroll();
  if (lightboxImg) lightboxImg.src = '';
  lightboxFotos = [];
}
bindId('lbFechar', 'click', fecharLightbox);
bindId('lbPrev', 'click', function () { lightboxIndex--; atualizarLightbox(); });
bindId('lbNext', 'click', function () { lightboxIndex++; atualizarLightbox(); });
if (lightboxEl) {
  lightboxEl.addEventListener('click', function (e) { if (e.target === lightboxEl) fecharLightbox(); });
}
document.addEventListener('keydown', function (e) {
  if (!lightboxAberto()) return;
  if (e.key === 'Escape') fecharLightbox();
  if (e.key === 'ArrowLeft') { lightboxIndex--; atualizarLightbox(); }
  if (e.key === 'ArrowRight') { lightboxIndex++; atualizarLightbox(); }
});
/* Detecta se a imagem clicada pertence ao carrossel de produto ou ao do topo */
function carrosselDaImagem(img) {
  if (!img || !img.closest) return null;
  if (img.closest('.produto-swiper')) return '.produto-swiper';
  if (img.closest('.hero-swiper')) return '.hero-swiper';
  return null;
}
var arrastoLightbox = null;
document.addEventListener('pointerdown', function (e) {
  var seletor = carrosselDaImagem(e.target);
  if (seletor) arrastoLightbox = { x: e.clientX, y: e.clientY };
}, true);
document.addEventListener('click', function (e) {
  var seletor = carrosselDaImagem(e.target);
  if (!seletor) return;
  if (arrastoLightbox) {
    if (Math.abs(e.clientX - arrastoLightbox.x) > 5 || Math.abs(e.clientY - arrastoLightbox.y) > 5) {
      arrastoLightbox = null;
      return;
    }
    arrastoLightbox = null;
  }
  var swiperEl = e.target.closest(seletor);
  if (!swiperEl) return;
  var fotos = [];
  swiperEl.querySelectorAll('.swiper-slide img').forEach(function (fotoEl) {
    if (fotos.indexOf(fotoEl.src) === -1) fotos.push(fotoEl.src);
  });
  abrirLightbox(fotos, Math.max(0, fotos.indexOf(e.target.src)));
});
/* ============================================================
   15. EVENTOS DO CARRINHO
   ============================================================ */
bindId('cartBtn', 'click', function (e) { e.preventDefault(); carrinho.abrir(); });
bindId('cartBtnMobile', 'click', function (e) { e.preventDefault(); carrinho.abrir(); });
bindId('cartBtnApp', 'click', function (e) { e.preventDefault(); carrinho.abrir(); });
bindId('cartFechar', 'click', function () { carrinho.fechar(); });
bindId('cartOverlay', 'click', function (e) {
  if (e.target === this) carrinho.fechar();
});
bindId('btnFinalizarCart', 'click', function () { carrinho.finalizarWhats(); });
/* ============================================================
   16. EVENTOS DO LOGIN
   ============================================================ */
bindId('loginBtn', 'click', function (e) { e.preventDefault(); mostrarLogin(); });
bindId('loginBtnMobile', 'click', function (e) { e.preventDefault(); mostrarLogin(); });
bindId('loginFechar', 'click', fecharLogin);
bindId('loginModal', 'click', function (e) { if (e.target === this) fecharLogin(); });
/* ============================================================
   17. INICIALIZAÇÃO
   ============================================================ */
function iniciar() {
  setTexto('anoAtual', new Date().getFullYear());
  carregarUsuarios();
  carrinho.carregar();
  carrinho.renderizar();
  atualizarInterfaceConta();
  observarReveal();
  carregarSettings().then(function () {
    carregarProdutos();
    carregarCarrosselHero();
  });
  carregarAvaliacoes();
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciar);
} else {
  iniciar();
}