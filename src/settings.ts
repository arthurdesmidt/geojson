import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";
import powerbi from "powerbi-visuals-api";

class GeoJsonCard extends formattingSettings.SimpleCard {
    geoJsonUrl = new formattingSettings.TextInput({
        name: "geoJsonUrl",
        displayName: "GeoJSON URL",
        description: "Enter URL to GeoJSON file",
        value: "",
        placeholder: "Enter GeoJSON URL"
    });

    layerColor = new formattingSettings.ColorPicker({
        name: "layerColor",
        displayName: "Layer Color",
        value: { value: "#0000FF" }
    });

    opacity = new formattingSettings.NumUpDown({
        name: "opacity",
        displayName: "Layer Opacity",
        value: 70,
        options: {
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 0
            },
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 100
            }
        }
    });
    activateFilter = new formattingSettings.ToggleSwitch({
        name: "activateFilter",
        displayName: "Activate Filter",
        value: false
    });

    name: string = "geoJsonCard";
    displayName: string = "GeoJSON Filter Layer";
    slices = [this.geoJsonUrl, this.layerColor, this.opacity, this.activateFilter];
}

class MarkerStyleCard extends formattingSettings.SimpleCard {
    markerRadius = new formattingSettings.NumUpDown({
        name: "markerRadius",
        displayName: "Marker Size",
        value: 8,
        options: {
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 1
            },
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 20
            }
        }
    });

    markerColor = new formattingSettings.ColorPicker({
        name: "markerColor",
        displayName: "Fill Color",
        value: { value: "#ff7800" }
    });

    borderColor = new formattingSettings.ColorPicker({
        name: "borderColor",
        displayName: "Border Color",
        value: { value: "#000000" }
    });

    borderWidth = new formattingSettings.NumUpDown({
        name: "borderWidth",
        displayName: "Border Width",
        value: 2,
        options: {
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 0
            },
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 5
            }
        }
    });

    opacity = new formattingSettings.NumUpDown({
        name: "opacity",
        displayName: "Opacity",
        value: 80,
        options: {
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 0
            },
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 100
            }
        }
    });

    name: string = "markerStyleCard";
    displayName: string = "Marker Style";
    slices = [this.markerRadius, this.markerColor, this.borderColor, this.borderWidth, this.opacity];
}

class MapBoundsCard extends formattingSettings.SimpleCard {
    north = new formattingSettings.NumUpDown({
        name: "north",
        displayName: "North",
        value: 0,
        visible: true
    });

    south = new formattingSettings.NumUpDown({
        name: "south",
        displayName: "South",
        value: 0,
        visible: true
    });

    east = new formattingSettings.NumUpDown({
        name: "east",
        displayName: "East",
        value: 0,
        visible: true
    });

    west = new formattingSettings.NumUpDown({
        name: "west",
        displayName: "West",
        value: 0,
        visible: true
    });

    zoom = new formattingSettings.NumUpDown({
        name: "zoom",
        displayName: "Zoom",
        value: 0,
        visible: true
    });

    name: string = "mapBoundsCard";
    displayName: string = "Map Bounds";
    slices = [this.north, this.south, this.east, this.west, this.zoom];
}
class ZoomSelectionCard extends formattingSettings.SimpleCard {
    enableZoomSelection = new formattingSettings.ToggleSwitch({
        name: "enableZoomSelection",
        displayName: "Enable Selection Based on Zoom",
        description: "Enable or disable selection based on visible markers during zoom/pan.",
        value: false // Standaard uitgeschakeld
    });

    name: string = "zoomSelectionCard";
    displayName: string = "Zoom Selection Settings";
    slices = [this.enableZoomSelection];
}

class LicenseCard extends formattingSettings.SimpleCard {
    licenseKey = new formattingSettings.TextInput({
        name: "licenseKey",
        displayName: "License Key",
        description: "Enter your license key",
        value: "",
        placeholder: "Enter license key here"
    });

    validateButton = new formattingSettings.ToggleSwitch({
        name: "validateButton",
        displayName: "Validate License",
        description: "Turn on to validate your license key",
        value: false
    });
  
    name: string = "licenseCard";
    displayName: string = "License Settings";
    slices = [this.licenseKey, this.validateButton];
}

class MapSettingsCard extends formattingSettings.SimpleCard {
    zoomLevel = new formattingSettings.NumUpDown({
        name: "zoomLevel",
        displayName: "Zoom Level",
        value: 0,
        options: {
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 0
            },
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 20
            }
        }
    });

    name: string = "mapSettings";
    displayName: string = "Map Settings";
    slices = [this.zoomLevel];
}
export class ReportSettings extends formattingSettings.SimpleCard {
    sharedLicenseKey = new formattingSettings.TextInput({
        name: "sharedLicenseKey",
        displayName: "Shared License Key",
        value: "",
        placeholder: "",
        description: ""
    });

    constructor() {
        super();
        this.visible = true; // Hide the card
        this.sharedLicenseKey.visible = true; // Hide the input
    }

    name: string = "reportSettings";
    displayName: string = "Report Settings";
    slices = [this.sharedLicenseKey];
}
// Hide the report settings card from the formatting pane by setting visible to false
const reportSettingsCard = new ReportSettings();
reportSettingsCard.visible = false;
export class VisualFormattingSettingsModel extends formattingSettings.Model {
    mapSettingsCard = new MapSettingsCard();
    reportSettings = new ReportSettings();
    markerStyleCard = new MarkerStyleCard();
    geoJsonCard = new GeoJsonCard();
    mapBoundsCard = new MapBoundsCard(); 
    zoomSelectionCard = new ZoomSelectionCard(); 
    licenseCard = new LicenseCard(); // Voeg de nieuwe card toe

    cards = [this.geoJsonCard, this.zoomSelectionCard, this.markerStyleCard, this.licenseCard];
    
}