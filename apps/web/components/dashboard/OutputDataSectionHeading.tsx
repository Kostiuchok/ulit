// Same ✓/○ language as IsbnReadinessChecklist and every other readiness
// list on the output-data pages -- the circle sits left of the section's own
// vertical line (not inside it) so it reads as "status of everything past
// this line".
export function OutputDataSectionHeading({ label, done }: { label: string; done: boolean }) {
  return (
    <h2 className="flex items-center gap-2 text-base font-bold text-gray-900">
      <span className={done ? "text-green-600" : "text-amber-500"} title={done ? "Виконано" : "Ще не виконано"}>
        {done ? "✓" : "○"}
      </span>
      <span className="border-l-2 border-gray-900 pl-3">{label}</span>
    </h2>
  );
}
