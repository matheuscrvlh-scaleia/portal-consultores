-- Enums
CREATE TYPE public.lead_status AS ENUM ('novo', 'em_contato', 'fechado', 'perdido');
CREATE TYPE public.conteudo_tipo AS ENUM ('video', 'texto');

-- updated_at trigger helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =========================
-- areas
-- =========================
CREATE TABLE public.areas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  nome TEXT NOT NULL,
  descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.areas TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.areas TO authenticated;
GRANT ALL ON public.areas TO service_role;

ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "areas_public_read" ON public.areas FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "areas_admin_insert" ON public.areas FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "areas_admin_update" ON public.areas FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "areas_admin_delete" ON public.areas FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_areas_updated_at BEFORE UPDATE ON public.areas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- consultores
-- =========================
CREATE TABLE public.consultores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID UNIQUE,
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  foto_path TEXT,
  bio TEXT,
  tempo_de_mercado INTEGER,
  telefone TEXT,
  redes JSONB NOT NULL DEFAULT '{}'::jsonb,
  video_path TEXT,
  publicado BOOLEAN NOT NULL DEFAULT false,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_consultores_publicado_ordem ON public.consultores (publicado, ordem);
CREATE INDEX idx_consultores_user_id ON public.consultores (user_id);

GRANT SELECT ON public.consultores TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consultores TO authenticated;
GRANT ALL ON public.consultores TO service_role;

ALTER TABLE public.consultores ENABLE ROW LEVEL SECURITY;

