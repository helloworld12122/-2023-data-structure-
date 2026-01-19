/**
 * 地铁地图渲染模块 - 完全修复版本
 * 解决路径高亮不完整的问题
 */
class MetroRenderer {
    constructor(svgElement, dataManager) {
        this.svg = svgElement;
        this.dataManager = dataManager;

        // 获取或创建SVG子元素组
        this.initSVGGroups();

        // 渲染配置
        this.config = {
            station: {
                radius: 8,
                strokeWidth: 3,
                hoverRadius: 12,
                selectedRadius: 10,
                colors: {
                    normal: '#333',
                    selected: '#FF3B30',
                    hover: '#007AFF'
                }
            },
            line: {
                strokeWidth: 8,
                hoverStrokeWidth: 10,
                highlightStrokeWidth: 12,
                opacity: {
                    normal: 1.0,
                    dimmed: 0.3,
                    highlighted: 1.0
                }
            },
            label: {
                fontSize: 11,
                fontFamily: 'Inter, sans-serif',
                fontWeight: '500',
                colors: {
                    normal: '#333',
                    highlighted: '#007AFF',
                    dimmed: '#999'
                },
                offset: {
                    top: [0, -15],
                    bottom: [0, 20],
                    left: [-10, 5],
                    right: [10, 5],
                    topleft: [-5, -10],
                    topright: [5, -10],
                    bottomleft: [-5, 15],
                    bottomright: [5, 15]
                }
            },
            legend: {
                startX: 30,
                startY: 1650,
                itemWidth: 110,
                itemHeight: 35,
                rectSize: 20,
                columns: 6,
                fontSize: 11
            },
            animation: {
                duration: 300,
                easing: 'ease-in-out'
            }
        };

        // 状态管理
        this.highlightedPath = null;
        this.selectedStations = new Set();
        this.visibleLines = new Set();
        this.hoveredElements = new Set();

        // 渲染缓存
        this.renderCache = {
            stations: new Map(),
            lines: new Map(),
            labels: new Map()
        };

        // 关键修复：完整的连接映射系统
        this.connectionMap = new Map(); // 连接对象 -> DOM元素的完整映射
        this.reverseConnectionMap = new Map(); // DOM元素 -> 连接对象的反向映射
        this.connectionRegistry = new Map(); // 所有可能的连接键 -> 连接信息

        // 当前路径状态
        this.state = {
            currentPath: null
        };

        // 调试模式
        this.debugMode = true;

        // 初始化
        this.init();
    }

    /**
     * 初始化渲染器
     */
    init() {
        // 设置SVG命名空间
        this.svgNS = 'http://www.w3.org/2000/svg';

        // 初始化所有线路为可见
        this.dataManager.getLines().forEach(line => {
            this.visibleLines.add(line.name);
        });

        // 创建SVG滤镜和效果
        this.createSVGFilters();

        // 设置默认视图
        this.setDefaultViewBox();

        this.debug('Metro渲染器初始化完成');
    }

    /**
     * 调试日志
     */
    debug(...args) {
        if (this.debugMode) {
            console.log('[MetroRenderer]', ...args);
        }
    }

    /**
     * 初始化或获取SVG分组元素
     */
    initSVGGroups() {
        // 创建主要的分组元素
        const groups = ['metro-lines', 'metro-stations', 'station-labels', 'metro-legend', 'svg-defs'];

        groups.forEach(groupId => {
            let group = this.svg.querySelector(`#${groupId}`);
            if (!group) {
                group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                group.id = groupId;
                this.svg.appendChild(group);
            }
        });

        // 分配组引用
        this.linesGroup = this.svg.querySelector('#metro-lines');
        this.stationsGroup = this.svg.querySelector('#metro-stations');
        this.labelsGroup = this.svg.querySelector('#station-labels');
        this.legendGroup = this.svg.querySelector('#metro-legend');
        this.defsGroup = this.svg.querySelector('#svg-defs');

        // 确保defs元素存在
        if (!this.svg.querySelector('defs')) {
            const defs = document.createElementNS(this.svgNS, 'defs');
            this.svg.insertBefore(defs, this.svg.firstChild);
            this.defsGroup = defs;
        }
    }

    /**
     * 创建SVG滤镜和效果
     */
    createSVGFilters() {
        const defs = this.defsGroup || this.svg.querySelector('defs') || this.createDefsElement();

        // 创建发光效果滤镜
        this.createGlowFilter(defs);

        // 创建阴影效果滤镜
        this.createShadowFilter(defs);

        // 创建脉冲动画
        this.createPulseAnimation(defs);
    }

    /**
     * 创建defs元素
     */
    createDefsElement() {
        const defs = document.createElementNS(this.svgNS, 'defs');
        this.svg.insertBefore(defs, this.svg.firstChild);
        return defs;
    }

    /**
     * 创建发光效果滤镜
     */
    createGlowFilter(defs) {
        const filter = document.createElementNS(this.svgNS, 'filter');
        filter.id = 'line-glow';
        filter.setAttribute('x', '-50%');
        filter.setAttribute('y', '-50%');
        filter.setAttribute('width', '200%');
        filter.setAttribute('height', '200%');

        const feGaussianBlur = document.createElementNS(this.svgNS, 'feGaussianBlur');
        feGaussianBlur.setAttribute('stdDeviation', '3');
        feGaussianBlur.setAttribute('result', 'coloredBlur');

        const feMerge = document.createElementNS(this.svgNS, 'feMerge');
        const feMergeNode1 = document.createElementNS(this.svgNS, 'feMergeNode');
        feMergeNode1.setAttribute('in', 'coloredBlur');
        const feMergeNode2 = document.createElementNS(this.svgNS, 'feMergeNode');
        feMergeNode2.setAttribute('in', 'SourceGraphic');

        feMerge.appendChild(feMergeNode1);
        feMerge.appendChild(feMergeNode2);
        filter.appendChild(feGaussianBlur);
        filter.appendChild(feMerge);
        defs.appendChild(filter);
    }

