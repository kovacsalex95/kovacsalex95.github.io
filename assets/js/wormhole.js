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
    static get ENTITY_PRECISION() { return 2550; }
    static get ENTITY_COUNT() { return 50; }
    static get ENTITY_SPEED() { return -0.25; }
    static get SHOCKWAVE_SIZE_MULTIPLIER() { return 0.75; }
    static get SHOCKWAVE_MAX_DISTANCE() { return 0.2; }
    static get SHOCKWAVE_SPEED_MULTIPLIER() { return 20; }
    static get RECTANGLE_WIDTH() { return 2.5; }
    static get RECTANGLE_HEIGHT() { return 1.7; }
    static get FLAIR_MIN_COUNT() { return 1; }
    static get FLAIR_MAX_COUNT() { return 5; }
    static get FLAIR_SIZE() { return 13; }
    static get FLAIR_MIN_SIZE() { return 0.4; }
    static get FLAIR_MAX_SIZE() { return 1.3; }
    static get FLAIR_PADDING() { return -0.1; }

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
        this.canvasElement.addEventListener('mousemove', (event) => {
            this.cursorPositionX = event.x / window.innerWidth;
            this.cursorPositionY = event.y / window.innerHeight;
        });
        this.canvasElement.addEventListener('mouseleave', () => {
            this.cursorPositionX = 0.5;
            this.cursorPositionY = 0.5;
        })

        this.canvas = this.canvasElement.getContext("2d", { alpha: false });
        this.canvasElement.width = Wormhole.CANVAS_WIDTH;
        this.canvasElement.height = Wormhole.CANVAS_HEIGHT;

        addEventListener('resize', () => {
            this.canvasElement.width = Wormhole.CANVAS_WIDTH;
            this.canvasElement.height = Wormhole.CANVAS_HEIGHT;
        });

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

        this.sourceX = Wormhole.lerp(this.sourceX, this.targetSourceX, 0.02);
        this.sourceY = Wormhole.lerp(this.sourceY, this.targetSourceY, 0.02);

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
        this.entities.forEach((entity) => entity.render());
        this.entities.forEach((entity) => entity.renderFlairs());
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
        this.flairOpacity = 0;
        this.rotation = 0;
        this.flairs = [];
        this.sizeMultiplier = 1;

        this.targetBackgroundR = 0;
        this.targetBackgroundG = 0;
        this.targetBackgroundB = 0;
        this.backgroundR = -1;
        this.backgroundG = -1;
        this.backgroundB = -1;

        this.tick();
        this.generateFlairs();
    }

    generateFlairs()
    {
        this.flairs = [];
        let flairCount = Math.round(Wormhole.random(Wormhole.FLAIR_MIN_COUNT, Wormhole.FLAIR_MAX_COUNT));

        for (let i = 0; i < flairCount; i++) {
            this.flairs[i] = new WormholeFlair(
                this,
                this.wormhole,
                Wormhole.distribute(Wormhole.random(Wormhole.FLAIR_PADDING, 1 - Wormhole.FLAIR_PADDING), (x => Math.pow(x, 2))),
                Wormhole.distribute(Wormhole.random(Wormhole.FLAIR_PADDING, 1 - Wormhole.FLAIR_PADDING), (y => Math.pow(y, 2))),
                Wormhole.random(Wormhole.FLAIR_MIN_SIZE, Wormhole.FLAIR_MAX_SIZE)
            );
        }
    }

    tick()
    {
        this.virtualProgress += this.wormhole.entitySpeed;
        this.virtualProgress = Wormhole.rotateClamp(this.virtualProgress, 0, Wormhole.ENTITY_PRECISION, () => {
            this.backgroundR = -1;
            this.backgroundG = -1;
            this.backgroundB = -1;
        });

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

        let spaceX = Wormhole.CANVAS_WIDTH - this.scaledRectangleWidth;
        let spaceY = Wormhole.CANVAS_HEIGHT - this.scaledRectangleHeight;

        let rectPositionX = this.wormhole.sourceX;
        let rectPositionY = this.wormhole.sourceY;

        this.wormhole.canvas.save();

        this.wormhole.canvas.globalAlpha = this.opacity;
        this.wormhole.canvas.translate(rectPositionX * spaceX + this.scaledRectangleWidth / 2, rectPositionY * spaceY + this.scaledRectangleHeight / 2);
        this.wormhole.canvas.rotate(Wormhole.degreesToRadians(this.rotation));
    }

    get rectangleWidth() { return this.width * this.wormhole.maxRectangleSize * Wormhole.RECTANGLE_WIDTH; }
    get rectangleHeight() { return this.height * this.wormhole.maxRectangleSize * Wormhole.RECTANGLE_HEIGHT; }
    get scaledRectangleWidth() { return this.rectangleWidth * this.sizeMultiplier; }
    get scaledRectangleHeight() { return this.rectangleHeight * this.sizeMultiplier; }

    render()
    {
        this.tick();
        this.update();

        if (Math.min(this.rectangleWidth, this.rectangleHeight) > 10) {
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

            this.wormhole.canvas.fillStyle = `rgb(${this.targetBackgroundR}, ${this.backgroundG}, ${this.backgroundB})`;
            this.wormhole.fillCenteredRect(0, 0, this.scaledRectangleWidth, this.scaledRectangleHeight);
        }

        this.wormhole.canvas.restore();

    }

    renderFlairs()
    {
        this.update();

        this.flairs.forEach((flair) => flair.render());

        this.wormhole.canvas.restore();
    }
}

class WormholeFlair
{
    constructor(entity, wormhole, x, y, size)
    {
        this.entity = entity;
        this.wormhole = wormhole;

        this.x = x;
        this.y = y;
        this.size = size;
    }

    get flairSize() { return this.size * Wormhole.FLAIR_SIZE * Wormhole.RESOLUTION_SCALE; }

    render()
    {
        const sizeRatio = Math.sqrt(this.entity.progress);

        let flairSize = sizeRatio * this.flairSize;
        let flairSizeRatio = Math.min(1, flairSize / this.flairSize * 2);
        flairSizeRatio *= flairSizeRatio;

        if (flairSizeRatio < 0.1) {
            return;
        }

        this.wormhole.canvas.globalAlpha = Wormhole.lerp(0, this.entity.flairOpacity, flairSizeRatio);

        const xPos = -this.entity.rectangleWidth / 2 + this.entity.rectangleWidth * this.x - flairSize / 2;
        const yPos = -this.entity.rectangleHeight / 2 + this.entity.rectangleHeight * this.y - flairSize / 2;

        this.wormhole.canvas.beginPath();
        this.wormhole.canvas.arc(
            xPos,
            yPos,
            flairSize / 2,
            0,
            (Math.PI / 180) * 360
        );

        const counterRotation = -Wormhole.degreesToRadians(this.entity.rotation);
        const offsetX = Math.sin(counterRotation);
        const offsetY = Math.cos(counterRotation);
        const offset = flairSize / 6;

        const gradient = this.wormhole.canvas.createRadialGradient(
            xPos + offsetX * offset,
            yPos - offsetY * offset,
            0,
            xPos + offsetX * offset,
            yPos - offsetY * offset,
            flairSize / 2
        );

        gradient.addColorStop(0, '#afd1e5'); // rgb(175,209,229)
        gradient.addColorStop(0.45, '#73a8c2'); // rgb(115,168,194)
        gradient.addColorStop(1, '#698493') // rgb(105,132,147)

        this.wormhole.canvas.fillStyle = gradient; //'#000000';
        this.wormhole.canvas.fill()
    }
}