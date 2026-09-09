import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { enviarContato } from "@/lib/contato.functions";

type Campos = {
  nome: string;
  email: string;
  telefone: string;
  empresa: string;
  mensagem: string;
  website: string;
};

const vazio: Campos = { nome: "", email: "", telefone: "", empresa: "", mensagem: "", website: "" };

function validar(campos: Campos): Partial<Record<keyof Campos, string>> {
  const erros: Partial<Record<keyof Campos, string>> = {};
  if (campos.nome.trim().length < 2) erros.nome = "Informe seu nome.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(campos.email.trim()))
    erros.email = "Informe um e-mail válido.";
  if (campos.telefone.trim()) {
    const digitos = campos.telefone.replace(/\D/g, "").replace(/^0+/, "");
    const local = digitos.startsWith("55") && digitos.length > 11 ? digitos.slice(2) : digitos;
    if (local.length < 10 || local.length > 11)
      erros.telefone = "Telefone inválido. Use DDD + número.";
  }
  return erros;
}

export function ContatoForm({
  consultorSlug,
  consultorNome,
  origem,
}: {
  consultorSlug: string;
  consultorNome: string;
  origem?: string | null;
}) {
  const [campos, setCampos] = useState<Campos>(vazio);
  const [erros, setErros] = useState<Partial<Record<keyof Campos, string>>>({});
  const [aviso, setAviso] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      enviarContato({
        data: {
          consultorSlug,
          nome: campos.nome,
          email: campos.email,
          telefone: campos.telefone || null,
          empresa: campos.empresa || null,
          mensagem: campos.mensagem || null,
          origem: origem ?? null,
          website: campos.website || null,
        },
      }),
    onSuccess: (resultado) => {
      if (resultado.ok) {
        setSucesso(true);
        setAviso(null);
        setCampos(vazio);
        return;
      }
      setAviso(
        resultado.motivo === "rate_limit"
          ? "Você já enviou várias mensagens na última hora. Tente novamente mais tarde."
          : "Este perfil não está disponível para contato agora.",
      );
    },
    onError: (erro: Error) => setAviso(erro.message || "Não foi possível enviar. Tente de novo."),
  });

  const set = (campo: keyof Campos) => (valor: string) => {
    setCampos((atual) => ({ ...atual, [campo]: valor }));
    setErros((atual) => ({ ...atual, [campo]: undefined }));
  };

  if (sucesso) {
    return (
      <section className="mt-14 border-2 border-border p-6" aria-live="polite">
        <p className="u-eyebrow">Mensagem enviada</p>
        <h2 className="u-display mt-3 text-2xl">Recebemos seu contato</h2>
        <hr className="u-rule mt-4" />
        <p className="mt-6 text-sm text-muted-foreground">
          {consultorNome} vai receber sua mensagem e entrar em contato pelos dados informados.
        </p>
        <Button className="mt-6" variant="outline" onClick={() => setSucesso(false)}>
          Enviar outra mensagem
        </Button>
      </section>
    );
  }

  return (
    <section className="mt-14">
      <p className="u-eyebrow">Contato</p>
      <h2 className="u-display mt-3 text-2xl">Fale com {consultorNome}</h2>
      <hr className="u-rule mt-4" />

      <form
        className="mt-8 grid gap-5 sm:grid-cols-2"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const proximos = validar(campos);
          setErros(proximos);
          if (Object.keys(proximos).length > 0) return;
          setAviso(null);
          mutation.mutate();
        }}
      >
        <div className="grid gap-2">
          <Label htmlFor="contato-nome">Nome</Label>
          <Input
            id="contato-nome"
            value={campos.nome}
            onChange={(e) => set("nome")(e.target.value)}
            maxLength={120}
            aria-invalid={Boolean(erros.nome)}
            autoComplete="name"
          />
          {erros.nome && <p className="text-xs text-destructive">{erros.nome}</p>}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="contato-email">E-mail</Label>
          <Input
            id="contato-email"
            type="email"
            value={campos.email}
            onChange={(e) => set("email")(e.target.value)}
            maxLength={255}
            aria-invalid={Boolean(erros.email)}
            autoComplete="email"
          />
          {erros.email && <p className="text-xs text-destructive">{erros.email}</p>}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="contato-telefone">Telefone (opcional)</Label>
          <Input
            id="contato-telefone"
            inputMode="tel"
            value={campos.telefone}
            onChange={(e) => set("telefone")(e.target.value)}
            maxLength={40}
            aria-invalid={Boolean(erros.telefone)}
            autoComplete="tel"
          />
          {erros.telefone && <p className="text-xs text-destructive">{erros.telefone}</p>}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="contato-empresa">Empresa (opcional)</Label>
          <Input
            id="contato-empresa"
            value={campos.empresa}
            onChange={(e) => set("empresa")(e.target.value)}
            maxLength={120}
            autoComplete="organization"
          />
        </div>

        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="contato-mensagem">Mensagem (opcional)</Label>
          <Textarea
            id="contato-mensagem"
            rows={5}
            value={campos.mensagem}
            onChange={(e) => set("mensagem")(e.target.value)}
            maxLength={2000}
            aria-invalid={Boolean(erros.mensagem)}
          />
          {erros.mensagem && <p className="text-xs text-destructive">{erros.mensagem}</p>}
        </div>

        {/* Honeypot: invisível para pessoas, atrativo para bots. */}
        <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
          <label htmlFor="contato-website">Website</label>
          <input
            id="contato-website"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={campos.website}
            onChange={(e) => set("website")(e.target.value)}
          />
        </div>

        <div className="sm:col-span-2">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Enviando..." : "Enviar mensagem"}
          </Button>
          <p className="mt-3 text-xs text-muted-foreground">
            Seus dados serão usados apenas para que o consultor entre em contato com você.
          </p>
          {aviso && (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {aviso}
            </p>
          )}
        </div>
      </form>
    </section>
  );
}
