'use strict';

var utils = new Utils();
var homeLink = $('#home');
var title = $('#page-title');
var stateLink = $('#state-detail-link');
var stateLinkName = $('#breadcrumb-state-name');
var dateSelect = $('#date-select');
var dateLookup = $('#date-lookup');
var dateTimeline = $('#date-timeline ul');
var hash = utils.getHash(); // this may have to be changed for production

// Jim: update this URL/attribution string if you need
var baseMapUrl = 'http://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png';
var baseMapAttribution = '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="http://cartodb.com/attributions">CartoDB</a>';

var basemap = new L.tileLayer(baseMapUrl, {
  attribution: baseMapAttribution
});
var mapOpts = {
  center: [39, -97],
  fullscreenControl: true,
  scrollWheelZoom: false,
  zoom: 4
};
var map = new L.Map('map', mapOpts);
var router = new Router({
	'/': mapsMainPage,
	'/:state': loadStateMap
});
var activeLayer = [];
var layerChangeZooming = false;
var userFocused = false;
var info = L.infoBox();

info.addTo(map);

L.easyPrint().addTo(map);

map.addLayer(basemap);

map.on('dragstart zoomstart', function(event) {
	if (event.type === 'dragstart' || (event.type === 'zoomstart' && !layerChangeZooming)) {
		userFocused = true;
	}
});

initializeForm();
startRouter();

// Set up initial form values and event handlers for form changes
function initializeForm() {
	dateTimeline.empty()

	dateSelect.datepicker({
	  changeMonth: true,
	  changeYear: true,
	  constrainInput: true,
	  dateFormat: "yy-mm-dd"
	});
	dateSelect.val(utils.getDate());

	dateSelect.on('keydown', function (event) {
		if (event.keyCode === 13) {
			event.preventDefault();
			updateDate(event.target.value);
		}
	});

	dateLookup.on('click', function (event) {
	  event.preventDefault();

	  updateDate(dateSelect.val());
	});

	dateTimeline.on('click', 'li', function (event) {
	  event.preventDefault();

	  var date = $(this).data('date');

	  setDate(date);
	  updateDate(date);
	});
}

// initialize the router
function startRouter() {
	// make sure the url has a hash so the router doesn't break
	// change this for production
	if (hash === '' || hash === '/') {
		// window.location = '/borders/map/map.html#'; // ideally, remove this bloody index.html nonsense
	}

	router.configure({
		// uncomment html5history if the server supports clean urls
		// change this for production
		// html5history: true,
		notfound: mapsMainPage
	});

	router.init('/');
}

/**
 * Routes
 */

function mapsMainPage() {
	homeLink.addClass('hidden');
	stateLink.addClass('hidden');

	title.text('Maps');

	info.update();

	dateTimeline.empty();

	if (activeLayer.length) {
		activeLayer = activeLayer.reduce(function(empty, layer) {
			map.removeLayer(layer);

			return empty;
		}, []);
	}

	cartodb.createLayer(map, 'https://newberrydis.carto.com/api/v2/viz/6b8d5f72-4d05-11e6-8f00-0ee66e2c9693/viz.json')
		.addTo(map)
		.on('done', function(layer) {
			activeLayer.push(layer);
			map.setView(mapOpts.center, mapOpts.zoom);
		});
}

function loadStateMap(state) {
	var stateName = statesList[state];
	var dateListQuery = 'SELECT DISTINCT ON (start_date) start_date, to_char(start_date, \'YYYY-MM-DD\') date FROM us_histcounties_gen001 WHERE state_terr ';

	// The fix to the ILIKE statement took care of KS/AR and VA/WV discrepancies
	// however, it filtered out "District of Louisiana", so a fix for this is below
	if (state === 'LA') {
		dateListQuery += '~* \' ?' + stateName + '.*\'';
	} else {
		dateListQuery += 'ILIKE \'' + stateName + '\%\'';
	}

	dateListQuery += ' ORDER BY start_date ASC';

	homeLink.removeClass('hidden');
	stateLink.removeClass('hidden');

	title.text(stateName);
	stateLinkName.text(stateName);

	stateLink.attr('href', '../pages/' + stateName.replace(' ', '_') + '.html');

	dateSelect.removeAttr('disabled');

	info.update();

	$.getJSON(encodeURI('https://newberrydis.cartodb.com/api/v2/sql/?q=' + dateListQuery))
		.done(populateDateList)
		.done(setInitialLayer(state));
}

