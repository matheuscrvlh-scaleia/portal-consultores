-- Métricas administrativas: agregação feita no banco, sempre gated por has_role admin.

CREATE OR REPLACE FUNCTION public.admin_metricas_resumo(_inicio timestamptz, _fim timestamptz)
RETURNS TABLE (
  leads bigint,
  leads_fechados bigint,
  cadastros bigint,
  buscas bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT count(*) FROM public.leads l WHERE l.created_at >= _inicio AND l.created_at < _fim),
    (SELECT count(*) FROM public.leads l WHERE l.created_at >= _inicio AND l.created_at < _fim AND l.status = 'fechado'),
    (SELECT count(*) FROM public.usuarios u WHERE u.created_at >= _inicio AND u.created_at < _fim),
    (SELECT count(*) FROM public.buscas b WHERE b.criado_em >= _inicio AND b.criado_em < _fim);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_metricas_leads_por_consultor(_inicio timestamptz, _fim timestamptz)
RETURNS TABLE (
  consultor_id uuid,
  consultor_nome text,
  total bigint,
  fechados bigint,
  taxa numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.nome,
    count(l.id),
    count(l.id) FILTER (WHERE l.status = 'fechado'),
    CASE WHEN count(l.id) = 0 THEN 0::numeric
         ELSE round((count(l.id) FILTER (WHERE l.status = 'fechado'))::numeric * 100 / count(l.id), 1)
    END
  FROM public.consultores c
  LEFT JOIN public.leads l
    ON l.consultor_id = c.id
   AND l.created_at >= _inicio
   AND l.created_at < _fim
  GROUP BY c.id, c.nome
  ORDER BY count(l.id) DESC, c.nome ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_metricas_buscas_por_area(_inicio timestamptz, _fim timestamptz)
RETURNS TABLE (
  area_id uuid,
  area_nome text,
  total bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT a.id, a.nome, count(b.id)
  FROM public.buscas b
  JOIN public.areas a ON a.id = b.area_id
  WHERE b.criado_em >= _inicio AND b.criado_em < _fim
  GROUP BY a.id, a.nome
  ORDER BY count(b.id) DESC, a.nome ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_metricas_termos(_inicio timestamptz, _fim timestamptz, _limite integer DEFAULT 20)
RETURNS TABLE (
  termo text,
  total bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT lower(btrim(b.termo)), count(*)
  FROM public.buscas b
  WHERE b.criado_em >= _inicio
    AND b.criado_em < _fim
    AND b.termo IS NOT NULL
    AND btrim(b.termo) <> ''
  GROUP BY lower(btrim(b.termo))
  ORDER BY count(*) DESC, lower(btrim(b.termo)) ASC
  LIMIT greatest(1, coalesce(_limite, 20));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_metricas_cadastros_por_dia(_inicio timestamptz, _fim timestamptz)
RETURNS TABLE (
  dia date,
  total bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT (u.created_at)::date, count(*)
  FROM public.usuarios u
  WHERE u.created_at >= _inicio AND u.created_at < _fim
  GROUP BY (u.created_at)::date
  ORDER BY (u.created_at)::date ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_metricas_resumo(timestamptz, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_metricas_leads_por_consultor(timestamptz, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_metricas_buscas_por_area(timestamptz, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_metricas_termos(timestamptz, timestamptz, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_metricas_cadastros_por_dia(timestamptz, timestamptz) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_metricas_resumo(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_metricas_leads_por_consultor(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_metricas_buscas_por_area(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_metricas_termos(timestamptz, timestamptz, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_metricas_cadastros_por_dia(timestamptz, timestamptz) TO authenticated;