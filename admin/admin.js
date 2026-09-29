/* =========================================================
   CASAL PERSONALIZADOS — Painel Admin (frontend)
   ========================================================= */
const api = {
  async req(url, metodo, corpo) {
    const opcoes = { method: metodo, headers: { 'Content-Type': 'application/json' } };
    if (corpo) opcoes.body = JSON.stringify(corpo);
    let resp;
    try {
      resp = await fetch(url, opcoes);
    } catch (err) {
      alert('Falha de conexão com o servidor. Confira se o npm start está rodando.');
      throw err;
    }
    if (resp.status === 401) {
      alert('Sessão expirada. Faça login novamente.');
      mostrarLogin();
      throw new Error('Sessão expirada');
    }
    let dados;
    try {
      dados = await resp.json();
    } catch (err) {
      alert('Resposta inválida do servidor (status ' + resp.status + '). Reinicie o servidor.');
      throw err;
    }
    return dados;
  }
};

/* ---------- LOGIN / SESSÃO ---------- */
function mostrarLogin() {
  document.getElementById('telaLogin').style.display = 'flex';
  document.getElementById('painel').style.display = 'none';
}
function mostrarPainel() {
  document.getElementById('telaLogin').style.display = 'none';
  document.getElementById('painel').style.display = 'block';
  carregarTudo();
}
document.getElementById('formLogin').addEventListener('submit', async function (e) {
  e.preventDefault();
  const usuario = document.getElementById('loginUsuario').value.trim();
  const senha = document.getElementById('loginSenha').value;
  try {
    const r = await api.req('/api/admin/login', 'POST', { usuario, senha });
    if (r.ok) mostrarPainel();
    else document.getElementById('erroLogin').textContent = r.erro || 'Falha no login.';
  } catch (err) {
    document.getElementById('erroLogin').textContent = 'Erro de conexão. Tente novamente.';
  }
});
async function sair() {
  await api.req('/api/admin/logout', 'POST');
  mostrarLogin();
}

(async function checarSessao() {
  try {
    const r = await api.req('/api/admin/me', 'GET');
    if (r.usuario) mostrarPainel(); else mostrarLogin();
  } catch (e) { mostrarLogin(); }
})();

/* ---------- ABAS ---------- */
document.querySelectorAll('.aba').forEach(aba => {
  aba.addEventListener('click', function () {
    document.querySelectorAll('.aba').forEach(a => a.classList.remove('ativa'));
    this.classList.add('ativa');
    document.querySelectorAll('.conteudo-aba').forEach(s => s.classList.remove('ativa'));
    document.getElementById('aba-' + this.dataset.aba).classList.add('ativa');
  });
});

/* ---------- CARREGAR TUDO ---------- */
async function carregarTudo() {
  carregarPedidos();
  carregarProdutosAdmin();
  carregarAvaliacoesAdmin();
  carregarConfig();
}

/* ---------- PEDIDOS ---------- */
async function carregarPedidos() {
  try {
    const pedidos = await api.req('/api/admin/orders', 'GET');
    const lista = document.getElementById('listaPedidos');
    lista.innerHTML = '';
    if (!pedidos.length) {
      lista.innerHTML = '<p class="empty">Nenhum pedido recebido ainda. Os pedidos do site aparecem aqui.</p>';
      return;
    }
    document.getElementById('badgePedidos').style.display = pedidos.filter(p => p.status === 'novo').length ? 'inline' : 'none';
    document.getElementById('badgePedidos').textContent = pedidos.filter(p => p.status === 'novo').length;
    const classes = { 'novo':'status-novo', 'em producao':'status-emproducao', 'enviado':'status-enviado', 'concluido':'status-concluido', 'cancelado':'status-cancelado' };
    const rotulos = { 'novo':'🆕 Novo', 'em producao':'🔧 Em produção', 'enviado':'📬 Enviado', 'concluido':'✅ Concluído', 'cancelado':'❌ Cancelado' };
    pedidos.forEach(p => {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = '<h3>#' + p.id + ' — ' + p.nome + '</h3>' +
        '<p><strong>' + p.produto + '</strong> · Qtd: ' + p.quantidade + (p.tamanho ? ' · Tam: ' + p.tamanho : '') + (p.cor ? ' · Cor: ' + p.cor : '') + '</p>' +
        (p.texto ? '<p>📝 ' + p.texto + '</p>' : '') +
        '<div class="meta"><span>' + p.criado_em + '</span><span class="pedido-status ' + (classes[p.status] || 'status-novo') + '">' + (rotulos[p.status] || p.status) + '</span></div>' +
        '<div class="acoes">' +
        '<button type="button" class="btn btn-outline" onclick="mudarStatus(' + p.id + ',\'em producao\')">Em produção</button>' +
        '<button type="button" class="btn btn-outline" onclick="mudarStatus(' + p.id + ',\'enviado\')">Enviado</button>' +
        '<button type="button" class="btn btn-verde" onclick="mudarStatus(' + p.id + ',\'concluido\')">Concluído</button>' +
        '<button type="button" class="btn btn-vermelho" onclick="mudarStatus(' + p.id + ',\'cancelado\')">Cancelar</button>' +
        '<button type="button" class="btn btn-vermelho" onclick="excluirPedido(' + p.id + ')">Excluir</button></div>';
      lista.appendChild(card);
    });
  } catch (e) { console.error('Pedidos:', e); }
}
async function mudarStatus(id, status) {
  await api.req('/api/admin/orders/' + id, 'PUT', { status });
  carregarPedidos();
}
async function excluirPedido(id) {
  if (!confirm('Excluir este pedido?')) return;
  try {
    const r = await api.req('/api/admin/orders/' + id, 'DELETE');
    if (r.ok) { alert('✅ Pedido excluído.'); carregarPedidos(); }
  } catch (err) { console.error('Falha ao excluir pedido', id, err); }
}

