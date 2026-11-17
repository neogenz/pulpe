/** The Android robot's head, drawn in `currentColor`. */
export function AndroidMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path
        fillRule="evenodd"
        d="M4.5 18a7.5 7.5 0 0 1 15 0Zm4-3a1 1 0 1 0 2 0a1 1 0 1 0-2 0Zm5 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0Z"
      />
      <path
        d="M7.6 11.9 6 9.4M16.4 11.9 18 9.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
