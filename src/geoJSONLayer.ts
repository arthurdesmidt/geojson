import * as L from 'leaflet';

export class GeoJSONLayer {
    private color: string = 'blue'; // Default color
    private opacity: number = 0.5;  // Default opacity
    private geoJSONLayer: L.GeoJSON | null = null; // Store the GeoJSON layer

    constructor(private map: L.Map) {
        // Ensure the map is properly assigned
        if (!map) {
            throw new Error('Map instance is required for GeoJSONLayer');
        }
    }

    // Load GeoJSON data and add it to the map
    loadGeoJSON(data: any) {
        if (this.geoJSONLayer) {
            // Remove the existing layer if it exists
            this.map.removeLayer(this.geoJSONLayer);
            console.log('geojsonlaag verwijderd')
        }

        // Add the new GeoJSON layer to the map
        this.geoJSONLayer = L.geoJSON(data, {
            style: this.getStyle()
          
        }).addTo(this.map);
        console.log('geojsonlaag toegevoegd')
    }

    // Get the current style (color and opacity)
    getStyle(): L.PathOptions {
        return {
            color: this.color,
            opacity: this.opacity,
            fillOpacity: this.opacity // Als je fillOpacity ook wilt aanpassen
        };
    }

    // Update the style of the GeoJSON layer (if it exists)
    updateGeoJSONLayerStyle() {
        if (this.geoJSONLayer) {
            this.geoJSONLayer.setStyle(this.getStyle());
        }
    }

    // Set a new color and update the style
    setColor(newColor: string) {
        if (this.color !== newColor) {
            this.color = newColor;
            this.updateGeoJSONLayerStyle();
        }
    }

    // Set a new opacity and update the style
    setOpacity(newOpacity: number) {
        console.log('Setting opacity to:', newOpacity); // Debugging
        if (this.opacity !== newOpacity) {
            this.opacity = newOpacity;
            this.updateGeoJSONLayerStyle();
        }
    }

    // Expose the internal GeoJSON layer
    getGeoJSONLayer(): L.GeoJSON | null {
        return this.geoJSONLayer;
    }
   
}

