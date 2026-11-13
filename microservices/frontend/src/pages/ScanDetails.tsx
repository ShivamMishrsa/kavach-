import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useConfirmEntities } from '@/api/queries';
import type { EntityType, Scan } from '@/api/types';
import { PageHeader } from '@/components/PageHeader';
import { WithScan } from '@/components/WithScan';
import { Button } from '@/components/ui/button';
import { EntityField } from '@/components/ui/EntityField';
import { displayValue } from '@/lib/format';
import { ENTITY_ORDER, missingTypes, sortEntities } from '@/lib/dossier';

interface Row {
  key: string;
  type: EntityType;
  value: string;
  adding: boolean;
}

function Editor({ scan, id }: { scan: Scan; id: string }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const confirm = useConfirmEntities(id);

  const [rows, setRows] = useState<Row[]>(() =>
    sortEntities(scan.confirmedEntities ?? scan.result?.entities ?? []).map((entity, index) => ({
      key: `${entity.type}-${index}`,
      type: entity.type,
      value: displayValue(entity.value, i18n.language),
      adding: false,
    })),
  );
  const [checked, setChecked] = useState(false);
  const [toAdd, setToAdd] = useState<EntityType | ''>('');

  const available = missingTypes(rows.map((row) => ({ type: row.type, value: row.value })));

  function addRow() {
    if (!toAdd) return;
    setRows((current) =>
      [...current, { key: `${toAdd}-new`, type: toAdd, value: '', adding: true }].sort(
        (a, b) => ENTITY_ORDER.indexOf(a.type) - ENTITY_ORDER.indexOf(b.type),
      ),
    );
    setToAdd('');
  }

  async function submit() {
    try {
      await confirm.mutateAsync(rows.map(({ type, value }) => ({ type, value })));
      navigate(`/app/scan/${id}/dossier`);
    } catch {
      toast.error(t('errors.generic'));
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        backTo={`/app/scan/${id}`}
        title={t('details.title')}
        subtitle={t('details.subtitle')}
      />

      {rows.length === 0 ? (
        <p className="rounded-lg bg-chip px-3 py-2">{t('details.none')}</p>
      ) : (
        <div className="rounded-card border border-border bg-surface px-4">
          {rows.map((row) => (
            <EntityField
              key={row.key}
              label={t(`fields.${row.type}`)}
              value={row.value}
              startEditing={row.adding}
              onChange={(value) =>
                setRows((current) =>
                  current.map((item) => (item.key === row.key ? { ...item, value } : item)),
                )
              }
            />
          ))}
        </div>
      )}

      {available.length > 0 && (
        <div className="flex items-end gap-2">
          <div className="flex flex-1 flex-col gap-1.5">
            <label htmlFor="add-detail" className="font-semibold">
              {t('details.addLabel')}
            </label>
            <select
              id="add-detail"
              value={toAdd}
              onChange={(event) => setToAdd(event.target.value as EntityType | '')}
              className="min-h-11 rounded-[calc(var(--radius)-4px)] border-2 border-border bg-surface px-3"
            >
              <option value="">{t('details.choose')}</option>
              {available.map((type) => (
                <option key={type} value={type}>
                  {t(`fields.${type}`)}
                </option>
              ))}
            </select>
          </div>
          <Button variant="outline" disabled={!toAdd} onClick={addRow}>
            <Plus className="size-5" aria-hidden="true" />
            {t('details.add')}
          </Button>
        </div>
      )}

      <label className="flex items-start gap-3 rounded-card border border-border bg-surface p-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => setChecked(event.target.checked)}
          className="mt-1 size-5 accent-primary"
        />
        <span>{t('details.confirm')}</span>
      </label>

      <Button
        size="lg"
        block
        disabled={!checked || confirm.isPending}
        onClick={() => void submit()}
      >
        {t('details.continue')}
      </Button>
    </div>
  );
}

export default function ScanDetails() {
  return (
    <WithScan>
      {(scan, id) =>
        scan.status === 'done' ? (
          <Editor scan={scan} id={id} />
        ) : (
          <Navigate to={`/app/scan/${id}`} replace />
        )
      }
    </WithScan>
  );
}
