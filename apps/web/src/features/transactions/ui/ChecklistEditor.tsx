import { Plus, Trash2 } from 'lucide-react';
import { Button, Form } from 'react-bootstrap';

export type ChecklistDraftItem = {
  key: string;
  text: string;
};

function newKey(): string {
  return `ck-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createEmptyChecklistItem(): ChecklistDraftItem {
  return { key: newKey(), text: '' };
}

/** Editor de líneas del checklist para el Agente (alta/baja de ítems). */
export function ChecklistEditor({
  items,
  onChange,
  maxItems = 20,
}: {
  items: ChecklistDraftItem[];
  onChange: (next: ChecklistDraftItem[]) => void;
  maxItems?: number;
}) {
  const updateText = (key: string, text: string) => {
    onChange(items.map((item) => (item.key === key ? { ...item, text } : item)));
  };

  const removeItem = (key: string) => {
    if (items.length <= 1) {
      onChange([{ key: items[0]?.key ?? newKey(), text: '' }]);
      return;
    }
    onChange(items.filter((item) => item.key !== key));
  };

  const addItem = () => {
    if (items.length >= maxItems) return;
    onChange([...items, createEmptyChecklistItem()]);
  };

  return (
    <div className="ca-checklist-editor">
      <Form.Label className="ca-checklist-editor__label">
        Checklist para el Agente
      </Form.Label>
      <p className="ca-checklist-editor__hint">
        Pasos que solo el Agente verá y verificará en la entrega.
      </p>
      <ul className="ca-checklist-editor__list">
        {items.map((item, index) => (
          <li key={item.key} className="ca-checklist-editor__row">
            <span className="ca-checklist-editor__index" aria-hidden>
              {index + 1}
            </span>
            <Form.Control
              value={item.text}
              placeholder={`Paso ${index + 1} (ej. Verificar encendido)`}
              maxLength={500}
              aria-label={`Ítem ${index + 1} del checklist`}
              onChange={(event) => updateText(item.key, event.target.value)}
            />
            <Button
              type="button"
              variant="outline-secondary"
              className="ca-checklist-editor__remove"
              aria-label={`Quitar ítem ${index + 1}`}
              onClick={() => removeItem(item.key)}
              disabled={items.length === 1 && !item.text.trim()}
            >
              <Trash2 size={16} strokeWidth={1.75} aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
      <Button
        type="button"
        variant="outline-primary"
        size="sm"
        className="ca-checklist-editor__add"
        onClick={addItem}
        disabled={items.length >= maxItems}
      >
        <Plus size={16} className="me-1" strokeWidth={1.75} aria-hidden />
        Agregar ítem
      </Button>
    </div>
  );
}

export function checklistDraftToPayload(items: ChecklistDraftItem[]): string[] | undefined {
  const cleaned = items.map((item) => item.text.trim()).filter(Boolean);
  return cleaned.length ? cleaned : undefined;
}
