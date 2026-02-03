/**
 * BatchProcessor 属性测试
 * 
 * **Feature: image-batch-processor, Property 6: 批量处理进度一致性**
 */

import fc from 'fast-check';
import { BatchProcessor, ImageProcessor, CONFIG } from '../app.js';

// Mock ImageProcessor.process to avoid actual image processing
const originalProcess = ImageProcessor.process;

beforeAll(() => {
  // Mock the process function to return predictable results synchronously
  ImageProcessor.process = async (imageInfo, userConfig = {}) => {
    return {
      originalFile: imageInfo.file,
      processedBlob: new Blob(['processed'], { type: imageInfo.file.type }),
      finalWidth: Math.min(imageInfo.width, CONFIG.maxWidth),
      finalHeight: Math.min(imageInfo.height, CONFIG.maxHeight),
      finalSize: 100 * 1024,
      wasProcessed: imageInfo.needsProcessing
    };
  };
});

afterAll(() => {
  ImageProcessor.process = originalProcess;
});

// Helper to create mock image info
const createMockImageInfo = (index, needsProcessing = true) => ({
  file: new File(['test'], `image${index}.jpg`, { type: 'image/jpeg' }),
  width: needsProcessing ? 1000 : 500,
  height: needsProcessing ? 800 : 400,
  size: needsProcessing ? 900 * 1024 : 400 * 1024,
  previewUrl: `blob:mock-url-${index}`,
  needsProcessing
});

describe('BatchProcessor', () => {
  /**
   * 属性测试
   * **Feature: image-batch-processor, Property 6: 批量处理进度一致性**
   * **验证: 需求 7.2**
   * 
   * 对于任意批量处理过程，每处理完成一张图片，进度计数应增加 1，
   * 且最终完成数应等于总数
   */
  describe('Property Tests - Progress Consistency', () => {
    // Generate array of 1-20 images
    const imageCountArb = fc.integer({ min: 1, max: 20 });

    test('属性6: 批量处理进度一致性 - 最终完成数等于总数', async () => {
      await fc.assert(
        fc.asyncProperty(
          imageCountArb,
          async (count) => {
            const images = Array.from({ length: count }, (_, i) => 
              createMockImageInfo(i, i % 2 === 0)
            );
            
            let finalProgress = null;
            const userConfig = { format: 'image/jpeg', maxSizeKB: 800, extension: '.jpg' };
            
            await BatchProcessor.processAll(images, userConfig, (progress) => {
              finalProgress = progress;
            });
            
            // Final completed count should equal total
            return finalProgress !== null && 
                   finalProgress.completed === finalProgress.total &&
                   finalProgress.total === count;
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);

    test('属性6: 批量处理进度一致性 - 进度计数单调递增', async () => {
      await fc.assert(
        fc.asyncProperty(
          imageCountArb,
          async (count) => {
            const images = Array.from({ length: count }, (_, i) => 
              createMockImageInfo(i, i % 2 === 0)
            );
            
            const progressHistory = [];
            const userConfig = { format: 'image/jpeg', maxSizeKB: 800, extension: '.jpg' };
            
            await BatchProcessor.processAll(images, userConfig, (progress) => {
              progressHistory.push(progress.completed);
            });
            
            // Progress should be monotonically non-decreasing
            for (let i = 1; i < progressHistory.length; i++) {
              if (progressHistory[i] < progressHistory[i - 1]) {
                return false;
              }
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);

    test('属性6: 批量处理进度一致性 - 每张图片处理后进度增加1', async () => {
      await fc.assert(
        fc.asyncProperty(
          imageCountArb,
          async (count) => {
            const images = Array.from({ length: count }, (_, i) => 
              createMockImageInfo(i, i % 2 === 0)
            );
            
            const completedValues = [];
            const userConfig = { format: 'image/jpeg', maxSizeKB: 800, extension: '.jpg' };
            
            await BatchProcessor.processAll(images, userConfig, (progress) => {
              completedValues.push(progress.completed);
            });
            
            // For each image, we expect two progress calls:
            // 1. Before processing (completed = i)
            // 2. After processing (completed = i + 1)
            // So we should see: 0, 1, 1, 2, 2, 3, ... for 3 images
            
            // Check that we see each value from 0 to count
            const uniqueValues = [...new Set(completedValues)];
            for (let i = 0; i <= count; i++) {
              if (!uniqueValues.includes(i)) {
                return false;
              }
            }
            
            // Check final value is count
            return completedValues[completedValues.length - 1] === count;
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);

    test('属性6: 批量处理进度一致性 - 结果数组长度等于图片数量', async () => {
      await fc.assert(
        fc.asyncProperty(
          imageCountArb,
          async (count) => {
            const images = Array.from({ length: count }, (_, i) => 
              createMockImageInfo(i, i % 2 === 0)
            );
            
            const userConfig = { format: 'image/jpeg', maxSizeKB: 800, extension: '.jpg' };
            const results = await BatchProcessor.processAll(images, userConfig, () => {});
            
            // Results array length should equal input images count
            return results.length === count;
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);

    test('属性6: 批量处理进度一致性 - total值始终等于图片总数', async () => {
      await fc.assert(
        fc.asyncProperty(
          imageCountArb,
          async (count) => {
            const images = Array.from({ length: count }, (_, i) => 
              createMockImageInfo(i, i % 2 === 0)
            );
            
            let allTotalsCorrect = true;
            const userConfig = { format: 'image/jpeg', maxSizeKB: 800, extension: '.jpg' };
            
            await BatchProcessor.processAll(images, userConfig, (progress) => {
              if (progress.total !== count) {
                allTotalsCorrect = false;
              }
            });
            
            return allTotalsCorrect;
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);
  });
});
