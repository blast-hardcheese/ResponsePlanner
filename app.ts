///<reference path="definitions/jquery/jquery.d.ts" />
///<reference path="definitions/googlemaps/google.maps.d.ts" />
///<reference path="definitions/toastr/toastr.d.ts" />
///<reference path="definitions/geojson/geojson.d.ts" />

module ResponsePlanner {
    interface APIHandler {

    }

    class ArcGisAPIHandler implements APIHandler {

        private base = "http://gis.rctlma.org/arcgis/rest/services/Public";
        serviceName: string = null;
        serviceIndex: number = null;

        constructor(serviceName: string, serviceIndex) {
            this.serviceName = serviceName;
            this.serviceIndex = serviceIndex;
        }
    }

    export class App {
        map: google.maps.Map = null;
        private api: APIHandler = null;

        constructor() {
        }

        init = () => {
            var mapOptions = {
                zoom: 3,
                center: new google.maps.LatLng(0, 0),
            };

            this.api = new ArcGisAPIHandler("FeatureServer");

            this.map = new google.maps.Map(document.getElementById('map-canvas'), mapOptions);
            this.location_init();
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
