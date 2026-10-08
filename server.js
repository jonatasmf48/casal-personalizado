/* =========================================================
   CASAL PERSONALIZADOS — Backend (API + Admin + Segurança)
   Node.js + Express + SQLite nativo + Upload de fotos
   v1.2.0 — revisão sênior consolidada
   ========================================================= */
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

/* ---------- BANCO DE DADOS (nativo — sem compilação) ---------- */
const db = new DatabaseSync(path.join(__dirname, 'data.db'));
db.exec('PRAGMA journal_mode = WAL;');
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    categoria TEXT NOT NULL,
    nome TEXT NOT NULL,
    preco TEXT NOT NULL,
    detalhes TEXT DEFAULT '',
    brinde TEXT DEFAULT '',
    foto TEXT DEFAULT '',
    ordem INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    estrelas INTEGER NOT NULL,
    comentario TEXT NOT NULL,
    data TEXT DEFAULT '',
    aprovado INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    produto TEXT NOT NULL,
    quantidade INTEGER DEFAULT 1,
    tamanho TEXT DEFAULT '',
    cor TEXT DEFAULT '',
    texto TEXT DEFAULT '',
    status TEXT DEFAULT 'novo',
    criado_em TEXT DEFAULT (datetime('now','localtime'))
  );
  CREATE TABLE IF NOT EXISTS admin (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    usuario TEXT NOT NULL,
    senha_hash TEXT NOT NULL
  );
  /* GALERIAS E FOTOS (carrossel com fotos ilimitadas) */
  CREATE TABLE IF NOT EXISTS galerias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    tipo TEXT NOT NULL, -- 'hero' ou 'produto'
    ref_id INTEGER DEFAULT 0, -- id do produto (0 = galeria do topo)
    ordem INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS fotos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    galeria_id INTEGER NOT NULL,
    url TEXT NOT NULL,
    ordem INTEGER DEFAULT 0
  );
