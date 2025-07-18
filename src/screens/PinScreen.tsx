import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';
import { checkPin } from '../utils/pin';

export default function PinScreen({ onSuccess }: { onSuccess: () => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    const valid = await checkPin(pin);
    if (valid) {
      onSuccess();
    } else {
      setError('Invalid PIN. Try again.');
      setPin('');
    }
  };

  return (
    <View style={styles.container}>
      <Text>Enter your PIN</Text>
      <TextInput
        style={styles.input}
        secureTextEntry
        keyboardType="number-pad"
        value={pin}
        onChangeText={setPin}
        maxLength={4}
      />
      <Button title="Unlock" onPress={handleSubmit} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  input: { borderWidth: 1, padding: 10, margin: 10, width: '50%', textAlign: 'center' },
  error: { color: 'red' },
});
