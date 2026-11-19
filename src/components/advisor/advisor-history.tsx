"use client";

import { MessageSquare, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { AdvisorConversationDTO } from "@/lib/advisor/types";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export function AdvisorHistory({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onClear,
  confirmingDeleteId,
  onConfirmDelete,
  confirmingClear,
  onConfirmClear,
  busy,
}: {
  conversations: AdvisorConversationDTO[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onClear: () => void;
  confirmingDeleteId: string | null;
  onConfirmDelete: (id: string | null) => void;
  confirmingClear: boolean;
  onConfirmClear: (value: boolean) => void;
  busy: boolean;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Conversations</p>
          <p className="text-muted-foreground text-[11px]">
            {conversations.length} saved on this device account
          </p>
        </div>
        <Button
          size="icon-sm"
          variant="outline"
          onClick={onNew}
          aria-label="New conversation"
        >
          <Plus aria-hidden="true" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
        {conversations.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-3 text-xs">
            No conversations yet. Ask a question to start one.
          </p>
        ) : (
          conversations.map((conversation) => {
            const active = conversation.id === activeId;
            const confirming = confirmingDeleteId === conversation.id;
            return (
              <div
                key={conversation.id}
                className={cn(
                  "group flex items-center gap-1 rounded-lg border p-1 transition-colors",
                  active
                    ? "bg-accent border-accent"
                    : "hover:bg-muted border-transparent",
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect(conversation.id)}
                  className="focus-visible:ring-ring/40 flex min-w-0 flex-1 items-start gap-2 rounded-md px-2 py-2 text-left outline-none focus-visible:ring-2"
                >
                  <MessageSquare
                    aria-hidden="true"
                    className="text-muted-foreground mt-0.5 size-3.5 shrink-0"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-[12.5px] font-medium">
                      {conversation.title}
                    </span>
                    <span className="text-muted-foreground block text-[10.5px]">
                      {formatDateTime(conversation.updatedAt)}
                    </span>
                  </span>
                </button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant={confirming ? "destructive" : "ghost"}
                  disabled={busy}
                  aria-label={
                    confirming
                      ? `Confirm delete ${conversation.title}`
                      : `Delete ${conversation.title}`
                  }
                  onClick={() =>
                    onConfirmDelete(confirming ? null : conversation.id)
                  }
                >
                  <Trash2 aria-hidden="true" />
                </Button>
                {confirming ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={busy}
                    onClick={() => onDelete(conversation.id)}
                  >
                    Confirm
                  </Button>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      <div className="border-border mt-3 border-t pt-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          disabled={busy || conversations.length === 0}
          onClick={() => onConfirmClear(!confirmingClear)}
        >
          <Trash2 aria-hidden="true" />
          {confirmingClear ? "Confirm clear all" : "Clear all history"}
        </Button>
        {confirmingClear ? (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="mt-1 w-full"
            disabled={busy}
            onClick={onClear}
          >
            Permanently clear history
          </Button>
        ) : null}
      </div>
    </div>
  );
}
