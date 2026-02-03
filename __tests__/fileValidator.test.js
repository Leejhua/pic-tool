/**
 * FileValidator 单元测试和属性测试
 * 
 * **Feature: image-batch-processor, Property 1: 文件格式验证**
 */

import fc from 'fast-check';
import { FileValidator, CONFIG } from '../app.js';

describe('FileValidator', () => {
  describe('isValidImageFile', () => {
    // 基本单元测试
    test('应该接受 PNG 文件', () => {
      const file = new File([''], 'test.png', { type: 'image/png' });
      expect(FileValidator.isValidImageFile(file)).toBe(true);
    });

    test('应该接受 JPEG 文件', () => {
      const file = new File([''], 'test.jpg', { type: 'image/jpeg' });
      expect(FileValidator.isValidImageFile(file)).toBe(true);
    });

    test('应该拒绝 GIF 文件', () => {
      const file = new File([''], 'test.gif', { type: 'image/gif' });
      expect(FileValidator.isValidImageFile(file)).toBe(false);
    });

    test('应该拒绝非图片文件', () => {
      const file = new File([''], 'test.txt', { type: 'text/plain' });
      expect(FileValidator.isValidImageFile(file)).toBe(false);
    });

    test('应该拒绝 null 或 undefined', () => {
      expect(FileValidator.isValidImageFile(null)).toBe(false);
      expect(FileValidator.isValidImageFile(undefined)).toBe(false);
    });
  });

  describe('getSupportedTypes', () => {
    test('应该返回支持的类型列表', () => {
      const types = FileValidator.getSupportedTypes();
      expect(types).toContain('image/png');
      expect(types).toContain('image/jpeg');
      expect(types).toContain('image/webp');
      expect(types).toContain('image/avif');
      expect(types.length).toBe(4);
    });
  });

  /**
   * 属性测试
   * **Feature: image-batch-processor, Property 1: 文件格式验证**
   * **验证: 需求 1.2**
   * 
   * 对于任意文件，当且仅当其 MIME 类型为 image/png、image/jpeg、image/webp、image/avif 时，
   * 文件验证器应返回 true
   */
  describe('Property Tests', () => {
    // 支持的 MIME 类型
    const supportedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/avif'];
    
    // 不支持的 MIME 类型生成器
    const unsupportedMimeTypes = [
      'image/gif',
      'image/bmp',
      'image/svg+xml',
      'text/plain',
      'text/html',
      'application/pdf',
      'application/json',
      'video/mp4',
      'audio/mpeg'
    ];

    test('属性1: 支持的图片格式应该返回 true', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...supportedTypes),
          fc.string({ minLength: 1, maxLength: 50 }),
          (mimeType, fileName) => {
            const file = new File(['test content'], fileName, { type: mimeType });
            return FileValidator.isValidImageFile(file) === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('属性1: 不支持的文件格式应该返回 false', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...unsupportedMimeTypes),
          fc.string({ minLength: 1, maxLength: 50 }),
          (mimeType, fileName) => {
            const file = new File(['test content'], fileName, { type: mimeType });
            return FileValidator.isValidImageFile(file) === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('属性1: 任意 MIME 类型验证一致性', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          (mimeType, fileName) => {
            const file = new File(['test content'], fileName, { type: mimeType });
            const result = FileValidator.isValidImageFile(file);
            const expected = supportedTypes.includes(mimeType);
            return result === expected;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
