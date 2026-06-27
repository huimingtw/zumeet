export function EnvBadge() {
  const env = import.meta.env.VITE_APP_ENV;
  if (!env || env === "production") return null;

  return (
    <span className="rounded-md bg-warning-100 px-2 py-0.5 text-xs font-medium text-warning-800">
      {env}
    </span>
  );
}
