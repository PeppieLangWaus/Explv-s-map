'use strict';

import { Position } from './model/Position.js';
import { Area } from './model/Area.js';

const MESSAGE_SOURCE = 'explv-map-embed';
const DEFAULT_COLOR = '#33b5e5';
const DESCRIPTION_ID = 'embed-description-banner';

/** Lets an embedding parent (e.g. an <iframe> host page) draw dax paths and rectangles on
 *  the map by `postMessage`-ing position data in, since it can't reach into this page's DOM
 *  directly across origins. Mirrors what the in-page "Dax Path"/"Area" collection tools draw,
 *  but is driven by data instead of mouse clicks.
 *
 *  Expected message shape (all fields under `positions`/`start`/`end` are `{x, y, plane?}`):
 *    { source: 'explv-map-embed', type: 'set-overlays',
 *      paths: [{ positions: [...], color?, weight?, opacity? }],
 *      rectangles: [{ start, end, color?, fillOpacity? }],
 *      description?: string }
 *    { source: 'explv-map-embed', type: 'clear-overlays' }
 *
 *  `description`, if given, is shown as a single line of text across the top of the map in a
 *  semi-transparent black bar - e.g. to caption the path/area currently drawn. It's rendered
 *  via `textContent`, never `innerHTML`, since it comes from a postMessage payload the embedder
 *  controls. Omitting the field leaves any existing description as-is; `clear-overlays`, or an
 *  explicit empty string, removes it.
 *
 *  On init, posts `{ source: 'explv-map-embed', type: 'ready' }` to the parent window so it
 *  knows it's safe to start sending overlay data (there'd otherwise be a race where it posts
 *  before this listener exists).
 *
 *  Also locks scroll-wheel zoom until the map is clicked, and re-locks it once the cursor
 *  leaves — otherwise scrolling the host page past the map hijacks the scroll into a zoom
 *  instead, the moment the cursor happens to be over the iframe. */
export function initEmbedOverlays(map) {
    const overlayGroup = L.featureGroup().addTo(map);

    function clear() {
        overlayGroup.clearLayers();
    }

    function setDescription(text) {
        let banner = document.getElementById(DESCRIPTION_ID);

        if (!text) {
            if (banner) banner.remove();
            return;
        }

        if (!banner) {
            banner = document.createElement('div');
            banner.id = DESCRIPTION_ID;
            map.getContainer().appendChild(banner);
        }

        banner.textContent = text;
    }

    function addPath(path) {
        const positions = (path.positions || []).map((p) => new Position(p.x, p.y, p.plane ?? 0));
        if (positions.length === 0) return;

        L.polyline(
            positions.map((p) => p.toCentreLatLng(map)),
            {
                color: path.color || DEFAULT_COLOR,
                weight: path.weight ?? 3,
                opacity: path.opacity ?? 0.9,
            }
        ).addTo(overlayGroup);
    }

    function addRectangle(rect) {
        if (!rect.start || !rect.end) return;

        const area = new Area(
            new Position(rect.start.x, rect.start.y, rect.start.plane ?? 0),
            new Position(rect.end.x, rect.end.y, rect.end.plane ?? 0)
        );
        const layer = area.toLeaflet(map);
        layer.setStyle({
            color: rect.color || DEFAULT_COLOR,
            fillOpacity: rect.fillOpacity ?? 0.15,
        });
        layer.addTo(overlayGroup);
    }

    function setOverlays(data) {
        clear();
        (data.paths || []).forEach(addPath);
        (data.rectangles || []).forEach(addRectangle);

        if ('description' in data) {
            setDescription(data.description);
        }
    }

    window.addEventListener('message', (event) => {
        const msg = event.data;
        if (!msg || msg.source !== MESSAGE_SOURCE) return;

        if (msg.type === 'set-overlays') {
            setOverlays(msg);
        } else if (msg.type === 'clear-overlays') {
            clear();
            setDescription(undefined);
        }
    });

    if (window.parent !== window) {
        map.scrollWheelZoom.disable();
        const container = map.getContainer();
        container.addEventListener('click', () => map.scrollWheelZoom.enable());
        container.addEventListener('mouseleave', () => map.scrollWheelZoom.disable());

        window.parent.postMessage({ source: MESSAGE_SOURCE, type: 'ready' }, '*');
    }
}
