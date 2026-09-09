import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LEAD_STATUS, type LeadStatus, type MeuLead } from "@/lib/painel.functions";

import { formatarData } from "./lead-card";

export const STATUS_LABEL: Record<LeadStatus, string> = {
  novo: "Novo",
  em_contato: "Em contato",
  fechado: "Fechado",
  perdido: "Perdido",
};

const STATUS_VARIANT: Record<LeadStatus, "default" | "secondary" | "outline"> = {
  novo: "default",
  em_contato: "secondary",
  fechado: "outline",
  perdido: "outline",
};

type Props = {
  lead: MeuLead | null;
  onOpenChange: (aberto: boolean) => void;
  onStatusChange: (status: LeadStatus) => void;
};

export function LeadDetalheDialog({ lead, onOpenChange, onStatusChange }: Props) {
  return (
    <Dialog open={lead !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        {lead ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-3">
                {lead.nome}
                <Badge variant={STATUS_VARIANT[lead.status]}>{STATUS_LABEL[lead.status]}</Badge>
              </DialogTitle>
              <DialogDescription>
                Recebido em {formatarData(lead.criadoEm)}
                {lead.origem ? ` · origem: ${lead.origem}` : ""}
              </DialogDescription>
            </DialogHeader>

            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase text-muted-foreground">E-mail</dt>
                <dd>
                  <a className="underline" href={`mailto:${lead.email}`}>
                    {lead.email}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted-foreground">Telefone</dt>
                <dd>
                  {lead.telefone ? (
                    <a className="underline" href={`tel:${lead.telefone}`}>
                      {lead.telefone}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">Não informado</span>
                  )}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs uppercase text-muted-foreground">Empresa</dt>
                <dd>
                  {lead.empresa ?? <span className="text-muted-foreground">Não informada</span>}
                </dd>
              </div>
            </dl>

            {lead.mensagem ? (
              <div className="text-sm">
                <p className="text-xs uppercase text-muted-foreground">Mensagem</p>
                <p className="mt-1 whitespace-pre-line">{lead.mensagem}</p>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <label className="text-xs uppercase text-muted-foreground" htmlFor="status-lead">
                Status
              </label>
              <Select
                value={lead.status}
                onValueChange={(valor) => onStatusChange(valor as LeadStatus)}
              >
                <SelectTrigger id="status-lead" className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_STATUS.map((valor) => (
                    <SelectItem key={valor} value={valor}>
                      {STATUS_LABEL[valor]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
