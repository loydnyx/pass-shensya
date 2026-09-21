import { Lock } from "lucide-react";

/**
 * The animated lock seal, sized in em so it can stand in for a capital "O"
 * inside a display heading. Motion (ps-lock-*) lives in globals.css.
 * Pair it with an sr-only copy of the real text for screen readers.
 */
export default function LetterSeal() {
  return (
    <span aria-hidden="true" className="ps-o-seal ps-lock-float">
      <span className="lock-seal-ring ps-lock-ring absolute inset-0 rounded-full" />

      <span className="ps-lock-core ps-o-seal-core">
        <Lock strokeWidth={1.4} className="h-[54%] w-[54%] text-ink" />
      </span>
    </span>
  );
}