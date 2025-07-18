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
      <Text>Set a 4-digit PIN to protect your app</Text>
      <TextInput
        style={styles.input}
        keyboardType="number-pad"
        value={pin}
        onChangeText={setPin}
        maxLength={4}
        placeholder="Enter new PIN"
      />
      <Button title="Save PIN" onPress={handleSave} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  input: { borderWidth: 1, padding: 10, margin: 10, width: '50%', textAlign: 'center' },
});
