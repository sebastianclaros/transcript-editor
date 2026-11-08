import type { ReactNode } from "react";

function Icon({ children, size = 18 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}
export const IcPlay = () => (
  <Icon>
    <path d="M8 5v14l11-7z" />
  </Icon>
);
export const IcPause = () => (
  <Icon>
    <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
  </Icon>
);
export const IcPrev = () => (
  <Icon>
    <path d="M6 5h2v14H6zM20 5v14L9 12z" />
  </Icon>
);
export const IcNext = () => (
  <Icon>
    <path d="M16 5h2v14h-2zM4 5v14l11-7z" />
  </Icon>
);
export const IcBack = () => (
  <Icon>
    <path d="M11 6v12L2.5 12zM21 6v12l-8.5-6z" />
  </Icon>
);
export const IcFwd = () => (
  <Icon>
    <path d="M13 6v12l8.5-6zM3 6v12l8.5-6z" />
  </Icon>
);
export const IcPersonas = () => (
  <Icon>
    <path d="M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 2c-2.3 0-7 1.2-7 3.5V19h14v-2.5C15 14.2 10.3 13 8 13zm8 0c-.3 0-.6 0-1 .1 1.2.8 2 2 2 3.4V19h6v-2.5c0-2.3-4.7-3.5-7-3.5z" />
  </Icon>
);
export const IcMenu = () => (
  <Icon>
    <path d="M3 6h18v2H3zM3 11h18v2H3zM3 16h18v2H3z" />
  </Icon>
);
