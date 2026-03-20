-- Novas categorias padrão
INSERT INTO public.categories (user_id, name, type, color, icon, is_default)
VALUES
  (null, 'Beleza', 'expense', '#ec4899', 'sparkles', true),
  (null, 'Pet', 'expense', '#f59e0b', 'paw-print', true),
  (null, 'Feira', 'expense', '#22c55e', 'shopping-basket', true)
ON CONFLICT DO NOTHING;
