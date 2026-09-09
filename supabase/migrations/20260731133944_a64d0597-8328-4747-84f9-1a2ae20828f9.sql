ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS ordem integer NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY consultor_id ORDER BY created_at, id) - 1 AS pos
  FROM public.cases
)
UPDATE public.cases c SET ordem = r.pos FROM ranked r WHERE r.id = c.id;

CREATE INDEX IF NOT EXISTS cases_consultor_ordem_idx ON public.cases (consultor_id, ordem);

DROP TRIGGER IF EXISTS update_consultores_updated_at ON public.consultores;
CREATE TRIGGER update_consultores_updated_at
BEFORE UPDATE ON public.consultores
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_cases_updated_at ON public.cases;
CREATE TRIGGER update_cases_updated_at
BEFORE UPDATE ON public.cases
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_consultor_areas_updated_at ON public.consultor_areas;
CREATE TRIGGER update_consultor_areas_updated_at
BEFORE UPDATE ON public.consultor_areas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();