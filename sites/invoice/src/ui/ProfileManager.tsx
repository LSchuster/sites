import { useRef, useState } from 'react';
import { t } from '../i18n';
import { downloadBackup, importBackupFile } from '../state/backup';
import { newInvoice, saveProfile } from '../state/store';

/** Toolbar: remember profile, start fresh invoice, JSON backup export/import. */
export function ProfileManager() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [flash, setFlash] = useState<'saved' | 'importError' | null>(null);

  function show(kind: 'saved' | 'importError') {
    setFlash(kind);
    setTimeout(() => setFlash(null), 2500);
  }

  return (
    <div className="row toolbar wrap">
      <button
        type="button"
        className="ghost"
        onClick={() => {
          saveProfile();
          show('saved');
        }}
      >
        {flash === 'saved' ? t.profileSaved : t.saveProfile}
      </button>
      <button type="button" className="ghost" onClick={newInvoice}>
        {t.newInvoice}
      </button>
      <span className="spacer" />
      <button type="button" className="ghost" onClick={downloadBackup}>
        {t.exportBackup}
      </button>
      <button type="button" className="ghost" onClick={() => fileInput.current?.click()}>
        {flash === 'importError' ? t.importError : t.importBackup}
      </button>
      <input
        ref={fileInput}
        type="file"
        accept="application/json"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file && !(await importBackupFile(file))) show('importError');
        }}
      />
    </div>
  );
}
