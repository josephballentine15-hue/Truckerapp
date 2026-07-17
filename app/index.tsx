import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  FlatList, Image, Modal, ActivityIndicator, Alert, Platform,
  KeyboardAvoidingView, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Column, ColumnType, Logbook, Row } from '../lib/types';
import {
  loadLogbook, saveLogbook, makeRow, emptyLogbook,
} from '../lib/storage';
import { capturePhoto, deletePhoto } from '../lib/photos';
import { makeId } from '../lib/id';
import { colors, spacing, font } from '../lib/theme';

const PHOTO_W = 60;
const ACTIONS_W = 48;
const colWidth = (c: Column) => (c.type === 'number' ? 96 : c.name.toLowerCase() === 'notes' ? 180 : 140);

export default function LogbookScreen() {
  const insets = useSafeAreaInsets();
  const [book, setBook] = useState<Logbook | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // photo action target + preview
  const [photoRowId, setPhotoRowId] = useState<string | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  // column editor: 'new' to add, or a Column to edit
  const [colEditor, setColEditor] = useState<'new' | Column | null>(null);

  useEffect(() => {
    loadLogbook().then(setBook);
  }, []);

  // Debounced persistence on every mutation.
  const commit = useCallback((next: Logbook) => {
    setBook(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveLogbook(next), 400);
  }, []);

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  const setCell = (rowId: string, colId: string, value: string) => {
    if (!book) return;
    commit({
      ...book,
      rows: book.rows.map((r) =>
        r.id === rowId ? { ...r, cells: { ...r.cells, [colId]: value } } : r
      ),
    });
  };

  const addRow = () => {
    if (!book) return;
    commit({ ...book, rows: [...book.rows, makeRow(book.columns)] });
  };

  const deleteRow = (row: Row) => {
    if (!book) return;
    Alert.alert('Delete row', 'Remove this entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: () => {
          deletePhoto(row.photoUri);
          commit({ ...book, rows: book.rows.filter((r) => r.id !== row.id) });
        },
      },
    ]);
  };

  const saveColumn = (draft: { id?: string; name: string; type: ColumnType }) => {
    if (!book) return;
    const name = draft.name.trim();
    if (!name) return;
    if (draft.id) {
      commit({
        ...book,
        columns: book.columns.map((c) =>
          c.id === draft.id ? { ...c, name, type: draft.type } : c
        ),
      });
    } else {
      const col: Column = { id: makeId('c_'), name, type: draft.type };
      commit({
        ...book,
        columns: [...book.columns, col],
        rows: book.rows.map((r) => ({ ...r, cells: { ...r.cells, [col.id]: '' } })),
      });
    }
    setColEditor(null);
  };

  const deleteColumn = (colId: string) => {
    if (!book) return;
    if (book.columns.length <= 1) {
      Alert.alert('Keep one column', 'A logbook needs at least one column.');
      return;
    }
    commit({
      ...book,
      columns: book.columns.filter((c) => c.id !== colId),
      rows: book.rows.map((r) => {
        const cells = { ...r.cells };
        delete cells[colId];
        return { ...r, cells };
      }),
    });
    setColEditor(null);
  };

  const choosePhoto = async (source: 'camera' | 'library') => {
    const rowId = photoRowId;
    setPhotoRowId(null);
    if (!rowId || !book) return;
    const uri = await capturePhoto(source);
    if (!uri) return;
    const existing = book.rows.find((r) => r.id === rowId)?.photoUri;
    if (existing) deletePhoto(existing);
    commit({
      ...book,
      rows: book.rows.map((r) => (r.id === rowId ? { ...r, photoUri: uri } : r)),
    });
  };

  const removePhoto = () => {
    const rowId = photoRowId;
    setPhotoRowId(null);
    if (!rowId || !book) return;
    const row = book.rows.find((r) => r.id === rowId);
    if (row?.photoUri) deletePhoto(row.photoUri);
    commit({
      ...book,
      rows: book.rows.map((r) => (r.id === rowId ? { ...r, photoUri: null } : r)),
    });
  };

  const gridWidth = useMemo(
    () => (book ? PHOTO_W + book.columns.reduce((w, c) => w + colWidth(c), 0) + ACTIONS_W : 0),
    [book]
  );

  if (!book) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  const activeRow = photoRowId ? book.rows.find((r) => r.id === photoRowId) : null;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Logbook</Text>
          <Text style={styles.subtitle}>
            {book.rows.length} {book.rows.length === 1 ? 'entry' : 'entries'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => setColEditor('new')}
        >
          <Text style={styles.headerBtnText}>+ Column</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ minWidth: gridWidth }}>
        <View>
          {/* header row */}
          <View style={styles.headRow}>
            <View style={[styles.headCell, { width: PHOTO_W }]}>
              <Text style={styles.headText}>📷</Text>
            </View>
            {book.columns.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.headCell, { width: colWidth(c) }]}
                onPress={() => setColEditor(c)}
              >
                <Text style={styles.headText} numberOfLines={1}>{c.name}</Text>
              </TouchableOpacity>
            ))}
            <View style={[styles.headCell, { width: ACTIONS_W }]} />
          </View>

          {/* body */}
          <FlatList
            data={book.rows}
            keyExtractor={(r) => r.id}
            style={{ maxHeight: '100%' }}
            keyboardShouldPersistTaps="handled"
            ListFooterComponent={
              <TouchableOpacity style={[styles.addRow, { width: gridWidth }]} onPress={addRow}>
                <Text style={styles.addRowText}>+  Add entry</Text>
              </TouchableOpacity>
            }
            renderItem={({ item, index }) => (
              <View style={[styles.row, index % 2 === 1 && styles.rowAlt]}>
                <TouchableOpacity
                  style={[styles.photoCell, { width: PHOTO_W }]}
                  onPress={() =>
                    item.photoUri ? setPreviewUri(item.photoUri) : setPhotoRowId(item.id)
                  }
                  onLongPress={() => setPhotoRowId(item.id)}
                >
                  {item.photoUri ? (
                    <Image source={{ uri: item.photoUri }} style={styles.thumb} />
                  ) : (
                    <Text style={styles.photoPlus}>＋</Text>
                  )}
                </TouchableOpacity>

                {book.columns.map((c) => (
                  <TextInput
                    key={c.id}
                    style={[styles.cell, { width: colWidth(c) }]}
                    value={item.cells[c.id] ?? ''}
                    onChangeText={(t) => setCell(item.id, c.id, t)}
                    placeholder="—"
                    placeholderTextColor={colors.border}
                    keyboardType={c.type === 'number' ? 'numbers-and-punctuation' : 'default'}
                    multiline={c.name.toLowerCase() === 'notes'}
                  />
                ))}

                <TouchableOpacity
                  style={[styles.actionCell, { width: ACTIONS_W }]}
                  onPress={() => deleteRow(item)}
                >
                  <Text style={styles.trash}>✕</Text>
                </TouchableOpacity>
              </View>
            )}
          />
        </View>
      </ScrollView>

      {/* photo options sheet */}
      <BottomSheet visible={!!photoRowId} onClose={() => setPhotoRowId(null)}>
        <SheetButton label="📷  Take photo" onPress={() => choosePhoto('camera')} />
        <SheetButton label="🖼  Choose from library" onPress={() => choosePhoto('library')} />
        {activeRow?.photoUri && (
          <>
            <SheetButton label="👁  View photo" onPress={() => { const u = activeRow.photoUri!; setPhotoRowId(null); setPreviewUri(u); }} />
            <SheetButton label="🗑  Remove photo" danger onPress={removePhoto} />
          </>
        )}
      </BottomSheet>

      {/* full-screen preview */}
      <Modal visible={!!previewUri} transparent animationType="fade" onRequestClose={() => setPreviewUri(null)}>
        <Pressable style={styles.previewBackdrop} onPress={() => setPreviewUri(null)}>
          {previewUri && <Image source={{ uri: previewUri }} style={styles.previewImg} resizeMode="contain" />}
          <Text style={styles.previewHint}>Tap to close</Text>
        </Pressable>
      </Modal>

      {/* column editor */}
      <ColumnEditor
        target={colEditor}
        onCancel={() => setColEditor(null)}
        onSave={saveColumn}
        onDelete={deleteColumn}
      />
    </KeyboardAvoidingView>
  );
}

