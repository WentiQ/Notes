import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { checkPin } from '../utils/pin';
const logo = require('../../assets/logo.png');

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
      <Image source={logo} style={styles.logoLarge} resizeMode="cover" />
      <Text style={styles.title}>Enter your PIN</Text>
      <TextInput
        style={styles.input}
        secureTextEntry
        keyboardType="number-pad"
        value={pin}
        onChangeText={setPin}
        maxLength={4}
        placeholder="••••"
        placeholderTextColor="#888"
      />
      <TouchableOpacity style={styles.unlockButton} onPress={handleSubmit} activeOpacity={0.85}>
        <Text style={styles.unlockButtonText}>Unlock</Text>
      </TouchableOpacity>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  logoLarge: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 32,
    backgroundColor: '#222',
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 18,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#fff',
    borderRadius: 10,
    padding: 12,
    margin: 10,
    width: '50%',
    textAlign: 'center',
    color: '#fff',
    fontSize: 22,
    letterSpacing: 8,
    backgroundColor: '#111',
  },
  unlockButton: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 40,
    marginTop: 10,
    marginBottom: 4,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  unlockButtonText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 18,
    letterSpacing: 1,
  },
  error: { color: 'red', marginTop: 10 },
});
