import { WA_LINK } from '../lib/constants';

type Props = { size?: number; label?: string; className?: string };

/**
 * Build-time-generated QR code. `scripts/generate-qr.cjs` writes the SVG to
 * `public/whatsapp-qr.svg`; we serve it from `/whatsapp-qr.svg`.
 */
export default function WhatsappQR({ size = 180, label = 'Scan to chat with our property bot', className = '' }: Props) {
  return (
    <a
      href={WA_LINK}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex flex-col items-center gap-3 group ${className}`}
    >
      <div
        className="rounded-xl bg-white p-3 shadow-elev group-hover:scale-[1.02] transition-transform"
        style={{ width: size, height: size }}
      >
        <img src="/whatsapp-qr.svg" alt="WhatsApp QR code for HomesConnect bot" className="w-full h-full" />
      </div>
      {label && <p className="text-xs text-soft text-center max-w-[200px]">{label}</p>}
    </a>
  );
}
