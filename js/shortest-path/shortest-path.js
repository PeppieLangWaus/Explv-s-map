'use strict';

import { Position } from '../model/Position.js';

const API_URL = "https://osrspathfinder.com/find-path";

const errorMessageMapping = {
    "BLOCKED": "Tile is blocked",
    "UNREACHABLE": "Unreachable tile",
    "NO_RESPONSE_FROM_SERVER": "No response from server",
    "UNKNOWN": "Unknown"
};

// Flattens the response's steps (alternating WALK tile-paths and LINK jumps such as
// doors/stairs/ships/teleports) into a single ordered list of Positions.
function flattenSteps(steps) {
    const positions = [];

    for (const step of steps) {
        if (step.type === 'WALK') {
            for (const point of step.path) {
                positions.push(new Position(point.x, point.y, step.plane));
            }
        } else if (step.type === 'LINK') {
            // The preceding WALK step (if any) already ends at link.start, so only the far
            // side of the link needs to be added - it may land on a different plane.
            const end = step.link.end;
            positions.push(new Position(end.x, end.y, end.plane));
        }
    }

    return positions;
}

export function getPath({start, end, onSuccess, onError}) {
    fetch(API_URL, {
        method: 'POST',
        headers: {
            'accept': 'application/json',
            'content-type': 'application/json'
        },
        body: JSON.stringify({
            "start": {
                "x": start.x,
                "y": start.y,
                "plane": start.z
            },
            "end": {
                "x": end.x,
                "y": end.y,
                "plane": end.z
            },
            "algo": "A_STAR"
        })
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('NO_RESPONSE_FROM_SERVER');
            }
            return response.json();
        })
        .then(data => {
            const result = data['result'];

            if (result['type'] !== 'SUCCESS') {
                onError(start, end, errorMessageMapping[result['type']] || errorMessageMapping['UNKNOWN']);
            } else {
                onSuccess(flattenSteps(result['steps']));
            }
        })
        .catch(() => {
            onError(start, end, errorMessageMapping['NO_RESPONSE_FROM_SERVER']);
        });
}
