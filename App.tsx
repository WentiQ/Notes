import React, { useState, useEffect, useRef } from 'react';
import AsyncStorage from './AsyncStorage';
import NoteDetail, { Note as NoteType } from './NoteDetail';

type FlatNote = NoteType & { parent: NoteType | null };
import PinScreen from './src/screens/PinScreen';
import { getPin } from './src/utils/pin';
import SettingsScreen from './src/screens/SettingsScreen';
import {
  SafeAreaView,
  Text,
  TextInput,
  Button,
  FlatList,
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  Keyboard,
  TouchableWithoutFeedback,
  Alert,
  Modal as RNModal,
  ScrollView,
} from 'react-native';

// Import the logo image
const logo = require('./assets/logo.png');

export default function App() {
  // PIN lock state
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  // Notes state
  const [note, setNote] = useState('');
  const [notes, setNotes] = useState<NoteType[]>([]);
  const NOTES_KEY = 'NOTES_DATA';
  const [page, setPage] = useState<'Notes' | 'Archive' | 'Settings' | 'Detail' | 'FlowChart'>('Notes');
  const [flowChartRoot, setFlowChartRoot] = useState<NoteType | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [noteStack, setNoteStack] = useState<{ note: NoteType; parent: NoteType[] }[]>([]); // For navigation
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedNotes, setSelectedNotes] = useState<string[]>([]);
  const [deleteConfirmNote, setDeleteConfirmNote] = useState<null | NoteType>(null);
  const [deleteInput, setDeleteInput] = useState('');

  // Search state
  const [search, setSearch] = useState('');
  const [searchMode, setSearchMode] = useState<'file' | 'text'>('file');
  const [searchDropdown, setSearchDropdown] = useState(false);
  const searchInputRef = useRef<TextInput>(null);

  // Recursive search helpers
  const flattenNotes = (notesArr: NoteType[], parent: NoteType | null = null): FlatNote[] => {
    let out: FlatNote[] = [];
    for (const n of notesArr) {
      out.push({ ...n, parent });
      if (n.subnotes && n.subnotes.length > 0) {
        out = out.concat(flattenNotes(n.subnotes, n));
      }
    }
    return out;
  };
  const allNotesFlat: FlatNote[] = flattenNotes(notes);

  // Go to Note: filter by title
  const goToNoteResults: FlatNote[] = search.trim()
    ? allNotesFlat.filter((n: FlatNote) => n.text.toLowerCase().includes(search.toLowerCase()))
    : [];
  // Search Text: filter by content
  const searchTextResults: FlatNote[] = search.trim()
    ? allNotesFlat.filter((n: FlatNote) => (n.content || '').toLowerCase().includes(search.toLowerCase()))
    : [];

  // Check PIN on mount
  useEffect(() => {
    (async () => {
      const pin = await getPin();
      if (pin) setLocked(true);
      setLoading(false);
    })();
  }, []);

  // Load notes from AsyncStorage on mount
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(NOTES_KEY);
        if (stored) {
          setNotes(JSON.parse(stored));
        }
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  // Save notes to AsyncStorage whenever notes change
  useEffect(() => {
    (async () => {
      try {
        await AsyncStorage.setItem(NOTES_KEY, JSON.stringify(notes));
      } catch (e) {
        // ignore
      }
    })();
  }, [notes]);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Recursive filter for notes and subnotes
  const filterNotes = (notesArr: NoteType[], query: string): NoteType[] => {
    if (!query.trim()) return notesArr;
    const lower = query.toLowerCase();
    return notesArr
      .map(n => {
        const subFiltered = filterNotes(n.subnotes, query);
        if (n.text.toLowerCase().includes(lower) || subFiltered.length > 0) {
          return { ...n, subnotes: subFiltered };
        }
        return null;
      })
      .filter(Boolean) as NoteType[];
  };

  // Add note or subnote depending on context
  const addNote = () => {
    if (note.trim() === '') return;
    if (page === 'Notes') {
      setNotes([...notes, { id: Date.now().toString(), text: note, subnotes: [] }]);
    }
    setNote('');
  };

  // Add subnote to a note in the stack
  const addSubnoteToStack = (newSubnote: NoteType) => {
    if (!newSubnote.text.trim() || noteStack.length === 0) return;
    const stackCopy = [...noteStack];
    const current = stackCopy[stackCopy.length - 1];
    const addSubnote = (notesArr: NoteType[]): NoteType[] =>
      notesArr.map(n =>
        n.id === current.note.id
          ? { ...n, subnotes: [...n.subnotes, newSubnote] }
          : { ...n, subnotes: addSubnote(n.subnotes) }
      );
    setNotes(addSubnote(notes));
    // Also update stack to reflect new subnote
    current.note.subnotes.push(newSubnote);
    setNoteStack(stackCopy);
  };

  // Helper to find a note's parent array in the tree (returns the parent array containing the note)
  const findParentArray = (target: NoteType, notesArr: NoteType[]): NoteType[] | null => {
    for (const note of notesArr) {
      if (note.id === target.id) return notesArr;
      if (note.subnotes && note.subnotes.length > 0) {
        if (note.subnotes.some(sn => sn.id === target.id)) {
          return note.subnotes;
        }
        const found = findParentArray(target, note.subnotes);
        if (found) return found;
      }
    }
    return null;
  };

  // Helper to find the full path (stack) to a note in the tree
  const findNoteStack = (target: NoteType, notesArr: NoteType[], path: { note: NoteType; parent: NoteType[] }[] = []): { note: NoteType; parent: NoteType[] }[] | null => {
    for (const note of notesArr) {
      const newPath = [...path, { note, parent: notesArr }];
      if (note.id === target.id) return newPath;
      if (note.subnotes && note.subnotes.length > 0) {
        const found = findNoteStack(target, note.subnotes, newPath);
        if (found) return found;
      }
    }
    return null;
  };

  // Render a list of notes (main or subnotes)
  const renderNotesList = (notesArr: NoteType[], onNotePress: (note: NoteType, parent: NoteType[]) => void) => (
    <FlatList
      data={notesArr}
      keyExtractor={item => item.id}
      renderItem={({ item }) => (
        <View style={styles.noteRow}>
          <TouchableOpacity
            style={{ flex: 1 }}
            onPress={() => {
              if (deleteMode) {
                setSelectedNotes(sel =>
                  sel.includes(item.id)
                    ? sel.filter(id => id !== item.id)
                    : [...sel, item.id]
                );
              } else {
                onNotePress(item, notesArr);
              }
            }}
            onLongPress={() => {
              if (!deleteMode) {
                setDeleteMode(true);
                setSelectedNotes([item.id]);
              } else {
                setSelectedNotes(sel =>
                  sel.includes(item.id)
                    ? sel.filter(id => id !== item.id)
                    : [...sel, item.id]
                );
              }
            }}
          >
            <Text style={[styles.noteText, deleteMode && selectedNotes.includes(item.id) && { color: '#f44', fontWeight: 'bold' }]}>{item.text}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setFlowChartRoot(item);
              setPage('FlowChart');
            }}
            style={{ marginLeft: 10 }}
          >
            <Text style={styles.flowChartIcon}>⭕</Text>
          </TouchableOpacity>
        </View>
      )}
    />
  );
  // Render the flow chart page
  const renderFlowChartPage = () => {
    if (!flowChartRoot) return null;
    const FlowChartScreen = require('./src/screens/FlowChartScreen').default;
    return (
      <FlowChartScreen
        route={{ params: { root: flowChartRoot } }}
        navigation={{
          goBack: () => setPage('Notes'),
          openNoteDetail: (note: NoteType) => {
            const stack = findNoteStack(note, notes);
            if (stack) {
              setNoteStack(stack);
              setPage('Detail');
            }
          },
        }}
      />
    );
  };

  const renderNotesPage = () => (
    <TouchableWithoutFeedback
      onPress={() => {
        if (searchDropdown) setSearchDropdown(false);
        if (deleteMode) {
          setDeleteMode(false);
          setSelectedNotes([]);
        }
      }}
      accessible={false}
    >
      <View style={{ flex: 1 }}>
        <View style={styles.logoTitleRow}>
          <Image source={logo} style={styles.logoCircular} resizeMode="cover" />
        </View>
        {/* VSCode-style search bar */}
        <View style={styles.searchBarContainer}>
          <TextInput
            ref={searchInputRef}
            style={styles.searchBar}
            placeholder="Search notes or text..."
            placeholderTextColor="#aaa"
            value={search}
            onChangeText={txt => {
              setSearch(txt);
              setSearchDropdown(true);
            }}
            onFocus={() => setSearchDropdown(true)}
            onBlur={() => setSearchDropdown(false)}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="never"
          />
          {search.length > 0 && (
            <TouchableOpacity
              style={styles.searchClearButton}
              onPress={() => {
                setSearch('');
                searchInputRef.current?.focus();
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.searchClearText}>×</Text>
            </TouchableOpacity>
          )}
          {searchDropdown && (
            <View style={styles.searchDropdown}>
              <View style={styles.searchTabs}>
                <TouchableOpacity
                  style={[styles.searchTab, searchMode === 'file' && styles.searchTabActive]}
                  onPress={() => setSearchMode('file')}
                >
                  <Text style={styles.searchTabText}>Go to Note</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.searchTab, searchMode === 'text' && styles.searchTabActive]}
                  onPress={() => setSearchMode('text')}
                >
                  <Text style={styles.searchTabText}>Search Text</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={{ maxHeight: 220 }}>
                {(searchMode === 'file' ? goToNoteResults : searchTextResults).length === 0 ? (
                  <Text style={styles.searchNoResult}>No results</Text>
                ) : (
                  (searchMode === 'file' ? goToNoteResults : searchTextResults).map((n: FlatNote, idx: number) => (
                    <TouchableOpacity
                      key={n.id + idx}
                      style={styles.searchResultRow}
                      onPress={() => {
                        setSearchDropdown(false);
                        setSearch('');
                        setTimeout(() => {
                          setNoteStack([{ note: n, parent: n.parent ? [n.parent] : [] }]);
                          setPage('Detail');
                        }, 0);
                      }}
                    >
                      <Text style={styles.searchResultTitle}>{n.text}</Text>
                      {n.parent && (
                        <Text style={styles.searchResultParent}>in {n.parent.text}</Text>
                      )}
                      {searchMode === 'text' && n.content && (
                        <Text style={styles.searchResultSnippet}>
                          ...{n.content.replace(/\n/g, ' ').slice(Math.max(0, n.content.toLowerCase().indexOf(search.toLowerCase()) - 20), n.content.toLowerCase().indexOf(search.toLowerCase()) + 40)}...
                        </Text>
                      )}
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>
          )}
        </View>
        {renderNotesList(filterNotes(notes, search), (note, parent) => {
          setNoteStack([{ note, parent }]);
          setPage('Detail');
        })}
        {deleteMode && selectedNotes.length > 0 && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={startDeleteQueue}
          >
            <Text style={styles.deleteButtonText}>Delete Selected ({selectedNotes.length})</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableWithoutFeedback>
  );

  // Helper to update a note in the notes tree
  const updateNoteInTree = (notesArr: NoteType[], updatedNote: NoteType): NoteType[] =>
    notesArr.map(n =>
      n.id === updatedNote.id
        ? updatedNote
        : { ...n, subnotes: updateNoteInTree(n.subnotes, updatedNote) }
    );

  // Detail page for a note and its subnotes (delegated to NoteDetail)
  const renderDetailPage = () => {
    if (noteStack.length === 0) return null;
    const current = noteStack[noteStack.length - 1];
    return (
      <NoteDetail
        note={current.note}
        onBack={(): void => {
          if (noteStack.length === 1) {
            setPage('Notes');
            setNoteStack([]);
          } else {
            setNoteStack(noteStack.slice(0, -1));
          }
        }}
        onUpdateNote={(updatedNote: NoteType): void => {
          setNotes(prevNotes => updateNoteInTree(prevNotes, updatedNote));
          // Also update the stack so the UI reflects the change
          setNoteStack(stack =>
            stack.map((entry, idx) =>
              idx === stack.length - 1
                ? { ...entry, note: updatedNote }
                : entry
            )
          );
        }}
        onAddSubnote={(newSubnote: NoteType): void => addSubnoteToStack(newSubnote)}
        onOpenSubnote={(subnote: NoteType): void =>
          setNoteStack([...noteStack, { note: subnote, parent: current.note.subnotes }])
        }
        onOpenFlowChart={(note: NoteType) => {
          setFlowChartRoot(note);
          setPage('FlowChart');
        }}
        logo={logo as number}
        editingName={current.note.text === ''}
      />
    );
  };

  const renderArchivePage = () => (
    <View style={styles.pageCenter}>
      <Text style={styles.title}>📦 Archive</Text>
      <Text style={{ color: '#fff' }}>No archived notes yet.</Text>
    </View>
  );

  const renderSettingsPage = () => (
    <SettingsScreen />
  );

  // Add note and open NoteDetail for editing name
  const handleAddNoteAndEdit = () => {
    const newNote: NoteType = { id: Date.now().toString(), text: '', subnotes: [] };
    setNotes(prev => [...prev, newNote]);
    setNoteStack([{ note: newNote, parent: notes }]);
    setPage('Detail');
    setTimeout(() => {
      // This will be handled by NoteDetail via a prop
    }, 0);
  };

  // Delete selected notes after confirmation (multi-step)
  const [deleteQueue, setDeleteQueue] = useState<NoteType[]>([]);

  const startDeleteQueue = () => {
    if (selectedNotes.length === 0) return;
    const queue = selectedNotes
      .map(id => notes.find(n => n.id === id))
      .filter(Boolean) as NoteType[];
    if (queue.length > 0) {
      setDeleteQueue(queue);
      setDeleteConfirmNote(queue[0]);
      setDeleteInput('');
    }
  };

  const handleDeleteNotes = () => {
    if (!deleteConfirmNote) return;
    if (deleteInput !== deleteConfirmNote.text) {
      Alert.alert('Name does not match', 'Please type the note name exactly to confirm deletion.');
      return;
    }
    setNotes(prev => prev.filter(n => n.id !== deleteConfirmNote.id));
    setSelectedNotes(sel => sel.filter(id => id !== deleteConfirmNote.id));
    setDeleteInput('');
    // Remove from queue and move to next
    setTimeout(() => {
      setDeleteQueue(q => {
        const nextQueue = q.filter(n => n.id !== deleteConfirmNote.id);
        if (nextQueue.length > 0) {
          setDeleteConfirmNote(nextQueue[0]);
        } else {
          setDeleteConfirmNote(null);
          setDeleteMode(false);
        }
        return nextQueue;
      });
    }, 0);
  };

  if (loading) return null;
  if (locked) {
    return <PinScreen onSuccess={() => setLocked(false)} />;
  }
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {page === 'Notes' && renderNotesPage()}
        {page === 'Detail' && renderDetailPage()}
        {page === 'Archive' && renderArchivePage()}
        {page === 'Settings' && renderSettingsPage()}
        {page === 'FlowChart' && renderFlowChartPage()}
      </View>

      {/* Floating Add Button (FAB) */}
      {page === 'Notes' && !keyboardVisible && (
        <TouchableOpacity
          style={styles.fab}
          onPress={handleAddNoteAndEdit}
          activeOpacity={0.8}
        >
          <Text style={styles.fabIcon}>＋</Text>
        </TouchableOpacity>
      )}

      {/* Navigation Bar */}
      {!keyboardVisible && page !== 'FlowChart' && (
        <View style={styles.navBar}>
          {(['Notes', 'Archive', 'Settings'] as const).map(p => {
            const isActive = page === p;
            return (
              <TouchableOpacity
                key={p}
                onPress={() => setPage(p)}
                style={[styles.navItem, isActive && styles.navItemActive]}
                activeOpacity={0.8}
              >
                <Text style={[styles.navText, isActive && styles.navTextActive]}>{p}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Delete confirmation modal */}
      <RNModal
        visible={!!deleteConfirmNote}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setDeleteConfirmNote(null);
          setDeleteInput('');
          setDeleteQueue([]);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Type the note name to confirm deletion</Text>
            <Text style={{ color: '#fff', marginBottom: 8, textAlign: 'center' }}>{deleteConfirmNote?.text}</Text>
            <TextInput
              style={styles.input}
              value={deleteInput}
              onChangeText={setDeleteInput}
              placeholder="Type note name exactly"
              placeholderTextColor="#aaa"
              autoFocus
            />
            <View style={{ flexDirection: 'row', marginTop: 16, justifyContent: 'center' }}>
              <TouchableOpacity
                style={[styles.modalAddButton, { backgroundColor: '#f44', marginRight: 10 }]}
                onPress={handleDeleteNotes}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Delete</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => {
                  setDeleteConfirmNote(null);
                  setDeleteInput('');
                  setDeleteQueue([]);
                }}
              >
                <Text style={styles.modalCloseText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </RNModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  logoTitleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  logoCircular: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: '#222',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#fff',
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#fff',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    color: '#fff',
  },
  searchBarContainer: {
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#444',
    paddingHorizontal: 10,
    height: 44,
    position: 'relative',
  },
  searchBar: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    paddingVertical: 0,
    backgroundColor: 'transparent',
  },
  searchClearButton: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  searchClearText: {
    color: '#aaa',
    fontSize: 22,
    fontWeight: 'bold',
    paddingHorizontal: 2,
    paddingVertical: 0,
  },
  searchDropdown: {
    position: 'absolute',
    top: 44,
    left: 0,
    right: 0,
    backgroundColor: '#222',
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    borderWidth: 1.5,
    borderColor: '#444',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  searchTabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  searchTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  searchTabActive: {
    backgroundColor: '#333',
  },
  searchTabText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  searchResultRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  searchResultTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  searchResultParent: {
    color: '#aaa',
    fontSize: 13,
    marginTop: 2,
  },
  searchResultSnippet: {
    color: '#6cf',
    fontSize: 13,
    marginTop: 2,
    fontStyle: 'italic',
  },
  searchNoResult: {
    color: '#aaa',
    textAlign: 'center',
    padding: 16,
  },
  buttonContainer: {
    marginBottom: 20,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    backgroundColor: '#111',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  flowChartIcon: {
    fontSize: 20,
    marginLeft: 10,
    color: '#6cf',
  },
  noteText: {
    color: '#fff',
  },
  pageCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  navBar: {
    flexDirection: 'row',
    backgroundColor: '#111',
    padding: 10,
    margin: 10,
    borderRadius: 20,
    justifyContent: 'space-around',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  navItem: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 16,
  },
  navItemActive: {
    backgroundColor: '#fff',
    borderRadius: 16,
  },
  navText: {
    color: '#aaa',
    fontWeight: 'bold',
    fontSize: 16,
  },
  navTextActive: {
    color: '#000',
    fontWeight: 'bold',
  },
  fab: {
    position: 'absolute',
    right: 28,
    bottom: 90,
    backgroundColor: '#6cf',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    zIndex: 10,
  },
  fabIcon: {
    color: '#fff',
    fontSize: 36,
    fontWeight: 'bold',
    marginTop: -2,
  },
  deleteButton: {
    backgroundColor: '#f44',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    margin: 16,
  },
  deleteButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  modalContent: {
    width: '80%',
    backgroundColor: '#222',
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
    elevation: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#fff',
  },
  modalAddButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  modalCloseButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
    backgroundColor: '#333',
  },
  modalCloseText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});