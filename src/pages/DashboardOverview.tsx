import { useState, useMemo, useCallback } from 'react';
import { format, parseISO, isBefore, isToday, addDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { useDashboardData } from '@/hooks/useDashboardData';
import type { Aktualisierung } from '@/types/app';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';
import { formatDate } from '@/lib/formatters';
import { lookupKey } from '@/lib/formatters';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { DashboardSkeleton, DashboardError } from '@/components/DashboardStates';
import { DashboardGrid } from '@/components/DashboardGrid';
import { HeroBanner } from '@/components/HeroBanner';
import { WorkList } from '@/components/WorkList';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { KanbanWidget, type KanbanCard, type KanbanColumn, type KanbanTone } from '@/components/widgets/KanbanWidget';
import { ChartWidget } from '@/components/widgets/ChartWidget';
import {
  RecordOverlayHost,
  RecordHeader,
  useRecordOverlayStack,
} from '@/components/widgets/RecordView';
import { AktualisierungDetails } from '@/components/details/AktualisierungDetails';
import { AktualisierungDialog, type AktualisierungDialogDefaults } from '@/components/dialogs/AktualisierungDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { Button } from '@/components/ui/button';
import { IconPlus, IconAlertTriangle, IconCircleCheck } from '@tabler/icons-react';

const COLUMNS: KanbanColumn[] = (LOOKUP_OPTIONS['aktualisierung']?.['status'] ?? []).map(o => ({
  key: o.key,
  label: o.label,
}));

function toneForStatus(status: string | undefined): KanbanTone {
  if (status === 'abgeschlossen') return 'success';
  if (status === 'in_bearbeitung') return 'primary';
  if (status === 'abgebrochen') return 'default';
  return 'warning'; // geplant → needs attention
}

function toneForPriority(prio: string | undefined): KanbanTone {
  if (prio === 'kritisch') return 'destructive';
  if (prio === 'hoch') return 'warning';
  if (prio === 'mittel') return 'primary';
  return 'default';
}

const STATUS_SEQUENCE: Record<string, string> = {
  geplant: 'in_bearbeitung',
  in_bearbeitung: 'abgeschlossen',
};

export default function DashboardOverview() {
  const { aktualisierung, setAktualisierung, loading, error, fetchAll } = useDashboardData();
  const clock = useClock();

  const overlay = useRecordOverlayStack<{ type: 'aktualisierung'; id: string }>();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogDefaults, setDialogDefaults] = useState<AktualisierungDialogDefaults | undefined>(undefined);
  const [editingRecord, setEditingRecord] = useState<Aktualisierung | null>(null);

  const today = format(clock, 'yyyy-MM-dd');

  const ueberfaellig = useMemo(() =>
    aktualisierung.filter(r => {
      const k = lookupKey(r.fields.status);
      if (k === 'abgeschlossen' || k === 'abgebrochen') return false;
      const d = r.fields.datum;
      if (!d) return false;
      return isBefore(parseISO(d), parseISO(today));
    }),
    [aktualisierung, today]
  );

  const heuteFaellig = useMemo(() =>
    aktualisierung.filter(r => {
      const k = lookupKey(r.fields.status);
      if (k === 'abgeschlossen' || k === 'abgebrochen') return false;
      const d = r.fields.datum;
      if (!d) return false;
      return isToday(parseISO(d));
    }),
    [aktualisierung]
  );

  const naechsteWoche = useMemo(() =>
    aktualisierung.filter(r => {
      const k = lookupKey(r.fields.status);
      if (k === 'abgeschlossen' || k === 'abgebrochen') return false;
      const d = r.fields.datum;
      if (!d) return false;
      const d2 = parseISO(d);
      return d2 > parseISO(today) && d2 <= addDays(parseISO(today), 7);
    }),
    [aktualisierung, today]
  );

  const inBearbeitung = useMemo(() =>
    aktualisierung.filter(r => lookupKey(r.fields.status) === 'in_bearbeitung'),
    [aktualisierung]
  );

  const abgeschlossen = useMemo(() =>
    aktualisierung.filter(r => lookupKey(r.fields.status) === 'abgeschlossen'),
    [aktualisierung]
  );

  const advanceStatus = useCallback((record: Aktualisierung) => {
    const current = lookupKey(record.fields.status);
    const next = current ? STATUS_SEQUENCE[current] : undefined;
    if (!next) return;

    const nextLabel = LOOKUP_OPTIONS['aktualisierung']?.['status']?.find(o => o.key === next)?.label ?? next;
    const prevStatus = record.fields.status;

    setAktualisierung(prev =>
      prev.map(r =>
        r.record_id === record.record_id
          ? { ...r, fields: { ...r.fields, status: { key: next, label: nextLabel } } }
          : r
      )
    );

    LivingAppsService.updateAktualisierungEntry(record.record_id, { status: next })
      .catch(() => fetchAll());

    undoToast(`"${record.fields.titel ?? 'Aktualisierung'}" → ${nextLabel}`, () => {
      setAktualisierung(prev =>
        prev.map(r =>
          r.record_id === record.record_id
            ? { ...r, fields: { ...r.fields, status: prevStatus } }
            : r
        )
      );
      LivingAppsService.updateAktualisierungEntry(record.record_id, { status: prevStatus?.key ?? 'geplant' })
        .catch(() => fetchAll());
    });
  }, [setAktualisierung, fetchAll]);

  const cards = useMemo<KanbanCard[]>(() =>
    aktualisierung
      .filter(r => lookupKey(r.fields.status) !== 'abgebrochen')
      .sort((a, b) => {
        const da = a.fields.datum ?? '';
        const db = b.fields.datum ?? '';
        return da.localeCompare(db);
      })
      .map(r => {
        const status = lookupKey(r.fields.status) ?? COLUMNS[0]?.key ?? '';
        const prio = lookupKey(r.fields.prioritaet);
        return {
          id: `aktualisierung:${r.record_id}`,
          column: status,
          title: r.fields.titel ?? 'Ohne Titel',
          subtitle: r.fields.datum
            ? format(parseISO(r.fields.datum), 'd. MMM yyyy', { locale: de })
            : r.fields.version ?? undefined,
          tone: toneForStatus(status) === 'warning' && prio === 'kritisch'
            ? 'destructive' as KanbanTone
            : toneForStatus(status),
        };
      }),
    [aktualisierung]
  );

  const moveCard = useCallback(async (cardId: string, newColumn: string) => {
    const rid = cardId.split(':')[1];
    if (!rid) return;
    const record = aktualisierung.find(r => r.record_id === rid);
    if (!record) return;

    const newLabel = LOOKUP_OPTIONS['aktualisierung']?.['status']?.find(o => o.key === newColumn)?.label ?? newColumn;
    const prevStatus = record.fields.status;

    setAktualisierung(prev =>
      prev.map(r =>
        r.record_id === rid
          ? { ...r, fields: { ...r.fields, status: { key: newColumn, label: newLabel } } }
          : r
      )
    );

    try {
      await LivingAppsService.updateAktualisierungEntry(rid, { status: newColumn });
      undoToast(`"${record.fields.titel ?? 'Aktualisierung'}" → ${newLabel}`, () => {
        setAktualisierung(prev =>
          prev.map(r =>
            r.record_id === rid
              ? { ...r, fields: { ...r.fields, status: prevStatus } }
              : r
          )
        );
        LivingAppsService.updateAktualisierungEntry(rid, { status: prevStatus?.key ?? 'geplant' })
          .catch(() => fetchAll());
      });
    } catch {
      fetchAll();
    }
  }, [aktualisierung, setAktualisierung, fetchAll]);

  const openCreate = useCallback((statusKey?: string) => {
    setEditingRecord(null);
    setDialogDefaults(statusKey ? { status: statusKey, datum: today } : { datum: today });
    setDialogOpen(true);
  }, [today]);

  const openEdit = useCallback((record: Aktualisierung) => {
    setEditingRecord(record);
    setDialogDefaults({
      titel: record.fields.titel,
      beschreibung: record.fields.beschreibung,
      datum: record.fields.datum,
      version: record.fields.version,
      prioritaet: record.fields.prioritaet,
      status: record.fields.status,
      verantwortliche_person: record.fields.verantwortliche_person,
      betroffene_bereiche: record.fields.betroffene_bereiche,
      anmerkungen: record.fields.anmerkungen,
    });
    setDialogOpen(true);
  }, []);

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  // ── plain derivations only below ──

  const kritische = ueberfaellig.filter(r => lookupKey(r.fields.prioritaet) === 'kritisch' || lookupKey(r.fields.prioritaet) === 'hoch');

  // Context line
  const aktivePersonen = [...new Set(
    inBearbeitung.flatMap(r => r.fields.verantwortliche_person ? [r.fields.verantwortliche_person] : [])
  )];
  const contextLine = inBearbeitung.length > 0
    ? `${inBearbeitung.length} Aktualisierung${inBearbeitung.length !== 1 ? 'en' : ''} in Arbeit${aktivePersonen.length > 0 ? ` — ${namen(aktivePersonen)}` : ''}${ueberfaellig.length > 0 ? ` · ${ueberfaellig.length} überfällig` : ''}.`
    : aktualisierung.length === 0
      ? 'Noch keine Aktualisierungen erfasst — starte gleich.'
      : 'Alle Aktualisierungen auf dem neuesten Stand.';

  const currentTop = overlay.top
    ? aktualisierung.find(r => r.record_id === overlay.top!.id)
    : undefined;

  const nextStatus = currentTop ? STATUS_SEQUENCE[lookupKey(currentTop.fields.status) ?? ''] : undefined;
  const nextStatusLabel = nextStatus
    ? LOOKUP_OPTIONS['aktualisierung']?.['status']?.find(o => o.key === nextStatus)?.label
    : undefined;

  return (
    <>
      {/* Page header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {gruss(clock)}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{contextLine}</p>
        </div>
        <Button onClick={() => openCreate()} size="sm" className="shrink-0">
          <IconPlus size={16} className="shrink-0 mr-1.5" />
          Neue Aktualisierung
        </Button>
      </div>

      <DashboardGrid
        variant="wide"
        hero={
          kritische.length > 0 ? (
            <HeroBanner
              icon={<IconAlertTriangle size={18} />}
              action={{
                label: `${kritische[0].fields.titel ? `"${kritische[0].fields.titel}" bearbeiten` : 'Jetzt bearbeiten'}`,
                onClick: () => advanceStatus(kritische[0]),
              }}
            >
              <b>{namen(kritische.map(r => r.fields.titel ?? 'Ohne Titel'))}</b>{' '}
              {kritische.length === 1 ? 'ist' : 'sind'} überfällig
              {kritische[0].fields.datum ? ` — fällig war ${formatDate(kritische[0].fields.datum)}` : ''}.
            </HeroBanner>
          ) : undefined
        }
        kpis={
          <StatStrip>
            <StatStripItem
              title="Gesamt"
              value={aktualisierung.length}
            />
            <StatStripItem
              title="In Bearbeitung"
              value={inBearbeitung.length}
              tone={inBearbeitung.length > 0 ? 'primary' : 'default'}
            />
            <StatStripItem
              title="Überfällig"
              value={ueberfaellig.length}
              tone={ueberfaellig.length > 0 ? 'destructive' : 'default'}
            />
            <StatStripItem
              title="Heute fällig"
              value={heuteFaellig.length}
              tone={heuteFaellig.length > 0 ? 'warning' : 'default'}
            />
            <StatStripItem
              title="Abgeschlossen"
              value={abgeschlossen.length}
              tone={abgeschlossen.length > 0 ? 'success' : 'default'}
            />
          </StatStrip>
        }
        primary={
          <KanbanWidget
            cards={cards}
            columns={COLUMNS}
            defaultCollapsed={['abgebrochen']}
            onCardClick={card => {
              const rid = card.id.split(':')[1] ?? '';
              overlay.replace({ type: 'aktualisierung', id: rid });
            }}
            onCardMove={moveCard}
            onAddCard={column => openCreate(column)}
          />
        }
        aside={
          <>
            <WorkList
              title="Heute & überfällig"
              items={[...heuteFaellig, ...ueberfaellig.filter(r => !heuteFaellig.includes(r))]
                .slice(0, 8)
                .map(r => {
                  const isOverdue = ueberfaellig.includes(r) && !heuteFaellig.includes(r);
                  const nextSt = STATUS_SEQUENCE[lookupKey(r.fields.status) ?? ''];
                  const nextStLabel = nextSt
                    ? LOOKUP_OPTIONS['aktualisierung']?.['status']?.find(o => o.key === nextSt)?.label
                    : undefined;
                  return {
                    id: r.record_id,
                    title: r.fields.titel ?? 'Ohne Titel',
                    secondLine: (
                      <>
                        {isOverdue ? (
                          <span className="font-medium text-destructive">Überfällig</span>
                        ) : (
                          <span className="font-medium text-warning">Heute fällig</span>
                        )}
                        {r.fields.datum && (
                          <span className="text-muted-foreground"> · {formatDate(r.fields.datum)}</span>
                        )}
                        {r.fields.prioritaet?.label && (
                          <span
                            className={`ml-1.5 text-xs font-medium ${
                              toneForPriority(lookupKey(r.fields.prioritaet)) === 'destructive'
                                ? 'text-destructive'
                                : toneForPriority(lookupKey(r.fields.prioritaet)) === 'warning'
                                  ? 'text-yellow-600'
                                  : 'text-muted-foreground'
                            }`}
                          >
                            {r.fields.prioritaet.label}
                          </span>
                        )}
                      </>
                    ),
                    action: nextStLabel
                      ? { label: `→ ${nextStLabel}`, onClick: () => advanceStatus(r) }
                      : undefined,
                  };
                })}
              onItemClick={id => overlay.replace({ type: 'aktualisierung', id })}
              empty={{
                text: naechsteWoche.length > 0
                  ? `Nichts überfällig — nächste Fälligkeit: ${formatDate(naechsteWoche[0].fields.datum)}`
                  : 'Alles im Zeitplan — keine fälligen Einträge.',
                action: { label: 'Neue Aktualisierung', onClick: () => openCreate() },
              }}
            />
            <ChartWidget
              title="Nach Priorität"
              rows={aktualisierung
                .filter(r => lookupKey(r.fields.status) !== 'abgebrochen')
                .map(r => ({
                  id: `aktualisierung:${r.record_id}`,
                  data: r,
                }))}
              dimension={{ kind: 'category', accessor: r => r.data.fields.prioritaet }}
            />
          </>
        }
      />

      {/* Record Overlay */}
      <RecordOverlayHost
        overlay={overlay}
        render={top => {
          const rec = aktualisierung.find(r => r.record_id === top.id);
          if (!rec) return null;
          return (
            <>
              <RecordHeader
                title={rec.fields.titel ?? 'Ohne Titel'}
                subtitle={rec.fields.status?.label}
                badges={
                  rec.fields.prioritaet ? (
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        lookupKey(rec.fields.prioritaet) === 'kritisch'
                          ? 'bg-destructive/10 text-destructive'
                          : lookupKey(rec.fields.prioritaet) === 'hoch'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {rec.fields.prioritaet.label}
                    </span>
                  ) : undefined
                }
              />
              <AktualisierungDetails record={rec} />
            </>
          );
        }}
        footer={top => {
          const rec = aktualisierung.find(r => r.record_id === top.id);
          if (!rec) return undefined;
          const ns = STATUS_SEQUENCE[lookupKey(rec.fields.status) ?? ''];
          const nsLabel = ns
            ? LOOKUP_OPTIONS['aktualisierung']?.['status']?.find(o => o.key === ns)?.label
            : undefined;
          if (!nsLabel) return undefined;
          return {
            label: `→ ${nsLabel}`,
            onClick: () => {
              advanceStatus(rec);
              overlay.close();
            },
          };
        }}
        onEdit={top => {
          const rec = aktualisierung.find(r => r.record_id === top.id);
          if (rec) { openEdit(rec); overlay.close(); }
        }}
      />

      {/* Create / Edit Dialog */}
      <AktualisierungDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditingRecord(null); }}
        onSubmit={async fields => {
          if (editingRecord) {
            await LivingAppsService.updateAktualisierungEntry(editingRecord.record_id, fields);
          } else {
            await LivingAppsService.createAktualisierungEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={dialogDefaults}
        recordId={editingRecord?.record_id}
        enablePhotoScan={AI_PHOTO_SCAN['Aktualisierung']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Aktualisierung']}
      />
    </>
  );
}
