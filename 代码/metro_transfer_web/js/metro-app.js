/**
 * 上海地铁换乘系统主应用模块
 * 负责协调所有模块并处理用户交互
 */
class MetroTransferApp {
    constructor() {
        // 核心模块
        this.dataManager = window.metroData;
        this.pathFinder = null;
        this.renderer = null;
        this.interaction = null;

        // UI 元素
        this.elements = {};

        // 应用状态
        this.state = {
            isPickingStart: false,
            isPickingEnd: false,
            currentPath: null,
            searchMode: 'count',
            selectedStations: { start: null, end: null }
        };

        // 消息容器
        this.messageContainer = null;

        // 自动完成
        this.autocompletes = {
            start: null,
            end: null
        };

        // 初始化
        this.init();
    }

    /**
     * 初始化应用
     */
    async init() {
        try {
            this.showLoadingOverlay(true);
            console.log('开始初始化应用...');

            // 初始化数据管理器
            await this.dataManager.init();
            console.log('数据管理器初始化完成');

            // 初始化UI
            this.initUI();

            // 初始化核心模块
            this.initModules();

            // 绑定事件
            this.bindEvents();

            // 强制显示应用容器
            this.forceShowAppContainer();

            // 渲染地图
            this.renderer.renderMap();
            console.log('地图渲染完成');

            this.showLoadingOverlay(false);
            this.showMessage('系统初始化完成', 'success');

            console.log('应用初始化完成');
        } catch (error) {
            console.error('应用初始化失败:', error);
            this.showLoadingOverlay(false);

            // 即使初始化失败也要显示容器
            this.forceShowAppContainer();

            this.showMessage('系统初始化失败: ' + error.message, 'error');
        }
    }

    forceShowAppContainer() {
        console.log('强制显示应用容器...');

        const appContainer = document.getElementById('app-container');
        if (appContainer) {
            // 移除所有可能隐藏容器的类
            appContainer.classList.remove('hidden');

            // 强制设置显示样式
            appContainer.style.display = 'flex';
            appContainer.style.opacity = '1';
            appContainer.style.visibility = 'visible';

            console.log('应用容器已强制显示');
        } else {
            console.error('找不到应用容器元素');
        }
    }

    /**
     * 初始化UI元素
     */
    initUI() {
        // 获取所有重要的DOM元素
        this.elements = {
            // 输入元素
            startInput: document.getElementById('start-station'),
            endInput: document.getElementById('end-station'),
            searchMode: document.getElementById('search-mode'),

            // 按钮元素
            startPickBtn: document.getElementById('pick-start-btn'),
            endPickBtn: document.getElementById('pick-end-btn'),
            searchBtn: document.getElementById('search-btn'),
            clearBtn: document.getElementById('clear-path-btn'),
            addStationBtn: document.getElementById('add-station-btn'),
            addLineBtn: document.getElementById('add-line-btn'),
            addConnectionBtn: document.getElementById('add-connection-btn'),
            saveBtn: document.getElementById('save-btn'),

            // 地图相关
            metroMap: document.getElementById('metro-map'),
            zoomInBtn: document.getElementById('zoom-in-btn'),
            zoomOutBtn: document.getElementById('zoom-out-btn'),
            resetViewBtn: document.getElementById('reset-view-btn'),

            // 结果显示
            routeDetails: document.getElementById('route-details'),

            // 模态对话框
            modalOverlay: document.getElementById('modal-overlay'),
            modalContent: document.querySelector('.modal-content'),
            modalCloseBtn: document.querySelector('.modal-close-btn')
        };

        // 创建消息容器
        this.createMessageContainer();

        // 初始化自动完成
        this.initAutocomplete();
    }

    /**
     * 初始化核心模块
     */
    initModules() {
        // 初始化路径查找器
        this.pathFinder = new MetroPathFinder(this.dataManager);

        // 初始化渲染器
        this.renderer = new MetroRenderer(this.elements.metroMap, this.dataManager);

        // 初始化交互模块 - 修复：使用正确的类名
        this.interaction = new MetroInteraction(this.elements.metroMap, this.renderer);

        // 设置交互回调
        this.interaction.setCallback('stationClick', (station) => {
            this.handleStationClick({ detail: { station } });
        });

        this.interaction.setCallback('stationPick', (station, mode) => {
            this.handleStationPick(station, mode);
        });
    }