/* ---------- PRODUTOS ---------- */
async function carregarProdutosAdmin() {
  try {
    const produtos = await api.req('/api/admin/products', 'GET');
    const lista = document.getElementById('listaProdutos');
    lista.innerHTML = '';
    if (!produtos.length) {
      lista.innerHTML = '<p class="empty">Nenhum produto. Adicione o primeiro acima.</p>';
      return;
    }
    produtos.forEach(p => {
      const card = document.createElement('div');
      card.className = 'card';
      const fotoMini = p.foto
        ? '<img src="' + p.foto + '" alt="' + p.nome + '" style="height:60px;width:60px;object-fit:cover;border-radius:8px;margin-bottom:6px;">'
        : '';
      card.innerHTML = fotoMini +
        '<h3>' + p.nome + ' <small style="color:#8d7a5e;font-weight:600;">(' + p.categoria + ')</small></h3>' +
        '<p><strong>' + p.preco + '</strong>' + (p.brinde ? ' · ' + p.brinde : '') + '</p>' +
        '<div class="acoes">' +
        '<button type="button" class="btn btn-outline" onclick="editarProduto(' + p.id + ')">Editar</button>' +
        '<button type="button" class="btn btn-vermelho" onclick="excluirProduto(' + p.id + ')">Excluir</button></div>';
      lista.appendChild(card);
    });
  } catch (e) { console.error('Produtos:', e); }
}

async function editarProduto(id) {
  let produtos;
  try {
    produtos = await api.req('/api/admin/products', 'GET');
  } catch (e) {
    alert('Sessão expirada ou erro de conexão. Faça login novamente.');
    return;
  }
  const p = produtos.find(x => Number(x.id) === Number(id));
  if (!p) { alert('Produto não encontrado.'); return; }

  document.getElementById('produtoId').value = p.id;
  document.getElementById('pCategoria').value = p.categoria;
  document.getElementById('pNome').value = p.nome;
  document.getElementById('pPreco').value = p.preco;
  document.getElementById('pDetalhes').value = p.detalhes || '';
  document.getElementById('pBrinde').value = p.brinde || '';
  document.getElementById('pFoto').value = p.foto || '';

  const preview = document.getElementById('pPreviewFoto');
  const btnRemover = document.getElementById('btnRemoverPreviewFoto');
  if (p.foto) {
    preview.src = p.foto;
    preview.style.display = 'block';
    btnRemover.style.display = 'inline-flex';
  } else {
    preview.style.display = 'none';
    btnRemover.style.display = 'none';
  }

  document.getElementById('tituloFormProduto').textContent = '✏️ Editando: ' + p.nome;
  document.getElementById('btnCancelarProduto').style.display = 'inline-flex';
  document.getElementById('btnSalvarProduto').textContent = 'Salvar alterações';
  document.getElementById('aba-produtos').scrollIntoView({ behavior: 'smooth' });
}

