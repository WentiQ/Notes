import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, Image, TouchableOpacity, Animated } from 'react-native';
import { checkPin } from '../utils/pin';
const logo = require('../../assets/logo.png');

export default function PinScreen({ onSuccess }: { onSuccess: () => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  // Shake animation state
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const triggerShake = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 1, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -1, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 1, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -1, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const handleSubmit = async () => {
    const valid = await checkPin(pin);
    if (valid) {
      onSuccess();
    } else {
      setError('Invalid PIN. Try again.');
      setPin('');
      triggerShake();
    }
  };

  // Animation for energy release
  const pulse1 = useRef(new Animated.Value(0)).current;
  const pulse2 = useRef(new Animated.Value(0)).current;
  const pulse3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    interface AnimatePulse {
      (pulse: Animated.Value, delay: number): void;
    }

    const animatePulse: AnimatePulse = (pulse, delay) => {
      Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(pulse, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
        }),
        Animated.timing(pulse, {
        toValue: 0,
        duration: 0,
        useNativeDriver: true,
        }),
      ])
      ).start();
    };
    animatePulse(pulse1, 0);
    animatePulse(pulse2, 400);
    animatePulse(pulse3, 800);
  }, [pulse1, pulse2, pulse3]);

  return (
    <View style={styles.container}>
      <View style={styles.logoWrapper}>
        {/* Animated energy release circles */}
        <Animated.View
          style={[
            styles.energyCircle,
            {
              opacity: pulse1.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0] }),
              transform: [
                { scale: pulse1.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] }) },
              ],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.energyCircle,
            {
              opacity: pulse2.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0] }),
              transform: [
                { scale: pulse2.interpolate({ inputRange: [0, 1], outputRange: [1, 2.7] }) },
              ],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.energyCircle,
            {
              opacity: pulse3.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0] }),
              transform: [
                { scale: pulse3.interpolate({ inputRange: [0, 1], outputRange: [1, 3.2] }) },
              ],
            },
          ]}
        />
        <Image source={logo} style={styles.logoLarge} resizeMode="cover" />
      </View>
      <Text style={styles.title}>Enter your PIN</Text>
      <Animated.View style={{
        width: '100%',
        alignItems: 'center',
        transform: [
          {
            translateX: shakeAnim.interpolate({
              inputRange: [-1, 1],
              outputRange: [-12, 12],
            }),
          },
        ],
      }}>
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
      </Animated.View>
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
  logoWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
    width: 140,
    height: 140,
  },
  energyCircle: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: 'rgba(120,200,255,0.7)',
    backgroundColor: 'rgba(120,200,255,0.13)',
  },
  logoLarge: {
    width: 120,
    height: 120,
    borderRadius: 60,
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
