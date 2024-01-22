window.addEventListener('load', () => new Wormhole());

class Wormhole
{
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

    constructor()
    {
        this.lastFrame = Date.now();
        this.framerateSpeed = 1;

        this.cursorPositionX = 0.5;
        this.cursorPositionY = 0.5;

        this.sourceX = 0.5;
        this.sourceY = 0.5;

        this.entities = [];
        this.nodes = [];
        this.timers = {};

        this.shockWave = 1;

        this.canvasElement = document.getElementById('wormhole');
        document.addEventListener('mousemove', (event) => {
            this.cursorPositionX = event.x / window.innerWidth;
            this.cursorPositionY = event.y / window.innerHeight;
        });

        this.canvas = this.canvasElement.getContext("2d", { alpha: false });

        this.canvasWidth = 0;
        this.canvasHeight = 0;
        this.canvasSize = 0;

        this.resolutionScale = 1;
        this.resolutionX = 0;
        this.resolutionY = 0;
        this.resolutionSize = 0;

        this.screenScale = 1;

        this.updateResolution();

        addEventListener('resize', () => {
            this.updateResolution();
        });

        this.createEntities();
        this.createNodes();

        requestAnimationFrame(() => this.update());
    }

    get maximumResolution() { return 1280*720; }
    get nodeSize() { return 18 * this.screenScale; }
    get nodeZ() { return this.resolutionSize * 0.1; }
    get nodeMinDistance() { return this.resolutionSize * 0.45; }
    get nodeMaxDistance() { return this.resolutionSize * 0.6; }
    get shockwaveSquared() { return this.shockWave * this.shockWave; }
    get entitySpeed() { return Wormhole.ENTITY_SPEED * this.framerateSpeed; }

    updateResolution()
    {
        this.canvasWidth = this.canvasElement.parentElement.clientWidth;
        this.canvasHeight = this.canvasElement.parentElement.clientHeight;
        this.canvasSize = Math.min(this.canvasWidth, this.canvasHeight);

        const fullResolution = this.canvasWidth * this.canvasHeight;
        this.resolutionScale = fullResolution > 0 ? Math.min(1, this.maximumResolution / fullResolution) : 1;
        this.screenScale = this.canvasSize / Wormhole.TARGET_SCREEN_SIZE * this.resolutionScale;

        this.resolutionX = Math.round(this.canvasWidth * this.resolutionScale);
        this.resolutionY = Math.round(this.canvasHeight * this.resolutionScale);
        this.resolutionSize = Math.min(this.resolutionX, this.resolutionY);

        this.canvasElement.width = this.resolutionX;
        this.canvasElement.height = this.resolutionY;
    }

    createEntities()
    {
        let progressFragments = 1 / Wormhole.ENTITY_COUNT;

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
        const elapsed = Date.now() - this.lastFrame; // 20ms
        const targetFrametime = 1000 / 60; // 40ms
        this.framerateSpeed = elapsed / targetFrametime;
        this.lastFrame = Date.now();

        this.targetSourceX = Wormhole.lerp(0.3, 0.7, 1 - this.cursorPositionX);
        this.targetSourceY = Wormhole.lerp(0.3, 0.7, 1 - this.cursorPositionY);

        this.sourceX = Wormhole.lerp(this.sourceX, this.targetSourceX, 0.02 * this.framerateSpeed);
        this.sourceY = Wormhole.lerp(this.sourceY, this.targetSourceY, 0.02 * this.framerateSpeed);

        this.renderFrame();

        Object.keys(this.timers).forEach(key => this.timers[key] += elapsed )
        requestAnimationFrame(() => this.update());
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

        this.entities.sort((entityA, entityB) => { return entityA.progress > entityB.progress ? -1 : 1; });
        this.entities.forEach((entity) => entity.render());

        this.nodes.sort((nodeA, nodeB) => { return nodeA.positionZ > nodeB.positionZ ? -1 : 1 });

        this.connectNodes();
        const nodeTick = this.tickTimer('nodeReconnect', 0.5);
        this.nodes.forEach((node) => node.render(nodeTick));
    }

