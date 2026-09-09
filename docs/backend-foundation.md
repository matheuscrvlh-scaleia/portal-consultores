# Fundação de backend — Portal dos Consultores

Status da etapa de infraestrutura.

## Concluído

- **Lovable Cloud ativado** e conectado ao projeto.
- **Buckets criados**:
  - `fotos-publico` — acesso via RLS, leitura pública.
  - `videos-privado` — acesso apenas via URL assinada, sem leitura direta.
  - Ambos estão privados no nível do bucket porque a workspace bloqueia buckets públicos.
- **Papéis de usuário** criados:
  - Enum `public.app_role`: `admin`, `consultor`, `visitante`.
  - Tabela `public.user_roles` (separada do perfil, conforme boas práticas).
  - Função `public.has_role(_user_id, _role)` (security definer) para uso em políticas RLS.
- **RLS deny-by-default**:
  - `public.user_roles` com RLS ativado e política de leitura escrita.
  - `storage.objects` já vem com RLS ativado por padrão; as políticas foram aplicadas por migration.
- **Políticas de storage aplicadas**:
  - `fotos-publico` — leitura liberada para qualquer visitante; envio, alteração e remoção só pelo dono do arquivo ou admin autenticado.
  - `videos-privado` — leitura restrita: anônimos só alcançam a pasta `perfil/` (vídeo do perfil público), autenticados alcançam também a `biblioteca/`, e envio/alteração/remoção só pelo dono ou admin. A entrega dos vídeos continua por URL assinada de curta duração gerada no servidor.
- **Server functions para URLs assinadas** em `src/lib/storage.functions.ts`:
  - `getPublicProfileVideoUrl` — vídeos do prefixo `perfil/`, pode ser chamada por anônimos.
  - `getLibraryVideoUrl` — vídeos do prefixo `biblioteca/`, exige autenticação.
- **Validação de tamanho e tipo** em `src/lib/storage.validators.ts`:
  - Fotos: 5 MB, JPEG/PNG/WebP.
  - Vídeos: 50 MB, MP4/WebM/MOV.
- **Bearer token middleware** registrado em `src/start.ts` para proteger server functions autenticadas.

## Próxima etapa

A fundação está completa. Próximo passo: o **modelo de dados** (consultores, áreas de atuação, portfólio, leads, métricas).
