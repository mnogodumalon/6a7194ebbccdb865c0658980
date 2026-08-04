import type { Aktualisierung } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';

export interface AktualisierungDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Aktualisierung;
}

export function AktualisierungDetails({
  record,
}: AktualisierungDetailsProps) {
  return (
    <>
      <RecordSection title="Details" cols={2}>
        <RecordField label="Titel" value={record.fields.titel} format="text" />
        <RecordField label="Beschreibung" value={record.fields.beschreibung} format="longtext" className="md:col-span-2" />
        <RecordField label="Datum der Aktualisierung" value={record.fields.datum} format="date" />
        <RecordField label="Version" value={record.fields.version} format="text" />
        <RecordField label="Priorität" value={record.fields.prioritaet} format="pill" />
        <RecordField label="Status" value={record.fields.status} format="pill" />
        <RecordField label="Verantwortliche Person" value={record.fields.verantwortliche_person} format="text" />
        <RecordField label="Betroffene Bereiche" value={record.fields.betroffene_bereiche} format="text" />
        <RecordField label="Anmerkungen" value={record.fields.anmerkungen} format="longtext" className="md:col-span-2" />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.AKTUALISIERUNG} recordId={record.record_id} />
    </>
  );
}
