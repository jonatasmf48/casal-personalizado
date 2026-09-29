/* =========================================================
   CASAL PERSONALIZADOS — Frontend (carrega dados da API)
   ========================================================= */
let WHATSAPP_NUMBER = '5511999999999';
let SITE_NOME = 'Casal Personalizados';

/* ---------- Carrega configurações ---------- */
async function carregarSettings() {
  try {
    const r = await fetch('/api/settings');
    const s = await r.json();
    WHATSAPP_NUMBER = s.whatsapp || WHATSAPP_NUMBER;
    SITE_NOME = s.site_nome || SITE_NOME;
    if (s.hero_tag) document.getElementById('heroTag').textContent = s.hero_tag;
    if (s.hero_titulo) document.getElementById('heroTitulo').innerHTML = s.hero_titulo;
    if (s.hero_subtitulo) document.getElementById('heroSubtitulo').textContent = s.hero_subtitulo;
    if (s.brinde_destaque) document.getElementById('brindeDestaque').innerHTML = s.brinde_destaque;
    if (s.site_slogan) {
      document.getElementById('brandFallback').innerHTML = s.site_slogan + '<small>Atelier de Personalizados</small>';
      document.getElementById('footerNome').textContent = s.site_slogan;
    }
    document.getElementById('rodapeNome').textContent = SITE_NOME;
    if (s.hero_imagem) {
      document.getElementById('heroImagem').src = s.hero_imagem;
      document.getElementById('heroImagem').style.display = 'block';
      document.getElementById('heroPlaceholder').style.display = 'none';
    }
  } catch (e) { console.warn('Não foi possível carregar configurações.'); }
}

/* ---------- Carrega produtos ---------- */
async function carregarProdutos() {
  try {
    const r = await fetch('/api/products');
    const produtos = await r.json();
    const container = document.getElementById('produtosContainer');
    container.innerHTML = '';
    const categorias = {};
    produtos.forEach(p => {
      if (!categorias[p.categoria]) categorias[p.categoria] = [];
      categorias[p.categoria].push(p);
    });
    const icones = { 'Camisetas': '👕', 'Canecas': '☕', 'Moletons': '🧥', 'Quadros': '🖼️' };
    Object.keys(categorias).forEach(cat => {
      const bloco = document.createElement('div');
      bloco.innerHTML = '<div class="categoria-titulo reveal"><h3>' + (icones[cat] || '📦') + ' ' + cat + '</h3></div>';
      const grid = document.createElement('div');
      grid.className = 'produtos-grid';
      categorias[cat].forEach(p => {
        const card = document.createElement('article');
        card.className = 'card reveal';
        const foto = p.foto
          ? '<img src="' + p.foto + '" alt="' + p.nome + '" style="height:170px;width:100%;object-fit:cover;">'
          : '<div class="card-foto"><span>' + (icones[cat] || '📦') + '</span>Foto do produto aqui</div>';
        card.innerHTML = foto +
          '<div class="card-body">' +
            '<h4>' + p.nome + '</h4>' +
            '<div class="preco-unt">' + p.preco + '</div>' +
            (p.detalhes ? '<div class="patamares">' + p.detalhes + '</div>' : '') +
            (p.brinde ? '<div class="brinde">' + p.brinde + '</div>' : '') +
            '<button class="btn" type="button" onclick="pedirProduto(\'' + p.nome.replace(/'/g, "\'") + '\')">Pedir este produto</button>' +
          '</div>';
        grid.appendChild(card);
      });
      bloco.appendChild(grid);
      container.appendChild(bloco);
    });
    const select = document.getElementById('produto');
    select.innerHTML = '<option value="">Selecione...</option>';
    produtos.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.nome;
      opt.textContent = p.nome;
      select.appendChild(opt);
    });
  } catch (e) { console.warn('Não foi possível carregar produtos.'); }
}

/* ---------- Carrega avaliações ---------- */
async function carregarAvaliacoes() {
  try {
    const r = await fetch('/api/reviews');
    const lista = await r.json();
    const destino = document.getElementById('listaAvaliacoes');
    destino.innerHTML = '';
    if (!lista.length) {
      const p = document.createElement('p');
      p.style.textAlign = 'center';
      p.style.color = '#8d7a5e';
      p.textContent = 'Seja o primeiro a avaliar! 💛';
      destino.appendChild(p);
    } else {
      lista.forEach(a => {
        const div = document.createElement('div');
        div.className = 'avaliacao';
        const est = document.createElement('div');
        est.className = 'estrelas';
        est.textContent = '★'.repeat(a.estrelas) + '☆'.repeat(5 - a.estrelas);
        const com = document.createElement('p');
        com.className = 'comentario';
        com.textContent = '"' + a.comentario + '"';
        const autor = document.createElement('div');
        autor.className = 'autor';
        autor.textContent = a.nome;
        const data = document.createElement('div');
        data.className = 'data';
        data.textContent = a.data || '';
        div.appendChild(est); div.appendChild(com); div.appendChild(autor); div.appendChild(data);
        destino.appendChild(div);
      });
    }
    let media = 0;
    if (lista.length) {
      const soma = lista.reduce((acc, a) => acc + a.estrelas, 0);
      media = soma / lista.length;
    }
    document.getElementById('mediaNum').textContent = media.toFixed(1).replace('.', ',');
    document.getElementById('mediaEstrelas').textContent = '★'.repeat(Math.round(media)) + '☆'.repeat(5 - Math.round(media));
  } catch (e) { console.warn('Não foi possível carregar avaliações.'); }
}

