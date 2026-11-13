import { useState, type ReactNode } from "react";
import { ObjectFields } from "./Fields";

type Item = { id: string };
export function CollectionEditor<T extends Item>({
  title,
  items,
  path,
  createItem,
  onItems,
  onChange,
  renderExtra,
  minItems = 0,
  reorder = true,
}: {
  title: string;
  items: T[];
  path: string;
  createItem?: () => T;
  onItems: (items: T[]) => void;
  onChange: (path: (string | number)[], value: unknown) => void;
  renderExtra?: (item: T, index: number) => ReactNode;
  minItems?: number;
  reorder?: boolean;
}) {
  const [selectedId, setSelectedId] = useState(items[0]?.id ?? "");
  const selected = Math.max(
    0,
    items.findIndex((item) => item.id === selectedId),
  );
  const active = items[selected];
  function move(direction: number) {
    const next = [...items];
    [next[selected], next[selected + direction]] = [
      next[selected + direction],
      next[selected],
    ];
    onItems(
      next.map((item, order) => ("order" in item ? { ...item, order } : item)),
    );
  }
  return (
    <section className="editor-collection">
      <div className="editor-panel-heading">
        <h2>{title}</h2>
        {createItem && (
          <button
            type="button"
            className="editor-small-button"
            onClick={() => {
              const item = createItem();
              onItems([...items, item]);
              setSelectedId(item.id);
            }}
          >
            Добавить
          </button>
        )}
      </div>
      <div className="editor-item-list" aria-label={title}>
        {items.map((item, index) => {
          const record = item as T & {
            name?: string;
            title?: string;
            author?: string;
          };
          return (
            <button
              type="button"
              className={active?.id === item.id ? "is-active" : ""}
              key={item.id}
              onClick={() => setSelectedId(item.id)}
            >
              {record.name ||
                record.title ||
                record.author ||
                `${title}: ${index + 1}`}
            </button>
          );
        })}
      </div>
      {active ? (
        <div key={active.id} className="editor-item-detail">
          <div className="editor-item-actions">
            <code>{active.id}</code>
            {reorder && (
              <>
                <button
                  type="button"
                  aria-label="Переместить выше"
                  disabled={selected === 0}
                  onClick={() => move(-1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label="Переместить ниже"
                  disabled={selected === items.length - 1}
                  onClick={() => move(1)}
                >
                  ↓
                </button>
              </>
            )}
            {createItem && (
              <button
                type="button"
                disabled={items.length <= minItems}
                onClick={() => {
                  onItems(items.filter((item) => item.id !== active.id));
                  setSelectedId(items[Math.max(0, selected - 1)]?.id ?? "");
                }}
              >
                Удалить
              </button>
            )}
          </div>
          {renderExtra?.(active, selected)}
          <ObjectFields
            value={active as unknown as Record<string, unknown>}
            path={[path, selected]}
            onChange={onChange}
          />
        </div>
      ) : (
        <p className="editor-help">
          Пока ничего не добавлено. Используйте кнопку «Добавить» и вводите
          только подтверждённые сведения.
        </p>
      )}
    </section>
  );
}
