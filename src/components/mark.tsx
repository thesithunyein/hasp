export function Mark() {
  return (
    <div className="mark h-16 w-16" aria-hidden="true">
      <div className="mark-inner relative h-16 w-16">
        <svg className="mark-back absolute inset-0 text-line" viewBox="0 0 64 64" fill="none">
          <rect x="10" y="20" width="44" height="28" rx="4" stroke="currentColor" strokeWidth="1.5" />
          <rect x="24" y="12" width="16" height="36" rx="8" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        <svg className="absolute inset-0 text-ink" viewBox="0 0 64 64" fill="none">
          <rect x="10" y="20" width="44" height="28" rx="4" stroke="currentColor" strokeWidth="1.5" />
          <rect x="24" y="12" width="16" height="36" rx="8" stroke="var(--color-clasp)" strokeWidth="1.5" />
          <circle cx="32" cy="34" r="2.2" fill="var(--color-clasp)" />
        </svg>
      </div>
    </div>
  );
}
