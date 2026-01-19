/**
 * 地铁路径查找模块 - 修复版本
 * 确保返回的路径格式与渲染器完全兼容
 */
class MetroPathFinder {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.currentPath = null;
        this.debugMode = true; // 开启调试模式
    }

    /**
     * 调试日志
     */
    debug(...args) {
        if (this.debugMode) {
            console.log('[MetroPathFinder]', ...args);
        }
    }

    /**
     * 查找两个站点之间的最优路径
     * @param {string} startStation 起始站点
     * @param {string} endStation 目标站点
     * @param {string} mode 查找模式：'count', 'distance', 'transfer'
     * @returns {Object} 路径结果对象
     */
    findPath(startStation, endStation, mode = 'count') {
        this.debug('\n=== 开始路径查找 ===');
        this.debug(`从 ${startStation} 到 ${endStation}，模式: ${mode}`);

        // 输入验证
        if (!startStation || !endStation) {
            throw new Error('起始站和目标站不能为空');
        }

        if (startStation === endStation) {
            throw new Error('起始站和目标站不能相同');
        }

        if (!this.dataManager.hasStation(startStation)) {
            throw new Error(`站点不存在: ${startStation}`);
        }

        if (!this.dataManager.hasStation(endStation)) {
            throw new Error(`站点不存在: ${endStation}`);
        }

        // 根据模式选择距离计算函数
        let getDistance;
        switch (mode) {
            case 'count':
                getDistance = this.getDistanceByCount.bind(this);
                break;
            case 'distance':
                getDistance = this.getDistanceByDistance.bind(this);
                break;
            case 'transfer':
                getDistance = this.getDistanceByTransfer.bind(this);
                break;
            default:
                throw new Error(`不支持的查找模式: ${mode}`);
        }

        // 执行Dijkstra算法
        const result = this.dijkstra(startStation, endStation, getDistance);

        this.debug('原始路径查找结果:', result);

        // 标准化路径格式 - 关键修复
        if (result.path && result.path.length > 0) {
            result.path = this.normalizePathFormat(result.path);
            this.debug('标准化后的路径:', result.path);
        }

        // 生成路径详情
        if (result.path.length > 0) {
            result.guide = this.generateRouteGuide(result.path);
            result.statistics = this.calculatePathStatistics(result.path);
        }

        this.currentPath = result;

        this.debug('最终返回结果:', result);
        this.debug('=== 路径查找完成 ===\n');

        return result;
    }

    /**
     * 标准化路径格式 - 关键修复
     * 确保路径中的每个连接都有正确的格式，并且与数据管理器中的连接格式一致
     * @param {Array} rawPath 原始路径
     * @returns {Array} 标准化后的路径
     */
    normalizePathFormat(rawPath) {
        this.debug('\n--- 开始路径格式标准化 ---');
        this.debug('原始路径长度:', rawPath.length);

        const normalizedPath = [];

        for (let i = 0; i < rawPath.length; i++) {
            const rawConnection = rawPath[i];
            this.debug(`处理连接 ${i + 1}:`, rawConnection);

            // 查找数据管理器中对应的连接
            const standardConnection = this.findStandardConnection(rawConnection);

            if (standardConnection) {
                normalizedPath.push(standardConnection);
                this.debug(`✓ 找到标准连接:`, standardConnection);
            } else {
                this.debug(`✗ 未找到标准连接，使用原始连接`);
                // 如果找不到标准连接，至少确保基本格式正确
                const fallbackConnection = {
                    from: rawConnection.from,
                    to: rawConnection.to,
                    line: rawConnection.line,
                    via: rawConnection.via || [],
                    id: `${rawConnection.from}-${rawConnection.to}-${rawConnection.line}`
                };
                normalizedPath.push(fallbackConnection);
            }
        }

        this.debug('标准化路径长度:', normalizedPath.length);
        this.debug('--- 路径格式标准化完成 ---\n');

        return normalizedPath;
    }

    /**
     * 查找标准连接 - 在数据管理器中查找匹配的连接
     * @param {Object} rawConnection 原始连接
     * @returns {Object|null} 标准连接对象
     */
    findStandardConnection(rawConnection) {
        const { from, to, line } = rawConnection;

        // 首先尝试直接匹配
        let connection = this.dataManager.getConnection(from, to, line);
        if (connection) {
            this.debug(`直接匹配成功: ${from} -> ${to} (${line})`);
            return connection;
        }

        // 尝试反向匹配
        connection = this.dataManager.getConnection(to, from, line);
        if (connection) {
            this.debug(`反向匹配成功: ${to} -> ${from} (${line})`);
            // 返回正向的连接
            return {
                from: from,
                to: to,
                line: line,
                via: connection.via ? [...connection.via].reverse() : [],
                id: `${from}-${to}-${line}`
            };
        }

        // 如果直接查找失败，遍历所有连接进行匹配
        const allConnections = this.dataManager.getConnections();
        for (const conn of allConnections) {
            // 正向匹配
            if (conn.from === from && conn.to === to && conn.line === line) {
                this.debug(`遍历正向匹配成功:`, conn);
                return conn;
            }
            // 反向匹配
            if (conn.from === to && conn.to === from && conn.line === line) {
                this.debug(`遍历反向匹配成功:`, conn);
                return {
                    from: from,
                    to: to,
                    line: line,
                    via: conn.via ? [...conn.via].reverse() : [],
                    id: `${from}-${to}-${line}`
                };
            }
        }

        this.debug(`无法找到匹配的标准连接: ${from} -> ${to} (${line})`);
        return null;
    }

    /**
     * Dijkstra算法实现 - 优化版本
     * @param {string} start 起始站点
     * @param {string} end 目标站点
     * @param {Function} getDistance 距离计算函数
     * @returns {Object} 包含路径和距离的结果对象
     */
    dijkstra(start, end, getDistance) {
        this.debug('\n--- Dijkstra算法开始 ---');

        const distances = new Map();
        const previous = new Map();
        const visited = new Set();

        // 优先队列实现
        const queue = new PriorityQueue((a, b) => a.distance - b.distance);

        // 初始化
        const stations = this.dataManager.getStationNames();
        stations.forEach(station => {
            distances.set(station, Infinity);
            previous.set(station, null);
        });

        distances.set(start, 0);
        queue.enqueue({
            station: start,
            distance: 0,
            path: [],
            currentLine: null
        });

        let pathsExplored = 0;
        let bestPath = null;
        let bestDistance = Infinity;

        while (!queue.isEmpty()) {
            const current = queue.dequeue();
            pathsExplored++;

            if (visited.has(current.station)) {
                continue;
            }

            visited.add(current.station);

            // 到达目标站点
            if (current.station === end) {
                if (current.distance < bestDistance ||
                    (current.distance === bestDistance &&
                        (!bestPath || current.path.length < bestPath.length))) {
                    bestDistance = current.distance;
                    bestPath = current.path;
                    this.debug(`找到更好路径，距离: ${bestDistance}, 步数: ${current.path.length}`);
                }
                continue;
            }

            // 遍历相邻站点
            const connections = this.dataManager.getStationConnections(current.station);
            for (const connection of connections) {
                if (visited.has(connection.to)) {
                    continue;
                }

                const edgeDistance = getDistance(current.path, connection, current.currentLine);
                const newDistance = current.distance + edgeDistance;

                if (newDistance <= distances.get(connection.to)) {
                    distances.set(connection.to, newDistance);
                    previous.set(connection.to, {
                        station: current.station,
                        connection: connection
                    });

                    // 关键：确保连接对象格式正确
                    const standardizedConnection = {
                        from: connection.from,
                        to: connection.to,
                        line: connection.line,
                        via: connection.via || [],
                        id: connection.id || `${connection.from}-${connection.to}-${connection.line}`
                    };

                    const newPath = [...current.path, standardizedConnection];
                    queue.enqueue({
                        station: connection.to,
                        distance: newDistance,
                        path: newPath,
                        currentLine: connection.line
                    });
                }
            }
        }

        this.debug(`算法完成，探索了 ${pathsExplored} 条路径`);
        this.debug('--- Dijkstra算法结束 ---\n');

        return {
            path: bestPath || [],
            distance: bestDistance === Infinity ? -1 : bestDistance,
            found: bestPath !== null,
            mode: getDistance.name || 'unknown',
            pathsExplored: pathsExplored
        };
    }

    /**
     * 按站点数计算距离（换乘有惩罚）
     * @param {Array} currentPath 当前路径
     * @param {Object} connection 连接对象
     * @param {string} currentLine 当前线路
     * @returns {number} 距离值
     */
    getDistanceByCount(currentPath, connection, currentLine) {
        // 基础距离为1
        let distance = 1;

        // 如果需要换乘，增加惩罚
        if (currentLine && currentLine !== connection.line) {
            distance += 2; // 换乘惩罚
        }

        return distance;
    }

    /**
     * 按实际距离计算
     * @param {Array} currentPath 当前路径
     * @param {Object} connection 连接对象
     * @param {string} currentLine 当前线路
     * @returns {number} 距离值（米）
     */
    getDistanceByDistance(currentPath, connection, currentLine) {
        const fromStation = this.dataManager.getStation(connection.from);
        const toStation = this.dataManager.getStation(connection.to);

        if (!fromStation || !toStation) {
            return 1000; // 默认距离
        }

        // 计算地理距离
        let distance = this.dataManager.calculateDistance(
            fromStation.realPosition,
            toStation.realPosition
        );

        // 换乘惩罚（增加平均站间距的3倍）
        if (currentLine && currentLine !== connection.line) {
            distance += 2500 * 3; // 平均站间距2.5km
        }

        return Math.round(distance);
    }

    /**
     * 按换乘次数计算
     * @param {Array} currentPath 当前路径
     * @param {Object} connection 连接对象
     * @param {string} currentLine 当前线路
     * @returns {number} 换乘次数
     */
    getDistanceByTransfer(currentPath, connection, currentLine) {
        // 只关心换乘次数
        if (currentLine && currentLine !== connection.line) {
            return 1; // 换乘一次
        }
        return 0; // 同线路不算换乘
    }

    /**
     * 生成换乘指南 - 增强版本
     * @param {Array} path 路径连接数组
     * @returns {Object} 换乘指南对象
     */
    generateRouteGuide(path) {
        this.debug('\n--- 生成换乘指南 ---');

        if (!path || path.length === 0) {
            return { steps: [], totalTime: 0, totalDistance: 0 };
        }

        const steps = [];
        let currentLine = null;
        let currentStations = [];
        let totalDistance = 0;
        let totalTime = 0;

        // 添加起始站
        const firstConnection = path[0];
        currentLine = firstConnection.line;
        currentStations = [firstConnection.from];

        for (let i = 0; i < path.length; i++) {
            const connection = path[i];
            const isLastConnection = i === path.length - 1;

            this.debug(`处理指南步骤 ${i + 1}: ${connection.from} -> ${connection.to} (${connection.line})`);

            // 计算距离和时间
            const fromStation = this.dataManager.getStation(connection.from);
            const toStation = this.dataManager.getStation(connection.to);
            if (fromStation && toStation) {
                const distance = this.dataManager.calculateDistance(
                    fromStation.realPosition,
                    toStation.realPosition
                );
                totalDistance += distance;
                totalTime += Math.ceil(distance / 500) * 60; // 假设平均速度30km/h
            }

            if (connection.line !== currentLine) {
                // 换乘：完成当前线路段
                currentStations.push(connection.from);
                const lineColor = this.dataManager.getLine(currentLine)?.color || '#666';

                steps.push({
                    type: 'ride',
                    line: currentLine,
                    lineColor: lineColor,
                    stations: [...currentStations],
                    from: currentStations[0],
                    to: currentStations[currentStations.length - 1],
                    stationCount: currentStations.length - 1
                });

                // 添加换乘步骤
                const fromLineColor = this.dataManager.getLine(currentLine)?.color || '#666';
                const toLineColor = this.dataManager.getLine(connection.line)?.color || '#666';

                steps.push({
                    type: 'transfer',
                    station: connection.from,
                    fromLine: currentLine,
                    toLine: connection.line,
                    fromLineColor: fromLineColor,
                    toLineColor: toLineColor
                });

                // 开始新线路段
                currentLine = connection.line;
                currentStations = [connection.from];
                totalTime += 300; // 换乘时间5分钟
            }

            currentStations.push(connection.to);

            // 如果是最后一个连接，完成最后一段
            if (isLastConnection) {
                const lineColor = this.dataManager.getLine(currentLine)?.color || '#666';

                steps.push({
                    type: 'ride',
                    line: currentLine,
                    lineColor: lineColor,
                    stations: [...currentStations],
                    from: currentStations[0],
                    to: currentStations[currentStations.length - 1],
                    stationCount: currentStations.length - 1
                });
            }
        }

        const guide = {
            steps: steps,
            totalTime: Math.ceil(totalTime / 60), // 转换为分钟
            totalDistance: Math.round(totalDistance / 1000 * 100) / 100, // 转换为公里，保留2位小数
            transferCount: steps.filter(step => step.type === 'transfer').length,
            stationCount: path.length
        };

        this.debug('生成的换乘指南:', guide);
        this.debug('--- 换乘指南生成完成 ---\n');

        return guide;
    }

    /**
     * 计算路径统计信息
     * @param {Array} path 路径连接数组
     * @returns {Object} 统计信息对象
     */
    calculatePathStatistics(path) {
        if (!path || path.length === 0) {
            return null;
        }

        const lines = new Set();
        let totalDistance = 0;
        let transferCount = 0;
        let currentLine = null;

        for (const connection of path) {
            lines.add(connection.line);

            // 计算距离
            const fromStation = this.dataManager.getStation(connection.from);
            const toStation = this.dataManager.getStation(connection.to);
            if (fromStation && toStation) {
                totalDistance += this.dataManager.calculateDistance(
                    fromStation.realPosition,
                    toStation.realPosition
                );
            }

            // 计算换乘次数
            if (currentLine && currentLine !== connection.line) {
                transferCount++;
            }
            currentLine = connection.line;
        }

        return {
            stationCount: path.length,
            transferCount: transferCount,
            lineCount: lines.size,
            totalDistance: Math.round(totalDistance),
            lines: Array.from(lines),
            estimatedTime: Math.ceil((totalDistance / 30000) * 60 + transferCount * 5) // 30km/h + 5min换乘
        };
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
     * 获取路径中的所有线路段
     * @param {Array} path 路径连接数组
     * @returns {Array} 线路段数组
     */
    getPathSegments(path) {
        if (!path || path.length === 0) {
            return [];
        }

        const segments = [];
        let currentSegment = {
            line: path[0].line,
            connections: [path[0]]
        };

        for (let i = 1; i < path.length; i++) {
            const connection = path[i];

            if (connection.line === currentSegment.line) {
                currentSegment.connections.push(connection);
            } else {
                segments.push(currentSegment);
                currentSegment = {
                    line: connection.line,
                    connections: [connection]
                };
            }
        }

        segments.push(currentSegment);
        return segments;
    }

    /**
     * 检查路径是否有效 - 增强版本
     * @param {Array} path 路径连接数组
     * @returns {boolean} 路径是否有效
     */
    isValidPath(path) {
        if (!path || path.length === 0) {
            return false;
        }

        // 检查连接的连续性
        for (let i = 0; i < path.length - 1; i++) {
            if (path[i].to !== path[i + 1].from) {
                this.debug(`路径不连续: ${path[i].to} !== ${path[i + 1].from}`);
                return false;
            }
        }

        // 检查所有站点和线路是否存在
        for (const connection of path) {
            if (!this.dataManager.hasStation(connection.from) ||
                !this.dataManager.hasStation(connection.to) ||
                !this.dataManager.hasLine(connection.line)) {
                this.debug(`连接中的站点或线路不存在:`, connection);
                return false;
            }
        }

        return true;
    }

    /**
     * 获取当前路径
     * @returns {Object} 当前路径对象
     */
    getCurrentPath() {
        return this.currentPath;
    }

    /**
     * 清除当前路径
     */
    clearCurrentPath() {
        this.currentPath = null;
    }

    /**
     * 查找多个目标的最优路径（用于路径规划）
     * @param {string} start 起始站点
     * @param {Array} targets 目标站点数组
     * @param {string} mode 查找模式
     * @returns {Array} 路径结果数组
     */
    findMultiplePaths(start, targets, mode = 'count') {
        return targets.map(target => {
            try {
                return this.findPath(start, target, mode);
            } catch (error) {
                return {
                    path: [],
                    distance: -1,
                    found: false,
                    error: error.message,
                    target: target
                };
            }
        });
    }

    /**
     * 查找经过指定站点的路径
     * @param {string} start 起始站点
     * @param {string} end 终点站点
     * @param {Array} via 经过的站点数组
     * @param {string} mode 查找模式
     * @returns {Object} 路径结果
     */
    findPathVia(start, end, via, mode = 'count') {
        if (!via || via.length === 0) {
            return this.findPath(start, end, mode);
        }

        const allStops = [start, ...via, end];
        const segments = [];
        let totalDistance = 0;

        // 分段查找路径
        for (let i = 0; i < allStops.length - 1; i++) {
            const segmentResult = this.findPath(allStops[i], allStops[i + 1], mode);
            if (!segmentResult.found) {
                return {
                    path: [],
                    distance: -1,
                    found: false,
                    error: `无法从 ${allStops[i]} 到达 ${allStops[i + 1]}`
                };
            }
            segments.push(...segmentResult.path);
            totalDistance += segmentResult.distance;
        }

        // 标准化合并后的路径
        const normalizedSegments = this.normalizePathFormat(segments);

        return {
            path: normalizedSegments,
            distance: totalDistance,
            found: true,
            guide: this.generateRouteGuide(normalizedSegments),
            statistics: this.calculatePathStatistics(normalizedSegments)
        };
    }
}

