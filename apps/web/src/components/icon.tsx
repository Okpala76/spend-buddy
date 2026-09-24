type IconName =
  'wallet' | 'arrow' | 'shield' | 'key' | 'code' | 'user' | 'check' | 'logout' | 'refresh';
const paths: Record<IconName, string> = {
  wallet: 'M20 8V5H5a3 3 0 0 0 0 6h15v9H5a3 3 0 0 1-3-3V8m18 6h-5v3h5m-3-2h.01',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  shield: 'M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Zm-4 9 3 3 5-6',
  key: 'M14 5a5 5 0 1 1-2 8l-8 8H2v-4l8-8a5 5 0 0 1 4-4Zm3 3h.01',
  code: 'm8 7-5 5 5 5m8-10 5 5-5 5m-3-13-2 20',
  user: 'M20 21v-2a6 6 0 0 0-6-6h-4a6 6 0 0 0-6 6v2m12-14a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  check: 'm5 12 4 4L19 6',
  logout: 'M9 4H4v16h5m5-13 5 5-5 5m-5-5h10',
  refresh: 'M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0 1 13 2M5 16a8 8 0 0 0 13 2',
};

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
