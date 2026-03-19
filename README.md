# 💰 FinanceApp

Gerenciador de finanças pessoais com integração WhatsApp. Totalmente gratuito.

## ✨ Funcionalidades

- 📊 Dashboard com gráficos (receitas vs despesas, pizza por categoria)
- 💳 Gerenciamento de contas (corrente, poupança, crédito, dinheiro, investimento)
- 📝 Transações com categorias
- 🎯 Metas de economia com acompanhamento de progresso
- 📈 Relatórios mensais detalhados
- 📱 PWA — instalável no celular como app nativo
- 🤖 **Bot WhatsApp** — registre gastos pelo WhatsApp sem abrir o app

## 🛠️ Stack

| Tecnologia | Uso | Custo |
|-----------|-----|-------|
| Next.js 15 | Frontend + Backend | Grátis |
| Supabase | Banco de dados + Auth | Grátis |
| Vercel | Hospedagem do app | Grátis |
| Railway | Hospedagem do bot | Grátis* |
| whatsapp-web.js | Bot WhatsApp | Grátis |

*Railway oferece $5/mês de crédito gratuito, suficiente para o bot.

---

## 🚀 Como configurar

### 1. Supabase (banco de dados)

1. Crie uma conta em [supabase.com](https://supabase.com)
2. Crie um novo projeto
3. Vá em **SQL Editor** e execute o arquivo `database/schema.sql`
4. Copie as credenciais em **Settings > API**:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY`

### 2. App Next.js (Vercel)

```bash
# Clone ou copie este projeto
cd finance-app

# Instale dependências
npm install

# Configure variáveis de ambiente
cp .env.example .env.local
# Preencha com suas credenciais do Supabase

# Rode localmente
npm run dev
```

**Deploy na Vercel:**

1. Crie conta em [vercel.com](https://vercel.com)
2. Conecte ao seu repositório GitHub
3. Configure as variáveis de ambiente na Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `WHATSAPP_BOT_SECRET` (crie uma senha qualquer, ex: `minhasenhasecreta123`)
   - `NEXT_PUBLIC_APP_URL` (ex: `https://meu-finance-app.vercel.app`)
4. Faça o deploy

### 3. Bot WhatsApp

```bash
cd whatsapp-bot

# Instale dependências
npm install

# Configure variáveis
cp .env.example .env
# Preencha:
# APP_URL=https://meu-finance-app.vercel.app
# BOT_SECRET=minhasenhasecreta123 (mesma do app)

# Rode localmente para escanear o QR
npm start
```

Escaneie o QR code com o WhatsApp e o bot estará conectado!

**Deploy do bot no Railway:**

1. Crie conta em [railway.app](https://railway.app)
2. Crie novo projeto > "Deploy from GitHub repo" (pasta `whatsapp-bot`)
3. Configure as variáveis de ambiente:
   - `APP_URL`
   - `BOT_SECRET`
4. O Railway vai iniciar o bot automaticamente

> **Nota:** No primeiro deploy no Railway, o bot vai imprimir o QR code nos logs. Acesse os logs do Railway e escaneie.

---

## 📱 Como usar o bot WhatsApp

Depois de configurado, mande mensagens para o número conectado ao bot:

| Mensagem | Ação |
|---------|------|
| `gastei 50 no mercado` | Registra despesa R$50 - Supermercado |
| `paguei 100 de luz` | Registra despesa R$100 - Moradia |
| `recebi 3000 de salário` | Registra receita R$3.000 - Salário |
| `ganhei 500 de freelance` | Registra receita R$500 - Freelance |
| `mercado 35` | Registra despesa R$35 |
| `resumo` | Resumo do mês atual |
| `saldo` | Saldo e patrimônio |
| `ajuda` | Lista de comandos |

### Configuração no app

1. Acesse **Configurações** no app
2. Preencha seu número de WhatsApp (com código do país, sem espaços)
3. Selecione a conta padrão para o bot
4. Salve

---

## 📁 Estrutura do projeto

```
finance-app/
├── src/
│   ├── app/
│   │   ├── (auth)/          # Login, Registro
│   │   ├── (dashboard)/     # Dashboard, Transações, Contas, Metas, Relatórios, Config
│   │   └── api/             # API routes (transações, contas, categorias, metas, WhatsApp)
│   ├── components/          # Componentes React
│   ├── lib/                 # Supabase client, utilitários
│   └── types/               # TypeScript types
├── database/
│   └── schema.sql           # Schema do banco de dados
└── whatsapp-bot/            # Bot WhatsApp (serviço separado)
    ├── index.js
    └── package.json
```

---

## 🔒 Segurança

- Cada usuário só acessa seus próprios dados (Row Level Security no Supabase)
- O webhook do WhatsApp é protegido por uma chave secreta (`BOT_SECRET`)
- Autenticação gerenciada pelo Supabase Auth

---

## ⚠️ Aviso sobre o WhatsApp

O bot usa `whatsapp-web.js`, que é uma biblioteca **não-oficial** que simula o WhatsApp Web. Isso significa:
- Existe risco (pequeno) de o número ser bloqueado pelo WhatsApp
- **Recomendação:** use um número secundário para o bot

Para uma solução oficial (paga), use a [API oficial do WhatsApp Business](https://developers.facebook.com/docs/whatsapp).
