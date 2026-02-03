/**
 * ImageAnalyzer 单元测试和属性测试
 * 
 * **Feature: image-batch-processor, Property 2: 处理判断正确性**
 */

import fc from 'fast-check';
import { ImageAnalyzer, CONFIG } from '../app.js';

describe('ImageAnalyzer', () => {
  describe('needsProcessing', () => {
    // 基本单元测试
    test('宽度为750px且文件小于800KB应该不需要处理', () => {
      const info = {
        width: 750,
        height: 500,
        size: 400 * 1024 // 400KB
      };
      expect(ImageAnalyzer.needsProcessing(info)).toBe(false);
    });

    test('宽度不等于750px应该需要处理', () => {
      const info = {
        width: 800,
        height: 500,
        size: 400 * 1024
      };
      expect(ImageAnalyzer.needsProcessing(info)).toBe(true);
    });

    test('宽度小于750px应该需要处理', () => {
      const info = {
        width: 500,
        height: 800,
        size: 400 * 1024
      };
      expect(ImageAnalyzer.needsProcessing(info)).toBe(true);
    });

    test('文件大小超过800KB应该需要处理', () => {
      const info = {
        width: 750,
        height: 500,
        size: 900 * 1024 // 900KB
      };
      expect(ImageAnalyzer.needsProcessing(info)).toBe(true);
    });

    test('宽度为750px且文件等于800KB应该不需要处理', () => {
      const info = {
        width: 750,
        height: 1000,
        size: 800 * 1024 // exactly 800KB
      };
      expect(ImageAnalyzer.needsProcessing(info)).toBe(false);
    });
  });

  /**
   * 属性测试
   * **Feature: image-batch-processor, Property 2: 处理判断正确性**
   * **验证: 需求 2.1, 2.2**
   * 
   * 对于任意图片信息（包含宽度、高度、文件大小），
   * 当且仅当宽度 !== 750px 或文件大小 > 800KB 时，
   * needsProcessing 应返回 true
   */
  describe('Property Tests', () => {
    const TARGET_WIDTH = CONFIG.maxWidth;     // 750
    const MAX_SIZE_BYTES = CONFIG.maxSizeBytes; // 800 * 1024

    // 生成有效的图片尺寸 (1 到 5000 像素)
    const dimensionArb = fc.integer({ min: 1, max: 5000 });
    
    // 生成有效的文件大小 (1 字节到 10MB)
    const sizeArb = fc.integer({ min: 1, max: 10 * 1024 * 1024 });

    test('属性2: 处理判断正确性 - needsProcessing 返回值与条件一致', () => {
      fc.assert(
        fc.property(
          dimensionArb,
          dimensionArb,
          sizeArb,
          (width, height, size) => {
            const info = { width, height, size };
            const result = ImageAnalyzer.needsProcessing(info);
            
            // 预期结果: 当且仅当宽度不等于750或文件大小超过阈值时返回 true
            const expected = width !== TARGET_WIDTH || 
                           size > MAX_SIZE_BYTES;
            
            return result === expected;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('属性2: 宽度为750且文件大小不超过阈值的图片不需要处理', () => {
      // 生成不超过阈值的文件大小
      const smallSizeArb = fc.integer({ min: 1, max: MAX_SIZE_BYTES });
      const anyHeightArb = fc.integer({ min: 1, max: 5000 });

      fc.assert(
        fc.property(
          anyHeightArb,
          smallSizeArb,
          (height, size) => {
            const info = { width: TARGET_WIDTH, height, size };
            return ImageAnalyzer.needsProcessing(info) === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('属性2: 宽度不等于750的图片需要处理', () => {
      // 生成不等于750的宽度
      const notTargetWidthArb = fc.integer({ min: 1, max: 5000 }).filter(w => w !== TARGET_WIDTH);
      const anyHeightArb = fc.integer({ min: 1, max: 5000 });
      const anySizeArb = fc.integer({ min: 1, max: 10 * 1024 * 1024 });

      fc.assert(
        fc.property(
          notTargetWidthArb,
          anyHeightArb,
          anySizeArb,
          (width, height, size) => {
            const info = { width, height, size };
            return ImageAnalyzer.needsProcessing(info) === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('属性2: 宽度小于750的图片需要处理', () => {
      // 生成小于750的宽度
      const smallWidthArb = fc.integer({ min: 1, max: TARGET_WIDTH - 1 });
      const anyHeightArb = fc.integer({ min: 1, max: 5000 });
      const anySizeArb = fc.integer({ min: 1, max: 10 * 1024 * 1024 });

      fc.assert(
        fc.property(
          smallWidthArb,
          anyHeightArb,
          anySizeArb,
          (width, height, size) => {
            const info = { width, height, size };
            return ImageAnalyzer.needsProcessing(info) === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('属性2: 文件大小超过阈值的图片需要处理', () => {
      // 生成超过大小阈值的值
      const anyWidthArb = fc.integer({ min: 1, max: 5000 });
      const anyHeightArb = fc.integer({ min: 1, max: 5000 });
      const largeSizeArb = fc.integer({ min: MAX_SIZE_BYTES + 1, max: 10 * 1024 * 1024 });

      fc.assert(
        fc.property(
          anyWidthArb,
          anyHeightArb,
          largeSizeArb,
          (width, height, size) => {
            const info = { width, height, size };
            return ImageAnalyzer.needsProcessing(info) === true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