    /**
     * 创建阴影效果滤镜
     */
    createShadowFilter(defs) {
        const filter = document.createElementNS(this.svgNS, 'filter');
        filter.id = 'station-shadow';
        filter.setAttribute('x', '-50%');
        filter.setAttribute('y', '-50%');
        filter.setAttribute('width', '200%');
        filter.setAttribute('height', '200%');

        const feDropShadow = document.createElementNS(this.svgNS, 'feDropShadow');
        feDropShadow.setAttribute('dx', '2');
        feDropShadow.setAttribute('dy', '2');
        feDropShadow.setAttribute('stdDeviation', '2');
        feDropShadow.setAttribute('flood-opacity', '0.3');

        filter.appendChild(feDropShadow);
        defs.appendChild(filter);
    }

    /**
     * 创建脉冲动画
     */
    createPulseAnimation(defs) {
        const animate = document.createElementNS(this.svgNS, 'animate');
        animate.id = 'pulse-animation';
        animate.setAttribute('attributeName', 'r');
        animate.setAttribute('values', '8;12;8');
        animate.setAttribute('dur', '1.5s');
        animate.setAttribute('repeatCount', 'indefinite');
        defs.appendChild(animate);
    }

    /**
     * 设置默认视图框
     */
    setDefaultViewBox() {
        this.svg.setAttribute('viewBox', '0 0 2000 2000');
        this.svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    }

    /**
     * 渲染完整的地铁地图
     */
    renderMap() {
        this.debug('开始渲染地铁地图...');

        // 清除现有内容
        this.clearAll();

        // 按顺序渲染各个组件
        this.renderLines();
        this.renderStations();
        this.renderLabels();
        this.renderLegend();

        // 优化视图
        this.optimizeView();

        this.debug('地铁地图渲染完成');

        // 触发渲染完成事件
        this.dispatchEvent('mapRendered', {
            stationCount: this.dataManager.getStations().length,
            lineCount: this.dataManager.getLines().length
        });
    }

    /**
     * 清除所有渲染内容
     */
    clearAll() {
        this.linesGroup.innerHTML = '';
        this.stationsGroup.innerHTML = '';
        this.labelsGroup.innerHTML = '';
        this.legendGroup.innerHTML = '';

        // 清除缓存
        this.renderCache.stations.clear();
        this.renderCache.lines.clear();
        this.renderCache.labels.clear();

        // 清除连接映射
        this.connectionMap.clear();
        this.reverseConnectionMap.clear();
        this.connectionRegistry.clear();

        // 重置状态
        this.selectedStations.clear();
        this.hoveredElements.clear();
        this.highlightedPath = null;
    }

    /**
     * 渲染地铁线路 - 完全重构版本
     */
    renderLines() {
        this.debug('开始渲染地铁线路...');

        const connections = this.dataManager.getConnections();
        const renderedConnections = new Set();

        this.debug(`总连接数: ${connections.length}`);

        connections.forEach((connection, index) => {
            // 避免重复渲染（因为连接是双向的）
            const connectionKey = this.getConnectionKey(connection.from, connection.to, connection.line);
            if (renderedConnections.has(connectionKey)) {
                return;
            }
            renderedConnections.add(connectionKey);

            // 检查线路是否可见
            if (!this.visibleLines.has(connection.line)) {
                return;
            }

            const element = this.renderLine(connection);
            if (element) {
                // 关键：建立完整的连接映射
                this.buildConnectionMapping(connection, element);
            }
        });

        this.debug(`渲染了 ${renderedConnections.size} 条线路连接`);
        this.debug(`连接映射大小: ${this.connectionMap.size}`);
        this.debug(`连接注册表大小: ${this.connectionRegistry.size}`);
    }

    /**
     * 建立连接映射 - 关键修复
     * @param {Object} connection 连接对象
     * @param {Element} element DOM元素
     */
    buildConnectionMapping(connection, element) {
        const { from, to, line } = connection;

        // 生成所有可能的连接键
        const keys = [
            `${from}-${to}-${line}`,
            `${to}-${from}-${line}`,
            this.getConnectionKey(from, to, line),
            // 额外的备用键
            `${from}|${to}|${line}`,
            `${to}|${from}|${line}`,
            `line:${line}:${from}:${to}`,
            `line:${line}:${to}:${from}`
        ];

        // 建立DOM元素到连接的映射
        this.connectionMap.set(element, {
            connection: connection,
            keys: keys
        });

        // 建立连接到DOM元素的反向映射
        this.reverseConnectionMap.set(connection, element);

        // 在连接注册表中注册所有键
        keys.forEach(key => {
            if (!this.connectionRegistry.has(key)) {
                this.connectionRegistry.set(key, []);
            }
            this.connectionRegistry.get(key).push({
                connection: connection,
                element: element,
                originalKey: key
            });
        });

        this.debug(`为连接 ${from}->${to}(${line}) 建立了 ${keys.length} 个映射键`);
    }

