-- 028: Add hospital column to cateteres_peridural
ALTER TABLE cateteres_peridural ADD COLUMN hospital TEXT NOT NULL DEFAULT 'unimed' CHECK (hospital IN ('unimed', 'hro'));