/* ---------- Column editor modal ---------- */
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
          <TouchableOpacity
            key={t}
            style={[styles.typeBtn, type === t && styles.typeBtnActive]}
            onPress={() => setType(t)}
          >
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
  visible, onClose, children,
}: { visible: boolean; onClose: () => void; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SheetButton({
  label, onPress, danger,
}: { label: string; onPress: () => void; danger?: boolean }) {
  return (
    <TouchableOpacity style={styles.sheetBtn} onPress={onPress}>
      <Text style={[styles.sheetBtnText, danger && { color: colors.danger }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  title: { color: colors.text, fontSize: font.xxl, fontWeight: '700' },
  subtitle: { color: colors.muted, fontSize: font.sm, marginTop: 2 },
  headerBtn: {
    backgroundColor: colors.accent, borderRadius: 10,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  headerBtnText: { color: '#000', fontWeight: '700', fontSize: font.sm },

  headRow: { flexDirection: 'row', borderBottomWidth: 2, borderBottomColor: colors.border },
  headCell: {
    paddingVertical: spacing.sm, paddingHorizontal: spacing.sm,
    justifyContent: 'center', borderRightWidth: 1, borderRightColor: colors.border,
  },
  headText: { color: colors.accent, fontSize: font.sm, fontWeight: '700' },

  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
  rowAlt: { backgroundColor: colors.card + '55' },
  cell: {
    color: colors.text, fontSize: font.md,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.sm,
    borderRightWidth: 1, borderRightColor: colors.border,
    minHeight: 46,
  },
  photoCell: {
    alignItems: 'center', justifyContent: 'center',
    borderRightWidth: 1, borderRightColor: colors.border, minHeight: 46,
  },
  thumb: { width: 40, height: 40, borderRadius: 6 },
  photoPlus: { color: colors.muted, fontSize: 22, fontWeight: '300' },
  actionCell: { alignItems: 'center', justifyContent: 'center' },
  trash: { color: colors.danger, fontSize: font.md, fontWeight: '700' },

  addRow: {
    paddingVertical: spacing.md, alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  addRowText: { color: colors.accent, fontSize: font.md, fontWeight: '600' },

  // bottom sheet
  sheetBackdrop: { flex: 1, backgroundColor: '#000a', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.card, borderTopLeftRadius: 18, borderTopRightRadius: 18,
    padding: spacing.lg, gap: spacing.sm,
    borderTopWidth: 1, borderColor: colors.border,
  },
  sheetTitle: { color: colors.text, fontSize: font.lg, fontWeight: '700', marginBottom: spacing.sm },
  sheetBtn: { paddingVertical: spacing.md },
  sheetBtnText: { color: colors.text, fontSize: font.md, fontWeight: '500' },
  sheetInput: {
    backgroundColor: colors.bg, color: colors.text, borderRadius: 10,
    padding: spacing.md, fontSize: font.md, borderWidth: 1, borderColor: colors.border,
  },
  typeRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  typeBtn: {
    flex: 1, paddingVertical: spacing.sm, borderRadius: 10, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  typeBtnActive: { backgroundColor: colors.accent + '22', borderColor: colors.accent },
  typeBtnText: { color: colors.muted, fontWeight: '600' },
  typeBtnTextActive: { color: colors.accent },
  saveBtn: {
    backgroundColor: colors.accent, borderRadius: 12, padding: spacing.md,
    alignItems: 'center', marginTop: spacing.sm,
  },
  saveBtnText: { color: '#000', fontWeight: '700', fontSize: font.md },
  deleteLink: { alignItems: 'center', paddingVertical: spacing.sm },
  deleteLinkText: { color: colors.danger, fontSize: font.sm, fontWeight: '600' },

  // preview
  previewBackdrop: { flex: 1, backgroundColor: '#000e', alignItems: 'center', justifyContent: 'center' },
  previewImg: { width: '92%', height: '80%' },
  previewHint: { color: colors.muted, marginTop: spacing.md, fontSize: font.sm },
});
