window.addEventListener('load', () => new Wormhole());

class Wormhole
{
    static get MINIMUM_RESOLUTION() { return 1280*720; }
    static get TARGET_SCREEN_SIZE() { return 1080; }
    static get ENTITY_PRECISION() { return 5000; }
    static get ENTITY_COUNT() { return 40; }
    static get NODE_COUNT() { return [2, 6]; }
    static get NODE_MAX_CONNECTIONS() { return 2; }
    static get ENTITY_SPEED() { return -0.25; }
    static get SHOCKWAVE_SIZE_MULTIPLIER() { return 0.75; }
    static get SHOCKWAVE_MAX_DISTANCE() { return 0.2; }
    static get SHOCKWAVE_SPEED_MULTIPLIER() { return 20; }
    static get RECTANGLE_WIDTH() { return 2; }
    static get RECTANGLE_HEIGHT() { return 1.3; }
    static get COLOR_PRECISION() { return 255 * 2; }

    get nodeSize() { return 18 * this.screenScale; }
    get nodeZ() { return Math.trunc(this.resolutionSize * 0.15); }
    get nodeMinDistance() { return Math.trunc(this.resolutionSize * 0.4); }
    get nodeMaxDistance() { return Math.trunc(this.resolutionSize * 0.55); }
    get shockwaveSquared() { return this.shockWave * this.shockWave; }
    get entitySpeed() { return Wormhole.ENTITY_SPEED * this.framerateSpeed; }

    constructor()
    {
        this.lastFrame = Date.now();
        this.frameTime = 1000 / 60;
        this.framerateSpeed = 1;

        this.cursorPositionX = 0.5;
        this.cursorPositionY = 0.5;

        this.sourceX = 0.5;
        this.sourceY = 0.5;

        this.entities = [];
        this.nodes = [];
        this.timers = {};
        this.touchScreen = false;

        this.shockWave = 1;

        this.canvasElement = document.getElementById('wormhole');
        document.addEventListener('mousemove', (event) => {
            if (this.touchScreen) {
                return;
            }

            this.cursorPositionX = event.x / window.innerWidth;
            this.cursorPositionY = event.y / window.innerHeight;
        });
        document.addEventListener('touchmove', (event) => {
            this.touchScreen = true;

            let x = 0;
            let y = 0;
            const touches = Array.from(event.touches);
            touches.forEach(touch => {
                x += touch.screenX;
                y += touch.screenY;
            })
            x /= touches.length;
            y /= touches.length;

            this.cursorPositionX = x / window.innerWidth;
            this.cursorPositionY = y / window.innerHeight;
        });

        this.canvas = null;

        const contextTypes = [/*'webgl2', 'webgl', */'2d'];
        for (let i = 0; i < contextTypes.length; i++) {
            this.canvas = this.canvasElement.getContext(contextTypes[i], { alpha: false });

            if (this.canvas !== null) {
                console.log('canvas context:', contextTypes[i]);
                break;
            }
        }

        this.canvasWidth = 0;
        this.canvasHeight = 0;
        this.canvasSize = 0;

        this.resolutionScale = 1;
        this.resolutionX = 0;
        this.resolutionY = 0;
        this.resolutionSize = 0;

        this.screenScale = 1;

        this.colorRamp = Wormhole.generateColorRamp(
            Wormhole.hexToRgb('#0a2846'),
            Wormhole.hexToRgb('#d2d2d2'),
            Wormhole.COLOR_PRECISION,
            (t) => t,
        );

        this.updateResolution();

        addEventListener('resize', () => {
            this.updateResolution();
        });

        this.createEntities();
        this.createNodes();

        requestAnimationFrame(() => this.update());
    }

    createEntities()
    {
        const progressFragments = 1 / Wormhole.ENTITY_COUNT;

        for (let i = 0; i < Wormhole.ENTITY_COUNT; i++) {
            this.entities[i] = new WormholeEntity(this, i * progressFragments);
        }
    }

