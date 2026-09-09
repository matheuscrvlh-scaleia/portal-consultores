# Lançamento do Portal dos Consultores

Checklist consolidado com o que ainda está pendente antes de publicar o portal. Itens concluídos foram removidos; duplicatas entre os arquivos anteriores foram unificadas aqui.

- [ ] Decidir o domínio definitivo (bloqueia os itens abaixo)
- [ ] Configurar domínio + forçar HTTPS
- [ ] Atualizar URL base em `sitemap.xml`, `robots.txt` e `llms.txt`
- [ ] Conferir URLs do sitemap no Google Search Console
- [ ] Rodar Lighthouse mobile na home e num perfil de consultor
- [ ] Validar JSON-LD (WebSite e Person) no Rich Results Test do Google
- [ ] Liberar/conectar provedor de e-mail (Resend da workspace)
- [ ] Implementar envio real em `notificarNovoLead` (hoje é stub)
- [ ] Configurar SPF/DKIM no domínio de envio, testar em mail-tester.com (meta ≥ 9/10)
- [ ] Decidir o fluxo de recuperação de senha, ou assumir a distribuição manual como definitiva
- [ ] Desligar a auto-confirmação de e-mail no cadastro
- [ ] Revisar juridicamente o texto de `/privacidade`
- [ ] Testar restauração de um backup do Supabase
