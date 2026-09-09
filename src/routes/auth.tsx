import { createFileRoute, Link, stripSearchParams, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { accessQueryKey } from "@/hooks/use-auth";
import { bootstrapVisitante, getMyAccess } from "@/lib/auth.functions";

const searchSchema = z.object({
  redirect: fallback(z.string(), "").default(""),
});

/** Só aceita caminho interno; evita open redirect via parâmetro de URL. */
function destinoSeguro(valor: string): string | null {
  if (!valor.startsWith("/") || valor.startsWith("//")) return null;
  if (valor.startsWith("/auth")) return null;
  return valor;
}

export const Route = createFileRoute("/auth")({
  validateSearch: zodValidator(searchSchema),
  search: { middlewares: [stripSearchParams({ redirect: "" })] },

  head: () => ({
    meta: [
      { title: "Entrar ou criar conta — Portal dos Consultores" },
      {
        name: "description",
        content:
          "Acesse o Portal dos Consultores com e-mail e senha para acompanhar seus contatos e conteúdos.",
      },
      { property: "og:title", content: "Entrar ou criar conta — Portal dos Consultores" },
      {
        property: "og:description",
        content:
          "Acesse o Portal dos Consultores com e-mail e senha para acompanhar seus contatos e conteúdos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function traduzErro(message: string) {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (m.includes("user already registered") || m.includes("already been registered"))
    return "Este e-mail já possui conta. Use a aba Entrar.";
  if (m.includes("password should be at least"))
    return "A senha precisa ter pelo menos 6 caracteres.";
  if (m.includes("pwned") || m.includes("weak"))
    return "Essa senha é muito comum e já apareceu em vazamentos. Escolha outra.";
  if (m.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  if (m.includes("rate limit")) return "Muitas tentativas. Aguarde um instante e tente de novo.";
  return message;
}

function AuthPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-md">
        <p className="text-center text-sm text-muted-foreground">
          <Link to="/" className="underline underline-offset-4">
            Voltar ao início
          </Link>
        </p>

        <h1 className="mb-6 mt-6 text-center text-2xl font-semibold text-foreground">
          Portal dos Consultores
        </h1>

        <Tabs defaultValue="entrar">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="entrar">Entrar</TabsTrigger>
            <TabsTrigger value="criar">Criar conta</TabsTrigger>
          </TabsList>

          <TabsContent value="entrar">
            <SignInCard />
          </TabsContent>
          <TabsContent value="criar">
            <SignUpCard />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

function useAfterAuthRedirect() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { redirect: destinoBruto } = Route.useSearch();

  return async function redirect() {
    await queryClient.invalidateQueries({ queryKey: accessQueryKey });

    // Quem chegou por um link protegido volta para ele, independente do papel.
    const destino = destinoSeguro(destinoBruto);
    if (destino) return navigate({ href: destino, replace: true });

    try {
      const access = await getMyAccess();
      if (access.isAdmin) return navigate({ to: "/admin", replace: true });
      if (access.isConsultor) return navigate({ to: "/painel", replace: true });
    } catch {
      // Sem papel resolvido, segue para a home.
    }
    return navigate({ to: "/", replace: true });
  };
}

function SignInCard() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [enviando, setEnviando] = useState(false);
  const redirectAfterAuth = useAfterAuthRedirect();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setEnviando(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setEnviando(false);

    if (error) {
      toast.error(traduzErro(error.message));
      return;
    }
    toast.success("Bem-vindo de volta!");
    await redirectAfterAuth();
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Entrar</CardTitle>
        <CardDescription>Use o e-mail e a senha da sua conta.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="entrar-email">E-mail</Label>
            <Input
              id="entrar-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="entrar-senha">Senha</Label>
            <Input
              id="entrar-senha"
              type="password"
              autoComplete="current-password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={enviando}>
            {enviando ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function SignUpCard() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [senha, setSenha] = useState("");
  // Aceite de LGPD começa DESMARCADO — nunca pré-marcado.
  const [aceite, setAceite] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const redirectAfterAuth = useAfterAuthRedirect();

  const podeEnviar = aceite && nome.trim().length >= 2 && email.length > 0 && senha.length >= 6;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!aceite) return;

    setEnviando(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: { emailRedirectTo: window.location.origin, data: { nome } },
    });

    if (error) {
      setEnviando(false);
      toast.error(traduzErro(error.message));
      return;
    }

    if (!data.session) {
      setEnviando(false);
      toast.info("Conta criada. Verifique seu e-mail para confirmar o acesso.");
      return;
    }

    try {
      await bootstrapVisitante({
        data: {
          nome: nome.trim(),
          telefone: telefone.trim() || null,
          aceiteLgpd: true,
        },
      });
    } catch (err) {
      console.error(err);
      toast.error("Conta criada, mas não conseguimos salvar seus dados. Tente atualizar a página.");
    }

    setEnviando(false);
    toast.success("Conta criada com sucesso!");
    await redirectAfterAuth();
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Criar conta</CardTitle>
        <CardDescription>Leva menos de um minuto.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="criar-nome">Nome</Label>
            <Input
              id="criar-nome"
              autoComplete="name"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="criar-email">E-mail</Label>
            <Input
              id="criar-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="criar-telefone">Telefone (opcional)</Label>
            <Input
              id="criar-telefone"
              type="tel"
              autoComplete="tel"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="criar-senha">Senha</Label>
            <Input
              id="criar-senha"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Mínimo de 6 caracteres.</p>
          </div>

          <div className="flex items-start gap-3 rounded-md border border-border p-3">
            <Checkbox
              id="criar-lgpd"
              checked={aceite}
              onCheckedChange={(value) => setAceite(value === true)}
            />
            <Label htmlFor="criar-lgpd" className="text-xs leading-relaxed font-normal">
              Autorizo o tratamento dos meus dados pessoais para contato e uso da plataforma,
              conforme a{" "}
              <Link
                to="/privacidade"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4"
              >
                política de privacidade
              </Link>
              .
            </Label>
          </div>

          <Button type="submit" className="w-full" disabled={!podeEnviar || enviando}>
            {enviando ? "Criando conta..." : "Criar conta"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
