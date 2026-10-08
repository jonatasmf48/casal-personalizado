# CASAL PERSONALIZADOS — Loja online

Loja de produtos personalizados (camisetas, canecas, moletons, quadros).

## Stack
- Node.js 22.5+ (SQLite nativo `node:sqlite`) · Express · SQLite
- HTML/CSS/JS puro + Swiper.js
- Integração Google: Apps Script (Sheets, Agenda, E-mail)

## Rodar localmente
1. `npm install`
2. Copie `.env.example` para `.env` e preencha o `SESSION_SECRET`
3. `npm run dev` → http://localhost:3000
4. Admin: http://localhost:3000/admin (login `admin` / senha do `.env`)

## Deploy (Railway)
1. Suba o repositório no GitHub
2. Railway → New Project → Deploy from GitHub repo
3. Em Variables, adicione: `PORT` (Railway injeta), `SESSION_SECRET`, `ADMIN_INITIAL_PASSWORD`
4. Domínio via Railway → Settings → Networking → Generate Domain
5. Aponte o domínio do Registro.br (CNAME) se quiser domínio próprio

## Segurança
- Troque a senha do admin logo no primeiro acesso
- `.env` e `data.db` NUNCA vão para o GitHub
- WhatsApp padrão: 555194222647 (configurável no painel)