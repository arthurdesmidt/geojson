import "./../style/visual.less";
import "./../node_modules/leaflet/dist/leaflet.css";
import powerbi from "powerbi-visuals-api";
import * as L from "leaflet";
import * as leafletPip from '@mapbox/leaflet-pip';
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import { VisualFormattingSettingsModel, ReportSettings } from "./settings";
import RBush from 'rbush';
import { GeoJSONLayer} from './geoJSONLayer';
import { isValidLicense } from './licenseKeys';

//import 'leaflet-editable';
import * as _ from 'lodash';

// Import necessary Power BI types
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;
import ISelectionManager = powerbi.extensibility.ISelectionManager;

export class Visual implements IVisual {
    private target: HTMLElement;
    private map: L.Map;
    private geoJSONLayer: GeoJSONLayer;
    private formattingSettings: VisualFormattingSettingsModel;
    private formattingSettingsService: FormattingSettingsService;
    private recordWarningElement: HTMLElement;
    private host: powerbi.extensibility.visual.IVisualHost;
    private selectionManager: ISelectionManager;
    private pointsLayer: L.LayerGroup; // Layer for all points
    private selectedPointsLayer: L.LayerGroup; // Layer for selected points (inside GeoJSON)
    private unselectedPointsLayer: L.LayerGroup; // Layer for unselected points (outside GeoJSON)
    private geoJsonLayer: L.GeoJSON;
    private lastDataView: powerbi.DataView;
    private layerControl: L.Control.Layers;
    private timerElement: HTMLElement;
    private geoJsonIndex = new RBush();
    private currentGeoJsonColor: string = '';
    private currentGeoJsonOpacity: number = 0.5;
    private currentGeoJsonUrl: string = '';
    private previousFilterState: boolean = false;
    private progressElement: HTMLElement;
    private isInitialLoad: boolean = true; // Vlag voor initiële opbouw
    private previousRowCount: number = 0;
    private areMapBoundsInitialized: boolean = false;
    private debouncedSaveMapBounds: _.DebouncedFunc<() => void>;
    private isFirstLoad: boolean = true;
    private wasHidden: boolean = false;
    private previousDataLength: number = 0;
    previousMarkerColor: string = '';
    previousBorderColor: string = '';
    previousBorderWidth: number = 0;
    previousOpacity: number = 0;
    previousMarkerRadius: number = 0;
    private licenseValidated: boolean = false;
   
