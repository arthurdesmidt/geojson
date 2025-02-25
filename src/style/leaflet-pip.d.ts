import * as L from 'leaflet';

declare module 'leaflet' {
    namespace pip {
        function pointInLayer(
            point: [number, number],
            layer: L.GeoJSON,
            first?: boolean
        ): L.Layer[];
    }
}

declare global {
    interface Window {
        leafletPip: {
            pointInLayer: (
                point: [number, number],
                layer: L.GeoJSON,
                first?: boolean
            ) => L.Layer[];
        };
    }
}