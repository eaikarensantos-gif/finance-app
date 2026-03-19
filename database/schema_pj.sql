-- ============================================================
-- FINANCE APP — Schema PJ (execute após schema.sql)
-- ============================================================

-- ============================================================
-- TIPO DE PERFIL NAS CONTAS (PF ou PJ)
-- ============================================================
alter table public.accounts
  add column if not exists profile text not null default 'pf' check (profile in ('pf', 'pj')),
  add column if not exists company_name text; -- razão social (PJ)

-- ============================================================
-- CLIENTES PJ
-- ============================================================
create table public.clients (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  document text,           -- CNPJ ou CPF
  email text,
  phone text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- NOTAS FISCAIS (NFS-e)
-- ============================================================
create table public.invoices (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  client_id uuid references public.clients(id) on delete set null,
  number text,                    -- número da NF
  description text not null,
  amount decimal(12,2) not null,
  issue_date date not null default current_date,
  due_date date,
  paid_date date,
  status text not null default 'pending' check (status in ('pending', 'paid', 'overdue', 'cancelled')),
  -- Impostos embutidos (Simples Nacional)
  iss_rate decimal(5,4) default 0.05,       -- ISS (padrão 5%)
  simples_rate decimal(5,4) default 0.06,   -- alíquota efetiva Simples
  transaction_id uuid references public.transactions(id) on delete set null,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- PRÓ-LABORE
-- ============================================================
create table public.pro_labore (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  amount decimal(12,2) not null,
  month int not null check (month between 1 and 12),
  year int not null,
  paid_date date,
  inss_rate decimal(5,4) default 0.11,   -- INSS pró-labore (11%)
  notes text,
  transaction_id uuid references public.transactions(id) on delete set null,
  created_at timestamptz default now(),
  unique(user_id, month, year)
);

-- ============================================================
-- IMPOSTOS (DAS Simples Nacional / DAS MEI)
-- ============================================================
create table public.tax_entries (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  type text not null check (type in ('das_simples', 'das_mei', 'iss_avulso', 'outros')),
  regime text not null check (regime in ('mei', 'simples')),
  reference_month int not null check (reference_month between 1 and 12),
  reference_year int not null,
  gross_revenue decimal(12,2),         -- receita bruta do mês
  rbt12 decimal(12,2),                 -- receita bruta últimos 12 meses
  effective_rate decimal(5,4),         -- alíquota efetiva aplicada
  amount decimal(12,2) not null,       -- valor do DAS
  due_date date,
  paid_date date,
  status text not null default 'pending' check (status in ('pending', 'paid', 'overdue')),
  das_number text,                     -- número do DAS gerado
  notes text,
  transaction_id uuid references public.transactions(id) on delete set null,
  created_at timestamptz default now(),
  unique(user_id, type, reference_month, reference_year)
);

-- ============================================================
-- CONFIGURAÇÕES PJ
-- ============================================================
create table public.company_settings (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null unique,
  company_name text,
  cnpj text,
  regime text not null default 'simples' check (regime in ('mei', 'simples', 'lucro_presumido')),
  activity text,             -- ramo de atividade
  cnae text,                 -- código CNAE
  city_tax_code text,        -- código para emissão de NF na prefeitura
  simples_annex text default 'III' check (simples_annex in ('I','II','III','IV','V','VI')),
  iss_rate decimal(5,4) default 0.05,
  pro_labore_amount decimal(12,2) default 0,
  mei_das_amount decimal(8,2) default 75.90,  -- valor DAS-MEI 2025
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- RLS
-- ============================================================
alter table public.clients enable row level security;
alter table public.invoices enable row level security;
alter table public.pro_labore enable row level security;
alter table public.tax_entries enable row level security;
alter table public.company_settings enable row level security;

create policy "users_own_clients" on public.clients for all using (auth.uid() = user_id);
create policy "users_own_invoices" on public.invoices for all using (auth.uid() = user_id);
create policy "users_own_pro_labore" on public.pro_labore for all using (auth.uid() = user_id);
create policy "users_own_tax_entries" on public.tax_entries for all using (auth.uid() = user_id);
create policy "users_own_company_settings" on public.company_settings for all using (auth.uid() = user_id);

-- Triggers updated_at
create trigger clients_updated_at before update on public.clients for each row execute function update_updated_at();
create trigger invoices_updated_at before update on public.invoices for each row execute function update_updated_at();
create trigger company_settings_updated_at before update on public.company_settings for each row execute function update_updated_at();

-- ============================================================
-- CATEGORIAS PJ PADRÃO
-- ============================================================
insert into public.categories (user_id, name, type, color, icon, is_default) values
  (null, 'Receita de Serviços', 'income', '#22c55e', 'briefcase', true),
  (null, 'Pró-labore', 'expense', '#8b5cf6', 'user', true),
  (null, 'DAS / Simples Nacional', 'expense', '#f59e0b', 'landmark', true),
  (null, 'DAS-MEI', 'expense', '#f59e0b', 'landmark', true),
  (null, 'ISS', 'expense', '#f97316', 'percent', true),
  (null, 'Softwares e Ferramentas', 'expense', '#6366f1', 'monitor', true),
  (null, 'Marketing e Publicidade', 'expense', '#ec4899', 'megaphone', true),
  (null, 'Equipamentos', 'expense', '#3b82f6', 'cpu', true),
  (null, 'Contador', 'expense', '#06b6d4', 'calculator', true),
  (null, 'Tarifas Bancárias PJ', 'expense', '#ef4444', 'bank', true),
  (null, 'Custos Operacionais PJ', 'expense', '#6b7280', 'settings', true)
on conflict do nothing;

-- ============================================================
-- VIEW: DRE mensal PJ
-- ============================================================
create or replace view public.dre_monthly as
select
  t.user_id,
  date_trunc('month', t.date) as month,
  c.name as category_name,
  t.type,
  sum(t.amount) as total
from public.transactions t
left join public.categories c on t.category_id = c.id
join public.accounts a on t.account_id = a.id
where a.profile = 'pj'
group by t.user_id, date_trunc('month', t.date), c.name, t.type;
