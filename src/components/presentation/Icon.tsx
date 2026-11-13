import type { SVGProps } from "react";

type IconName =
  | "arrow"
  | "left"
  | "right"
  | "close"
  | "sun"
  | "moon"
  | "pause"
  | "play"
  | "menu"
  | "pin"
  | "mail"
  | "phone"
  | "external"
  | "plus"
  | "check";

const paths: Record<IconName, string> = {
  arrow: "M5 12h14m-6-6 6 6-6 6",
  left: "m14 5-7 7 7 7",
  right: "m10 5 7 7-7 7",
  close: "m6 6 12 12M18 6 6 18",
  sun: "M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M5.6 18.4 7 17m10-10 1.4-1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  moon: "M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z",
  pause: "M9 5v14m6-14v14",
  play: "m9 5 11 7-11 7Z",
  menu: "M4 7h16M4 12h16M4 17h16",
  pin: "M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0ZM14 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0",
  mail: "M3 5h18v14H3Zm0 1 9 7 9-7",
  phone: "m8 3 3 5-3 3a16 16 0 0 0 5 5l3-3 5 3-2 5C10 22 2 14 3 5Z",
  external: "M14 4h6v6m0-6-9 9m-1-9H4v16h16v-6",
  plus: "M12 5v14M5 12h14",
  check: "m5 12 4 4L19 6",
};

export default function Icon({
  name,
  ...props
}: SVGProps<SVGSVGElement> & { name: IconName }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name]} />
    </svg>
  );
}
