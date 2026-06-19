import { forwardRef } from 'react';
import type { LucideProps } from 'lucide-react';

export const FortuneIntIcon = forwardRef<SVGSVGElement, LucideProps>(function FortuneIntIcon(
  { size = 16, className, ...props },
  ref,
) {
  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path d="M7 18h10" />
      <path d="M9 21h6" />
      <path d="M8.5 18a3.5 3.5 0 0 1 7 0" />
      <path d="M5.5 12a6.5 6.5 0 1 1 13 0c0 3.4-2.1 6-6.5 6s-6.5-2.6-6.5-6Z" />
      <path d="M9.75 9.5c.7-1.2 2.2-2.1 3.7-2.1 1.2 0 2.2.4 2.9 1.1" opacity="0.7" />
      <path d="m6.8 6.2.8.8" />
      <path d="M17.6 5.4v1.1" />
      <path d="m19.6 8.1-.8.8" />
    </svg>
  );
});