    /**
     * 渲染单条线路
     * @param {Object} connection 连接对象
     * @returns {Element} 创建的路径元素
     */
    renderLine(connection) {
        const fromStation = this.dataManager.getStation(connection.from);
        const toStation = this.dataManager.getStation(connection.to);
        const line = this.dataManager.getLine(connection.line);

        if (!fromStation || !toStation || !line) {
            this.debug(`无法渲染连接: ${connection.from} -> ${connection.to} (${connection.line})`);
            return null;
        }

        const path = document.createElementNS(this.svgNS, 'path');

        // 构建路径字符串
        let pathData = `M ${fromStation.graphPosition[0]} ${fromStation.graphPosition[1]}`;

        // 添加中间经过点
        if (connection.via && connection.via.length > 0) {
            connection.via.forEach(point => {
                pathData += ` L ${point[0]} ${point[1]}`;
            });
        }

        pathData += ` L ${toStation.graphPosition[0]} ${toStation.graphPosition[1]}`;

        // 设置路径属性
        path.setAttribute('d', pathData);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', line.color);
        path.setAttribute('stroke-width', this.config.line.strokeWidth);
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');
        path.setAttribute('opacity', this.config.line.opacity.normal);
        path.classList.add('metro-line');

        // 强制设置样式
        path.style.stroke = line.color;
        path.style.strokeWidth = this.config.line.strokeWidth + 'px';
        path.style.fill = 'none';
        path.style.opacity = this.config.line.opacity.normal;

        // 生成连接唯一键
        const connectionKey = this.getConnectionKey(connection.from, connection.to, connection.line);

        // 设置数据属性
        path.dataset.line = connection.line;
        path.dataset.from = connection.from;
        path.dataset.to = connection.to;
        path.dataset.connectionId = connectionKey;

        // 添加事件监听器
        this.addLineEventListeners(path, connection);

        // 缓存元素
        this.renderCache.lines.set(connectionKey, path);

        this.linesGroup.appendChild(path);

        return path;
    }

    /**
     * 为线路添加事件监听器
     * @param {Element} pathElement 路径元素
     * @param {Object} connection 连接对象
     */
    addLineEventListeners(pathElement, connection) {
        pathElement.addEventListener('mouseenter', (e) => {
            this.handleLineHover(e, connection, true);
        });

        pathElement.addEventListener('mouseleave', (e) => {
            this.handleLineHover(e, connection, false);
        });

        pathElement.addEventListener('click', (e) => {
            this.handleLineClick(e, connection);
        });
    }

    /**
     * 渲染地铁站点
     */
    renderStations() {
        this.debug('渲染地铁站点...');

        const stations = this.dataManager.getStations();

        stations.forEach(station => {
            this.renderStation(station);
        });
    }

    /**
     * 渲染单个站点
     * @param {Object} station 站点对象
     */
    renderStation(station) {
        const stationElement = this.createStationElement(station);

        if (!stationElement) {
            this.debug(`无法创建站点元素: ${station.name}`);
            return;
        }

        // 设置基本属性
        this.setStationAttributes(stationElement, station);

        // 添加工具提示
        this.addStationTooltip(stationElement, station);

        // 添加事件监听器
        this.addStationEventListeners(stationElement, station);

        // 缓存元素
        this.renderCache.stations.set(station.name, stationElement);

        this.stationsGroup.appendChild(stationElement);
    }

    /**
     * 创建站点元素（根据类型）
     * @param {Object} station 站点对象
     * @returns {Element} 站点SVG元素
     */
    createStationElement(station) {
        const { graphPosition, type } = station;
        const x = graphPosition[0];
        const y = graphPosition[1];
        const r = this.config.station.radius;

        switch (type) {
            case 'horizontal':
                return this.createEllipseStation(x, y, r * 1.5, r * 0.8);
            case 'vertical':
                return this.createEllipseStation(x, y, r * 0.8, r * 1.5);
            case 'diagonal':
                return this.createPolygonStation(x, y, r, 'diagonal');
            case 'backdiagonal':
                return this.createPolygonStation(x, y, r, 'backdiagonal');
            default:
                return this.createCircleStation(x, y, r);
        }
    }

    /**
     * 创建圆形站点
     * @param {number} x X坐标
     * @param {number} y Y坐标
     * @param {number} r 半径
     * @returns {Element} 圆形SVG元素
     */
    createCircleStation(x, y, r) {
        const circle = document.createElementNS(this.svgNS, 'circle');
        circle.setAttribute('cx', x);
        circle.setAttribute('cy', y);
        circle.setAttribute('r', r);
        return circle;
    }

    /**
     * 创建椭圆形站点
     * @param {number} x X坐标
     * @param {number} y Y坐标
     * @param {number} rx X轴半径
     * @param {number} ry Y轴半径
     * @returns {Element} 椭圆SVG元素
     */
    createEllipseStation(x, y, rx, ry) {
        const ellipse = document.createElementNS(this.svgNS, 'ellipse');
        ellipse.setAttribute('cx', x);
        ellipse.setAttribute('cy', y);
        ellipse.setAttribute('rx', rx);
        ellipse.setAttribute('ry', ry);
        return ellipse;
    }

    /**
     * 创建多边形站点
     * @param {number} x X坐标
     * @param {number} y Y坐标
     * @param {number} r 半径
     * @param {string} type 多边形类型
     * @returns {Element} 多边形SVG元素
     */
    createPolygonStation(x, y, r, type) {
        const polygon = document.createElementNS(this.svgNS, 'polygon');

        let points;
        const factor = 1.4;

        if (type === 'backdiagonal') {
            // 反对角线形状（菱形）
            points = `${x},${y-r*factor} ${x+r*factor},${y} ${x},${y+r*factor} ${x-r*factor},${y}`;
        } else {
            // 对角线形状（正方形旋转45度）
            points = `${x-r*factor},${y-r*factor} ${x+r*factor},${y-r*factor} ${x+r*factor},${y+r*factor} ${x-r*factor},${y+r*factor}`;
        }

        polygon.setAttribute('points', points);
        return polygon;
    }

