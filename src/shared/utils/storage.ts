// localStorage utilities for GanttApp

import { AppData } from '../types/app';

const STORAGE_KEY = 'ganttAppData';

/**
 * Save app data to localStorage
 */
export function saveData(data: AppData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving data to localStorage:', error);
  }
}

/**
 * Load app data from localStorage
 */
export function loadData(): AppData | null {
  try {
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (savedData) {
      return JSON.parse(savedData) as AppData;
    }
    return null;
  } catch (error) {
    console.error('Error loading data from localStorage:', error);
    return null;
  }
}

/**
 * Clear all app data from localStorage
 */
export function clearData(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing data from localStorage:', error);
  }
}
