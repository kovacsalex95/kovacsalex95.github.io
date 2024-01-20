window.addEventListener('load', () => new Wormhole());

class Wormhole
{
    static get ASPECT_RATIO() { return window.innerWidth / window.innerHeight; }
    static get CANVAS_MAX_WIDTH() { return 1440; }
    static get CANVAS_MAX_HEIGHT() { return this.CANVAS_MAX_WIDTH / Wormhole.ASPECT_RATIO; }
    static get CANVAS_TARGET_WIDTH() { return window.innerWidth; }
    static get CANVAS_TARGET_HEIGHT() { return window.innerHeight; }
    static get RESOLUTION_SCALE() { return this.CANVAS_WIDTH / this.CANVAS_MAX_WIDTH; }
    static get CANVAS_WIDTH() { return Math.min(Wormhole.CANVAS_TARGET_WIDTH, Wormhole.CANVAS_MAX_WIDTH); }
    static get CANVAS_HEIGHT() { return Math.min(Wormhole.CANVAS_TARGET_HEIGHT, Wormhole.CANVAS_MAX_HEIGHT); }
    static get ENTITY_PRECISION() { return 2000; }
    static get ENTITY_COLOR_PRECISION() { return 1000; }
    static get ENTITY_COUNT() { return 30; }
    static get ENTITY_SPEED() { return -0.25; }
    static get SHOCKWAVE_SIZE_MULTIPLIER() { return 0.75; }
    static get SHOCKWAVE_MAX_DISTANCE() { return 0.2; }
    static get SHOCKWAVE_SPEED_MULTIPLIER() { return 20; }
    static get RECTANGLE_WIDTH() { return 2.5; }
    static get RECTANGLE_HEIGHT() { return 1.7; }

    get maxRectangleSize() { return Math.min(Wormhole.CANVAS_WIDTH, Wormhole.CANVAS_HEIGHT); }
    get shockwaveSquared() { return this.shockWave * this.shockWave; }
    get entitySpeed() { return Wormhole.ENTITY_SPEED * this.framerateSpeed; }

    constructor()
    {
        this.lastFrame = Date.now();
        this.framerateSpeed = 1;

        this.cursorPositionX = 0.5;
        this.cursorPositionY = 0.5;

        this.sourceX = 0.5;
        this.sourceY = 0.5;

        this.entities = [];
        this.shockWave = 1;

        this.canvasElement = document.getElementById('wormhole');
        document.addEventListener('mousemove', (event) => {
            this.cursorPositionX = event.x / window.innerWidth;
            this.cursorPositionY = event.y / window.innerHeight;
        });

        this.canvas = this.canvasElement.getContext("2d", { alpha: false });
        this.canvasElement.width = Wormhole.CANVAS_WIDTH;
        this.canvasElement.height = Wormhole.CANVAS_HEIGHT;

        addEventListener('resize', () => {
            this.canvasElement.width = Wormhole.CANVAS_WIDTH;
            this.canvasElement.height = Wormhole.CANVAS_HEIGHT;
        });

        this.entityColors = this.generateColorRamp(
            Wormhole.hexToRgb('#9cbac9'),
            Wormhole.hexToRgb('#184054'),
            Wormhole.ENTITY_COUNT * Wormhole.ENTITY_COLOR_PRECISION,
            (x) => x * 1.2,
        )

        this.createEntities();
        requestAnimationFrame(() => this.update());
    }

