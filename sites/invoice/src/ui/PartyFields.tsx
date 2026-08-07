import { t } from '../i18n';
import { COUNTRY_CODES } from '../model/codes';
import type { Party } from '../model/invoice';
import { Field } from './Field';

export function PartyFields(props: {
  party: Party;
  onPatch: (patch: Partial<Party>) => void;
  withVatId?: boolean;
}) {
  const { party, onPatch } = props;
  const regionNames = new Intl.DisplayNames('de', { type: 'region' });
  return (
    <>
      <Field label={t.name} grow>
        <input
          value={party.name}
          onChange={(e) => onPatch({ name: e.target.value })}
          autoComplete="organization"
        />
      </Field>
      <Field label={t.street} grow>
        <input value={party.street} onChange={(e) => onPatch({ street: e.target.value })} />
      </Field>
      <div className="row">
        <Field label={t.postcode}>
          <input
            value={party.postcode}
            onChange={(e) => onPatch({ postcode: e.target.value })}
            size={6}
          />
        </Field>
        <Field label={t.city} grow>
          <input value={party.city} onChange={(e) => onPatch({ city: e.target.value })} />
        </Field>
        <Field label={t.country}>
          <select
            value={party.countryCode}
            onChange={(e) => onPatch({ countryCode: e.target.value })}
          >
            {COUNTRY_CODES.map((c) => (
              <option key={c} value={c}>
                {regionNames.of(c) ?? c}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {props.withVatId ? (
        <div className="row">
          <Field label={t.vatId}>
            <input
              value={party.vatId ?? ''}
              onChange={(e) => onPatch({ vatId: e.target.value })}
              placeholder="DE123456789"
            />
          </Field>
          <Field label={t.email} grow>
            <input
              type="email"
              value={party.email ?? ''}
              onChange={(e) => onPatch({ email: e.target.value })}
            />
          </Field>
        </div>
      ) : null}
    </>
  );
}
