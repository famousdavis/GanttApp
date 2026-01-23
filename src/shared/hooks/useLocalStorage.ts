// Custom hook for localStorage synchronization

import { useState, useEffect } from 'react';

/**
 * Custom hook that syncs state with localStorage
 * @param key - localStorage key
 * @param initialValue - initial value if no stored value exists
 * @returns [value, setValue] tuple
 */
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T) => void] {
  // Initialize state with value from localStorage or initialValue
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  // Update localStorage whenever storedValue changes
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue));
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, storedValue]);

  return [storedValue, setStoredValue];
}