/* ---------- WhatsApp ---------- */
function abrirWhatsAppGeral() {
  const msg = 'Olá! Vim pelo site do ' + SITE_NOME + ' 😊 Quero fazer um pedido.';
  window.open('https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(msg), '_blank', 'noopener');
}
function pedirProduto(nome) {
  document.getElementById('produto').value = nome;
  window.location.hash = '#pedido';
}

/* ---------- Upload de foto ---------- */
let fotoSelecionada = false;
document.getElementById('arquivoFoto').addEventListener('change', function (e) {
  const arquivo = e.target.files[0];
  if (!arquivo) return;
  if (arquivo.type.indexOf('image/') !== 0) { alert('Envie apenas imagens (JPG, PNG, WEBP).'); this.value = ''; return; }
  if (arquivo.size > 10 * 1024 * 1024) { alert('Imagem muito grande. Envie até 10MB.'); this.value = ''; return; }
  const leitor = new FileReader();
  leitor.onload = function (ev) {
    document.getElementById('previewImg').src = ev.target.result;
    document.getElementById('previewWrap').style.display = 'block';
    fotoSelecionada = true;
  };
  leitor.readAsDataURL(arquivo);
});
function removerFoto() {
  document.getElementById('arquivoFoto').value = '';
  document.getElementById('previewWrap').style.display = 'none';
  fotoSelecionada = false;
}

/* ---------- Envio do pedido ---------- */
document.getElementById('formPedido').addEventListener('submit', async function (e) {
  e.preventDefault();
  const produto = document.getElementById('produto').value;
  const quantidade = document.getElementById('quantidade').value || '1';
  const tamanho = document.getElementById('tamanho').value;
  const cor = document.getElementById('cor').value.trim();
  const texto = document.getElementById('texto').value.trim();
  const nome = document.getElementById('nome').value.trim();
  if (!produto) { alert('Escolha o produto.'); return; }
  if (!nome) { alert('Digite seu nome.'); return; }

  try {
    await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, produto, quantidade, tamanho, cor, texto })
    });
  } catch (err) { }

  const linhas = ['Olá! Vim pelo site do ' + SITE_NOME + ' 😊', 'Quero um pedido personalizado:',
    '• Produto: ' + produto, '• Quantidade: ' + quantidade];
  if (tamanho) linhas.push('• Tamanho: ' + tamanho);
  if (cor) linhas.push('• Cor: ' + cor);
  if (texto) linhas.push('• O que quero nele: ' + texto);
  if (fotoSelecionada) linhas.push('• Já escolhi a foto e vou enviá-la aqui no chat em seguida 📸');
  linhas.push('• Meu nome: ' + nome);
  window.open('https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(linhas.join('\n')), '_blank', 'noopener');
});

/* ---------- Envio de avaliação ---------- */
let notaEscolhida = 0;
document.querySelectorAll('#selecaoEstrelas span').forEach(span => {
  span.addEventListener('click', function () {
    notaEscolhida = parseInt(span.getAttribute('data-v'), 10);
    document.querySelectorAll('#selecaoEstrelas span').forEach(s => {
      s.classList.toggle('atual', parseInt(s.getAttribute('data-v'), 10) <= notaEscolhida);
    });
  });
});
document.getElementById('formAvaliacao').addEventListener('submit', async function (e) {
  e.preventDefault();
  const nome = document.getElementById('avNome').value.trim();
  const comentario = document.getElementById('avComentario').value.trim();
  if (!notaEscolhida) { alert('Escolha uma nota (1 a 5 estrelas).'); return; }
  if (!nome || !comentario) { alert('Preencha seu nome e comentário.'); return; }
  try {
    const r = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, comentario, estrelas: notaEscolhida })
    });
    const resp = await r.json();
    alert(resp.mensagem || 'Obrigado!');
  } catch (err) { alert('Não foi possível enviar. Tente novamente.'); }
  this.reset();
  notaEscolhida = 0;
  document.querySelectorAll('#selecaoEstrelas span').forEach(s => s.classList.remove('atual'));
});

/* ---------- Menu e animações ---------- */
function fecharMenu() { document.getElementById('menuMobile').classList.remove('open'); }
window.addEventListener('scroll', function () {
  document.getElementById('header').classList.toggle('scrolled', window.scrollY > 10);
});
const observador = new IntersectionObserver(function (entradas) {
  entradas.forEach(function (entrada) {
    if (entrada.isIntersecting) { entrada.target.classList.add('visible'); observador.unobserve(entrada.target); }
  });
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach(el => observador.observe(el));
document.getElementById('ano').textContent = new Date().getFullYear();

/* ---------- Inicializa ---------- */
carregarSettings();
carregarProdutos();
carregarAvaliacoes();