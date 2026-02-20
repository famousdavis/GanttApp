import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStorageDriver } from '../local-storage-driver';

describe('LocalStorageDriver', () => {
  let driver: LocalStorageDriver;

  beforeEach(() => {
    localStorage.clear();
    driver = new LocalStorageDriver();
  });

  it('has mode "local"', () => {
    expect(driver.mode).toBe('local');
  });

  describe('load', () => {
    it('returns parsed JSON when key exists', async () => {
      localStorage.setItem('test-key', JSON.stringify({ name: 'hello' }));
      const result = await driver.load<{ name: string }>('test-key');
      expect(result).toEqual({ name: 'hello' });
    });

    it('returns null when key does not exist', async () => {
      const result = await driver.load('nonexistent');
      expect(result).toBeNull();
    });

    it('returns null on invalid JSON', async () => {
      localStorage.setItem('bad-json', '{not valid json');
      const result = await driver.load('bad-json');
      expect(result).toBeNull();
    });

    it('handles arrays', async () => {
      localStorage.setItem('arr', JSON.stringify([1, 2, 3]));
      const result = await driver.load<number[]>('arr');
      expect(result).toEqual([1, 2, 3]);
    });
  });

  describe('save', () => {
    it('saves data as JSON string', async () => {
      await driver.save('my-key', { foo: 'bar' });
      const raw = localStorage.getItem('my-key');
      expect(raw).toBe('{"foo":"bar"}');
    });

    it('overwrites existing data', async () => {
      await driver.save('key', { v: 1 });
      await driver.save('key', { v: 2 });
      const raw = localStorage.getItem('key');
      expect(JSON.parse(raw!).v).toBe(2);
    });
  });

  describe('remove', () => {
    it('removes the key from localStorage', async () => {
      localStorage.setItem('to-delete', '"value"');
      await driver.remove('to-delete');
      expect(localStorage.getItem('to-delete')).toBeNull();
    });

    it('does not throw when key does not exist', async () => {
      await expect(driver.remove('nonexistent')).resolves.toBeUndefined();
    });
  });
});