    createNodes()
    {
        let nodeIndex = 0;

        for (let i = 0; i < this.entities.length; i++) {
            const entity = this.entities[i];
            const nodeCount = Wormhole.random(Wormhole.NODE_COUNT[0], Wormhole.NODE_COUNT[1]);

            for (let j = 0; j < nodeCount; j++) {
                const angle = Wormhole.random(0, 360);
                const distance = Wormhole.random(0.4, 1.2);
                const size = Wormhole.random(0.4, 1.1);

                this.nodes.push(new WormholeNode(nodeIndex, this, entity, angle, distance, size))
                nodeIndex++;
            }
        }
    }

    update()
    {
        this.frameTime = Date.now() - this.lastFrame; // 20ms
        const targetFrametime = 1000 / 60; // 40ms
        this.framerateSpeed = this.frameTime / targetFrametime;
        this.lastFrame = Date.now();

        if (Math.abs(this.framerateSpeed - 1) > 0.1 && this.tickTimer('framerateSmoothing', 0.5)) {
            this.updateResolution(true);
        }

        this.targetSourceX = Wormhole.lerp(0.3, 0.7, 1 - this.cursorPositionX);
        this.targetSourceY = Wormhole.lerp(0.3, 0.7, 1 - this.cursorPositionY);

        this.sourceX = Wormhole.lerp(this.sourceX, this.targetSourceX, 0.02 * this.framerateSpeed);
        this.sourceY = Wormhole.lerp(this.sourceY, this.targetSourceY, 0.02 * this.framerateSpeed);

        this.renderFrame();

        Object.keys(this.timers).forEach(key => this.timers[key] += this.frameTime)
        requestAnimationFrame(() => this.update());
    }

    updateResolution(autoFramerate = false)
    {
        this.canvasWidth = this.canvasElement.parentElement.clientWidth;
        this.canvasHeight = this.canvasElement.parentElement.clientHeight;
        this.canvasSize = Math.min(this.canvasWidth, this.canvasHeight);
        this.resolutionScale = 1;

        if (autoFramerate) {
            const canvasResolution = this.canvasWidth * this.canvasHeight;
            const minimumResolution = Math.min(canvasResolution, Wormhole.MINIMUM_RESOLUTION);
            const performanceIndex = this.framerateSpeed > 0 ? 1 / this.framerateSpeed : 0;

            this.resolutionScale = Wormhole.lerp((minimumResolution / canvasResolution), 1, performanceIndex);
        }

        this.screenScale = this.canvasSize / Wormhole.TARGET_SCREEN_SIZE * this.resolutionScale;

        this.resolutionX = Math.round(this.canvasWidth * this.resolutionScale);
        this.resolutionY = Math.round(this.canvasHeight * this.resolutionScale);
        this.resolutionSize = Math.min(this.resolutionX, this.resolutionY);

        this.canvasElement.width = this.resolutionX;
        this.canvasElement.height = this.resolutionY;
    }

    connectNodes()
    {
        this.nodes
            .filter(node => node.connections.length === 0)
            .forEach(nodeA => {
            this.nodes
                .filter(nodeB => nodeB.connections.length < Wormhole.NODE_MAX_CONNECTIONS && !nodeB.hasConnectionWith(nodeA))
                .forEach(nodeB => {
                    if (nodeB.index === nodeA.index) {
                        return;
                    }

                    if (nodeA.hasConnectionWith(nodeB)) {
                        return;
                    }

                    const distance = Wormhole.nodeDistance(nodeA, nodeB);
                    if (distance > this.nodeMaxDistance) {
                        return;
                    }

                    nodeA.connections.push(nodeB);
                });

            if (nodeA.connections.length <= Wormhole.NODE_MAX_CONNECTIONS) {
                return;
            }

            nodeA.connections.sort((nodeB1, nodeB2) => {
                const distance1 = Math.pow(Wormhole.nodeDistance(nodeA, nodeB1), 2);
                const distance2 = Math.pow(Wormhole.nodeDistance(nodeA, nodeB2), 2);

                return distance1 <= distance2 ? -1 : 1;
            });

            while(nodeA.connections.length > Wormhole.NODE_MAX_CONNECTIONS) {
                nodeA.connections.pop();
            }
        });
    }

