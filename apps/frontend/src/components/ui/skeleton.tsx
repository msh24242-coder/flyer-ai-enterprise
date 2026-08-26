import { HTMLAttributes } from 'react';
import { twMerge } from 'tailwind-merge';

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={twMerge('skeleton rounded-lg', className)}
      {...props}
    />
  );
}
