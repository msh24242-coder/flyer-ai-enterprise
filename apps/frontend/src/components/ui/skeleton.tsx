import { HTMLAttributes } from 'react';
import { twMerge } from 'tailwind-merge';

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={twMerge('animate-pulse rounded-md bg-gray-200', className)}
      {...props}
    />
  );
}