`);

/* Migração segura: garante a coluna whatsapp em pedidos (não apaga dados existentes) */
try { db.exec("ALTER TABLE orders ADD COLUMN whatsapp TEXT DEFAULT ''"); } catch (e) { /* coluna já existe */ }

/* ---------- UPLOAD DE IMAGENS ---------- */
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    cb(null, Date.now() + '-' + crypto.randomBytes(4).toString('hex') + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype);
    if (ok) cb(null, true);
    else cb(new Error('Apenas imagens JPG, PNG, WEBP ou GIF.'));
  }
});

/* Valida a assinatura REAL do arquivo (magic bytes) — bloqueia .exe renomeado para .jpg */
function validarImagemReal(caminho) {
  try {
    const fd = fs.openSync(caminho, 'r');
    const buf = Buffer.alloc(16);
    fs.readSync(fd, buf, 0, 16, 0);
    fs.closeSync(fd);
    if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return true;            // JPEG
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return true; // PNG
    if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return true; // GIF
    if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
        buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return true; // WEBP (RIFF....WEBP)
    return false;
  } catch (e) { return false; }
}

/* Executa o upload e valida a imagem real — usado em todos os endpoints de upload */
function processarUpload(req, res, cb) {
  upload.single('foto')(req, res, (err) => {
    if (err) return res.status(400).json({ erro: err.message || 'Falha no upload.' });
    if (!req.file) return res.status(400).json({ erro: 'Envie um arquivo de imagem.' });
    if (!validarImagemReal(req.file.path)) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ erro: 'Arquivo inválido: não é uma imagem real (JPG, PNG, WEBP ou GIF).' });
    }
    cb(req, res);
  });
}

/* Servir as imagens enviadas — /uploads/nome-do-arquivo.jpg */
app.use('/uploads', express.static(uploadDir));

/* ---------- DADOS INICIAIS ---------- */
function seedSettings() {
  const defaults = {
    'site_nome': 'Casal Personalizados',
    'site_slogan': '@CASAL.PERSONALIZADOS',
    'whatsapp': '555194222647',
    'hero_titulo': 'Eternize seus momentos com peças feitas sob medida',
    'hero_subtitulo': 'Canecas, camisetas, moletons, quadros e presentes artesanais exclusivos. Faça seu pedido com facilidade e aprove sua arte digitalmente no WhatsApp!',
    'hero_tag': '✨ Cuidado artesanal em cada detalhe personalizado',
    'atendimento': 'Segunda a Sexta: 08:30 às 18:30 | Sábados: 09:00 às 14:00',
    'brinde_destaque': '🎁 Brinde em compras por quantidade: 2 quadros pequenos de azulejo!',
    'hero_imagem': '',
    /* Integração Google (configurável no painel → aba Google) */
    'google_webhook_url': 'https://script.google.com/macros/s/AKfycbz10W-jc5b0SBQE0Ox24ichKh12Sr5WuZfbIyUdYJaOSjJrbxZJ2fOwYEs0fGJ6fgVqaw/exec',
    'google_email': 'casalpersonalizado01@gmail.com',
    'google_autosend': '1'
  };
  const insert = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  Object.entries(defaults).forEach(([k, v]) => insert.run(k, v));

  /* Se o banco JÁ EXISTE com o número antigo (5511999999999), corrige agora */
  const fix = db.prepare(
    "UPDATE settings SET value = ? WHERE key = 'whatsapp' AND value IN ('5511999999999','55119999999999','')"
  ).run('555194222647');
  if (fix.changes > 0) {
    console.log('📱 WhatsApp corrigido para 555194222647 (+55 51 9422-2647)');
  }
}

function seedProducts() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM products').get().c;
  if (count > 0) return;
  const insert = db.prepare('INSERT INTO products (categoria, nome, preco, detalhes, brinde, ordem) VALUES (?, ?, ?, ?, ?, ?)');
  const produtos = [
    ['Camisetas', 'Camiseta Dry Fit', 'R$ 120', '3+ un: R$ 100 cada (economize R$ 20) | 10+ un: R$ 80 cada (economize R$ 40)', '🎁 Brinde 10+: 2 quadros pequenos de azulejo'],
    ['Camisetas', 'Camiseta 100% Algodão', 'R$ 100', '3+ un: R$ 80 cada (economize R$ 20) | 10+ un: R$ 60 cada (economize R$ 40)', '🎁 Brinde 10+: 2 quadros pequenos de azulejo'],
    ['Camisetas', 'Camiseta 100% Poliéster', 'R$ 80', '3+ un: R$ 60 cada (economize R$ 20) | 10+ un: R$ 40 cada (economize R$ 40)', '🎁 Brinde 10+: 2 quadros pequenos de azulejo'],
    ['Camisetas', 'Camiseta PV Poliviscose', 'R$ 120', '3+ un: R$ 100 cada (economize R$ 20) | 10+ un: R$ 80 cada (economize R$ 40)', '🎁 Brinde 10+: 2 quadros pequenos de azulejo'],
    ['Canecas', 'Caneca Branca', 'R$ 45', '12+ un: R$ 40 cada (economize R$ 5) | 36 un: R$ 35 cada (economize R$ 10)', '🎁 Brinde 36+: 2 quadros pequenos de azulejo'],
    ['Canecas', 'Caneca Preta', 'R$ 60', '12+ un: R$ 55 cada (economize R$ 5) | 36 un: R$ 40 cada (economize R$ 20)', '🎁 Brinde 36+: 2 quadros pequenos de azulejo'],
    ['Canecas', 'Caneca Mágica', 'R$ 70', '12+ un: R$ 60 cada (economize R$ 10) | 36 un: R$ 45 cada (economize R$ 25)', '🎁 Brinde 36+: 2 quadros pequenos de azulejo'],
    ['Canecas', 'Caneca com Alça Colorida', 'R$ 50', '12+ un: R$ 45 cada (economize R$ 5) | 36 un: R$ 40 cada (economize R$ 10)', '🎁 Brinde 36+: 2 quadros pequenos de azulejo'],
    ['Moletons', 'Moletom Canguru', 'R$ 210', '5+ un: R$ 180 cada (economize R$ 30) | 10+ un: R$ 140 cada (economize R$ 70)', '🎁 Brinde 25+: 2 quadros pequenos de azulejo'],
    ['Moletons', 'Moletom Sem Capuz', 'R$ 210', '5+ un: R$ 180 cada (economize R$ 30) | 10+ un: R$ 140 cada (economize R$ 70)', '🎁 Brinde 25+: 2 quadros pequenos de azulejo'],
    ['Quadros', 'Quadro Azulejo', 'P: R$ 25 | M: R$ 35 | G: R$ 45', 'Personalizado com sua foto ou mensagem', ''],
    ['Quadros', 'Quadro Vidro', 'P: R$ 25 | M: R$ 35 | G: R$ 45', 'Personalizado com sua foto ou mensagem', ''],
    ['Quadros', 'Quadro MDF', 'P: R$ 25 | M: R$ 35 | G: R$ 45', 'Personalizado com sua foto ou mensagem', '']
  ];
  let ordem = 0;
  produtos.forEach(([cat, nome, preco, detalhes, brinde]) => {
    insert.run(cat, nome, preco, detalhes, brinde, ordem++);
  });
}

function seedAdmin() {
  const row = db.prepare('SELECT id FROM admin WHERE id = 1').get();
  if (row) return;
  const senhaInicial = process.env.ADMIN_INITIAL_PASSWORD || 'admin123';
  const hash = bcrypt.hashSync(senhaInicial, 12);
  db.prepare('INSERT INTO admin (id, usuario, senha_hash) VALUES (1, ?, ?)').run('admin', hash);
  console.log('🔐 Admin criado. Usuário: admin | Senha inicial: ' + senhaInicial + ' (TROQUE pelo painel!)');
}

seedSettings();
seedProducts();
seedAdmin();

/* ---------- SEGURANÇA ---------- */
app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      /* CDN do Swiper (carrossel) + Google Fonts */
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      /* CORREÇÃO CRÍTICA: libera o Web App do Google Apps Script (Sheets/Agenda/E-mail)
         e o CDN do Swiper — sem isso o fetch para o Google era bloqueado no navegador */
      connectSrc: ["'self'", "https://cdn.jsdelivr.net", "https://script.google.com"]
    }
  }
}));
app.use(express.json({ limit: '100kb' }));
app.use(session({
  name: 'casal.sid',
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 8
  }
}));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { erro: 'Muitas tentativas de login. Aguarde 15 minutos.' }
});
const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { erro: 'Muitas solicitações. Aguarde um instante.' }
});

function limparTexto(v, max) {
  let t = String(v == null ? '' : v).trim();
  if (max && t.length > max) t = t.substring(0, max);
  return t.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

function precisaAdmin(req, res, next) {
  if (req.session && req.session.admin) return next();
  return res.status(401).json({ erro: 'Não autorizado. Faça login.' });
}

function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const obj = {};
  rows.forEach(r => obj[r.key] = r.value);
  return obj;
}

/* Envio do pedido ao Google (Apps Script) — roda no servidor, sem CORS, com timeout + retry */
async function enviarPedidoGoogle(pedido) {
  const s = getSettings();
  const webhook = limparTexto(s.google_webhook_url, 500);
  const autosend = /^(1|true|sim|yes)$/i.test(limparTexto(s.google_autosend, 10));
  if (!webhook || !autosend) return;

  const payload = {
    evento: 'novo_pedido',
    numero: pedido.id,
    nome: pedido.nome,
    whatsapp: pedido.whatsapp || '',
    produto: pedido.produto,
    quantidade: pedido.quantidade,
    tamanho: pedido.tamanho,
    cor: pedido.cor,
    texto: pedido.texto,
    status: pedido.status,
    criado_em: pedido.criado_em,
    email: s.google_email || ''
  };

  for (let tentativa = 0; tentativa < 2; tentativa++) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const resp = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: ctrl.signal
      });
      clearTimeout(timer);
      if (resp.ok) {
        console.log('📤 Pedido #' + pedido.id + ' enviado ao Google com sucesso.');
        return;
      }
      console.log('⚠️ Google respondeu com status ' + resp.status + ' (tentativa ' + (tentativa + 1) + ')');
    } catch (e) {
      console.log('⚠️ Falha ao enviar pedido #' + pedido.id + ' ao Google (tentativa ' + (tentativa + 1) + '): ' + e.message);
    }
  }
}

/* ---------- ARQUIVOS ESTÁTICOS ---------- */
app.use(express.static(path.join(__dirname, 'public')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));

/* =========================================================
   API PÚBLICA (loja)
   ========================================================= */
app.get('/api/settings', (req, res) => {
  const obj = getSettings();
  /* Garantia extra: número do WhatsApp sempre em formato válido (somente dígitos, com fallback) */
  const whats = String(obj.whatsapp || '').replace(/\D/g, '');
  obj.whatsapp = whats.length >= 10 ? whats : '555194222647';
  res.json(obj);
});

app.get('/api/health', (req, res) => {
  const c = (sql) => db.prepare(sql).get().c;
  res.json({
    ok: true,
    fotos_cadastradas: c('SELECT COUNT(*) AS c FROM fotos'),
    produtos: c('SELECT COUNT(*) AS c FROM products'),
    produtos_com_foto: c("SELECT COUNT(*) AS c FROM products WHERE foto <> '' AND foto IS NOT NULL"),
    galerias: c('SELECT COUNT(*) AS c FROM galerias'),
    whatsapp_servido: '555194222647'
  });
});

app.get('/api/products', (req, res) => {
  res.json(db.prepare('SELECT * FROM products ORDER BY ordem ASC').all());
});

app.get('/api/reviews', (req, res) => {
  res.json(db.prepare('SELECT nome, estrelas, comentario, data FROM reviews WHERE aprovado = 1 ORDER BY id DESC').all());
});

app.post('/api/orders', publicLimiter, (req, res) => {
  const nome = limparTexto(req.body.nome, 60);
  const whatsapp = limparTexto(req.body.whatsapp, 20).replace(/\D/g, '');
  const produto = limparTexto(req.body.produto, 80);
  const quantidade = Math.max(1, Math.min(999, parseInt(req.body.quantidade, 10) || 1));
  const tamanho = limparTexto(req.body.tamanho, 10);
  const cor = limparTexto(req.body.cor, 40);
  const texto = limparTexto(req.body.texto, 600);

  if (!nome || !produto) return res.status(400).json({ erro: 'Nome e produto são obrigatórios.' });

  const info = db.prepare('INSERT INTO orders (nome, whatsapp, produto, quantidade, tamanho, cor, texto) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(nome, whatsapp, produto, quantidade, tamanho, cor, texto);

  /* Envia ao Google em segundo plano (não bloqueia a resposta do pedido) */
  const pedido = db.prepare('SELECT * FROM orders WHERE id = ?').get(info.lastInsertRowid);
  enviarPedidoGoogle(pedido);

  res.json({ ok: true, id: Number(info.lastInsertRowid) });
});

app.post('/api/reviews', publicLimiter, (req, res) => {
  const nome = limparTexto(req.body.nome, 60);
  const comentario = limparTexto(req.body.comentario, 600);
  const estrelas = Math.max(1, Math.min(5, parseInt(req.body.estrelas, 10) || 0));
  if (!nome || !comentario || !estrelas) return res.status(400).json({ erro: 'Preencha nome, nota e comentário.' });
  const hoje = new Date();
  const data = hoje.getDate() + '/' + (hoje.getMonth() + 1) + '/' + hoje.getFullYear();
  db.prepare('INSERT INTO reviews (nome, estrelas, comentario, data, aprovado) VALUES (?, ?, ?, ?, 0)')
    .run(nome, estrelas, comentario, data);
  res.json({ ok: true, mensagem: 'Avaliação enviada para aprovação. Obrigado!' });
});

/* =========================================================
   API DE ADMIN (protegida)
   ========================================================= */
app.post('/api/admin/login', loginLimiter, (req, res) => {
  const usuario = limparTexto(req.body.usuario, 40);
  const senha = String(req.body.senha || '');
  const row = db.prepare('SELECT * FROM admin WHERE id = 1').get();
  if (!row || row.usuario !== usuario || !bcrypt.compareSync(senha, row.senha_hash)) {
    return res.status(401).json({ erro: 'Usuário ou senha incorretos.' });
  }
  req.session.admin = { id: row.id, usuario: row.usuario };
  res.json({ ok: true });
});

app.post('/api/admin/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/admin/me', precisaAdmin, (req, res) => {
  res.json({ usuario: req.session.admin.usuario });
});

app.post('/api/admin/upload', precisaAdmin, (req, res) => {
  processarUpload(req, res, () => {
    res.json({ ok: true, url: '/uploads/' + req.file.filename });
  });
});

/* --- Configurações --- */
app.get('/api/admin/settings', precisaAdmin, (req, res) => {
  res.json(getSettings());
});

app.put('/api/admin/settings', precisaAdmin, (req, res) => {
  const dados = req.body || {};
  const upd = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  const permitidas = [
    'site_nome', 'site_slogan', 'whatsapp', 'hero_titulo', 'hero_subtitulo', 'hero_tag',
    'atendimento', 'brinde_destaque', 'hero_imagem',
    'google_webhook_url', 'google_email', 'google_autosend'
  ];
  permitidas.forEach(k => {
    if (dados[k] !== undefined) upd.run(k, limparTexto(dados[k], 500));
  });
  res.json({ ok: true });
});

/* --- Testar conexão com o Google (Apps Script) pelo painel --- */
app.get('/api/admin/test-google', precisaAdmin, async (req, res) => {
  const s = getSettings();
  const webhook = limparTexto(s.google_webhook_url, 500);
  if (!webhook) return res.status(400).json({ erro: 'Configure a URL do Web App no painel → aba Google.' });
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const resp = await fetch(webhook, { method: 'GET', signal: ctrl.signal });
    clearTimeout(timer);
    res.json({
      ok: resp.ok,
      status: resp.status,
      mensagem: resp.ok ? 'Conexão OK! Apps Script respondeu.' : 'Resposta inesperada (' + resp.status + ').'
    });
  } catch (e) {
    res.status(502).json({ erro: 'Falha de conexão: ' + e.message });
  }
});

/* --- Produtos --- */
app.get('/api/admin/products', precisaAdmin, (req, res) => {
  res.json(db.prepare('SELECT * FROM products ORDER BY ordem ASC').all());
});

app.post('/api/admin/products', precisaAdmin, (req, res) => {
  const { categoria, nome, preco, detalhes, brinde, foto } = req.body;
  if (!categoria || !nome || !preco) return res.status(400).json({ erro: 'Categoria, nome e preço são obrigatórios.' });
  const info = db.prepare('INSERT INTO products (categoria, nome, preco, detalhes, brinde, foto, ordem) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(
      limparTexto(categoria, 40), limparTexto(nome, 80), limparTexto(preco, 120),
      limparTexto(detalhes, 300), limparTexto(brinde, 200), limparTexto(foto, 300), Date.now()
    );
  res.json({ ok: true, id: info.lastInsertRowid });
});

app.put('/api/admin/products/:id', precisaAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { categoria, nome, preco, detalhes, brinde, foto } = req.body;
  db.prepare('UPDATE products SET categoria = ?, nome = ?, preco = ?, detalhes = ?, brinde = ?, foto = ? WHERE id = ?')
    .run(
      limparTexto(categoria, 40), limparTexto(nome, 80), limparTexto(preco, 120),
      limparTexto(detalhes, 300), limparTexto(brinde, 200), limparTexto(foto, 300), id
    );
  res.json({ ok: true });
});

app.delete('/api/admin/products/:id', precisaAdmin, (req, res) => {
  db.prepare('DELETE FROM products WHERE id = ?').run(parseInt(req.params.id, 10));
  res.json({ ok: true });
});

/* --- Avaliações --- */
app.get('/api/admin/reviews', precisaAdmin, (req, res) => {
  res.json(db.prepare('SELECT * FROM reviews ORDER BY id DESC').all());
});

app.put('/api/admin/reviews/:id', precisaAdmin, (req, res) => {
  const aprovado = req.body.aprovado ? 1 : 0;
  db.prepare('UPDATE reviews SET aprovado = ? WHERE id = ?').run(aprovado, parseInt(req.params.id, 10));
  res.json({ ok: true });
});

app.delete('/api/admin/reviews/:id', precisaAdmin, (req, res) => {
  db.prepare('DELETE FROM reviews WHERE id = ?').run(parseInt(req.params.id, 10));
  res.json({ ok: true });
});

/* --- Pedidos --- */
app.get('/api/admin/orders', precisaAdmin, (req, res) => {
  res.json(db.prepare('SELECT * FROM orders ORDER BY id DESC').all());
});

app.put('/api/admin/orders/:id', precisaAdmin, (req, res) => {
  const status = limparTexto(req.body.status, 30);
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, parseInt(req.params.id, 10));
  res.json({ ok: true });
});

app.delete('/api/admin/orders/:id', precisaAdmin, (req, res) => {
  db.prepare('DELETE FROM orders WHERE id = ?').run(parseInt(req.params.id, 10));
  res.json({ ok: true });
});

/* --- Trocar senha --- */
app.put('/api/admin/password', precisaAdmin, (req, res) => {
  const atual = String(req.body.atual || '');
  const nova = String(req.body.nova || '');
  if (nova.length < 8) return res.status(400).json({ erro: 'A nova senha deve ter pelo menos 8 caracteres.' });
  const row = db.prepare('SELECT * FROM admin WHERE id = 1').get();
  if (!bcrypt.compareSync(atual, row.senha_hash)) return res.status(401).json({ erro: 'Senha atual incorreta.' });
  db.prepare('UPDATE admin SET senha_hash = ? WHERE id = 1').run(bcrypt.hashSync(nova, 12));
  res.json({ ok: true });
});

/* =========================================================
   GALERIAS / CARROSSEL (API pública + admin)
   Fotos ilimitadas no topo (hero) e em cada produto
   ========================================================= */
function pegarOuCriarGaleria(tipo, refId, nome) {
  let g = db.prepare('SELECT id FROM galerias WHERE tipo = ? AND ref_id = ?').get(tipo, refId);
  if (!g) {
    const info = db.prepare('INSERT INTO galerias (nome, tipo, ref_id, ordem) VALUES (?, ?, ?, ?)')
      .run(nome || 'Galeria', tipo, refId, Date.now());
    g = { id: info.lastInsertRowid };
  }
  return g.id;
}

/* Público — fotos de uma galeria (topo: tipo=hero refId=0 | produto: tipo=produto refId=ID) */
app.get('/api/galeria/:tipo/:refId', (req, res) => {
  const tipo = limparTexto(req.params.tipo, 20);
  const refId = parseInt(req.params.refId, 10) || 0;
  const galeria = db.prepare('SELECT id FROM galerias WHERE tipo = ? AND ref_id = ?').get(tipo, refId);
  if (!galeria) return res.json([]);
  res.json(db.prepare('SELECT id, url FROM fotos WHERE galeria_id = ? ORDER BY ordem ASC').all(galeria.id));
});

/* Admin — lista as fotos de uma galeria */
app.get('/api/admin/galeria/:tipo/:refId', precisaAdmin, (req, res) => {
  const tipo = limparTexto(req.params.tipo, 20);
  const refId = parseInt(req.params.refId, 10) || 0;
  const galeria = db.prepare('SELECT id FROM galerias WHERE tipo = ? AND ref_id = ?').get(tipo, refId);
  if (!galeria) return res.json([]);
  res.json(db.prepare('SELECT id, url, ordem FROM fotos WHERE galeria_id = ? ORDER BY ordem ASC').all(galeria.id));
});

/* Admin — envia foto para a galeria (sem limite — uma por uma ou em loop no admin) */
app.post('/api/admin/galeria/:tipo/:refId/fotos', precisaAdmin, (req, res) => {
  processarUpload(req, res, () => {
    const tipo = limparTexto(req.params.tipo, 20);
    const refId = parseInt(req.params.refId, 10) || 0;
    const galeriaId = pegarOuCriarGaleria(tipo, refId, req.body.nome || 'Galeria');
    db.prepare('INSERT INTO fotos (galeria_id, url, ordem) VALUES (?, ?, ?)')
      .run(galeriaId, '/uploads/' + req.file.filename, Date.now());
    res.json({ ok: true, url: '/uploads/' + req.file.filename });
  });
});

/* Admin — reordena as fotos (envia um array de ids na ordem desejada) */
app.put('/api/admin/fotos/ordem', precisaAdmin, (req, res) => {
  const ordem = req.body.ordem;
  if (!Array.isArray(ordem)) return res.status(400).json({ erro: 'ordem inválida' });
  const upd = db.prepare('UPDATE fotos SET ordem = ? WHERE id = ?');
  ordem.forEach((id, i) => upd.run(i, parseInt(id, 10)));
  res.json({ ok: true });
});

/* Admin — exclui uma foto da galeria */
app.delete('/api/admin/fotos/:id', precisaAdmin, (req, res) => {
  db.prepare('DELETE FROM fotos WHERE id = ?').run(parseInt(req.params.id, 10));
  res.json({ ok: true });
});

/* =========================================================
   INICIA — UM ÚNICO app.listen (corrige EADDRINUSE)
   ========================================================= */
const server = app.listen(PORT, () => {
  const qtdFotos = db.prepare('SELECT COUNT(*) AS c FROM fotos').get().c;
  const qtdProdutos = db.prepare('SELECT COUNT(*) AS c FROM products').get().c;
  const qtdGaleria = db.prepare('SELECT COUNT(*) AS c FROM galerias').get().c;
  console.log('✅ Casal Personalizados rodando em http://localhost:' + PORT);
  console.log('   Loja:  http://localhost:' + PORT);
  console.log('   Admin: http://localhost:' + PORT + '/admin');
  console.log('   Fotos cadastradas: ' + qtdFotos + ' | Galerias: ' + qtdGaleria + ' | Produtos: ' + qtdProdutos);
  console.log('   WhatsApp padrão: 555194222647 (+55 51 9422-2647)');
});

/* Tratamento amigável de erro de porta em uso (EADDRINUSE) */
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('\n🚫 A porta ' + PORT + ' já está em uso.');
    console.error('   Provavelmente já existe outro servidor do projeto rodando em outro terminal.');
    console.error('   Feche o outro terminal OU encerre o processo:');
    console.error('   → netstat -ano | findstr :' + PORT);
    console.error('   → taskkill /F /PID <PID numerico>');
    process.exit(1);
  }
  throw err; // outros erros seguem o fluxo normal
});

/* =========================================================
   LOGIN DO CLIENTE COM GOOGLE (acompanhar pedidos)
   ========================================================= */
app.post('/api/auth/google', async (req, res) => {
  const credential = String(req.body.credential || '');
  if (!credential) return res.status(400).json({ erro: 'Credencial ausente.' });

  try {
    /* Valida o token JWT com o Google (endpoint oficial, sem lib extra) */
    const resp = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential));
    const dados = await resp.json();

    if (!dados.email || dados.aud !== (process.env.GOOGLE_CLIENT_ID || 'SEU_CLIENT_ID.apps.googleusercontent.com')) {
      return res.status(401).json({ erro: 'Token inválido ou de outro aplicativo.' });
    }

    /* Tabela de clientes (criada automaticamente, sem apagar dados) */
    db.exec(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      google_sub TEXT DEFAULT '',
      criado_em TEXT DEFAULT (datetime('now','localtime'))
    )`);

    const nome = dados.name || String(dados.email).split('@')[0];
    const info = db.prepare(
      `INSERT INTO users (nome, email, google_sub) VALUES (?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET nome = excluded.nome, google_sub = excluded.google_sub`
    ).run(nome, dados.email, dados.sub);

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(dados.email);

    /* Sessão do CLIENTE (separada da sessão do admin) */
    req.session.user = { id: user.id, nome: user.nome, email: user.email };

    res.json({ ok: true, nome: user.nome, email: user.email });
  } catch (e) {
    res.status(502).json({ erro: 'Falha ao validar com o Google. Tente novamente.' });
  }
});