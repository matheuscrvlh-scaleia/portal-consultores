ALTER TABLE public.conteudos
  ADD COLUMN titulo text NOT NULL,
  ADD COLUMN slug text NOT NULL,
  ADD COLUMN descricao text,
  ADD COLUMN video_path text,
  ADD COLUMN poster_path text;

CREATE UNIQUE INDEX conteudos_slug_key ON public.conteudos (slug);
CREATE INDEX conteudos_area_id_idx ON public.conteudos (area_id);
CREATE INDEX conteudos_consultor_id_idx ON public.conteudos (consultor_id);
CREATE INDEX conteudos_publicado_idx ON public.conteudos (publicado);

CREATE POLICY visualizacoes_self_read ON public.visualizacoes
  FOR SELECT TO authenticated
  USING (public.is_usuario_owner(usuario_id));