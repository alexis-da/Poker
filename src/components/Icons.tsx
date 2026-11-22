type IconName = 'home' | 'play' | 'target' | 'tools' | 'book' | 'chart' | 'spade';

const PATHS: Record<IconName, JSX.Element> = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  play: (
    <>
      <ellipse cx="12" cy="12" rx="9.5" ry="6.5" />
      <circle cx="12" cy="12" r="2" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.2" />
    </>
  ),
  tools: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 7h8M8 12h2M14 12h2M8 16h2M14 16h2" />
    </>
  ),
  book: <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 5v16M8 7h7" />,
  chart: <path d="M4 20V4M4 20h16M8 16l4-5 3 3 5-7" />,
  spade: <path d="M12 3c3 4 7 6 7 10a4 4 0 0 1-6.5 3.1L13.5 21h-3l1-4.9A4 4 0 0 1 5 13c0-4 4-6 7-10z" />,
};

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
