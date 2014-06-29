///<reference path="definitions/jquery/jquery.d.ts" />
///<reference path="definitions/googlemaps/google.maps.d.ts" />
///<reference path="definitions/toastr/toastr.d.ts" />
///<reference path="definitions/geojson/geojson.d.ts" />
///<reference path="thumbnails.ts" />

module ResponsePlanner {
    interface FeatureProperties {
        OBJECTID: number;

        TYPE: string;
        SITE_TYPE: string;

        NAME: string;
        SITE_NAME: string;

        PHONE: string;

        ADDRESS: string;
        CITY: string;
        ZIPCODE: number;
    }

    interface Feature extends GeoJSON.Feature {
        properties: FeatureProperties;
    }

    interface APIHandlerOptions {
        lat?: number;
        lng?: number;

        tag?: string;
    }

    interface APIHandlerProperties {
        type: string;
        name: string;
    }

    interface APIHandler {
        keys: APIHandlerProperties;
        load(opts: APIHandlerOptions, callback: (points: Feature[]) => void): void;
    }

    interface AbstractAPIHandlerOptions {
        properties?: APIHandlerProperties;
    }

    class AbstractAPIHandler implements APIHandler {
        keys = {
            type: 'TYPE',
            name: 'NAME',
        }

        constructor(options: AbstractAPIHandlerOptions) {
            for(var option in options) {
                this.keys[option] = options[option];
            }
        }

        buildQuery = (lat: number, lng: number): string => { return ""; }

        load = (opts: APIHandlerOptions, callback: (points: Feature[]) => void) => {
            var url = this.buildQuery(opts.lat, opts.lng);
            console.log(url);
            ($.get(url)
             .done((data: string) => {
                var json: Feature[] = JSON.parse(data);
                callback(this.transform(json));
             })
             .fail(() => {

             })
            );
        }

        transform = (x: any): Feature[] => { return []; }
    }

    class ArcGisAPIHandler extends AbstractAPIHandler {
        private base = "http://gis.rctlma.org/arcgis/rest/services/Public";
        serviceName: string = null;
        serviceIndex: number = null;

        constructor(serviceName: string, serviceIndex: number, options: AbstractAPIHandlerOptions = {}) {
            super(options);
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
        features: Feature[];
    }

    class GeoJSONHandler extends AbstractAPIHandler {
        private base = "http://data.countyofriverside.opendata.arcgis.com/datasets/";
        dataset: string = null;

        constructor(dataset: string, options: AbstractAPIHandlerOptions = {}) {
            super(options);
            this.dataset = dataset;
        }

        buildQuery = (lat: number, lng: number) => {
            return this.base + this.dataset;
        }

        transform = (resp: GeoJSONHandlerResponse): Feature[] => {
            return resp.features;
        }
    }

    class ExtraMapData {
        private map: google.maps.Map;
        markers: google.maps.Marker[] = [];

        constructor(map: google.maps.Map) {
            this.map = map;
        }

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

            simpleGeometry: (on: boolean) => {
                return {
                    "elementType": "geometry",
                    "stylers": [
                        { "visibility": "simplified" }
                    ]
                }
            },
        };

        types = {
            onlyRoads: new google.maps.StyledMapType([
                    this.components.allLabels(false),
                    this.components.roadLabels(true),
                ], {"name": "Only Road Labels"}),

            allLabels: new google.maps.StyledMapType([
                    this.components.allLabels(true),
                    this.components.roadLabels(true),
                ], {"name": "All Labels"}),
        };

        thumbForKey = (key: string): string => {
            var corrections = {
                "FIRE STATION": "FIRE & EMERGENCY SERVICES",
            };

            var key: string = (corrections[key] || key);

            var thumb: Thumb = ResponsePlanner.Thumbnails.thumbs[key];
            if(thumb === undefined) {
                console.error("Unable to find key:", key);
                thumb = ResponsePlanner.Thumbnails.thumbs["INFORMATION TECHNOLOGY"];
            }
            return thumb.imageData;
        }
    }


    export class App {
        map: google.maps.Map = null;
        private apiHandlers: APIHandler[] = [];
        private extra: ExtraMapData = null;

        constructor() {
        }

        init = () => {
            var mapOptions = {
                zoom: 10,
                center: new google.maps.LatLng(33.72205524868729, -116.88491821289062),
                mapTypeControlOptions: {
                    mapTypeIds: [google.maps.MapTypeId.ROADMAP, google.maps.MapTypeId.SATELLITE, "MY_ONLYROADLABELS"],
                },
                mapTypeId: google.maps.MapTypeId.ROADMAP,
            };

            this.map = new google.maps.Map(document.getElementById('map-canvas'), mapOptions);
            this.extra = new ExtraMapData(this.map);

            this.bindEvents();
            this.location_init();
            this.createHandlers();
            this.loadIcons();

            this.map.mapTypes.set("MY_ONLYROADLABELS", this.extra.types.onlyRoads);
        }

        createHandlers = () => {
            this.apiHandlers.push(new GeoJSONHandler("14b84cbcaaef4d319c5892bfcb1efab4_0.geojson", {"name": "SITE_NAME", "type": "SITE_TYPE"}));
            this.apiHandlers.push(new GeoJSONHandler("4dde89e625bd43e7a8afe8cb8bf9b3a8_0.geojson"));
            //this.apiHandlers.push(new ArcGisAPIHandler("FeatureServer")); // Disabled, since geojson seems easier to implement
        }

        loadIcons = () => {
            this.apiHandlers.map((handler: APIHandler) => {
                console.debug("Firing off:", handler);
                handler.load({}, (points: Feature[]) => {
                    console.debug("points:", points);

                    points.map((point) => {
                        var coords = point.geometry.coordinates;
                        var latLng = new google.maps.LatLng(coords[1], coords[0]);
                        var icon: google.maps.Icon = {
                            url: ["data:image/png;base64", this.extra.thumbForKey(point.properties[handler.keys.type])].join(","),
                            scaledSize: new google.maps.Size(20, 20),
                        };

                        var marker = new google.maps.Marker({
                                position: latLng,
                                map: this.map,
                                title: point.properties[handler.keys.name],
                                id: point.id,
                                icon: icon,
                        });

                        this.extra.markers.push(marker);
                    });
                });
            });
        }

        bindEvents = () => {
            google.maps.event.addListener(this.map, 'center_changed', () => {
            });

            google.maps.event.addListener(this.map, 'click', (event: google.maps.MouseEvent) => {
                var lat = event.latLng.lat();
                var lng = event.latLng.lng();
                console.log(lat, lng, this.map.getZoom());
            });

            google.maps.event.addListener(this.map, 'zoom_changed', () => {
                console.debug("zoom level changed:", this.map.getZoom());
                this.doScale(this.map.getZoom());
            })
        }

        doScale = (level: number) => {
            var mapping = {
                12: 30,
                13: 50,
                14: 50,
                15: 50,
                16: 75,
                17: 75,
                18: 75,
                19: 75,
                20: 75,
                21: 75,
            }

            var value = mapping[level] || 25;

            this.extra.markers.map((marker: google.maps.Marker) => {
                var icon = marker.getIcon();

                icon.scaledSize.width = value;
                icon.scaledSize.height = value;

                marker.setIcon(icon);
            });
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
