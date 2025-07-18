import React, { useState, useEffect } from 'react';
import AsyncStorage from './AsyncStorage';
import NoteDetail, { Note as NoteType } from './NoteDetail';
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
  const [page, setPage] = useState<'Notes' | 'Archive' | 'Settings' | 'Detail'>('Notes');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [noteStack, setNoteStack] = useState<{ note: NoteType; parent: NoteType[] }[]>([]); // For navigation

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

  // Render a list of notes (main or subnotes)
  const renderNotesList = (notesArr: NoteType[], onNotePress: (note: NoteType, parent: NoteType[]) => void) => (
    <FlatList
      data={notesArr}
      keyExtractor={item => item.id}
      renderItem={({ item }) => (
        <TouchableOpacity onPress={() => onNotePress(item, notesArr)}>
          <View style={styles.note}>
            <Text style={styles.noteText}>{item.text}</Text>
          </View>
        </TouchableOpacity>
      )}
    />
  );

  const renderNotesPage = () => (
    <>
      <View style={styles.logoTitleRow}>
        <Image source={logo} style={styles.logoCircular} resizeMode="cover" />
      </View>
      <TextInput
        style={styles.input}
        placeholder="Write a note..."
        placeholderTextColor="#aaa"
        value={note}
        onChangeText={setNote}
      />
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.addNoteButton}
          onPress={addNote}
          activeOpacity={0.8}
        >
          <Text style={styles.addNoteButtonText}>Add Note</Text>
        </TouchableOpacity>
      </View>
      {renderNotesList(notes, (note, parent) => {
        setNoteStack([{ note, parent }]);
        setPage('Detail');
      })}
    </>
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
        logo={logo as number}
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
      </View>

      {/* Navigation Bar */}
      {!keyboardVisible && (
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
  buttonContainer: {
    marginBottom: 20,
  },
  note: {
    padding: 10,
    backgroundColor: '#111',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
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
  addNoteButton: {
    backgroundColor: '#000',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#fff',
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  addNoteButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
