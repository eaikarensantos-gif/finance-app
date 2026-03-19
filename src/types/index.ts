export type AccountType = 'checking' | 'savings' | 'credit' | 'cash' | 'investment'
export type TransactionType = 'income' | 'expense' | 'transfer'
export type CategoryType = 'income' | 'expense'

export interface Account {
  id: string
  user_id: string
  name: string
  type: AccountType
  balance: number
  color: string
  icon: string
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  user_id: string | null
  name: string
  type: CategoryType
  color: string
  icon: string
  is_default: boolean
  created_at: string
}

export interface Transaction {
  id: string
  user_id: string
  account_id: string | null
  category_id: string | null
  type: TransactionType
  amount: number
  description: string
  date: string
  notes: string | null
  source: string
  created_at: string
  updated_at: string
  // joins
  account?: Account
  category?: Category
}

export interface Goal {
  id: string
  user_id: string
  name: string
  target_amount: number
  current_amount: number
  deadline: string | null
  color: string
  icon: string
  completed: boolean
  created_at: string
  updated_at: string
}

export interface Budget {
  id: string
  user_id: string
  category_id: string
  amount: number
  month: number
  year: number
  created_at: string
  category?: Category
}

export interface UserSettings {
  id: string
  user_id: string
  whatsapp_number: string | null
  default_account_id: string | null
  currency: string
  timezone: string
}

export interface MonthlySummary {
  income: number
  expense: number
  balance: number
  byCategory: { category: Category; total: number }[]
}

export interface DashboardData {
  totalBalance: number
  monthIncome: number
  monthExpense: number
  monthBalance: number
  accounts: Account[]
  recentTransactions: Transaction[]
  goals: Goal[]
  expensesByCategory: { name: string; value: number; color: string }[]
  monthlyTrend: { month: string; income: number; expense: number }[]
}
