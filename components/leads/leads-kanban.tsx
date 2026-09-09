import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useState } from "react";

import { cn } from "@/lib/utils";
import { LEAD_STATUS, type LeadStatus, type MeuLead } from "@/lib/painel.functions";

import { LeadCard, LeadCardFantasma } from "./lead-card";
import { STATUS_LABEL } from "./lead-detalhe-dialog";

function Coluna({
  status,
  leads,
  destacada,
  onOpen,
}: {
  status: LeadStatus;
  leads: MeuLead[];
  destacada: boolean;
  onOpen: (lead: MeuLead) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <section
      ref={setNodeRef}
      aria-label={`Coluna ${STATUS_LABEL[status]}`}
      className={cn(
        "flex w-72 shrink-0 flex-col border border-border p-3 transition-colors",
        status === "em_contato" && "bg-lead-contact",
        status === "fechado" && "bg-lead-closed",
        status === "perdido" && "bg-lead-lost",
        status === "novo" && "bg-muted/30",
        isOver && "border-primary bg-primary/5",
        destacada && !isOver && "border-primary",
      )}
    >
      <header className="flex items-center justify-between gap-2 pb-3">
        <h2 className="u-eyebrow">{STATUS_LABEL[status]}</h2>
        <span className="text-xs text-muted-foreground">{leads.length}</span>
      </header>

      <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
        {leads.length === 0 ? (
          <p className="border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            Nenhum lead aqui
          </p>
        ) : (
          leads.map((lead) => <LeadCard key={lead.id} lead={lead} onOpen={onOpen} />)
        )}
      </div>
    </section>
  );
}

export function LeadsKanban({
  leads,
  destaque,
  onOpen,
  onMover,
}: {
  leads: MeuLead[];
  destaque: LeadStatus | null;
  onOpen: (lead: MeuLead) => void;
  onMover: (id: string, status: LeadStatus) => void;
}) {
  const [arrastando, setArrastando] = useState<MeuLead | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  function handleStart(event: DragStartEvent) {
    setArrastando((event.active.data.current?.lead as MeuLead | undefined) ?? null);
  }

  function handleEnd(event: DragEndEvent) {
    const lead = event.active.data.current?.lead as MeuLead | undefined;
    setArrastando(null);
    const destino = event.over?.id as LeadStatus | undefined;
    if (!lead || !destino || destino === lead.status) return;
    onMover(lead.id, destino);
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleStart}
      onDragEnd={handleEnd}
      onDragCancel={() => setArrastando(null)}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {LEAD_STATUS.map((status) => (
          <Coluna
            key={status}
            status={status}
            destacada={destaque === status}
            leads={leads.filter((lead) => lead.status === status)}
            onOpen={onOpen}
          />
        ))}
      </div>
      <DragOverlay>{arrastando ? <LeadCardFantasma lead={arrastando} /> : null}</DragOverlay>
    </DndContext>
  );
}
