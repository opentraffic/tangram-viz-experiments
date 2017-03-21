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

	// Feature selection
	var picking = false;
	function initFeatureSelection () {
		layer.setSelectionEvents({
			hover: function(selection) {
				if (!picking) {
					if (!selection || selection.feature == null || selection.feature.properties == null) {
						picking = false;
						popup.style.visibility = 'hidden';
						return;
					}

					var properties = selection.feature.properties;
					popup.style.width = 'auto';
					popup.style.left = (selection.pixel.x + 0) + 'px';
					popup.style.top = (selection.pixel.y + 0) + 'px';
					popup.style.margin = '10px';
					if (properties.name) {
						popup.innerHTML = '<span class="labelInner">' + properties.name + '</span><br>';
					} else {
						popup.innerHTML = '<span class="labelInner">' + 'unnamed ' + properties.kind + '</span><br>';
					}
					popup.innerHTML += '<span class="labelInner" style="font-size:10px;">' + 'Click to view more...' + '</span><br>';
					popup.style.visibility = 'visible';
				}
			}
		});
	}

	function createEditLinkElement (url, type, label) {
		var el = document.createElement('div');
		var anchor = document.createElement('a');
		el.className = 'labelInner';
		anchor.href = url;
		anchor.target = '_blank';
		anchor.textContent = label;
		anchor.addEventListener('click', function (event) {
			trackOutboundLink(url, 'mapzen_carto_debug', type);
		}, false);
		el.appendChild(anchor);
		return el;
	}

	/**
	* Function that tracks a click on an outbound link in Google Analytics.
	* This function takes a valid URL string as an argument, and uses that URL string
	* as the event label. Setting the transport method to 'beacon' lets the hit be sent
	* using 'navigator.sendBeacon' in browser that support it.
	*/
	function trackOutboundLink (url, post_name, editor) {
	   // ga('send', 'event', [eventCategory], [eventAction], [eventLabel], [eventValue], [fieldsObject]);
	   ga('send', 'event', 'outbound', post_name, url, {
		 'transport': 'beacon',
		 // If opening a link in the current window, this opens the url AFTER
		 // registering the hit with Analytics. Disabled because here want the
		 // link to open in a new window, so this hit can occur in the current tab.
		 //'hitCallback': function(){document.location = url;}
	   });
	}

	// convert tile coordinates to lat-lng
	// from http://gis.stackexchange.com/questions/17278/calculate-lat-lon-bounds-for-individual-tile-generated-from-gdal2tiles
	function tile2long(x,z) { return (x/Math.pow(2,z)*360-180); }
	function tile2lat(y,z) {
		var n=Math.PI-2*Math.PI*y/Math.pow(2,z);
		return (180/Math.PI*Math.atan(0.5*(Math.exp(n)-Math.exp(-n))));
	}

	function long2tile(lon,zoom) { return (Math.floor((lon+180)/360*Math.pow(2,zoom))); }
	function lat2tile(lat,zoom)  { return (Math.floor((1-Math.log(Math.tan(lat*Math.PI/180) + 1/Math.cos(lat*Math.PI/180))/Math.PI)/2 *Math.pow(2,zoom))); }

	function mapzenTileURL() {
		// find minimum max_zoom of all sources
		var max_zoom = 16;
		for (source in scene.config.sources) {
			if (scene.config.sources.hasOwnProperty(source)) {
				if (scene.config.sources[source].max_zoom != "undefined") {
					max_zoom = Math.min(max_zoom, scene.config.sources[source].max_zoom);
				}
			}
		}
		var zoom = max_zoom < map.getZoom() ? max_zoom : Math.floor(map.getZoom());
		var tileCoords = { x : long2tile(latlng.lng,zoom), y: lat2tile(latlng.lat,zoom), z: zoom };

		var url = 'http://tile.mapzen.com/mapzen/vector/v1/all/' + zoom + '/' + tileCoords.x  + '/' + tileCoords.y + '.topojson';
		return url;
	}

	/***** Render loop *****/

	// Create dat GUI
	var gui = new dat.GUI({ autoPlace: true });

	function addGUI() {
		gui.domElement.parentNode.style.zIndex = 10000;
		window.gui = gui;

		// Language selector
		var langs = {
			'(default)': false,
			'العربية (Arabic)': 'ar',
			'中文 (Chinese)': 'zh',
			'English': 'en',
			'français (French)': 'fr',
			'Русский (Russian)': 'ru',
			'español (Spanish)': 'es',
			'বাংলা (Bengali)': 'bn',
			'Deutsch (German)': 'de',
			'ελληνικά (Greek)': 'gr',
			'हिन्दी (Hindi)': 'hi',
			'Bahasa Indonesia (Indonesian)': 'id',
			'italiano (Italian)': 'it',
			'日本語 (Japanese)': 'ja',
			'한국어 (Korean)': 'ko',
			'Português (Portuguese)': 'pt',
			'Türkçe (Turkish)': 'tr',
			'Tiếng Việt (Vietnamese)': 'vi'
		};
		// use query language, else default to English
		gui.language = query.language || false;
		gui.add(gui, 'language', langs).onChange(function(value) {
			scene.config.global.ux_language = value;
			scene.updateConfig();
			//window.location.search = 'language=' + value;
		});
		gui.fallback_lang = query.language || false;
		gui.fallback_button = gui.add(gui, 'fallback_lang', langs).onChange(function(value) {
			scene.config.global.ux_language_fallback = value;
			scene.updateConfig();
			//window.location.search = 'language=' + value;
		});
		gui.fallback_button.name('lang fallback');

		// Labels selector
		var labels = {
			'(default)': 'some',
			'More': 'more',
			'Some': 'some',
			'Some (no shields)': 'some_no_shields',
			'None': 'none'
		};
		gui.labels = query.labels || 'some';
		gui.add(gui, 'labels', labels).onChange(function(value) {
			var _default = true;
			var _more = false;
			var _road_shields = true;

			if(value === 'more') {
				_more = true;
				_default = true;
				_road_shields = true;
			} else if(value === 'some') {
				_more = false;
				_default = true;
				_road_shields = true;
			} else if(value === 'some_no_shields') {
				_more = false;
				_default = true;
				_road_shields = false;
			} else {
				_more = false;
				_default = false;
				_road_shields = false;
			}

			scene.config.global.text_visible_continent = _default;
			scene.config.global.text_visible_admin = _default;
			scene.config.global.text_visible_populated_places = _default;
			scene.config.global.icon_visible_populated_places = _default;
			scene.config.global.text_visible_neighbourhoods = _default;
			scene.config.global.text_visible_neighbourhoods_e = _default;
			scene.config.global.text_visible_water = _default;
			scene.config.global.text_visible_water_labels = _default;
			scene.config.global.text_visible_island = _default;

			scene.config.global.sdk_road_shields = _road_shields;

			scene.config.global.text_visible_roads = _default;
			scene.config.global.text_visible_highway = _default;
			scene.config.global.text_visible_highway_e = _default;
			scene.config.global.text_visible_trunk_primary_route = _default;
			scene.config.global.text_visible_trunk_primary = _default;
			scene.config.global.text_visible_secondary = _default;
			scene.config.global.text_visible_tertiary = _default;
			scene.config.global.text_visible_minor_road = _default;
			scene.config.global.text_visible_minor_road_e = _default;
			scene.config.global.text_visible_service_road = _default;
			scene.config.global.text_visible_path = _default;
			scene.config.global.text_visible_piste = _default;
			scene.config.global.text_visible_steps = _default;

			scene.config.global.text_visible_highway_e = _default;
			scene.config.global.text_visible_trunk_primary_e2 = _default;
			scene.config.global.text_visible_trunk_primary_e = _default;
			scene.config.global.text_visible_secondary_e = _default;
			scene.config.global.text_visible_tertiary_e = _default;
			scene.config.global.text_visible_minor_road_e = _default;
			scene.config.global.text_visible_exits_e = _default;

			scene.config.global.text_visible_aerialway = _default;
			scene.config.global.text_visible_airport_gate = _default;
			scene.config.global.text_visible_exits = _default;

			scene.config.global.text_visible_building = _more;
			scene.config.global.text_visible_address = _more;

			scene.config.global.label_visible_poi_landuse = _more;
			scene.config.global.text_visible_poi_landuse = _more;
			scene.config.global.label_visible_poi_landuse_e = _more;
			scene.config.global.icon_visible_poi_landuse = _more;
			scene.config.global.icon_visible_poi_landuse_e = _more;
			scene.config.global.text_visible_poi_landuse_e = _more;
			scene.config.global.icon_visible_station = _more;

			scene.config.global.icon_visible_landuse_green = _default;
			scene.config.global.text_visible_landuse_green = _default;
			scene.config.global.text_visible_landuse_generic = _more;
			if( _more ) {
				scene.config.global.icon_size_green = [[13, '14px'], [16, '18px'], [18, '19px']];
				scene.config.global.icon_size_green_nationl_park = [[10,'18px'],[12,'28px'],[13,'36px']];
				scene.config.global.icon_size_green_airport = [[13,'12px'],[14,'12px'],[17,'18px'],[19,'36px']];
				scene.config.global.icon_size_green_l = [[14,'24px'],[16,'32px']];
			} else {
				scene.config.global.icon_size_green = [[0, '0px']];
				scene.config.global.icon_size_green_nationl_park = [[0, '0px']];
				scene.config.global.icon_size_green_airport = [[0, '0px']];
				scene.config.global.icon_size_green_l = [[0, '0px']];
			}
			scene.updateConfig();
			//window.location.search = 'language=' + value;
		});

		// Path/Trails selector
		var traffic_overlay = {
			'(default)': true,
			'Show': true,
			'Hide': false
		};
		// use path ux, else default to false
		gui.traffic_overlay = query.traffic_overlay || true;
		gui.traffic_button = gui.add(gui, 'traffic_overlay', traffic_overlay).onChange(function(value) {
			scene.config.global.sdk_traffic_overlay = (value === 'true' || value === true); // dat.gui passes a string
			scene.updateConfig();
		});
		gui.traffic_overlay.name('traffic');

		// Enable/disable interactivity for all features
		var interactive_label = 'interactive';
		gui[interactive_label] = false;
		gui.add(gui, interactive_label).onChange(function(value) {
			scene.setIntrospection(value);
		});
		scene.setIntrospection(gui[interactive_label]);

		// Take a screenshot and save to file
		gui.save_screenshot = function () {
			return scene.screenshot().then(function(screenshot) {
				// uses FileSaver.js: https://github.com/eligrey/FileSaver.js/
				timestamp = new Date();
				month = timestamp.getMonth()+1;
				if( month < 10 ) { month = '0' + month; }
				prettydate = timestamp.getFullYear() + month + timestamp.getDate() + timestamp.getHours() + timestamp.getMinutes();
				map_location = map.getZoom() + '-' + map.getCenter().lat.toFixed(5) + '-' + map.getCenter().lng.toFixed(5);
				saveAs(screenshot.blob, 'tangram-' + map_location + '-' + prettydate + '.png');
			});
		};
		gui.screenshot = gui.add(gui, 'save_screenshot');
		gui.screenshot.name('save screenshot');

		// Take a video capture and save to file
		if (typeof window.MediaRecorder == 'function') {
			gui.video = function () {
				if (!gui.video_capture) {
					if (scene.startVideoCapture()) {
						gui.video_capture = true;
						gui.video_button.name('stop video');
					}
				}
				else {
					return scene.stopVideoCapture().then(function(video) {
						gui.video_capture = false;
						gui.video_button.name('capture video');
						saveAs(video.blob, 'tangram-video-' + (+new Date()) + '.webm');
					});
				}
			};
			gui.video_button = gui.add(gui, 'video');
			gui.video_button.name('capture video');
			gui.video_capture = false;
		}

		// Link to edit in OSM - hold 'e' and click
		map.getContainer().addEventListener('dblclick', function (event) {
			//console.log( 'dblclick was had' );
			if( timer ) { clearTimeout( timer ); timer = null; }
			popup.style.visibility = 'hidden';
		});

		var timer;

		map.getContainer().addEventListener('mousemove', function (event) {
			picking = false;
			popup.style.visibility = 'hidden';
			return;
		});

		layer.setSelectionEvents({
			click: function(selection) {
				if( timer ) { clearTimeout( timer ); timer = null; }
				timer = setTimeout( function() {
					picking = true;
					latlng = selection.leaflet_event.latlng;

					if( key.cmd || key.alt ) {
						window.open( mapzenTileURL(), '_blank' );
					} else {
						var url = 'https://www.openstreetmap.org/edit?';
						if (!selection || selection.feature == null || selection.feature.properties == null) {
							picking = false;
							popup.style.visibility = 'hidden';
							return;
						}
						//console.log(selection.feature, selection.changed);
						// enable iD to show properties sidebar for selected feature
						osm_type = 'node';
						osm_zoom = '19'
						if( selection.feature.properties.sort_key ) {
							osm_type = 'way';
							osm_zoom = Math.max( 17, map.getZoom() );
						}
						osm_id = selection.feature.properties.id;
						if( osm_id < 0 ) {
							osm_type = 'relation'
							osm_id = Math.abs( osm_id );
							osm_zoom = Math.max( 16, map.getZoom() );
						}
						url += osm_type + '=' + osm_id;
						// and position the map so it's at a similar zoom to Tangram
						if (latlng) {
							url += '#map=' + osm_zoom + '/' + latlng.lat + '/' + latlng.lng;
						}

						if( key.shift ) {
							window.open(url, '_blank');
						} else {
							var properties = selection.feature.properties;

							var label = '';
							//console.log(properties);
							for (var x in properties) {
								var val = properties[x]
								label += "<span class='labelLine' key="+x+" value="+val+"'>"+x+" : "+val+"</span><br>"
							}

							var layers = selection.feature.layers;
							label += "<span class='labelLine'>Layers:</span><br>"
							layers.forEach(function(val) {
								label += "<span class='labelLine' value="+val+"'>  "+val+"</span><br>"
							});

							if (label != '') {
								popup.style.left = (selection.pixel.x) + 'px';
								popup.style.top = (selection.pixel.y) + 'px';
								popup.style.margin = '0px';
								popup.innerHTML = '<span class="labelInner">' + label + '</span>';
							}

							// JOSM editor link
							var position = '19' + '/' + latlng.lat + '/' + latlng.lng;
							var josmUrl = 'http://www.openstreetmap.org/edit?editor=remote#map='+position;

							popup.appendChild(createEditLinkElement( url, 'iD', 'Edit with iD ➹') );
							popup.appendChild(createEditLinkElement( mapzenTileURL(), 'rawTile', 'View tile data ➹') );
							//popup.appendChild(createEditLinkElement( josmUrl, 'JOSM', 'Edit with JOSM ➹') );
							popup.style.visibility = 'visible';
						}
					}
					timer = null;
				}, 200 );
			}
		});
	}

	function inIframe () {
		try {
			return window.self !== window.top;
		} catch (e) {
			return true;
		}
	}

	// Add map
	window.addEventListener('load', function () {
		// Scene initialized
		layer.on('init', function() {
			var camera = scene.config.cameras[scene.getActiveCamera()];
			// if a camera position is set in the scene file, use that
			if (defaultpos && typeof camera.position != "undefined") {
				map_start_location = [camera.position[1], camera.position[0], camera.position[2]]
			}
			map.setView([map_start_location[0], map_start_location[1]], map_start_location[2]);

			if (!inIframe()) {
				addGUI();
			}
		});
		if (!inIframe()) {
			map.scrollWheelZoom.enable();
			initFeatureSelection();
		}

		// Listen to when the user stop moving (`moveend`) the leaflet map
		// Note: a debounce function is use to prevent multiple calls to OpenWeatherMaps api
		map.on('moveend', debounce(function() {
			// Update the displayed information
			update();
		}, 1000));

		function addToMap () {
			layer.addTo(map);
		}
	});

    return map;
    
}());

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
