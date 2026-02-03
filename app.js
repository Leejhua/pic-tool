/**
 * 图片批量处理工具 - 主应用文件
 * 
 * 处理配置:
 * - 最大宽度: 750px
 * - 最大高度: 750px
 * - 最大文件大小: 800KB
 * - 支持格式: PNG, JPG, JPEG
 */

// ============ 配置常量 ============
export const CONFIG = {
    maxWidth: 750,
    maxHeight: 750,
    maxSizeKB: 800,
    maxSizeBytes: 800 * 1024,
    supportedTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/avif'],
    supportedExtensions: ['.png', '.jpg', '.jpeg', '.webp', '.avif'],
    outputFormat: 'image/jpeg',
    outputExtension: '.jpg'
};

// ============ 文件验证器 ============
export const FileValidator = {
    /**
     * 验证文件是否为支持的图片格式
     * @param {File} file - 要验证的文件
     * @returns {boolean} - 是否为有效的图片文件
     */
    isValidImageFile(file) {
        if (!file || !file.type) {
            return false;
        }
        return CONFIG.supportedTypes.includes(file.type);
    },

    /**
     * 获取支持的文件类型列表
     * @returns {string[]} - 支持的 MIME 类型列表
     */
    getSupportedTypes() {
        return [...CONFIG.supportedTypes];
    }
};

// ============ 图片分析器 ============
export const ImageAnalyzer = {
    /**
     * 分析图片并返回图片信息
     * @param {File} file - 图片文件
     * @returns {Promise<Object>} - 图片信息对象
     */
    async analyze(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const previewUrl = URL.createObjectURL(file);
            
            img.onload = () => {
                const info = {
                    file,
                    width: img.naturalWidth,
                    height: img.naturalHeight,
                    size: file.size,
                    previewUrl,
                    needsProcessing: false
                };
                info.needsProcessing = this.needsProcessing(info);
                resolve(info);
            };
            
            img.onerror = () => {
                URL.revokeObjectURL(previewUrl);
                reject(new Error('图片加载失败'));
            };
            
            img.src = previewUrl;
        });
    },

    /**
     * 判断图片是否需要处理
     * @param {Object} info - 图片信息对象
     * @returns {boolean} - 是否需要处理
     */
    needsProcessing(info) {
        // 宽度不等于目标宽度，或文件大小超过限制，都需要处理
        return info.width !== CONFIG.maxWidth || 
               info.size > CONFIG.maxSizeBytes;
    }
};

// ============ 图片处理器 ============
export const ImageProcessor = {
    /**
     * 处理单张图片
     * @param {Object} imageInfo - 图片信息
     * @param {Object} userConfig - 用户配置 { format, maxSizeKB, extension }
     * @returns {Promise<Object>} - 处理结果
     */
    async process(imageInfo, userConfig = {}) {
        const outputFormat = userConfig.format || CONFIG.outputFormat;
        const maxSizeKB = userConfig.maxSizeKB || CONFIG.maxSizeKB;
        const outputExtension = userConfig.extension || CONFIG.outputExtension;
        
        // 检查是否需要格式转换
        const needsFormatConversion = imageInfo.file.type !== outputFormat;
        
        // 检查是否需要大小压缩
        const needsSizeCompression = imageInfo.size > maxSizeKB * 1024;
        
        if (!imageInfo.needsProcessing && !needsFormatConversion && !needsSizeCompression) {
            return {
                originalFile: imageInfo.file,
                processedBlob: imageInfo.file,
                finalWidth: imageInfo.width,
                finalHeight: imageInfo.height,
                finalSize: imageInfo.size,
                wasProcessed: false,
                outputFileName: imageInfo.file.name
            };
        }

        const img = new Image();
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = imageInfo.previewUrl;
        });

        // 调整尺寸
        const canvas = this.resize(img, CONFIG.maxWidth, CONFIG.maxHeight);
        
        // 使用用户配置的格式和大小限制进行压缩
        const blob = await this.compress(canvas, maxSizeKB, outputFormat);
        
        // 生成输出文件名
        const originalName = imageInfo.file.name;
        const baseName = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
        const outputFileName = baseName + outputExtension;

        return {
            originalFile: imageInfo.file,
            processedBlob: blob,
            finalWidth: canvas.width,
            finalHeight: canvas.height,
            finalSize: blob.size,
            wasProcessed: true,
            outputFileName: outputFileName
        };
    },

    /**
     * 调整图片尺寸，宽度固定为目标宽度，高度等比例缩放
     * @param {HTMLImageElement} image - 图片元素
     * @param {number} targetWidth - 目标宽度
     * @param {number} maxHeight - 最大高度（未使用，保留参数兼容性）
     * @returns {HTMLCanvasElement} - 调整后的 canvas
     */
    resize(image, targetWidth, maxHeight) {
        let { naturalWidth: width, naturalHeight: height } = image;
        
        // 宽度固定为目标宽度，高度等比例缩放
        const ratio = targetWidth / width;
        
        const newWidth = targetWidth;
        const newHeight = Math.round(height * ratio);
        
        const canvas = document.createElement('canvas');
        canvas.width = newWidth;
        canvas.height = newHeight;
        
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(image, 0, 0, newWidth, newHeight);
        
        return canvas;
    },

    /**
     * 压缩图片到指定大小以内
     * @param {HTMLCanvasElement} canvas - canvas 元素
     * @param {number} maxSizeKB - 最大文件大小 (KB)
     * @param {string} format - 输出格式
     * @returns {Promise<Blob>} - 压缩后的 Blob
     */
    async compress(canvas, maxSizeKB, format) {
        const maxSizeBytes = maxSizeKB * 1024;
        
        // PNG 格式不支持质量参数，直接返回
        if (format === 'image/png') {
            return new Promise(resolve => {
                canvas.toBlob(blob => resolve(blob), format);
            });
        }
        
        // JPEG/WebP/AVIF 使用二分法查找最佳质量
        let minQuality = 0.1;
        let maxQuality = 1.0;
        let bestBlob = null;
        
        // 先尝试最高质量
        bestBlob = await new Promise(resolve => {
            canvas.toBlob(blob => resolve(blob), format, maxQuality);
        });
        
        if (bestBlob.size <= maxSizeBytes) {
            return bestBlob;
        }
        
        // 二分法查找
        for (let i = 0; i < 10; i++) {
            const midQuality = (minQuality + maxQuality) / 2;
            const blob = await new Promise(resolve => {
                canvas.toBlob(blob => resolve(blob), format, midQuality);
            });
            
            if (blob.size <= maxSizeBytes) {
                bestBlob = blob;
                minQuality = midQuality;
            } else {
                maxQuality = midQuality;
            }
        }
        
        // 如果仍然超过大小，返回最低质量的结果
        if (!bestBlob || bestBlob.size > maxSizeBytes) {
            bestBlob = await new Promise(resolve => {
                canvas.toBlob(blob => resolve(blob), format, minQuality);
            });
        }
        
        return bestBlob;
    }
};

