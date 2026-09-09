import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

import { cn } from "@/lib/utils";
import type { MeuLead } from "@/lib/painel.functions";

export function formatarData(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function LeadCardConteudo({ lead }: { lead: MeuLead }) {
  return (
    <>
      <p className="text-sm font-semibold leading-tight">{lead.nome}</p>
      {lead.empresa ? <p className="mt-1 text-xs text-muted-foreground">{lead.empresa}</p> : null}
      {lead.mensagem ? (
        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{lead.mensagem}</p>
      ) : null}
      <p className="mt-3 text-[11px] uppercase tracking-wide text-muted-foreground">
        {formatarData(lead.criadoEm)}
      </p>
    </>
  );
}

/** Cartão estático usado no DragOverlay (sem listeners de arraste). */
export function LeadCardFantasma({ lead }: { lead: MeuLead }) {
  return (
    <article className="rotate-2 cursor-grabbing border border-border bg-card p-3 shadow-lg">
      <LeadCardConteudo lead={lead} />
    </article>
  );
}

export function LeadCard({ lead, onOpen }: { lead: MeuLead; onOpen: (lead: MeuLead) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
  });

  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        "cursor-grab border border-border bg-card p-3 shadow-sm outline-none transition-shadow",
        "focus-visible:ring-2 focus-visible:ring-ring",
        isDragging && "opacity-40",
      )}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(lead)}
    >
      <LeadCardConteudo lead={lead} />
      <button
        type="button"
        className="mt-2 text-[11px] uppercase tracking-wide underline"
        onClick={(event) => {
          event.stopPropagation();
          onOpen(lead);
        }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        Ver detalhes
      </button>
    </article>
  );
}
