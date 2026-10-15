import { leafletCSS, leafletJS } from './leaflet-bundle';
import type { MapProps } from './types';

export function leafletHtml({ markers, route, onPick }: MapProps) {
  const initial = JSON.stringify({
    markers,
    route: route || [],
    selectable: !!onPick,
  }).replace(/</g, '\\u003c');
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>${leafletCSS}\nhtml,body,#map{height:100%;margin:0} .leaflet-container{background:#fff7ed;font-family:system-ui} .leaflet-control-attribution{font-size:9px}</style></head><body><div id="map"></div><script>${leafletJS}</script><script>
  var map=L.map('map',{zoomControl:true}).setView([9.03,38.74],13);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);
  var group=L.featureGroup().addTo(map),selected;
  function render(data){group.clearLayers();(data.markers||[]).forEach(function(p){var marker=L.circleMarker([p.latitude,p.longitude],{radius:9,color:'white',weight:3,fillColor:p.color||'#f97316',fillOpacity:1}).addTo(group);if(p.title){var label=document.createElement('span');label.textContent=p.title;marker.bindTooltip(label);}});if(data.route&&data.route.length>1)L.polyline(data.route.map(function(p){return[p.latitude,p.longitude]}),{color:'#f97316',weight:5}).addTo(group);if(group.getLayers().length)map.fitBounds(group.getBounds(),{padding:[35,35],maxZoom:15,animate:false});}
  var data=${initial};render(data);
  window.flashgoUpdate=function(next){data=next;render(data)};
  window.addEventListener('message',function(event){if(event.source===parent&&event.data&&event.data.type==='flashgo-map-update')window.flashgoUpdate(event.data.payload)});
  map.on('click',function(event){if(!data.selectable)return;var point={latitude:event.latlng.lat,longitude:event.latlng.lng};if(selected)map.removeLayer(selected);selected=L.circleMarker(event.latlng,{radius:9,color:'#f97316',fillOpacity:1}).addTo(map);var message=JSON.stringify(point);if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(message);else parent.postMessage({type:'flashgo-map-pick',point:point},'*');});
  setTimeout(function(){map.invalidateSize()},100);
  </script></body></html>`;
}
