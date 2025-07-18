import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import { savePin } from '../utils/pin';

export default function SettingsScreen() {
  const [pin, setPin] = useState('');

  const handleSave = async () => {
    if (pin.length === 4) {
      await savePin(pin);
      Alert.alert('Success', 'PIN saved successfully!');
      setPin('');
    } else {
      Alert.alert('Error', 'PIN must be 4 digits.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>⚙️ Settings</Text>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App Security</Text>
        <Text style={styles.label}>Set a 4-digit PIN to protect your app:</Text>
        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          value={pin}
          onChangeText={setPin}
          maxLength={4}
          placeholder="Enter new PIN"
          placeholderTextColor="#aaa"
        />
        <Button title="Save PIN" onPress={handleSave} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    padding: 24,
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 32,
    marginBottom: 32,
    alignSelf: 'center',
  },
  section: {
    backgroundColor: '#181818',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  label: {
    color: '#ccc',
    fontSize: 16,
    marginBottom: 10,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#fff',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
    width: '80%',
    color: '#fff',
    backgroundColor: '#111',
    fontSize: 18,
    textAlign: 'center',
    letterSpacing: 8,
  },
});
