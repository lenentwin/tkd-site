import { Fragment } from "react";

/** Presentation only: keep original CMS data and punctuation inside ranges intact. */
export function formatDisplayText(text: string): string {
  return text.replace(/[\t \r\n]*—[\t \r\n]*/g, "\n");
}

export function DisplayText({ text }: { text: string }) {
  return formatDisplayText(text).split(/\r?\n/).map((line, index) => (
    <Fragment key={index}>
      {index > 0 ? <br /> : null}
      {line}
    </Fragment>
  ));
}