    renderFrame()
    {
        this.canvas.globalAlpha = 1;
        this.canvas.strokeStyle = '#566d7e';

        this.canvas.fillStyle = '#C6DAE4';
        this.canvas.fillRect(
            0,
            0,
            this.resolutionX,
            this.resolutionY
        );

        this.shockWave += this.entitySpeed * Wormhole.SHOCKWAVE_SPEED_MULTIPLIER * 0.001;
        this.shockWave = Wormhole.rotateClamp(this.shockWave);

        this.entities.forEach((entity) => entity.tick());
        this.entities.sort((entityA, entityB) => { return entityA.progress > entityB.progress ? -1 : 1; });
        this.entities.forEach((entity) => entity.render());

        this.connectNodes();
        const nodeTick = this.tickTimer('nodeReconnect', 1);
        this.nodes.forEach((node) => node.render(nodeTick));
    }

    startTimer(name)
    {
        this.timers[name] = 0;
    }

    tickTimer(name, second)
    {
        if (false === Object.keys(this.timers).includes(name)) {
            this.startTimer(name);
        }

        let tick = false;
        while(this.timers[name] > second * 1000) {
            this.timers[name] -= second * 1000;
            tick = true;
        }

        return tick;
    }

    fillCenteredRect(x, y, width, height)
    {
        this.canvas.fillRect(
            x - width / 2,
            y - height / 2,
            width,
            height
        );
    }

    strokeCenteredRect(x, y, width, height)
    {
        this.canvas.strokeRect(
            x - width / 2,
            y - height / 2,
            width,
            height
        );
    }

    static lerp(a, b, t, clamp = true, precision = 1)
    {
        const diff = b - a;
        const tt = (clamp ? Math.max(0, Math.min(precision, t)) : t) / precision;
        return a + diff * tt;
    }

    static inverseLerp(a, b, t, clamp = true)
    {
        const diff = b - a;
        const normalT = clamp ? Math.max(a, Math.min(b, t)) : t;
        const normalTA = clamp ? Math.max(0, normalT - a) : normalT - a;
        return normalTA / diff;
    }

    static rotateClamp(value, min = 0, max = 1, onClamp = null)
    {
        let result = value;
        const diff = Math.abs(max - min);
        let clamped = false;

        while (result < min) {
            result += diff;
            clamped = true;
        }

        while (result > max) {
            result -= diff;
            clamped = true;
        }

        if (clamped && onClamp !== null && onClamp instanceof Function) {
            onClamp();
        }

        return result;
    }

    static distanceMultiplier(pointA, pointB, maxDistance, inverse = false)
    {
        const result = Math.min(maxDistance, Math.abs(pointA - pointB)) / maxDistance;
        return inverse ? 1 - result : result;
    }

    static random(smallest, largest)
    {
        return Wormhole.lerp(smallest, largest, Math.random());
    }

    static cutoff(ratio, cutoffRatio, a, b, c)
    {
        if (ratio <= cutoffRatio) {
            return Wormhole.lerp(a, b, ratio);
        }

        return Wormhole.lerp(Wormhole.lerp(a, b, cutoffRatio), c, (ratio - cutoffRatio) / (1 - cutoffRatio));
    }

    static rgbToHex(r, g, b)
    {
        return "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1);
    }

