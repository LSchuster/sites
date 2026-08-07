import { useState } from 'react';
import { t } from '../i18n';
import { loadClient, saveClient, useAppState } from '../state/store';

export function ClientPicker() {
  const { clients, invoice } = useAppState();
  const [savedFlash, setSavedFlash] = useState(false);

  return (
    <div className="row toolbar">
      {clients.length > 0 ? (
        <select
          aria-label={t.loadClient}
          value=""
          onChange={(e) => e.target.value && loadClient(e.target.value)}
        >
          <option value="">{t.loadClient} …</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      ) : null}
      <button
        type="button"
        className="ghost"
        disabled={!invoice.buyer.name.trim()}
        onClick={() => {
          saveClient();
          setSavedFlash(true);
          setTimeout(() => setSavedFlash(false), 2000);
        }}
      >
        {savedFlash ? t.clientSaved : t.saveClient}
      </button>
    </div>
  );
}
