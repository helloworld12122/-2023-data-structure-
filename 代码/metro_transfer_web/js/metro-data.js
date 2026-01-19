/**
 * 地铁数据管理模块 - 完整修复版本
 * 确保连接数据的一致性和完整性，解决路径高亮不完整问题
 */
class MetroDataManager {
    constructor() {
        this.lines = new Map();
        this.stations = new Map();
        this.connections = new Map();
        this.storageKey = 'shanghai-metro-data';
        this.isLoaded = false;
        this.dataSource = 'unknown';
        this.debugMode = true; // 开启调试模式
    }

    /**
     * 调试日志
     */
    debug(...args) {
        if (this.debugMode) {
            console.log('[MetroDataManager]', ...args);
        }
    }

    /**
     * 初始化数据管理器
     */
    async init() {
        try {
            this.debug('正在初始化数据管理器...');

            // 尝试从本地存储加载数据
            const savedData = this.loadFromStorage();
            if (savedData && this.isValidData(savedData)) {
                this.loadData(savedData);
                this.dataSource = 'localStorage';
                this.debug('从本地存储加载数据成功');
            } else {
                // 从JSON文件加载默认数据
                await this.loadDefaultData();
            }

            this.isLoaded = true;
            this.debug(`数据初始化完成: ${this.lines.size} 条线路, ${this.stations.size} 个站点, ${this.connections.size} 个连接`);

            // 验证数据完整性
            this.validateDataIntegrity();

        } catch (error) {
            console.error('数据初始化失败:', error);
            // 加载完整的内置数据集
            this.loadCompleteBuiltinData();
            this.dataSource = 'builtin-complete';
            this.isLoaded = true;
        }
    }

    /**
     * 验证数据完整性
     */
    validateDataIntegrity() {
        this.debug('\n--- 验证数据完整性 ---');

        let validConnections = 0;
        let invalidConnections = 0;
        const missingStations = new Set();
        const missingLines = new Set();

        // 检查每个连接的站点和线路是否存在
        for (const [connectionId, connection] of this.connections) {
            const { from, to, line } = connection;

            if (!this.stations.has(from)) {
                missingStations.add(from);
                invalidConnections++;
            }

            if (!this.stations.has(to)) {
                missingStations.add(to);
                invalidConnections++;
            }

            if (!this.lines.has(line)) {
                missingLines.add(line);
                invalidConnections++;
            }

            if (this.stations.has(from) && this.stations.has(to) && this.lines.has(line)) {
                validConnections++;
            }
        }

        this.debug(`有效连接: ${validConnections}`);
        this.debug(`无效连接: ${invalidConnections}`);

        if (missingStations.size > 0) {
            this.debug('缺失的站点:', Array.from(missingStations));
        }

        if (missingLines.size > 0) {
            this.debug('缺失的线路:', Array.from(missingLines));
        }

        this.debug('--- 数据完整性验证完成 ---\n');
    }

    /**
     * 验证数据格式是否有效
     */
    isValidData(data) {
        return data &&
            data.lines && Array.isArray(data.lines) && data.lines.length > 0 &&
            data.stations && Array.isArray(data.stations) && data.stations.length > 0;
    }

