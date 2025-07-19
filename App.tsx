import React, { useState, useEffect, useRef } from 'react';
const USER_NAME_KEY = 'USER_NAME';
import AsyncStorage from './AsyncStorage';
import NoteDetail, { Note as NoteTypeBase } from './NoteDetail';

// Extend NoteType to include createdAt
type NoteType = NoteTypeBase & { createdAt?: string };

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
  // Helper to get all descendant ids of a note (including itself)
  const getAllDescendantIds = (note: NoteType): string[] => {
    let ids = [note.id];
    if (note.subnotes && note.subnotes.length > 0) {
      for (const sub of note.subnotes) {
        ids = ids.concat(getAllDescendantIds(sub));
      }
    }
    return ids;
  };
  // Checklist state for study modal
  const STUDY_CHECKBOX_KEY = 'STUDY_CHECKBOX_DATA';
  const [studyModalSelected, setStudyModalSelected] = useState<{ [id: string]: boolean }>({});

  // Load studyModalSelected (checkbox state) from AsyncStorage on mount
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STUDY_CHECKBOX_KEY);
        if (stored) {
          setStudyModalSelected(JSON.parse(stored));
        }
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  // Save studyModalSelected (checkbox state) to AsyncStorage whenever it changes
  useEffect(() => {
    (async () => {
      try {
        await AsyncStorage.setItem(STUDY_CHECKBOX_KEY, JSON.stringify(studyModalSelected));
      } catch (e) {
        // ignore
      }
    })();
  }, [studyModalSelected]);
  // Study mode notes modal state
  const [studyNotesModalVisible, setStudyNotesModalVisible] = useState(false);
  // Track the stack of notes being viewed in the modal (for subnotes navigation)
  const [studyModalStack, setStudyModalStack] = useState<NoteType[][]>([]);
  // Helper to find the stack to a note by id (works for any subnote)
  const findNoteStackById = (id: string, notesArr: NoteType[], path: { note: NoteType; parent: NoteType[] }[] = []): { note: NoteType; parent: NoteType[] }[] | null => {
    for (const note of notesArr) {
      const newPath = [...path, { note, parent: notesArr }];
      if (note.id === id) return newPath;
      if (note.subnotes && note.subnotes.length > 0) {
        const found = findNoteStackById(id, note.subnotes, newPath);
        if (found) return found;
      }
    }
    return null;
  };
  // PIN lock state
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  // Notes state
  const [note, setNote] = useState('');
  const [notes, setNotes] = useState<NoteType[]>([]);
  const NOTES_KEY = 'NOTES_DATA';
  const [page, setPage] = useState<'Notes' | 'Archive' | 'Settings' | 'Detail' | 'FlowChart' | 'Study' | 'StudyAnalytics'>('Notes');
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

  // User name state
  const [userName, setUserName] = useState('');
  // Load user name from AsyncStorage
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(USER_NAME_KEY);
        if (stored) setUserName(stored);
      } catch {}
    })();
  }, []);

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
      setNotes([...notes, { id: Date.now().toString(), text: note, subnotes: [], createdAt: new Date().toISOString() }]);
    }
    setNote('');
  };

  // Add subnote to a note in the stack
  const addSubnoteToStack = (newSubnote: NoteType) => {
    if (!newSubnote.text.trim() || noteStack.length === 0) return;
    // Add createdAt if not present
    const subWithDate = { ...newSubnote, createdAt: newSubnote.createdAt || new Date().toISOString() };
    const stackCopy = [...noteStack];
    const current = stackCopy[stackCopy.length - 1];
    const addSubnote = (notesArr: NoteType[]): NoteType[] =>
      notesArr.map(n =>
        n.id === current.note.id
          ? { ...n, subnotes: [...n.subnotes, subWithDate] }
          : { ...n, subnotes: addSubnote(n.subnotes) }
      );
    setNotes(addSubnote(notes));
    // Also update stack to reflect new subnote
    current.note.subnotes.push(subWithDate);
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
            {item.createdAt && (
              <Text style={{ color: '#aaa', fontSize: 12, marginTop: 2 }}>
                {new Date(item.createdAt).toLocaleString()}
              </Text>
            )}
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

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
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
          <View style={{ flex: 1, justifyContent: 'center', marginLeft: 16 }}>
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: 'bold', textAlign: 'left', marginBottom: 0, fontStyle: 'italic' }}>{getGreeting()}</Text>
            {userName ? (
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600', textAlign: 'left', marginTop: 2, fontStyle: 'italic' }}>{userName}</Text>
            ) : null}
          </View>
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
                        const stack = findNoteStackById(n.id, notes);
                        if (stack) {
                          setNoteStack(stack);
                          setPage('Detail');
                        }
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
            activeOpacity={0.85}
          >
            <Text style={styles.deleteButtonText}>Delete Selected ({selectedNotes.length})</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableWithoutFeedback>
  );

  // State to hold the selected notes tree for Study mode
  const STUDY_NOTES_KEY = 'STUDY_NOTES_DATA';
  const [studySelectedTree, setStudySelectedTree] = useState<NoteType[]>([]);

  // Load study notes from AsyncStorage on mount
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STUDY_NOTES_KEY);
        if (stored) {
          setStudySelectedTree(JSON.parse(stored));
        }
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  // Save study notes to AsyncStorage whenever studySelectedTree changes
  useEffect(() => {
    (async () => {
      try {
        await AsyncStorage.setItem(STUDY_NOTES_KEY, JSON.stringify(studySelectedTree));
      } catch (e) {
        // ignore
      }
    })();
  }, [studySelectedTree]);

  // Helper to filter a notes tree by selected ids, preserving hierarchy
  const filterNotesBySelected = (notesArr: NoteType[], selected: { [id: string]: boolean }): NoteType[] => {
    return notesArr
      .map(n => {
        if (selected[n.id]) {
          // If this note is selected, include it and all its subnotes (recursively filtered)
          return {
            ...n,
            subnotes: filterNotesBySelected(n.subnotes, selected),
          };
        } else {
          // If not selected, skip
          return null;
        }
      })
      .filter(Boolean) as NoteType[];
  };

  // State to track expanded/collapsed notes in Study page
  const STUDY_EXPANDED_KEY = 'STUDY_EXPANDED_DATA';
  const [studyExpanded, setStudyExpanded] = useState<{ [id: string]: boolean }>({});

  // Load studyExpanded from AsyncStorage on mount
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STUDY_EXPANDED_KEY);
        if (stored) {
          setStudyExpanded(JSON.parse(stored));
        }
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  // Save studyExpanded to AsyncStorage whenever it changes
  useEffect(() => {
    (async () => {
      try {
        await AsyncStorage.setItem(STUDY_EXPANDED_KEY, JSON.stringify(studyExpanded));
      } catch (e) {
        // ignore
      }
    })();
  }, [studyExpanded]);

  // Recursive render for Study page: checklist for every note and subnote, dropdown for subnotes
  const renderStudyNotesList = (notesArr: NoteType[], level: number = 0) => (
    <>
      {notesArr.map(note => {
        const hasSelectedSubnotes = note.subnotes && note.subnotes.length > 0;
        const expanded = !!studyExpanded[note.id];
        const isLeaf = !note.subnotes || note.subnotes.length === 0;

        // Helper to count leaf descendants and checked leaves
        function countLeafAndChecked(n: NoteType): { total: number; checked: number } {
          if (!n.subnotes || n.subnotes.length === 0) {
            return { total: 1, checked: studyModalSelected[n.id] ? 1 : 0 };
          }
          return n.subnotes.reduce(
            (acc, sub) => {
              const res = countLeafAndChecked(sub);
              return { total: acc.total + res.total, checked: acc.checked + res.checked };
            },
            { total: 0, checked: 0 }
          );
        }
        let percent = null;
        if (!isLeaf) {
          const { total, checked } = countLeafAndChecked(note);
          if (total > 0) {
            percent = Math.round((checked / total) * 100);
          }
        }

        // Color palette for nesting
        const borderColors = ['#6cf', '#f6c', '#fc6', '#6f6', '#f66', '#66f', '#ccc'];
        const bgColors = [
          'rgba(30,30,40,0.98)',
          'rgba(40,30,50,0.98)',
          'rgba(30,40,50,0.98)',
          'rgba(40,40,30,0.98)',
          'rgba(50,30,30,0.98)',
          'rgba(30,50,30,0.98)',
          'rgba(50,50,50,0.98)'
        ];
        const borderColor = borderColors[level % borderColors.length];
        const bgColor = bgColors[level % bgColors.length];

        return (
          <View
            key={note.id}
            style={{
              borderLeftWidth: 4,
              borderColor: borderColor,
              backgroundColor: bgColor,
              borderRadius: 10,
              marginTop: 8,
              marginBottom: 0,
              marginLeft: level === 0 ? 0 : 8,
              paddingVertical: 10,
              paddingHorizontal: 10,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.10,
              shadowRadius: 3,
              elevation: 1,
              minHeight: 54,
              // Remove alignItems: 'center' and flexDirection: 'row' from outer card
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {/* Checklist button only for leaf notes */}
              {isLeaf && (
                <TouchableOpacity
                  onPress={() => {
                    const ids = getAllDescendantIds(note);
                    setStudyModalSelected(sel => {
                      const checked = !sel[note.id];
                      const updated = { ...sel };
                      ids.forEach(id => {
                        updated[id] = checked;
                      });
                      return updated;
                    });
                  }}
                  style={{ marginRight: 12, width: 28, height: 28, borderRadius: 6, borderWidth: 2, borderColor: '#fff', backgroundColor: studyModalSelected[note.id] ? borderColor : 'transparent', justifyContent: 'center', alignItems: 'center' }}
                >
                  {studyModalSelected[note.id] && (
                    <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>✓</Text>
                  )}
                </TouchableOpacity>
              )}
              {/* Expand/collapse and note text */}
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                activeOpacity={0.7}
                onPress={() => {
                  setStudyExpanded(exp => ({ ...exp, [note.id]: !expanded }));
                }}
              >
                <Text style={{ color: borderColor, fontSize: 18, fontWeight: 'bold', marginRight: 8 }}>
                  {expanded ? '▼' : '▶'}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.noteText, { color: '#fff' }]}>{note.text}</Text>
                  {note.createdAt && (
                    <Text style={{ color: '#aaa', fontSize: 12, marginTop: 2 }}>
                      {new Date(note.createdAt).toLocaleString()}
                    </Text>
                  )}
                </View>
                {/* Percentage for non-leaf notes */}
                {!isLeaf && percent !== null && (
                  <Text style={{ color: borderColor, fontWeight: 'bold', fontSize: 15, marginLeft: 10, minWidth: 38, textAlign: 'right' }}>{percent}%</Text>
                )}
              </TouchableOpacity>
              {/* Go button for all notes and subnotes */}
              <TouchableOpacity
                onPress={() => {
                  // Find the stack to this note in studySelectedTree
                  const findStack = (
                    targetId: string,
                    notesArr: NoteType[],
                    path: { note: NoteType; parent: NoteType[] }[] = []
                  ): { note: NoteType; parent: NoteType[] }[] | null => {
                    for (const n of notesArr) {
                      const newPath = [...path, { note: n, parent: notesArr }];
                      if (n.id === targetId) return newPath;
                      if (n.subnotes && n.subnotes.length > 0) {
                        const found = findStack(targetId, n.subnotes, newPath);
                        if (found) return found;
                      }
                    }
                    return null;
                  };
                  const stack = findStack(note.id, studySelectedTree);
                  if (stack) {
                    setNoteStack(stack);
                    setPage('Detail');
                  }
                }}
                style={{ marginLeft: 8, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: borderColor, borderRadius: 6 }}
              >
                <Text style={{ color: '#222', fontWeight: 'bold', fontSize: 15 }}>Go</Text>
              </TouchableOpacity>
            </View>
            {/* Render subnotes if expanded, as true children inside this card */}
            {expanded && hasSelectedSubnotes && (
              <View style={{ marginTop: 4, marginLeft: 8 }}>
                {renderStudyNotesList(note.subnotes, level + 1)}
              </View>
            )}
          </View>
        );
      })}
    </>
  );

  const renderStudyPage = () => (
    <View style={{ flex: 1 }}>
      {/* Study Mode Header - fixed at top left, analytics button right */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, marginBottom: 12, zIndex: 10, backgroundColor: '#000', justifyContent: 'space-between' }}>
        <Text style={{ color: '#fff', fontSize: 26, fontWeight: 'bold', textAlign: 'left', letterSpacing: 1 }}>
          Study Mode
        </Text>
        <TouchableOpacity
          onPress={() => {
            setPage('StudyAnalytics');
          }}
          style={{ marginLeft: 16, padding: 8, borderRadius: 8, backgroundColor: '#181818', alignItems: 'center', justifyContent: 'center' }}
          accessibilityLabel="Analytics"
        >
          {/* Bar chart icon using emoji for now, can replace with SVG/icon later */}
          <Text style={{ fontSize: 26, color: '#6cf', fontWeight: 'bold' }}>🧐</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} horizontal={true}>
        <View style={{ flex: 1, minWidth: '100%' }}>
          <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
            {studySelectedTree.length === 0 ? (
              <Text style={{ color: '#fff', marginTop: 24, textAlign: 'center' }}>Welcome to Study mode!</Text>
            ) : (
              renderStudyNotesList(studySelectedTree)
            )}
          </ScrollView>
        </View>
      </ScrollView>
    </View>


  // Study Analytics page
  // Inline rendering in main return to avoid syntax issues
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
    const newNote: NoteType & { createdAt?: string } = {
      id: Date.now().toString(),
      text: '',
      subnotes: [],
      createdAt: new Date().toISOString(),
    };
    setNotes(prev => {
      const updated = [...prev, newNote];
      setNoteStack([{ note: newNote, parent: updated }]);
      return updated;
    });
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
        {page === 'Study' && renderStudyPage()}
        {page === 'StudyAnalytics' && (() => {
          const StudyAnalyticsScreen = require('./src/screens/StudyAnalyticsScreen').default;
          return <StudyAnalyticsScreen onBack={() => setPage('Study')} />;
        })()}
      </View>

      {/* Floating Add Button (FAB) */}
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
      {page === 'Study' && !keyboardVisible && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => {
            setStudyModalStack([notes]);
            setStudyNotesModalVisible(true);
            setStudyModalSelected({}); // Optionally clear selection on open
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.fabIcon}>＋</Text>
        </TouchableOpacity>
      )}

      {/* Study Notes Modal */}
      <RNModal
        visible={studyNotesModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setStudyNotesModalVisible(false);
          setStudyModalStack([]);
        }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: '#222', borderRadius: 12, padding: 20, width: '85%', maxHeight: '70%' }}>
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' }}>
              {studyModalStack.length > 1 ? 'Subnotes' : 'All Notes'}
            </Text>
            {studyModalStack.length > 1 && (
              <TouchableOpacity
                style={{ marginBottom: 10, alignSelf: 'flex-start' }}
                onPress={() => setStudyModalStack(stack => stack.slice(0, -1))}
              >
                <Text style={{ color: '#6cf', fontSize: 16 }}>{'← Back'}</Text>
              </TouchableOpacity>
            )}
            <FlatList
              data={studyModalStack[studyModalStack.length - 1] || []}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#333' }}>
                  {/* Checklist */}
                  <TouchableOpacity
                    onPress={() => {
                      const ids = getAllDescendantIds(item);
                      setStudyModalSelected(sel => {
                        const checked = !sel[item.id];
                        const updated = { ...sel };
                        ids.forEach(id => {
                          updated[id] = checked;
                        });
                        return updated;
                      });
                    }}
                    style={{ marginRight: 12, width: 28, height: 28, borderRadius: 6, borderWidth: 2, borderColor: '#fff', backgroundColor: studyModalSelected[item.id] ? '#6cf' : 'transparent', justifyContent: 'center', alignItems: 'center' }}
                  >
                    {studyModalSelected[item.id] && (
                      <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>✓</Text>
                    )}
                  </TouchableOpacity>
                  <Text style={{ color: '#fff', fontSize: 16, flex: 1 }}>{item.text}</Text>
                  <TouchableOpacity
                    onPress={() => setStudyModalStack(stack => [...stack, item.subnotes || []])}
                    style={{ padding: 4 }}
                  >
                    <Text style={{ color: '#fff', fontSize: 20, marginLeft: 8 }}>→</Text>
                  </TouchableOpacity>
                </View>
              )}
              ListEmptyComponent={<Text style={{ color: '#aaa', textAlign: 'center', marginVertical: 20 }}>No notes found.</Text>}
              style={{ marginBottom: 12 }}
            />
            <View style={{ flexDirection: 'row', marginTop: 8 }}>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: '#6cf', borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginRight: 8 }}
                onPress={() => {
                  // Build the selected notes tree and merge with existing studySelectedTree
                  const selectedTree = filterNotesBySelected(notes, studyModalSelected);
                  // Helper to merge two trees by id, preserving all unique notes and merging subnotes
                  function mergeNotesTree(base: NoteType[], add: NoteType[]): NoteType[] {
                    // Helper to merge two arrays of notes by id, preventing duplicates
                    const map = new Map(base.map(n => [n.id, n]));
                    for (const n of add) {
                      if (map.has(n.id)) {
                        // Merge subnotes recursively, but do not duplicate
                        const mergedSubnotes = mergeNotesTree(map.get(n.id)!.subnotes, n.subnotes);
                        map.set(n.id, {
                          ...map.get(n.id)!,
                          subnotes: mergedSubnotes,
                        });
                      } else {
                        // Add only if not present
                        map.set(n.id, { ...n, subnotes: mergeNotesTree([], n.subnotes) });
                      }
                    }
                    return Array.from(map.values());
                  }
                  setStudySelectedTree(prev => mergeNotesTree(prev, selectedTree));
                  setStudyNotesModalVisible(false);
                  setStudyModalStack([]);
                }}
              >
                <Text style={{ color: '#222', fontWeight: 'bold' }}>Add</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: '#444', borderRadius: 8, paddingVertical: 12, alignItems: 'center' }}
                onPress={() => {
                  setStudyNotesModalVisible(false);
                  setStudyModalStack([]);
                }}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </RNModal>

      {/* Navigation Bar */}
      {!keyboardVisible && page !== 'FlowChart' && (
        <View style={styles.navBar}>
          {(['Notes', 'Archive', 'Study', 'Settings'] as const).map(p => {
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
    marginBottom: 18,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  logoCircular: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#222',
    // borderWidth: 2,
    // borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 3,
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
    borderColor: '#fff',
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
    borderColor: '#fff',
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
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginVertical: 6,
    marginHorizontal: 2,
    backgroundColor: 'rgba(30,30,30,0.98)',
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.10)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.13,
    shadowRadius: 6,
    elevation: 2,
    minHeight: 54,
  },
  flowChartIcon: {
    fontSize: 20,
    marginLeft: 10,
    color: '#6cf',
  },
  noteText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  pageCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  navBar: {
    flexDirection: 'row',
    backgroundColor: '#111',
    paddingVertical: 10,
    paddingHorizontal: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    justifyContent: 'space-around',
    margin: 0,
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 12,
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
    backgroundColor: '#111',
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.32,
    shadowRadius: 8,
    zIndex: 10,
    borderWidth: 2,
    borderColor: '#111',
  },
  fabIcon: {
    color: '#fff',
    fontSize: 38,
    fontWeight: 'bold',
    marginTop: -2,
    textShadowColor: 'rgba(0,0,0,0.12)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 2,
  },
  deleteButton: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 80,
    backgroundColor: '#f44',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    zIndex: 50,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
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