function cancelarEdicaoProduto() {
  document.getElementById('formProduto').reset();
  document.getElementById('produtoId').value = '';
  document.getElementById('tituloFormProduto').textContent = '➕ Novo produto';
  document.getElementById('btnCancelarProduto').style.display = 'none';
  document.getElementById('btnSalvarProduto').textContent = 'Salvar produto';
  document.getElementById('pPreviewFoto').style.display = 'none';
  document.getElementById('btnRemoverPreviewFoto').style.display = 'none';
}

document.getElementById('pArquivoFoto').addEventListener('change', function () {
  const f = this.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = e => {
    document.getElementById('pPreviewFoto').src = e.target.result;
    document.getElementById('pPreviewFoto').style.display = 'block';
    document.getElementById('btnRemoverPreviewFoto').style.display = 'inline-flex';
  };
  r.readAsDataURL(f);
});
function removerPreviewFoto() {
  document.getElementById('pArquivoFoto').value = '';
  document.getElementById('pPreviewFoto').style.display = 'none';
  document.getElementById('btnRemoverPreviewFoto').style.display = 'none';
}

document.getElementById('formProduto').addEventListener('submit', async function (e) {
  e.preventDefault();
  const id = document.getElementById('produtoId').value;
  let foto = document.getElementById('pFoto').value.trim();

  const arquivo = document.getElementById('pArquivoFoto').files[0];
  if (arquivo) {
    const fd = new FormData();
    fd.append('foto', arquivo);
    try {
      const r = await fetch('/api/admin/upload', { method: 'POST', body: fd });
      const j = await r.json();
      if (j.url) foto = j.url;
      else { alert(j.erro || 'Falha no upload. Tente outra imagem.'); return; }
    } catch (err) {
      alert('Falha no upload. Verifique a conexão e tente novamente.');
      return;
    }
  }

  const dados = {
    categoria: document.getElementById('pCategoria').value,
    nome: document.getElementById('pNome').value.trim(),
    preco: document.getElementById('pPreco').value.trim(),
    detalhes: document.getElementById('pDetalhes').value.trim(),
    brinde: document.getElementById('pBrinde').value.trim(),
    foto: foto
  };
  try {
    if (id) await api.req('/api/admin/products/' + id, 'PUT', dados);
    else await api.req('/api/admin/products', 'POST', dados);
  } catch (err) {
    alert('Não foi possível salvar. Verifique a sessão.');
    return;
  }
  cancelarEdicaoProduto();
  carregarProdutosAdmin();
});

async function excluirProduto(id) {
  if (!confirm('Excluir este produto? Essa ação não pode ser desfeita.')) return;
  try {
    const r = await api.req('/api/admin/products/' + id, 'DELETE');
    if (r.ok) { alert('✅ Produto excluído com sucesso.'); carregarProdutosAdmin(); }
  } catch (err) { console.error('Falha ao excluir produto', id, err); }
}

/* ---------- AVALIAÇÕES ---------- */
async function carregarAvaliacoesAdmin() {
  try {
    const avaliacoes = await api.req('/api/admin/reviews', 'GET');
    const lista = document.getElementById('listaAvaliacoesAdmin');
    lista.innerHTML = '';
    if (!avaliacoes.length) {
      lista.innerHTML = '<p class="empty">Nenhuma avaliação recebida.</p>';
      return;
    }
    const pendentes = avaliacoes.filter(a => !a.aprovado).length;
    document.getElementById('badgeAvaliacoes').style.display = pendentes ? 'inline' : 'none';
    document.getElementById('badgeAvaliacoes').textContent = pendentes;
    avaliacoes.forEach(a => {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = '<div class="avaliacao-nome">' + a.nome + ' <span class="estrelas">' + '★'.repeat(a.estrelas) + '☆'.repeat(5 - a.estrelas) + '</span></div>' +
        '<p>' + a.comentario + '</p>' +
        '<div class="meta"><span>' + (a.data || '') + '</span><span class="pedido-status ' + (a.aprovado ? 'status-concluido' : 'status-novo') + '">' + (a.aprovado ? '✅ Publicada' : '⏳ Aguardando aprovação') + '</span></div>' +
        '<div class="acoes">' +
        (a.aprovado
          ? '<button type="button" class="btn btn-outline" onclick="mudarAvaliacao(' + a.id + ',0)">Ocultar</button>'
          : '<button type="button" class="btn btn-verde" onclick="mudarAvaliacao(' + a.id + ',1)">Aprovar</button>') +
        '<button type="button" class="btn btn-vermelho" onclick="excluirAvaliacao(' + a.id + ')">Excluir</button></div>';
      lista.appendChild(card);
    });
  } catch (e) { console.error('Avaliações:', e); }
}
async function mudarAvaliacao(id, aprovado) {
  await api.req('/api/admin/reviews/' + id, 'PUT', { aprovado });
  carregarAvaliacoesAdmin();
}
async function excluirAvaliacao(id) {
  if (!confirm('Excluir esta avaliação?')) return;
  try {
    const r = await api.req('/api/admin/reviews/' + id, 'DELETE');
    if (r.ok) { alert('✅ Avaliação excluída.'); carregarAvaliacoesAdmin(); }
  } catch (err) { console.error('Falha ao excluir avaliação', id, err); }
}