    static hexToRgb(hex)
    {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    static degreesToRadians(degrees)
    {
        return (Math.PI / 180) * degrees;
    }

    static radiansToDegrees(radians)
    {
        return radians * (180 / Math.PI);
    }

    static distribute(x, distributeFunction = (x) => x, min = 0, max = 1)
    {
        const ratio = Wormhole.inverseLerp(min, max, x); // 0 .. 1
        const tilted = (ratio - 0.5) * 2; // -1 .. 1
        const sign = tilted < 0 ? -1 : 1; // -1 / 1

        return distributeFunction(Math.abs(tilted)) * sign;
    }

    static vector3Distance(x1, y1, z1, x2, y2, z2)
    {
        const dx = x1 - x2;
        const dy = y1 - y2;
        const dz = z1 - z2;

        return Math.trunc(Math.sqrt( dx * dx + dy * dy + dz * dz ));
    }

    static nodeDistance(nodeA, nodeB)
    {
        let distance = Wormhole.vector3Distance(
            nodeA.positionX,
            nodeA.positionY,
            nodeA.positionZ,
            nodeB.positionX,
            nodeB.positionY,
            nodeB.positionZ
        );

        const distanceMultiplier = (nodeA.entity.width + nodeB.entity.width) / 2;
        if (distanceMultiplier > 0) {
            distance *= 1 / distanceMultiplier;
        }
        else {
            distance = 0;
        }

        return distance;
    }

    static colorLerp(colorA, colorB, t)
    {
        return {
            r: Wormhole.lerp(colorA.r, colorB.r, t),
            g: Wormhole.lerp(colorA.g, colorB.g, t),
            b: Wormhole.lerp(colorA.b, colorB.b, t),
        }
    }

    static generateColorRamp(colorA, colorB, steps = 10, timingFunction = (t) => t)
    {
        let result = [];
        const stepT = 1 / steps;

        for (let i = 0; i <= steps; i++) {
            const t = i * stepT;
            const color = Wormhole.colorLerp(colorA, colorB, timingFunction(t));
            result.push(Wormhole.rgbToHex(color.r, color.g, color.b));
        }

        return result;
    }
}

class WormholeEntity
{
    constructor(wormhole, progress)
    {
        this.wormhole = wormhole;

        this.virtualProgress = progress * Wormhole.ENTITY_PRECISION;
        this.progress = 0;
        this.width = 0;
        this.height = 0;
        this.opacity = 0;
        this.rotation = 0;
        this.sizeMultiplier = 1;

        this.rectangleWidth = 0;
        this.rectangleHeight = 0;

        this.tick();
    }

    get shockwaveProgressDistance() {
        const shockwaveMaxDistanceFaded = Wormhole.lerp(Wormhole.SHOCKWAVE_MAX_DISTANCE, 0, Math.sqrt(this.progress));
        const progressDistance = Wormhole.distanceMultiplier(this.progress, this.wormhole.shockwaveSquared, shockwaveMaxDistanceFaded, true);
        return Wormhole.lerp(progressDistance, 0, this.progress * 2);
    }
    get scaledRectangleWidth() { return this.rectangleWidth * this.sizeMultiplier; }
    get scaledRectangleHeight() { return this.rectangleHeight * this.sizeMultiplier; }
    get scaleRectangleSize() { return Math.min(this.scaledRectangleWidth, this.scaledRectangleHeight); }
    get spaceX() { return this.wormhole.resolutionX - this.scaledRectangleWidth; }
    get spaceY() { return this.wormhole.resolutionY - this.scaledRectangleHeight; }
    get positionX() { return Math.trunc(this.wormhole.sourceX * this.spaceX + this.scaledRectangleWidth / 2); }
    get positionY() { return Math.trunc(this.wormhole.sourceY * this.spaceY + this.scaledRectangleHeight / 2); }

    tick()
    {
        this.virtualProgress += this.wormhole.entitySpeed * (Wormhole.ENTITY_PRECISION / 1000);
        this.virtualProgress = Wormhole.rotateClamp(this.virtualProgress, 0, Wormhole.ENTITY_PRECISION);

        this.progress = Math.round(this.virtualProgress) / Wormhole.ENTITY_PRECISION;
    }

