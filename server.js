/* =========================================================
   CASAL PERSONALIZADOS — Backend (API + Admin + Segurança)
   Node.js + Express + SQLite nativo + Upload de fotos
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
const PORT = process.env.PORT || 3000;

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
`);

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

app.use('/uploads', express.static(uploadDir));

/* ---------- DADOS INICIAIS ---------- */
function seedSettings() {
  const defaults = {
    'site_nome': 'Casal Personalizados',
    'site_slogan': '@CASAL.PERSONALIZADOS',
    'whatsapp': '5511999999999',
    'hero_titulo': 'Eternize seus momentos com peças feitas sob medida',
    'hero_subtitulo': 'Canecas, camisetas, moletons, quadros e presentes artesanais exclusivos. Faça seu pedido com facilidade e aprove sua arte digitalmente no WhatsApp!',
    'hero_tag': '✨ Cuidado artesanal em cada detalhe personalizado',
    'atendimento': 'Segunda a Sexta: 08:30 às 18:30 | Sábados: 09:00 às 14:00',
    'brinde_destaque': '🎁 Brinde em compras por quantidade: 2 quadros pequenos de azulejo!',
    'hero_imagem': ''
  };
  const insert = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  Object.entries(defaults).forEach(([k, v]) => insert.run(k, v));
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
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"]
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

/* ---------- ARQUIVOS ESTÁTICOS ---------- */
app.use(express.static(path.join(__dirname, 'public')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));

/* =========================================================
   API PÚBLICA (loja)
   ========================================================= */
app.get('/api/settings', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const obj = {};
  rows.forEach(r => obj[r.key] = r.value);
  res.json(obj);
});

app.get('/api/products', (req, res) => {
  res.json(db.prepare('SELECT * FROM products ORDER BY ordem ASC').all());
});

app.get('/api/reviews', (req, res) => {
  res.json(db.prepare('SELECT nome, estrelas, comentario, data FROM reviews WHERE aprovado = 1 ORDER BY id DESC').all());
});

app.post('/api/orders', publicLimiter, (req, res) => {
  const nome = limparTexto(req.body.nome, 60);
  const produto = limparTexto(req.body.produto, 80);
  const quantidade = Math.max(1, Math.min(999, parseInt(req.body.quantidade, 10) || 1));
  const tamanho = limparTexto(req.body.tamanho, 10);
  const cor = limparTexto(req.body.cor, 40);
  const texto = limparTexto(req.body.texto, 600);
  if (!nome || !produto) return res.status(400).json({ erro: 'Nome e produto são obrigatórios.' });
  db.prepare('INSERT INTO orders (nome, produto, quantidade, tamanho, cor, texto) VALUES (?, ?, ?, ?, ?, ?)')
    .run(nome, produto, quantidade, tamanho, cor, texto);
  res.json({ ok: true });
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
  upload.single('foto')(req, res, (err) => {
    if (err) return res.status(400).json({ erro: err.message || 'Falha no upload.' });
    if (!req.file) return res.status(400).json({ erro: 'Envie um arquivo de imagem.' });
    res.json({ ok: true, url: '/uploads/' + req.file.filename });
  });
});

/* --- Configurações --- */
app.get('/api/admin/settings', precisaAdmin, (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const obj = {};
  rows.forEach(r => obj[r.key] = r.value);
  res.json(obj);
});
app.put('/api/admin/settings', precisaAdmin, (req, res) => {
  const dados = req.body || {};
  const upd = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  const permitidas = ['site_nome', 'site_slogan', 'whatsapp', 'hero_titulo', 'hero_subtitulo', 'hero_tag', 'atendimento', 'brinde_destaque', 'hero_imagem'];
  permitidas.forEach(k => {
    if (dados[k] !== undefined) upd.run(k, limparTexto(dados[k], 500));
  });
  res.json({ ok: true });
});

/* --- Produtos --- */
app.get('/api/admin/products', precisaAdmin, (req, res) => {
  res.json(db.prepare('SELECT * FROM products ORDER BY ordem ASC').all());
});
app.post('/api/admin/products', precisaAdmin, (req, res) => {
  const { categoria, nome, preco, detalhes, brinde, foto } = req.body;
  if (!categoria || !nome || !preco) return res.status(400).json({ erro: 'Categoria, nome e preço são obrigatórios.' });
  const info = db.prepare('INSERT INTO products (categoria, nome, preco, detalhes, brinde, foto, ordem) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(limparTexto(categoria, 40), limparTexto(nome, 80), limparTexto(preco, 120), limparTexto(detalhes, 300), limparTexto(brinde, 200), limparTexto(foto, 300), Date.now());
  res.json({ ok: true, id: info.lastInsertRowid });
});
app.put('/api/admin/products/:id', precisaAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { categoria, nome, preco, detalhes, brinde, foto } = req.body;
  db.prepare('UPDATE products SET categoria = ?, nome = ?, preco = ?, detalhes = ?, brinde = ?, foto = ? WHERE id = ?')
    .run(limparTexto(categoria, 40), limparTexto(nome, 80), limparTexto(preco, 120), limparTexto(detalhes, 300), limparTexto(brinde, 200), limparTexto(foto, 300), id);
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

/* ---------- INICIA ---------- */
app.listen(PORT, () => {
  console.log('✅ Casal Personalizados rodando em http://localhost:' + PORT);
  console.log('   Loja:  http://localhost:' + PORT);
  console.log('   Admin: http://localhost:' + PORT + '/admin');
});