/**
 * 地铁地图交互控制模块 - 修复版本
 * 处理拖拽、缩放、点击等用户交互
 */
class MetroInteraction {
    constructor(svgElement, renderer) {
        this.svg = svgElement;
        this.renderer = renderer;
        this.container = svgElement.parentElement;

        // 交互状态
        this.isDragging = false;
        this.isPickingStation = false;
        this.pickingMode = null; // 'start' | 'end'

        // 变换状态
        this.transform = {
            scale: 1,
            translateX: 0,
            translateY: 0
        };

        // 拖拽状态
        this.dragState = {
            startX: 0,
            startY: 0,
            startTranslateX: 0,
            startTranslateY: 0
        };

        // 缩放配置
        this.zoomConfig = {
            min: 0.3,
            max: 3,
            step: 0.1,
            sensitivity: 0.001
        };

        // 双指缩放状态
        this.pinchState = null;

        // 回调函数
        this.callbacks = {
            stationClick: null,
            stationPick: null,
            mapUpdate: null
        };

        // 提示元素
        this.pickingHint = null;

        this.init();
    }

    /**
     * 初始化交互系统
     */
    init() {
        this.bindEvents();
        this.setupTouchSupport();
        this.initializeView();

        console.log('地图交互系统初始化完成');
    }