    update()
    {
        this.width = this.progress * this.progress * 2;
        this.height = this.progress * this.progress * 2;

        this.rectangleWidth = Math.trunc(this.width * this.wormhole.resolutionSize * Wormhole.RECTANGLE_WIDTH);
        this.rectangleHeight = Math.trunc(this.height * this.wormhole.resolutionSize * Wormhole.RECTANGLE_HEIGHT);

        this.opacity = Wormhole.cutoff(this.progress, 0.5, 0, 0.7, 0);
        this.rotation = Wormhole.cutoff(this.progress, 0.55, -90, 420, 240);

        this.sizeMultiplier = Wormhole.lerp(1, Wormhole.SHOCKWAVE_SIZE_MULTIPLIER, this.shockwaveProgressDistance);
    }

    render()
    {
        this.update();

        this.wormhole.canvas.save();

        if (Math.min(this.rectangleWidth, this.rectangleHeight) > 10) {
            this.wormhole.canvas.globalAlpha = this.opacity;
            const colorIndex = Math.round(this.progress * Wormhole.COLOR_PRECISION);
            this.wormhole.canvas.fillStyle = this.wormhole.colorRamp[colorIndex];

            this.wormhole.canvas.beginPath();
            this.wormhole.canvas.ellipse(
                this.positionX,
                this.positionY,
                this.scaledRectangleWidth / 2,
                this.scaledRectangleHeight / 2,
                Wormhole.degreesToRadians(this.rotation),
                0,
                Wormhole.degreesToRadians(360)
            );
            this.wormhole.canvas.fill();
        }

        this.wormhole.canvas.restore();
    }
}

class WormholeNode
{
    constructor(index, wormhole, entity, angle, distance, size)
    {
        this.index = index;
        this.wormhole = wormhole;
        this.entity = entity;
        this.angle = angle;
        this.distance = distance;
        this.size = size;
        this.connections = [];
    }

    get angleOffsetX() { return Math.sin(Wormhole.degreesToRadians(this.angle - this.entity.rotation)) * this.distance * this.entity.scaleRectangleSize; }
    get angleOffsetY() { return Math.cos(Wormhole.degreesToRadians(this.angle - this.entity.rotation)) * this.distance * this.entity.scaleRectangleSize; }
    get positionX() { return this.entity.positionX + this.angleOffsetX; }
    get positionY() { return this.entity.positionY + this.angleOffsetY; }
    get positionZ() { return this.entity.width * this.wormhole.nodeZ; }
    get opacity() { return Wormhole.lerp(1 - this.entity.progress, 0, 1 - Math.sqrt(this.entity.progress)); }

    render(tick = false)
    {
        this.renderConnections();

        if (tick) {
            this.connections = [];
        }

        this.wormhole.fillStyle = '#afd1e5';

        this.wormhole.canvas.globalAlpha = this.opacity;
        this.wormhole.canvas.beginPath();

        this.wormhole.canvas.arc(
            this.positionX,
            this.positionY,
            this.wormhole.nodeSize * this.size * this.entity.width,
            0,
            Wormhole.degreesToRadians(360)
        );

        this.wormhole.canvas.fill();
    }

    renderConnections()
    {
        if (this.connections.length === 0) {
            return;
        }

        this.wormhole.canvas.save();

        this.connections.forEach(nodeB => {
            const distance = Wormhole.nodeDistance(this, nodeB);
            const distanceRatio = 1 - Wormhole.inverseLerp(this.wormhole.nodeMinDistance, this.wormhole.nodeMaxDistance, distance);

            this.wormhole.canvas.globalAlpha = Math.min(this.opacity, nodeB.opacity) * distanceRatio;
            this.wormhole.canvas.beginPath();
            this.wormhole.canvas.moveTo(this.positionX, this.positionY);
            this.wormhole.canvas.lineTo(nodeB.positionX, nodeB.positionY);
            this.wormhole.canvas.stroke();
        });

        this.wormhole.canvas.restore();
    }

    hasConnectionWith(nodeB)
    {
        return this.connections.filter(node => node.index === nodeB.index).length > 0;
    }
}
