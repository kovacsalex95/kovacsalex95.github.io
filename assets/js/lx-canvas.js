class LxCanvas
{
    constructor(domSelector)
    {
        this.layers = {};
        this.element = document.querySelector(domSelector);
        this.css('position', 'relative');
    }

    addLayer(name)
    {
        if (name in this.layers) {
            console.error('This layer name already user');
            return false;
        }

        this.layers[name] = new LxCanvasLayer(this, Object.keys(this.layers).length).instantiate();
        return true;
    }

    getLayer(name)
    {
        return this.layers[name] ?? null;
    }

    css(property, value)
    {
        LxCanvas.setCss(this.element, property, value);
    }

    static setCss(element, property, value)
    {
        element.style.setProperty(property, value);
    }
}

class LxCanvasLayer
{
    constructor(canvas, index)
    {
        this.canvas = canvas;
        this.index = index;
        this.entities = [];
    }

    instantiate()
    {
        this.element = document.createElement('div');
        this.element.classList.add('layer');

        console.log(this.canvas.element);
        this.canvas.element.appendChild(this.element);
        this.css('position', 'absolute');
        this.css('top', LxUnit.px(0));
        this.css('left', LxUnit.px(0));
        this.css('width', LxUnit.percent(100));
        this.css('height', LxUnit.percent(100));
        this.css('z-index', this.index);
        this.css('overflow', 'hidden');
        this.css('display', 'flex');
        this.css('align-items', 'stretch');
        this.css('justify-content', 'stretch');

        this.innerElement = document.createElement('div');
        this.innerElement.classList.add('inner-layer');
        this.element.appendChild(this.innerElement);
        this.innerElement.style.setProperty('position', 'relative');
        this.innerElement.style.setProperty('flex-grow', '1');

        return this;
    }

    createRectangle(x, y, width, height, pivotX = 0, pivotY = 0)
    {
        const rectangle = new LxCanvasRectangle(this, x, y, width, height, pivotX, pivotY).instantiate();
        this.entities.push(rectangle);

        return rectangle;
    }

    css(property, value)
    {
        LxCanvas.setCss(this.element, property, value);
    }
}

class LxCanvasEntity
{
    constructor(canvasLayer)
    {
        this.canvasLayer = canvasLayer;
        this.x = 0;
        this.y = 0;
    }

    instantiate()
    {
        this.element = document.createElement('div');
        this.element.classList.add('entity');
        this.canvasLayer.innerElement.appendChild(this.element);
        this.css('position', 'absolute');

        return this;
    }

    css(property, value)
    {
        LxCanvas.setCss(this.element, property, value);
    }
}

class LxCanvasRectangle extends LxCanvasEntity
{
    constructor(canvasLayer, x, y, width, height, pivotX = 0, pivotY = 0)
    {
        super(canvasLayer);
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.pivotX = pivotX;
        this.pivotY = pivotY;
    }

    instantiate()
    {
        super.instantiate();

        this.element.classList.add('rectangle');
        this.css('left', this.x);
        this.css('top', this.y);
        this.css('width', this.width);
        this.css('height', this.height);

        return this;
    }
}

class LxUnit
{
    static round(value, precision = 0)
    {
        const divider = Math.pow(10, precision);
        return Math.round(value * divider) / divider;
    }

    static suffix(value, suffix, precision = 0)
    {
        return LxUnit.round(value, precision).toString() + suffix;
    }

    static px(value)
    {
        return LxUnit.suffix(value, 'px');
    }

    static pt(value)
    {
        return LxUnit.suffix(value, 'pt', 2);
    }

    static rem(value)
    {
        return LxUnit.suffix(value, 'rem', 3);
    }

    static percent(value)
    {
        return LxUnit.suffix(value, '%', 3);
    }
}