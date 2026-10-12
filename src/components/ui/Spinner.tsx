export function Spinner({ label, fullScreen }: { label?: string; fullScreen?: boolean }) {
  const spinner = (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary-100 border-t-primary" />
      {label && <p className="text-sm text-ink-secondary">{label}</p>}
    </div>
  );
  if (fullScreen) {
    return <div className="flex min-h-screen items-center justify-center">{spinner}</div>;
  }
  return spinner;
}