    /**
     * 设置站点基本属性
     * @param {Element} element 站点元素
     * @param {Object} station 站点对象
     */
    setStationAttributes(element, station) {
        element.setAttribute('fill', 'white');
        element.setAttribute('stroke', this.config.station.colors.normal);
        element.setAttribute('stroke-width', this.config.station.strokeWidth);
        element.setAttribute('filter', 'url(#station-shadow)');
        element.classList.add('metro-station');

        // 设置数据属性
        element.dataset.station = station.name;
        element.dataset.type = station.type;
        element.dataset.stationId = station.id || station.name;
    }

    /**
     * 添加站点工具提示
     * @param {Element} element 站点元素
     * @param {Object} station 站点对象
     */
    addStationTooltip(element, station) {
        const title = document.createElementNS(this.svgNS, 'title');

        // 获取站点的线路信息
        const connections = this.dataManager.getStationConnections(station.name);
        const lines = [...new Set(connections.map(conn => conn.line))];

        const tooltipText = [
            station.name,
            `经度: ${station.realPosition[0].toFixed(6)}°`,
            `纬度: ${station.realPosition[1].toFixed(6)}°`,
            `线路: ${lines.join(', ')}`
        ].join('\n');

        title.textContent = tooltipText;
        element.appendChild(title);
    }

