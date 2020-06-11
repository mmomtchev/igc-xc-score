# igc-xc-score

igc-xc-score is a paragliding and hang-gliding XC scoring tool in vanilla JS.

It can be used directly from the command-line, or as a library embedded in a web browser or an application.

Currently only the FFVL and XContest scoring rules are implemented, but you can pass your own structure with scoring info.

Changing the multipliers or the closing distances is easy, adding new bounding algorithms is not.

See *scoring-rules.config.js* if you want to modify the rules.

**You have an IGC file for which you think that there is a higher scoring solution using only track-log points? Send it along with your turnpoints and I will investigate.**

## Background

Correctly scoring paragliding XC flights is a rather hard linear optimization problem that remains impossible to correctly solve in a deterministic way for every possible flight.

If you are new to the subject, I suggest you start with the ground-breaking work of Ondřej Palkovský
[Paragliding Competition Tracklog Optimization](http://www.penguin.cz/~ondrap/algorithm.pdf).

The task might seem impossible at first, as the complexity of the general case is *O(n⁵)* and a competition-level flight log will usually contain up to 40,000 or 50,000 records.
To further complicate matters, all calculations happen in a non-euclidean space which happens to be the Earth's surface.
Luckily, even if an absolutely universal solution remains impossible, there is usually some internal structure of the solution space.

The worst case of this algorithm remains a *O(n⁴log(n))*, but the average complexity is only *O(n²log³(n))*.
It uses a classical branch and bounding approach with a n³ branching for triangles with a *O(n log(n))* cost function and *n³* branching for 3 turnpoints distance flights with a *O(n)* cost function. Different scoring types run in parallel until they are bounded.
It has really good performance for triangles, but tends to be a little bit slow for long straight flights.

Geographical distances are calculated on a WGS84 ellipsoid (oblate spheroid) according to the FAI's recommendations and FFVL's rules, taking into account not only the curvature of Earth, but also its flattening over the poles. In reality, the additionnal error incurred from not applying these corrections would be only about 500m for 500km.

This tools tries to be as precise as possible. There is no resampling, no interpolation and only points lying on the flight track log are used as turn points. As such, its run time could be extreme in some cases. Two modes of execution are provided: optimal solution at all costs and bounded-time execution. When running in bounded-time mode the tool will report if it has found the absolutely best solution or if it had to abandon the search due to reaching of the time limit.

***Correctness is considered to be achieved if the additional error induced by the tool itself is inferior to the standard GPS accuracy.***

### Algorithm

The algorithm used has a few key differences to the one described by Ondřej Palkovský in his excellent 2010 paper. The most notable one is that the cardinality of the branching is only 3. The branching is over the 3 turnpoints **expressed in linear coordinates over the flight log records**, thus giving O(n³) basic branching complexity.

The two remaining points - the closing points of the triangle for triangle flights and the start/finish points for the free distance flights, are determined as part of the cost function.

The rationale behind this decision is that both of these problems are well-known and well-studied simple geometric problems.

* Finding the triangle closing points is a classical nearest-neighbor search which can be solved in *O(n log(n))* by a number of different approaches, this tool uses a [packed Hilbert R-tree](https://en.wikipedia.org/wiki/Hilbert_R-tree#Packed_Hilbert_R-trees) provided by [mourner/flatbush](https://github.com/mourner/flatbush), locally compensated for the curvature of Earth. Keep in mind that this distance does not need to be 100% precise, as it is used only for selecting the closest point, the scoring effect of the closing distance is measured by the method described in the following section
* Finding the best start/finish points is a simple minimum/maximum search which is a *O(n)* problem
* Both can be further optimized by keeping the intermediate results in an R-Tree or a Hashmap, shared among all the branches

The only weakness of the current implementation are flights consisting of (nearly) perfectly straight lines. These are in fact impossible to optimize, producing a very large number of (nearly) identical solutions that can not be eliminated and therefore must be calculated in order to guarantee that the obtained result is indeed optimal. For those particular cases there is another possible approach with dynamic programming which has a bounded execution time, on the order of a few minutes for the longest flights. This approach is currently not used since it has a rather detrimental impact on the average execution time and has no real benefits aside some very rare, almost perfectly straight line flights.

The branch selection is breadth-first biased when branching and depth-first biased when bounding.

### Distance between two points on the surface of a WGS84 ellipsoid

The FAI recommended method for computing distance is distance on the surface of a WGS84 ellipsoid. Finding the distance between two points on a WGS84 ellipsoid is not a trivial problem. The ellipsoid surface equations do not have a [closed-form expression](https://en.wikipedia.org/wiki/Elliptic_integral) and the distance can not be directly calculated. The currently de-facto standard method for computing it is called [Vincenty's algorithm](https://en.wikipedia.org/wiki/Vincenty%27s_formulae) and it is an iterative solution which makes it computationally very expensive. It is available through the **hp=true** option, giving twice slower execution speed for a much higher precision - which is currently hard-coded at 60cm over the WGS84 reference ellipsoid. If the **hp=true** option is not used, I have settled over a simplified direct formula obtained by Taylor series expansion of the ellipsoid surface equations. This method, which requires 5 cosinus and 1 square root computation, can be found in FCC's recommendations for computing distances not exceeding 500km. *Keep in mind that this distance is the distance of one leg, and not the whole flight*. It has a typical error of 5m and a maximum error of 10m for 100km which should be acceptable for most paragliding and hang-gliding flights. On flights with exceptionnally long legs (such as the French national distance record), the error can be as high as 25m, which is more than the standard GPS error. The method is described here: [Code of Federal Regulations (Annual Edition). Title 47: Telecommunication.](https://www.govinfo.gov/content/pkg/CFR-2016-title47-vol4/pdf/CFR-2016-title47-vol4-sec73-208.pdf) and on also on [Wikipedia](https://en.wikipedia.org/wiki/Geographical_distance). This is the very same formula that was famously mistaken in an [earlier edition](https://www.tvtechnology.com/news/fcc-invents-negative-distance) of the document.

As a side note, while the GPS naviation system coordinates are relative to WGS84, which remains the current widely approved standard, the internal model used has been upgraded to the more recent EGM96, which is a higher-order model (a geoid). The typical error of WGS84 when compared to EGM96 is less than 1m (on the horizontal) which is less than the typical GPS receiver error. Thus WGS84, which is mathematically much simpler to use, will probably stay in use for most practical applications.

##### *En France*

*En France [l'ellipsoïde de référence](https://geodesie.ign.fr/contenu/fichiers/documentation/SRCfrance.pdf) normalisé par l'IGN est le GRS80 pour la métropole et le WGS84 pour les DOM-TOM. Le géoïde utilisé est celui du RGF93. Les deux ellipsoïdes sont absolument équivalents, à moins d'un millimètre près, et l'utilisation des coordonnées WGS84 est admise par l'IGN sans [aucune transformation supplémentaire](https://geodesie.ign.fr/contenu/fichiers/documentation/pedagogiques/TransformationsCoordonneesGeodesiques.pdf).*

### Launch and landing detection

The tool includes a launch and landing detection based upon a moving average of the vertical and the horizontal (ground) speed. It should correctly segment flight logs containing multiple launches and landings and will score the best flight. It can not distinguish a glider that is completely immobile up in the air for a set period of time (ie, gliding into a wind equal to its airspeed while soaring at its sink rate) from a glider that has landed, but outside of this somewhat rare (and very precarious) situation, or maybe a car climbing a twisty mountain road, it should work well in most typical hike and fly cases. The values, including the number of seconds used for the moving average, can be tweaked in *flight.js*.

## Installation

If you just want to run it from the command-line, download the executable file for your platform from the [releases section](https://github.com/mmomtchev/igc-xc-score/releases).

Or, if you already have Node.js, you can download the source distribution with npm:
```bash
npm install igc-xc-score
```

You can try a demo here: [https://www.meteo.guru/xc-score/](https://www.meteo.guru/xc-score/).

The sources used for this demo are in the www directory.

## Usage

### The prepackaged command-line tool

Using with an executable (**user**)
```bash
igc-xc-score flight.igc out=flight.json maxtime=50 scoring=FFVL
igc-xc-score flight.igc out=flight.json maxtime=50 scoring=XContest
```

You can visualize the resulting GeoJSON files at [geojson.io](http://geojson.io/).

It will contain all the details of the optimal solution - score, distances, turnpoints. See the section below on program output for additional details.

Valid options are:
```bash
out=<geojson>           # save the optimal solution in <geojson>
maxtime=<seconds>       # do not run for more than <seconds>, producing eventually a sub-optimal result
quiet=false             # do not output any unncessary information
pipe=false              # run in pipe mode, reading flight data from stdin and writing optimal solutions to stdout, works best with quiet, use stdin for filename
progress=<milliseconds> # report the current solution every <milliseconds>, works best in pipe mode
noflight=false          # do not include the flight track in the geojson output
invalid=false           # include invalid GPS fixes
hp=false                # High Precision mode, use Vincenty's instead of FCC distances, twice slower for a little bit better precision
trim=false              # auto-trim the flight log to its launch and landing points
```

Using with node (**developer**)
```bash
node igc-xc-score.min flight.igc out=flight.json quiet=true
node index flight.igc
cat flight.json | jq .properties
```

### The solver library

Calling the solver from another Node.js program is easy, you should look at *index.js* and *test.js* for examples
CJS
```JS
const fs = require('fs');
const IGCParser = require('./igc-parser');
const { scoring, solver } = require('igc-xc-score');
const flight = IGCParser.parse(fs.readFileSync(path.join('test', test.file), 'utf8'));
const result = solver(flight, scoring.FFVL).next().value;
if (result.optimal)
    console.log(`score is ${result.score}`)
```

ESM
```JS
import IGCParser from 'igc-parser';
import { solver, scoringRules as scoring } from 'igc-xc-score';
const flight = IGCParser.parse(igcFile, 'utf8'));
const result = solver(flight, scoring.FFVL).next().value;
if (result.optimal)
    console.log(`score is ${result.score}`)
```

*solver* is a generator function that can be called multiple times with a maximum execution time. Each successive call will return a better solution if such a solution has been found until an optimal solution is reached.
*Be advised that in JS, a for..of loop will ignore the final return value of a generator. Do not use a for..of loop. Look at index.js for a proper solution.*

It supports resetting or it will automatically reset itself if an optimal solution has been found.

*solver* accepts the following options in its third argument:
```JS
const default_opt = {
    maxcycle: undefined          // max execution time per cycle in milliseconds
    noflight: false              // do not include the flight track in the geojson output
    invalid: false               // do not filter invalid GPS fixes
    hp: false                    // High Precision mode, use Vincenty's instead of FCC distances, twice slower for a little bit better precision
    trim: false                  // auto-trim the flight to its launch and landing points
};
```

When calling from the browser, in order to avoid blocking the main event loop, you should use *requestIdleCallback* when it is available. When it is not, *setTimeout* could be a good substitute. It is best to fire the optimizer in small bursts of 50ms to 200ms each in order to keep the browser responsive. The human perception of simultaneity is limited to about 100ms, so this is a good starting point.
```JS
const igcSolver = require('igc-xc-score/solver');
const igcParser = require('igc-xc-score/igc-parser');
const igcScoring = require('igc-xc-score/scoring-rules.config');
function loop() {
    const s = this.next();
    if (!s.done) {
        $('#spinner').show();
        window.requestIdleCallback(loop.bind(this));
        $('#status').html(`trying solutions, best so far is ${s.value.score} points`);
    } else {
        $('#spinner').hide();
        $('#status').html(`Best possible ${s.value.score} points`);
    }
}

window.requestIdleCallback(() => {
    const it = igcSolver(igcFlight, igcScoring.FFVL, { maxcycle: 100 });
    loop.call(it);
})
```

### Integrating with a non-JS desktop application

Probably the easiest way to embed the solver in a non-JS desktop application is to use the provided executable in pipe (stdin/stdout) mode. It expects an IGC file as its and input and it will output the possible solutions in GeoJSON format. See the section below on flight instruments if the file size is a problem.

### igc-parser

I have included my own copy of igc-parser which is available [here](https://github.com/Turbo87/igc-parser/) which is less zealous over the quality of the IGC files.

### Using this module in memory/CPU-constrained embedded environments (ie flight instruments)

Depending on the exact nature of your device, you might be able to use the full version. Android-based devices should be more than capable of running the original JS code.

#### If the problem is the executable file size

Using the JS code in an older embedded engine (Rhino and Chakra for example) will lead to abysmal performance. However a very simple solution is to use Babel 6 to transpile to ES2015 and to embed Node4:
```bash
npm i nexe babel-cli babel-plugin-transform-runtime babel-polyfill babel-preset-env babel-preset-es2015 babel-preset-stage-0
echo '{"presets":["es2015","stage-0"],"plugins":[["transform-runtime",{"regenerator":true}]]}' > .babelrc
babel igc-xc-score.min.js --minified -o igc-xc-score.es2015.min.js
cat igc-xc-score.es2015.min.js | nexe -o igc-xc-score-node4-linux -t linux-x64-4.9.1
cat igc-xc-score.es2015.min.js | nexe -o igc-xc-score-node4-macos -t mac-x64-4.9.1
cat igc-xc-score.es2015.min.js | nexe -o igc-xc-score-node4-win.exe -t windows-x64-4.8.4
```
This will lower the executable size down to about 10Mb on Windows and 15Mb on Linux with almost no loss of performance at all. Further reduction is possible if you build yourself a Node 0.14 package.

#### If CPU/memory is the problem

I have lots of experience working on ARM and MIPS platforms, so you can contact me for porting the library to your specific device, but this definitely won't be free or open-source software. Debugging a very complex mathematical algorithm in C++ on a small electronic board with an integrated hardware debugger is not a leisure project.

## Program Output

The GeoJSON returned by the solver contains what should be the highest scoring solution. It contains the turnpoints (tp0, tp1...) elements,
the closing points of the triangle for triangle flights (cp.in and cp.out), the distances lines (yellow/green) and the flight path itself.
Every tp/cp element also contains an **r** and a **timestamp** field. These are the number and the timestamp of the corresponding GPS fix and can be used to easily verify the correctness of the output of the program.

```json
"type": "Feature",
"id": "tp0",
"properties": {
    "id": "tp0",
    "r": 3799,
    "timestamp": 1546866868000
},
"geometry": {
    "type": "Point",
    "coordinates": [
        6.641583333333333,
        43.73506666666667
    ]
}
```

## Contributing and adding new scoring rules

*scoring-rules.config.js* is designed to be user-serviceable.

Adding new types of flights requires some basic working knowledge of linear optimization and at least some understanding of the branch and bound algorithm. 

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

Please make sure to update tests as appropriate.

## License
[LGPL](https://choosealicense.com/licenses/lgpl-3.0/)