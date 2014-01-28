
$(function() {

  ///////////////////////////////////////////////
  // Get elements used and wrap them in jQuery //
  ///////////////////////////////////////////////

  var $userInputForm = $('#user-input-form'),
      $userTextInput = $('.distance-to'),
      $distanceInKilometersEl = $('#distance-in-km'),
      $routeInfoEl = $('.route-info');

  /////////////////////////////////////////////////////
  // use an AppModel to remember state and keep tidy //
  /////////////////////////////////////////////////////

  var AppModel = function () {};

  AppModel.prototype = {

    searchHistory : [],
    ul : document.getElementById('search-history-list'),
    searchHistoryStatus : document.getElementById('search-history-status'),

    get : function (prop) {
      return this[prop];
    },

    set : function (prop, value) {
      this[prop] = value;
    },

    add : function (searchHistoryArgument) {
      this.toggleHistoryStatus();
      var i;

      if(typeof searchHistoryArgument.length !== 'undefined') {
        // Since this will only happen once, i dont need to check wether the objects are already in there
        for(i = 0;i<searchHistoryArgument.length;i++) {
          this.searchHistory.push(searchHistoryArgument[i]);
          this.renderList(searchHistoryArgument[i].formattedAddress);
        }
      } else {
        for(i = 0;i<this.searchHistory.length;i++) {
          // prevent duplication
          if(this.searchHistory[i].formattedAddress === searchHistoryArgument.formattedAddress) {
            return;
          }
        }

        // Add search history to the array
        this.searchHistory.push(searchHistoryArgument);

        // Set the local storage with new history object
        localStorage.setItem('searchHistory', JSON.stringify(this.searchHistory));

        // Display the results
        this.renderList(searchHistoryArgument.formattedAddress);
      }
    },

    clearHistory : function () {
      localStorage.clear();
      this.searchHistory = [];
      this.renderList();
    },

    removeSingleItem : function (address, $el) {
      for(var i = 0;i<this.searchHistory.length;i++) {
        if(this.searchHistory[i].formattedAddress === address) {
          this.searchHistory.splice(i, 1);
        }
      }
      $el.remove();
      localStorage.setItem('searchHistory', JSON.stringify(this.searchHistory));
      this.renderList();
    },

    renderList : function (formattedAddress) {

      if(this.toggleHistoryStatus() || typeof formattedAddress === 'undefined') {
        return;
      }

      var $li = $('<li />')
          .data('address', formattedAddress),

          $a = $('<a />').attr({
            'title' : formattedAddress,
            'class' : 'list-item-a'
          }),

          $button = $('<button />').addClass('remove-list-item');

      // Append els
      $li.append($a)
         .append($button);

      // Add html to element
      $a.html(formattedAddress);
      $button.html('X');

      // Final redraw/reflow call
      $(this.ul).prepend($li);
    },

    toggleHistoryStatus : function () {
      if(this.searchHistory.length < 1) {
        this.searchHistoryStatus.innerHTML = "(You don't have any yet)";
        this.ul.innerHTML = '';
        return true;
      } else {
        this.searchHistoryStatus.innerHTML = "";
        return false;
      }
    }
  }

  var appModel = new AppModel();

  //////////////////////////////////////
  // Initialize geo and set callbacks //
  //////////////////////////////////////

  geoSuccess = function (position) {

    var crds = position.coords;
    appModel.set('latitude', crds.latitude);
    appModel.set('longitude', crds.longitude);
    appModel.set('accuracy', crds.accuracy);

    // Check local storage
    if(localStorage.length !== 0 && JSON.parse(localStorage.getItem('searchHistory')).length > 0) {
      appModel.add(JSON.parse(localStorage.getItem('searchHistory')));
    } else {
      appModel.renderList();
    }

    // Get the Google API and init once ready
    loadGoogleApi();
  };

  geoError = function (error) {
    console.log('There was an error : ', error);
  };

  geocoderCallback = function (results, status) {

    if(results.length < 1) {
      // Could make modal window here or display better warning
      alert('We cant find that :D');
    }

    // Clear previous lines and markers
    // Could be a listener so not have to call this every time
    clearOverlays();

    var measuredLatLong = results[0] && results[0].geometry.location;

    if (status == google.maps.GeocoderStatus.OK) {
      var path = new google.maps.Polyline({
        path: [appModel.get('userLatLong'), measuredLatLong],
        strokeColor: "#FF0000",
        strokeOpacity: 1.0,
        strokeWeight: 2,
        geodesic: true,
        map: gMap
      });

      // Store a reference in array for clearing
      markersArray.push(path);
      placeMarker(measuredLatLong);

      // Add search to the collection
      appModel.add({
        formattedAddress : results[0].formatted_address,
        latLong : measuredLatLong
      });

      // Set the distance in meters
      var distanceBetweenTwoPoints = google.maps.geometry.spherical.computeDistanceBetween(appModel.get('userLatLong'), measuredLatLong);
      showDisplayDistance(distanceBetweenTwoPoints);

      // Go to location
      gMap.panTo(measuredLatLong);

    }
  };

  var geoOptions = {
    enableHighAccuracy: true,
    timeout: 5000,
    maximumAge: 60000
  };

  // Start the app by getting users location
  navigator.geolocation.getCurrentPosition(geoSuccess, geoError, geoOptions);

  /////////////////////////////////////////
  // Initialize Google maps and listener //
  /////////////////////////////////////////

  var gMap,
      geocoder,
      markersArray = [],
      // Flag to not add the users position to the array
      firstMarker = true;

  window.initMaps = function () {

    appModel.set('userLatLong', new google.maps.LatLng(appModel.get('latitude'), appModel.get('longitude')));

    var mapOptions = {
      center: appModel.get('userLatLong'),
      zoom: 9,
      disableDefaultUI: true,
      mapTypeId: google.maps.MapTypeId.ROADMAP
    };

    gMap = new google.maps.Map(document.getElementById("map-canvas"), mapOptions);
    geocoder = new google.maps.Geocoder();

    // Show approximate user location
    placeMarker(appModel.get('userLatLong'));

    // Display the user interface
    initUserInterface();

  };

  function placeMarker (latLong) {

    var markerOptions = {
      position: latLong,
      map: gMap,
      title:"Accuracy up to " + appModel.get('accuracy'),
      animation: google.maps.Animation.DROP
    };

    // var never used but could be reference to add to array for marker removal
    var marker = new google.maps.Marker(markerOptions);

    if(firstMarker === true) {
      firstMarker = false;
      return;
    }

    // Store a reference in array for clearing
    markersArray.push(marker);

  }

  function loadGoogleApi () {
    var script = document.createElement("script"),
        urlParams = {
          key : 'AIzaSyAJz-qXUYE-uxiypUu5CU9PXYvCc92FDms',
          sensor : 'true',
          callBack : 'initMaps',
          library : 'geometry'
        };

    script.type = "text/javascript";
    script.src = "http://maps.googleapis.com/maps/api/js?key=" + urlParams.key + "&sensor=" + urlParams.sensor + "&callback=" + urlParams.callBack + "&libraries=" + urlParams.library;
    document.body.appendChild(script);
  }

  ///////////////////
  // Form controls //
  ///////////////////

  $userInputForm.submit(formHandler);

  function formHandler (e) {
    e.preventDefault();

    // Check to see if the user has entered anything
    if(checkInputLength()) {
      return;
    }

    var address = $userTextInput.val();
    geocoder.geocode({ 'address': address}, geocoderCallback);

  }

  function checkInputLength () {
    if($userTextInput.val().length < 1) {
      displayFormError();
      return true;
    } else {
      removeFormError();
      return false;
    }
  }

  //////////////////////
  // DOM Manipulation //
  //////////////////////

  function initUserInterface () {
    showUserInterface();
    updateAccuracyReading();
  }

  function updateAccuracyReading () {
    var el = document.getElementById('geo-accuracy');
    el.innerHTML = appModel.get('accuracy');
  }

  function showUserInterface () {
    var el = document.getElementById('user-input-form');
    el.style.display = "block";
  }

  function displayFormError () {
    $userInputForm.addClass('error');
    $userTextInput.attr('placeholder', 'Please enter something');
  }

  function removeFormError () {
    $userInputForm.removeClass('error');
  }

  function clearInput () {
    $userTextInput.val('');
  }

  function showDisplayDistance (distance) {
    $routeInfoEl.show();
    // Work out the distance in Km. Round it up also.
    $distanceInKilometersEl.html(Math.round(Math.floor(distance) / 1000));
  }

  function hideDisplayDistance () {
    $routeInfoEl.hide();
  }

  ///////////////
  // Utilities //
  ///////////////

  function clearOverlays () {
    for(var i = 0; i<markersArray.length;i++) {
      markersArray[i].setMap(null);
    }
    markersArray = [];
  }

  ////////////////
  // Set events //
  ////////////////

  // Just want to set one click event to the body
  $('body').on('click', function (e) {
    switch (e.target.className) {
      case 'clear-map' :
        e.preventDefault();
        clearOverlays();
        removeFormError();
        hideDisplayDistance();
      break;
      case 'clear-history' :
        e.preventDefault();
        appModel.clearHistory();
      break;
      case 'list-item-a' :
        e.preventDefault();
        clearInput();
        geocoder.geocode({ 'address': e.target.innerHTML}, geocoderCallback);
      break;
      case 'remove-list-item' :
        e.preventDefault();
        var $par = $(e.target).parent();
        var $address = $par.data('address');
        appModel.removeSingleItem($address, $par);
      break;
    }
  });

});