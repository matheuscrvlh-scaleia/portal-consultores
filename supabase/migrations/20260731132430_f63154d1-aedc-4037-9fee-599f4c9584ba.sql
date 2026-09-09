CREATE TABLE public.contato_rate_limit (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_hash text NOT NULL,
  janela_inicio timestamptz NOT NULL,
  contagem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ip_hash, janela_inicio)
);

GRANT ALL ON public.contato_rate_limit TO service_role;

ALTER TABLE public.contato_rate_limit ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_contato_rate_limit_updated_at
BEFORE UPDATE ON public.contato_rate_limit
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.registrar_tentativa_contato(_ip_hash text, _limite integer DEFAULT 5)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _janela timestamptz := date_trunc('hour', now());
  _contagem integer;
BEGIN
  INSERT INTO public.contato_rate_limit (ip_hash, janela_inicio, contagem)
  VALUES (_ip_hash, _janela, 1)
  ON CONFLICT (ip_hash, janela_inicio)
  DO UPDATE SET contagem = public.contato_rate_limit.contagem + 1, updated_at = now()
  RETURNING contagem INTO _contagem;

  DELETE FROM public.contato_rate_limit WHERE janela_inicio < now() - interval '2 days';

  RETURN _contagem <= _limite;
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_tentativa_contato(text, integer) TO service_role;