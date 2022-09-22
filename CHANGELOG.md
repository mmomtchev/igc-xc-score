# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

# [1.7.0] WIP
 - Add a two new types of flight, out-and-return distance with 1 and with 2 TPs
 - Add `maxSide` option for triangles
 - Add `minDistance` option for all flights
 - Add the FAI rules
 - Add the XCLeague rules
 - Adopt new rounding rules
 - Add `legs` with the scoring distance of each leg to the result
 - Add `penalty` with the penalty to the result
 - Start numbering the turnpoints at 1 for the user-facing result
 - Add `finalRounding` for leagues that round the final result to less decimal points than the legs
 - Significantly reduce the size of the production build of the web demo
 - Do not depend on the order of the CLI arguments

## [1.6.1] 2022-05-12

### Changed
 - Fix the bundled binaries
 - Update all the dependencies
 - Use OpenStreetMap as a default map in the web demo and add a layer switcher

# [1.6.0] 2021-03-26

### Changed
 - A very significant trigonometry optimization contributed by [@vicb](https://github.com/vicb) reducing processing time in fast mode by 1/3
 - Switch to ES6
 - Fix a possible wrong result bug (no known real-world examples at the moment?)

### Removed
 - Remove the deprecated internal copy of igc-parser
## [1.5.3] 2021-03-09

### Changed
 - Do not crash on triangle with the very last fix

## [1.5.2] 2021-01-14

### Changed
 - Removed the spatial R-Bush 3D cache because of buggy behavior
 - Fixed the garbled ANSI-sequence output on exception in the CJS module

## [1.5.1] 2020-09-28

### Added
 - Unit testing of all distances reported
 - Restore the seg_in / seg_out lines in the geojson output

### Removed
 - The included modified copy of igc-parser has been marked as obsolete, replaced by the official lenient=true option; using it still works but it will be removed in the next minor release (from [@vicb](https://github.com/vicb))

### Changed
 - Significantly faster processing of triangles

# [1.5.0] 2020-07-10

### Added
 - Added a new hybrid type of flight - Open Triangle - that is scored as a 3 TP distance flight but has a triangle closing rule (no such rules at the moment)
 - Added support for 3 TP distance flights with a multiplier different than 1 (no such rules at the moment)
 - Exported the binaries to allow using through npm -g
 - Display individual leg lengths in the command line version

### Changed
 - Apply the closing penalty before applying the multiplier as per XContest rules (section #4.1) and FFVL CFD rules (section #6) - this change is very important as it has an impact on the scoring (especially for XContest, the impact on the FFVL scores is next to none)
 - Folded FlatTriangle bound/score into FAITriangle bound/score resulting an universal Triangle bound/score code
 - Return the start/finish points for 3 TP distance flights in new scoreInfo fields ep['start'] and ep['finish'] to avoid confusion with the cp['in'] and cp['out'] fields that will now always contain the closing distance of the triangle

## [1.4.1] 2020-06-12

### Added
 - Added a new code field to allow for easier automated processing of scoring output
 - Added JSDoc
 - Added code coverage reporting
 - Added TypeScript definitions for the solver


# [1.4.0] 2020-06-11

### Added
 - Add three separate and well-defined interfaces: CLI, CJS and ESM


# [1.3.0] 2020-05-07

### Added
 - Vastly improved launch and landing detection supporting flight logs with multiple launches, landings and hiking segments


# [1.2.0] 2020-05-05

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


# [1.1.0] 2020-04-25

### Added
 - Support XContest rules
 
### Changed
 - Moved all the user-serviceable configuration to a separate file


## [1.0.1] 2020-04-22

### Changed
 - Faster processing of 3 turnpoints distance flights


# [1.0.0] 2020-04-22

### Added
- First release