    /**
     * 绑定事件处理器
     */
    bindEvents() {
        // 鼠标事件
        this.container.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.container.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.container.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.container.addEventListener('mouseleave', this.handleMouseUp.bind(this));

        // 滚轮缩放
        this.container.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });

        // 站点点击事件
        this.svg.addEventListener('stationClick', this.handleStationClick.bind(this));

        // 防止右键菜单
        this.container.addEventListener('contextmenu', (e) => e.preventDefault());

        // 防止文本选择
        this.container.addEventListener('selectstart', (e) => e.preventDefault());

        // 键盘事件
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));

        // 窗口大小变化
        window.addEventListener('resize', this.handleResize.bind(this));
    }

    /**
     * 设置触摸支持
     */
    setupTouchSupport() {
        // 触摸开始
        this.container.addEventListener('touchstart', (e) => {
            e.preventDefault();

            if (e.touches.length === 1) {
                // 单指拖拽
                const touch = e.touches[0];
                this.handleMouseDown({
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                    preventDefault: () => {}
                });
            } else if (e.touches.length === 2) {
                // 双指缩放
                this.handlePinchStart(e);
            }
        }, { passive: false });

        // 触摸移动
        this.container.addEventListener('touchmove', (e) => {
            e.preventDefault();

            if (e.touches.length === 1) {
                const touch = e.touches[0];
                this.handleMouseMove({
                    clientX: touch.clientX,
                    clientY: touch.clientY
                });
            } else if (e.touches.length === 2) {
                this.handlePinchMove(e);
            }
        }, { passive: false });

        // 触摸结束
        this.container.addEventListener('touchend', (e) => {
            e.preventDefault();

            if (e.touches.length === 0) {
                this.handleMouseUp();
                this.pinchState = null;
            }
        });
    }

    /**
     * 初始化视图
     */
    initializeView() {
        // 设置初始视图框
        this.svg.setAttribute('viewBox', '0 0 2000 2000');
        this.updateTransform();
    }

    /**
     * 处理鼠标按下事件
     * @param {MouseEvent} event 鼠标事件
     */
    handleMouseDown(event) {
        // 检查是否点击在站点上
        const target = event.target || document.elementFromPoint(event.clientX, event.clientY);
        if (target && target.classList.contains('metro-station')) {
            return; // 让站点处理点击事件
        }

        this.isDragging = true;
        this.container.style.cursor = 'grabbing';
        this.svg.classList.add('dragging');

        // 记录拖拽起始状态
        this.dragState.startX = event.clientX;
        this.dragState.startY = event.clientY;
        this.dragState.startTranslateX = this.transform.translateX;
        this.dragState.startTranslateY = this.transform.translateY;

        event.preventDefault();
    }

    /**
     * 处理鼠标移动事件
     * @param {MouseEvent} event 鼠标事件
     */
    handleMouseMove(event) {
        if (!this.isDragging) {
            return;
        }

        // 计算移动距离
        const deltaX = event.clientX - this.dragState.startX;
        const deltaY = event.clientY - this.dragState.startY;

        // 更新变换
        this.transform.translateX = this.dragState.startTranslateX + deltaX;
        this.transform.translateY = this.dragState.startTranslateY + deltaY;

        this.updateTransform();
        this.notifyMapUpdate();
    }

    /**
     * 处理鼠标释放事件
     */
    handleMouseUp() {
        if (!this.isDragging) {
            return;
        }

        this.isDragging = false;
        this.container.style.cursor = this.isPickingStation ? 'crosshair' : 'grab';
        this.svg.classList.remove('dragging');
    }

    /**
     * 处理滚轮事件 - 修复缩放功能
     * @param {WheelEvent} event 滚轮事件
     */
    handleWheel(event) {
        event.preventDefault();

        // 获取鼠标在容器中的位置
        const rect = this.container.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        // 计算缩放因子
        const scaleFactor = event.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.max(this.zoomConfig.min, Math.min(this.zoomConfig.max, this.transform.scale * scaleFactor));

        if (newScale === this.transform.scale) {
            return; // 达到缩放限制
        }

        // 计算缩放中心点在当前变换下的SVG坐标
        const svgRect = this.svg.getBoundingClientRect();
        const svgX = (mouseX - this.transform.translateX) / this.transform.scale;
        const svgY = (mouseY - this.transform.translateY) / this.transform.scale;

        // 计算新的平移量以保持鼠标位置不变
        const scaleRatio = newScale / this.transform.scale;
        this.transform.translateX = mouseX - svgX * newScale;
        this.transform.translateY = mouseY - svgY * newScale;
        this.transform.scale = newScale;

        this.updateTransform();
        this.notifyMapUpdate();
    }

    /**
     * 处理站点点击事件
     * @param {CustomEvent} event 自定义站点点击事件
     */
    handleStationClick(event) {
        const station = event.detail.station;

        if (this.isPickingStation) {
            // 站点选择模式
            this.handleStationPick(station);
        } else {
            // 普通点击模式
            if (this.callbacks.stationClick) {
                this.callbacks.stationClick(station);
            }
        }
    }

    /**
     * 处理站点选择
     * @param {Object} station 站点对象
     */
    handleStationPick(station) {
        if (this.callbacks.stationPick) {
            this.callbacks.stationPick(station, this.pickingMode);
        }

        // 退出选择模式
        this.exitPickingMode();
    }

    /**
     * 处理键盘按下事件
     * @param {KeyboardEvent} event 键盘事件
     */
    handleKeyDown(event) {
        // ESC键退出选择模式
        if (event.key === 'Escape') {
            this.exitPickingMode();
            return;
        }

        // 空格键切换拖拽模式
        if (event.key === ' ') {
            event.preventDefault();
            this.container.style.cursor = 'grab';
            return;
        }

        // 方向键移动
        const moveDistance = 50;
        switch (event.key) {
            case 'ArrowUp':
                event.preventDefault();
                this.transform.translateY += moveDistance;
                break;
            case 'ArrowDown':
                event.preventDefault();
                this.transform.translateY -= moveDistance;
                break;
            case 'ArrowLeft':
                event.preventDefault();
                this.transform.translateX += moveDistance;
                break;
            case 'ArrowRight':
                event.preventDefault();
                this.transform.translateX -= moveDistance;
                break;
            default:
                return;
        }

        this.updateTransform();
        this.notifyMapUpdate();
    }

    /**
     * 处理键盘释放事件
     * @param {KeyboardEvent} event 键盘事件
     */
    handleKeyUp(event) {
        if (event.key === ' ') {
            this.container.style.cursor = this.isPickingStation ? 'crosshair' : 'grab';
        }
    }

    /**
     * 处理窗口大小变化
     */
    handleResize() {
        // 延迟处理以避免频繁调用
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = setTimeout(() => {
            this.updateTransform();
        }, 100);
    }

    /**
     * 处理双指缩放开始
     * @param {TouchEvent} event 触摸事件
     */
    handlePinchStart(event) {
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];

        this.pinchState = {
            startDistance: this.getDistance(touch1, touch2),
            startScale: this.transform.scale,
            centerX: (touch1.clientX + touch2.clientX) / 2,
            centerY: (touch1.clientY + touch2.clientY) / 2
        };
    }

    /**
     * 处理双指缩放移动
     * @param {TouchEvent} event 触摸事件
     */
    handlePinchMove(event) {
        if (!this.pinchState) return;

        const touch1 = event.touches[0];
        const touch2 = event.touches[1];
        const currentDistance = this.getDistance(touch1, touch2);

        const scaleFactor = currentDistance / this.pinchState.startDistance;
        const newScale = Math.max(this.zoomConfig.min,
            Math.min(this.zoomConfig.max, this.pinchState.startScale * scaleFactor));

        // 计算缩放中心
        const rect = this.container.getBoundingClientRect();
        const centerX = this.pinchState.centerX - rect.left;
        const centerY = this.pinchState.centerY - rect.top;

        // 计算新的平移量
        const svgX = (centerX - this.transform.translateX) / this.transform.scale;
        const svgY = (centerY - this.transform.translateY) / this.transform.scale;

        this.transform.translateX = centerX - svgX * newScale;
        this.transform.translateY = centerY - svgY * newScale;
        this.transform.scale = newScale;

        this.updateTransform();
    }

    /**
     * 获取两点间距离
     * @param {Touch} touch1 触摸点1
     * @param {Touch} touch2 触摸点2
     * @returns {number} 距离
     */
    getDistance(touch1, touch2) {
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * 更新SVG变换
     */
    updateTransform() {
        const transform = `translate(${this.transform.translateX}px, ${this.transform.translateY}px) scale(${this.transform.scale})`;
        this.svg.style.transform = transform;

        // 更新容器光标
        if (!this.isDragging) {
            this.container.style.cursor = this.isPickingStation ? 'crosshair' : 'grab';
        }
    }

    /**
     * 进入站点选择模式
     * @param {string} mode 选择模式：'start' | 'end'
     */
    enterPickingMode(mode) {
        this.isPickingStation = true;
        this.pickingMode = mode;
        this.container.style.cursor = 'crosshair';
        this.container.classList.add('picking-mode');

        // 显示提示
        this.showPickingHint(mode);
    }

    /**
     * 退出站点选择模式
     */
    exitPickingMode() {
        this.isPickingStation = false;
        this.pickingMode = null;
        this.container.style.cursor = 'grab';
        this.container.classList.remove('picking-mode');

        // 隐藏提示
        this.hidePickingHint();
    }

    /**
     * 显示选择提示
     * @param {string} mode 选择模式
     */
    showPickingHint(mode) {
        const hintText = mode === 'start' ? '请点击选择起始站' : '请点击选择目标站';

        // 创建提示元素
        if (!this.pickingHint) {
            this.pickingHint = document.createElement('div');
            this.pickingHint.className = 'picking-hint';
            this.pickingHint.style.cssText = `
                position: absolute;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0, 122, 255, 0.9);
                color: white;
                padding: 10px 20px;
                border-radius: 20px;
                font-size: 14px;
                font-weight: 500;
                z-index: 100;
                pointer-events: none;
                box-shadow: 0 4px 15px rgba(0, 122, 255, 0.3);
            `;
            this.container.appendChild(this.pickingHint);
        }

        this.pickingHint.textContent = hintText;
        this.pickingHint.style.display = 'block';
    }

    /**
     * 隐藏选择提示
     */
    hidePickingHint() {
        if (this.pickingHint) {
            this.pickingHint.style.display = 'none';
        }
    }

    /**
     * 缩放到指定级别 - 修复缩放功能
     * @param {number} scale 缩放级别
     * @param {number} centerX 缩放中心X (可选)
     * @param {number} centerY 缩放中心Y (可选)
     */
    zoomTo(scale, centerX, centerY) {
        const newScale = Math.max(this.zoomConfig.min, Math.min(this.zoomConfig.max, scale));

        if (centerX !== undefined && centerY !== undefined) {
            // 以指定点为中心缩放
            const svgX = (centerX - this.transform.translateX) / this.transform.scale;
            const svgY = (centerY - this.transform.translateY) / this.transform.scale;

            this.transform.translateX = centerX - svgX * newScale;
            this.transform.translateY = centerY - svgY * newScale;
        } else {
            // 以容器中心为缩放中心
            const rect = this.container.getBoundingClientRect();
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            const svgX = (centerX - this.transform.translateX) / this.transform.scale;
            const svgY = (centerY - this.transform.translateY) / this.transform.scale;

            this.transform.translateX = centerX - svgX * newScale;
            this.transform.translateY = centerY - svgY * newScale;
        }

        this.transform.scale = newScale;
        this.updateTransform();
        this.notifyMapUpdate();
    }

    /**
     * 放大 - 修复缩放功能
     */
    zoomIn() {
        const rect = this.container.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        this.zoomTo(this.transform.scale * 1.2, centerX, centerY);
    }

    /**
     * 缩小 - 修复缩放功能
     */
    zoomOut() {
        const rect = this.container.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        this.zoomTo(this.transform.scale * 0.8, centerX, centerY);
    }

    /**
     * 缩放到适合内容
     */
    zoomToFit() {
        if (!window.metroData) return;

        const stations = window.metroData.getStations();
        if (stations.length === 0) return;

        // 计算内容边界
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        stations.forEach(station => {
            const [x, y] = station.graphPosition;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
        });

        // 添加边距
        const padding = 100;
        const contentWidth = maxX - minX + padding * 2;
        const contentHeight = maxY - minY + padding * 2;
        const contentCenterX = (minX + maxX) / 2;
        const contentCenterY = (minY + maxY) / 2;

        // 计算容器尺寸
        const rect = this.container.getBoundingClientRect();
        const containerWidth = rect.width;
        const containerHeight = rect.height;

        // 计算合适的缩放级别
        const scaleX = containerWidth / contentWidth;
        const scaleY = containerHeight / contentHeight;
        const scale = Math.min(scaleX, scaleY) * 0.9; // 0.9 用于留出边距

        // 设置变换
        this.transform.scale = Math.max(this.zoomConfig.min, Math.min(this.zoomConfig.max, scale));
        this.transform.translateX = containerWidth / 2 - contentCenterX * this.transform.scale;
        this.transform.translateY = containerHeight / 2 - contentCenterY * this.transform.scale;

        this.updateTransform();
        this.notifyMapUpdate();
    }

    /**
     * 重置视图
     */
    resetView() {
        this.transform.scale = 1;
        this.transform.translateX = 0;
        this.transform.translateY = 0;
        this.updateTransform();
        this.notifyMapUpdate();
    }

    /**
     * 平移到指定位置
     * @param {number} x X坐标
     * @param {number} y Y坐标
     * @param {boolean} animated 是否动画
     */
    panTo(x, y, animated = true) {
        const rect = this.container.getBoundingClientRect();
        const targetTranslateX = rect.width / 2 - x * this.transform.scale;
        const targetTranslateY = rect.height / 2 - y * this.transform.scale;

        if (animated) {
            this.animateTransform({
                translateX: targetTranslateX,
                translateY: targetTranslateY
            });
        } else {
            this.transform.translateX = targetTranslateX;
            this.transform.translateY = targetTranslateY;
            this.updateTransform();
            this.notifyMapUpdate();
        }
    }

    /**
     * 动画变换
     * @param {Object} targetTransform 目标变换
     * @param {number} duration 动画时长
     */
    animateTransform(targetTransform, duration = 500) {
        const startTransform = { ...this.transform };
        const startTime = performance.now();

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // 使用缓动函数
            const easeProgress = this.easeInOutCubic(progress);

            // 插值计算
            Object.keys(targetTransform).forEach(key => {
                this.transform[key] = startTransform[key] +
                    (targetTransform[key] - startTransform[key]) * easeProgress;
            });

            this.updateTransform();

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.notifyMapUpdate();
            }
        };

        requestAnimationFrame(animate);
    }

    /**
     * 缓动函数
     * @param {number} t 进度 (0-1)
     * @returns {number} 缓动后的进度
     */
    easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
    }

    /**
     * 通知地图更新
     */
    notifyMapUpdate() {
        if (this.callbacks.mapUpdate) {
            this.callbacks.mapUpdate(this.transform);
        }
    }

    /**
     * 设置回调函数
     * @param {string} name 回调名称
     * @param {Function} callback 回调函数
     */
    setCallback(name, callback) {
        this.callbacks[name] = callback;
    }

    /**
     * 获取当前变换状态
     * @returns {Object} 变换状态
     */
    getTransform() {
        return { ...this.transform };
    }

    /**
     * 设置变换状态
     * @param {Object} transform 变换状态
     */
    setTransform(transform) {
        this.transform = { ...this.transform, ...transform };
        this.updateTransform();
        this.notifyMapUpdate();
    }

    /**
     * 获取鼠标在SVG中的坐标
     * @param {MouseEvent} event 鼠标事件
     * @returns {Object} SVG坐标 {x, y}
     */
    getEventSVGCoordinates(event) {
        const rect = this.container.getBoundingClientRect();
        const x = (event.clientX - rect.left - this.transform.translateX) / this.transform.scale;
        const y = (event.clientY - rect.top - this.transform.translateY) / this.transform.scale;
        return { x, y };
    }

    /**
     * 检查是否正在进行交互
     * @returns {boolean} 是否正在交互
     */
    isInteracting() {
        return this.isDragging || this.isPickingStation;
    }

    /**
     * 销毁交互系统
     */
    destroy() {
        // 移除所有事件监听器
        this.container.removeEventListener('mousedown', this.handleMouseDown);
        this.container.removeEventListener('mousemove', this.handleMouseMove);
        this.container.removeEventListener('mouseup', this.handleMouseUp);
        this.container.removeEventListener('mouseleave', this.handleMouseUp);
        this.container.removeEventListener('wheel', this.handleWheel);
        this.svg.removeEventListener('stationClick', this.handleStationClick);
        document.removeEventListener('keydown', this.handleKeyDown);
        document.removeEventListener('keyup', this.handleKeyUp);
        window.removeEventListener('resize', this.handleResize);

        // 清理提示元素
        if (this.pickingHint) {
            this.pickingHint.remove();
        }

        // 清理定时器
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
        }
    }
}

// 导出交互类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MetroInteraction;
} else if (typeof window !== 'undefined') {
    window.MetroInteraction = MetroInteraction;
}