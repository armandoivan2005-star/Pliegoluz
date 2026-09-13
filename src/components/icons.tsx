import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  strokeWidth: 1.8,
  viewBox: "0 0 24 24",
};

export function ArrowRightIcon(props: IconProps) {
  return <svg aria-hidden="true" {...base} {...props}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
}

export function ArrowLeftIcon(props: IconProps) {
  return <svg aria-hidden="true" {...base} {...props}><path d="M19 12H5m6 6-6-6 6-6" /></svg>;
}

export function BookmarkIcon(props: IconProps) {
  return <svg aria-hidden="true" {...base} {...props}><path d="M6.5 4.5A1.5 1.5 0 0 1 8 3h8a1.5 1.5 0 0 1 1.5 1.5V21L12 17.5 6.5 21V4.5Z" /></svg>;
}

export function BookOpenIcon(props: IconProps) {
  return <svg aria-hidden="true" {...base} {...props}><path d="M3.5 5.5A3.5 3.5 0 0 1 7 3h5v16H7a3.5 3.5 0 0 0-3.5 2V5.5ZM20.5 5.5A3.5 3.5 0 0 0 17 3h-5v16h5a3.5 3.5 0 0 1 3.5 2V5.5Z" /></svg>;
}

export function ClockIcon(props: IconProps) {
  return <svg aria-hidden="true" {...base} {...props}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>;
}

export function DownloadIcon(props: IconProps) {
  return <svg aria-hidden="true" {...base} {...props}><path d="M12 3v12m-4-4 4 4 4-4M5 20h14" /></svg>;
}

export function EyeIcon(props: IconProps) {
  return <svg aria-hidden="true" {...base} {...props}><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></svg>;
}

export function EyeOffIcon(props: IconProps) {
  return <svg aria-hidden="true" {...base} {...props}><path d="m3 3 18 18M10.6 6.1A9.7 9.7 0 0 1 12 6c6 0 9.5 6 9.5 6a15.4 15.4 0 0 1-2.2 2.8M6.2 6.2A16.2 16.2 0 0 0 2.5 12s3.5 6 9.5 6a9.2 9.2 0 0 0 3.1-.5M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>;
}

export function SunIcon(props: IconProps) {
  return <svg aria-hidden="true" {...base} {...props}><circle cx="12" cy="12" r="3.5" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>;
}

export function ListIcon(props: IconProps) {
  return <svg aria-hidden="true" {...base} {...props}><path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" /></svg>;
}

export function MoonIcon(props: IconProps) {
  return <svg aria-hidden="true" {...base} {...props}><path d="M20 15.7A8 8 0 0 1 8.3 4 8.2 8.2 0 1 0 20 15.7Z" /></svg>;
}

export function SearchIcon(props: IconProps) {
  return <svg aria-hidden="true" {...base} {...props}><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>;
}

export function SparkleIcon(props: IconProps) {
  return <svg aria-hidden="true" {...base} {...props}><path d="m12 3 1.3 3.7L17 8l-3.7 1.3L12 13l-1.3-3.7L7 8l3.7-1.3L12 3ZM18.5 14l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2ZM5 14l.6 1.6 1.6.6-1.6.6L5 18.4l-.6-1.6-1.6-.6 1.6-.6L5 14Z" /></svg>;
}

export function StarIcon(props: IconProps) {
  return <svg aria-hidden="true" {...base} {...props}><path d="m12 3 2.7 5.5 6 .9-4.4 4.2 1.1 6-5.4-2.8-5.4 2.8 1.1-6-4.4-4.2 6-.9L12 3Z" /></svg>;
}

export function TypeIcon(props: IconProps) {
  return <svg aria-hidden="true" {...base} {...props}><path d="M5 5h14M12 5v14M8.5 19h7" /></svg>;
}

export function UserIcon(props: IconProps) {
  return <svg aria-hidden="true" {...base} {...props}><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.7-4 3-6 7-6s6.3 2 7 6" /></svg>;
}
