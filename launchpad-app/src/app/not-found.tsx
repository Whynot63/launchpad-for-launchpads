export default function NotFound() {
  return (
    <div className="flex flex-col items-start gap-3 py-16">
      <p className="eyebrow">404</p>
      <h1 className="heading text-3xl">Nothing Here Yet.</h1>
      <p className="text-muted">This launchpad or token does not exist. Check the address and try again.</p>
    </div>
  );
}
