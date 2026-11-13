import type { ReactNode } from "react";
import { DisplayText } from "./DisplayText";

export function SectionHeading({
  title,
  intro,
  aside,
}: {
  title: string;
  intro?: string;
  aside?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        <h2><DisplayText text={title} /></h2>
        {intro ? <p><DisplayText text={intro} /></p> : null}
      </div>
      {aside ? <div className="section-heading-aside">{aside}</div> : null}
    </div>
  );
}

export function PageIntro({
  title,
  description,
  label,
}: {
  title: string;
  description?: string;
  label?: string;
}) {
  return (
    <header className="page-intro container">
      {label ? <p className="eyebrow"><DisplayText text={label} /></p> : null}
      <h1><DisplayText text={title} /></h1>
      {description ? <p><DisplayText text={description} /></p> : null}
    </header>
  );
}
