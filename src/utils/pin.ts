import AsyncStorage from '@react-native-async-storage/async-storage';

const PIN_KEY = 'APP_PIN';

export const savePin = async (pin: string) => {
  await AsyncStorage.setItem(PIN_KEY, pin);
};

export const getPin = async (): Promise<string | null> => {
  return await AsyncStorage.getItem(PIN_KEY);
};

export const checkPin = async (pin: string): Promise<boolean> => {
  const savedPin = await getPin();
  return savedPin === pin;
};