    createEntities()
    {
        let progressFragments = 1 / Wormhole.ENTITY_COUNT;

        for (let i = 0; i < Wormhole.ENTITY_COUNT; i++) {
            this.entities[i] = new WormholeEntity(this, i * progressFragments);
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

        requestAnimationFrame(() => this.update());
    }

    renderFrame()
    {
        this.canvas.globalAlpha = 1;
        this.canvas.strokeStyle = '#506773';

        this.canvas.fillStyle = '#C6DAE4';
        this.canvas.fillRect(
            0,
            0,
            Wormhole.CANVAS_WIDTH,
            Wormhole.CANVAS_HEIGHT
        );

        this.shockWave += this.entitySpeed * Wormhole.SHOCKWAVE_SPEED_MULTIPLIER * 0.001;
        this.shockWave = Wormhole.rotateClamp(this.shockWave);

        this.entities.sort((entityA, entityB) => { return entityA.progress > entityB.progress ? -1 : 1; });

        let entityIndex = 0;
        this.entities.forEach((entity) => {
            entity.index = entityIndex;
            entityIndex ++;

            entity.render();
        });
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

    generateColorRamp(colorA, colorB, steps, distributeFunction = (x) => x)
    {
        return {
            r: this.generateValueRamp(colorA.r, colorB.r, steps, distributeFunction),
            g: this.generateValueRamp(colorA.g, colorB.g, steps, distributeFunction),
            b: this.generateValueRamp(colorA.b, colorB.b, steps, distributeFunction),
        }
    }

    generateValueRamp(valueA, valueB, steps, distributeFunction = (x) => x)
    {
        let values = [];

        for (let i = 0; i <= steps; i++)
        {
            let ratio = distributeFunction(i / steps);
            values[i] = Math.round(Wormhole.lerp(valueA, valueB, ratio));
        }

        return values;
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
        let ratio = (t - a) / diff;

        return clamp ? Math.max(0, Math.min(1, ratio)) : ratio;
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

    static rgbToHex(rgb)
    {
        return "#" + (1 << 24 | rgb.r << 16 | rgb.g << 8 | rgb.b).toString(16).slice(1);
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
}

class WormholeEntity
{
    constructor(wormhole, progress)
    {
        this.wormhole = wormhole;
        this.index = 0;

        this.virtualProgress = progress * Wormhole.ENTITY_PRECISION;
        this.progress = 0;
        this.width = 0;
        this.height = 0;
        this.opacity = 0;
        this.rotation = 0;
        this.sizeMultiplier = 1;
        this.rectPositionX = 0;
        this.rectPositionY = 0;

        this.backgroundR = 0;
        this.backgroundG = 0;
        this.backgroundB = 0;

        this.tick();
    }

    get rectangleWidth() { return this.width * this.wormhole.maxRectangleSize * Wormhole.RECTANGLE_WIDTH; }
    get rectangleHeight() { return this.height * this.wormhole.maxRectangleSize * Wormhole.RECTANGLE_HEIGHT; }
    get scaledRectangleWidth() { return this.rectangleWidth * this.sizeMultiplier; }
    get scaledRectangleHeight() { return this.rectangleHeight * this.sizeMultiplier; }

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

        this.opacity = Wormhole.cutoff(this.progress, 0.5, 0, 0.7, 0);
        this.rotation = Wormhole.cutoff(this.progress, 0.55, -90, 420, 240);
        this.flairOpacity = Math.min(1, this.progress * 2);

        let shockwaveMaxDistanceFaded = Wormhole.lerp(Wormhole.SHOCKWAVE_MAX_DISTANCE, 0, Math.sqrt(this.progress));
        let progressDistance = Wormhole.distanceMultiplier(this.progress, this.wormhole.shockwaveSquared, shockwaveMaxDistanceFaded, true);

        this.sizeMultiplier = Wormhole.lerp(1, Wormhole.SHOCKWAVE_SIZE_MULTIPLIER, Wormhole.lerp(progressDistance, 0, this.progress * 2));
    }

    render()
    {
        this.tick();
        this.update();

        this.wormhole.canvas.save();
        if (Math.min(this.rectangleWidth, this.rectangleHeight) > 10) {

            this.wormhole.canvas.globalAlpha = this.opacity;
            let colorIndex = Math.round((1 - this.progress) * Wormhole.ENTITY_COUNT * Wormhole.ENTITY_COLOR_PRECISION);

            this.backgroundR = this.wormhole.entityColors.r[colorIndex];
            this.backgroundG = this.wormhole.entityColors.g[colorIndex];
            this.backgroundB = this.wormhole.entityColors.b[colorIndex];

            this.wormhole.canvas.fillStyle = `rgb(${this.backgroundR}, ${this.backgroundG}, ${this.backgroundB})`;

            this.rectPositionX = Wormhole.lerp(this.wormhole.sourceX, 0.5, Math.sqrt(this.progress));
            this.rectPositionY = Wormhole.lerp(this.wormhole.sourceY, 0.5, Math.sqrt(this.progress));

            this.wormhole.canvas.beginPath();
            this.wormhole.canvas.ellipse(
                this.rectPositionX * Wormhole.CANVAS_WIDTH,
                this.rectPositionY * Wormhole.CANVAS_HEIGHT,
                this.scaledRectangleWidth / 2,
                this.scaledRectangleHeight / 2,
                Wormhole.degreesToRadians(this.rotation),
                0,
                Wormhole.degreesToRadians(360));
            this.wormhole.canvas.fill();
        }

        this.wormhole.canvas.restore();

    }
}