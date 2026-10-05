"use client";

import { Button } from "@/components/ui/button";

export type SaveActionState = "idle" | "saving" | "saved" | "error";

/**
 * Shared save-button scheme for author tabs (T2.1): disabled while saving
 * or after a successful save; re-enabled only when the form/canvas is dirty.
 */
export function SaveActionButton({
  state,
  idleLabel = "Зберегти",
  savingLabel,
  onClick,
  type = "button",
  disabled,
  className,
  title,
  children,
}: {
  state: SaveActionState;
  idleLabel?: string;
  savingLabel?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
  title?: string;
  // OutputDataSaveBar's error-count pill, rendered after the label -- every
  // other caller omits this.
  children?: React.ReactNode;
}) {
  const label =
    state === "saving"
      ? savingLabel ?? "Збереження…"
      : state === "saved"
        ? "Збережено"
        : state === "error"
          ? "Повторити"
          : idleLabel;

  return (
    <Button
      type={type}
      onClick={onClick}
      loading={state === "saving"}
      disabled={disabled || state === "saving" || state === "saved"}
      className={className}
      title={title}
    >
      {label}
      {children}
    </Button>
  );
}
