import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  FlatList, Image, Modal, ActivityIndicator, Alert, Platform,
  KeyboardAvoidingView, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Column, ColumnType, Row, Settings, Sheet, Store } from '../lib/types';
import { loadStore, saveStore, makeRow, makeSheet } from '../lib/storage';
import { capturePhoto, deletePhoto } from '../lib/photos';
import { computePay, columnTotal, formatMoney } from '../lib/pay';
import { printLogbook, shareLogbook } from '../lib/export';
import { makeId } from '../lib/id';
import { colors, spacing, font } from '../lib/theme';

const PHOTO_W = 56;
const ACTIONS_W = 44;
const colWidth = (c: Column) =>
  c.type === 'number' ? 96 : /notes|comment/i.test(c.name) ? 170 : /container|chassis/i.test(c.name) ? 150 : 120;

export default function LogbookScreen() {
  const insets = useSafeAreaInsets();
  const [store, setStore] = useState<Store | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [photoRowId, setPhotoRowId] = useState<string | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [colEditor, setColEditor] = useState<'new' | Column | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showSheets, setShowSheets] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { loadStore().then(setStore); }, []);

  const sheet = useMemo(
    () => store?.sheets.find((s) => s.id === store.activeId) ?? null,
    [store]
  );

  const commitStore = useCallback((next: Store) => {
    setStore(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveStore(next), 400);
  }, []);

  const commitSheet = useCallback((nextSheet: Sheet) => {
    setStore((prev) => {
      if (!prev) return prev;
      const next = {
        ...prev,
        sheets: prev.sheets.map((s) => (s.id === nextSheet.id ? nextSheet : s)),
      };
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => saveStore(next), 400);
      return next;
    });
  }, []);

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  /* ----- cell / row / column edits (all on the active sheet) ----- */

  const setCell = (rowId: string, colId: string, value: string) => {
    if (!sheet) return;
    commitSheet({
      ...sheet,
      rows: sheet.rows.map((r) => (r.id === rowId ? { ...r, cells: { ...r.cells, [colId]: value } } : r)),
    });
  };

  const addRow = () => { if (sheet) commitSheet({ ...sheet, rows: [...sheet.rows, makeRow(sheet.columns)] }); };

  const deleteRow = (row: Row) => {
    if (!sheet) return;
    Alert.alert('Delete row', 'Remove this entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: () => {
          deletePhoto(row.photoUri);
          commitSheet({ ...sheet, rows: sheet.rows.filter((r) => r.id !== row.id) });
        },
      },
    ]);
  };

  const saveColumn = (draft: { id?: string; name: string; type: ColumnType }) => {
    if (!sheet) return;
    const name = draft.name.trim();
    if (!name) return;
    if (draft.id) {
      commitSheet({
        ...sheet,
        columns: sheet.columns.map((c) => (c.id === draft.id ? { ...c, name, type: draft.type } : c)),
      });
    } else {
      const col: Column = { id: makeId('c_'), name, type: draft.type };
      commitSheet({
        ...sheet,
        columns: [...sheet.columns, col],
        rows: sheet.rows.map((r) => ({ ...r, cells: { ...r.cells, [col.id]: '' } })),
      });
    }
    setColEditor(null);
  };

  const deleteColumn = (colId: string) => {
    if (!sheet) return;
    if (sheet.columns.length <= 1) {
      Alert.alert('Keep one column', 'A sheet needs at least one column.');
      return;
    }
    commitSheet({
      ...sheet,
      columns: sheet.columns.filter((c) => c.id !== colId),
      rows: sheet.rows.map((r) => {
        const cells = { ...r.cells };
        delete cells[colId];
        return { ...r, cells };
      }),
    });
    setColEditor(null);
  };

  /* ----- photos ----- */

  const choosePhoto = async (source: 'camera' | 'library') => {
    const rowId = photoRowId;
    setPhotoRowId(null);
    if (!rowId || !sheet) return;
    const uri = await capturePhoto(source);
    if (!uri) return;
    const existing = sheet.rows.find((r) => r.id === rowId)?.photoUri;
    if (existing) deletePhoto(existing);
    commitSheet({ ...sheet, rows: sheet.rows.map((r) => (r.id === rowId ? { ...r, photoUri: uri } : r)) });
  };

  const removePhoto = () => {
    const rowId = photoRowId;
    setPhotoRowId(null);
    if (!rowId || !sheet) return;
    const row = sheet.rows.find((r) => r.id === rowId);
    if (row?.photoUri) deletePhoto(row.photoUri);
    commitSheet({ ...sheet, rows: sheet.rows.map((r) => (r.id === rowId ? { ...r, photoUri: null } : r)) });
  };

  /* ----- sheets: new week / open / archive / delete ----- */

  const startNewWeek = () => {
    if (!store || !sheet) return;
    const fresh = makeSheet(sheet);
    commitStore({
      sheets: [
        fresh,
        ...store.sheets.map((s) => (s.id === sheet.id ? { ...s, archivedAt: Date.now() } : s)),
      ],
      activeId: fresh.id,
    });
    setShowSheets(false);
  };

  const openSheet = (id: string) => {
    if (!store) return;
    commitStore({ ...store, activeId: id });
    setShowSheets(false);
  };

  const toggleArchive = (s: Sheet) => {
    if (!store) return;
    commitStore({
      ...store,
      sheets: store.sheets.map((x) =>
        x.id === s.id ? { ...x, archivedAt: x.archivedAt ? null : Date.now() } : x
      ),
    });
  };

  const deleteSheet = (s: Sheet) => {
    if (!store) return;
    Alert.alert(
      'Delete sheet',
      `Delete "${s.name}" and its ${s.rows.length} ${s.rows.length === 1 ? 'entry' : 'entries'}? This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: () => {
            for (const r of s.rows) deletePhoto(r.photoUri);
            let sheets = store.sheets.filter((x) => x.id !== s.id);
            let activeId = store.activeId;
            if (sheets.length === 0) {
              const fresh = makeSheet(s); // keep columns/letterhead even when wiping
              sheets = [fresh];
              activeId = fresh.id;
            } else if (activeId === s.id) {
              activeId = (sheets.find((x) => !x.archivedAt) ?? sheets[0]).id;
            }
            commitStore({ sheets, activeId });
          },
        },
      ]
    );
  };

  /* ----- send / print ----- */

  const onSend = async () => {
    if (!sheet || busy) return;
    setBusy(true);
    try {
      const ok = await shareLogbook(sheet);
      if (!ok) Alert.alert('Not available', 'Sharing isn’t supported on this device.');
    } catch (e: any) {
      Alert.alert('Could not send', e?.message ?? 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const onPrint = async () => {
    if (!sheet || busy) return;
    setBusy(true);
    try {
      await printLogbook(sheet);
    } catch (e: any) {
      Alert.alert('Could not print', e?.message ?? 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const gridWidth = useMemo(
    () => (sheet ? PHOTO_W + sheet.columns.reduce((w, c) => w + colWidth(c), 0) + ACTIONS_W : 0),
    [sheet]
  );
  const pay = useMemo(() => (sheet ? computePay(sheet) : null), [sheet]);

  if (!store || !sheet || !pay) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  const activeRow = photoRowId ? sheet.rows.find((r) => r.id === photoRowId) : null;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* toolbar */}
      <View style={styles.header}>
        <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowSheets(true)}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>{sheet.name}</Text>
            <Text style={styles.titleCaret}>▾</Text>
          </View>
          <Text style={styles.subtitle}>
            {sheet.rows.length} {sheet.rows.length === 1 ? 'entry' : 'entries'}
            {sheet.archivedAt ? '  ·  archived' : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={onSend} disabled={busy}>
          <Text style={styles.iconBtnText}>Send</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={onPrint} disabled={busy}>
          <Text style={styles.iconBtnText}>Print</Text>
        </TouchableOpacity>
      </View>

      {/* summary / letterhead bar */}
      <TouchableOpacity style={styles.summaryBar} onPress={() => setShowDetails(true)}>
        <View style={{ flex: 1 }}>
          <Text style={styles.summaryCompany} numberOfLines={1}>
            {sheet.settings.companyName || 'Set company'}
          </Text>
          <Text style={styles.summaryDriver} numberOfLines={1}>
            {sheet.settings.driverName ? `Driver: ${sheet.settings.driverName}` : 'Tap to add driver & pay details'}
          </Text>
        </View>
        <View style={styles.summaryPay}>
          <Text style={styles.summaryPayLabel}>{pay.hasPay ? 'Take-home' : 'Total'}</Text>
          <Text style={styles.summaryPayValue}>
            {formatMoney(pay.hasPay ? pay.takeHome : pay.gross)}
          </Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>

      {/* grid */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ minWidth: gridWidth }}>
        <View style={{ flex: 1 }}>
          <View style={styles.headRow}>
            <View style={[styles.headCell, { width: PHOTO_W }]}>
              <Text style={[styles.headText, { fontSize: 11 }]} numberOfLines={1}>Photo</Text>
            </View>
            {sheet.columns.map((c) => (
              <TouchableOpacity key={c.id} style={[styles.headCell, { width: colWidth(c) }]} onPress={() => setColEditor(c)}>
                <Text style={styles.headText} numberOfLines={1}>{c.name}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[styles.headCell, styles.addColCell, { width: ACTIONS_W }]} onPress={() => setColEditor('new')}>
              <Text style={styles.addColText}>＋</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={sheet.rows}
            keyExtractor={(r) => r.id}
            keyboardShouldPersistTaps="handled"
            ListFooterComponent={
              <View>
                <View style={[styles.row, styles.totalRow, { width: gridWidth }]}>
                  <View style={{ width: PHOTO_W }} />
                  {sheet.columns.map((c, i) => (
                    <View key={c.id} style={[styles.totalCell, { width: colWidth(c) }]}>
                      <Text style={[styles.totalText, c.type === 'number' && styles.totalNum]} numberOfLines={1}>
                        {c.type === 'number' ? formatMoney(columnTotal(sheet, c.id)) : i === 0 ? 'TOTAL' : ''}
                      </Text>
                    </View>
                  ))}
                  <View style={{ width: ACTIONS_W }} />
                </View>
                <TouchableOpacity style={[styles.addRow, { width: gridWidth }]} onPress={addRow}>
                  <Text style={styles.addRowText}>＋  Add entry</Text>
                </TouchableOpacity>
              </View>
            }
            renderItem={({ item, index }) => (
              <View style={[styles.row, index % 2 === 1 && styles.rowAlt]}>
                <TouchableOpacity
                  style={[styles.photoCell, { width: PHOTO_W }]}
                  onPress={() => (item.photoUri ? setPreviewUri(item.photoUri) : setPhotoRowId(item.id))}
                  onLongPress={() => setPhotoRowId(item.id)}
                >
                  {item.photoUri ? <Image source={{ uri: item.photoUri }} style={styles.thumb} /> : <Text style={styles.photoPlus}>＋</Text>}
                </TouchableOpacity>

                {sheet.columns.map((c) => (
                  <TextInput
                    key={c.id}
                    style={[styles.cell, { width: colWidth(c) }]}
                    value={item.cells[c.id] ?? ''}
                    onChangeText={(t) => setCell(item.id, c.id, t)}
                    placeholder="—"
                    placeholderTextColor={colors.border}
                    keyboardType={c.type === 'number' ? 'numbers-and-punctuation' : 'default'}
                    multiline={/notes|comment/i.test(c.name)}
                  />
                ))}

                <TouchableOpacity style={[styles.actionCell, { width: ACTIONS_W }]} onPress={() => deleteRow(item)}>
                  <Text style={styles.trash}>✕</Text>
                </TouchableOpacity>
              </View>
            )}
          />
        </View>
      </ScrollView>

      {busy && (
        <View style={styles.busyOverlay}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      )}

      {/* photo options */}
      <BottomSheet visible={!!photoRowId} onClose={() => setPhotoRowId(null)}>
        <SheetButton label="Take photo" onPress={() => choosePhoto('camera')} />
        <SheetButton label="Choose from library" onPress={() => choosePhoto('library')} />
        {activeRow?.photoUri && (
          <>
            <SheetButton label="View photo" onPress={() => { const u = activeRow.photoUri!; setPhotoRowId(null); setPreviewUri(u); }} />
            <SheetButton label="Remove photo" danger onPress={removePhoto} />
          </>
        )}
      </BottomSheet>

      {/* preview */}
      <Modal visible={!!previewUri} transparent animationType="fade" onRequestClose={() => setPreviewUri(null)}>
        <Pressable style={styles.previewBackdrop} onPress={() => setPreviewUri(null)}>
          {previewUri && <Image source={{ uri: previewUri }} style={styles.previewImg} resizeMode="contain" />}
          <Text style={styles.previewHint}>Tap to close</Text>
        </Pressable>
      </Modal>

      {/* column editor */}
      <ColumnEditor target={colEditor} onCancel={() => setColEditor(null)} onSave={saveColumn} onDelete={deleteColumn} />

      {/* details / pay */}
      <DetailsSheet
        visible={showDetails}
        sheetName={sheet.name}
        settings={sheet.settings}
        pay={pay}
        onClose={() => setShowDetails(false)}
        onChangeName={(name) => commitSheet({ ...sheet, name })}
        onChange={(settings) => commitSheet({ ...sheet, settings })}
      />

      {/* sheets manager */}
      <SheetsModal
        visible={showSheets}
        store={store}
        onClose={() => setShowSheets(false)}
        onNewWeek={startNewWeek}
        onOpen={openSheet}
        onToggleArchive={toggleArchive}
        onDelete={deleteSheet}
      />
    </KeyboardAvoidingView>
  );
}

/* ---------- Sheets manager ---------- */
function SheetsModal({
  visible, store, onClose, onNewWeek, onOpen, onToggleArchive, onDelete,
}: {
  visible: boolean;
  store: Store;
  onClose: () => void;
  onNewWeek: () => void;
  onOpen: (id: string) => void;
  onToggleArchive: (s: Sheet) => void;
  onDelete: (s: Sheet) => void;
}) {
  const current = store.sheets.filter((s) => !s.archivedAt);
  const archived = store.sheets.filter((s) => !!s.archivedAt);

  const renderSheet = (s: Sheet) => {
    const pay = computePay(s);
    const isActive = s.id === store.activeId;
    return (
      <View key={s.id} style={[sheetStyles.item, isActive && sheetStyles.itemActive]}>
        <TouchableOpacity style={{ flex: 1 }} onPress={() => onOpen(s.id)}>
          <Text style={sheetStyles.itemName} numberOfLines={1}>
            {s.name}{isActive ? '  ·  open' : ''}
          </Text>
          <Text style={sheetStyles.itemMeta}>
            {s.rows.length} {s.rows.length === 1 ? 'entry' : 'entries'} · {formatMoney(pay.hasPay ? pay.takeHome : pay.gross)}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={sheetStyles.itemBtn} onPress={() => onToggleArchive(s)}>
          <Text style={sheetStyles.itemBtnText}>{s.archivedAt ? 'Unarchive' : 'Archive'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={sheetStyles.itemBtn} onPress={() => onDelete(s)}>
          <Text style={[sheetStyles.itemBtnText, { color: colors.danger }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} scroll>
      <Text style={styles.sheetTitle}>My sheets</Text>

      <TouchableOpacity style={styles.saveBtn} onPress={onNewWeek}>
        <Text style={styles.saveBtnText}>＋  Start new week</Text>
      </TouchableOpacity>
      <Text style={sheetStyles.hint}>
        Starts a fresh sheet with the same columns, company, and driver — and archives the current one.
      </Text>

      {current.length > 0 && (
        <>
          <Text style={sheetStyles.section}>Current</Text>
          {current.map(renderSheet)}
        </>
      )}

      {archived.length > 0 && (
        <>
          <Text style={sheetStyles.section}>Archived</Text>
          {archived.map(renderSheet)}
        </>
      )}
    </BottomSheet>
  );
}

const sheetStyles = StyleSheet.create({
  hint: { color: colors.muted, fontSize: font.sm, marginTop: spacing.sm, marginBottom: spacing.xs },
  section: { color: colors.muted, fontSize: font.sm, fontWeight: '700', marginTop: spacing.lg, marginBottom: spacing.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.bg, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, marginTop: spacing.sm,
  },
  itemActive: { borderColor: colors.accent },
  itemName: { color: colors.text, fontSize: font.md, fontWeight: '600' },
  itemMeta: { color: colors.muted, fontSize: font.sm, marginTop: 2 },
  itemBtn: { paddingHorizontal: spacing.xs, paddingVertical: spacing.xs },
  itemBtnText: { color: colors.accent, fontSize: font.sm, fontWeight: '600' },
});

/* ---------- Details & pay sheet ---------- */
function DetailsSheet({
  visible, sheetName, settings, pay, onClose, onChange, onChangeName,
}: {
  visible: boolean;
  sheetName: string;
  settings: Settings;
  pay: ReturnType<typeof computePay>;
  onClose: () => void;
  onChange: (s: Settings) => void;
  onChangeName: (name: string) => void;
}) {
  const set = (k: keyof Settings, v: string) => onChange({ ...settings, [k]: v });
  return (
    <BottomSheet visible={visible} onClose={onClose} scroll>
      <Text style={styles.sheetTitle}>Sheet details</Text>

      <Field label="Sheet name" value={sheetName} onChange={onChangeName} />
      <Field label="Company" value={settings.companyName} onChange={(v) => set('companyName', v)} />
      <Field label="Address" value={settings.companyAddress} onChange={(v) => set('companyAddress', v)} />
      <View style={styles.fieldRow}>
        <Field label="Phone" value={settings.companyPhone} onChange={(v) => set('companyPhone', v)} flex />
        <Field label="Email" value={settings.companyEmail} onChange={(v) => set('companyEmail', v)} flex />
      </View>
      <Field label="Driver" value={settings.driverName} onChange={(v) => set('driverName', v)} />

      <Text style={[styles.sheetTitle, { marginTop: spacing.lg }]}>Pay</Text>
      <View style={styles.fieldRow}>
        <Field label="Adjustment ($)" value={settings.adjustment} onChange={(v) => set('adjustment', v)} numeric flex />
        <Field label="Driver %" value={settings.payPercent} onChange={(v) => set('payPercent', v)} numeric flex />
        <Field label="Deduction ($)" value={settings.deduction} onChange={(v) => set('deduction', v)} numeric flex />
      </View>

      <View style={styles.payCard}>
        <PayRow label="Gross" value={formatMoney(pay.gross)} />
        {pay.adjustment !== 0 && <PayRow label="Adjustment" value={formatMoney(pay.adjustment)} />}
        {pay.adjustment !== 0 && <PayRow label="Adjusted total" value={formatMoney(pay.adjusted)} />}
        {pay.percent !== null && <PayRow label={`Driver share (${pay.percent}%)`} value={formatMoney(pay.share)} />}
        {pay.deduction !== 0 && <PayRow label="Deduction" value={`-${formatMoney(pay.deduction)}`} />}
        <PayRow label={pay.hasPay ? 'Take-home' : 'Total'} value={formatMoney(pay.hasPay ? pay.takeHome : pay.gross)} strong />
      </View>

      <TouchableOpacity style={styles.saveBtn} onPress={onClose}>
        <Text style={styles.saveBtnText}>Done</Text>
      </TouchableOpacity>
    </BottomSheet>
  );
}

function Field({
  label, value, onChange, numeric, flex,
}: { label: string; value: string; onChange: (v: string) => void; numeric?: boolean; flex?: boolean }) {
  return (
    <View style={[styles.field, flex && { flex: 1 }]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.sheetInput}
        value={value}
        onChangeText={onChange}
        placeholder="—"
        placeholderTextColor={colors.border}
        keyboardType={numeric ? 'numbers-and-punctuation' : 'default'}
      />
    </View>
  );
}

function PayRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={[styles.payRow, strong && styles.payRowStrong]}>
      <Text style={[styles.payLabel, strong && styles.payStrongText]}>{label}</Text>
      <Text style={[styles.payValue, strong && styles.payStrongText]}>{value}</Text>
    </View>
  );
}

/* ---------- Column editor ---------- */
function ColumnEditor({
  target, onCancel, onSave, onDelete,
}: {
  target: 'new' | Column | null;
  onCancel: () => void;
  onSave: (d: { id?: string; name: string; type: ColumnType }) => void;
  onDelete: (id: string) => void;
}) {
  const editing = target && target !== 'new' ? target : null;
  const [name, setName] = useState('');
  const [type, setType] = useState<ColumnType>('text');

  useEffect(() => {
    if (target === 'new') { setName(''); setType('text'); }
    else if (target) { setName(target.name); setType(target.type); }
  }, [target]);

  return (
    <BottomSheet visible={!!target} onClose={onCancel}>
      <Text style={styles.sheetTitle}>{editing ? 'Edit column' : 'New column'}</Text>
      <TextInput
        style={styles.sheetInput}
        value={name}
        onChangeText={setName}
        placeholder="Column name"
        placeholderTextColor={colors.muted}
        autoFocus
      />
      <View style={styles.typeRow}>
        {(['text', 'number'] as ColumnType[]).map((t) => (
          <TouchableOpacity key={t} style={[styles.typeBtn, type === t && styles.typeBtnActive]} onPress={() => setType(t)}>
            <Text style={[styles.typeBtnText, type === t && styles.typeBtnTextActive]}>
              {t === 'text' ? 'Text' : 'Number'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity style={styles.saveBtn} onPress={() => onSave({ id: editing?.id, name, type })}>
        <Text style={styles.saveBtnText}>{editing ? 'Save' : 'Add column'}</Text>
      </TouchableOpacity>
      {editing && (
        <TouchableOpacity style={styles.deleteLink} onPress={() => onDelete(editing.id)}>
          <Text style={styles.deleteLinkText}>Delete column</Text>
        </TouchableOpacity>
      )}
    </BottomSheet>
  );
}

/* ---------- Reusable bottom sheet ---------- */
function BottomSheet({
  visible, onClose, children, scroll,
}: { visible: boolean; onClose: () => void; children: React.ReactNode; scroll?: boolean }) {
  const insets = useSafeAreaInsets();
  const Body = scroll ? ScrollView : View;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
          <Body {...(scroll ? { keyboardShouldPersistTaps: 'handled' as const, style: { maxHeight: 520 } } : {})}>
            {children}
          </Body>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SheetButton({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  return (
    <TouchableOpacity style={styles.sheetBtn} onPress={onPress}>
      <Text style={[styles.sheetBtnText, danger && { color: colors.danger }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { color: colors.text, fontSize: font.xl, fontWeight: '700', flexShrink: 1 },
  titleCaret: { color: colors.muted, fontSize: font.md },
  subtitle: { color: colors.muted, fontSize: font.sm, marginTop: 2 },
  iconBtn: { backgroundColor: colors.card, borderRadius: 8, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderColor: colors.border },
  iconBtnText: { color: colors.accent, fontWeight: '700', fontSize: font.sm },

  summaryBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginHorizontal: spacing.lg, marginBottom: spacing.md, padding: spacing.md,
    backgroundColor: colors.card, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
  },
  summaryCompany: { color: colors.text, fontSize: font.md, fontWeight: '700' },
  summaryDriver: { color: colors.muted, fontSize: font.sm, marginTop: 2 },
  summaryPay: { alignItems: 'flex-end' },
  summaryPayLabel: { color: colors.muted, fontSize: 11 },
  summaryPayValue: { color: colors.success, fontSize: font.lg, fontWeight: '700' },
  chevron: { color: colors.muted, fontSize: font.xl, marginLeft: 2 },

  headRow: { flexDirection: 'row', borderBottomWidth: 2, borderBottomColor: colors.border, backgroundColor: colors.card },
  headCell: { paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, justifyContent: 'center', borderRightWidth: 1, borderRightColor: colors.border },
  headText: { color: colors.text, fontSize: font.sm, fontWeight: '700' },
  addColCell: { alignItems: 'center', borderRightWidth: 0 },
  addColText: { color: colors.accent, fontSize: 20, fontWeight: '400' },

  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
  rowAlt: { backgroundColor: colors.card },
  cell: { color: colors.text, fontSize: font.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, borderRightWidth: 1, borderRightColor: colors.border, minHeight: 46 },
  photoCell: { alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderRightColor: colors.border, minHeight: 46 },
  thumb: { width: 38, height: 38, borderRadius: 6 },
  photoPlus: { color: colors.muted, fontSize: 22, fontWeight: '300' },
  actionCell: { alignItems: 'center', justifyContent: 'center' },
  trash: { color: colors.danger, fontSize: font.md, fontWeight: '700' },

  totalRow: { backgroundColor: colors.card, borderBottomWidth: 2 },
  totalCell: { paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, justifyContent: 'center' },
  totalText: { color: colors.muted, fontSize: font.sm, fontWeight: '700' },
  totalNum: { color: colors.accentDark, textAlign: 'right' },

  // left-aligned so it stays on-screen even when the grid is wider than the phone
  addRow: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg, alignItems: 'flex-start', borderBottomWidth: 1, borderBottomColor: colors.border },
  addRowText: { color: colors.accent, fontSize: font.md, fontWeight: '600' },

  busyOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#0006', alignItems: 'center', justifyContent: 'center',
  },

  sheetBackdrop: { flex: 1, backgroundColor: '#0007', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: spacing.lg, borderTopWidth: 1, borderColor: colors.border },
  sheetTitle: { color: colors.text, fontSize: font.lg, fontWeight: '700', marginBottom: spacing.sm },
  sheetBtn: { paddingVertical: spacing.md },
  sheetBtnText: { color: colors.text, fontSize: font.md, fontWeight: '500' },
  sheetInput: { backgroundColor: colors.card, color: colors.text, borderRadius: 8, padding: spacing.md, fontSize: font.md, borderWidth: 1, borderColor: colors.border },

  field: { marginBottom: spacing.sm },
  fieldRow: { flexDirection: 'row', gap: spacing.sm },
  fieldLabel: { color: colors.muted, fontSize: font.sm, marginBottom: 4 },

  typeRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  typeBtn: { flex: 1, paddingVertical: spacing.sm, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  typeBtnActive: { backgroundColor: colors.accent + '18', borderColor: colors.accent },
  typeBtnText: { color: colors.muted, fontWeight: '600' },
  typeBtnTextActive: { color: colors.accentDark },

  payCard: { backgroundColor: colors.card, borderRadius: 10, padding: spacing.md, marginTop: spacing.md, borderWidth: 1, borderColor: colors.border },
  payRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  payRowStrong: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.xs, paddingTop: spacing.sm },
  payLabel: { color: colors.muted, fontSize: font.sm },
  payValue: { color: colors.text, fontSize: font.sm, fontWeight: '500' },
  payStrongText: { color: colors.accentDark, fontSize: font.lg, fontWeight: '700' },

  saveBtn: { backgroundColor: colors.accent, borderRadius: 8, padding: spacing.md, alignItems: 'center', marginTop: spacing.md },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: font.md },
  deleteLink: { alignItems: 'center', paddingVertical: spacing.sm },
  deleteLinkText: { color: colors.danger, fontSize: font.sm, fontWeight: '600' },

  previewBackdrop: { flex: 1, backgroundColor: '#000e', alignItems: 'center', justifyContent: 'center' },
  previewImg: { width: '92%', height: '80%' },
  previewHint: { color: '#f0f0f0', marginTop: spacing.md, fontSize: font.sm },
});
