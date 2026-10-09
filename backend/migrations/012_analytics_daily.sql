-- 012_analytics_daily: analítica de red anonimizada (T4-4a, p-21).
-- Decisiones: k-anonimato k>=5 (cortes menores no se publican), default-on
-- anonimizado con opt-out por clínica, base = sector del dueño
-- (owners.sector, NUNCA clinics.sector), sin fichas ni dueños ajenos.
-- El job diario (recomputeAnalyticsDaily) guarda agregados por
-- (day, sector, category); los endpoints leen agregados o computan al
-- vuelo con la misma lógica cuando analytics_daily está vacío.
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS analytics_opt_out BOOLEAN NOT NULL DEFAULT FALSE;
CREATE TABLE IF NOT EXISTS analytics_daily (
    day               DATE NOT NULL,
    sector            TEXT NOT NULL,
    category          TEXT NOT NULL,
    consultations     INT NOT NULL CHECK (consultations >= 0),
    distinct_patients INT NOT NULL CHECK (distinct_patients >= 0),
    distinct_clinics  INT NOT NULL CHECK (distinct_clinics >= 0),
    computed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (day, sector, category)
);
CREATE INDEX IF NOT EXISTS idx_analytics_daily_day ON analytics_daily(day);
