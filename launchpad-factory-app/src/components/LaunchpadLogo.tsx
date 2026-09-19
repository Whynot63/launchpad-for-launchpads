export function LaunchpadLogo({ name, logoUrl, accentColor, size = 48 }: { name: string; logoUrl: string; accentColor: string; size?: number }) {
  return logoUrl ? (
    <img src={logoUrl} alt="" width={size} height={size} className="shrink-0 rounded-xl object-cover" style={{ width: size, height: size }} />
  ) : (
    <span
      aria-hidden
      className="heading flex shrink-0 items-center justify-center rounded-xl text-ink"
      style={{ width: size, height: size, backgroundColor: accentColor, fontSize: size * 0.42 }}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}
