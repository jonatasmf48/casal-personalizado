# Casal Personalizados — Loja + Painel Admin

## Subir localmente
1. Instale o Node.js (nodejs.org)
2. Abra a pasta no VS Code e rode no terminal:
   npm install
   npm start
3. Acesse:
   - Loja:  http://localhost:3000
   - Admin: http://localhost:3000/admin  (admin / admin123 — troque no painel!)

## Subir na nuvem (gratuito/baixo custo)
- Render (grátis para começar): novo Web Service, apontando para seu repositório
- Railway (a partir de alguns dólares/mês, com disco persistente): `railway up`
- Em ambos: variável de ambiente PORT (eles cuidam), SESSION_SECRET, ADMIN_INITIAL_PASSWORD

## Atenção
- Nunca publique o arquivo .env ou o data.db no GitHub
- Troque a senha do admin no primeiro acesso
- Todos os dados ficam no arquivo data.db — faça backup dele com frequência