    /**
     * 从JSON文件加载默认数据
     */
    async loadDefaultData() {
        try {
            this.debug('尝试从JSON文件加载数据...');
            const response = await fetch('./data/metro-data.json');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: 无法加载数据文件`);
            }
            const data = await response.json();

            if (!this.isValidData(data)) {
                throw new Error('JSON数据格式无效');
            }

            this.loadData(data);
            this.dataSource = 'json-file';
            this.debug('从JSON文件加载数据成功');
        } catch (error) {
            console.warn('无法从文件加载数据，使用完整内置数据:', error.message);
            this.loadCompleteBuiltinData();
            this.dataSource = 'builtin-fallback';
        }
    }

    /**
     * 加载完整的内置数据
     */
    loadCompleteBuiltinData() {
        this.debug('加载完整的内置数据集...');

        const completeData = {
            lines: [
                { name: "1号线", color: [230, 0, 43] },
                { name: "2号线", color: [140, 194, 32] },
                { name: "3号线", color: [251, 214, 0] },
                { name: "4号线", color: [69, 29, 132] },
                { name: "5号线", color: [148, 76, 154] },
                { name: "6号线", color: [211, 0, 104] },
                { name: "7号线", color: [237, 110, 0] },
                { name: "8号线", color: [0, 148, 217] },
                { name: "9号线", color: [135, 201, 236] },
                { name: "10号线", color: [198, 175, 211] }
            ],
            stations: [
                // 1号线站点
                {
                    name: "富锦路",
                    tag: "top",
                    type: "normal",
                    "graph-position": [1050, 650],
                    "real-position": [121.363189, 31.354388],
                    edges: [{ to: "友谊西路", line: "1号线" }]
                },
                {
                    name: "友谊西路",
                    tag: "bottom",
                    type: "normal",
                    "graph-position": [1050, 700],
                    "real-position": [121.363189, 31.324388],
                    edges: [
                        { to: "富锦路", line: "1号线" },
                        { to: "宝安公路", line: "1号线" }
                    ]
                },
                {
                    name: "宝安公路",
                    tag: "top",
                    type: "normal",
                    "graph-position": [1050, 750],
                    "real-position": [121.363189, 31.294388],
                    edges: [
                        { to: "友谊西路", line: "1号线" },
                        { to: "共富新村", line: "1号线" }
                    ]
                },
                {
                    name: "共富新村",
                    tag: "bottom",
                    type: "normal",
                    "graph-position": [1050, 800],
                    "real-position": [121.363189, 31.264388],
                    edges: [
                        { to: "宝安公路", line: "1号线" },
                        { to: "呼兰路", line: "1号线" }
                    ]
                },
                {
                    name: "呼兰路",
                    tag: "right",
                    type: "normal",
                    "graph-position": [1050, 850],
                    "real-position": [121.363189, 31.234388],
                    edges: [
                        { to: "共富新村", line: "1号线" },
                        { to: "人民广场", line: "1号线" }
                    ]
                },
                {
                    name: "人民广场",
                    tag: "bottom",
                    type: "horizontal",
                    "graph-position": [1050, 900],
                    "real-position": [121.472989, 31.232814],
                    edges: [
                        { to: "呼兰路", line: "1号线" },
                        { to: "黄陂南路", line: "1号线" },
                        { to: "南京东路", line: "2号线" },
                        { to: "南京西路", line: "2号线" }
                    ]
                },
                {
                    name: "黄陂南路",
                    tag: "left",
                    type: "normal",
                    "graph-position": [1050, 950],
                    "real-position": [121.472989, 31.202814],
                    edges: [
                        { to: "人民广场", line: "1号线" },
                        { to: "陕西南路", line: "1号线" }
                    ]
                },
                {
                    name: "陕西南路",
                    tag: "right",
                    type: "normal",
                    "graph-position": [1050, 1000],
                    "real-position": [121.472989, 31.172814],
                    edges: [
                        { to: "黄陂南路", line: "1号线" },
                        { to: "徐家汇", line: "1号线" }
                    ]
                },
                {
                    name: "徐家汇",
                    tag: "bottom",
                    type: "diagonal",
                    "graph-position": [1050, 1050],
                    "real-position": [121.436987, 31.188523],
                    edges: [
                        { to: "陕西南路", line: "1号线" },
                        { to: "衡山路", line: "1号线" }
                    ]
                },
                {
                    name: "衡山路",
                    tag: "left",
                    type: "normal",
                    "graph-position": [1050, 1100],
                    "real-position": [121.436987, 31.158523],
                    edges: [
                        { to: "徐家汇", line: "1号线" },
                        { to: "莘庄", line: "1号线" }
                    ]
                },
                {
                    name: "莘庄",
                    tag: "bottom",
                    type: "normal",
                    "graph-position": [1050, 1150],
                    "real-position": [121.385064, 31.111658],
                    edges: [
                        { to: "衡山路", line: "1号线" }
                    ]
                },

                // 2号线站点
                {
                    name: "南京西路",
                    tag: "top",
                    type: "horizontal",
                    "graph-position": [950, 900],
                    "real-position": [121.445137, 31.232781],
                    edges: [
                        { to: "人民广场", line: "2号线" },
                        { to: "静安寺", line: "2号线" }
                    ]
                },
                {
                    name: "静安寺",
                    tag: "top",
                    type: "horizontal",
                    "graph-position": [850, 900],
                    "real-position": [121.415137, 31.232781],
                    edges: [
                        { to: "南京西路", line: "2号线" },
                        { to: "江苏路", line: "2号线" }
                    ]
                },
                {
                    name: "江苏路",
                    tag: "bottom",
                    type: "horizontal",
                    "graph-position": [750, 900],
                    "real-position": [121.385137, 31.232781],
                    edges: [
                        { to: "静安寺", line: "2号线" },
                        { to: "虹桥机场", line: "2号线" }
                    ]
                },
                {
                    name: "虹桥机场",
                    tag: "bottom",
                    type: "horizontal",
                    "graph-position": [650, 900],
                    "real-position": [121.355137, 31.232781],
                    edges: [
                        { to: "江苏路", line: "2号线" }
                    ]
                },
                {
                    name: "南京东路",
                    tag: "top",
                    type: "horizontal",
                    "graph-position": [1150, 900],
                    "real-position": [121.505137, 31.232781],
                    edges: [
                        { to: "人民广场", line: "2号线" },
                        { to: "陆家嘴", line: "2号线" }
                    ]
                },
                {
                    name: "陆家嘴",
                    tag: "top",
                    type: "horizontal",
                    "graph-position": [1250, 900],
                    "real-position": [121.535137, 31.232781],
                    edges: [
                        { to: "南京东路", line: "2号线" },
                        { to: "东昌路", line: "2号线" }
                    ]
                },
                {
                    name: "东昌路",
                    tag: "bottom",
                    type: "horizontal",
                    "graph-position": [1350, 900],
                    "real-position": [121.565137, 31.232781],
                    edges: [
                        { to: "陆家嘴", line: "2号线" },
                        { to: "世纪大道", line: "2号线" }
                    ]
                },
                {
                    name: "世纪大道",
                    tag: "top",
                    type: "diagonal",
                    "graph-position": [1400, 900],
                    "real-position": [121.595137, 31.232781],
                    edges: [
                        { to: "东昌路", line: "2号线" }
                    ]
                },

                // 3号线站点
                {
                    name: "上海南站",
                    tag: "bottom",
                    type: "vertical",
                    "graph-position": [1000, 1200],
                    "real-position": [121.426987, 31.158523],
                    edges: [
                        { to: "石龙路", line: "3号线" }
                    ]
                },
                {
                    name: "石龙路",
                    tag: "left",
                    type: "vertical",
                    "graph-position": [1000, 1100],
                    "real-position": [121.426987, 31.188523],
                    edges: [
                        { to: "上海南站", line: "3号线" },
                        { to: "龙漕路", line: "3号线" }
                    ]
                },
                {
                    name: "龙漕路",
                    tag: "right",
                    type: "vertical",
                    "graph-position": [1000, 1000],
                    "real-position": [121.426987, 31.218523],
                    edges: [
                        { to: "石龙路", line: "3号线" },
                        { to: "漕溪路", line: "3号线" }
                    ]
                },
                {
                    name: "漕溪路",
                    tag: "left",
                    type: "vertical",
                    "graph-position": [1000, 900],
                    "real-position": [121.426987, 31.248523],
                    edges: [
                        { to: "龙漕路", line: "3号线" },
                        { to: "宜山路", line: "3号线" }
                    ]
                },
                {
                    name: "宜山路",
                    tag: "right",
                    type: "vertical",
                    "graph-position": [1000, 800],
                    "real-position": [121.426987, 31.278523],
                    edges: [
                        { to: "漕溪路", line: "3号线" }
                    ]
                }
            ]
        };

        this.loadData(completeData);
        this.debug('完整内置数据加载完成');
    }

    /**
     * 从数据对象加载数据
     */
    loadData(data) {
        this.debug('开始加载数据...', {
            lines: data.lines?.length || 0,
            stations: data.stations?.length || 0
        });

        // 清除现有数据
        this.lines.clear();
        this.stations.clear();
        this.connections.clear();

        // 首先加载所有线路数据
        if (data.lines) {
            data.lines.forEach((line) => {
                const color = this.convertColorToCSS(line.color);
                this.addLine(line.name, color);
            });
        }

        // 然后加载所有站点数据
        if (data.stations) {
            data.stations.forEach((station) => {
                this.addStation(
                    station.name,
                    station["graph-position"] || [0, 0],
                    station["real-position"] || [0, 0],
                    station.type || "normal",
                    station.tag || "top"
                );
            });
        }

        // 最后加载连接数据 - 关键修复
        if (data.stations) {
            let connectionCount = 0;
            data.stations.forEach(station => {
                if (station.edges) {
                    station.edges.forEach(edge => {
                        const success = this.addConnection(station.name, edge.to, edge.line, edge.via || []);
                        if (success) {
                            connectionCount++;
                        }
                    });
                }
            });
            this.debug(`成功添加 ${connectionCount} 个连接`);
        }

        const finalStats = {
            lines: this.lines.size,
            stations: this.stations.size,
            connections: this.connections.size
        };

        this.debug(`数据加载完成:`, finalStats);
    }

    /**
     * 转换颜色到CSS格式
     */
    convertColorToCSS(color) {
        if (!color) {
            return '#666666';
        }

        // 如果已经是CSS颜色字符串
        if (typeof color === 'string') {
            if (color.startsWith('#') || color.startsWith('rgb') || color.startsWith('hsl')) {
                return color;
            }
        }

        // 如果是RGB数组
        if (Array.isArray(color) && color.length >= 3) {
            const r = Math.max(0, Math.min(255, Math.floor(color[0])));
            const g = Math.max(0, Math.min(255, Math.floor(color[1])));
            const b = Math.max(0, Math.min(255, Math.floor(color[2])));
            return `rgb(${r}, ${g}, ${b})`;
        }

        // 如果是RGB对象
        if (typeof color === 'object' && color.r !== undefined) {
            const r = Math.max(0, Math.min(255, Math.floor(color.r)));
            const g = Math.max(0, Math.min(255, Math.floor(color.g)));
            const b = Math.max(0, Math.min(255, Math.floor(color.b)));
            return `rgb(${r}, ${g}, ${b})`;
        }

        return '#666666';
    }

    /**
     * 添加线路
     */
    addLine(name, color) {
        if (!name || typeof name !== 'string') {
            console.error('线路名称无效:', name);
            return false;
        }

        if (this.lines.has(name)) {
            return false;
        }

        const normalizedColor = this.convertColorToCSS(color);

        const line = {
            name: name,
            color: normalizedColor,
            id: this.generateId('line')
        };

        this.lines.set(name, line);
        this.debug(`添加线路: ${name} (${normalizedColor})`);
        return true;
    }

    /**
     * 添加连接 - 关键修复版本
     */
    addConnection(from, to, line, via = []) {
        if (!from || !to || !line) {
            console.error('连接参数无效:', { from, to, line });
            return false;
        }

        // 检查站点是否存在
        if (!this.stations.has(from)) {
            console.error(`起始站点不存在: ${from}`);
            return false;
        }

        if (!this.stations.has(to)) {
            console.error(`目标站点不存在: ${to}`);
            return false;
        }

        // 检查线路是否存在
        if (!this.lines.has(line)) {
            console.error(`线路不存在: ${line}`);
            return false;
        }

        // 生成连接ID - 使用标准化格式
        const connectionId = this.generateConnectionId(from, to, line);
        const reverseConnectionId = this.generateConnectionId(to, from, line);

        // 检查连接是否已存在
        if (this.connections.has(connectionId)) {
            return false;
        }

        // 创建正向连接
        const connection = {
            from: from,
            to: to,
            line: line,
            via: via || [],
            id: connectionId
        };

        // 创建反向连接
        const reverseConnection = {
            from: to,
            to: from,
            line: line,
            via: via ? [...via].reverse() : [],
            id: reverseConnectionId
        };

        // 添加到连接映射
        this.connections.set(connectionId, connection);
        this.connections.set(reverseConnectionId, reverseConnection);

        this.debug(`添加连接: ${from} <-> ${to} (${line})`);
        return true;
    }

    /**
     * 生成标准化的连接ID
     * @param {string} from 起始站点
     * @param {string} to 目标站点
     * @param {string} line 线路名称
     * @returns {string} 连接ID
     */
    generateConnectionId(from, to, line) {
        return `${from}-${to}-${line}`;
    }

    /**
     * 获取连接 - 增强版本
     * @param {string} from 起始站点
     * @param {string} to 目标站点
     * @param {string} line 线路名称
     * @returns {Object|null} 连接对象
     */
    getConnection(from, to, line) {
        // 首先尝试直接匹配
        const directId = this.generateConnectionId(from, to, line);
        let connection = this.connections.get(directId);

        if (connection) {
            this.debug(`直接找到连接: ${directId}`);
            return connection;
        }

        // 尝试其他可能的格式
        const alternativeIds = [
            `${from}-${to}-${line}`,
            `${to}-${from}-${line}`,
            this.getConnectionKey(from, to, line)
        ];

        for (const id of alternativeIds) {
            connection = this.connections.get(id);
            if (connection) {
                this.debug(`通过备用ID找到连接: ${id}`);
                return connection;
            }
        }

        this.debug(`未找到连接: ${from} -> ${to} (${line})`);
        return null;
    }

    /**
     * 获取连接键 - 与渲染器保持一致
     * @param {string} from 起始站点
     * @param {string} to 目标站点
     * @param {string} line 线路名称
     * @returns {string} 连接键
     */
    getConnectionKey(from, to, line) {
        // 确保与渲染器使用相同的键生成逻辑
        const stations = [from, to].sort();
        return `${stations[0]}-${stations[1]}-${line}`;
    }

    /**
     * 从本地存储加载数据
     */
    loadFromStorage() {
        try {
            const data = localStorage.getItem(this.storageKey);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.warn('从本地存储加载数据失败:', error);
            return null;
        }
    }

    /**
     * 保存数据到本地存储
     */
    saveToStorage() {
        try {
            const data = this.exportData();
            localStorage.setItem(this.storageKey, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('保存数据到本地存储失败:', error);
            return false;
        }
    }

    /**
     * 导出数据
     */
    exportData() {
        const data = {
            lines: Array.from(this.lines.values()).map(line => ({
                name: line.name,
                color: this.cssToRgbArray(line.color)
            })),
            stations: Array.from(this.stations.values()).map(station => ({
                name: station.name,
                tag: station.tag,
                type: station.type,
                "graph-position": station.graphPosition,
                "real-position": station.realPosition,
                edges: this.getStationConnections(station.name).map(conn => ({
                    to: conn.to,
                    line: conn.line,
                    via: conn.via || []
                }))
            }))
        };
        return data;
    }

    /**
     * 将CSS颜色转换为RGB数组
     */
    cssToRgbArray(cssColor) {
        if (cssColor.startsWith('rgb(')) {
            const match = cssColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
            if (match) {
                return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
            }
        }

        if (cssColor.startsWith('#')) {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(cssColor);
            return result ? [
                parseInt(result[1], 16),
                parseInt(result[2], 16),
                parseInt(result[3], 16)
            ] : [0, 0, 0];
        }

        return [0, 0, 0];
    }

    /**
     * 添加站点
     */
    addStation(name, graphPosition, realPosition, type = 'normal', tag = 'top') {
        if (this.stations.has(name)) {
            return false;
        }

        const station = {
            name: name,
            graphPosition: graphPosition,
            realPosition: realPosition,
            type: type,
            tag: tag,
            id: this.generateId('station')
        };

        this.stations.set(name, station);
        this.debug(`添加站点: ${name} (${type})`);
        return true;
    }

    /**
     * 获取所有线路
     */
    getLines() {
        return Array.from(this.lines.values());
    }

    /**
     * 获取所有站点
     */
    getStations() {
        return Array.from(this.stations.values());
    }

    /**
     * 获取所有连接
     */
    getConnections() {
        return Array.from(this.connections.values());
    }

    /**
     * 获取指定线路
     */
    getLine(name) {
        return this.lines.get(name);
    }

    /**
     * 获取指定站点
     */
    getStation(name) {
        return this.stations.get(name);
    }

    /**
     * 获取站点连接 - 增强版本
     * @param {string} stationName 站点名称
     * @returns {Array} 连接数组
     */
    getStationConnections(stationName) {
        const connections = Array.from(this.connections.values())
            .filter(conn => conn.from === stationName);

        this.debug(`站点 ${stationName} 有 ${connections.length} 个连接`);
        return connections;
    }

    /**
     * 检查站点是否存在
     */
    hasStation(name) {
        return this.stations.has(name);
    }

    /**
     * 检查线路是否存在
     */
    hasLine(name) {
        return this.lines.has(name);
    }

    /**
     * 获取所有站点名称
     */
    getStationNames() {
        return Array.from(this.stations.keys()).sort();
    }

    /**
     * 获取所有线路名称
     */
    getLineNames() {
        return Array.from(this.lines.keys()).sort();
    }

    /**
     * 搜索站点
     */
    searchStations(query) {
        if (!query) return [];
        const lowerQuery = query.toLowerCase();
        return this.getStationNames().filter(name =>
            name.toLowerCase().includes(lowerQuery)
        );
    }

    /**
     * 计算距离
     */
    calculateDistance(pos1, pos2) {
        const dx = pos1[0] - pos2[0];
        const dy = pos1[1] - pos2[1];
        return Math.sqrt(dx * dx + dy * dy) * 111;
    }

    /**
     * 生成唯一ID
     */
    generateId(prefix = '') {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * 获取统计信息
     */
    getStatistics() {
        return {
            lineCount: this.lines.size,
            stationCount: this.stations.size,
            connectionCount: this.connections.size / 2, // 除以2因为每个连接都有双向
            dataSource: this.dataSource,
            averageStationsPerLine: this.getLineNames().map(line =>
                this.getStationsOnLine(line).length
            ).reduce((a, b) => a + b, 0) / this.lines.size || 0
        };
    }

    /**
     * 获取线路上的所有站点
     */
    getStationsOnLine(lineName) {
        const stations = new Set();
        Array.from(this.connections.values())
            .filter(conn => conn.line === lineName)
            .forEach(conn => {
                stations.add(conn.from);
                stations.add(conn.to);
            });
        return Array.from(stations);
    }

    /**
     * 获取所有可能的连接ID - 用于调试
     * @returns {Array} 所有连接ID
     */
    getAllConnectionIds() {
        return Array.from(this.connections.keys());
    }

    /**
     * 调试连接状态
     */
    debugConnections() {
        this.debug('\n=== 连接调试信息 ===');
        this.debug(`总连接数: ${this.connections.size}`);

        const connectionsByLine = new Map();
        for (const [id, connection] of this.connections) {
            if (!connectionsByLine.has(connection.line)) {
                connectionsByLine.set(connection.line, []);
            }
            connectionsByLine.get(connection.line).push(connection);
        }

        for (const [line, connections] of connectionsByLine) {
            this.debug(`${line}: ${connections.length} 个连接`);
            connections.slice(0, 3).forEach(conn => {
                this.debug(`  ${conn.from} -> ${conn.to} [${conn.id}]`);
            });
            if (connections.length > 3) {
                this.debug(`  ... 还有 ${connections.length - 3} 个`);
            }
        }

        this.debug('=== 连接调试信息结束 ===\n');
    }

    /**
     * 验证连接的双向性
     */
    validateBidirectionalConnections() {
        this.debug('\n--- 验证连接双向性 ---');

        let bidirectionalCount = 0;
        let unidirectionalCount = 0;
        const processed = new Set();

        for (const [id, connection] of this.connections) {
            if (processed.has(id)) continue;

            const { from, to, line } = connection;
            const reverseId = this.generateConnectionId(to, from, line);

            if (this.connections.has(reverseId)) {
                bidirectionalCount++;
                processed.add(id);
                processed.add(reverseId);
            } else {
                unidirectionalCount++;
                this.debug(`单向连接: ${from} -> ${to} (${line})`);
            }
        }

        this.debug(`双向连接对: ${bidirectionalCount}`);
        this.debug(`单向连接: ${unidirectionalCount}`);
        this.debug('--- 连接双向性验证完成 ---\n');

        return { bidirectionalCount, unidirectionalCount };
    }

    /**
     * 修复缺失的反向连接
     */
    fixMissingReverseConnections() {
        this.debug('\n--- 修复缺失的反向连接 ---');

        let fixedCount = 0;
        const connectionsToAdd = [];

        for (const [id, connection] of this.connections) {
            const { from, to, line, via = [] } = connection;
            const reverseId = this.generateConnectionId(to, from, line);

            if (!this.connections.has(reverseId)) {
                connectionsToAdd.push({
                    from: to,
                    to: from,
                    line: line,
                    via: [...via].reverse(),
                    id: reverseId
                });
            }
        }

        // 添加缺失的反向连接
        connectionsToAdd.forEach(conn => {
            this.connections.set(conn.id, conn);
            fixedCount++;
            this.debug(`添加反向连接: ${conn.from} -> ${conn.to} (${conn.line})`);
        });

        this.debug(`修复了 ${fixedCount} 个缺失的反向连接`);
        this.debug('--- 反向连接修复完成 ---\n');

        return fixedCount;
    }

    /**
     * 获取两个站点之间的所有可能路径（用于调试）
     */
    getAllPathsBetweenStations(from, to) {
        const paths = [];
        const connections = this.getStationConnections(from);

        connections.forEach(conn => {
            if (conn.to === to) {
                paths.push([conn]);
            } else {
                // 可以扩展为递归查找更复杂的路径
                const nextConnections = this.getStationConnections(conn.to);
                nextConnections.forEach(nextConn => {
                    if (nextConn.to === to) {
                        paths.push([conn, nextConn]);
                    }
                });
            }
        });

        return paths;
    }

    /**
     * 检查数据完整性并自动修复
     */
    checkAndRepairData() {
        this.debug('\n=== 开始数据完整性检查和修复 ===');

        // 验证数据完整性
        this.validateDataIntegrity();

        // 验证连接双向性
        const bidirectionalResult = this.validateBidirectionalConnections();

        // 如果有单向连接，尝试修复
        if (bidirectionalResult.unidirectionalCount > 0) {
            const fixedCount = this.fixMissingReverseConnections();
            this.debug(`修复了 ${fixedCount} 个连接问题`);
        }

        // 调试连接状态
        this.debugConnections();

        this.debug('=== 数据完整性检查和修复完成 ===\n');

        return {
            totalConnections: this.connections.size,
            bidirectionalPairs: bidirectionalResult.bidirectionalCount,
            fixedConnections: bidirectionalResult.unidirectionalCount
        };
    }

    /**
     * 清理重复连接
     */
    cleanupDuplicateConnections() {
        this.debug('\n--- 清理重复连接 ---');

        const uniqueConnections = new Map();
        let duplicatesRemoved = 0;

        for (const [id, connection] of this.connections) {
            const { from, to, line } = connection;
            const normalizedKey = this.getConnectionKey(from, to, line);

            if (!uniqueConnections.has(normalizedKey)) {
                uniqueConnections.set(normalizedKey, connection);
            } else {
                duplicatesRemoved++;
            }
        }

        // 重建连接映射
        this.connections.clear();
        for (const [key, connection] of uniqueConnections) {
            this.connections.set(connection.id, connection);

            // 确保反向连接也存在
            const reverseId = this.generateConnectionId(connection.to, connection.from, connection.line);
            if (!this.connections.has(reverseId)) {
                const reverseConnection = {
                    from: connection.to,
                    to: connection.from,
                    line: connection.line,
                    via: connection.via ? [...connection.via].reverse() : [],
                    id: reverseId
                };
                this.connections.set(reverseId, reverseConnection);
            }
        }

        this.debug(`清理了 ${duplicatesRemoved} 个重复连接`);
        this.debug('--- 重复连接清理完成 ---\n');

        return duplicatesRemoved;
    }

    /**
     * 性能优化：预计算常用查询结果
     */
    optimizeQueries() {
        // 可以在这里添加查询缓存等优化逻辑
        this.debug('查询优化完成');
    }

    /**
     * 获取系统健康状态
     */
    getSystemHealth() {
        const health = {
            status: 'healthy',
            issues: [],
            stats: this.getStatistics()
        };

        // 检查基本数据完整性
        if (this.lines.size === 0) {
            health.issues.push('没有线路数据');
            health.status = 'error';
        }

        if (this.stations.size === 0) {
            health.issues.push('没有站点数据');
            health.status = 'error';
        }

        if (this.connections.size === 0) {
            health.issues.push('没有连接数据');
            health.status = 'error';
        }

        // 检查连接完整性
        let orphanedConnections = 0;
        for (const [id, connection] of this.connections) {
            if (!this.stations.has(connection.from) || !this.stations.has(connection.to)) {
                orphanedConnections++;
            }
        }

        if (orphanedConnections > 0) {
            health.issues.push(`${orphanedConnections} 个孤立连接`);
            health.status = health.status === 'error' ? 'error' : 'warning';
        }

        return health;
    }
}

// 全局数据管理器实例
window.metroData = new MetroDataManager();
if (typeof window !== 'undefined') {
    window.MetroDataManager = MetroDataManager;
}