/** Motion graphics for the landing page that are not tied to scroll. */

/** An arrow with packets flowing along it, for the architecture diagram:
 *  downward when the diagram stacks on phones, rightward on wide screens.
 *  Plain css keyframes (index.css), so reduced motion stops them too. */
export function FlowArrow({ label }: { label: string }) {
  return (
    <div className="flex shrink-0 flex-col items-center justify-center gap-1 px-1 py-2 lg:py-0" aria-hidden="true">
      <div className="relative h-9 w-0.5 overflow-hidden rounded-full bg-line lg:h-0.5 lg:w-14">
        <span className="flow-dot" />
        <span className="flow-dot [animation-delay:0.6s]" />
      </div>
      <span className="text-[10px] font-medium tracking-[0.04em] text-ink-faint uppercase">{label}</span>
    </div>
  );
}