    constructor(options: VisualConstructorOptions) {
        console.log('Visual constructor called');

        // Check if options are provided
        if (!options) {
            console.error('No options provided');
            return;
        }
    
        // Store the target element (where the visual will be rendered)
        this.target = options.element;
        if (!this.target) {
            console.error('Target element is null');
            return;
        }
        
        console.log('Target element:', this.target);
        this.host = options.host;
        
        // Create timer element
        this.timerElement = document.createElement('div');
        this.timerElement.style.position = 'absolute';
        this.timerElement.style.top = '10px';
        this.timerElement.style.left = '10px';
        this.timerElement.style.zIndex = '1000';
        this.timerElement.style.backgroundColor = 'white';
        this.timerElement.style.padding = '5px';
        this.timerElement.style.border = '1px solid black';
        this.timerElement.style.display = 'none'; // Hide initially, show only when needed
        this.target.appendChild(this.timerElement);
    
        this.recordWarningElement = document.createElement('div');
this.recordWarningElement.style.position = 'absolute';
this.recordWarningElement.style.top = '10px';
this.recordWarningElement.style.left = '50px'; // Position to the left of layer control
this.recordWarningElement.style.zIndex = '1000';
this.recordWarningElement.style.backgroundColor = '#f8d7da'; // Light red background
this.recordWarningElement.style.color = '#721c24'; // Dark red text
this.recordWarningElement.style.padding = '8px 12px';
this.recordWarningElement.style.border = '1px solid #f5c6cb';
this.recordWarningElement.style.borderRadius = '4px';
this.recordWarningElement.style.fontWeight = 'bold';
this.recordWarningElement.style.display = 'none'; // Hide initially
this.recordWarningElement.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
this.recordWarningElement.setAttribute('role', 'alert'); // For accessibility
this.recordWarningElement.innerText = '> 30,000 records. Use filters to reduce selection.';
this.target.appendChild(this.recordWarningElement);

        // Initialize selection manager
        this.selectionManager = this.host.createSelectionManager();
    
        // Initialize formatting settings service
        this.formattingSettingsService = new FormattingSettingsService();
        console.log('Formatting settings service initialized');
        
        // Initialize default formatting settings
        this.formattingSettings = new VisualFormattingSettingsModel();

        if (!this.formattingSettings.reportSettings) {
            this.formattingSettings.reportSettings = new ReportSettings();
        }
        
        // Add visibility change listener
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                console.log('Page hidden - saving state');
                this.wasHidden = true;
            }
        });
    
        try {
            // Initialize the Leaflet map
        
            this.map = L.map(this.target, {
                center: [52.505, 4.89], // Default center (Amsterdam)
                zoom: 11, // Default zoom level
                zoomControl: true
            });
            
            console.log('Map initialized');
    
            // Add a tile layer (OpenStreetMap)
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(this.map);
            
         
    
            // Initialize the GeoJSONLayer
            this.geoJSONLayer = new GeoJSONLayer(this.map);
            console.log('GeoJSON layer initialized');
            
            // Initialize layer groups
            this.pointsLayer = L.layerGroup().addTo(this.map);
            this.selectedPointsLayer = L.layerGroup().addTo(this.map);
            this.unselectedPointsLayer = L.layerGroup().addTo(this.map);
            console.log('Layer groups initialized');
    
            // Set zIndex for the points layers
            this.pointsLayer.eachLayer((layer: L.Layer) => {
                if (layer instanceof L.FeatureGroup) {
                    layer.setZIndex(200); // Punten op de voorgrond
                }
            });
    
            this.selectedPointsLayer.eachLayer((layer: L.Layer) => {
                if (layer instanceof L.FeatureGroup) {
                    layer.setZIndex(200); // Geselecteerde punten op de voorgrond
                }
            });
    
            this.unselectedPointsLayer.eachLayer((layer: L.Layer) => {
                if (layer instanceof L.FeatureGroup) {
                    layer.setZIndex(200); // Niet-geselecteerde punten op de voorgrond
                }
            });
            
            // Initialize layer control
            const baseLayers = {
                "OpenStreetMap": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap contributors',
                    zIndex: 100 // Zorg ervoor dat de kaart op de achtergrond blijft
                })
            };
            
            const overlayLayers = {
                "Points": this.pointsLayer,
                "Selected Points": this.selectedPointsLayer,
                "Unselected Points": this.unselectedPointsLayer
            };
            
            // Add GeoJSON Layer only if it exists
            const geoJsonLayer = this.geoJSONLayer.getGeoJSONLayer();
            
            if (geoJsonLayer) {
                overlayLayers["GeoJSON Layer"] = geoJsonLayer;
                this.geoJsonLayer.eachLayer((layer: L.Layer) => {
                    if (layer instanceof L.FeatureGroup) {
                        layer.setZIndex(150); // laag in het midden
                    }
                });
            }
            
            this.layerControl = L.control.layers(baseLayers, overlayLayers).addTo(this.map);
            console.log('Layer control added');
            
            this.setupMapEventListeners();
            console.log('Map event listeners set up');
            
            // Initialize state variables
            this.currentGeoJsonUrl = '';
            this.previousFilterState = false;
            this.licenseValidated = false;
            this.previousMarkerColor = '';
            this.previousBorderColor = '';
            this.previousBorderWidth = 0;
            this.previousOpacity = 0;
            this.previousMarkerRadius = 0;
            
            // Show default license warning
            this.showLicenseWarning();
            console.log('Visual constructor completed successfully');
        } catch (error) {
            console.error('Error initializing visual:', error);
        }
    }

    public update(options: VisualUpdateOptions) {

        console.log('Update called with type:', options.type);

        if (!this.target.offsetParent) {
            console.log('Visual is not active, marking as hidden');
            this.wasHidden = true;
            return;
        }
    
        console.log('Update called, firstLoad:', this.isFirstLoad, 'wasHidden:', this.wasHidden);
    
        // Check if data is available
        if (!options.dataViews || !options.dataViews[0]) {
            console.log('No data available');
            return;
        }

        // Save the last data view
        const currentDataView = options.dataViews[0];
        this.lastDataView = currentDataView;
        this.checkRecordCount();
        // Update formatting settings first
        this.formattingSettings = this.formattingSettingsService.populateFormattingSettingsModel(
            VisualFormattingSettingsModel,
            this.lastDataView
        );
        
        console.log('Formatting settings updated:', 
            this.formattingSettings ? 'Success' : 'Failed', 
            'Cards available:', 
            this.formattingSettings ? Object.keys(this.formattingSettings).join(', ') : 'None'
        );
        // Initialiseer van opgeslagen instellingen - deze moet vóór de andere checks
        this.initializeFromPersistedSettings(currentDataView);


        const sharedKey = this.getReportLevelLicenseKey(this.lastDataView);
    if (sharedKey) {
        console.log('Found shared license key at report level:', sharedKey);
        // Update local settings
        this.formattingSettings.reportSettings.sharedLicenseKey.value = sharedKey;
        this.formattingSettings.licenseCard.licenseKey.value = sharedKey;
        
        // Validate if needed
        if (!this.licenseValidated) {
            this.validateLicense();
        }
    } else {
        // Fall back to other methods
        this.initializeFromPersistedSettings(this.lastDataView);
        this.checkStoredLicenseKey();
    }
    

        // Check if validate button was pressed
        // Check for validate button state change
        const validateButtonState = this.formattingSettings.licenseCard?.validateButton;
        console.log('Validate button state:', validateButtonState);
        
        if (validateButtonState) {
            console.log('Validate button is ON, triggering validation');
            
            // Reset the button state
            this.host.persistProperties({
                merge: [{
                    objectName: 'licenseCard',
                    properties: { validateButton: false },
                    selector: null
                }]
            });

        // Get the current license key
        const licenseKey = this.formattingSettings.licenseCard.licenseKey.value;
        if (licenseKey) {
            console.log('License key found, starting validation and persistence');
            // Store it at report level before validation
            this.persistSharedLicenseKey(licenseKey);
            this.validateLicense();
        } else {
            console.log('No license key provided');
            this.showLicenseWarning();
        }
    }
    
        // Get the current number of rows
        const currentRowCount = currentDataView.table?.rows?.length || 0;
    
        // Check if the number of rows has changed
        const isRowCountChanged = currentRowCount !== this.previousRowCount;
        console.log('row count changed', isRowCountChanged, currentRowCount, this.previousRowCount);
        
        // Update the previous row count
        this.previousRowCount = currentRowCount;
    
        if (this.lastDataView.table) {
            console.log('Table columns:', this.lastDataView.table.columns);
            console.log('Number of rows:', this.lastDataView.table.rows.length);
        } else {
            console.log('No table data available');
        }
    
        // Handle GeoJSON updates
        const geoJsonUrl = this.formattingSettings.geoJsonCard.geoJsonUrl.value;
        const urlChanged = geoJsonUrl !== this.currentGeoJsonUrl;
        
        // Handle GeoJSON updates if URL changed
      
            if (this.lastDataView) {
                if (!geoJsonUrl || geoJsonUrl === '') {
                    console.log('GeoJSON URL removed or reset, removing GeoJSON layer...');
                    console.log('GeoJSON URL is empty, disabling filter...');
                    this.formattingSettings.geoJsonCard.activateFilter.visible = false;
                    this.removeGeoJSONLayer();
                    this.currentGeoJsonUrl = ''; // Reset the current URL
                } else if (urlChanged) {
                    console.log('GeoJSON URL changed:', geoJsonUrl);
                    // Validate and update only if valid
                    if (this.validateGeoJsonUrl(geoJsonUrl)) {
                        this.currentGeoJsonUrl = geoJsonUrl;
                        this.loadGeoJSONData(geoJsonUrl);
                        this.formattingSettings.geoJsonCard.activateFilter.visible = true;
                    } else {
                        // If URL is invalid, reset the URL in the formatting settings
                        this.formattingSettings.geoJsonCard.geoJsonUrl.value = this.currentGeoJsonUrl;
                    }
                }
            }
    
        console.log('geojsonlaag settings kleur en opacity'); 
        const GeoJsonColor = this.formattingSettings.geoJsonCard.layerColor.value.value;
        if (GeoJsonColor != this.currentGeoJsonColor) {
            this.currentGeoJsonColor = GeoJsonColor;
            this.geoJSONLayer.setColor(GeoJsonColor);
        }
    
        const GeoJsonOpacity = this.formattingSettings.geoJsonCard.opacity.value / 100;
        if (GeoJsonOpacity != this.currentGeoJsonOpacity) {
            this.currentGeoJsonOpacity = GeoJsonOpacity;
            this.geoJSONLayer.setOpacity(GeoJsonOpacity);
        }
    
        const isMarkerStyleChanged =
            this.formattingSettings.markerStyleCard.markerColor.value.value !== this.previousMarkerColor ||
            this.formattingSettings.markerStyleCard.borderColor.value.value !== this.previousBorderColor ||
            this.formattingSettings.markerStyleCard.borderWidth.value !== this.previousBorderWidth ||
            this.formattingSettings.markerStyleCard.opacity.value !== this.previousOpacity ||
            this.formattingSettings.markerStyleCard.markerRadius.value !== this.previousMarkerRadius;
    
        if (isMarkerStyleChanged) { 
            this.updateMarkerStyle();
        }
    
        // Update previous marker style values
        this.previousMarkerColor = this.formattingSettings.markerStyleCard.markerColor.value.value;
        this.previousBorderColor = this.formattingSettings.markerStyleCard.borderColor.value.value;
        this.previousBorderWidth = this.formattingSettings.markerStyleCard.borderWidth.value;
        this.previousOpacity = this.formattingSettings.markerStyleCard.opacity.value;
        this.previousMarkerRadius = this.formattingSettings.markerStyleCard.markerRadius.value;
    
        // First load handling
        if (this.isInitialLoad) {
            console.log('First load - drawing initial points');
            const markers = this.drawPoints(this.lastDataView);
            if (this.isInitialLoad && markers.length > 0) {
                console.log('first load executed', this.isInitialLoad, 'markerslength', markers.length);
                this.map.fitBounds(L.latLngBounds(markers), {
                    padding: [50, 50],
                    maxZoom: 15
                });
                this.isInitialLoad = false;
                this.updateMarkerStyle();
            }
        }
    
        // Row count changed handling
        if (isRowCountChanged) {
            console.log('Row count changed -draw changes');
            this.updateVisualBasedOnFilters();
        }
    
        console.log("einde instellen staat van markers");
    
        const isFilterActivated = this.formattingSettings.geoJsonCard.activateFilter.value;
        if (isFilterActivated !== this.previousFilterState) {
            if (isFilterActivated) {
                console.log('Filter is activated, applying GeoJSON filter...', isFilterActivated, this.previousFilterState);
                this.applyGeoJSONFilter();
            } else {
                console.log('Filter is deactivated, resetting GeoJSON filter...', isFilterActivated, this.previousFilterState);
                this.resetGeoJSONFilter();
                const markers = this.drawPoints(this.lastDataView);
                this.updateMarkerStyle();
            }
    
            // Update the previous filter state
            this.previousFilterState = isFilterActivated;
        }

    }

    private checkRecordCount() {
        if (!this.lastDataView?.table?.rows) return;
        
        const rowCount = this.lastDataView.table.rows.length;
        
        if (rowCount >= 30000) {
            this.recordWarningElement.style.display = 'block';
        } else {
            this.recordWarningElement.style.display = 'none';
        }
    }

    private validateLicense() {
        console.log('Validate license called');
        
        if (!this.formattingSettings?.licenseCard) {
            console.error('No formatting settings available');
            return;
        }
        
        const licenseKey = this.formattingSettings.licenseCard.licenseKey.value;
        console.log('Current license key:', licenseKey);
        
        if (!licenseKey) {
            console.log('No license key provided');
            this.showLicenseWarning();
            return;
        }
        
        // Check if the license is already validated with the same key to avoid 
        // showing the message again on map interactions
        if (this.licenseValidated && isValidLicense(licenseKey)) {
            console.log('License already validated, skipping message');
            return;
        }
        
        if (isValidLicense(licenseKey)) {
            console.log('License valid, enabling functionality');
            this.licenseValidated = true;
            
            // Store in report settings
            this.persistSharedLicenseKey(licenseKey);
            
            // Remove watermark and show success
            this.enableFullFunctionality();
            
            // Only show success message when the license is newly validated
            this.showLicenseMessage('License validated successfully!', 'success');
        } else {
            console.log('License invalid');
            this.licenseValidated = false;
            this.showLicenseWarning();
        }
    }
    

    private showLicenseWarning() {
        console.log('Showing license warning');
        
        // Remove any existing watermark first
        const existingWatermark = this.target.querySelector('.license-watermark');
        if (existingWatermark) {
            existingWatermark.remove();
        }
    
        // Create a container for the watermark
        const watermarkContainer = document.createElement('div');
        watermarkContainer.className = 'license-watermark';
        watermarkContainer.style.position = 'absolute';
        watermarkContainer.style.bottom = '10px';
        watermarkContainer.style.left = '50%';
        watermarkContainer.style.transform = 'translateX(-50%)';
        watermarkContainer.style.zIndex = '1000';
        watermarkContainer.style.display = 'flex';
        watermarkContainer.style.alignItems = 'center';
        watermarkContainer.style.textDecoration = 'none';
        
        // Create the logo image
        const logo = document.createElement('img');
        logo.src = 'data:image/png;base64,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';
        logo.style.height = '38px'; // 28pt font size plus 5px padding top and bottom
        logo.style.marginRight = '10px';
        logo.style.opacity = '0.5'; // Semi-transparent
        
        // Create the text element
        const text = document.createElement('span');
        text.style.color = 'rgba(0, 0, 0, 0.5)';
        text.style.fontSize = '28px';
        text.innerText = 'BIMappy Unlicensed';
        
        // Create a link that wraps everything
        const link = document.createElement('a');
        link.href = 'https://www.bimappy.nl';
        link.target = '_blank';
        link.style.display = 'flex';
        link.style.alignItems = 'center';
        link.style.textDecoration = 'none';
        
        // Assemble the elements
        link.appendChild(logo);
        link.appendChild(text);
        watermarkContainer.appendChild(link);
        this.target.appendChild(watermarkContainer);
    }
    

  
    
    

    private getReportLevelLicenseKey(dataView: powerbi.DataView): string | null {
        if (!dataView?.metadata?.objects?.reportSettings?.sharedLicenseKey) {
            return null;
        }
        
        const key = dataView.metadata.objects.reportSettings.sharedLicenseKey as string;
        return key || null;
    }

    private enableFullFunctionality() {
        console.log('Enabling full functionality');
        
        // Remove the watermark with class
        const existingWatermark = this.target.querySelector('.license-watermark');
        if (existingWatermark) {
            console.log('Found watermark, removing');
            existingWatermark.remove();
        } else {
            console.log('No watermark found with class, trying by text content');
            // Fallback: find by text content
            const elements = this.target.querySelectorAll('a');
            elements.forEach(element => {
                if (element.innerText && element.innerText.includes('BIMappy Unlicensed')) {
                    console.log('Found watermark by text, removing');
                    element.remove();
                }
            });
        }
    
        // Show success message temporarily
        this.showLicenseMessage('License validated successfully!', 'success')
    }
    

    private showLicenseMessage(message: string, type: 'success' | 'warning' | 'error') {
        const successMessage = document.createElement('div');
        successMessage.style.position = 'absolute';
        successMessage.style.bottom = '50px';
        successMessage.style.left = '50%';
        successMessage.style.transform = 'translateX(-50%)';
        successMessage.style.padding = '10px 20px';
        successMessage.style.borderRadius = '5px';
        successMessage.style.zIndex = '2000';
        successMessage.innerText = message;
        
        // Set different styling based on message type
        switch (type) {
            case 'success':
                successMessage.style.backgroundColor = 'rgba(40, 167, 69, 0.8)';
                successMessage.style.color = 'white';
                break;
            case 'warning':
                successMessage.style.backgroundColor = 'rgba(255, 193, 7, 0.8)';
                successMessage.style.color = 'black';
                break;
            case 'error':
                successMessage.style.backgroundColor = 'rgba(220, 53, 69, 0.8)';
                successMessage.style.color = 'white';
                break;
        }
        
        // Add ARIA role for accessibility
        successMessage.setAttribute('role', 'alert');
        
        this.target.appendChild(successMessage);
    
        // Remove after 3 seconds
        setTimeout(() => {
            if (successMessage.parentNode) {
                successMessage.parentNode.removeChild(successMessage);
            }
        }, 3000);
    }


    
    
    private persistSharedLicenseKey(licenseKey: string) {
        console.log('Persisting shared license key:', licenseKey);
        
        if (!licenseKey) {
            console.log('Empty license key, not persisting');
            return;
        }
        
        // Ensure reportSettings exists
        if (!this.formattingSettings.reportSettings) {
            console.log('Report settings not initialized');
            return;
        }
        
        // Update in memory
        this.formattingSettings.reportSettings.sharedLicenseKey.value = licenseKey;
        
        try {
            // Persist at report level with appropriate scope
            this.host.persistProperties({
                merge: [{
                    objectName: 'reportSettings',
                    properties: { 
                        sharedLicenseKey: licenseKey 
                    },
                    selector: null  // null selector for report-level persistence
                }]
            });
            console.log('Successfully persisted sharedLicenseKey to report level');
        } catch (error) {
            console.error('Error persisting properties:', error);
        }
    }
    
    // Helper functie om de initiële status te controleren
    private initializeFromPersistedSettings(dataView: powerbi.DataView) {
        console.log('Initializing from persisted settings');
        
        const objects = dataView.metadata?.objects;
        console.log('Full objects:', JSON.stringify(objects));
        
        if (!objects) {
            console.log('No persisted objects found');
            return;
        }
    
        // Check licenseCard first
        if (objects.licenseCard?.licenseKey) {
            const licenseKey = objects.licenseCard.licenseKey as string;
            console.log('Found license key in licenseCard:', licenseKey);
            
            // Update local settings
            if (this.formattingSettings.licenseCard) {
                this.formattingSettings.licenseCard.licenseKey.value = licenseKey;
            }
            
            // Also save to reportSettings for sharing
            if (this.formattingSettings.reportSettings) {
                this.formattingSettings.reportSettings.sharedLicenseKey.value = licenseKey;
                
                // Persist to reportSettings
                this.persistSharedLicenseKey(licenseKey);
            }
            
            // Validate if not already validated
            if (!this.licenseValidated) {
                this.validateLicense();
            }
        }
        
        // Then also check reportSettings (for backwards compatibility)
        if (objects.reportSettings?.sharedLicenseKey) {
            const sharedKey = objects.reportSettings.sharedLicenseKey as string;
            console.log('Found shared key in reportSettings:', sharedKey);
            
            // Update both locations if not already set
            if (this.formattingSettings.reportSettings && 
                !this.formattingSettings.reportSettings.sharedLicenseKey.value) {
                this.formattingSettings.reportSettings.sharedLicenseKey.value = sharedKey;
            }
            
            if (this.formattingSettings.licenseCard && 
                !this.formattingSettings.licenseCard.licenseKey.value) {
                this.formattingSettings.licenseCard.licenseKey.value = sharedKey;
            }
            
            // Validate if not already validated and we haven't already done so above
            if (!this.licenseValidated) {
                this.validateLicense();
            }
        }
    }
    
    private checkStoredLicenseKey() {
        console.log('Checking stored license information:');
        
        // First check reportSettings (which should be shared across pages)
        if (this.formattingSettings?.reportSettings?.sharedLicenseKey?.value) {
            const sharedKey = this.formattingSettings.reportSettings.sharedLicenseKey.value;
            console.log('Found shared license key:', sharedKey);
            
            // Apply to local license settings
            if (this.formattingSettings.licenseCard) {
                this.formattingSettings.licenseCard.licenseKey.value = sharedKey;
                // Validate immediately if not already validated
                if (!this.licenseValidated) {
                    this.validateLicense();
                }
            }
        }
        
        // Then check local license card (this page only)
        else if (this.formattingSettings?.licenseCard?.licenseKey?.value) {
            console.log('No shared key found, but local license exists');
            // If a local license exists but no shared one, persist it to share
            this.persistSharedLicenseKey(this.formattingSettings.licenseCard.licenseKey.value);
        }
    }
    
   

   
    
 

    private updateVisualBasedOnFilters() {
        // Logica om de visual bij te werken op basis van de huidige filters
        console.log('Updating visual based on filters...');
        // Bijvoorbeeld: herteken de punten op de kaart
        this.drawPoints(this.lastDataView);
        this.updateMarkerStyle();
    }

    private validateGeoJsonUrl(url: string): boolean {
        // Check if the URL is not empty and is a valid URL format
        if (!url || url === '') {
            return false;
        }
    
        try {
            // Create URL object to validate format and extract components
            const urlObj = new URL(url);
            
            // Only allow https
            if (urlObj.protocol !== 'https:') {
                console.warn('Rejected non-HTTPS URL:', url);
                this.showLicenseMessage('Only HTTPS URLs are allowed for security reasons.', 'warning');
                return false;
            }
            
            // Only allow URLs from trusted domains (whitelist)
            const trustedDomains = [
                // Base map providers
                'openstreetmap.org',
                'opentopomap.org',
                'stadiamaps.com',
                'arcgisonline.com',
                
                // Cloud storage platforms
                'amazonaws.com',
                's3.amazonaws.com',
                'storage.googleapis.com',
                'blob.core.windows.net',
                
                // Mapping/GIS platforms
                'arcgis.com',
                'mapbox.com',
                'api.mapbox.com',
                'carto.com',
                'services.arcgis.com',
                
                // Data portals and geospatial services
                'data.humdata.org',
                'naturalearthdata.com',
                'geojson.xyz',
                'geojson.io',
                'geo.api.gouv.fr',
                
                // Code repositories
                'githubusercontent.com',
                'raw.githubusercontent.com',
                'gist.githubusercontent.com',
                'gitlab.io',
                'gitlab-static.net',
                
                // International government and research
                'data.gov.uk',
                'data.gov',
                'open.canada.ca',
                'data.europa.eu',
                'eurostat.eu',
                'un.org',
                'who.int',
                'worldbank.org',
                'data.oecd.org',
                
                // Dutch sources
                'bimappy.nl',
                'bimappy.com',
                'pdok.nl',
                'data.overheid.nl',
                'kadaster.nl',
                'cbs.nl',
                'rivm.nl',
                'rvo.nl',
                'basisregistraties.nl',
                'esri.nl',
                'esri.com',
                'nationaalgeoregister.nl',
                'geoservices.nl'
            ];
            
            const isDomainTrusted = trustedDomains.some(domain => 
                urlObj.hostname === domain || urlObj.hostname.endsWith('.' + domain)
            );
            
            if (!isDomainTrusted) {
                console.warn('Rejected URL from untrusted domain:', urlObj.hostname);
                this.showLicenseMessage('URL domain not in allowed list.', 'warning');
                return false;
            }
            
            // Additional validation - only allow common GeoJSON extensions
            // This helps prevent loading arbitrary files
            if (urlObj.pathname) {
                const lowercasePath = urlObj.pathname.toLowerCase();
                if (!(lowercasePath.endsWith('.geojson') || 
                      lowercasePath.endsWith('.json') ||
                      // API endpoints that return GeoJSON might not have extensions
                      lowercasePath.includes('/api/') || 
                      lowercasePath.includes('/geoserver/') ||
                      lowercasePath.includes('/arcgis/rest/services/'))) {
                    console.warn('Rejected URL with suspicious file extension:', urlObj.pathname);
                    this.showLicenseMessage('URL must point to a .geojson or .json file.', 'warning');
                    return false;
                }
            }
            
            return true;
        } catch (e) {
            console.error('Invalid URL format:', e);
            this.showLicenseMessage('Invalid URL format.', 'error');
            return false;
        }
    }
