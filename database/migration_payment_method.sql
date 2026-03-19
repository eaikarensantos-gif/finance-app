-- Adicionar campo de método de pagamento nas transações
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT NULL;

-- Atualizar transações existentes baseado na descrição
UPDATE transactions SET payment_method = 'pix'
WHERE payment_method IS NULL
  AND (
    LOWER(description) LIKE '%pix%'
    OR LOWER(description) LIKE '%transferência%'
    OR LOWER(description) LIKE '%ted%'
    OR LOWER(description) LIKE '%doc%'
  );

UPDATE transactions SET payment_method = 'credit'
WHERE payment_method IS NULL
  AND (
    LOWER(description) LIKE '%crédito%'
    OR LOWER(description) LIKE '%credito%'
    OR LOWER(description) LIKE '%cartão%'
    OR LOWER(description) LIKE '%parcel%'
  );

UPDATE transactions SET payment_method = 'debit'
WHERE payment_method IS NULL
  AND (
    LOWER(description) LIKE '%débito%'
    OR LOWER(description) LIKE '%debito%'
  );
