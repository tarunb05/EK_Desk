import { CheckIcon } from "@/components/shell/nav-icons";

// The app's one non-native checkbox look, extracted from the login page's
// "Remember me" checkbox so every checkbox in the app shares it instead of
// falling back to the browser's own default accent-color tick, which
// doesn't match --accent. appearance-none + peer-checked drives the check
// mark's own fade+scale-in -- same restrained, ~150ms convention as every
// other transition in the app, no dependency needed for a custom look.
// Pair with a sibling <label htmlFor={id}> the way every call site does --
// this renders the input + tick only, not the label text.
export function Checkbox({
  id,
  name,
  defaultChecked,
  className = "",
}: {
  id: string;
  name?: string;
  defaultChecked?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`relative flex h-4 w-4 shrink-0 items-center justify-center ${className}`}
    >
      <input
        id={id}
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
        className="peer h-4 w-4 shrink-0 appearance-none rounded border border-border bg-surface transition-colors duration-150 checked:border-accent checked:bg-accent focus-visible:outline-2 focus-visible:outline-accent"
      />
      <CheckIcon
        size={11}
        className="pointer-events-none absolute scale-90 text-surface opacity-0 transition-[opacity,transform] duration-150 peer-checked:scale-100 peer-checked:opacity-100"
      />
    </span>
  );
}
