import { useEffect, useState } from "react";
import { getMedia } from "../editor/persistence/mediaStorage";

export function useMediaSource(src: string): string {
  const [resolved, setResolved] = useState<{ key: string; url: string }>({
    key: "",
    url: "",
  });
  useEffect(() => {
    if (!src.startsWith("idb:")) return;
    let active = true;
    let url = "";
    void getMedia(src.slice(4))
      .then((blob) => {
        if (blob && active) {
          url = URL.createObjectURL(blob);
          setResolved({ key: src, url });
        }
      })
      .catch(() => {
        if (active) setResolved({ key: src, url: "" });
      });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [src]);
  return src.startsWith("idb:")
    ? resolved.key === src
      ? resolved.url
      : ""
    : src;
}
