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
It has really good performance for triangles, but tends to be a little bit slow for long straight flights. If there is interest, I could eventually implement it. Or if there is anyone in the paragliding community who wants to learn dynamic programming or JS, he is more than welcome to do so.

Geographical distances are calculated on a WGS84 ellipsoid (oblate spheroid) according to the FAI's recommendations and FFVL's rules, taking into account not only the curvature of Earth, but also its flattening over the poles. In reality, the additionnal error incurred from not applying these corrections would be only about 500m for 500km.

This tools tries to be as precise as possible. There is no resampling, no interpolation and only points lying on the flight track log are used as turn points. As such, its run time could be extreme in some cases. Two modes of execution are provided: optimal solution at all costs and bounded-time execution. When running in bounded-time mode the tool will report if it has found the absolutely best solution or if it had to abandon the search due to reaching of the time limit.

### Algorithm

The algorithm used has a few key differences to the one described by Ondřej Palkovský in his excellent 2010 paper. The most notable one is that the cardinality of the branching is only 3. The branching is over the 3 turnpoints **expressed in linear coordinates over the flight log records**, thus giving O(n³) basic branching complexity.

The two remaining points - the closing points of the triangle for triangle flights and the start/finish points for the free distance flights, are determined as part of the cost function.

The rationale behind this decision is that both of these problems are well-known and well-studied simple geometric problems.

* Finding the triangle closing points is a classical nearest-neighbor search which can be solved in *O(n log(n))* by a number of different approaches, this tool uses a [packed Hilbert R-tree](https://en.wikipedia.org/wiki/Hilbert_R-tree#Packed_Hilbert_R-trees) provided by [mourner/flatbush](https://github.com/mourner/flatbush), locally compensated for the curvature of Earth. Keep in mind that this distance does not need to be 100% precise, as it is used only for selecting the closest point, the scoring effect of the closing distance is measured by the method described in the following section
* Finding the best start/finish points is a simple minimum/maximum search which is a *O(n)* problem
* Both can be further optimized by keeping the intermediate results in an R-Tree or a Hashmap, shared among all the branches

The only weak point of the current implementation are flights consisting of perfectly straight lines. These are in fact impossible to optimize, generating a very large number of identical solutions that can not be eliminated.

The branch selection is slightly depth-first biased.

### Distance between two points on the surface of a WGS84 ellipsoid

The FAI recommended method for computing distance is distance over a WGS84 ellipsoid. Finding the distance between two points on a WGS84 ellipsoid is not a trivial problem. The currently de-facto standard method for doing it is called [Vincenty's algorithm](https://en.wikipedia.org/wiki/Vincenty%27s_formulae) and it is an iterative solution which makes its use absolutely prohibitive in this tool. I have settled over a simplified direct formula obtained by a Taylor series expansion of the equations. That method, which requires 5 cosinus and 1 square root computation, can be found in FCC's recommendations for computing distances not exceeding 500km. *Keep in mind that this distance is the distance of one leg, not the whole flight*. That formula has an error of less than 10m for 100km which should be acceptable for paragliding and hang-gliding flights. The method is described here: [Code of Federal Regulations (Annual Edition). Title 47: Telecommunication.](https://www.govinfo.gov/content/pkg/CFR-2016-title47-vol4/pdf/CFR-2016-title47-vol4-sec73-208.pdf) and on also on [Wikipedia](https://en.wikipedia.org/wiki/Geographical_distance). This is the very same formula that was famously mistaken in an [earlier edition](https://www.tvtechnology.com/news/fcc-invents-negative-distance) of the document.

## Installation

If you just want to run it from the command-line, download the executable file for your platform from the [releases section](https://github.com/mmomtchev/igc-xc-score/releases).

Or, if you already have Node.js, you can download the source distribution.

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
```

Using with node (**developer**)
```bash
node igc-xc-score.min flight.igc out=flight.json quiet=true
node index flight.igc
cat flight.json | jq .properties
```

### The solver library

Calling the solver from another Node.js program is easy, you should look at *index.js* and *test.js* for examples
```JS
const fs = require('fs');
const IGCParser = require('./igc-parser');
const scoring = require('./scoring-rules.config');
const solver = require('./solver');
const flight = IGCParser.parse(fs.readFileSync(path.join('test', test.file), 'utf8'));
const result = solver(flight, scoring.FFVL, { quiet: true }).next().value;
if (result.optimal)
    console.log(`score is ${result.score}`)
```
*solver* is a generator function that can be called multiple times with a maximum execution time. Each successive call will return a better solution if such a solution has been found until an optimal solution is reached.
*Be advised that in JS, a for..of loop will ignore the final return value of a generator. Do not use a for..of loop. Look at index.js for a proper solution.*

It supports resetting or it will automatically reset itself if an optimal solution has been found.

*solver* accepts the following options in its third argument:
```JS
const opt = {
    maxcycle: undefined          // max execution time per cycle in milliseconds
    noflight: false              // do not include the flight track in the geojson output
}
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