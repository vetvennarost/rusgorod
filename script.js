var data = {};
var groups = {};
var map;

/*
 * Given a string `str`, replaces whitespaces with dashes,
 * and removes nonalphanumeric characters. Used in URL hash.
 */
var slugify = function(str) {
  return str.replace(/[^\w ]+/g,'').replace(/ +/g,'-');
}

/*
 * Resets map view to originally defined `mapCenter` and `mapZoom` in settings.js
 */
var resetView = function() {
  map.flyTo( mapCenter, mapZoom );
  resetSidebar();
}

/*
 * Resets sidebar, clearing out place info and leaving title+footer only
 */
var resetSidebar = function() {
    // Make the map title original color
    $('header').removeClass('black-50');

    // Clear placeInfo containers
    $('#placeInfo').addClass('dn');
    $('#placeInfo h2, #placeInfo h3').html('');
    $('#placeInfo div').html('');
    $('#googleMaps').addClass('dn').removeClass('dt');

    // Reset hash
    location.hash = '';
}

/*
 * Given a `marker` with data bound to it, update text and images in sidebar
 */
var updateSidebar = function(marker) {

  // Get data bound to the marker
  var d = marker.options.placeInfo;

  if (L.DomUtil.hasClass(marker._icon, 'markerActive')) {
    // Deselect current icon
    L.DomUtil.removeClass(marker._icon, 'markerActive');
    resetSidebar();
  } else {
    location.hash = d.slug;

    // Dim map's title
    $('header').addClass('black-50');
    $('#placeInfo').removeClass('dn');

    // Clear out active markers from all markers
    $('.markerActive').removeClass('markerActive');

    // Make clicked marker the new active marker
    L.DomUtil.addClass(marker._icon, 'markerActive');

    // Populate place information into the sidebar
    $('#placeInfo').animate({opacity: 0.5}, 300).promise().done(function() {
      $('#placeInfo h2').html(d.Name);
      $('#placeInfo h3').html(d.Subtitle);
      $('#description').html(d.Description);

      if (d.GoogleMapsLink) {
        $('#googleMaps').removeClass('dn').addClass('dt').attr('href', d.GoogleMapsLink);
      } else {
        $('#googleMaps').addClass('dn').removeClass('dt');
      }

      $('#gallery').html('');
      $('#galleryIcon').hide();

      // Load up to 5 images
      for (var i = 1; i <= 5; i++) {
        var idx = 'Image' + i;

        if (d[idx]) {

          var source = "<em class='normal'>" + d[idx + 'Source'] + '</em>';

          if (source && d[idx + 'SourceLink']) {
            source = "<a href='" + d[idx + 'SourceLink'] + "' target='_blank'>" + source + "</a>";
          }

          var a = $('<a/>', {
            href: d[idx],
            'data-lightbox': 'gallery',
            'data-title': ( d[idx + 'Caption'] + ' ' + source )  || '',
            'data-alt': d.Name,
            'class': i === 1 ? '' : 'dn'
          });

          var img = $('<img/>', { src: d[idx], alt: d.Name, class: 'dim br1' });
          $('#gallery').append( a.append(img) );

          if (i === 1) {
            $('#gallery').append(
              $('<p/>', { class: 'f6 black-50 mt1', html: d[idx + 'Caption'] + ' ' + source })
            );
          }

          if (i === 2) {
            $('#gallery > a:first-child').append('<span class="material-icons arrow arrow-right white-90">navigate_next</span>')
            $('#gallery > a:first-child').append('<span class="material-icons arrow arrow-left white-90">navigate_before</span>')
          }

        } else {
          break;
        }
      }

      $('#placeInfo').animate({ opacity: 1 }, 300);

      // Scroll sidebar to focus on the place's title
      $('#sidebar').animate({
        scrollTop: $('header').height() + 20
      }, 800);
    })
  }
}

/*
 * Main function that generates Leaflet markers from read CSV data
 */
var addMarkers = function(data) {

  var activeMarker;
  var hashName = decodeURIComponent( location.hash.substr(1) );

  for (var i in data) {
    var d = data[i];

    // Create a slug for URL hash, and add to marker data
    d['slug'] = slugify(d.Name);

    // Add an empty group if doesn't yet exist
    if (!groups[d.Group]) { groups[d.Group] = []; }

	// Create a new place marker
    var m = L.marker(
      [d.Latitude, d.Longitude],
      {
        icon: L.icon({
        iconUrl: d.Icon,
	//iconSize: [ iconWidth, iconHeight ],
        iconAnchor: [ iconWidth*2, iconHeight*2 ], // middle of icon represents point center
        className: 'br1',
        }),
        // Pass place data
        placeInfo: d
      },
    ).on('click', function(e) {
   	map.flyTo(this._latlng, this._zoom);
	updateSidebar(this);
    })
    
    .bindTooltip(d.Name, 
	{
	permanent: true,
	offset: Point(3, 3),
	direction: right,
    	opacity: 0.5
    	}
	);
	  
	  
		  

    // Add this new place marker to an appropriate group
    groups[d.Group].push(m);

    if (d.slug === hashName) { activeMarker = m; }
  }

  // Transform each array of markers into layerGroup
  for (var g in groups) {
    groups[g] = L.layerGroup(groups[g]);

    // By default, show all markers
    groups[g].addTo(map);
  }

  L.control.layers({}, groups, {collapsed: false}).addTo(map);
  $('.leaflet-control-layers-overlays').prepend('<h3 class="mt0 mb1 f5 black-30">Themes</h3>');

  // If name in hash, activate it
  if (activeMarker) { activeMarker.fire('click') }

}

