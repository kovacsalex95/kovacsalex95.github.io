window.addEventListener('load', () => new Wormhole());

class Wormhole
{
    static get ENTITY_COUNT() { return 50; }
    static get ENTITY_SPEED() { return -0.25 / 1000; }
    static get GRADIENT_SIZE() { return 0.6; }
    static get SHOCKWAVE_SIZE_MULTIPLIER() { return 0.75; }
    static get SHOCKWAVE_MAX_DISTANCE() { return 0.2; }
    static get SHOCKWAVE_SPEED_MULTIPLIER() { return 20; }
    static get FLAIR_MIN_COUNT() { return 0; }
    static get FLAIR_MAX_COUNT() { return 4; }
    static get FLAIR_MIN_SIZE() { return 0.4; }
    static get FLAIR_MAX_SIZE() { return 1.2; }
    static get FLAIR_PADDING() { return -0.1; }

    get maxRectangleSize() { return Math.min(this.canvasWidth, this.canvasHeight); }
    get gradientSize() { return this.maxRectangleSize * Wormhole.GRADIENT_SIZE; }
    get shockwaveSquared() { return this.shockWave * this.shockWave; }

    constructor()
    {
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

        this.canvasElement.width = window.innerWidth;
        this.canvasElement.height = window.innerHeight;

        addEventListener('resize', () => {
            this.canvasElement.width = window.innerWidth;
            this.canvasElement.height = window.innerHeight;
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
        this.canvasWidth = this.canvasElement.width;
        this.canvasHeight = this.canvasElement.height;

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
            this.canvasWidth,
            this.canvasHeight
        );

        this.canvas.fillStyle = this.getFillGradient();
        this.fillCenteredRect(
            this.sourceX * this.canvasWidth,
            this.sourceY * this.canvasHeight,
            this.gradientSize,
            this.gradientSize
        );

        this.shockWave += Wormhole.ENTITY_SPEED * Wormhole.SHOCKWAVE_SPEED_MULTIPLIER;
        this.shockWave = Wormhole.rotateClamp(this.shockWave);

        this.entities.forEach((entity) => entity.update());
    }

    getFillGradient()
    {
        let gradient = this.canvas.createRadialGradient(
            this.sourceX * this.canvasWidth,
            this.sourceY * this.canvasHeight,
            0,
            this.sourceX * this.canvasWidth,
            this.sourceY * this.canvasHeight,
            this.gradientSize
        );

        gradient.addColorStop(0, '#dadde5');
        gradient.addColorStop(0.5, '#C6DAE4');

        return gradient;
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

    static lerp(a, b, t, clamp = true)
    {
        let diff = b - a;
        let tt = clamp ? Math.max(0, Math.min(1, t)) : t;
        return a + diff * tt;
    }

    static rotateClamp(value, min = 0, max = 1)
    {
        let result = value;
        let diff = Math.abs(max - min);

        while (result < min) {
            result += diff;
        }

        while (result > max) {
            result -= diff;
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
}

class WormholeEntity
{
    constructor(wormhole, progress)
    {
        this.wormhole = wormhole;

        this.progress = progress;
        this.width = 0;
        this.height = 0;
        this.opacity = 0;
        this.flairOpacity = 0;
        this.rotation = 0;
        this.flairs = [];

        this.generateFlairs();
        this.update(0);
    }

    generateFlairs()
    {
        this.flairs = [];
        let flairCount = Math.round(Wormhole.random(Wormhole.FLAIR_MIN_COUNT, Wormhole.FLAIR_MAX_COUNT));

        for (let i = 0; i < flairCount; i++) {
            this.flairs[i] = new WormholeFlair(
                this.wormhole,
                Wormhole.random(Wormhole.FLAIR_PADDING, 1 - Wormhole.FLAIR_PADDING),
                Wormhole.random(Wormhole.FLAIR_PADDING, 1 - Wormhole.FLAIR_PADDING),
                Wormhole.random(Wormhole.FLAIR_MIN_SIZE, Wormhole.FLAIR_MAX_SIZE)
            );
        }
    }

    update()
    {
        this.progress += Wormhole.ENTITY_SPEED;
        this.progress = Wormhole.rotateClamp(this.progress);

        this.width = this.progress * this.progress * 2;
        this.height = this.progress * this.progress * 2;

        this.opacity = Wormhole.cutoff(this.progress, 0.5, 0, 0.7, 0);
        this.rotation = Wormhole.cutoff(this.progress, 0.55, -90, 420, 240);
        //this.flairOpacity = Wormhole.cutoff(this.progress, 0.4, 0, 0.9, 0, 0.5);

        let flairFade = 0.4;
        let flairFadeMax = 0.5;
        this.flairOpacity = Wormhole.lerp(0, 0.8, this.progress * 2);
        if (this.progress > flairFade) {
            let zeroRatio = Math.min(1, (this.progress - flairFade) / (1 - flairFadeMax));
            this.flairOpacity = Wormhole.lerp(Wormhole.lerp(0, 0.8, flairFade * 2), 0, zeroRatio);
        }

        this.render();
    }

    render()
    {
        let progress = this.progress;

        let shockwaveMaxDistanceFaded = Wormhole.lerp(Wormhole.SHOCKWAVE_MAX_DISTANCE, 0, Math.sqrt(progress));
        let progressDistance = Wormhole.distanceMultiplier(progress, this.wormhole.shockwaveSquared, shockwaveMaxDistanceFaded, true);

        let sizeMultiplier = Wormhole.lerp(1, Wormhole.SHOCKWAVE_SIZE_MULTIPLIER, Wormhole.lerp(progressDistance, 0, progress * 2));

        let rectWidth = this.width * this.wormhole.maxRectangleSize * 2.5;
        let rectHeight = this.height * this.wormhole.maxRectangleSize * 1.7;

        if (rectHeight < 10) {
            return;
        }

        let originalRectWidth = rectWidth;
        let originalRectHeight = rectHeight;
        rectWidth *= sizeMultiplier;
        rectHeight *= sizeMultiplier;

        let sizeRatio = originalRectHeight / this.wormhole.maxRectangleSize;

        let spaceX = this.wormhole.canvasWidth - rectWidth;
        let spaceY = this.wormhole.canvasHeight - rectHeight;

        let rectPositionX = this.wormhole.sourceX;
        let rectPositionY = this.wormhole.sourceY;

        this.wormhole.canvas.save();

        this.wormhole.canvas.globalAlpha = this.opacity;
        this.wormhole.canvas.translate(rectPositionX * spaceX + rectWidth / 2, rectPositionY * spaceY + rectHeight / 2);
        this.wormhole.canvas.rotate((Math.PI / 180) * this.rotation);

        this.wormhole.strokeCenteredRect(0, 0, rectWidth, rectHeight);

        this.flairs.forEach((flair) => flair.render(sizeRatio, this.flairOpacity, originalRectWidth, originalRectHeight));

        this.wormhole.canvas.restore();
    }
}

class WormholeFlair
{
    constructor(wormhole, x, y, size)
    {
        this.wormhole = wormhole;

        this.x = x;
        this.y = y;
        this.size = size;
    }

    render(sizeRatio, opacity, originalRectWidth, originalRectHeight)
    {
        let flairSize = this.size * sizeRatio * (this.wormhole.maxRectangleSize / 100);
        let flairSizeRatio = Math.min(1, flairSize / 5);

        if (flairSizeRatio < 0.01) {
            return;
        }

        this.wormhole.canvas.globalAlpha = Wormhole.lerp(0, opacity, flairSizeRatio);
        this.wormhole.canvas.strokeRect(
            -originalRectWidth / 2 + originalRectWidth * this.x - flairSize / 2,
            -originalRectHeight / 2 + originalRectHeight * this.y - flairSize / 2,
            flairSize,
            flairSize
        );
    }
}
