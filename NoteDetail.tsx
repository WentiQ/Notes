import React, { useState, useEffect } from 'react';
import { Dimensions } from 'react-native';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  TextInput,
  ScrollView,
  Modal,
  BackHandler,
  TouchableWithoutFeedback,
  Alert,
} from 'react-native';

export interface Note {
  id: string;
  text: string;
  content?: string;
  subnotes: Note[];
}

export interface NoteDetailProps {
  note: Note;
  onBack: () => void;
  onUpdateNote: (updatedNote: Note) => void;
  onAddSubnote: (newSubnote: Note) => void;
  onOpenSubnote: (subnote: Note) => void;
  onOpenFlowChart: (note: Note) => void;
  logo: number;
  editingName?: boolean;
}

export default function NoteDetail({
  note,
  onBack,
  onUpdateNote,
  onAddSubnote,
  onOpenSubnote,
  onOpenFlowChart,
  logo,
  editingName: editingNameProp = false,
}: NoteDetailProps) {
  const [currentSubnote, setCurrentSubnote] = useState<Note | null>(null);
  const [editingContent, setEditingContent] = useState(false);
  const [contentText, setContentText] = useState(note.content || '');
  const [showSubnotesModal, setShowSubnotesModal] = useState(false);
  const [showAddSubnoteInput, setShowAddSubnoteInput] = useState(false);
  const [newSubnoteText, setNewSubnoteText] = useState('');
  const [editingName, setEditingName] = useState(editingNameProp);
  const [nameText, setNameText] = useState(note.text);

  // Subnote delete mode state
  const [subDeleteMode, setSubDeleteMode] = useState(false);
  const [selectedSubnotes, setSelectedSubnotes] = useState<string[]>([]);
  const [deleteConfirmSubnote, setDeleteConfirmSubnote] = useState<null | Note>(null);
  const [deleteSubInput, setDeleteSubInput] = useState('');
  const [deleteSubQueue, setDeleteSubQueue] = useState<Note[]>([]);

  useEffect(() => {
    const backAction = () => {
      if (currentSubnote) {
        setCurrentSubnote(null);
        return true;
      }
      if (showSubnotesModal) {
        setShowSubnotesModal(false);
        return true;
      }
      onBack();
      return true;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction
    );

    return () => backHandler.remove();
  }, [currentSubnote, showSubnotesModal, onBack]);

  useEffect(() => {
    setNameText(note.text);
  }, [note.text]);

  useEffect(() => {
    if (editingNameProp) setEditingName(true);
  }, [editingNameProp]);

  const saveContent = () => {
    const updatedNote = {
      ...note,
      content: contentText,
    };
    onUpdateNote(updatedNote);
    setEditingContent(false);
  };

  const handleAddSubnoteConfirm = () => {
    const text = newSubnoteText.trim();
    if (!text) return;

    const newSubnote: Note = {
      id: Date.now().toString(),
      text,
      subnotes: [],
    };

    onAddSubnote(newSubnote);

    setNewSubnoteText('');
    setShowAddSubnoteInput(false);
  };

  const handleUpdateSubnote = (updatedSubnote: Note) => {
    const updatedSubnotes = note.subnotes.map(sn =>
      sn.id === updatedSubnote.id ? updatedSubnote : sn
    );

    const updatedNote = {
      ...note,
      subnotes: updatedSubnotes,
    };

    onUpdateNote(updatedNote);
  };

  // Save name if editingName is true and user taps outside
  const handleNameBlur = () => {
    if (editingName) {
      const trimmed = nameText.trim();
      if (trimmed && trimmed !== note.text) {
        onUpdateNote({ ...note, text: trimmed });
      }
      setEditingName(false);
    }
  };

  const startDeleteSubQueue = () => {
    if (selectedSubnotes.length === 0) return;
    const queue = selectedSubnotes
      .map(id => note.subnotes.find(n => n.id === id))
      .filter(Boolean) as Note[];
    if (queue.length > 0) {
      setDeleteSubQueue(queue);
      setDeleteConfirmSubnote(queue[0]);
      setDeleteSubInput('');
    }
  };

  const handleDeleteSubnotes = () => {
    if (!deleteConfirmSubnote) return;
    if (deleteSubInput !== deleteConfirmSubnote.text) {
      Alert.alert('Name does not match', 'Please type the subnote name exactly to confirm deletion.');
      return;
    }
    // Remove subnote
    const updatedSubnotes = note.subnotes.filter(n => n.id !== deleteConfirmSubnote.id);
    onUpdateNote({ ...note, subnotes: updatedSubnotes });
    setSelectedSubnotes(sel => sel.filter(id => id !== deleteConfirmSubnote.id));
    setDeleteSubInput('');
    setTimeout(() => {
      setDeleteSubQueue(q => {
        const nextQueue = q.filter(n => n.id !== deleteConfirmSubnote.id);
        if (nextQueue.length > 0) {
          setDeleteConfirmSubnote(nextQueue[0]);
        } else {
          setDeleteConfirmSubnote(null);
          setSubDeleteMode(false);
        }
        return nextQueue;
      });
    }, 0);
  };

  if (currentSubnote) {
    // Provide a local onAddSubnote that only updates the current subnote's subnotes
    const handleAddSubnoteToCurrent = (newSubnote: Note) => {
      const updatedSubnotes = currentSubnote.subnotes.concat(newSubnote);
      const updatedCurrent = { ...currentSubnote, subnotes: updatedSubnotes };
      handleUpdateSubnote(updatedCurrent);
      setCurrentSubnote(updatedCurrent);
    };
    return (
      <NoteDetail
        note={currentSubnote}
        onBack={() => setCurrentSubnote(null)}
        onUpdateNote={(updatedSubnote) => {
          handleUpdateSubnote(updatedSubnote);
          setCurrentSubnote(updatedSubnote); // stay on updated subnote
        }}
        onAddSubnote={handleAddSubnoteToCurrent}
        onOpenSubnote={onOpenSubnote}
        onOpenFlowChart={onOpenFlowChart}
        logo={logo}
      />
    );
  }

  return (
    <TouchableWithoutFeedback onPress={handleNameBlur} accessible={false}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          {editingName ? (
            <TextInput
              style={[styles.headerNoteName, { backgroundColor: '#222', paddingHorizontal: 8, borderRadius: 6 }]}
              value={nameText}
              onChangeText={setNameText}
              autoFocus
              onBlur={handleNameBlur}
              placeholder="Note name"
              placeholderTextColor="#aaa"
              returnKeyType="done"
              onSubmitEditing={handleNameBlur}
              maxLength={100}
            />
          ) : (
            <Text
              style={styles.headerNoteName}
              numberOfLines={1}
              onLongPress={() => setEditingName(true)}
            >
              {note.text}
            </Text>
          )}
          <View style={styles.headerRightIcons}>
            {editingContent ? (
              <TouchableOpacity onPress={saveContent} style={styles.editIcon}>
                <Text style={styles.editIconText}>✔</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => setEditingContent(true)}
                style={styles.editIcon}
              >
                <Text style={styles.editIconText}>✎</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => setShowSubnotesModal(true)}
              style={styles.subnotesIcon}
            >
              <Text style={styles.editIconText}>☰</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={[styles.contentScroll, { width: Dimensions.get('window').width - 40, alignSelf: 'center' }]}
          contentContainerStyle={{ paddingBottom: 12, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={true}
        >
          {editingContent ? (
            <View style={styles.editInputRow}>
              <TextInput
                style={styles.editInput}
                value={contentText}
                onChangeText={setContentText}
                multiline
                autoFocus
                placeholder="Write something..."
                placeholderTextColor="#aaa"
                returnKeyType="done"
              />
            </View>
          ) : (
            <Text style={styles.contentText}>
              {note.content || 'No content yet. Tap ✎ to write.'}
            </Text>
          )}
        </ScrollView>

        <Modal
          visible={showSubnotesModal}
          animationType="slide"
          transparent
          onRequestClose={() => setShowSubnotesModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Subnotes</Text>
              {note.subnotes.length === 0 ? (
                <Text style={styles.noSubnotesText}>No subnotes yet.</Text>
              ) : (
                <FlatList
                  data={note.subnotes}
                  keyExtractor={item => item.id}
                  renderItem={({ item }) => (
                    <View style={styles.modalNoteRow}>
                      <TouchableOpacity
                        style={{ flex: 1 }}
                        onPress={() => {
                          if (subDeleteMode) {
                            setSelectedSubnotes(sel =>
                              sel.includes(item.id)
                                ? sel.filter(id => id !== item.id)
                                : [...sel, item.id]
                            );
                          } else {
                            setShowSubnotesModal(false);
                            setCurrentSubnote(item);
                          }
                        }}
                        onLongPress={() => {
                          if (!subDeleteMode) {
                            setSubDeleteMode(true);
                            setSelectedSubnotes([item.id]);
                          } else {
                            setSelectedSubnotes(sel =>
                              sel.includes(item.id)
                                ? sel.filter(id => id !== item.id)
                                : [...sel, item.id]
                            );
                          }
                        }}
                      >
                        <Text style={[styles.modalNoteText, subDeleteMode && selectedSubnotes.includes(item.id) && { color: '#f44', fontWeight: 'bold' }]}>{item.text}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          setShowSubnotesModal(false);
                          onOpenFlowChart(item);
                        }}
                        style={{ marginLeft: 10 }}
                      >
                        <Text style={styles.flowChartIcon}>⭕</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                />
              )}
              <View style={{ marginTop: 16, width: '100%' }}>
                {showAddSubnoteInput ? (
                  <View style={{ alignItems: 'center' }}>
                    <TextInput
                      style={[styles.editInput, { width: '90%', marginBottom: 8 }]}
                      value={newSubnoteText}
                      onChangeText={setNewSubnoteText}
                      placeholder="Subnote title"
                      placeholderTextColor="#aaa"
                      autoFocus
                      onSubmitEditing={handleAddSubnoteConfirm}
                    />
                    <View style={{ flexDirection: 'row' }}>
                      <TouchableOpacity
                        onPress={() => {
                          setShowAddSubnoteInput(false);
                          setNewSubnoteText('');
                        }}
                        style={[styles.modalCloseButton, { marginRight: 8 }]}
                      >
                        <Text style={styles.modalCloseText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={handleAddSubnoteConfirm}
                        style={styles.modalAddButton}
                      >
                        <Text style={styles.modalAddButtonText}>Add</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={() => setShowAddSubnoteInput(true)}
                    style={[styles.modalAddButton, { alignSelf: 'center', marginBottom: 8 }]}
                  >
                    <Text style={styles.modalAddButtonText}>Add Subnote</Text>
                  </TouchableOpacity>
                )}
                {subDeleteMode && selectedSubnotes.length > 0 && (
                  <TouchableOpacity
                    style={[styles.deleteButton, { marginTop: 8 }]}
                    onPress={startDeleteSubQueue}
                  >
                    <Text style={styles.deleteButtonText}>Delete Selected ({selectedSubnotes.length})</Text>
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity
                onPress={() => setShowSubnotesModal(false)}
                style={styles.modalCloseButton}
              >
                <Text style={styles.modalCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
          {/* Subnote delete confirmation modal */}
          <Modal
            visible={!!deleteConfirmSubnote}
            transparent
            animationType="fade"
            onRequestClose={() => {
              setDeleteConfirmSubnote(null);
              setDeleteSubInput('');
              setDeleteSubQueue([]);
            }}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Type the subnote name to confirm deletion</Text>
                <Text style={{ color: '#fff', marginBottom: 8, textAlign: 'center' }}>{deleteConfirmSubnote?.text}</Text>
                <TextInput
                  style={styles.editInput}
                  value={deleteSubInput}
                  onChangeText={setDeleteSubInput}
                  placeholder="Type subnote name exactly"
                  placeholderTextColor="#aaa"
                  autoFocus
                />
                <View style={{ flexDirection: 'row', marginTop: 16, justifyContent: 'center' }}>
                  <TouchableOpacity
                    style={[styles.modalAddButton, { backgroundColor: '#f44', marginRight: 10 }]}
                    onPress={handleDeleteSubnotes}
                  >
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>Delete</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.modalCloseButton}
                    onPress={() => {
                      setDeleteConfirmSubnote(null);
                      setDeleteSubInput('');
                      setDeleteSubQueue([]);
                    }}
                  >
                    <Text style={styles.modalCloseText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </Modal>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    padding: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerNoteName: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    flexShrink: 1,
    maxWidth: '70%',
  },
  headerRightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
  },
  editIcon: {
    marginRight: 10,
    backgroundColor: '#222',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fff',
  },
  editIconText: {
    color: '#fff',
    fontSize: 20,
    lineHeight: 24,
  },
  subnotesIcon: {
    marginRight: 10,
    backgroundColor: '#222',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fff',
  },
  editInputRow: {
    marginBottom: 12,
  },
  editInput: {
    borderWidth: 1.5,
    borderColor: '#fff',
    borderRadius: 8,
    padding: 10,
    color: '#fff',
    backgroundColor: '#111',
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  contentText: {
    color: '#ccc',
    fontSize: 16,
    marginBottom: 12,
    minHeight: 100,
    width: '100%',
    alignSelf: 'stretch',
  },
  contentScroll: {
    marginBottom: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#222',
    padding: 20,
    borderRadius: 12,
    width: '80%',
    maxHeight: '80%',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  noSubnotesText: {
    color: '#aaa',
    textAlign: 'center',
    marginVertical: 20,
  },
  modalNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  flowChartIcon: {
    fontSize: 20,
    marginLeft: 10,
    color: '#6cf',
  },
  modalNoteText: {
    color: '#fff',
  },
  modalCloseButton: {
    marginTop: 20,
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 20,
    backgroundColor: '#444',
    borderRadius: 8,
  },
  modalCloseText: {
    color: '#fff',
    fontSize: 16,
  },
  modalAddButton: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 18,
    marginLeft: 10,
  },
  modalAddButtonText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 16,
  },
  deleteButton: {
    backgroundColor: '#f44',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 18,
    alignSelf: 'center',
  },
  deleteButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
