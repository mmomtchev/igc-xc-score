/*eslint-env jquery*/
import { Map, View } from 'ol';
import { transformExtent } from 'ol/proj';
import GeoJSON from 'ol/format/GeoJSON';
import { Tile as TileLayer, Vector as VectorLayer } from 'ol/layer';
import XYZ from 'ol/source/XYZ';
import VectorSource from 'ol/source/Vector';
import { defaults as defaultControls, ScaleLine } from 'ol/control';
import { Circle as CircleStyle, Stroke, Style } from 'ol/style';
import { easeOut } from 'ol/easing';
import 'bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'ol/ol.css';
import './igc-xc-score.css';

const igcSolver = require('../solver');
const igcParser = require('../igc-parser');
const igcScoring = require('../scoring-rules.config');

const flightStyle = {
    'flight': new Style({
        stroke: new Stroke({
            color: 'blue',
            width: 3
        })
    }),
    'tp[0-9]': new Style({
        image: new CircleStyle({
            radius: 8,
            fill: null,
            stroke: new Stroke({ color: 'indigo', width: 6 })
        })
    }),
    'cp_[in|out]': new Style({
        image: new CircleStyle({
            radius: 8,
            fill: null,
            stroke: new Stroke({ color: 'mediumvioletred', width: 4 })
        })
    }),
    'launch': new Style({
        image: new CircleStyle({
            radius: 8,
            fill: null,
            stroke: new Stroke({ color: 'coral', width: 4 })
        })
    }),
    'land': new Style({
        image: new CircleStyle({
            radius: 8,
            fill: null,
            stroke: new Stroke({ color: 'black', width: 4 })
        })
    }),
    'seg[0-9|_in|_out]': new Style({
        stroke: new Stroke({
            color: 'indigo',
            width: 6
        })
    }),
    'closing': new Style({
        stroke: new Stroke({
            color: 'mediumvioletred',
            width: 4
        })
    })
};

function styleGet(feature) {
    for (let s of Object.keys(flightStyle))
        if (feature.getId().match(s))
            return flightStyle[s];
}

let flightDataSource;
let geoJSONReader;
function display(geojson) {
    flightDataSource.clear();
    flightDataSource.addFeatures(geoJSONReader.readFeatures(geojson, { featureProjection: 'EPSG:3857' }));
}

function loop() {
    const s = this.next();
    if (!s.done) {
        $('#spinner').show();
        display(s.value.geojson());
        window.requestIdleCallback(loop.bind(this));
        $('#status').html(`trying solutions, best so far is ${s.value.score} points`
            + `<p>theoretical best could be up to ${parseFloat(s.value.currentUpperBound).toFixed(2)} points`);
    } else {
        $('#spinner').hide();
        display(s.value.geojson());
        let r = [`<td class="label">Best possible</td><td class="data">${s.value.score} points</td>`,
            `<td class="label">${s.value.opt.scoring.name}</td>`
            + `<td class="data">${s.value.scoreInfo.distance}km</td>`,
        ];
        if (s.value.opt.scoring.closingDistance)
            r.push(`<td class="label">closing distance</td><td class="data">${s.value.scoreInfo.cp.d}km</td>`);
        let d = [];
        if (!s.value.opt.scoring.closingDistance)
            d.push(['in:0', s.value.scoreInfo.cp['in'], s.value.scoreInfo.tp[0]]);
        for (let i of [0, 1, 2])
            if (i != 2 || s.value.opt.scoring.closingDistance)
                d.push([i + ':' + ((i + 1) % 3), s.value.scoreInfo.tp[i], s.value.scoreInfo.tp[(i + 1) % 3]]);
        if (!s.value.opt.scoring.closingDistance)
            d.push(['2:out', s.value.scoreInfo.tp[2], s.value.scoreInfo.cp['out']]);

        for (let i of d)
            r.push(`<td class="label">d${i[0]}</td><td class="data">${i[1].distanceEarth(i[2]).toFixed(3)}km</td>`);
        $('#status').html('<table class="table"><tr>' + r.join('</tr><tr>'));
    }
}

let map;
$(document).ready(() => {
    $('#spinner').hide();
    geoJSONReader = new GeoJSON();
    flightDataSource = new VectorSource();
    map = new Map({
        target: 'map',
        layers: [
            new TileLayer({
                source: new XYZ({
                    url: 'https://{a-c}.tile.opentopomap.org/{z}/{x}/{y}.png',
                    maxZoom: 17
                }),
            }),
            new VectorLayer({
                source: flightDataSource,
                style: styleGet
            })
        ],
        view: new View({
            center: [0, 0],
            zoom: 2,
            maxZoom: 18
        }),
        controls: defaultControls().extend([
            new ScaleLine({
                units: 'metric',
                bar: true,
                steps: 5,
                text: false,
                minWidth: 140
            })
        ])
    });
});

if (!window.requestIdleCallback)
    window.requestIdleCallback = (a) => {
        setTimeout(a, 50);
    };

$('.ctrl-scoringRules').on('click', (event) => {
    $('#igc-scoringRules').html($(event.target).html());
});

$('#igc-upload').on('change', () => {
    const input = event.target;
    const reader = new FileReader();
    reader.onload = function () {
        try {
            flightDataSource.clear();
            $('#spinner').show();
            const igcData = reader.result;
            $('#status').html(`igc loaded, ${igcData.length} bytes read`);
            const igcFlight = igcParser.parse(igcData, 'utf8');
            $('#status').html(`igc parsed, ${igcFlight.fixes.length} GPS records found`);
            let minlat, maxlat, minlon, maxlon;
            [minlat, maxlat, minlon, maxlon] = [Infinity, -Infinity, Infinity, -Infinity];
            for (let r of igcFlight.fixes) {
                minlat = Math.min(r.latitude, minlat);
                maxlat = Math.max(r.latitude, maxlat);
                minlon = Math.min(r.longitude, minlon);
                maxlon = Math.max(r.longitude, maxlon);
            }
            map.getView().fit(transformExtent([minlon, minlat, maxlon, maxlat], 'EPSG:4326', 'EPSG:3857'), {
                padding: [20, 20, 50, 20],
                duration: 1,
                easing: easeOut
            });

            window.requestIdleCallback(() => {
                console.log($('#igc-scoringRules').html(), igcScoring);
                console.log(igcScoring[$('#igc-scoringRules').html()]);
                const it = igcSolver(igcFlight, igcScoring[$('#igc-scoringRules').html()], { maxcycle: 100 });
                loop.call(it);
            });
        } catch (e) {
            $('#status').html(e);
            $('#spinner').hide();
        }
    };
    reader.readAsBinaryString(input.files[0]);
});