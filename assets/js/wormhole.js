document.addEventListener('DOMContentLoaded', () => new Wormhole());

class Wormhole
{
    constructor()
    {
        this.wormholeContainer = document.getElementById('wormhole');
        this.ellipsesContainer = this.wormholeContainer.querySelector('#ellipses[data-entities]');

        this.proceduralCSS = '';

        this.entities = [];
        this.initEllipses();
    }

    initEllipses()
    {
        const entityCount = parseInt(this.ellipsesContainer.getAttribute('data-entities'));
        const entityFragment = 1.0 / entityCount;
        const roundedEntityFragment = Math.round(entityFragment * 10000) / 10000;
        const animationDuration = parseFloat(this.ellipsesContainer.getAttribute('data-duration') ?? 5);
        this.ellipsesContainer.style.setProperty('--duration', `${animationDuration}s`);
        this.ellipsesContainer.style.setProperty('--opacity', roundedEntityFragment.toString());

        for (let i = 0; i < entityCount; i++) {
            const entityProgress = i * entityFragment;
            const roundedEntityProgress = Math.round(entityProgress * 10000) / 10000.0;
            const delay = Math.round(animationDuration * entityProgress * 10000) / 10000.0;

            const entityElement = document.createElement('div');
            entityElement.id = `entity-${i}`;

            entityElement.classList.add('entity');
            entityElement.style.setProperty('--delay', `-${delay}s`);

            this.ellipsesContainer.appendChild(entityElement);
        }
    }
}