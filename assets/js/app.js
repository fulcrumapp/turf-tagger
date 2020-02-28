const map = L.map("map", {
  maxZoom: 22,
  zoomControl: false,
}).fitWorld();
map.attributionControl.setPrefix(null);

const baseLayers = {
  "Streets": L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.@2xpng", {
    maxNativeZoom: 18,
    maxZoom: map.getMaxZoom(),
    attribution: '© <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, © <a href="https://carto.com/attribution">CARTO</a>',
  }).addTo(map)
};

const overlayLayers = {
  "Polygons": L.geoJson(null, {
    pmIgnore: false,
    filter: function (feature) {
      if (feature.geometry.type.includes("Polygon")) {
        return true;
      }
    },
    onEachFeature: function (feature, layer) {
      let table = "<div style='overflow:auto;'><table>";

      for (const key in feature.properties) {
        if (feature.properties.hasOwnProperty(key)) {
          table += "<tr><th>" + key.toUpperCase() + "</th><td>" + feature.properties[key] + "</td></tr>";
        }
      }
      table += "</table></div>";
      layer.bindPopup(table, {
        maxHeight: 300,
        maxWidth: 250
      });
    }
  }).addTo(map),

  "Points": L.geoJson(null, {
    pmIgnore: false,
    filter: function (feature) {
      if (feature.geometry.type.includes("Point")) {
        return true;
      }
    },
    onEachFeature: function (feature, layer) {
      let table = "<div style='overflow:auto;'><table>";

      for (const key in feature.properties) {
        if (feature.properties.hasOwnProperty(key)) {
          table += "<tr><th>" + key.toUpperCase() + "</th><td>" + feature.properties[key] + "</td></tr>";
        }
      }
      table += "</table></div>";
      layer.bindPopup(table, {
        maxHeight: 300,
        maxWidth: 250
      });
    }
  }).addTo(map)
}

const controls = {
  layerCtrl: L.control.layers(baseLayers, overlayLayers, {
    collapsed: false,
    position: "topright"
  }).addTo(map),

  locateCtrl: L.control.locate({
    icon: "fa fa-crosshairs",
    setView: "untilPan",
    cacheLocation: true,
    position: "topleft",
    flyTo: false,
    circleStyle: {
      interactive: false,
      pmIgnore: true
    },
    markerStyle: {
      interactive: false,
      pmIgnore: true
    },
    locateOptions: {
      enableHighAccuracy: true,
      maxZoom: 17
    },
    onLocationError: function(e) {
      alert(e.message);
    }
  }).addTo(map),

  // zoomCtrl: L.control.zoom().addTo(map)
};
controls.locateCtrl.start();

map.pm.addControls({
  drawMarker: false,
  drawCircleMarker: false,
  drawPolyline: false,
  drawRectangle: true,
  drawPolygon: true,
  drawCircle: true,
  editMode: true,
  dragMode: true,
  cutPolygon: false,
  removalMode: true,
  tooltips: true
});

const polygonInput = L.DomUtil.create("input", "hidden");
polygonInput.type = "file";
polygonInput.accept = ".geojson";
polygonInput.style.display = "none";

polygonInput.addEventListener("change", function () {
  let file = polygonInput.files[0];
  let reader = new FileReader();
  reader.onload = function(e) {
    overlayLayers["Polygons"].addData(JSON.parse(reader.result));
    if (overlayLayers["Polygons"].getLayers().length > 0) {
      map.fitBounds(overlayLayers["Polygons"].getBounds());
    } else {
      alert("No polygons found. Please try another file.");
    }
  }
  reader.readAsText(file);

  this.value = "";
}, false);

const pointInput = L.DomUtil.create("input", "hidden");
pointInput.type = "file";
pointInput.accept = ".geojson,.csv";
pointInput.style.display = "none";

pointInput.addEventListener("change", function () {
  let file = pointInput.files[0];
  let reader = new FileReader();
  reader.onload = function(e) {

    if (file.name.endsWith(".csv")) {
      csv2geojson.csv2geojson(reader.result, function(err, data) {
        overlayLayers["Points"].addData(data);
      });
    } else {
      overlayLayers["Points"].addData(JSON.parse(reader.result));
    }

    if (overlayLayers["Points"].getLayers().length > 0) {
      map.fitBounds(overlayLayers["Points"].getBounds());
    } else {
      alert("No points found. Please try another file.");
    }
  }
  reader.readAsText(file);

  this.value = "";
}, false);

map.on("pm:create", e => {
  let geojson = e.layer.toGeoJSON();
  if (e.layer instanceof L.Circle) {
    geojson = L.polygon(e.layer.toPolygon()).toGeoJSON();
  }
  const name = prompt("Please enter a feature name");
  if (name) {
    geojson.properties.name = name;
  }
  map.removeLayer(e.layer);
  overlayLayers["Polygons"].addData(geojson);
});

map.on("pm:remove", e => {
  if (window.confirm("Do you really want to remove this feature?")) { 
    overlayLayers["Polygons"].removeLayer(e.layer);
    
  } else {
    map.addLayer(e.layer);
  }
});

function tagPoints() {
  if (overlayLayers["Points"].getLayers().length > 0 && overlayLayers["Polygons"].getLayers().length > 0) {
    const properties = overlayLayers["Polygons"].toGeoJSON().features[0].properties;
    const keys = Object.keys(properties);

    let tagged;
    keys.forEach(key => {
      if (!tagged) {
        tagged = turf.tag(overlayLayers["Points"].toGeoJSON(), overlayLayers["Polygons"].toGeoJSON(), key, key);
      } else {
        tagged = turf.tag(tagged, overlayLayers["Polygons"].toGeoJSON(), key, key);
      }
    });

    overlayLayers["Points"].clearLayers().addData(tagged);
    alert("Polygon properties successfully joined with corresponding points!");
  } else {
    alert("Please load some polygons and points first!");
  }
}

function downloadFile(format) {
  if (overlayLayers["Points"].getLayers().length > 0) {
    const geojson = overlayLayers["Points"].toGeoJSON();
    let file;
    if (format == "geojson") {
      file = new File([JSON.stringify(geojson)], "tagged-points.geojson", {type: "text/json;charset=utf-8"});
    } else if (format == "csv") {
      file = new File([geojson2dsv(geojson)], "tagged-points.csv", {type: "text/csv;charset=utf-8"});
    }
    saveAs(file);
  } else {
    alert("No data to download!");
  }
}

function clearFeatures() {
  if (confirm("Do you really want to clear all the map features?")) { 
    overlayLayers["Polygons"].clearLayers();
    overlayLayers["Points"].clearLayers();
  }
}