/**
 * 优先队列实现
 */
class PriorityQueue {
    constructor(compare = (a, b) => a - b) {
        this.heap = [];
        this.compare = compare;
    }

    enqueue(item) {
        this.heap.push(item);
        this.heapifyUp(this.heap.length - 1);
    }

    dequeue() {
        if (this.heap.length === 0) return null;
        if (this.heap.length === 1) return this.heap.pop();

        const item = this.heap[0];
        this.heap[0] = this.heap.pop();
        this.heapifyDown(0);
        return item;
    }

    isEmpty() {
        return this.heap.length === 0;
    }

    heapifyUp(index) {
        while (index > 0) {
            const parentIndex = Math.floor((index - 1) / 2);
            if (this.compare(this.heap[index], this.heap[parentIndex]) >= 0) break;
            this.swap(index, parentIndex);
            index = parentIndex;
        }
    }

    heapifyDown(index) {
        while (true) {
            let minIndex = index;
            const leftChild = 2 * index + 1;
            const rightChild = 2 * index + 2;

            if (leftChild < this.heap.length &&
                this.compare(this.heap[leftChild], this.heap[minIndex]) < 0) {
                minIndex = leftChild;
            }

            if (rightChild < this.heap.length &&
                this.compare(this.heap[rightChild], this.heap[minIndex]) < 0) {
                minIndex = rightChild;
            }

            if (minIndex === index) break;
            this.swap(index, minIndex);
            index = minIndex;
        }
    }

    swap(i, j) {
        [this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]];
    }
}


if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MetroPathFinder, PriorityQueue };
} else if (typeof window !== 'undefined') {
    window.MetroPathFinder = MetroPathFinder;
    window.PriorityQueue = PriorityQueue;
}