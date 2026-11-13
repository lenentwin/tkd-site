import { z } from "zod";
import { parseContent, type SiteContent } from "../../types/content";
import {
  getMedia,
  putMedia,
  MEDIA_TYPES,
  MAX_MEDIA_BYTES,
} from "./mediaStorage";

type Asset = { key: string; type: string; data: string };
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
export async function exportConfiguration(
  content: SiteContent,
  includeMedia: boolean,
): Promise<void> {
  const assets: Asset[] = [];
  if (includeMedia)
    for (const src of new Set(
      content.media
        .map((item) => item.src)
        .filter((src) => src.startsWith("idb:")),
    )) {
      const key = src.slice(4);
      const blob = await getMedia(key);
      if (!blob)
        throw new Error(
          "Одно из локальных изображений недоступно. Загрузите его повторно или экспортируйте только конфигурацию.",
        );
      assets.push({ key, type: blob.type, data: await blobToBase64(blob) });
    }
  const output = new Blob(
    [JSON.stringify({ format: "mft39-export-v1", content, assets }, null, 2)],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(output);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = includeMedia
    ? "mft39-with-images.json"
    : "mft39-content.json";
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const assetSchema = z.object({
  key: z.string().regex(/^[\w-]+$/),
  type: z.enum(MEDIA_TYPES as [string, ...string[]]),
  data: z
    .string()
    .max(Math.ceil(MAX_MEDIA_BYTES * 1.34))
    .regex(/^[A-Za-z0-9+/]*={0,2}$/),
});
export async function importConfiguration(file: File): Promise<SiteContent> {
  if (file.size > 60 * 1024 * 1024)
    throw new Error(
      "Файл больше 60 МБ. Импортируйте конфигурацию и загрузите крупные изображения отдельно.",
    );
  let value: unknown;
  try {
    value = JSON.parse(await file.text());
  } catch {
    throw new Error("Файл не является корректным JSON.");
  }
  const envelope = z
    .object({
      format: z.literal("mft39-export-v1"),
      content: z.unknown(),
      assets: z.array(assetSchema).max(200),
    })
    .safeParse(value);
  if (!envelope.success) return parseContent(value);
  const content = parseContent(envelope.data.content);
  const referenced = new Set(content.media.map((item) => item.src));
  for (const asset of envelope.data.assets) {
    if (!referenced.has(`idb:${asset.key}`)) continue;
    const binary = atob(asset.data);
    const bytes = Uint8Array.from(binary, (character) =>
      character.charCodeAt(0),
    );
    await putMedia(asset.key, new Blob([bytes], { type: asset.type }));
  }
  return content;
}
