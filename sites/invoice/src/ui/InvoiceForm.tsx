import { t } from '../i18n';
import type { Invoice } from '../model/invoice';
import { todayIso } from '../model/invoice';
import { updateBuyer, updateInvoice, updateSeller } from '../state/store';
import { ClientPicker } from './ClientPicker';
import { Field } from './Field';
import { LineItems } from './LineItems';
import { LogoUpload } from './LogoUpload';
import { PartyFields } from './PartyFields';
import { ProfileManager } from './ProfileManager';
import { TaxCasePicker } from './TaxCasePicker';

export function InvoiceForm(props: { invoice: Invoice }) {
  const { invoice } = props;
  const seller = invoice.seller;
  const usePeriod = !!invoice.servicePeriod;

  return (
    <form className="invoice-form" onSubmit={(e) => e.preventDefault()}>
      <section>
        <h2>{t.sectionSeller}</h2>
        <PartyFields party={seller} onPatch={updateSeller} />
        <div className="row">
          <Field label={t.taxNumber} hint={t.taxIdHint}>
            <input
              value={seller.taxNumber ?? ''}
              onChange={(e) => updateSeller({ taxNumber: e.target.value })}
            />
          </Field>
          <Field label={t.vatId}>
            <input
              value={seller.vatId ?? ''}
              onChange={(e) => updateSeller({ vatId: e.target.value })}
              placeholder="DE123456789"
            />
          </Field>
        </div>
        <div className="row">
          <Field label={t.email}>
            <input
              type="email"
              value={seller.email ?? ''}
              onChange={(e) => updateSeller({ email: e.target.value })}
            />
          </Field>
          <Field label={t.phone}>
            <input
              value={seller.phone ?? ''}
              onChange={(e) => updateSeller({ phone: e.target.value })}
            />
          </Field>
        </div>
        <div className="row">
          <Field label={t.iban} grow>
            <input
              value={seller.iban}
              onChange={(e) => updateSeller({ iban: e.target.value })}
              placeholder="DE00 0000 0000 0000 0000 00"
            />
          </Field>
          <Field label={t.bic}>
            <input value={seller.bic ?? ''} onChange={(e) => updateSeller({ bic: e.target.value })} />
          </Field>
          <Field label={t.bankName}>
            <input
              value={seller.bankName ?? ''}
              onChange={(e) => updateSeller({ bankName: e.target.value })}
            />
          </Field>
        </div>
        <LogoUpload />
        <ProfileManager />
      </section>

      <section>
        <h2>{t.sectionBuyer}</h2>
        <PartyFields party={invoice.buyer} onPatch={updateBuyer} withVatId />
        <ClientPicker />
      </section>

      <section>
        <h2>{t.sectionMeta}</h2>
        <div className="row">
          <Field label={t.invoiceNumber} hint={t.invoiceNumberHint} grow>
            <input
              value={invoice.number}
              onChange={(e) => updateInvoice({ number: e.target.value })}
              placeholder="2026-001"
            />
          </Field>
          <Field label={t.issueDate}>
            <input
              type="date"
              value={invoice.issueDate}
              onChange={(e) => updateInvoice({ issueDate: e.target.value })}
            />
          </Field>
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={usePeriod}
            onChange={(e) =>
              e.target.checked
                ? updateInvoice({
                    servicePeriod: { from: invoice.issueDate, to: invoice.issueDate },
                    deliveryDate: undefined,
                  })
                : updateInvoice({ servicePeriod: undefined, deliveryDate: todayIso() })
            }
          />
          {t.usePeriod}
        </label>
        {usePeriod && invoice.servicePeriod ? (
          <div className="row">
            <Field label={t.periodFrom}>
              <input
                type="date"
                value={invoice.servicePeriod.from}
                onChange={(e) =>
                  updateInvoice({
                    servicePeriod: { from: e.target.value, to: invoice.servicePeriod?.to ?? e.target.value },
                  })
                }
              />
            </Field>
            <Field label={t.periodTo}>
              <input
                type="date"
                value={invoice.servicePeriod.to}
                onChange={(e) =>
                  updateInvoice({
                    servicePeriod: {
                      from: invoice.servicePeriod?.from ?? e.target.value,
                      to: e.target.value,
                    },
                  })
                }
              />
            </Field>
          </div>
        ) : (
          <div className="row">
            <Field label={t.deliveryDate}>
              <input
                type="date"
                value={invoice.deliveryDate ?? ''}
                onChange={(e) => updateInvoice({ deliveryDate: e.target.value })}
              />
            </Field>
          </div>
        )}
        <div className="row">
          <TaxCasePicker invoice={invoice} />
        </div>
        <div className="row">
          <Field label={t.docLanguage}>
            <select
              value={invoice.docLanguage}
              onChange={(e) => updateInvoice({ docLanguage: e.target.value as Invoice['docLanguage'] })}
            >
              <option value="de">{t.docLanguageDe}</option>
              <option value="en">{t.docLanguageEn}</option>
            </select>
          </Field>
          <Field label={t.buyerReference} grow>
            <input
              value={invoice.buyerReference ?? ''}
              onChange={(e) => updateInvoice({ buyerReference: e.target.value })}
            />
          </Field>
        </div>
      </section>

      <section>
        <h2>{t.sectionLines}</h2>
        <LineItems invoice={invoice} />
      </section>

      <section>
        <h2>{t.sectionPayment}</h2>
        <label className="check">
          <input
            type="checkbox"
            checked={invoice.paymentTermsDays !== null}
            onChange={(e) =>
              updateInvoice({ paymentTermsDays: e.target.checked ? 14 : null })
            }
          />
          {t.showPaymentTerms}
        </label>
        <div className="row">
          {invoice.paymentTermsDays !== null ? (
            <Field label={t.paymentTermsDays}>
              <input
                type="number"
                min={0}
                step={1}
                value={invoice.paymentTermsDays}
                onChange={(e) => {
                  const v = Math.max(0, Math.round(Number(e.target.value)));
                  updateInvoice({ paymentTermsDays: Number.isFinite(v) ? v : 14 });
                }}
              />
            </Field>
          ) : null}
          <Field label={t.notes} hint={t.notesHint} grow>
            <input
              value={invoice.notes ?? ''}
              onChange={(e) => updateInvoice({ notes: e.target.value })}
            />
          </Field>
        </div>
      </section>
    </form>
  );
}
