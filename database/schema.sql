-- ============================================================
-- FINANCE APP - Schema Supabase
-- Execute este arquivo no SQL Editor do Supabase
-- ============================================================

-- Habilita UUID
create extension if not exists "uuid-ossp";

-- ============================================================
-- CONTAS BANCÁRIAS
-- ============================================================
create table public.accounts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  type text not null check (type in ('checking', 'savings', 'credit', 'cash', 'investment')),
  balance decimal(12,2) default 0,
  color text default '#22c55e',
  icon text default 'wallet',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- CATEGORIAS
-- ============================================================
create table public.categories (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('income', 'expense')),
  color text default '#22c55e',
  icon text default 'tag',
  is_default boolean default false,
  created_at timestamptz default now()
);

-- ============================================================
-- TRANSAÇÕES
-- ============================================================
create table public.transactions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  account_id uuid references public.accounts(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  type text not null check (type in ('income', 'expense', 'transfer')),
  amount decimal(12,2) not null,
  description text not null,
  date date not null default current_date,
  notes text,
  source text default 'app', -- 'app' | 'whatsapp'
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- METAS DE ECONOMIA
-- ============================================================
create table public.goals (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  target_amount decimal(12,2) not null,
  current_amount decimal(12,2) default 0,
  deadline date,
  color text default '#22c55e',
  icon text default 'target',
  completed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- ORÇAMENTOS MENSAIS
-- ============================================================
create table public.budgets (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  category_id uuid references public.categories(id) on delete cascade not null,
  amount decimal(12,2) not null,
  month int not null check (month between 1 and 12),
  year int not null,
  created_at timestamptz default now(),
  unique(user_id, category_id, month, year)
);

-- ============================================================
-- CONFIGURAÇÕES DO USUÁRIO (WhatsApp, preferências)
-- ============================================================
create table public.user_settings (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null unique,
  whatsapp_number text,           -- número para o bot
  default_account_id uuid references public.accounts(id) on delete set null,
  currency text default 'BRL',
  timezone text default 'America/Sao_Paulo',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY (cada usuário vê só seus dados)
-- ============================================================
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.goals enable row level security;
alter table public.budgets enable row level security;
alter table public.user_settings enable row level security;

-- Políticas: usuário acessa apenas seus próprios dados
create policy "users_own_accounts" on public.accounts for all using (auth.uid() = user_id);
create policy "users_own_categories" on public.categories for all using (auth.uid() = user_id or is_default = true);
create policy "users_own_transactions" on public.transactions for all using (auth.uid() = user_id);
create policy "users_own_goals" on public.goals for all using (auth.uid() = user_id);
create policy "users_own_budgets" on public.budgets for all using (auth.uid() = user_id);
create policy "users_own_settings" on public.user_settings for all using (auth.uid() = user_id);

-- ============================================================
-- CATEGORIAS PADRÃO (inseridas automaticamente)
-- ============================================================
insert into public.categories (user_id, name, type, color, icon, is_default) values
  (null, 'Salário', 'income', '#22c55e', 'briefcase', true),
  (null, 'Freelance', 'income', '#84cc16', 'laptop', true),
  (null, 'Investimentos', 'income', '#10b981', 'trending-up', true),
  (null, 'Outros (receita)', 'income', '#06b6d4', 'plus-circle', true),
  (null, 'Alimentação', 'expense', '#f97316', 'utensils', true),
  (null, 'Transporte', 'expense', '#3b82f6', 'car', true),
  (null, 'Moradia', 'expense', '#8b5cf6', 'home', true),
  (null, 'Saúde', 'expense', '#ec4899', 'heart', true),
  (null, 'Educação', 'expense', '#f59e0b', 'book', true),
  (null, 'Lazer', 'expense', '#ef4444', 'gamepad', true),
  (null, 'Roupas', 'expense', '#a855f7', 'shirt', true),
  (null, 'Supermercado', 'expense', '#f97316', 'shopping-cart', true),
  (null, 'Assinaturas', 'expense', '#6366f1', 'repeat', true),
  (null, 'Outros (despesa)', 'expense', '#6b7280', 'minus-circle', true);

-- ============================================================
-- FUNÇÃO: atualiza updated_at automaticamente
-- ============================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger accounts_updated_at before update on public.accounts for each row execute function update_updated_at();
create trigger transactions_updated_at before update on public.transactions for each row execute function update_updated_at();
create trigger goals_updated_at before update on public.goals for each row execute function update_updated_at();
create trigger user_settings_updated_at before update on public.user_settings for each row execute function update_updated_at();

-- ============================================================
-- VIEW: resumo mensal por categoria
-- ============================================================
create or replace view public.monthly_summary as
select
  user_id,
  date_trunc('month', date) as month,
  type,
  category_id,
  sum(amount) as total,
  count(*) as transaction_count
from public.transactions
group by user_id, date_trunc('month', date), type, category_id;
