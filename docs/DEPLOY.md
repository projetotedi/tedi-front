# Deploy — tedi-front

Front no **Vercel** (plano Hobby, gratuito), com deploy automático da `main` e um **preview por PR**. A API fica no Render e o banco no Neon (ver `docs/DEPLOY.md` do `tedi-back`).

## 1. Vercel

1. Criar conta em https://vercel.com (login com GitHub) e autorizar a organização `projetotedi`.
2. **Add New → Project** → importar `projetotedi/tedi-front`. O Vercel detecta Vite e lê o `vercel.json` da raiz (build, saída, rewrite para SPA, headers de segurança e cache).
3. Em **Environment Variables**, criar `VITE_API_URL`:
   - **Production:** `https://tedi-back.onrender.com` (URL do serviço no Render, sem barra no fim).
   - **Preview:** a mesma URL. Previews de PR usam a API de produção, o que é aceitável enquanto o ambiente é de testes.
4. **Deploy**. A URL de produção fica `https://tedi-front.vercel.app` (ou o nome que o Vercel atribuir).
5. Copiar essa URL para `CORS_ORIGINS` no Render, junto com `https://*.vercel.app` para os previews.

## 2. Como o ambiente se comporta

- **Push em `main`** → deploy de produção.
- **PR aberto** → deploy de preview com URL própria, comentado no PR. Como o CORS da API aceita `*.vercel.app`, o preview conversa com a API real.
- `VITE_API_URL` é resolvido **no build**. Mudou a URL da API? Alterar a variável no Vercel e fazer **Redeploy**.
- A API no plano free do Render hiberna após 15 min sem uso. O primeiro request pode levar até um minuto. Vale o front mostrar um estado de "conectando" em vez de erro nesse cenário.

## 3. Alternativa: Cloudflare Pages

Mesmo modelo (build por push, preview por PR), sem a cláusula de uso não comercial do Hobby do Vercel. Configuração: build `yarn build`, saída `dist`, variável `VITE_API_URL`, e um `_redirects` com `/* /index.html 200` no lugar do `rewrites` do `vercel.json`.

## 4. Docker (outros provedores)

O `Dockerfile` com nginx continua válido para qualquer host com Docker. Como `VITE_API_URL` entra no build, é preciso passar `--build-arg` ou construir uma imagem por ambiente.
