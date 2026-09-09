import { createFileRoute, Link } from "@tanstack/react-router";

import {
  POLITICA_PRIVACIDADE_ATUALIZADA_EM,
  POLITICA_PRIVACIDADE_CONTATO,
  POLITICA_PRIVACIDADE_VERSAO,
} from "@/lib/legal";

const DESCRICAO =
  "Como o Portal dos Consultores coleta, usa, compartilha e retém dados pessoais, e quais são os direitos do titular segundo a LGPD.";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — Portal dos Consultores" },
      { name: "description", content: DESCRICAO },
      { property: "og:title", content: "Política de Privacidade — Portal dos Consultores" },
      { property: "og:description", content: DESCRICAO },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PrivacidadePage,
});

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="u-display text-xl">{titulo}</h2>
      <div className="u-rule mt-3 w-16" />
      <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function PrivacidadePage() {
  return (
    <main className="px-4 py-12 sm:px-6 sm:py-16">
      <article className="mx-auto max-w-3xl">
        <p className="text-sm text-muted-foreground">
          <Link to="/" className="underline underline-offset-4">
            Voltar ao início
          </Link>
        </p>

        <p className="u-eyebrow mt-8">Documento legal</p>
        <h1 className="u-display mt-3 text-3xl md:text-4xl">Política de Privacidade</h1>
        <div className="u-rule mt-4 w-24" />
        <p className="mt-4 text-sm text-muted-foreground">
          Versão {POLITICA_PRIVACIDADE_VERSAO} — atualizada em {POLITICA_PRIVACIDADE_ATUALIZADA_EM}
        </p>

        <div className="surface-red mt-8 p-5">
          <p className="text-sm leading-relaxed">
            <strong>Versão inicial.</strong> Este texto é um rascunho de referência, escrito para
            estruturar o tema e permitir o funcionamento do aceite de consentimento. Ele ainda{" "}
            <strong>precisa de revisão jurídica</strong> antes da publicação definitiva do portal e
            pode mudar sem aviso até lá.
          </p>
        </div>

        <Secao titulo="1. Quais dados coletamos">
          <p>
            <strong>Dados de cadastro:</strong> nome, e-mail, telefone (opcional) e senha (guardada
            apenas de forma criptografada pelo serviço de autenticação).
          </p>
          <p>
            <strong>Dados de solicitação de contato:</strong> nome, e-mail, telefone, empresa e a
            mensagem enviada a um consultor.
          </p>
          <p>
            <strong>Dados de consentimento:</strong> data, hora e versão desta política aceita no
            momento do cadastro.
          </p>
          <p>
            <strong>Dados de uso:</strong> áreas e termos pesquisados e conteúdos visualizados,
            usados de forma agregada para entender a navegação.
          </p>
        </Secao>

        <Secao titulo="2. Para que usamos">
          <p>
            Para criar e manter sua conta, permitir que você encontre consultores, encaminhar sua
            solicitação de contato ao consultor escolhido, comunicar assuntos relacionados ao seu
            pedido e melhorar a organização do portal.
          </p>
          <p>Não vendemos dados pessoais e não usamos os dados para publicidade de terceiros.</p>
        </Secao>

        <Secao titulo="3. Quem tem acesso">
          <p>
            <strong>O consultor destinatário</strong> acessa apenas as solicitações de contato
            enviadas a ele.
          </p>
          <p>
            <strong>A administração do portal</strong> acessa os dados necessários para operar a
            plataforma e acompanhar métricas.
          </p>
          <p>
            <strong>Prestadores de infraestrutura</strong> (hospedagem, banco de dados,
            autenticação, envio de e-mail) tratam os dados exclusivamente para prestar esses
            serviços.
          </p>
        </Secao>

        <Secao titulo="4. Por quanto tempo guardamos">
          <p>
            Dados de conta: enquanto a conta existir e por até 5 anos após o encerramento, quando
            houver obrigação legal de retenção.
          </p>
          <p>
            Solicitações de contato: por até 5 anos, para histórico de relacionamento comercial.
          </p>
          <p>
            Registros de consentimento: pelo mesmo prazo dos dados a que se referem, como prova do
            aceite.
          </p>
          <p>Dados de uso agregados: por prazo indeterminado, sem identificação do titular.</p>
        </Secao>

        <Secao titulo="5. Direitos do titular">
          <p>
            Conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), você pode solicitar:
            confirmação da existência de tratamento; acesso aos seus dados; correção de dados
            incompletos ou desatualizados; anonimização, bloqueio ou eliminação de dados
            desnecessários ou tratados em desconformidade; portabilidade; informação sobre com quem
            compartilhamos seus dados; e revogação do consentimento.
          </p>
          <p>
            Pedidos são atendidos em prazo razoável, após verificação da identidade de quem solicita.
          </p>
        </Secao>

        <Secao titulo="6. Contato">
          <p>
            Para exercer seus direitos ou tirar dúvidas sobre esta política, escreva para{" "}
            <a
              href={`mailto:${POLITICA_PRIVACIDADE_CONTATO}`}
              className="underline underline-offset-4"
            >
            {POLITICA_PRIVACIDADE_CONTATO}
            </a>
            .
          </p>
        </Secao>
      </article>
    </main>
  );
}
