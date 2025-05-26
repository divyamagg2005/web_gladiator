import type { SVGProps } from 'react';

export function GameLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <title>WebGladiator Logo</title>
      {/* A stylized gladiator helmet/shield shape */}
      <path d="M12 2L4 8v5c0 5 8 8 8 8s8-3 8-8V8L12 2z" />
      <path d="M12 10v4" />
      <path d="M9 12h6" />
    </svg>
  );
}