/*
 * Loads and parses data from a CSV (either local, or published
 * from Google Sheets) using PapaParse
 */
var loadData = function(loc) {

  Papa.parse(loc, {
    header: true,
    download: true,
    complete: function(results) {
      addMarkers(results.data);
    }
  });

}

/*
 * Add home button
 */
var addHomeButton = function() {

  var homeControl = L.Control.extend({
    options: {
      position: 'bottomright'
    },

    onAdd: function(map) {
      var container = L.DomUtil.create('span');
      container.className = 'db material-icons home-button black-80';
      container.innerText = 'map';
      container.onclick = function() {
        resetView();
      }

      return container;
    }
  })

  map.addControl(new homeControl);

}

	// Defining borders of the map
var corner1 = L.latLng(41, 0),
corner2 = L.latLng(68, 70),
bounds = L.latLngBounds(corner1, corner2);


/*
 * Main function to initialize the map, add baselayer, and add markers
 */

var initMap = function() {


<!-- Defining borders of the map -->
var corner1 = L.latLng(41, 0),
corner2 = L.latLng(68, 70),
bounds = L.latLngBounds(corner1, corner2);	
	
	
map = L.map('map', {
    tap: false, // to avoid issues in Safari, disable tap
    zoomControl: false,
  })
.setView([55, 37], 6)
.setMaxBounds(bounds);

	// Add zoom control to the bottom-right corner
L.control.zoom({ position: 'bottomright' })
.addTo(map);
	
	// Adding zoom level in bottom-left corner of the map
L.control.zoomLabel()
.addTo(map);
	
	// Colorizing layers
let fPhysical = ['bright:76%','contrast:200%','saturate:142%'];
let fOcean = ['bright:74%','contrast:200%','saturate:400%'];
let fRelief = ['bright:87%','contrast:200%','saturate:100%'];

	// Applying Ocean layer from ArcGIS, colorized with Leaflet.TileLayer.ColorFilter
L.tileLayer.colorFilter(
'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}.png', 
	{
	minZoom: 5,
	maxZoom: 10,
	opacity: 0.7,
	attribution: '<a href="https://wikimediafoundation.org/wiki/Maps_Terms_of_Use">Wikimedia</a>, Tiles &copy; Esri &mdash; Sources: GEBCO, NOAA, CHS, OSU, UNH, CSUMB, National Geographic, DeLorme, NAVTEQ, and Esri, &copy; <a href="http://osm.org/copyright" target="_blank">OpenStreetMap</a> contributors',
	filter: fOcean
	}
)
.addTo(map);

	// Applying Physical layer from ArcGIS, colorized with Leaflet.TileLayer.ColorFilter
L.tileLayer.colorFilter(
'https://server.arcgisonline.com/ArcGIS/rest/services/World_Physical_Map/MapServer/tile/{z}/{y}/{x}.png', 
	{
        minZoom: 5,
	maxZoom: 6.9,
	opacity: 0.4,
	filter: fPhysical
	}
)
.addTo(map);

	// Applying Relief layer from ArcGIS, colorized with Leaflet.TileLayer.ColorFilter
L.tileLayer.colorFilter(
'https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}.png', 
	{
	minZoom: 7,
	maxZoom: 9.9,
	opacity: 0.5,
	filter: fRelief
	}
)
.addTo(map);

L.tileLayer.colorFilter(
'https://tiles.wmflabs.org/hillshading/{z}/{x}/{y}.png', 
	{
    minZoom: 10,
	maxZoom: 10,
	opacity: 0.5
	}
)
.addTo(map);
	
	

  loadData(dataLocation);

  // Add data & GitHub links
  map.attributionControl.setPrefix('View <a href="https://github.com/vetvennarost/rusgorod" target="_blank">code on\
    GitHub</a> | created with <a href="http://leafletjs.com" title="A JS library\
    for interactive maps">Leaflet</a>');

  // Add custom `home` control
  addHomeButton();

  $('#closeButton').on('click', resetView);
}

// When DOM is loaded, initialize the map
$('document').ready(initMap);
