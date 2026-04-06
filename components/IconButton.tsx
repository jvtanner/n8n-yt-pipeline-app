'use client';

type IconType = 'copy' | 'edit' | 'bookmark' | 'bookmarkFilled' | 'check' | 'refresh';

const ICONS: Record<IconType, string> = {
  copy: '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  edit: '<path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
  bookmark: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
  bookmarkFilled: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" fill="currentColor"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  refresh: '<path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>',
};

interface IconButtonProps {
  icon: IconType;
  onClick: () => void;
  title?: string;
  size?: number;
  label?: string;
  active?: boolean;
  className?: string;
}

export default function IconButton({ icon, onClick, title, size = 14, label, active, className = '' }: IconButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`flex items-center gap-1.5 bg-transparent border-none cursor-pointer transition-colors ${
        active ? 'text-orange-500' : 'text-zinc-500 hover:text-zinc-300'
      } ${className}`}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        dangerouslySetInnerHTML={{ __html: ICONS[icon] }}
      />
      {label && <span className="text-xs">{label}</span>}
    </button>
  );
}
