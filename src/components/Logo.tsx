export default function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`font-display text-2xl md:text-3xl tracking-tight ${className}`}>
      <span className="text-white">Homes</span>
      <span style={{ color: '#1A6B5C' }} className="font-semibold">Connect</span>
    </span>
  );
}