    /**
     * 为站点添加事件监听器
     * @param {Element} element 站点元素
     * @param {Object} station 站点对象
     */
    addStationEventListeners(element, station) {
        element.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleStationClick(e, station);
        });

        element.addEventListener('mouseenter', (e) => {
            this.handleStationHover(e, station, true);
        });

        element.addEventListener('mouseleave', (e) => {
            this.handleStationHover(e, station, false);
        });

        element.addEventListener('dblclick', (e) => {
            this.handleStationDoubleClick(e, station);
        });
    }

    /**
     * 渲染站点标签
     */
    renderLabels() {
        this.debug('渲染站点标签...');

        const stations = this.dataManager.getStations();

        stations.forEach(station => {
            this.renderStationLabel(station);
        });
    }

    /**
     * 渲染单个站点标签
     * @param {Object} station 站点对象
     */
    renderStationLabel(station) {
        const text = document.createElementNS(this.svgNS, 'text');

        // 计算标签位置
        const offset = this.config.label.offset[station.tag] || this.config.label.offset.top;
        const x = station.graphPosition[0] + offset[0];
        const y = station.graphPosition[1] + offset[1];

        // 设置文本属性
        text.setAttribute('x', x);
        text.setAttribute('y', y);
        text.setAttribute('font-family', this.config.label.fontFamily);
        text.setAttribute('font-size', this.config.label.fontSize);
        text.setAttribute('font-weight', this.config.label.fontWeight);
        text.setAttribute('fill', this.config.label.colors.normal);
        text.setAttribute('text-anchor', this.getTextAnchor(station.tag));
        text.setAttribute('dominant-baseline', this.getDominantBaseline(station.tag));
        text.classList.add('station-label');

        // 强制设置style颜色
        text.style.fill = this.config.label.colors.normal;

        // 处理站点名称（移除括号内容）
        const displayName = station.name.split('(')[0];
        text.textContent = displayName;

        // 设置数据属性
        text.dataset.station = station.name;
        text.dataset.labelId = `label-${station.name}`;

        // 添加点击事件（传递给站点）
        text.addEventListener('click', (e) => {
            e.stopPropagation();
            const stationElement = this.renderCache.stations.get(station.name);
            if (stationElement) {
                stationElement.dispatchEvent(new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true
                }));
            }
        });

        // 缓存标签元素
        this.renderCache.labels.set(station.name, text);

        this.labelsGroup.appendChild(text);
    }

    /**
     * 获取文本锚点
     * @param {string} tag 标签位置
     * @returns {string} 文本锚点值
     */
    getTextAnchor(tag) {
        if (tag.includes('left')) return 'end';
        if (tag.includes('right')) return 'start';
        return 'middle';
    }

    /**
     * 获取基线对齐
     * @param {string} tag 标签位置
     * @returns {string} 基线对齐值
     */
    getDominantBaseline(tag) {
        if (tag.includes('top')) return 'auto';
        if (tag.includes('bottom')) return 'hanging';
        return 'central';
    }

    /**
     * 渲染图例
     */
    renderLegend() {
        this.debug('渲染图例...');

        const lines = this.dataManager.getLines();
        const config = this.config.legend;

        lines.forEach((line, index) => {
            const row = Math.floor(index / config.columns);
            const col = index % config.columns;
            const x = config.startX + col * config.itemWidth;
            const y = config.startY + row * config.itemHeight;

            this.renderLegendItem(line, x, y);
        });

        // 初始化图例可见性
        this.updateLegendVisibility();
    }

    /**
     * 渲染单个图例项
     * @param {Object} line 线路对象
     * @param {number} x X坐标
     * @param {number} y Y坐标
     */
    renderLegendItem(line, x, y) {
        const group = document.createElementNS(this.svgNS, 'g');
        group.classList.add('legend-item');
        group.dataset.line = line.name;
        group.style.cursor = 'pointer';

        // 创建颜色矩形
        const rect = document.createElementNS(this.svgNS, 'rect');
        rect.setAttribute('x', x);
        rect.setAttribute('y', y);
        rect.setAttribute('width', this.config.legend.rectSize);
        rect.setAttribute('height', this.config.legend.rectSize);
        rect.setAttribute('fill', line.color);
        rect.setAttribute('stroke', '#ddd');
        rect.setAttribute('stroke-width', 1);
        rect.setAttribute('rx', 3);
        rect.classList.add('legend-rect');

        // 强制设置style颜色
        rect.style.fill = line.color;

        // 创建文本标签
        const text = document.createElementNS(this.svgNS, 'text');
        text.setAttribute('x', x + this.config.legend.rectSize + 6);
        text.setAttribute('y', y + this.config.legend.rectSize / 2);
        text.setAttribute('font-family', this.config.label.fontFamily);
        text.setAttribute('font-size', this.config.legend.fontSize);
        text.setAttribute('font-weight', '500');
        text.setAttribute('fill', '#333');
        text.setAttribute('dominant-baseline', 'central');
        text.classList.add('legend-text');
        text.textContent = line.name;

        // 强制设置style颜色
        text.style.fill = '#333';

        // 添加悬停效果
        group.addEventListener('mouseenter', () => {
            rect.setAttribute('stroke', line.color);
            rect.setAttribute('stroke-width', 2);
            text.setAttribute('fill', line.color);
            text.style.fill = line.color;
        });

        group.addEventListener('mouseleave', () => {
            rect.setAttribute('stroke', '#ddd');
            rect.setAttribute('stroke-width', 1);
            text.setAttribute('fill', '#333');
            text.style.fill = '#333';
        });

        // 添加点击事件
        group.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleLegendClick(e, line);
        });

        group.appendChild(rect);
        group.appendChild(text);
        this.legendGroup.appendChild(group);
    }

    /**
     * 高亮显示路径 - 完全重构的版本
     * @param {Array} path 路径连接数组
     */
    highlightPath(path) {
        this.debug('\n=== 开始路径高亮 (完全重构版本) ===');
        this.debug('输入路径:', path);

        this.clearPathHighlight();

        if (!path || path.length === 0) {
            this.debug('路径为空，跳过高亮');
            return;
        }

        this.highlightedPath = path;

        // 先将所有元素变暗
        this.dimAllElements();

        // 使用新的高亮策略
        const highlightResults = this.highlightPathConnections(path);

        // 高亮路径中的站点
        const stations = this.getPathStations(path);
        this.debug('路径中的站点:', stations);

        stations.forEach(stationName => {
            this.highlightStation(stationName);
        });

        // 输出结果统计
        this.debug(`高亮结果: ${highlightResults.successful}/${path.length} 个连接成功高亮`);

        if (highlightResults.failed.length > 0) {
            this.debug('失败的连接:', highlightResults.failed);
        }

        // 添加动画效果
        this.animatePathHighlight(path);

        // 触发路径高亮事件
        this.dispatchEvent('pathHighlighted', {
            path: path,
            stations: stations,
            highlightResults: highlightResults
        });

        this.debug('=== 路径高亮完成 ===\n');
    }

    /**
     * 高亮路径连接 - 新的策略
     * @param {Array} path 路径连接数组
     * @returns {Object} 高亮结果
     */
    highlightPathConnections(path) {
        const results = {
            successful: 0,
            failed: [],
            details: []
        };

        path.forEach((connection, index) => {
            this.debug(`\n处理连接 ${index + 1}/${path.length}:`);
            this.debug('连接对象:', connection);

            const success = this.highlightSingleConnection(connection);

            if (success) {
                results.successful++;
                results.details.push({
                    index: index,
                    connection: connection,
                    status: 'success'
                });
                this.debug(`✓ 连接 ${connection.from}->${connection.to}(${connection.line}) 高亮成功`);
            } else {
                results.failed.push(connection);
                results.details.push({
                    index: index,
                    connection: connection,
                    status: 'failed'
                });
                this.debug(`✗ 连接 ${connection.from}->${connection.to}(${connection.line}) 高亮失败`);
            }
        });

        return results;
    }

    /**
     * 高亮单个连接 - 多重策略
     * @param {Object} connection 连接对象
     * @returns {boolean} 是否成功高亮
     */
    highlightSingleConnection(connection) {
        const { from, to, line } = connection;

        // 策略1: 使用连接注册表查找
        const registryResults = this.findConnectionByRegistry(connection);
        if (registryResults.length > 0) {
            this.debug(`策略1成功: 通过注册表找到 ${registryResults.length} 个匹配`);
            registryResults.forEach(result => {
                this.applyConnectionHighlight(result.element);
            });
            return true;
        }

        // 策略2: 使用反向映射查找
        const reverseResult = this.reverseConnectionMap.get(connection);
        if (reverseResult) {
            this.debug('策略2成功: 通过反向映射找到匹配');
            this.applyConnectionHighlight(reverseResult);
            return true;
        }

        // 策略3: 精确DOM遍历
        const domResults = this.findConnectionByDOMTraversal(connection);
        if (domResults.length > 0) {
            this.debug(`策略3成功: 通过DOM遍历找到 ${domResults.length} 个匹配`);
            domResults.forEach(element => {
                this.applyConnectionHighlight(element);
            });
            return true;
        }

        // 策略4: 模糊匹配（最后resort）
        const fuzzyResults = this.findConnectionByFuzzyMatch(connection);
        if (fuzzyResults.length > 0) {
            this.debug(`策略4成功: 通过模糊匹配找到 ${fuzzyResults.length} 个匹配`);
            fuzzyResults.forEach(element => {
                this.applyConnectionHighlight(element);
            });
            return true;
        }

        this.debug('所有策略都失败了');
        this.debugConnectionFailure(connection);
        return false;
    }

    /**
     * 策略1: 通过连接注册表查找
     * @param {Object} connection 连接对象
     * @returns {Array} 找到的连接结果
     */
    findConnectionByRegistry(connection) {
        const { from, to, line } = connection;
        const results = [];

        // 生成查找键
        const searchKeys = [
            `${from}-${to}-${line}`,
            `${to}-${from}-${line}`,
            this.getConnectionKey(from, to, line),
            `${from}|${to}|${line}`,
            `${to}|${from}|${line}`,
            `line:${line}:${from}:${to}`,
            `line:${line}:${to}:${from}`
        ];

        this.debug('注册表查找键:', searchKeys);

        for (const key of searchKeys) {
            if (this.connectionRegistry.has(key)) {
                const registryEntries = this.connectionRegistry.get(key);
                this.debug(`键 "${key}" 找到 ${registryEntries.length} 个注册项`);
                results.push(...registryEntries);
            }
        }

        // 去重
        const uniqueResults = [];
        const seen = new Set();
        results.forEach(result => {
            if (!seen.has(result.element)) {
                seen.add(result.element);
                uniqueResults.push(result);
            }
        });

        return uniqueResults;
    }

    /**
     * 策略3: 精确DOM遍历
     * @param {Object} connection 连接对象
     * @returns {Array} 找到的元素
     */
    findConnectionByDOMTraversal(connection) {
        const { from, to, line } = connection;
        const results = [];

        const lines = this.linesGroup.querySelectorAll('.metro-line');
        this.debug(`DOM遍历: 检查 ${lines.length} 个线路元素`);

        lines.forEach((lineElement, index) => {
            const lineData = lineElement.dataset;

            // 多种匹配条件
            const conditions = [
                // 精确匹配
                lineData.from === from && lineData.to === to && lineData.line === line,
                // 反向匹配
                lineData.from === to && lineData.to === from && lineData.line === line,
                // connectionId匹配
                lineData.connectionId === this.getConnectionKey(from, to, line),
                // 其他可能的匹配
                lineData.connectionId === `${from}-${to}-${line}`,
                lineData.connectionId === `${to}-${from}-${line}`
            ];

            const isMatch = conditions.some(condition => condition);

            if (isMatch) {
                this.debug(`DOM匹配成功 [${index}]:`, {
                    element: lineData,
                    target: connection,
                    conditions: conditions.map((c, i) => ({ index: i, result: c })).filter(r => r.result)
                });
                results.push(lineElement);
            }
        });

        return results;
    }

    /**
     * 策略4: 模糊匹配
     * @param {Object} connection 连接对象
     * @returns {Array} 找到的元素
     */
    findConnectionByFuzzyMatch(connection) {
        const { from, to, line } = connection;
        const results = [];

        const lines = this.linesGroup.querySelectorAll('.metro-line');
        this.debug(`模糊匹配: 检查 ${lines.length} 个线路元素`);

        lines.forEach((lineElement, index) => {
            const lineData = lineElement.dataset;

            // 模糊匹配条件：只要线路相同，站点匹配（不考虑方向）
            const sameLineAndStations =
                lineData.line === line &&
                ((lineData.from === from && lineData.to === to) ||
                    (lineData.from === to && lineData.to === from));

            if (sameLineAndStations) {
                this.debug(`模糊匹配成功 [${index}]:`, lineData);
                results.push(lineElement);
            }
        });

        return results;
    }

    /**
     * 调试连接失败
     * @param {Object} connection 失败的连接
     */
    debugConnectionFailure(connection) {
        this.debug('\n=== 连接匹配失败调试 ===');
        this.debug('目标连接:', connection);

        this.debug('\n注册表中的所有键:');
        const registryKeys = Array.from(this.connectionRegistry.keys());
        registryKeys.forEach((key, index) => {
            this.debug(`  [${index}] ${key}`);
        });

        this.debug('\nDOM中的所有线路元素:');
        const allLines = this.linesGroup.querySelectorAll('.metro-line');
        allLines.forEach((lineEl, idx) => {
            this.debug(`  [${idx}] ${lineEl.dataset.from} -> ${lineEl.dataset.to} (${lineEl.dataset.line}) [ID: ${lineEl.dataset.connectionId}]`);
        });

        this.debug('\n反向映射表大小:', this.reverseConnectionMap.size);
        this.debug('连接映射表大小:', this.connectionMap.size);
        this.debug('=== 调试结束 ===\n');
    }

    /**
     * 应用连接高亮效果
     * @param {Element} element 线路元素
     */
    applyConnectionHighlight(element) {
        element.classList.add('path-highlight');
        element.style.strokeWidth = this.config.line.highlightStrokeWidth + 'px';
        element.style.opacity = this.config.line.opacity.highlighted;
        element.style.filter = 'url(#line-glow)';

        // 提高z-index
        element.style.zIndex = '10';
    }

    /**
     * 将所有元素变暗
     */
    dimAllElements() {
        // 变暗所有线路
        const lines = this.linesGroup.querySelectorAll('.metro-line');
        lines.forEach(line => {
            line.style.opacity = this.config.line.opacity.dimmed;
        });

        // 变暗所有站点
        const stations = this.stationsGroup.querySelectorAll('.metro-station');
        stations.forEach(station => {
            station.style.opacity = this.config.line.opacity.dimmed;
        });

        // 变暗所有标签
        const labels = this.labelsGroup.querySelectorAll('.station-label');
        labels.forEach(label => {
            label.setAttribute('fill', this.config.label.colors.dimmed);
            label.style.fill = this.config.label.colors.dimmed;
        });
    }

    /**
     * 高亮单个站点
     * @param {string} stationName 站点名称
     */
    highlightStation(stationName) {
        const stationElement = this.renderCache.stations.get(stationName);
        if (stationElement) {
            stationElement.classList.add('selected');
            stationElement.setAttribute('stroke', this.config.station.colors.selected);
            stationElement.style.opacity = this.config.line.opacity.highlighted;

            // 添加脉冲动画
            const pulseAnimation = stationElement.querySelector('animate') ||
                document.createElementNS(this.svgNS, 'animate');
            pulseAnimation.setAttribute('attributeName', this.getAnimationAttribute(stationElement));
            pulseAnimation.setAttribute('values', this.getAnimationValues(stationElement));
            pulseAnimation.setAttribute('dur', '1.5s');
            pulseAnimation.setAttribute('repeatCount', 'indefinite');

            if (!stationElement.contains(pulseAnimation)) {
                stationElement.appendChild(pulseAnimation);
            }
        }

        // 高亮标签
        const labelElement = this.renderCache.labels.get(stationName);
        if (labelElement) {
            labelElement.classList.add('highlight');
            labelElement.setAttribute('fill', this.config.label.colors.highlighted);
            labelElement.setAttribute('font-weight', '700');
            labelElement.style.opacity = this.config.line.opacity.highlighted;
            labelElement.style.fill = this.config.label.colors.highlighted;
        }
    }

    /**
     * 获取动画属性名
     * @param {Element} element 元素
     * @returns {string} 动画属性名
     */
    getAnimationAttribute(element) {
        if (element.tagName === 'circle') return 'r';
        if (element.tagName === 'ellipse') return 'rx';
        return 'transform';
    }

    /**
     * 获取动画值
     * @param {Element} element 元素
     * @returns {string} 动画值字符串
     */
    getAnimationValues(element) {
        if (element.tagName === 'circle') {
            const r = this.config.station.radius;
            return `${r};${r*1.5};${r}`;
        }
        if (element.tagName === 'ellipse') {
            const rx = parseFloat(element.getAttribute('rx'));
            return `${rx};${rx*1.2};${rx}`;
        }
        return 'scale(1);scale(1.2);scale(1)';
    }

    /**
     * 为路径添加动画效果
     * @param {Array} path 路径数组
     */
    animatePathHighlight(path) {
        // 延迟显示每个路径段，创建流动效果
        path.forEach((connection, index) => {
            setTimeout(() => {
                this.highlightSingleConnection(connection);
            }, index * 200);
        });
    }

    /**
     * 清除路径高亮
     */
    clearPathHighlight() {
        this.highlightedPath = null;

        // 恢复所有线路
        const highlightedLines = this.linesGroup.querySelectorAll('.path-highlight');
        highlightedLines.forEach(line => {
            line.classList.remove('path-highlight');
            line.style.strokeWidth = this.config.line.strokeWidth + 'px';
            line.style.opacity = this.config.line.opacity.normal;
            line.style.filter = 'none';
            line.style.zIndex = '';
        });

        // 恢复所有站点
        const selectedStations = this.stationsGroup.querySelectorAll('.selected');
        selectedStations.forEach(station => {
            station.classList.remove('selected');
            station.setAttribute('stroke', this.config.station.colors.normal);
            station.style.opacity = this.config.line.opacity.normal;

            // 移除动画
            const animation = station.querySelector('animate');
            if (animation) {
                animation.remove();
            }
        });

        // 恢复所有标签
        const highlightedLabels = this.labelsGroup.querySelectorAll('.highlight');
        highlightedLabels.forEach(label => {
            label.classList.remove('highlight');
            label.setAttribute('fill', this.config.label.colors.normal);
            label.setAttribute('font-weight', this.config.label.fontWeight);
            label.style.opacity = this.config.line.opacity.normal;
            label.style.fill = this.config.label.colors.normal;
        });

        // 恢复所有元素的正常透明度
        this.restoreAllElements();

        this.selectedStations.clear();

        // 触发清除高亮事件
        this.dispatchEvent('pathHighlightCleared');
    }

    /**
     * 恢复所有元素的正常状态
     */
    restoreAllElements() {
        // 恢复线路
        const lines = this.linesGroup.querySelectorAll('.metro-line');
        lines.forEach(line => {
            line.style.opacity = this.config.line.opacity.normal;
        });

        // 恢复站点
        const stations = this.stationsGroup.querySelectorAll('.metro-station');
        stations.forEach(station => {
            station.style.opacity = this.config.line.opacity.normal;
        });

        // 恢复标签
        const labels = this.labelsGroup.querySelectorAll('.station-label');
        labels.forEach(label => {
            label.setAttribute('fill', this.config.label.colors.normal);
            label.style.fill = this.config.label.colors.normal;
        });
    }

    /**
     * 显示路径结果
     * @param {Object} result 路径结果
     */
    displayPath(result) {
        this.state.currentPath = result;
        this.debug('\n=== 开始显示路径 ===');
        this.debug('传递给渲染器的路径:', result.path);

        // 在地图上高亮路径
        this.highlightPath(result.path);

        // 显示路径详情
        if (typeof this.displayRouteDetails === 'function') {
            this.displayRouteDetails(result.guide);
        }

        // 显示换乘指南对话框
        if (result.guide && result.guide.steps && result.guide.steps.length > 0) {
            if (typeof this.showRouteGuideDialog === 'function') {
                this.showRouteGuideDialog(result.guide);
            }
        }

        this.debug('=== 路径显示完成 ===\n');
    }

    /**
     * 切换线路可见性
     * @param {string} lineName 线路名称
     */
    toggleLineVisibility(lineName) {
        if (this.visibleLines.has(lineName)) {
            this.visibleLines.delete(lineName);
        } else {
            this.visibleLines.add(lineName);
        }

        // 重新渲染线路
        this.renderLines();
        this.updateLegendVisibility();

        // 触发可见性变化事件
        this.dispatchEvent('lineVisibilityChanged', {
            line: lineName,
            visible: this.visibleLines.has(lineName)
        });
    }

    /**
     * 更新图例可见性显示
     */
    updateLegendVisibility() {
        const legendItems = this.legendGroup.querySelectorAll('.legend-item');
        legendItems.forEach(item => {
            const lineName = item.dataset.line;
            const rect = item.querySelector('.legend-rect');
            const text = item.querySelector('.legend-text');

            if (this.visibleLines.has(lineName)) {
                rect.style.opacity = '1';
                text.style.opacity = '1';
                item.style.opacity = '1';
            } else {
                rect.style.opacity = '0.3';
                text.style.opacity = '0.3';
                item.style.opacity = '0.5';
            }
        });
    }

    /**
     * 优化视图
     */
    optimizeView() {
        // 可以在这里添加性能优化逻辑
    }

    /**
     * 获取路径中的所有站点
     * @param {Array} path 路径连接数组
     * @returns {Array} 站点名称数组
     */
    getPathStations(path) {
        if (!path || path.length === 0) {
            return [];
        }

        const stations = [path[0].from];
        path.forEach(connection => {
            stations.push(connection.to);
        });

        return stations;
    }

    /**
     * 获取连接的唯一键
     * @param {string} from 起始站点
     * @param {string} to 目标站点
     * @param {string} line 线路名称
     * @returns {string} 唯一键
     */
    getConnectionKey(from, to, line) {
        // 确保键的唯一性，不受方向影响
        const stations = [from, to].sort();
        return `${stations[0]}-${stations[1]}-${line}`;
    }

    // 事件处理器

    /**
     * 处理线路悬停事件
     * @param {Event} event 事件对象
     * @param {Object} connection 连接对象
     * @param {boolean} isEnter 是否进入
     */
    handleLineHover(event, connection, isEnter) {
        const line = event.target;

        if (isEnter) {
            if (!line.classList.contains('path-highlight')) {
                line.style.strokeWidth = this.config.line.hoverStrokeWidth + 'px';
            }
            this.hoveredElements.add(line);
        } else {
            if (!line.classList.contains('path-highlight')) {
                line.style.strokeWidth = this.config.line.strokeWidth + 'px';
            }
            this.hoveredElements.delete(line);
        }
    }

    /**
     * 处理线路点击事件
     * @param {Event} event 事件对象
     * @param {Object} connection 连接对象
     */
    handleLineClick(event, connection) {
        // 触发线路点击事件
        this.dispatchEvent('lineClick', {
            connection: connection,
            element: event.target
        });
    }

    /**
     * 处理站点悬停事件
     * @param {Event} event 事件对象
     * @param {Object} station 站点对象
     * @param {boolean} isEnter 是否进入
     */
    handleStationHover(event, station, isEnter) {
        const element = event.target;

        if (isEnter) {
            if (!element.classList.contains('selected')) {
                element.setAttribute('stroke', this.config.station.colors.hover);
                this.scaleStationElement(element, 1.2);
            }
            this.hoveredElements.add(element);
        } else {
            if (!element.classList.contains('selected')) {
                element.setAttribute('stroke', this.config.station.colors.normal);
                this.scaleStationElement(element, 1.0);
            }
            this.hoveredElements.delete(element);
        }
    }

    /**
     * 缩放站点元素
     * @param {Element} element 站点元素
     * @param {number} scale 缩放比例
     */
    scaleStationElement(element, scale) {
        if (element.tagName === 'circle') {
            const originalR = this.config.station.radius;
            element.setAttribute('r', originalR * scale);
        } else if (element.tagName === 'ellipse') {
            const originalRx = parseFloat(element.getAttribute('rx')) / (element.currentScale || 1);
            const originalRy = parseFloat(element.getAttribute('ry')) / (element.currentScale || 1);
            element.setAttribute('rx', originalRx * scale);
            element.setAttribute('ry', originalRy * scale);
            element.currentScale = scale;
        }
    }

    /**
     * 处理站点点击事件
     * @param {Event} event 事件对象
     * @param {Object} station 站点对象
     */
    handleStationClick(event, station) {
        // 触发站点点击事件
        this.dispatchEvent('stationClick', {
            station: station,
            element: event.target
        });
    }

    /**
     * 处理站点双击事件
     * @param {Event} event 事件对象
     * @param {Object} station 站点对象
     */
    handleStationDoubleClick(event, station) {
        // 触发站点双击事件
        this.dispatchEvent('stationDoubleClick', {
            station: station,
            element: event.target
        });
    }

    /**
     * 处理图例点击事件
     * @param {Event} event 事件对象
     * @param {Object} line 线路对象
     */
    handleLegendClick(event, line) {
        this.toggleLineVisibility(line.name);
    }

    /**
     * 触发自定义事件
     * @param {string} eventName 事件名称
     * @param {Object} detail 事件详情
     */
    dispatchEvent(eventName, detail = {}) {
        const customEvent = new CustomEvent(eventName, {
            detail: detail,
            bubbles: true,
            cancelable: true
        });
        this.svg.dispatchEvent(customEvent);
    }

    /**
     * 获取当前高亮的路径
     * @returns {Array} 高亮的路径
     */
    getHighlightedPath() {
        return this.highlightedPath;
    }

    /**
     * 获取可见线路列表
     * @returns {Set} 可见线路集合
     */
    getVisibleLines() {
        return new Set(this.visibleLines);
    }

    /**
     * 获取选中的站点列表
     * @returns {Set} 选中站点集合
     */
    getSelectedStations() {
        return new Set(this.selectedStations);
    }

    /**
     * 获取当前路径状态
     * @returns {Object} 当前路径状态
     */
    getCurrentPath() {
        return this.state.currentPath;
    }

    /**
     * 销毁渲染器
     */
    destroy() {
        // 清除所有内容
        this.clearAll();

        // 清除事件监听器
        this.hoveredElements.clear();
        this.selectedStations.clear();

        // 清除引用
        this.svg = null;
        this.dataManager = null;
        this.highlightedPath = null;
        this.state.currentPath = null;

        this.debug('Metro渲染器已销毁');
    }
}

// 导出渲染器类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MetroRenderer;
} else if (typeof window !== 'undefined') {
    window.MetroRenderer = MetroRenderer;
}