/* ---------- CONFIGURAÇÕES ---------- */
async function carregarConfig() {
  try {
    const s = await api.req('/api/admin/settings', 'GET');
    document.getElementById('sNome').value = s.site_nome || '';
    document.getElementById('sSlogan').value = s.site_slogan || '';
    document.getElementById('sWhatsapp').value = s.whatsapp || '';
    document.getElementById('sHeroTag').value = s.hero_tag || '';
    document.getElementById('sHeroTitulo').value = s.hero_titulo || '';
    document.getElementById('sHeroSubtitulo').value = s.hero_subtitulo || '';
    document.getElementById('sBrinde').value = s.brinde_destaque || '';
    document.getElementById('sAtendimento').value = s.atendimento || '';
    if (s.hero_imagem) {
      document.getElementById('sPreviewHero').src = s.hero_imagem;
      document.getElementById('sPreviewHero').style.display = 'block';
    }
  } catch (e) { console.error('Config:', e); }
}
document.getElementById('formConfig').addEventListener('submit', async function (e) {
  e.preventDefault();
  const dados = {
    site_nome: document.getElementById('sNome').value.trim(),
    site_slogan: document.getElementById('sSlogan').value.trim(),
    whatsapp: document.getElementById('sWhatsapp').value.replace(/\D/g, ''),
    hero_tag: document.getElementById('sHeroTag').value.trim(),
    hero_titulo: document.getElementById('sHeroTitulo').value.trim(),
    hero_subtitulo: document.getElementById('sHeroSubtitulo').value.trim(),
    brinde_destaque: document.getElementById('sBrinde').value.trim(),
    atendimento: document.getElementById('sAtendimento').value.trim()
  };
  await api.req('/api/admin/settings', 'PUT', dados);
  document.getElementById('msgConfig').textContent = '✅ Configurações salvas!';
  setTimeout(() => document.getElementById('msgConfig').textContent = '', 3500);
});

async function enviarHero() {
  const arquivo = document.getElementById('sArquivoHero').files[0];
  if (!arquivo) { alert('Escolha uma imagem primeiro.'); return; }
  const fd = new FormData();
  fd.append('foto', arquivo);
  try {
    const r = await fetch('/api/admin/upload', { method: 'POST', body: fd });
    const j = await r.json();
    if (!j.url) { alert(j.erro || 'Falha no upload.'); return; }
    await api.req('/api/admin/settings', 'PUT', { hero_imagem: j.url });
    document.getElementById('sPreviewHero').src = j.url;
    document.getElementById('sPreviewHero').style.display = 'block';
    alert('✅ Foto de destaque atualizada!');
  } catch (err) {
    alert('Falha no upload. Tente novamente.');
  }
}

/* ---------- SENHA ---------- */
document.getElementById('formSenha').addEventListener('submit', async function (e) {
  e.preventDefault();
  const atual = document.getElementById('senhaAtual').value;
  const nova = document.getElementById('senhaNova').value;
  if (nova.length < 8) {
    document.getElementById('msgSenha').style.color = '#b03333';
    document.getElementById('msgSenha').textContent = 'A nova senha precisa de 8+ caracteres.';
    return;
  }
  const r = await api.req('/api/admin/password', 'PUT', { atual, nova });
  document.getElementById('msgSenha').style.color = r.ok ? '#2e7d32' : '#b03333';
  document.getElementById('msgSenha').textContent = r.ok ? '✅ Senha trocada com sucesso!' : (r.erro || 'Erro ao trocar senha.');
  this.reset();
  setTimeout(() => document.getElementById('msgSenha').textContent = '', 3500);
});