# igc-xc-score

igc-xc-score is a paragliding and hang-gliding XC scoring tool in vanilla JS.

It can be used directly from the command-line, or as a library embedded in a web browser or an application.

Currently only the FFVL scoring rules are implemented, but you can pass your own structure with scoring info.

I plan to also add the XContest rules.

Changing the coefficients is easy, adding new bounding algorithms is not.

## Background

Correctly scoring paragliding XC flights is a rather hard linear optimization problem that remains impossible to correctly solve in a deterministic way for every possible flight.

If you are new to the subject, I suggest you start with the ground-breaking work of Ondřej Palkovský
[Paragliding Competition Tracklog Optimization](http://www.penguin.cz/~ondrap/algorithm.pdf).

The task might seem impossible at first, as the complexity of the general case is O(n⁵) and a competition-level flight log will usually contain up to 40,000 or 50,000 records.
To further complicate matters, all calculations happen in a non-euclidean space which happens to be the Earth's surface.
Luckily, even if an absolutely universal solution remains impossible, there is usually some internal structure of the solution space.

The worst case of this algorithm remains a O(n⁵), but the average complexity is only O(n²log³(n)).
It uses a classical branch and bounding approach with a n³ branching for triangles with a O(n log(n)) cost function and n⁵ branching for 3 turnpoints distance flights with a O(1) cost function. Different scoring types run in parallel until they are bounded.
It has really good performance for triangles, but tends to be a little bit slow for long straight flights.
**There is an alternative approach for distance over 3 turnpoints flights which uses dynamic programming and which could be faster for very long straight line flights**. If there is interest, I could eventually implement it. Or if there is anyone in the paragliding community who wants to learn dynamic programming or JS, he is more than welcome to do so.

Geographical distances are calculated on a WGS84 ellipsoid (oblate spheroid) according to the FAI's recommendations and FFVL's rules, taking into account not only the curvature of Earth, but also its flattening over the poles. In reality, the additionnal error incurred from not applying these corrections would be only about 500m for 500km.

This tools tries to be as precise as possible. There is no resampling, no interpolation and only points lying on the flight track log are used as turn points. As such, its run time could be extreme in some cases. Two modes of execution are provided: optimal solution at all costs and bounded-time execution. When running in bounded-time mode the tool will report if it has found the absolutely best solution or if it had to abandon the search due to reaching of the time limit.

## Installation

If you just want to run it from the command-line, download the executable file for your platform from the releases.

Or, if you already have Node.js, you can download the source distribution.

```bash
```

## Usage

This tool 

With an executable (user)
```bash
igc-xc-score flight.igc out=flight.json maxtime=50
```

You can visualize the resulting GeoJSON files at [geojson.io](http://geojson.io/).

With node (developer)
```bash
node igc-xc-score.min flight.igc out=flight.json quiet=true
node index flight.igc
cat flight.json | jq .properties
```

From another program you should look at index.js and test.js for examples
```JS
const fs = require('fs');
const IGCParser = require('./igc-parser');
const scoring = require('./scoring');
const solver = require('./solver');
const flight = IGCParser.parse(fs.readFileSync('flight.igc'), 'utf8'));
const result = solver(flight, scoring.scoringFFVL, { quiet: true, maxtime: 20 });
if (result.optimal)
    console.log(`score is ${result.score}`)
```

I have included my own copy of igc-parser which is available [here](https://github.com/Turbo87/igc-parser/) which is less zealous over the quality of the IGC files.

## Contributing
Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

Please make sure to update tests as appropriate.

## License
[LGPL](https://choosealicense.com/licenses/lgpl-3.0/)