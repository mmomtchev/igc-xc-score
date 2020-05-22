# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.99.0] 2020-05-22

### Added
 - Experimental multithreading support on Node.js. Overly complex code and slower for all but the most complex flights and the most high-end CPUs


## [1.3.0] 2020-05-07

### Added
 - Vastly improved launch and landing detection supporting flight logs with multiple launches, landings and hiking segments


## [1.2.0] 2020-05-05

### Added
 - Support for High Precision mode computing distances by Vincenty's method bringing the error down to 60cm from about 5m (up to 25m on flights with very long legs) with the default method (FCC)
 - Support for auto-trimming flights to their launch and landing point
 - Better integration in 3rd party apps - pipe mode, progress indicator

### Changed
 - Numerous small optimizations to the CPU/memory usage


## [1.1.3] 2020-04-27

### Changed
 - Fix a problem with choosing the right triangle closing points for triangles with relative closing distance (FFVL 5% rule and XContest) -solved by adding simple 'local' Mercator projection to the Hilbert packed R-Tree - more than acceptable for triangle closing distances of up to 200km (https://github.com/mourner/geoflatbush allows for perfect precision for larger distances, but is, alas, too slow to be usable)
 - Exit gracefully when out of memory condition is detected, can happen on perfectly straight line flights
 - Some small optimizations


## [1.1.2] 2020-04-26

### Changed
 - Fix two overbounding issues on flights with multiple round-trips between the turnpoints


## [1.1.1] 2020-04-25

### Changed
 - Much faster processing of 3 turnpoints distance flights (4x speedup)


## [1.1.0] 2020-04-25

### Added
 - Support XContest rules
 
### Changed
 - Moved all the user-serviceable configuration to a separate file


## [1.0.1] 2020-04-22

### Changed
 - Faster processing of 3 turnpoints distance flights


## [1.0.0] 2020-04-22

### Added
- First release