    connectNodes()
    {
        this.nodes.forEach(nodeA => {
            if (nodeA.connections.length > 0) {
                return;
            }

            this.nodes
                .filter(nodeB => nodeB.connections.length < Wormhole.NODE_MAX_CONNECTIONS && !nodeB.hasConnectionWith(nodeA))
                .forEach(nodeB => {
                if (nodeB.index === nodeA.index) {
                    return;
                }

                if (nodeA.hasConnectionWith(nodeB)) {
                    return;
                }

                let distance = Wormhole.nodeDistance(nodeA, nodeB);
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
        let diff = b - a;
        let tt = (clamp ? Math.max(0, Math.min(precision, t)) : t) / precision;
        return a + diff * tt;
    }

    static inverseLerp(a, b, t, clamp = true)
    {
        let diff = b - a;
        let normalT = clamp ? Math.max(a, Math.min(b, t)) : t;
        return (normalT - a) / diff;
    }

    static rotateClamp(value, min = 0, max = 1, onClamp = null)
    {
        let result = value;
        let diff = Math.abs(max - min);
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
        let result = Math.min(maxDistance, Math.abs(pointA - pointB)) / maxDistance;
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

        return Math.sqrt( dx * dx + dy * dy + dz * dz );
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

        let distanceMultiplier = (nodeA.entity.width + nodeB.entity.width) / 2;
        if (distanceMultiplier > 0) {
            distance *= 1 / distanceMultiplier;
        }
        else {
            distance = 0;
        }

        return distance;
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

        this.targetBackgroundR = 0;
        this.targetBackgroundG = 0;
        this.targetBackgroundB = 0;
        this.backgroundR = -1;
        this.backgroundG = -1;
        this.backgroundB = -1;
        this.reset = false;

        this.tick();
    }

    tick()
    {
        this.reset = false;

        this.virtualProgress += this.wormhole.entitySpeed * (Wormhole.ENTITY_PRECISION / 1000);
        this.virtualProgress = Wormhole.rotateClamp(this.virtualProgress, 0, Wormhole.ENTITY_PRECISION, () => {
            this.reset = true;
        });

        this.progress = Math.round(this.virtualProgress) / Wormhole.ENTITY_PRECISION;
    }

    update()
    {
        this.width = this.progress * this.progress * 2;
        this.height = this.progress * this.progress * 2;

        this.opacity = Wormhole.cutoff(this.progress, 0.5, 0, 0.7, 0);
        this.rotation = Wormhole.cutoff(this.progress, 0.55, -90, 420, 240);

        this.sizeMultiplier = Wormhole.lerp(1, Wormhole.SHOCKWAVE_SIZE_MULTIPLIER, this.shockwaveProgressDistance);
    }

    get shockwaveProgressDistance() {
        let shockwaveMaxDistanceFaded = Wormhole.lerp(Wormhole.SHOCKWAVE_MAX_DISTANCE, 0, Math.sqrt(this.progress));
        let progressDistance = Wormhole.distanceMultiplier(this.progress, this.wormhole.shockwaveSquared, shockwaveMaxDistanceFaded, true);
        return Wormhole.lerp(progressDistance, 0, this.progress * 2);
    }
    get rectangleWidth() { return this.width * this.wormhole.resolutionSize * Wormhole.RECTANGLE_WIDTH; }
    get rectangleHeight() { return this.height * this.wormhole.resolutionSize * Wormhole.RECTANGLE_HEIGHT; }
    get scaledRectangleWidth() { return this.rectangleWidth * this.sizeMultiplier; }
    get scaledRectangleHeight() { return this.rectangleHeight * this.sizeMultiplier; }
    get scaleRectangleSize() { return Math.min(this.scaledRectangleWidth, this.scaledRectangleHeight); }
    get spaceX() { return this.wormhole.resolutionX - this.scaledRectangleWidth; }
    get spaceY() { return this.wormhole.resolutionY - this.scaledRectangleHeight; }
    get positionX() { return this.wormhole.sourceX * this.spaceX + this.scaledRectangleWidth / 2; }
    get positionY() { return this.wormhole.sourceY * this.spaceY + this.scaledRectangleHeight / 2; }
    get backgroundFillStyle() { return `rgb(${this.targetBackgroundR}, ${this.backgroundG}, ${this.backgroundB})`; }

    render()
    {
        this.tick();
        this.update();

        this.wormhole.canvas.save();

        if (Math.min(this.rectangleWidth, this.rectangleHeight) > 10) {
            this.wormhole.canvas.globalAlpha = this.opacity;

            this.targetBackgroundR = Math.round(Wormhole.lerp(10, 210, this.progress)); //, Wormhole.ENTITY_PRECISION));
            this.targetBackgroundG = Math.round(Wormhole.lerp(40, 210, this.progress)); //, Wormhole.ENTITY_PRECISION));
            this.targetBackgroundB = Math.round(Wormhole.lerp(70, 210, this.progress)); //, Wormhole.ENTITY_PRECISION));

            if (this.backgroundR < 0 || this.backgroundG < 0|| this.backgroundB < 0) {
                this.backgroundR = this.targetBackgroundR;
                this.backgroundG = this.targetBackgroundG;
                this.backgroundB = this.targetBackgroundB;
            }
            this.backgroundR = Wormhole.lerp(this.backgroundR, this.targetBackgroundR, 0.01 * this.wormhole.framerateSpeed);
            this.backgroundG = Wormhole.lerp(this.backgroundG, this.targetBackgroundG, 0.01 * this.wormhole.framerateSpeed);
            this.backgroundB = Wormhole.lerp(this.backgroundB, this.targetBackgroundB, 0.01 * this.wormhole.framerateSpeed);

            this.wormhole.canvas.fillStyle = this.backgroundFillStyle;

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

    hasConnectionWith(nodeB)
    {
        return this.connections.filter(node => node.index === nodeB.index).length > 0;
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
            let distance = Wormhole.nodeDistance(this, nodeB);
            const distanceRatio = 1 - Wormhole.inverseLerp(this.wormhole.nodeMinDistance, this.wormhole.nodeMaxDistance, distance);

            this.wormhole.canvas.globalAlpha = Math.min(this.opacity, nodeB.opacity) * distanceRatio;
            this.wormhole.canvas.beginPath();
            this.wormhole.canvas.moveTo(this.positionX, this.positionY);
            this.wormhole.canvas.lineTo(nodeB.positionX, nodeB.positionY);
            this.wormhole.canvas.stroke();
        });

        this.wormhole.canvas.restore();
    }
}
