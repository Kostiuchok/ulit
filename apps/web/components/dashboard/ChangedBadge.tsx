import { Badge } from "@/components/ui/badge";

function fieldsWord(n: number): string {
  const d10 = n % 10;
  const d100 = n % 100;
  if (d10 === 1 && d100 !== 11) return "поле";
  if (d10 >= 2 && d10 <= 4 && (d100 < 12 || d100 > 14)) return "поля";
  return "полів";
}

// Amber "Змінено · N" marker for a block with unsaved changes -- the same
// visual rule on every "Вихідні дані" page (WF-SPEC 03/05/06/07): the block
// gets a border-amber-400 border and this badge next to its title. `label`
// replaces the auto-pluralised "поле/поля/полів" when a block wants its own
// wording (e.g. "поле → 4 ціни").
export function ChangedBadge({ count, label }: { count: number; label?: string }) {
  return (
    <Badge className="rounded-sm bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800 hover:bg-amber-100">
      Змінено · {count} {label ?? fieldsWord(count)}
    </Badge>
  );
}