// ============ 批量处理器 ============
export const BatchProcessor = {
    /**
     * 批量处理所有图片
     * @param {Array} images - 图片信息数组
     * @param {Object} userConfig - 用户配置 { format, maxSizeKB, extension }
     * @param {Function} onProgress - 进度回调
     * @returns {Promise<Array>} - 处理结果数组
     */
    async processAll(images, userConfig, onProgress) {
        const results = [];
        const total = images.length;
        
        for (let i = 0; i < images.length; i++) {
            const imageInfo = images[i];
            
            onProgress({
                total,
                completed: i,
                current: imageInfo.file.name,
                results
            });
            
            try {
                const result = await ImageProcessor.process(imageInfo, userConfig);
                results.push(result);
            } catch (error) {
                results.push({
                    originalFile: imageInfo.file,
                    processedBlob: null,
                    error: error.message,
                    wasProcessed: false
                });
            }
            
            onProgress({
                total,
                completed: i + 1,
                current: imageInfo.file.name,
                results
            });
        }
        
        return results;
    }
};

// ============ ZIP 导出器 ============
export const ZipExporter = {
    /**
     * 创建包含所有处理后图片的 ZIP 文件
     * @param {Array} results - 处理结果数组
     * @param {string} folderName - 文件夹名称
     * @returns {Promise<Blob>} - ZIP 文件 Blob
     */
    async createZip(results, folderName) {
        const zip = new JSZip();
        const folder = zip.folder(folderName);
        
        for (const result of results) {
            if (result.processedBlob) {
                // 使用输出文件名（已转换为 .png 扩展名）
                const fileName = result.outputFileName || result.originalFile.name;
                folder.file(fileName, result.processedBlob);
            }
        }
        
        return await zip.generateAsync({ type: 'blob' });
    },

    /**
     * 创建按文件夹结构组织的 ZIP 文件
     * @param {Map} resultsByFolder - 文件夹名 -> 处理结果数组的映射
     * @returns {Promise<Blob>} - ZIP 文件 Blob
     */
    async createZipWithFolders(resultsByFolder) {
        const zip = new JSZip();
        
        for (const [folderName, results] of resultsByFolder) {
            const folder = zip.folder(folderName);
            
            for (const result of results) {
                if (result.processedBlob) {
                    const fileName = result.outputFileName || result.originalFile.name;
                    folder.file(fileName, result.processedBlob);
                }
            }
        }
        
        return await zip.generateAsync({ type: 'blob' });
    },

    /**
     * 触发下载
     * @param {Blob} zipBlob - ZIP 文件 Blob
     * @param {string} fileName - 文件名
     */
    download(zipBlob, fileName) {
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
};

// ============ 应用状态 ============
const AppState = {
    images: [],           // 所有图片信息
    folderMap: new Map(), // 文件夹名 -> 图片数组的映射
    isProcessing: false,
    progress: { total: 0, completed: 0 },
    canDownload: false,
    results: [],
    resultsByFolder: new Map() // 文件夹名 -> 处理结果数组的映射
};

// ============ UI 控制器 ============
const UIController = {
    init() {
        this.dropZone = document.getElementById('dropZone');
        this.imageList = document.getElementById('imageList');
        this.zipNameInput = document.getElementById('zipName');
        this.outputFormatSelect = document.getElementById('outputFormat');
        this.maxSizeKBInput = document.getElementById('maxSizeKB');
        this.processBtn = document.getElementById('processBtn');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.progressSection = document.getElementById('progressSection');
        this.progressText = document.getElementById('progressText');
        this.progressFill = document.getElementById('progressFill');
        
        this.bindEvents();
    },

    bindEvents() {
        // 拖拽事件
        this.dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.dropZone.classList.add('drag-over');
        });

        this.dropZone.addEventListener('dragleave', () => {
            this.dropZone.classList.remove('drag-over');
        });

        this.dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.dropZone.classList.remove('drag-over');
            this.handleDrop(e.dataTransfer);
        });

        // 点击上传
        this.dropZone.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.multiple = true;
            input.webkitdirectory = true; // 支持文件夹选择
            input.onchange = (e) => this.handleFileInput(e.target.files);
            input.click();
        });

        // 按钮事件
        this.processBtn.addEventListener('click', () => this.startProcessing());
        this.downloadBtn.addEventListener('click', () => this.downloadZip());
    },
    
    // 获取用户配置
    getUserConfig() {
        const format = this.outputFormatSelect.value;
        const maxSizeKB = parseInt(this.maxSizeKBInput.value, 10) || 800;
        
        let extension;
        switch (format) {
            case 'image/jpeg': extension = '.jpg'; break;
            case 'image/png': extension = '.png'; break;
            case 'image/webp': extension = '.webp'; break;
            case 'image/avif': extension = '.avif'; break;
            default: extension = '.jpg';
        }
        
        return { format, maxSizeKB, extension };
    },

    // 处理拖拽
    async handleDrop(dataTransfer) {
        const items = dataTransfer.items;
        const filePromises = [];
        
        for (const item of items) {
            if (item.kind === 'file') {
                const entry = item.webkitGetAsEntry();
                if (entry) {
                    filePromises.push(this.traverseEntry(entry, ''));
                }
            }
        }
        
        const fileArrays = await Promise.all(filePromises);
        const allFiles = fileArrays.flat();
        
        await this.processFileList(allFiles);
    },

    // 递归遍历文件夹
    async traverseEntry(entry, path) {
        if (entry.isFile) {
            return new Promise((resolve) => {
                entry.file((file) => {
                    // 保存文件的相对路径
                    const folderPath = path || '未分类';
                    resolve([{ file, folderPath }]);
                });
            });
        } else if (entry.isDirectory) {
            const dirReader = entry.createReader();
            const entries = await new Promise((resolve) => {
                dirReader.readEntries(resolve);
            });
            
            const folderName = path ? `${path}/${entry.name}` : entry.name;
            const promises = entries.map(e => this.traverseEntry(e, folderName));
            const results = await Promise.all(promises);
            return results.flat();
        }
        return [];
    },

    // 处理文件输入（点击选择）
    async handleFileInput(files) {
        const fileList = [];
        for (const file of files) {
            // webkitRelativePath 包含文件夹路径
            const relativePath = file.webkitRelativePath || '';
            const pathParts = relativePath.split('/');
            // 获取文件夹名（第一级目录）
            const folderPath = pathParts.length > 1 ? pathParts.slice(0, -1).join('/') : '未分类';
            fileList.push({ file, folderPath });
        }
        await this.processFileList(fileList);
    },

    // 处理文件列表
    async processFileList(fileList) {
        const validFiles = [];
        const invalidFiles = [];

        for (const { file, folderPath } of fileList) {
            if (FileValidator.isValidImageFile(file)) {
                validFiles.push({ file, folderPath });
            } else if (file.name && !file.name.startsWith('.')) {
                invalidFiles.push(file.name);
            }
        }

        if (invalidFiles.length > 0) {
            console.log(`跳过不支持的文件: ${invalidFiles.join(', ')}`);
        }

        for (const { file, folderPath } of validFiles) {
            try {
                const info = await ImageAnalyzer.analyze(file);
                info.id = Date.now() + Math.random().toString(36).substr(2, 9);
                info.status = info.needsProcessing ? 'pending' : 'skipped';
                info.folderPath = folderPath; // 保存文件夹路径
                
                AppState.images.push(info);
                
                // 按文件夹分组
                if (!AppState.folderMap.has(folderPath)) {
                    AppState.folderMap.set(folderPath, []);
                }
                AppState.folderMap.get(folderPath).push(info);
                
                this.renderImageItem(info);
            } catch (error) {
                console.error('分析图片失败:', file.name, error);
            }
        }

        this.updateButtons();
        this.updateFolderSummary();
    },

    // 更新文件夹统计
    updateFolderSummary() {
        const folderCount = AppState.folderMap.size;
        const imageCount = AppState.images.length;
        console.log(`已导入 ${folderCount} 个文件夹，共 ${imageCount} 张图片`);
    },

    renderImageItem(info) {
        const item = document.createElement('div');
        item.className = 'image-item';
        item.id = `image-${info.id}`;
        
        const statusClass = `status-${info.status}`;
        const statusText = this.getStatusText(info.status);
        const folderDisplay = info.folderPath || '未分类';
        
        item.innerHTML = `
            <img class="image-preview" src="${info.previewUrl}" alt="${info.file.name}">
            <div class="image-info">
                <div class="image-folder" title="${folderDisplay}">📁 ${folderDisplay}</div>
                <div class="image-name" title="${info.file.name}">${info.file.name}</div>
                <div class="image-details">
                    尺寸: ${info.width} × ${info.height}<br>
                    大小: ${this.formatSize(info.size)}
                </div>
                <span class="image-status ${statusClass}">${statusText}</span>
            </div>
        `;
        
        this.imageList.appendChild(item);
    },

    updateImageStatus(info, status, finalSize) {
        const item = document.getElementById(`image-${info.id}`);
        if (!item) return;
        
        const statusEl = item.querySelector('.image-status');
        statusEl.className = `image-status status-${status}`;
        statusEl.textContent = this.getStatusText(status);
        
        if (finalSize !== undefined) {
            const details = item.querySelector('.image-details');
            details.innerHTML += `<br>处理后: ${this.formatSize(finalSize)}`;
        }
    },

    getStatusText(status) {
        const texts = {
            pending: '待处理',
            analyzing: '分析中',
            processing: '处理中',
            completed: '已完成',
            skipped: '无需处理',
            error: '处理失败'
        };
        return texts[status] || status;
    },

    formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    },

    updateButtons() {
        this.processBtn.disabled = AppState.images.length === 0 || AppState.isProcessing;
        this.downloadBtn.disabled = !AppState.canDownload;
    },

    updateProgress(progress) {
        this.progressSection.classList.remove('hidden');
        this.progressText.textContent = `处理中: ${progress.completed}/${progress.total}`;
        const percent = (progress.completed / progress.total) * 100;
        this.progressFill.style.width = `${percent}%`;
    },

    async startProcessing() {
        AppState.isProcessing = true;
        AppState.canDownload = false;
        AppState.resultsByFolder = new Map();
        this.updateButtons();

        // 获取用户配置
        const userConfig = this.getUserConfig();
        
        const imagesToProcess = AppState.images;
        
        // 更新所有待处理图片状态
        imagesToProcess.forEach(info => {
            if (info.needsProcessing) {
                this.updateImageStatus(info, 'processing');
            }
        });

        AppState.results = await BatchProcessor.processAll(imagesToProcess, userConfig, (progress) => {
            this.updateProgress(progress);
            
            // 更新当前处理完成的图片状态
            if (progress.completed > 0) {
                const lastResult = progress.results[progress.completed - 1];
                const imageInfo = imagesToProcess[progress.completed - 1];
                
                // 按文件夹分组保存结果
                const folderPath = imageInfo.folderPath || '未分类';
                if (!AppState.resultsByFolder.has(folderPath)) {
                    AppState.resultsByFolder.set(folderPath, []);
                }
                // 将文件夹路径信息添加到结果中
                lastResult.folderPath = folderPath;
                AppState.resultsByFolder.get(folderPath).push(lastResult);
                
                if (lastResult.error) {
                    this.updateImageStatus(imageInfo, 'error');
                } else if (lastResult.wasProcessed) {
                    this.updateImageStatus(imageInfo, 'completed', lastResult.finalSize);
                }
            }
        });

        AppState.isProcessing = false;
        AppState.canDownload = true;
        this.updateButtons();
    },

    async downloadZip() {
        const zipName = this.zipNameInput.value.trim() || 
            `images_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
        
        try {
            // 使用按文件夹结构打包
            const zipBlob = await ZipExporter.createZipWithFolders(AppState.resultsByFolder);
            ZipExporter.download(zipBlob, `${zipName}.zip`);
        } catch (error) {
            alert('打包失败，请重试');
            console.error('ZIP 打包失败:', error);
        }
    }
};

// ============ 初始化应用 ============
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        UIController.init();
    });
}