private async loadGeoJSONData(url: string) {
    if (!this.validateGeoJsonUrl(url)) {
        console.error('GeoJSON URL validation failed:', url);
        return;
    }
    
    try {
        // Add a timeout to the fetch to prevent hanging requests
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        const response = await fetch(url, {
            method: 'GET',
            signal: controller.signal,
            credentials: 'omit', // Don't send cookies for security
            headers: {
                'Accept': 'application/json, application/geo+json'
            }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        // Validate content type
        const contentType = response.headers.get('content-type');
        if (contentType && 
            !contentType.includes('application/json') && 
            !contentType.includes('application/geo+json')) {
            console.warn('Unexpected content type:', contentType);
            // Continue anyway, but log the warning
        }
        
        const geoJsonData = await response.json();
        
        // Basic schema validation for GeoJSON
        if (!geoJsonData.type || !geoJsonData.features) {
            console.error('Invalid GeoJSON format - missing required fields');
            this.showLicenseMessage('Invalid GeoJSON format.', 'error');
            return;
        }
        
        // Success path - load the GeoJSON
        this.geoJSONLayer.loadGeoJSON(geoJsonData);
        this.buildGeoJsonIndex();
        this.ensureCorrectZIndex(); // Add this line
    } catch (error) {
        console.error('Error loading GeoJSON:', error);
        
        if (console.error.name === 'AbortError') {
            this.showLicenseMessage('GeoJSON request timed out.', 'error');
        } else {
            this.showLicenseMessage('Failed to load GeoJSON data.', 'error');
        }
    }
}

private ensureCorrectZIndex() {
    // Set GeoJSON to lower z-index
    const geoJsonLayer = this.geoJSONLayer.getGeoJSONLayer();
    if (geoJsonLayer) {
        geoJsonLayer.setZIndex(100);
    }
    
    // Set all point layers to higher z-index
    this.pointsLayer.setZIndex(200);
    this.selectedPointsLayer.setZIndex(200);
    this.unselectedPointsLayer.setZIndex(200);
    
    // Additionally, ensure all individual markers are on top
    this.pointsLayer.eachLayer((layer) => {
        if (layer instanceof L.CircleMarker) {
            layer.bringToFront();
        }
    });
    
    this.selectedPointsLayer.eachLayer((layer) => {
        if (layer instanceof L.CircleMarker) {
            layer.bringToFront();
        }
    });
    
    this.unselectedPointsLayer.eachLayer((layer) => {
        if (layer instanceof L.CircleMarker) {
            layer.bringToFront();
        }
    });
}
private buildGeoJsonIndex() {
        this.geoJsonIndex.clear();
        const geoJsonLayer = this.geoJSONLayer.getGeoJSONLayer();


        console.log('Opbouw Geojson index');
        if (!geoJsonLayer) {
            console.log('No GeoJSON layer available');
            return;
        }
        geoJsonLayer.eachLayer((layer: L.Layer) => {
            if (layer instanceof L.Polygon) {
                const bounds = layer.getBounds();
                this.geoJsonIndex.insert({
                    minX: bounds.getWest(),
                    minY: bounds.getSouth(),
                    maxX: bounds.getEast(),
                    maxY: bounds.getNorth(),
                    layer: layer
                });
            }
        });
        console.log('Geojsonlayer index succesvol');
    }
 
    private setupMapEventListeners() {
        console.log('Setting up map event listeners');
        
        // Direct events zonder debounce
        this.map.on('zoomend', () => {
            console.log('Zoom event detected');
            this.saveMapBounds();
            this.updateSelectionBasedOnVisibleMarkers();
        });
    
        this.map.on('moveend', () => {
            console.log('Move event detected');
            this.saveMapBounds();
            this.updateSelectionBasedOnVisibleMarkers();
        });
    
        console.log('Map event listeners setup complete');
    }
    
    private saveMapBounds() {
        if (!this.map || !this.formattingSettings?.mapBoundsCard) {
            return;
        }
    
        const bounds = this.map.getBounds();
        const zoom = this.map.getZoom();
    
        // Update the formatting settings
        this.formattingSettings.mapBoundsCard.north.value = bounds.getNorth();
        this.formattingSettings.mapBoundsCard.south.value = bounds.getSouth();
        this.formattingSettings.mapBoundsCard.east.value = bounds.getEast();
        this.formattingSettings.mapBoundsCard.west.value = bounds.getWest();
        this.formattingSettings.mapBoundsCard.zoom.value = zoom;
    
        // Persist the properties
        this.host.persistProperties({
            merge: [{
                objectName: 'mapBoundsCard',
                properties: {
                    north: bounds.getNorth(),
                    south: bounds.getSouth(),
                    east: bounds.getEast(),
                    west: bounds.getWest(),
                    zoom: zoom
                },
                selector: null
            }]
        });
    }

    private updateSelectionBasedOnVisibleMarkers() {

           // Check if formatting settings are initialized
    if (!this.formattingSettings || !this.formattingSettings.zoomSelectionCard) {
        console.log('Formatting settings not initialized yet, skipping selection update');
        return;
    }
        const isZoomFilterActivated = this.formattingSettings.zoomSelectionCard.enableZoomSelection.value;
        if (!isZoomFilterActivated) {
            console.log('zoom setting niet geactiveerd',isZoomFilterActivated);
            return; // Stop de functie als de checkbox niet is aangevinkt
            
        }
    
        const bounds = this.map.getBounds(); // Haal de huidige grenzen van het kaartvenster op
        const visibleMarkers: powerbi.visuals.ISelectionId[] = [];
        console.log('Updating selection based on zoom', bounds);
    
        // Wis de huidige selectie
        this.selectionManager.clear();
    
        // Itereer door alle markers in de pointsLayer
        this.selectedPointsLayer.eachLayer((layer: L.Layer) => {
            if (layer instanceof L.CircleMarker) {
                const latLng = layer.getLatLng();
                console.log('Checking marker at:', latLng);
    
                // Controleer of de marker binnen de huidige kaartgrenzen valt
                if (bounds.contains(latLng)) {
                    console.log('Marker is within bounds');
    
                    // Vind de rijindex op basis van de lat/lng
                    const rowIndex = this.findRowIndexByLatLng(latLng.lat, latLng.lng);
                    if (rowIndex !== -1) {
                        console.log('Row index found:', rowIndex);
    
                        // Genereer een selectie-ID voor de rij
                        const selectionId = this.host.createSelectionIdBuilder()
                            .withTable(this.lastDataView.table, rowIndex)
                            .createSelectionId();
                        visibleMarkers.push(selectionId);
                    } else {
                        console.log('Row index not found for marker at:', latLng);
                    }
                } else {
                    console.log('Marker is outside bounds');
                }
            }
        });
    
        // Pas de selectie toe in Power BI
        if (visibleMarkers.length > 0) {
            console.log('Applying selection for', visibleMarkers.length, 'markers');
            this.selectionManager.select(visibleMarkers, true); // Multi-select
        } else {
            console.log('No markers within bounds, clearing selection');
            this.selectionManager.clear(); // Wis de selectie als er geen markers zichtbaar zijn
        }
    }
    private drawPoints(dataView: powerbi.DataView): L.LatLng[] {
        const markers: L.LatLng[] = [];
        try {
            // Clear existing points
            this.pointsLayer.clearLayers();
            this.selectedPointsLayer.clearLayers();
            this.unselectedPointsLayer.clearLayers();
            this.pointsLayer.setZIndex(200); // Punten op de voorgrond
            this.selectedPointsLayer.setZIndex(200); // Geselecteerde punten op de voorgrond
            this.unselectedPointsLayer.setZIndex(200); // Niet-geselecteerde punten op de voorgrond
    
    
            // Check if data is available
            if (!dataView.table?.rows?.length) {
                console.log('No data to draw points');
                return markers;
            }
    
            console.log('Processing', dataView.table.rows.length, 'rows');
            const initialStyle = {
                fillColor: this.formattingSettings.markerStyleCard.markerColor.value.value,
                color: this.formattingSettings.markerStyleCard.borderColor.value.value,
                weight: this.formattingSettings.markerStyleCard.borderWidth.value,
                opacity: this.formattingSettings.markerStyleCard.opacity.value / 100,
                fillOpacity: this.formattingSettings.markerStyleCard.opacity.value / 100,
                radius: this.formattingSettings.markerStyleCard.markerRadius.value
            };
            // Iterate through rows and draw markers
            for (const [index, row] of dataView.table.rows.entries()) {
                  
                const lat = typeof row[0] === 'number' ? row[0] : parseFloat(row[0].toString());
                const lng = typeof row[1] === 'number' ? row[1] : parseFloat(row[1].toString());
    
                if (this.isValidCoordinate(lat, lng)) {
                    // Create a circle marker with default style
                    const marker = L.circleMarker([lat, lng], initialStyle);
    
                    // Add event listeners for tooltips and selection
                    const selectionId = this.host.createSelectionIdBuilder()
                        .withTable(dataView.table, index)
                        .createSelectionId();
    
                    marker.on('mousemove', (e: L.LeafletMouseEvent) => {
                        const tooltipData = this.createTooltip(row, dataView);
                        this.host.tooltipService.show({
                            dataItems: tooltipData,
                            identities: [selectionId],
                            coordinates: [e.originalEvent.pageX, e.originalEvent.pageY],
                            isTouchEvent: false
                        });
                    });
    
                    marker.on('mouseout', () => {
                        this.host.tooltipService.hide({
                            immediately: true,
                            isTouchEvent: false
                        });
                    });
    
                    marker.on('click', () => {
                        this.selectionManager.select(selectionId);
                    });
    
                    // Add marker to the points layer
                    this.pointsLayer.addLayer(marker);
                    markers.push(L.latLng(lat, lng));
                } else {
                    console.log(`Invalid coordinate in row ${index}:`, { lat, lng });
                }
            }
            this.ensureCorrectZIndex();
            console.log('Points drawn:', markers.length);
        } catch (error) {
            console.error('Error in drawPoints:', error);
        }
        return markers;
    }

    private updateMarkerStyle() {
        // Define the new marker style based on formatting settings
        const newStyle = {
            fillColor: this.formattingSettings.markerStyleCard.markerColor.value.value,
            color: this.formattingSettings.markerStyleCard.borderColor.value.value,
            weight: this.formattingSettings.markerStyleCard.borderWidth.value,
            opacity: this.formattingSettings.markerStyleCard.opacity.value / 100,
            fillOpacity: this.formattingSettings.markerStyleCard.opacity.value / 100,
            radius: this.formattingSettings.markerStyleCard.markerRadius.value
        };
    
        // Apply the new style to all markers in the points layer
        this.pointsLayer.eachLayer((layer: L.Layer) => {
            if (layer instanceof L.CircleMarker) {
                layer.setStyle(newStyle);
            }
        });
    
        console.log('Marker styles updated');
    }
    private applyGeoJSONFilter() {
   
        const totalPoints = this.pointsLayer.getLayers().length;
        let processedPoints = 0;

        const startTime = performance.now(); // Start de timer
        
        if (!this.formattingSettings?.geoJsonCard?.activateFilter?.value) {
            return; // Stop de functie als de checkbox niet is aangevinkt
        }
      
        const geoJsonLayer = this.geoJSONLayer.getGeoJSONLayer();
        if (!this.pointsLayer || !geoJsonLayer || !this.lastDataView) {
            return;
        }
       
        const selectionIds: powerbi.visuals.ISelectionId[] = [];
    
        // Stijl voor geselecteerde en niet-geselecteerde markers
        const selectedStyle = {
            fillColor: this.formattingSettings.markerStyleCard.markerColor.value.value,
            radius: this.formattingSettings.markerStyleCard.markerRadius.value
        };
    
        const unselectedStyle = {
            fillColor: '#CCCCCC', // Lichtgrijs voor niet-geselecteerde markers
            radius: this.formattingSettings.markerStyleCard.markerRadius.value - 2 // 2 punten kleiner
        };
    
        // Leeg de selected en unselected layers
    this.selectedPointsLayer.clearLayers();
    this.unselectedPointsLayer.clearLayers();
    
        // Itereer door alle markers en pas de stijl aan op basis van de GeoJSON-filter
        this.pointsLayer.eachLayer((layer: L.Layer) => {
            if (layer instanceof L.CircleMarker) {
                const latLng = layer.getLatLng();
                const isInside = this.isPointInGeoJSON(latLng.lat, latLng.lng);
    
                // Pas de stijl aan op basis van de filter
                layer.setStyle(isInside ? selectedStyle : unselectedStyle);
    
                // Verplaats de marker naar de juiste laag
                if (isInside) {
                    this.selectedPointsLayer.addLayer(layer);
                    this.unselectedPointsLayer.removeLayer(layer);
                    const rowIndex = this.findRowIndexByLatLng(latLng.lat, latLng.lng);
                    if (rowIndex !== -1) {
                        const selectionId = this.host.createSelectionIdBuilder()
                            .withTable(this.lastDataView.table, rowIndex)
                            .createSelectionId();
                        selectionIds.push(selectionId);}
                } else {
                    this.unselectedPointsLayer.addLayer(layer);
                    this.selectedPointsLayer.removeLayer(layer);
                }
            }
            processedPoints++;

        });

    
        // Pas de selectie toe in Power BI
        if (selectionIds.length > 0) {
            this.selectionManager.select(selectionIds, true); // Multi-select
        } else {
            this.selectionManager.clear(); // Wis de selectie als er geen markers binnen de GeoJSON-laag zijn
        }
    
    
        const endTime = performance.now(); // Stop de timer
        const executionTime = (endTime - startTime).toFixed(2); 
        this.timerElement.innerText = `Uitvoeringstijd: ${executionTime} ms`;
         console.log(`applyGeoJSONFilter uitgevoerd in ${executionTime} ms`);
        console.log('GeoJSON filter applied');
        console.log('PointsLayer markers:', this.pointsLayer.getLayers().length);
        console.log('SelectedPointsLayer markers:', this.selectedPointsLayer.getLayers().length);
        console.log('UnselectedPointsLayer markers:', this.unselectedPointsLayer.getLayers().length);
        this.ensureCorrectZIndex();
    }

    private resetGeoJSONFilter() {
        // Reset the points to their original state
        this.pointsLayer.eachLayer((layer: L.Layer) => {
            if (layer instanceof L.CircleMarker) {
                // Reset the style of all markers
                layer.setStyle({
                    fillColor: this.formattingSettings.markerStyleCard.markerColor.value.value,
                    radius: this.formattingSettings.markerStyleCard.markerRadius.value
                });
    
                // Move all markers back to the main points layer
                this.pointsLayer.addLayer(layer);
                this.selectedPointsLayer.removeLayer(layer);
                this.unselectedPointsLayer.removeLayer(layer);
                
            }
        });
    
        // Clear the selection in Power BI
        this.selectionManager.clear();
        console.log('GeoJSON filter reset and selection cleared');
        this.ensureCorrectZIndex();
    }

 
    private isValidCoordinate(lat: number, lng: number): boolean {
          // First check for NaN, null or undefined
    if (lat === null || lng === null || lat === undefined || lng === undefined || 
        isNaN(lat) || isNaN(lng)) {
        return false;
    }
    
    // Check valid ranges
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return false;
    }
    
    // Check for suspicious zeros or extreme values that might indicate bad data
    if (lat === 0 && lng === 0) {
        console.warn('Suspicious coordinate at 0,0 detected');
    }
    
    return true;
}

    private removeGeoJSONLayer() {
        if (this.geoJSONLayer) {
            const geoJsonLayer = this.geoJSONLayer.getGeoJSONLayer();
            if (geoJsonLayer) {
                this.map.removeLayer(geoJsonLayer); // Verwijder de GeoJSON-laag van de kaart
                this.geoJsonIndex.clear(); // Maak de spatial index leeg
                console.log('GeoJSON layer removed');
            }
        }
    }
    private isPointInGeoJSON(lat: number, lng: number): boolean {
        const geoJsonLayer = this.geoJSONLayer.getGeoJSONLayer();
        if (!geoJsonLayer || !this.geoJsonIndex || this.geoJsonIndex.all().length === 0) {
            return true; // No GeoJSON layer, consider all points as inside
        }
    
        const point = { minX: lng, minY: lat, maxX: lng, maxY: lat };
        const candidates = this.geoJsonIndex.search(point); // Search in the spatial index
    
        for (const candidate of candidates) {
            if (candidate.layer instanceof L.Polygon) {
                // Precise check with leaflet-pip
                if (leafletPip.pointInLayer(L.latLng(lat, lng), L.layerGroup([candidate.layer])).length > 0) {
                    return true; // The point is inside the polygon
                }
            }
        }
    
        return false; // The point is not inside any polygon
    }
   
    private findRowIndexByLatLng(lat: number, lng: number): number {
        if (!this.lastDataView?.table?.rows) return -1;
    
        for (let i = 0; i < this.lastDataView.table.rows.length; i++) {
            const row = this.lastDataView.table.rows[i];
            const rowLat = parseFloat(row[0].toString());
            const rowLng = parseFloat(row[1].toString());
    
            if (rowLat === lat && rowLng === lng) {
                return i;
            }
        }
    
        return -1;
    }

    private createTooltip(row: powerbi.DataViewTableRow, dataView: powerbi.DataView): VisualTooltipDataItem[] {
        const tooltipData: VisualTooltipDataItem[] = [];

        if (!dataView.table?.columns || !row) {
            return tooltipData;
        }

        dataView.table.columns.forEach((column, index) => {
            if (column.roles && (column.roles.tooltipFields || column.roles.latitude || column.roles.longitude)) {
                const value = row[index];
                tooltipData.push({
                    header: column.displayName,
                    displayName: column.displayName,
                    value: value?.toString() ?? ''
                });
            }
        });

        return tooltipData;
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
    }

  
   

    public destroy(): void {
        console.log('Visual destroy called');


    
        // Sla de kaartgrenzen en zoomniveau op
     
        this.saveMapBounds();

        // Clean up the map and layers
        if (this.map) {
            this.map.remove();
        }

        if (this.pointsLayer) {
            this.pointsLayer.clearLayers();
        }

        if (this.selectedPointsLayer) {
            this.selectedPointsLayer.clearLayers();
        }

        if (this.unselectedPointsLayer) {
            this.unselectedPointsLayer.clearLayers();
        }

        if (this.geoJSONLayer) {

            const geoJsonLayer = this.geoJSONLayer.getGeoJSONLayer();
            if (!geoJsonLayer) {
                console.log('No GeoJSON layer available');
                return;
            }
            geoJsonLayer.clearLayers();
        }
    }
}