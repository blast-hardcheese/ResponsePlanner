///<reference path="definitions/jquery/jquery.d.ts" />
///<reference path="definitions/googlemaps/google.maps.d.ts" />
///<reference path="definitions/toastr/toastr.d.ts" />
///<reference path="definitions/geojson/geojson.d.ts" />

module ResponsePlanner {
    interface APIHandlerOptions {
        lat: number;
        lng: number;

        tag?: string;
    }

    interface APIHandler {
        load(opts: APIHandlerOptions, callback: (points: GeoJSON.Feature[]) => void);
    }

    class AbstractAPIHandler {
        buildQuery = (lat: number, lng: number): string => { return ""; }

        load = (opts: APIHandlerOptions, callback: (points: GeoJSON.Feature[]) => void) => {
            var url = this.buildQuery(opts.lat, opts.lng);
            console.log(url);
            ($.get(url)
             .done((data: string) => {
                var json: GeoJSON.Feature[] = JSON.parse(data);
                callback(this.transform(json));
             })
             .fail(() => {

             })
            );
        }

        transform = (x: any): GeoJSON.Feature[] => { return []; }
    }

    class ArcGisAPIHandler extends AbstractAPIHandler {
        private base = "http://gis.rctlma.org/arcgis/rest/services/Public";
        serviceName: string = null;
        serviceIndex: number = null;

        constructor(serviceName: string, serviceIndex) {
            super();
            this.serviceName = serviceName;
            this.serviceIndex = serviceIndex;
        }

        buildQuery = (lat: number, lng: number): string => {
            var params = [
                ["outFields", "*"],
                ["where", "1=1"],
                ["f", "pjson"],
                ["geometryType", "esriGeometryEnvelope"],
                ["geometry", "-104,35.6,-94.32,41"],
            ];

            var url = [this.base, this.serviceName, "FeatureServer", this.serviceIndex].join("/");
            var qs = params.map((pair) => {
                return [pair[0], encodeURIComponent(pair[1])].join("=");
            }).join("&");

            return url + "?" + qs;
        }
    }

    interface GeoJSONHandlerResponse {
        name: string;
        type: string;
        updated_at: number;
        features: GeoJSON.Feature[];
    }

    class GeoJSONHandler extends AbstractAPIHandler {
        private base = "http://data.countyofriverside.opendata.arcgis.com/datasets/";
        dataset: string = null;

        constructor(dataset: string) {
            super();
            this.dataset = dataset;
        }

        buildQuery = (lat: number, lng: number) => {
            return this.base + this.dataset;
        }

        transform = (resp: GeoJSONHandlerResponse): GeoJSON.Feature[] => {
            return resp.features;
        }
    }

    class Map {
        components = {
            allLabels: (on: boolean) => {
                return {
                    "elementType": "labels",
                    "stylers": [
                        { "visibility": (on?"on":"off") }
                    ]
                }
            },
            roadLabels: (on: boolean) => {
                return {
                    "featureType": "road",
                    "elementType": "labels",
                    "stylers": [
                        { "visibility": (on?"on":"off") }
                    ]
                }
            },
        };
    }


    export class App {
        map: google.maps.Map = null;
        private apiHandlers: APIHandler[] = [];

        constructor() {
        }

        init = () => {
            var mapOptions = {
                zoom: 3,
                center: new google.maps.LatLng(0, 0),
            };

            this.map = new google.maps.Map(document.getElementById('map-canvas'), mapOptions);
            this.location_init();
            this.createHandlers();
        }

        createHandlers = () => {
            this.apiHandlers.push(new GeoJSONHandler("14b84cbcaaef4d319c5892bfcb1efab4_0.geojson"));
            //this.apiHandlers.push(new ArcGisAPIHandler("FeatureServer")); // Disabled, since geojson seems easier to implement
        }

        location_init = () => {
            if(navigator.geolocation) {
                navigator.geolocation.getCurrentPosition((position: Position) => {
                    console.debug("position:", position);
                    var pos = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);

                    this.map.setCenter(pos);
                    this.map.setZoom(17);

                    toastr.info("Found you! " + position.coords.accuracy);
                }, function() {
                    this.location_unavailable(true);
                });
            } else {
                // Browser doesn't support Geolocation
                this.location_unavailable(false);
            }
        }

        location_unavailable = (supported: boolean) => {
            if(supported) {
                toastr.error("Unable to get GPS signal");
            } else {
                toastr.error("No supported GPS found");
            }
        }
    }
}

google.maps.event.addDomListener(window, 'load', () => {
    var app = new ResponsePlanner.App();
    app.init();
});
