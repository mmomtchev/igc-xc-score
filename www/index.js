/*eslint-env jquery*/
import { Map, View } from 'ol';
import { transformExtent } from 'ol/proj.js';
import GeoJSON from 'ol/format/GeoJSON.js';
import { Tile as TileLayer, Vector as VectorLayer } from 'ol/layer.js';
import { XYZ, Vector as VectorSource, OSM } from 'ol/source.js';
import { defaults as defaultControls, ScaleLine } from 'ol/control.js';
import { Circle as CircleStyle, Stroke, Style } from 'ol/style.js';
import { easeOut } from 'ol/easing.js';
import LayerSwitcher from 'ol-layerswitcher';

import 'bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'ol/ol.css';
import 'ol-layerswitcher/dist/ol-layerswitcher.css';
import './igc-xc-score.css';

import { solver as igcSolver, scoringRules as igcScoring } from 'igc-xc-score';
import { default as igcParser } from 'igc-parser';

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
    'ep_[start|finish]': new Style({
        image: new CircleStyle({
            radius: 8,
            fill: null,
            stroke: new Stroke({ color: 'darkslateblue', width: 6 })
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
    }),
    'box[0-9]': new Style({
        stroke: new Stroke({
            color: 'black',
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
        // eslint-disable-next-line no-undef
        display(s.value.geojson({ debug: __DEBUG__ }));
        runningProcess = window.requestIdleCallback(loop.bind(this));
        $('#status').html(`trying solutions, best so far is ${s.value.score} points`
            + `<p>theoretical best could be up to ${parseFloat(s.value.currentUpperBound).toFixed(2)} points`);
    } else {
        runningProcess = undefined;
        $('#spinner').hide();
        display(s.value.geojson());
        let r = [
            `<td class="label">Best possible</td><td class="data">${s.value.score} points</td>`,
            `<td class="label">${s.value.opt.scoring.name}</td>`
            + `<td class="data">${s.value.scoreInfo.distance}km</td>`
        ];
        if (s.value.scoreInfo.cp)
            r.push(`<td class="label">closing distance</td><td class="data">${s.value.scoreInfo.cp.d}km</td>`);
        let d = [];
        if (s.value.scoreInfo.ep)
            d.push(['in:0', s.value.scoreInfo.ep['start'], s.value.scoreInfo.tp[0]]);
        for (const i in s.value.scoreInfo.tp)
            if (!s.value.scoreInfo.ep) {
                d.push([
                    i + ':' + ((i + 1) % s.value.scoreInfo.tp.length),
                    s.value.scoreInfo.tp[i],
                    s.value.scoreInfo.tp[(i + 1) % s.value.scoreInfo.tp.length]
                ]);
            }
        if (s.value.scoreInfo.ep)
            d.push(['2:out', s.value.scoreInfo.tp[2], s.value.scoreInfo.ep['finish']]);

        for (let i of d)
            r.push(`<td class="label">d ${i[0]}</td><td class="data">${i[1].distanceEarth(i[2]).toFixed(3)}km</td>`);
        $('#status').html('<table class="table"><tr>' + r.join('</tr><tr>'));
    }
}

let map;
$(() => {
    $('#spinner').hide();
    geoJSONReader = new GeoJSON();
    flightDataSource = new VectorSource();
    map = new Map({
        target: 'map',
        layers: [
            new TileLayer({
                title: 'OpenTopoMap',
                visible: false,
                type: 'base',
                source: new XYZ({
                    url: 'https://{a-c}.tile.opentopomap.org/{z}/{x}/{y}.png',
                    attributions: 'Kartendaten: © <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende, SRTM | Kartendarstellung: © <a href="http://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
                    maxZoom: 17
                }),
            }),
            new TileLayer({
                title: 'OpenStreetMap',
                type: 'base',
                source: new OSM()
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
            }),
            new LayerSwitcher({
                tipLabel: 'Map',
                groupSelectStyle: 'children'
            })
        ])
    });
});

if (!window.requestIdleCallback) {
    window.requestIdleCallback = (a) => {
        return setTimeout(a, 50);
    };
    window.cancelIdleCallback = (a) => {
        clearTimeout(a);
    };
}

let runningProcess;
function runProcessing() {
    if (!igcFlight)
        return;

    if (runningProcess) {
        window.cancelIdleCallback(runningProcess);
        runningProcess = undefined;
    }

    const hp = $('#igc-hp').prop('checked');
    const trim = $('#igc-trim').prop('checked');
    window.requestIdleCallback(() => {
        const it = igcSolver(igcFlight, igcScoring[$('#igc-scoringRules').html()], {
            maxcycle: 100,
            hp: hp,
            trim
        }, { timeout: 2000 });
        loop.call(it);
    });
}

// eslint-disable-next-line no-undef
$('#igc-xc-score-version').html(`${__BUILD_PKG__.name} ${__BUILD_PKG__.version} ${__BUILD_GIT__} ${__BUILD_DATE__} ${__DEBUG__ ? 'debug' : ''}`);

Object.keys(igcScoring).map(scoring => {
    $('#igc-scoringRulesList').append(`<button class="dropdown-item ctrl-scoringRules" id="${scoring}">${scoring}</button>`);
});
$('#igc-scoringRules').html(Object.keys(igcScoring)[0]);
$('.ctrl-scoringRules').on('click', (event) => {
    $('#igc-scoringRules').html($(event.target).html());
    runProcessing();
});
$('.ctrl-process').on('click', runProcessing);

let igcFlight;

$('#igc-upload').on('change', () => {
    const input = event.target;
    const reader = new FileReader();
    reader.onload = function () {
        try {
            flightDataSource.clear();
            $('#spinner').show();
            const igcData = reader.result;
            $('#status').html(`igc loaded, ${igcData.length} bytes read`);
            igcFlight = igcParser.parse(igcData, { lenient: true });
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
            runProcessing();
        } catch (e) {
            $('#status').html(encodeURIComponent(e.toString()));
            $('#spinner').hide();
            igcFlight = undefined;
        }
    };

    if (input.files[0])
        reader.readAsBinaryString(input.files[0]);
});