/**
 * Events
 */

function updateDate(date) {
	var state = utils.getHash();

	getLayersForDate(date, state);
}

function viewState(event) {
	event.preventDefault();

	var state = event.target.value;

	router.setRoute(state);
}

/**
 * Data
 */

function populateDateList(data) {
	dateTimeline.empty();

	$.each(data.rows, function(key, val) {
		var date = $('<li data-date="' + val.date + '">' + val.date + '</li>');

		dateTimeline.append(date);
	});
}

function setInitialLayer(state) {
	return function(data) {
		var firstRow = data.rows.slice(0, 1)[0];
		var lastRow = data.rows.slice(-1)[0];
		var firstYear = firstRow.date.split('-')[0];
		var lastYear = lastRow.date.split('-')[0];

		dateSelect.datepicker('option', 'maxDate', lastRow.date);
		dateSelect.datepicker('option', 'minDate', firstRow.date);
		dateSelect.datepicker('option', 'yearRange', firstYear + ':' + lastYear);

		dateSelect.val(firstRow.date);

		setDate(firstRow.date);

		getLayersForDate(firstRow.start_date, state, true);
	}
}

function setDate(date) {
	var child = dateTimeline.children('[data-date="' + date + '"]');

	dateTimeline.children().removeClass('selected');
	child.addClass('selected');
}

function getLayersForDate(date, state, initialLayer) {
	var stateName = statesList[state];
	var layerQuery = 'SELECT ST_AsGeoJSON(the_geom) as geo, full_name, change, start_date, end_date FROM us_histcounties_gen001 WHERE state_terr ';
	var resizeLayer = initialLayer || !userFocused;

	// The fix to the ILIKE statement took care of KS/AR and VA/WV discrepancies
	// however, it filtered out "District of Louisiana", so a fix for this is below
	if (state === 'LA') {
		layerQuery += '~* \' ?' + stateName + '.*\'';
	} else {
		layerQuery += 'ILIKE \'' + stateName + '\%\'';
	}

	layerQuery += ' AND start_date <= \'' + date + '\' AND end_date >= \'' + date + '\'';

	layerChangeZooming = true;

	return $.getJSON(encodeURI('https://newberrydis.cartodb.com/api/v2/sql/?q=' + layerQuery)).done(function(data) {
		var feature = getFeatureFromData(data),
			layerToDisplay = L.geoJson(feature, {
				onEachFeature: function(feature, layer) {
					layer.on('mouseout', utils.debounce(function(event) {
						event.target.setStyle({
							fillColor: '#0033ff'
						});
					}, 50));
					layer.on('mouseover', utils.debounce(function(event) {
						event.target.setStyle({
							fillColor: '#0099ff'
						});
						info.update(feature.properties);
					}, 50));
				}
			});

		if (activeLayer.length) {
			activeLayer = activeLayer.reduce(function(empty, layer) {
				map.removeLayer(layer);

				return empty;
			}, []);
		}

		activeLayer.push(layerToDisplay);

		layerToDisplay.addTo(map);

		if (resizeLayer) {
			map.fitBounds(layerToDisplay);
		}

		layerToDisplay.resetStyle();

		layerChangeZooming = false;
	});
}

function getFeatureFromData(data) {
	var feature = [],
		i, currentRow, rowFeature;

	for (i = 0; i < data.rows.length; i++) {
		currentRow = data.rows[i];
		rowFeature = JSON.parse(currentRow.geo);

		feature.push({
			type: 'Feature',
			geometry: rowFeature,
			properties: {
				fullName: currentRow.full_name,
				change: currentRow.change,
				dates: {
					start: currentRow.start_date,
					end: currentRow.end_date
				}
			}
		});
	}

	return feature;
}



/**
 * Utilities
 */

function Utils() {
	return {
		getHash: function() {
			return window.location.hash.replace(/^[#\/]+/, '');
		},
		getDate: function(datestamp) {
			var today = new Date(datestamp);
			var month = initialZero(today.getMonth() + 1);
			var date = initialZero(today.getDate());
			var todaysDate = today.getFullYear()+'-'+month+'-'+date;

			return todaysDate;
		},
		debounce: function(func, wait, immediate) {
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
		}
	}

	function initialZero (int) {
		var num = String(int);

		return (num.length > 1) ? num : '0' + num;
	}
}
