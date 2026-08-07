import { parseBackup } from './persist';
import { exportEnvelope, importEnvelope } from './store';

/** Download the full local dataset as a JSON backup file. */
export function downloadBackup(): void {
  const blob = new Blob([JSON.stringify(exportEnvelope(), null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rechnungs-daten-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Import a backup file; resolves false if the file is not a valid envelope. */
export async function importBackupFile(file: File): Promise<boolean> {
  const env = parseBackup(await file.text());
  if (!env) return false;
  importEnvelope(env);
  return true;
}
