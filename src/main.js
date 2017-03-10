// Init tangram
map = (function () {
    'use strict';
    
    // Create a Leaflet Map
    var map = L.map('map',{
        trackResize: true,
        keyboard: false,
        dragging: (window.self !== window.top && L.Browser.touch) ? false : true,
        tap: (window.self !== window.top && L.Browser.touch) ? false : true,
    });

    // Create a Tangram Layer
    var layer = Tangram.leafletLayer({
        scene: 'scene.yaml',
        attribution: '<a href="http://openweathermap.org/" target="_blank">OpenWeatherMap</a> | <a href="https://mapzen.com/tangram" target="_blank">Tangram</a> | &copy; OSM contributors | <a href="https://mapzen.com/" target="_blank">Mapzen</a>'
    });

    window.layer = layer;
    var scene = layer.scene;
    window.scene = scene;

    map.setView([39.825, -98.170], 5); // Default map location
    var hash = new L.Hash(map);

    /***** Once the page is loaded is time to initialize the routines that handles the interaction *****/
    window.addEventListener('load', function () {
        init();
    });

    return map;
}());

function init() {

    // Listen to when the user stop moving (`moveend`) the leaflet map
    // Note: a debounce function is use to prevent multiple calls to OpenWeatherMaps api
    map.on('moveend', debounce(function() {
        // Update the displayed information
        update();
    }, 1000));

    // Add Tangram `layer` to Leaflet `map`
    layer.addTo(map);
}

function update() {

    // Get the current boundaries of the displayed area on the map
    var bbox = map.getBounds();
    var day = moment().format('YYYY-MM-DD')
    var hour = moment().format('HH:MM:SS')

    // Make the URL for OpenWeatherMaps API, asking for all stations inside that area (bounding box)
    var url = 'https://localhost:3000/query?';
    url += '&start_date_time=' + day + 'T'+ moment().subtract(1,'hour').format('HH:MM:SS');
    url += '&end_date_time=' + day + 'T' + moment().format('HH:MM:SS');
    url += '&boundingbox=' + bbox.getSouthWest().lng + ',' +bbox.getSouthWest().lat + ',' + bbox.getNorthEast().lng + ',' + bbox.getNorthEast().lat;

    console.log('Fake call to:', url);

    // // Make the request and wait for the reply
    // fetch(url)
    //     .then(function (response) {
    //         // If we get a positive response...
    //         if (response.status !== 200) {
    //             console.log('Error getting data: ' + response.status);
    //             return;
    //         }
    //         // ... parse it to JSON
    //         return response.json();
    //     })
    //     .then(function(json) {
    //         var data = { " opentraffic": json };
    //         console.log(data);

    //         // Pass the POIs as a GeoJSON FeaturesCollection to tangram
    //         scene.setDataSource('opentraffic', {type: 'GeoJSON', data: json});
    //     })
    //     .catch(function(error) {
    //         console.log('Error parsing the GeoJSON.', error)
    //     })
}


// ============================================= Some Helper functions
function debounce(func, wait, immediate) {
    var timeout;
    return function() {
        var context = this, args = arguments;
        var later = function() {
            timeout = null;
            if (!immediate) func.apply(context, args);
        };
        var callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(context, args);
    };
};