-- security definer: dono do perfil de consultor
CREATE OR REPLACE FUNCTION public.is_consultor_owner(_consultor_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.consultores c
    WHERE c.id = _consultor_id AND c.user_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.is_consultor_publicado(_consultor_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.consultores c
    WHERE c.id = _consultor_id AND c.publicado = true
  )
$$;

CREATE POLICY "consultores_public_read_publicado" ON public.consultores FOR SELECT TO anon, authenticated USING (publicado = true);
CREATE POLICY "consultores_owner_read" ON public.consultores FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "consultores_admin_read" ON public.consultores FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "consultores_owner_update" ON public.consultores FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "consultores_admin_insert" ON public.consultores FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "consultores_admin_update" ON public.consultores FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "consultores_admin_delete" ON public.consultores FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_consultores_updated_at BEFORE UPDATE ON public.consultores
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- consultor_areas
-- =========================
CREATE TABLE public.consultor_areas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  consultor_id UUID NOT NULL REFERENCES public.consultores(id) ON DELETE CASCADE,
  area_id UUID NOT NULL REFERENCES public.areas(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (consultor_id, area_id)
);

CREATE INDEX idx_consultor_areas_area ON public.consultor_areas (area_id);
CREATE INDEX idx_consultor_areas_consultor ON public.consultor_areas (consultor_id);

GRANT SELECT ON public.consultor_areas TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consultor_areas TO authenticated;
GRANT ALL ON public.consultor_areas TO service_role;

ALTER TABLE public.consultor_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consultor_areas_public_read" ON public.consultor_areas FOR SELECT TO anon, authenticated USING (public.is_consultor_publicado(consultor_id));
CREATE POLICY "consultor_areas_owner_read" ON public.consultor_areas FOR SELECT TO authenticated USING (public.is_consultor_owner(consultor_id));
CREATE POLICY "consultor_areas_admin_read" ON public.consultor_areas FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "consultor_areas_owner_write" ON public.consultor_areas FOR ALL TO authenticated USING (public.is_consultor_owner(consultor_id)) WITH CHECK (public.is_consultor_owner(consultor_id));
CREATE POLICY "consultor_areas_admin_write" ON public.consultor_areas FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_consultor_areas_updated_at BEFORE UPDATE ON public.consultor_areas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- cases
-- =========================
CREATE TABLE public.cases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  consultor_id UUID NOT NULL REFERENCES public.consultores(id) ON DELETE CASCADE,
  cliente TEXT NOT NULL,
  descricao TEXT,
  resultado TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cases_consultor ON public.cases (consultor_id);

GRANT SELECT ON public.cases TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cases TO authenticated;
GRANT ALL ON public.cases TO service_role;

ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cases_public_read" ON public.cases FOR SELECT TO anon, authenticated USING (public.is_consultor_publicado(consultor_id));
CREATE POLICY "cases_owner_read" ON public.cases FOR SELECT TO authenticated USING (public.is_consultor_owner(consultor_id));
CREATE POLICY "cases_admin_read" ON public.cases FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "cases_owner_write" ON public.cases FOR ALL TO authenticated USING (public.is_consultor_owner(consultor_id)) WITH CHECK (public.is_consultor_owner(consultor_id));
CREATE POLICY "cases_admin_write" ON public.cases FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_cases_updated_at BEFORE UPDATE ON public.cases
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- conteudos
-- =========================
CREATE TABLE public.conteudos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo public.conteudo_tipo NOT NULL,
  consultor_id UUID NOT NULL REFERENCES public.consultores(id) ON DELETE CASCADE,
  area_id UUID REFERENCES public.areas(id) ON DELETE SET NULL,
  publicado BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_conteudos_consultor ON public.conteudos (consultor_id);
CREATE INDEX idx_conteudos_area ON public.conteudos (area_id);
CREATE INDEX idx_conteudos_publicado ON public.conteudos (publicado);

GRANT SELECT ON public.conteudos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conteudos TO authenticated;
GRANT ALL ON public.conteudos TO service_role;

ALTER TABLE public.conteudos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conteudos_public_read" ON public.conteudos FOR SELECT TO anon, authenticated USING (publicado = true);
CREATE POLICY "conteudos_owner_read" ON public.conteudos FOR SELECT TO authenticated USING (public.is_consultor_owner(consultor_id));
CREATE POLICY "conteudos_admin_read" ON public.conteudos FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "conteudos_owner_write" ON public.conteudos FOR ALL TO authenticated USING (public.is_consultor_owner(consultor_id)) WITH CHECK (public.is_consultor_owner(consultor_id));
CREATE POLICY "conteudos_admin_write" ON public.conteudos FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_conteudos_updated_at BEFORE UPDATE ON public.conteudos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- leads
-- =========================
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  consultor_id UUID REFERENCES public.consultores(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  telefone TEXT,
  empresa TEXT,
  mensagem TEXT,
  status public.lead_status NOT NULL DEFAULT 'novo',
  origem TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_leads_consultor ON public.leads (consultor_id);
CREATE INDEX idx_leads_status ON public.leads (status);
CREATE INDEX idx_leads_created_at ON public.leads (created_at DESC);

GRANT INSERT ON public.leads TO anon;
GRANT SELECT, INSERT, UPDATE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leads_public_insert" ON public.leads FOR INSERT TO anon, authenticated WITH CHECK (status = 'novo');
CREATE POLICY "leads_owner_read" ON public.leads FOR SELECT TO authenticated USING (public.is_consultor_owner(consultor_id));
CREATE POLICY "leads_admin_read" ON public.leads FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "leads_owner_update" ON public.leads FOR UPDATE TO authenticated USING (public.is_consultor_owner(consultor_id)) WITH CHECK (public.is_consultor_owner(consultor_id));
CREATE POLICY "leads_admin_update" ON public.leads FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- usuarios
-- =========================
CREATE TABLE public.usuarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID UNIQUE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  telefone TEXT,
  consentimento_lgpd_em TIMESTAMPTZ,
  consentimento_lgpd_versao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_usuarios_user_id ON public.usuarios (user_id);

GRANT SELECT, INSERT, UPDATE ON public.usuarios TO authenticated;
GRANT ALL ON public.usuarios TO service_role;

ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuarios_self_read" ON public.usuarios FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "usuarios_admin_read" ON public.usuarios FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "usuarios_self_insert" ON public.usuarios FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "usuarios_self_update" ON public.usuarios FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER update_usuarios_updated_at BEFORE UPDATE ON public.usuarios
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- security definer: dono do registro de usuario
CREATE OR REPLACE FUNCTION public.is_usuario_owner(_usuario_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id = _usuario_id AND u.user_id = auth.uid()
  )
$$;

-- =========================
-- visualizacoes
-- =========================
CREATE TABLE public.visualizacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  conteudo_id UUID NOT NULL REFERENCES public.conteudos(id) ON DELETE CASCADE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_visualizacoes_conteudo ON public.visualizacoes (conteudo_id);
CREATE INDEX idx_visualizacoes_usuario ON public.visualizacoes (usuario_id);
CREATE INDEX idx_visualizacoes_criado_em ON public.visualizacoes (criado_em DESC);

GRANT SELECT, INSERT ON public.visualizacoes TO authenticated;
GRANT ALL ON public.visualizacoes TO service_role;

ALTER TABLE public.visualizacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "visualizacoes_self_insert" ON public.visualizacoes FOR INSERT TO authenticated WITH CHECK (public.is_usuario_owner(usuario_id));
CREATE POLICY "visualizacoes_admin_read" ON public.visualizacoes FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- =========================
-- buscas
-- =========================
CREATE TABLE public.buscas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  area_id UUID REFERENCES public.areas(id) ON DELETE SET NULL,
  termo TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_buscas_area ON public.buscas (area_id);
CREATE INDEX idx_buscas_criado_em ON public.buscas (criado_em DESC);

GRANT INSERT ON public.buscas TO anon;
GRANT SELECT, INSERT ON public.buscas TO authenticated;
GRANT ALL ON public.buscas TO service_role;

ALTER TABLE public.buscas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "buscas_public_insert" ON public.buscas FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "buscas_admin_read" ON public.buscas FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- =========================
-- EXECUTE em funcoes usadas pelas politicas
-- =========================
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_consultor_owner(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_consultor_publicado(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_usuario_owner(UUID) TO authenticated;