    /**
     * 绑定所有事件
     */
    bindEvents() {
        // 搜索相关事件
        this.elements.startPickBtn?.addEventListener('click', () => this.handlePickStation('start'));
        this.elements.endPickBtn?.addEventListener('click', () => this.handlePickStation('end'));
        this.elements.searchBtn?.addEventListener('click', () => this.handleSearch());
        this.elements.clearBtn?.addEventListener('click', () => this.handleClear());

        // 输入框事件
        this.elements.startInput?.addEventListener('input', (e) => this.handleStationInput('start', e));
        this.elements.endInput?.addEventListener('input', (e) => this.handleStationInput('end', e));
        this.elements.searchMode?.addEventListener('change', (e) => this.handleModeChange(e));

        // 回车搜索
        this.elements.startInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSearch();
        });
        this.elements.endInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSearch();
        });

        // 管理功能事件
        this.elements.addStationBtn?.addEventListener('click', () => this.showAddStationDialog());
        this.elements.addLineBtn?.addEventListener('click', () => this.showAddLineDialog());
        this.elements.addConnectionBtn?.addEventListener('click', () => this.showAddConnectionDialog());
        this.elements.saveBtn?.addEventListener('click', () => this.handleSave());

        // 地图控制事件 - 修复：使用interaction的方法
        this.elements.zoomInBtn?.addEventListener('click', () => this.interaction.zoomIn());
        this.elements.zoomOutBtn?.addEventListener('click', () => this.interaction.zoomOut());
        this.elements.resetViewBtn?.addEventListener('click', () => this.interaction.resetView());

        // 站点点击事件
        this.elements.metroMap?.addEventListener('stationClick', (e) => this.handleStationClick(e));

        // 模态对话框事件
        this.elements.modalCloseBtn?.addEventListener('click', () => this.hideModal());
        this.elements.modalOverlay?.addEventListener('click', (e) => {
            if (e.target === this.elements.modalOverlay) {
                this.hideModal();
            }
        });

        // 键盘事件
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));

        // 窗口事件
        window.addEventListener('resize', () => this.handleResize());
        window.addEventListener('beforeunload', () => this.handleBeforeUnload());
    }

    /**
     * 处理站点选择
     * @param {string} type 选择类型：'start' 或 'end'
     */
    handlePickStation(type) {
        // 重置状态
        this.state.isPickingStart = false;
        this.state.isPickingEnd = false;

        // 清除之前的选择状态
        this.clearPickingState();

        if (type === 'start') {
            this.state.isPickingStart = true;
            this.elements.startPickBtn?.classList.add('active');
            this.interaction.enterPickingMode('start');
            this.showMessage('请在地图上点击选择起始站', 'info');
        } else {
            this.state.isPickingEnd = true;
            this.elements.endPickBtn?.classList.add('active');
            this.interaction.enterPickingMode('end');
            this.showMessage('请在地图上点击选择目标站', 'info');
        }
    }

    /**
     * 清除选择状态
     */
    clearPickingState() {
        this.elements.startPickBtn?.classList.remove('active');
        this.elements.endPickBtn?.classList.remove('active');
        this.interaction.exitPickingMode();
    }

    /**
     * 处理站点点击
     * @param {Event} event 点击事件
     */
    handleStationClick(event) {
        const station = event.detail.station;

        if (this.state.isPickingStart) {
            this.setStation('start', station.name);
            this.state.isPickingStart = false;
            this.clearPickingState();
        } else if (this.state.isPickingEnd) {
            this.setStation('end', station.name);
            this.state.isPickingEnd = false;
            this.clearPickingState();
        }
    }

    /**
     * 处理站点选择回调
     * @param {Object} station 站点对象
     * @param {string} mode 选择模式
     */
    handleStationPick(station, mode) {
        this.setStation(mode, station.name);

        if (mode === 'start') {
            this.state.isPickingStart = false;
            this.elements.startPickBtn?.classList.remove('active');
        } else if (mode === 'end') {
            this.state.isPickingEnd = false;
            this.elements.endPickBtn?.classList.remove('active');
        }
    }

    /**
     * 设置站点
     * @param {string} type 类型：'start' 或 'end'
     * @param {string} stationName 站点名称
     */
    setStation(type, stationName) {
        this.state.selectedStations[type] = stationName;

        if (type === 'start' && this.elements.startInput) {
            this.elements.startInput.value = stationName;
        } else if (type === 'end' && this.elements.endInput) {
            this.elements.endInput.value = stationName;
        }

        // 隐藏自动完成
        this.hideAutocomplete(type);
    }

    /**
     * 处理搜索
     */
    async handleSearch() {
        try {
            const startStation = this.elements.startInput?.value.trim();
            const endStation = this.elements.endInput?.value.trim();
            const mode = this.elements.searchMode?.value || 'count';

            // 输入验证
            if (!startStation || !endStation) {
                this.showMessage('请输入起始站和目标站', 'warning');
                return;
            }

            if (startStation === endStation) {
                this.showMessage('起始站和目标站不能相同', 'warning');
                return;
            }

            // 显示加载状态
            this.setSearchButtonLoading(true);

            // 查找路径
            const result = await this.searchPath(startStation, endStation, mode);

            if (result.found) {
                // 显示路径
                this.displayPath(result);
                this.showMessage('路径查找成功', 'success');
            } else {
                this.showMessage('未找到可用路径', 'warning');
            }

        } catch (error) {
            console.error('搜索失败:', error);
            this.showMessage('搜索失败: ' + error.message, 'error');
        } finally {
            this.setSearchButtonLoading(false);
        }
    }

    /**
     * 搜索路径
     * @param {string} start 起始站
     * @param {string} end 目标站
     * @param {string} mode 搜索模式
     * @returns {Object} 搜索结果
     */
    async searchPath(start, end, mode) {
        return new Promise((resolve) => {
            // 使用 setTimeout 来模拟异步操作，避免阻塞UI
            setTimeout(() => {
                try {
                    const result = this.pathFinder.findPath(start, end, mode);
                    resolve(result);
                } catch (error) {
                    resolve({ found: false, error: error.message });
                }
            }, 100);
        });
    }

    /**
     * 显示路径结果
     * @param {Object} result 路径结果
     */
    displayPath(result) {
        this.state.currentPath = result;

        // 在地图上高亮路径
        this.renderer.highlightPath(result.path);

        // 显示路径详情
        this.displayRouteDetails(result.guide);

        // 显示换乘指南对话框
        if (result.guide && result.guide.steps.length > 0) {
            this.showRouteGuideDialog(result.guide);
        }
    }

    /**
     * 显示路径详情
     * @param {Object} guide 换乘指南
     */
    displayRouteDetails(guide) {
        if (!this.elements.routeDetails || !guide) return;

        const html = `
            <div class="route-summary">
                <h4>路线概要</h4>
                <div class="summary-stats">
                    <div class="stat-item">
                        <span class="stat-value">${guide.stationCount}</span>
                        <span class="stat-label">站点</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${guide.transferCount}</span>
                        <span class="stat-label">换乘</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${guide.totalTime}</span>
                        <span class="stat-label">分钟</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${guide.totalDistance}</span>
                        <span class="stat-label">公里</span>
                    </div>
                </div>
            </div>
            <div class="route-steps">
                ${this.generateRouteStepsHTML(guide.steps)}
            </div>
        `;

        this.elements.routeDetails.innerHTML = html;

        // 显示路线信息面板
        const routeInfo = document.getElementById('route-info');
        if (routeInfo) {
            routeInfo.classList.remove('hidden');
        }
    }

    /**
     * 生成路径步骤HTML
     * @param {Array} steps 路径步骤
     * @returns {string} HTML字符串
     */
    generateRouteStepsHTML(steps) {
        return steps.map((step, index) => {
            if (step.type === 'ride') {
                return `
                    <div class="route-step">
                        <div class="route-step-icon" style="background: ${step.lineColor}">
                            ${index + 1}
                        </div>
                        <div class="route-step-content">
                            <div class="route-step-line">${step.line}</div>
                            <div class="route-step-stations">
                                ${step.from} → ${step.to} (${step.stationCount}站)
                            </div>
                        </div>
                    </div>
                `;
            } else if (step.type === 'transfer') {
                return `
                    <div class="route-step transfer">
                        <div class="route-step-icon" style="background: #ff9500">
                            换
                        </div>
                        <div class="route-step-content">
                            <div class="route-step-line">在 ${step.station} 换乘</div>
                            <div class="route-step-stations">
                                ${step.fromLine} → ${step.toLine}
                            </div>
                        </div>
                    </div>
                `;
            }
            return '';
        }).join('');
    }

    /**
     * 处理清除操作
     */
    handleClear() {
        // 清除输入
        if (this.elements.startInput) this.elements.startInput.value = '';
        if (this.elements.endInput) this.elements.endInput.value = '';

        // 清除状态
        this.state.selectedStations = { start: null, end: null };
        this.state.currentPath = null;

        // 清除地图高亮
        this.renderer.clearPathHighlight();

        // 清除路径详情
        if (this.elements.routeDetails) {
            this.elements.routeDetails.innerHTML = '';
        }

        // 隐藏路线信息面板
        const routeInfo = document.getElementById('route-info');
        if (routeInfo) {
            routeInfo.classList.add('hidden');
        }

        // 清除选择状态
        this.clearPickingState();
        this.state.isPickingStart = false;
        this.state.isPickingEnd = false;

        // 隐藏自动完成
        this.hideAutocomplete('start');
        this.hideAutocomplete('end');

        this.showMessage('已清除所有选择', 'info');
    }

    /**
     * 处理模式变化
     * @param {Event} event 变化事件
     */
    handleModeChange(event) {
        this.state.searchMode = event.target.value;

        // 如果已有路径，重新搜索
        if (this.state.currentPath) {
            const start = this.elements.startInput?.value;
            const end = this.elements.endInput?.value;
            if (start && end) {
                this.handleSearch();
            }
        }
    }

    /**
     * 处理站点输入
     * @param {string} type 输入类型
     * @param {Event} event 输入事件
     */
    handleStationInput(type, event) {
        const value = event.target.value.trim();

        if (value.length > 0) {
            this.showAutocomplete(type, value);
        } else {
            this.hideAutocomplete(type);
        }

        // 更新状态
        this.state.selectedStations[type] = value;
    }

    /**
     * 设置搜索按钮加载状态
     * @param {boolean} loading 是否加载中
     */
    setSearchButtonLoading(loading) {
        if (!this.elements.searchBtn) return;

        if (loading) {
            this.elements.searchBtn.disabled = true;
            this.elements.searchBtn.innerHTML = '<span class="spinner"></span> 搜索中...';
        } else {
            this.elements.searchBtn.disabled = false;
            this.elements.searchBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="m21 21-4.35-4.35"/>
                </svg>
                查询路线
            `;
        }
    }

    /**
     * 显示加载遮罩
     * @param {boolean} show 是否显示
     */
    showLoadingOverlay(show) {
        const overlay = document.querySelector('.loading-overlay');
        const appContainer = document.getElementById('app-container');

        console.log('设置加载遮罩:', show);

        if (overlay) {
            if (show) {
                overlay.style.display = 'flex';
                overlay.classList.remove('hidden');
            } else {
                overlay.style.display = 'none';
                overlay.classList.add('hidden');
            }
        }

        // 确保应用容器在隐藏加载遮罩时显示
        if (!show && appContainer) {
            this.forceShowAppContainer();
        }
    }

    /**
     * 显示消息
     * @param {string} message 消息内容
     * @param {string} type 消息类型：success, error, warning, info
     * @param {number} duration 显示时长（毫秒）
     */
    showMessage(message, type = 'info', duration = 3000) {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${type}`;
        messageElement.textContent = message;
        messageElement.style.cssText = `
            padding: 15px 20px;
            border-radius: 12px;
            color: white;
            font-weight: 500;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
            animation: messageSlideIn 0.3s ease-out;
            max-width: 300px;
            margin-bottom: 10px;
        `;

        // 设置背景颜色
        const colors = {
            success: 'linear-gradient(45deg, #28a745, #20c997)',
            error: 'linear-gradient(45deg, #dc3545, #fd7e14)',
            warning: 'linear-gradient(45deg, #ffc107, #fd7e14)',
            info: 'linear-gradient(45deg, #007AFF, #5856D6)'
        };
        messageElement.style.background = colors[type] || colors.info;

        this.messageContainer.appendChild(messageElement);

        // 自动移除
        setTimeout(() => {
            if (messageElement.parentNode) {
                messageElement.style.opacity = '0';
                setTimeout(() => {
                    messageElement.remove();
                }, 300);
            }
        }, duration);
    }

    /**
     * 创建消息容器
     */
    createMessageContainer() {
        this.messageContainer = document.createElement('div');
        this.messageContainer.className = 'message-container';
        this.messageContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 2000;
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;
        document.body.appendChild(this.messageContainer);
    }

    /**
     * 初始化自动完成功能
     */
    initAutocomplete() {
        // 为起始站和目标站输入框创建自动完成容器
        ['start', 'end'].forEach(type => {
            const input = this.elements[`${type}Input`];
            if (input) {
                const container = document.createElement('div');
                container.className = 'autocomplete-container hidden';
                container.dataset.type = type;
                container.style.cssText = `
                    position: absolute;
                    background: white;
                    border: 1px solid #e9ecef;
                    border-radius: 8px;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
                    max-height: 200px;
                    overflow-y: auto;
                    z-index: 100;
                    width: 100%;
                    top: 100%;
                    left: 0;
                `;

                // 定位到输入框下方
                input.parentNode.style.position = 'relative';
                input.parentNode.appendChild(container);

                this.autocompletes[type] = container;
            }
        });
    }

    /**
     * 显示自动完成建议
     * @param {string} type 输入类型
     * @param {string} query 查询字符串
     */
    showAutocomplete(type, query) {
        const container = this.autocompletes[type];
        if (!container) return;

        const suggestions = this.dataManager.searchStations(query);

        if (suggestions.length === 0) {
            this.hideAutocomplete(type);
            return;
        }

        container.innerHTML = suggestions.slice(0, 5).map(station =>
            `<div class="autocomplete-item" data-station="${station}" style="
                padding: 12px 15px;
                cursor: pointer;
                border-bottom: 1px solid #f8f9fa;
                transition: all 0.2s ease;
            " onmouseover="this.style.background='#f8f9fa'; this.style.color='#007AFF';" 
               onmouseout="this.style.background='white'; this.style.color='#333';">${station}</div>`
        ).join('');

        // 绑定点击事件
        container.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('click', () => {
                this.setStation(type, item.dataset.station);
            });
        });

        container.classList.remove('hidden');
    }

    /**
     * 隐藏自动完成建议
     * @param {string} type 输入类型
     */
    hideAutocomplete(type) {
        const container = this.autocompletes[type];
        if (container) {
            container.classList.add('hidden');
        }
    }

    /**
     * 显示模态对话框
     * @param {string} title 标题
     * @param {string} content 内容HTML
     */
    showModal(title, content) {
        if (!this.elements.modalOverlay) return;

        const modalHTML = `
            <div class="modal-header">
                <h3 class="modal-title">${title}</h3>
                <button class="modal-close-btn">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
            <div class="modal-body">
                ${content}
            </div>
        `;

        this.elements.modalContent.innerHTML = modalHTML;
        this.elements.modalOverlay.classList.remove('hidden');

        // 重新绑定关闭按钮事件
        const closeBtn = this.elements.modalContent.querySelector('.modal-close-btn');
        closeBtn?.addEventListener('click', () => this.hideModal());
    }

    /**
     * 隐藏模态对话框
     */
    hideModal() {
        if (this.elements.modalOverlay) {
            this.elements.modalOverlay.classList.add('hidden');
        }
    }

    /**
     * 显示换乘指南对话框
     * @param {Object} guide 换乘指南
     */
    showRouteGuideDialog(guide) {
        const content = `
            <div class="route-guide">
                <div class="guide-summary" style="margin-bottom: 20px;">
                    <div class="summary-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div class="summary-item" style="text-align: center; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                            <div class="summary-value" style="font-size: 24px; font-weight: 700; color: #007AFF;">${guide.totalTime}</div>
                            <div class="summary-label" style="font-size: 12px; color: #666;">预计时间 (分钟)</div>
                        </div>
                        <div class="summary-item" style="text-align: center; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                            <div class="summary-value" style="font-size: 24px; font-weight: 700; color: #007AFF;">${guide.totalDistance}</div>
                            <div class="summary-label" style="font-size: 12px; color: #666;">总距离 (公里)</div>
                        </div>
                        <div class="summary-item" style="text-align: center; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                            <div class="summary-value" style="font-size: 24px; font-weight: 700; color: #007AFF;">${guide.stationCount}</div>
                            <div class="summary-label" style="font-size: 12px; color: #666;">经过站点</div>
                        </div>
                        <div class="summary-item" style="text-align: center; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                            <div class="summary-value" style="font-size: 24px; font-weight: 700; color: #007AFF;">${guide.transferCount}</div>
                            <div class="summary-label" style="font-size: 12px; color: #666;">换乘次数</div>
                        </div>
                    </div>
                </div>
                <div class="guide-steps">
                    <h4 style="margin-bottom: 15px; color: #333;">换乘指南</h4>
                    ${this.generateDetailedGuideHTML(guide.steps)}
                </div>
            </div>
        `;

        this.showModal('🚇 换乘指南', content);
    }

    /**
     * 生成详细换乘指南HTML
     * @param {Array} steps 换乘步骤
     * @returns {string} HTML字符串
     */
    generateDetailedGuideHTML(steps) {
        return steps.map((step, index) => {
            if (step.type === 'ride') {
                const stationList = step.stations.join(' → ');
                return `
                    <div class="guide-step" style="display: flex; align-items: flex-start; margin-bottom: 20px; padding: 15px; background: white; border-radius: 8px; border-left: 4px solid ${step.lineColor};">
                        <div class="step-number" style="width: 30px; height: 30px; background: ${step.lineColor}; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 15px; flex-shrink: 0;">${Math.floor(index / 2) + 1}</div>
                        <div class="step-content" style="flex: 1;">
                            <div class="step-action" style="margin-bottom: 8px; font-weight: 600;">
                                <span class="line-badge" style="background: ${step.lineColor}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; margin-right: 8px;">${step.line}</span>
                                从 <strong>${step.from}</strong> 到 <strong>${step.to}</strong>
                            </div>
                            <div class="step-details" style="color: #666; font-size: 14px;">
                                共 ${step.stationCount} 站：${stationList}
                            </div>
                        </div>
                    </div>
                `;
            } else if (step.type === 'transfer') {
                return `
                    <div class="guide-step transfer-step" style="display: flex; align-items: center; margin-bottom: 20px; padding: 15px; background: #fff3cd; border-radius: 8px; border: 1px solid #ffeaa7;">
                        <div class="step-icon" style="width: 30px; height: 30px; background: #ff9500; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 15px; font-size: 14px;">🔄</div>
                        <div class="step-content" style="flex: 1;">
                            <div class="step-action" style="margin-bottom: 8px; font-weight: 600;">
                                在 <strong>${step.station}</strong> 换乘
                            </div>
                            <div class="step-details" style="display: flex; align-items: center; gap: 8px; font-size: 14px;">
                                <span class="line-badge" style="background: ${step.fromLineColor}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">${step.fromLine}</span>
                                <span style="color: #666;">➜</span>
                                <span class="line-badge" style="background: ${step.toLineColor}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">${step.toLine}</span>
                            </div>
                        </div>
                    </div>
                `;
            }
            return '';
        }).join('');
    }

    /**
     * 显示添加站点对话框
     */
    showAddStationDialog() {
        const content = `
            <form id="add-station-form" class="station-form">
                <div class="form-group" style="margin-bottom: 20px;">
                    <label for="station-name" style="display: block; margin-bottom: 8px; font-weight: 500;">站点名称 *</label>
                    <input type="text" id="station-name" name="name" required style="width: 100%; padding: 12px; border: 2px solid #e9ecef; border-radius: 8px; font-size: 14px;">
                </div>
                
                <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                    <div class="form-group">
                        <label for="station-lng" style="display: block; margin-bottom: 8px; font-weight: 500;">经度 *</label>
                        <input type="number" id="station-lng" name="lng" step="0.000001" min="120.87" max="122.2" value="121.5" required style="width: 100%; padding: 12px; border: 2px solid #e9ecef; border-radius: 8px; font-size: 14px;">
                    </div>
                    <div class="form-group">
                        <label for="station-lat" style="display: block; margin-bottom: 8px; font-weight: 500;">纬度 *</label>
                        <input type="number" id="station-lat" name="lat" step="0.000001" min="30.67" max="31.88" value="31.2" required style="width: 100%; padding: 12px; border: 2px solid #e9ecef; border-radius: 8px; font-size: 14px;">
                    </div>
                </div>
                
                <div class="form-actions" style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 30px;">
                    <button type="button" class="secondary-btn" onclick="metroApp.hideModal()" style="padding: 12px 20px; background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; cursor: pointer;">取消</button>
                    <button type="submit" class="primary-btn" style="padding: 12px 20px; background: #007AFF; color: white; border: none; border-radius: 8px; cursor: pointer;">添加站点</button>
                </div>
            </form>
        `;

        this.showModal('📍 添加新站点', content);

        // 绑定表单提交事件
        const form = document.getElementById('add-station-form');
        form?.addEventListener('submit', (e) => this.handleAddStation(e));
    }

    /**
     * 处理添加站点
     * @param {Event} event 表单提交事件
     */
    handleAddStation(event) {
        event.preventDefault();

        const formData = new FormData(event.target);
        const stationData = {
            name: formData.get('name').trim(),
            lng: parseFloat(formData.get('lng')),
            lat: parseFloat(formData.get('lat'))
        };

        // 验证数据
        if (!stationData.name) {
            this.showMessage('站点名称不能为空', 'error');
            return;
        }

        if (this.dataManager.hasStation(stationData.name)) {
            this.showMessage('站点已存在', 'error');
            return;
        }

        try {
            // 计算图上位置
            const graphX = Math.round((stationData.lng - 120.87) * 1500 + 100);
            const graphY = Math.round((31.88 - stationData.lat) * 1500 + 100);

            // 添加站点
            const success = this.dataManager.addStation(
                stationData.name,
                [graphX, graphY],
                [stationData.lng, stationData.lat],
                'normal',
                'top'
            );

            if (success) {
                // 重新渲染地图
                this.renderer.renderMap();

                this.hideModal();
                this.showMessage('站点添加成功', 'success');
            } else {
                this.showMessage('站点添加失败', 'error');
            }

        } catch (error) {
            console.error('添加站点失败:', error);
            this.showMessage('添加站点失败: ' + error.message, 'error');
        }
    }

    /**
     * 显示添加线路对话框
     */
    showAddLineDialog() {
        this.showMessage('此功能正在开发中', 'info');
    }

    /**
     * 显示添加连接对话框
     */
    showAddConnectionDialog() {
        this.showMessage('此功能正在开发中', 'info');
    }

    /**
     * 处理保存操作
     */
    handleSave() {
        try {
            const success = this.dataManager.saveToStorage();

            if (success) {
                this.showMessage('数据保存成功', 'success');
            } else {
                this.showMessage('数据保存失败', 'error');
            }
        } catch (error) {
            console.error('保存失败:', error);
            this.showMessage('保存失败: ' + error.message, 'error');
        }
    }

    /**
     * 处理键盘事件
     * @param {KeyboardEvent} event 键盘事件
     */
    handleKeyDown(event) {
        // ESC 键关闭模态对话框
        if (event.key === 'Escape') {
            this.hideModal();
            this.clearPickingState();
            this.state.isPickingStart = false;
            this.state.isPickingEnd = false;
        }

        // Ctrl+S 保存
        if (event.ctrlKey && event.key === 's') {
            event.preventDefault();
            this.handleSave();
        }

        // Ctrl+F 聚焦搜索
        if (event.ctrlKey && event.key === 'f') {
            event.preventDefault();
            this.elements.startInput?.focus();
        }
    }

    /**
     * 处理窗口大小变化
     */
    handleResize() {
        // 隐藏自动完成建议
        this.hideAutocomplete('start');
        this.hideAutocomplete('end');
    }

    /**
     * 处理页面卸载前事件
     */
    handleBeforeUnload() {
        // 自动保存数据
        this.dataManager.saveToStorage();
    }

    /**
     * 获取应用状态
     * @returns {Object} 应用状态
     */
    getState() {
        return { ...this.state };
    }

    /**
     * 获取统计信息
     * @returns {Object} 统计信息
     */
    getStatistics() {
        return this.dataManager.getStatistics();
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    window.metroApp = new MetroTransferApp();
});

// 导出给全局使用
window.MetroTransferApp = MetroTransferApp;