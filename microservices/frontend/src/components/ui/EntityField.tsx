import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface EntityFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Open in edit mode, used for a detail the person is adding by hand. */
  startEditing?: boolean;
}

/** A detail extracted from evidence (UTR, UPI ID...). The user always confirms or edits it. */
export function EntityField({ label, value, onChange, startEditing = false }: EntityFieldProps) {
  const { t } = useTranslation();
  const inputId = useId();
  const [editing, setEditing] = useState(startEditing);
  const [draft, setDraft] = useState(value);

  function save() {
    onChange(draft.trim());
    setEditing(false);
  }

  return (
    <div className="flex items-center justify-between gap-3 border-b border-border py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <label htmlFor={inputId} className="block text-xs text-muted">
          {label}
        </label>
        {editing ? (
          <input
            id={inputId}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            aria-label={t('entity.editing', { label })}
            className="mt-1 min-h-11 w-full rounded-lg border border-border bg-bg px-3 font-mono text-sm"
          />
        ) : (
          <output id={inputId} className="block truncate font-mono text-sm">
            {value}
          </output>
        )}
      </div>
      <button
        type="button"
        onClick={editing ? save : () => (setDraft(value), setEditing(true))}
        className="min-h-11 min-w-11 text-sm font-bold text-primary"
      >
        {editing ? t('entity.save') : t('entity.edit')}
      </button>
    </div>
  );
}
