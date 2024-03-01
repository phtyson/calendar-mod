import { fixedFromGregorian } from './gregorian.js';
import {
  angle,
  arccosDegrees,
  arcsinDegrees,
  arctanDegrees,
  binarySearch,
  cosDegrees,
  final,
  hr,
  invertAngular,
  mod,
  mod3,
  next,
  poly,
  sec,
  sigma,
  sinDegrees,
  tanDegrees,
  timeFromMoment,
} from './general.js';
import { gregorianDateDifference, gregorianYearFromFixed } from './gregorian.js';

// Difference between UT and local mean time at longitude phi as a fraction of a day.
const zoneFromLongitude = phi => phi / 360

// Universal time from local tee_ell at location.
const universalFromLocal = ( teeEll, location ) => teeEll - zoneFromLongitude( location.longitude )

// Local time from universal tee_rom-u at location.
const localFromUniveral = ( teeRomU, location ) => teeRomU + zoneFromLongitude( location.longitude )

// Standard time from tee_rom-u in universal time at location.
const standardFromUniversal = ( teeRomU, location ) => teeRomU + location.zone

// Universal time from tee_rom-s in standard time at location.
const universalFromStandard = ( teeRomU, location ) => teeRomU - location.zone

// Standard time from local tee_ell at location.
const standardFromLocal = ( teeEll, location ) => (
  standardFromUniversal( universalFromLocal( teeEll, location ), location )
)

// Local time from standard tee_rom-s at location.
const localFromStandard = ( teeRomS, location ) => (
  localFromUniveral( universalFromStandard( teeRomS, location ), location )
)

// Dynamical Time minus Universal Time (in days) for moment tee.
// Adapted from "Astronomical Algorithms" by Jean Meeus, Willmann-Bell (1991)
// for years 1600-1986 and from polynomials on the NASA Eclipse web site for other years.
const ephemerisCorrection = tee => {
  const year = gregorianYearFromFixed( Math.floor( tee ) )
  const c = ( 1 / 36525 ) * gregorianDateDifference(
    { year: 1900, month: 1, day: 1 },
    { year, month: 7, day: 1 },
  )
  const y2000 = year - 2000
  const y1700 = year - 1700
  const y1600 = year - 1600
  const y1000 = ( year - 1000 ) / 100
  const y0 = year / 100
  const y1820 = ( year - 1820 ) / 100
  if ( year >= 2051 && year <= 2150 ) {
    // c2051
    return ( 1 / 86400 )
    * ( -20 + 32 * ( y1820 ** 2 ) - 0.5628 * ( 2150 - year ) )
  }
  if ( year >= 2006 && year <= 2050 ) {
    // c2006
    return ( 1 / 86400 ) * poly( y2000, [ 62.92, 0.32217, 0.005589 ] )
  }
  if ( year >= 1987 && year <= 2005 ) {
    // c1987
    return ( 1 / 86400 )
      * poly( y2000, [ 63.86, 0.3345, -0.060374, 0.0017275, 0.000651814, 0.00002373599 ] )
  }
  if ( year >= 1900 && year <= 1986 ) {
    // c1900
    return poly( c, [
      -0.00002, 0.000297, 0.025184, -0.181133, 0.553040, -0.861938, 0.677066, -0.212591,
    ] )
  }
  if ( year >= 1800 && year <= 1899 ) {
    // c1800
    return poly( c, [
      -0.000009,
      0.003844,
      0.083563,
      0.865736,
      4.867575,
      15.845535,
      31.332267,
      38.291999,
      28.316289,
      11.636204,
      2.043794,
    ] )
  }
  if ( year >= 1700 && year <= 1799 ) {
    // c1700
    return ( 1 / 86400 ) * poly( y1700, [ 8.118780842, -0.005092142, 0.003336121, -0.0000266484 ] )
  }
  if ( year >= 1600 && year <= 1699 ) {
    // c1600
    return ( 1 / 86400 ) * poly( y1600, [ 120, -0.9808, -0.01532, 0.000140272128 ] )
  }
  if ( year >= 500 && year <= 1599 ) {
    // c500
    return ( 1 / 86400 ) * poly( y1000, [
      1574.2,
      -556.01,
      71.23472,
      0.319781,
      -0.8503463,
      -0.005050998,
      0.0083572073,
    ] )
  }
  if ( year > -500 && year < 500 ) {
    // c0
    return ( 1 / 86400 ) * poly( y0, [
      10583.6,
      -1014.41,
      33.78311,
      -5.952053,
      -0.1798452,
      0.022174192,
      0.0090316521,
    ] )
  }
  // other
  return ( 1 / 86400 ) * poly( y1820, [ -20, 0, 32 ] )
}

// Universal moment from Dynamical time tee.
const universalFromDynamical = tee => tee - ephemerisCorrection( tee )

// Dynamical time at Universal moment tee_rom-u.
const dynamicalFromUniversal = teeRomU => teeRomU + ephemerisCorrection( teeRomU )

// Noon at start of Gregorian year 2000.
// hr( 12 ) + gregorianNewYear( 2000 )
const J2000 = hr( 12 ) + 730120

// Julian centuries since 2000 at moment tee.
const julianCenturies = tee => ( 1 / 36525 ) * ( dynamicalFromUniversal( tee ) - J2000 )

// Obliquity of ecliptic at moment tee.
const obliquity = tee => {
  const c = julianCenturies( tee )
  return angle( 23, 26, 21.448 ) + poly( c, [
    0,
    angle( 0, 0, -46.8150 ),
    angle( 0, 0, -0.00059 ),
    angle( 0, 0, 0.001813 ),
  ] )
}

// Equation of time (as fraction of day) for moment tee.
// Adapted from "Astronomical Algorithms" by Jean Meeus,
// Willmann-Bell, 2nd edn., 1998, p. 185.
const equationOfTime = tee => {
  const c = julianCenturies( tee )
  const lambda = poly( c, [ 280.46645, 36000.76983, 0.0003032 ] )
  const anomaly = poly( c, [ 357.52910, 35999.05030, -0.0001559, -0.00000048 ] )
  const eccentricity = poly( c, [ 0.016708617, -0.000042037, -0.0000001236 ] )
  const varepsilon = obliquity( tee )
  const y = tanDegrees( varepsilon / 2 ) ** 2
  const equation = ( 1 / ( 2 * Math.PI ) )
    * ( y * sinDegrees( 2 * lambda ) - 2 * eccentricity * sinDegrees( anomaly )
    + 4 * eccentricity * y * sinDegrees( anomaly ) * cosDegrees( 2 * lambda )
    - 0.5 * ( y ** 2 ) * sinDegrees( 4 * lambda )
    - 1.25 * ( eccentricity ** 2 ) * sinDegrees( 2 * anomaly ) )
  return Math.sign( equation ) * Math.min( Math.abs( equation ), hr( 12 ) )
}

// Local time from sundial time tee at location.
const localFromApparent = ( tee, location ) => (
  tee - equationOfTime( universalFromLocal( tee, location ) )
)

// Universal time from sundial time tee at location.
const universalFromApparent = ( tee, location ) => (
  universalFromLocal( localFromApparent( tee, location ), location )
)

// Universal time of true (apparent) midnight of fixed date at location.
const midnight = ( date, location ) => universalFromApparent( date, location )

// Universal time on fixed date of midday at location.
const midday = ( date, location ) => universalFromApparent( date + hr( 12 ), location )

// Mean sidereal time of day from moment 'tee' expressed
// as hour angle.  Adapted from "Astronomical Algorithms"
// by Jean Meeus, Willmann-Bell, Inc., 2nd edn., 1998, p. 88.
const siderealFromMoment = tee => {
  const c = ( tee - J2000 ) / 36525
  return mod( poly( c, [
    280.46061837,
    ( 36525 * 360.98564736629 ),
    0.000387933,
    ( -1 / 38710000 ),
  ] ), 360 )
}

// Return declination at moment UT tee of object at longitude 'lam' and latitude 'beta'.
const declination = ( tee, beta, lambda ) => {
  const varepsilon = obliquity( tee )
  return arcsinDegrees(
    sinDegrees( beta ) * cosDegrees( varepsilon )
    + cosDegrees( beta ) * sinDegrees( varepsilon )
    * sinDegrees( lambda ),
  )
}

// Right ascension at moment UT 'tee' of object at latitude 'beta' and longitude 'lambda'.
const rightAscension = ( tee, beta, lambda ) => {
  const varepsilon = obliquity( tee )
  return arctanDegrees(
    sinDegrees( lambda ) * cosDegrees( varepsilon ) - tanDegrees( beta ) * sinDegrees( varepsilon ),
    cosDegrees( lambda ),
  )
}

// Longitudinal nutation at moment tee.
const nutation = tee => {
  const c = julianCenturies( tee )
  const A = poly( c, [ 124.90, -1934.134, 0.002063 ] )
  const B = poly( c, [ 201.11, 72001.5377, 0.00057 ] )
  return -0.004778 * sinDegrees( A ) - 0.0003667 * sinDegrees( B )
}

// Aberration at moment tee.
const aberration = tee => {
  const c = julianCenturies( tee )
  return 0.0000974 * cosDegrees( 177.63 + 35999.01848 * c ) - 0.005575
}

// Longitude of sun at moment tee.
// Adapted from "Planetary Programs and Tables from -4000 to +2800"
// by Pierre Bretagnon and Jean-Louis Simon, Willmann-Bell, 1986.
const solarLongitude = tee => {
  const c = julianCenturies( tee )
  const coefficients = [
    403406, 195207, 119433, 112392, 3891, 2819, 1721,
    660, 350, 334, 314, 268, 242, 234, 158, 132, 129, 114,
    99, 93, 86, 78, 72, 68, 64, 46, 38, 37, 32, 29, 28, 27, 27,
    25, 24, 21, 21, 20, 18, 17, 14, 13, 13, 13, 12, 10, 10, 10, 10,
  ]
  const addends = [
    270.54861, 340.19128, 63.91854, 331.26220,
    317.843, 86.631, 240.052, 310.26, 247.23,
    260.87, 297.82, 343.14, 166.79, 81.53,
    3.50, 132.75, 182.95, 162.03, 29.8,
    266.4, 249.2, 157.6, 257.8, 185.1, 69.9,
    8.0, 197.1, 250.4, 65.3, 162.7, 341.5,
    291.6, 98.5, 146.7, 110.0, 5.2, 342.6,
    230.9, 256.1, 45.3, 242.9, 115.2, 151.8,
    285.3, 53.3, 126.6, 205.7, 85.9, 146.1,
  ]
  const multipliers = [
    0.9287892, 35999.1376958, 35999.4089666,
    35998.7287385, 71998.20261, 71998.4403,
    36000.35726, 71997.4812, 32964.4678,
    -19.4410, 445267.1117, 45036.8840, 3.1008,
    22518.4434, -19.9739, 65928.9345,
    9038.0293, 3034.7684, 33718.148, 3034.448,
    -2280.773, 29929.992, 31556.493, 149.588,
    9037.750, 107997.405, -4444.176, 151.771,
    67555.316, 31556.080, -4561.540,
    107996.706, 1221.655, 62894.167,
    31437.369, 14578.298, -31931.757,
    34777.243, 1221.999, 62894.511,
    -4442.039, 107997.909, 119.066, 16859.071,
    -4.578, 26895.292, -39.127, 12297.536, 90073.778,
  ]
  const lambda = 282.7771834 + 36000.76953744 * c + 0.000005729577951308232
    * sigma(
      [ coefficients, addends, multipliers ],
      ( [ x, y, z ] ) => ( x * sinDegrees( y + z * c ) ),
    )
  return mod( ( lambda + aberration( tee ) + nutation( tee ) ), 360 )
}

// Type: Duration
const MEAN_TROPICAL_YEAR = 365.242189

// Moment UT of the first time at or after tee
// when the solar longitude will be lambda degrees.
const solarLongitudeAfter = ( lambda, tee ) => {
  const rate = MEAN_TROPICAL_YEAR / 360
  const tau = tee + rate * mod( lambda - solarLongitude( tee ), 360 )
  const a = Math.max( tee, tau - 5 )
  const b = tau + 5
  return invertAngular( solarLongitude, lambda, a, b )
}

// Precession at moment tee using 0,0 as J2000 coordinates.
// Adapted from "Astronomical Algorithms" by Jean Meeus,
// Willmann-Bell, 2nd edn., 1998, pp. 136-137.
const precession = tee => {
  const c = julianCenturies( tee )
  const eta = mod( poly( c, [
    0,
    angle( 0, 0, 47.0029 ),
    angle( 0, 0, -0.03302 ),
    angle( 0, 0, 0.000060 ),
  ] ), 360 )
  const P = mod( poly( c, [
    174.876384,
    angle( 0, 0, -869.8089 ),
    angle( 0, 0, 0.03536 ),
  ] ), 360 )
  const p = mod( poly( c, [
    0,
    angle( 0, 0, 5029.0966 ),
    angle( 0, 0, 1.11113 ),
    angle( 0, 0, 0.000006 ),
  ] ), 360 )
  const A = cosDegrees( eta ) * sinDegrees( P )
  const B = cosDegrees( P )
  const arg = arctanDegrees( A, B )
  return mod( p + P - arg, 360 )
}

// Type: Duration
const MEAN_SIDEREAL_YEAR = 365.25636

// Type: Angle
const SIDEREAL_START = precession( fixedFromGregorian( 1956, 3, 21 ) )
  + nutation( fixedFromGregorian( 1956, 3, 21 ) ) - angle( 23, 15, 0 )

// Sidereal solar longitude at moment tee
const siderealSolarLongitude = tee => (
  mod( solarLongitude( tee ) - precession( tee ) - nutation( tee ) + SIDEREAL_START, 360 )
)

// Type: (season moment) -> moment
// Approximate moment at or before tee when solar longitude just exceeded lambda degrees.
const estimatePriorSolarLongitude = ( lambda, tee ) => {
  const rate = MEAN_TROPICAL_YEAR / 360
  const tau = tee - rate * mod( solarLongitude( tee ) - lambda, 360 )
  const capDelta = mod3( solarLongitude( tau ) - lambda, -180, 180 )
  return Math.min( tee, tau - rate * capDelta )
}

// Type: Duration
const MEAN_SYNODIC_MONTH = 29.530588861

// Mean longitude of moon (in degrees) at moment given in Julian centuries c.
// Adapted from "Astronomical Algorithms" by Jean Meeus,
// Willmann-Bell, 2nd edn., 1998, pp. 337-340.
const meanLunarLongitude = c => (
  mod( poly( c, [
    218.3164477,
    481267.88123421,
    -0.0015786,
    ( 1 / 538841 ),
    ( -1 / 65194000 ),
  ] ), 360 )
)

// Elongation of moon (in degrees) at moment given in Julian centuries c.
// Adapted from "Astronomical Algorithms" by Jean Meeus,
// Willmann-Bell, 2nd edn., 1998, p. 338.
const lunarElongation = c => (
  mod( poly( c, [
    297.8501921,
    445267.1114034,
    -0.0018819,
    ( 1 / 545868 ),
    ( -1 / 113065000 ),
  ] ), 360 )
)

// Mean anomaly of sun (in degrees) at moment given in Julian centuries c.
// Adapted from "Astronomical Algorithms" by Jean Meeus,
// Willmann-Bell, 2nd edn., 1998, p. 338.
const solarAnomaly = c => (
  mod( poly( c, [
    357.5291092,
    35999.0502909,
    -0.0001536,
    ( 1 / 24490000 ),
  ] ), 360 )
)

// Mean anomaly of moon (in degrees) at moment given in Julian centuries c.
// Adapted from "Astronomical Algorithms" by Jean Meeus,
// Willmann-Bell, 2nd edn., 1998, p. 338.
const lunarAnomaly = c => (
  mod( poly( c, [
    134.9633964,
    477198.8675055,
    0.0087414,
    ( 1 / 69699 ),
    ( -1 / 14712000 ),
  ] ), 360 )
)

// Moon's argument of latitude (in degrees) at moment given in Julian centuries c.
// Adapted from "Astronomical Algorithms" by Jean Meeus,
// Willmann-Bell, 2nd edn., 1998, p. 338.
const moonNode = c => (
  mod( poly( c, [
    93.2720950,
    483202.0175233,
    -0.0036539,
    ( -1 / 3526000 ),
    ( 1 / 863310000 ),
  ] ), 360 )
)

// Longitude of moon (in degrees) at moment tee.
// Adapted from "Astronomical Algorithms" by Jean Meeus,
// Willmann-Bell, 2nd edn., 1998, pp. 338-342.
const lunarLongitude = tee => {
  const c = julianCenturies( tee )
  const Lprime = meanLunarLongitude( c )
  const D = lunarElongation( c )
  const M = solarAnomaly( c )
  const MPrime = lunarAnomaly( c )
  const F = moonNode( c )
  const E = poly( c, [ 1, -0.002516, -0.0000074 ] )
  const argsSineCoeff = [
    6288774, 1274027, 658314, 213618, -185116, -114332,
    58793, 57066, 53322, 45758, -40923, -34720, -30383,
    15327, -12528, 10980, 10675, 10034, 8548, -7888,
    -6766, -5163, 4987, 4036, 3994, 3861, 3665, -2689,
    -2602, 2390, -2348, 2236, -2120, -2069, 2048, -1773,
    -1595, 1215, -1110, -892, -810, 759, -713, -700, 691,
    596, 549, 537, 520, -487, -399, -381, 351, -340, 330,
    327, -323, 299, 294,
  ]
  const argsLunarElongation = [
    0, 2, 2, 0, 0, 0, 2, 2, 2, 2, 0, 1, 0, 2, 0, 0, 4, 0, 4, 2, 2, 1,
    1, 2, 2, 4, 2, 0, 2, 2, 1, 2, 0, 0, 2, 2, 2, 4, 0, 3, 2, 4, 0, 2,
    2, 2, 4, 0, 4, 1, 2, 0, 1, 3, 4, 2, 0, 1, 2,
  ]
  const argsSolarAnomaly = [
    0, 0, 0, 0, 1, 0, 0, -1, 0, -1, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1, 1,
    0, 1, -1, 0, 0, 0, 1, 0, -1, 0, -2, 1, 2, -2, 0, 0, -1, 0, 0, 1,
    -1, 2, 2, 1, -1, 0, 0, -1, 0, 1, 0, 1, 0, 0, -1, 2, 1, 0,
  ]
  const argsLunarAnomaly = [
    1, -1, 0, 2, 0, 0, -2, -1, 1, 0, -1, 0, 1, 0, 1, 1, -1, 3, -2,
    -1, 0, -1, 0, 1, 2, 0, -3, -2, -1, -2, 1, 0, 2, 0, -1, 1, 0,
    -1, 2, -1, 1, -2, -1, -1, -2, 0, 1, 4, 0, -2, 0, 2, 1, -2, -3,
    2, 1, -1, 3,
  ]
  const argsMoonNode = [
    0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, -2, 2, -2, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, -2, 2, 0, 2, 0, 0, 0, 0,
    0, 0, -2, 0, 0, 0, 0, -2, -2, 0, 0, 0, 0, 0, 0, 0,
  ]
  const correction = ( 1 / 1000000 )
    * sigma( [
      argsSineCoeff, argsLunarElongation, argsSolarAnomaly, argsLunarAnomaly, argsMoonNode,
    ], ( [ v, w, x, y, z ] ) => (
      v * ( E ** Math.abs( x ) ) * sinDegrees( w * D + x * M + y * MPrime + z * F )
    ) )
  const venus = ( 3958 / 1000000 ) * sinDegrees( 119.75 + c * 131.849 )
  const jupiter = ( 318 / 1000000 ) * sinDegrees( 53.09 + c * 479264.29 )
  const flatEarth = ( 1962 / 1000000 ) * sinDegrees( Lprime - F )
  return mod( Lprime + correction + venus + jupiter + flatEarth + nutation( tee ), 360 )
}

// Moment of n-th new moon after (or before) the new moon
// of January 11, 1.  Adapted from "Astronomical Algorithms"
// by Jean Meeus, Willmann-Bell, corrected 2nd edn., 2005.
const nthNewMoon = n => {
  const n0 = 24724
  const k = n - n0
  const c = k / 1236.85
  const approx = J2000 + poly( c, [
    5.09766,
    ( MEAN_SYNODIC_MONTH * 1236.85 ),
    0.00015437,
    -0.000000150,
    0.00000000073,
  ] )
  const E = poly( c, [ 1, -0.002516, -0.0000074 ] )
  const solarAnomaly = poly( c, [
    2.5534,
    ( 29.10535670 * 1236.85 ),
    -0.0000014,
    -0.00000011,
  ] )
  const lunarAnomaly = poly( c, [
    201.5643,
    ( 385.81693528 * 1236.85 ),
    0.0107582,
    0.00001238,
    -0.000000058,
  ] )
  const moonArgument = poly( c, [
    160.7108,
    ( 390.67050284 * 1236.85 ),
    -0.0016118,
    -0.00000227,
    0.000000011,
  ] )
  const omega = poly( c, [
    124.7746,
    ( -1.56375588 * 1236.85 ),
    0.0020672,
    0.00000215,
  ] )
  const sineCoeff = [
    -0.40720, 0.17241, 0.01608,
    0.01039, 0.00739, -0.00514,
    0.00208, -0.00111, -0.00057,
    0.00056, -0.00042, 0.00042,
    0.00038, -0.00024, -0.00007,
    0.00004, 0.00004, 0.00003,
    0.00003, -0.00003, 0.00003,
    -0.00002, -0.00002, 0.00002,
  ]
  const EFactor = [ 0, 1, 0, 0, 1, 1, 2, 0, 0, 1, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
  const solarCoeff = [ 0, 1, 0, 0, -1, 1, 2, 0, 0, 1, 0, 1, 1, -1, 2, 0, 3, 1, 0, 1, -1, -1, 1, 0 ]
  const lunarCoeff = [ 1, 0, 2, 0, 1, 1, 0, 1, 1, 2, 3, 0, 0, 2, 1, 2, 0, 1, 2, 1, 1, 1, 3, 4 ]
  const moonCoeff = [ 0, 0, 0, 2, 0, 0, 0, -2, 2, 0, 0, 2, -2, 0, 0, -2, 0, -2, 2, 2, 2, -2, 0, 0 ]
  const correction = -0.00017 * sinDegrees( omega )
    + sigma( [ sineCoeff, EFactor, solarCoeff, lunarCoeff, moonCoeff ], ( [ v, w, x, y, z ] ) => (
      v * ( E ** w ) * sinDegrees( x * solarAnomaly + y * lunarAnomaly + z * moonArgument )
    ) )
  const extra = 0.000325 * sinDegrees( poly( c, [ 299.77, 132.8475848, -0.009173 ] ) )
  const addConst = [
    251.88, 251.83, 349.42, 84.66,
    141.74, 207.14, 154.84, 34.52, 207.19,
    291.34, 161.72, 239.56, 331.55,
  ]
  const addCoeff = [
    0.016321, 26.651886, 36.412478, 18.206239, 53.303771,
    2.453732, 7.306860, 27.261239, 0.121824,
    1.844379, 24.198154, 25.513099, 3.592518,
  ]
  const addFactor = [
    0.000165, 0.000164, 0.000126, 0.000110,
    0.000062, 0.000060, 0.000056, 0.000047, 0.000042,
    0.000040, 0.000037, 0.000035, 0.000023,
  ]
  const additional = sigma( [ addConst, addCoeff, addFactor ], ( [ i, j, l ] ) => (
    l * sinDegrees( i + j * k )
  ) )
  return universalFromDynamical( approx + correction + extra + additional )
}

// Lunar phase, as an angle in degrees, at moment tee.
// An angle of 0 means a new moon, 90 degrees means the
// first quarter, 180 means a full moon, and 270 degrees
// means the last quarter.
const lunarPhase = tee => {
  const phi = mod( lunarLongitude( tee ) - solarLongitude( tee ), 360 )
  const t0 = nthNewMoon( 0 )
  const n = Math.round( ( tee - t0 ) / MEAN_SYNODIC_MONTH )
  const phiPrime = 360 * mod( ( tee - nthNewMoon( n ) ) / MEAN_SYNODIC_MONTH, 1 )
  return Math.abs( phi - phiPrime ) > 180 ? phiPrime : phi
}

// Moment UT of the last time at or before tee
// when the lunar-phase is phi degrees.
const lunarPhaseAtOrBefore = ( phi, tee ) => {
  const tau = tee - MEAN_SYNODIC_MONTH * ( 1 / 360 ) * mod( lunarPhase( tee ) - phi, 360 )
  const a = tau - 2
  const b = Math.min( tee, tau + 2 )
  return invertAngular( lunarPhase, phi, a, b )
}

// Moment UT of the next time at or after tee
// when the lunar-phase is phi degrees.
const lunarPhaseAtOrAfter = ( phi, tee ) => {
  const tau = tee + MEAN_SYNODIC_MONTH * ( 1 / 360 ) * mod( phi - lunarPhase( tee ), 360 )
  const a = Math.max( tee, tau - 2 )
  const b = tau + 2
  return invertAngular( lunarPhase, phi, a, b )
}

// Latitude of moon (in degrees) at moment tee.
// Adapted from "Astronomical Algorithms" by Jean Meeus,
// Willmann-Bell, 2nd edn., 1998, pp. 338-342.
const lunarLatitude = tee => {
  const c = julianCenturies( tee )
  const LPrime = meanLunarLongitude( c )
  const D = lunarElongation( c )
  const M = solarAnomaly( c )
  const MPrime = lunarAnomaly( c )
  const F = moonNode( c )
  const E = poly( c, [ 1, -0.002516, -0.0000074 ] )
  const argsSineCoeff = [
    5128122, 280602, 277693, 173237, 55413, 46271, 32573,
    17198, 9266, 8822, 8216, 4324, 4200, -3359, 2463, 2211,
    2065, -1870, 1828, -1794, -1749, -1565, -1491, -1475,
    -1410, -1344, -1335, 1107, 1021, 833, 777, 671, 607,
    596, 491, -451, 439, 422, 421, -366, -351, 331, 315,
    302, -283, -229, 223, 223, -220, -220, -185, 181,
    -177, 176, 166, -164, 132, -119, 115, 107,
  ]
  const argsLunarElongation = [
    0, 0, 0, 2, 2, 2, 2, 0, 2, 0, 2, 2, 2, 2, 2, 2, 2, 0, 4, 0, 0, 0,
    1, 0, 0, 0, 1, 0, 4, 4, 0, 4, 2, 2, 2, 2, 0, 2, 2, 2, 2, 4, 2, 2,
    0, 2, 1, 1, 0, 2, 1, 2, 0, 4, 4, 1, 4, 1, 4, 2,
  ]
  const argsSolarAnomaly = [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1, 0, 0, 1, -1, -1, -1, 1, 0, 1,
    0, 1, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1, 1,
    0, -1, -2, 0, 1, 1, 1, 1, 1, 0, -1, 1, 0, -1, 0, 0, 0, -1, -2,
  ]
  const argsLunarAnomaly = [
    0, 1, 1, 0, -1, -1, 0, 2, 1, 2, 0, -2, 1, 0, -1, 0, -1, -1, -1,
    0, 0, -1, 0, 1, 1, 0, 0, 3, 0, -1, 1, -2, 0, 2, 1, -2, 3, 2, -3,
    -1, 0, 0, 1, 0, 1, 1, 0, 0, -2, -1, 1, -2, 2, -2, -1, 1, 1, -1,
    0, 0,
  ]
  const argsMoonNode = [
    1, 1, -1, -1, 1, -1, 1, 1, -1, -1, -1, -1, 1, -1, 1, 1, -1, -1,
    -1, 1, 3, 1, 1, 1, -1, -1, -1, 1, -1, 1, -3, 1, -3, -1, -1, 1,
    -1, 1, -1, 1, 1, 1, 1, -1, 3, -1, -1, 1, -1, -1, 1, -1, 1, -1,
    -1, -1, -1, -1, -1, 1,
  ]
  const beta = ( 1 / 1000000 )
    * sigma( [
      argsSineCoeff, argsLunarElongation, argsSolarAnomaly, argsLunarAnomaly, argsMoonNode,
    ], ( [ v, w, x, y, z ] ) => (
      v * ( E ** Math.abs( x ) ) * sinDegrees( w * D + x * M + y * MPrime + z * F )
    ) )
  const venus = ( 175 / 1000000 ) * (
    sinDegrees( 119.75 + c * 131.849 + F ) + sinDegrees( 119.75 + c * 131.849 - F )
  )
  const flatEarth = ( -2235 / 1000000 ) * sinDegrees( LPrime )
    + ( 127 / 1000000 ) * sinDegrees( LPrime - MPrime )
    - ( 115 / 1000000 ) * sinDegrees( LPrime + MPrime )
  const extra = ( 382 / 1000000 ) * sinDegrees( 313.45 + c * 481266.484 )
  return beta + venus + flatEarth + extra
}

// Geocentric altitude of moon at tee at location,
// as a small positive/negative angle in degrees, ignoring
// parallax and refraction.  Adapted from "Astronomical
// Algorithms" by Jean Meeus, Willmann-Bell, 2nd edn., 1998.
const lunarAltitude = ( tee, location ) => {
  const lambda = lunarLongitude( tee )
  const beta = lunarLatitude( tee )
  const alpha = rightAscension( tee, beta, lambda )
  const delta = declination( tee, beta, lambda )
  const theta0 = siderealFromMoment( tee )
  const H = mod( ( theta0 + location.longitude - alpha ), 360 )
  const altitude = arcsinDegrees(
    sinDegrees( location.latitude ) * sinDegrees( delta )
    + cosDegrees( location.latitude ) * cosDegrees( delta )
    * cosDegrees( H ),
  )
  return mod3( altitude, -180, 180 )
}

// Distance to moon (in meters) at moment tee.
// Adapted from "Astronomical Algorithms" by Jean Meeus,
// Willmann-Bell, 2nd edn., 1998, pp. 338-342.
const lunarDistance = tee => {
  const c = julianCenturies( tee )
  const D = lunarElongation( c )
  const M = solarAnomaly( c )
  const MPrime = lunarAnomaly( c )
  const F = moonNode( c )
  const E = poly( c, [ 1, -0.002516, -0.0000074 ] )
  const argsCosineCoeff = [
    -20905355, -3699111, -2955968, -569925, 48888, -3149,
    246158, -152138, -170733, -204586, -129620, 108743,
    104755, 10321, 0, 79661, -34782, -23210, -21636, 24208,
    30824, -8379, -16675, -12831, -10445, -11650, 14403,
    -7003, 0, 10056, 6322, -9884, 5751, 0, -4950, 4130, 0,
    -3958, 0, 3258, 2616, -1897, -2117, 2354, 0, 0, -1423,
    -1117, -1571, -1739, 0, -4421, 0, 0, 0, 0, 1165, 0, 0, 8752,
  ]
  const argsLunarElongation = [
    0, 2, 2, 0, 0, 0, 2, 2, 2, 2, 0, 1, 0, 2, 0, 0, 4, 0, 4, 2, 2, 1,
    1, 2, 2, 4, 2, 0, 2, 2, 1, 2, 0, 0, 2, 2, 2, 4, 0, 3, 2, 4, 0, 2,
    2, 2, 4, 0, 4, 1, 2, 0, 1, 3, 4, 2, 0, 1, 2, 2,
  ]
  const argsSolarAnomaly = [
    0, 0, 0, 0, 1, 0, 0, -1, 0, -1, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1, 1,
    0, 1, -1, 0, 0, 0, 1, 0, -1, 0, -2, 1, 2, -2, 0, 0, -1, 0, 0, 1,
    -1, 2, 2, 1, -1, 0, 0, -1, 0, 1, 0, 1, 0, 0, -1, 2, 1, 0, 0,
  ]
  const argsLunarAnomaly = [
    1, -1, 0, 2, 0, 0, -2, -1, 1, 0, -1, 0, 1, 0, 1, 1, -1, 3, -2,
    -1, 0, -1, 0, 1, 2, 0, -3, -2, -1, -2, 1, 0, 2, 0, -1, 1, 0,
    -1, 2, -1, 1, -2, -1, -1, -2, 0, 1, 4, 0, -2, 0, 2, 1, -2, -3,
    2, 1, -1, 3, -1,
  ]
  const argsMoonNode = [
    0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, -2, 2, -2, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, -2, 2, 0, 2, 0, 0, 0, 0,
    0, 0, -2, 0, 0, 0, 0, -2, -2, 0, 0, 0, 0, 0, 0, 0, -2,
  ]
  const correction = sigma( [
    argsCosineCoeff, argsLunarElongation, argsSolarAnomaly, argsLunarAnomaly, argsMoonNode,
  ], ( [ v, w, x, y, z ] ) => (
    v * ( E ** Math.abs( x ) ) * cosDegrees( w * D + x * M + y * MPrime + z * F )
  ) )
  return 385000560 + correction
}

// Parallax of moon at tee at location.
// Adapted from "Astronomical Algorithms" by Jean Meeus,
// Willmann-Bell, 2nd edn., 1998.
const lunarParallax = ( tee, location ) => {
  const geo = lunarAltitude( tee, location )
  const delta = lunarDistance( tee )
  const alt = 6378140 / delta
  return arcsinDegrees( alt * cosDegrees( geo ) )
}

// Topocentric altitude of moon at tee at location,
// as a small positive/negative angle in degrees, ignoring refraction.
const topocentricLunarAltitude = ( tee, location ) => (
  lunarAltitude( tee, location ) - lunarParallax( tee, location )
)

// Moment UT of last new moon before tee.
const newMoonBefore = tee => {
  const t0 = nthNewMoon( 0 )
  const phi = lunarPhase( tee )
  const n = Math.round( ( ( tee - t0 ) / MEAN_SYNODIC_MONTH ) - ( phi / 360 ) )
  return nthNewMoon( final( n - 1, k => ( nthNewMoon( k ) < tee ) ) )
}

// Moment UT of first new moon at or after tee.
const newMoonAtOrAfter = tee => {
  const t0 = nthNewMoon( 0 )
  const phi = lunarPhase( tee )
  const n = Math.round( ( ( tee - t0 ) / MEAN_SYNODIC_MONTH ) - ( phi / 360 ) )
  return nthNewMoon( next( n, k => ( nthNewMoon( k ) >= tee ) ) )
}

// Sine of angle between position of sun at local time tee
// and when its depression is alpha at location.
// Out of range when it does not occur.
const sineOffset = ( tee, location, alpha ) => {
  const phi = location.latitude
  const teePrime = universalFromLocal( tee, location )
  const delta = declination( teePrime, 0, solarLongitude( teePrime ) )
  return tanDegrees( phi ) * tanDegrees( delta )
    + ( sinDegrees( alpha ) / ( cosDegrees( delta ) * cosDegrees( phi ) ) )
}

// Moment in local time near tee when depression angle of sun is alpha
// (negative if above horizon) at location; early? is true when morning event
// is sought and false for evening.  Returns bogus if depression angle is not reached.
const approxMomentOfDepression = ( tee, location, alpha, isEarly ) => {
  const ttry = sineOffset( tee, location, alpha )
  const date = Math.floor( tee )
  const alt = ( alpha >= 0 && isEarly ) ? date : ( alpha >= 0 ? date + 1 : date + hr( 12 ) )
  const value = Math.abs( ttry ) > 1 ? sineOffset( alt, location, alpha ) : ttry
  const offset = mod3( ( arcsinDegrees( value ) / 360 ), hr( -12 ), hr( 12 ) )
  if ( Math.abs( value ) <= 1 ) {
    return localFromApparent(
      ( date + ( isEarly ? hr( 6 ) - offset : hr( 18 ) + offset ) ),
      location,
    )
  }
  return null // Bogus
}

// Moment in local time near approx when depression angle of sun is alpha
// (negative if above horizon) at location; early? is true when morning event
// is sought, and false for evening. Returns bogus if depression angle is not reached.
const momentOfDepression = ( approx, location, alpha, isEarly ) => {
  const tee = approxMomentOfDepression( approx, location, alpha, isEarly )
  return tee === null ? null : ( Math.abs( approx - tee ) < sec( 30 )
    ? tee : momentOfDepression( tee, location, alpha, isEarly ) )
}

// Standard time in morning on fixed date at location when depression
// angle of sun is alpha. Returns bogus if there is no dawn on date.
const dawn = ( date, location, alpha ) => {
  const result = momentOfDepression( date + hr( 6 ), location, alpha, true )
  return result === null ? null : standardFromLocal( result, location )
}

// Standard time in evening on fixed date at location when depression
// angle of sun is alpha. Returns bogus if there is no dusk on date.
const dusk = ( date, location, alpha ) => {
  const result = momentOfDepression( date + hr( 18 ), location, alpha, false )
  return result === null ? null : standardFromLocal( result, location )
}

// Refraction angle at moment tee at location.
// The moment is not used.
const refraction = location => {
  const h = Math.max( 0, location.elevation )
  const R = 6.372 * ( 10 ** 6 )
  const dip = arccosDegrees( R / ( R + h ) )
  return angle( 0, 34, 0 ) + dip + angle( 0, 0, 19 ) * Math.sqrt( h )
}

// Standard time of sunrise on fixed date at location.
const sunrise = ( date, location ) => {
  const alpha = refraction( location ) + angle( 0, 16, 0 )
  return dawn( date, location, alpha )
}

// Standard time of sunset on fixed date at location.
const sunset = ( date, location ) => {
  const alpha = refraction( location ) + angle( 0, 16, 0 )
  return dusk( date, location, alpha )
}

// Observed altitude of upper limb of moon at tee at location,
// as a small positive/negative angle in degrees, including
// refraction and elevation.
const observedLunarAltitude = ( tee, location ) => (
  topocentricLunarAltitude( tee, location ) + refraction( location ) + angle( 0, 16, 0 )
)

// Standard time of moonset on fixed date at location.
// Returns bogus if there is no moonset on date.
const moonrise = ( date, location ) => {
  const tee = universalFromStandard( date, location )
  const waning = lunarPhase( tee ) > 180
  const alt = observedLunarAltitude( tee, location )
  const offset = alt / ( 4 * ( 90 - Math.abs( location.latitude ) ) )
  let approx
  if ( waning && offset > 0 ) {
    approx = tee + 1 - offset
  } else if ( waning ) {
    approx = tee - offset
  } else {
    approx = tee + ( 1 / 2 ) + offset
  }
  const rise = binarySearch(
    approx - hr( 6 ),
    approx + hr( 6 ),
    ( l, u ) => u - l < hr( 1 / 60 ),
    x => observedLunarAltitude( x, location ) > 0,
  )
  return rise < tee + 1 ? Math.max( standardFromUniversal( rise, location ), date ) : null
}

// Standard time of moonrise on fixed date at location.
// Returns bogus if there is no moonrise on date.
const moonset = ( date, location ) => {
  const tee = universalFromStandard( date, location )
  const waxing = lunarPhase( tee ) < 180
  const alt = observedLunarAltitude( tee, location )
  const offset = alt / ( 4 * ( 90 - Math.abs( location.latitude ) ) )
  let approx
  if ( waxing && offset > 0 ) {
    approx = tee + offset
  } else if ( waxing ) {
    approx = tee + 1 + offset
  } else {
    approx = tee - offset + ( 1 / 2 )
  }
  const set = binarySearch(
    approx - hr( 6 ),
    approx + hr( 6 ),
    ( l, u ) => u - l < hr( 1 / 60 ),
    x => observedLunarAltitude( x, location ) < 0,
  )
  return set < tee + 1 ? Math.max( standardFromUniversal( set, location ), date ) : null
}

// Length of daytime temporal hour on fixed date at location.
// Returns bogus if there no sunrise or sunset on date.
const daytimeTemporalHour = ( date, location ) => {
  if ( sunrise( date, location ) === null || sunset( date, location ) === null ) {
    return null
  }
  return ( 1 / 12 ) * ( sunset( date, location ) - sunrise( date, location ) )
}

// Length of nighttime temporal hour on fixed date at location.
// Returns bogus if there no sunrise or sunset on date.
const nighttimeTemporalHour = ( date, location ) => {
  if ( sunrise( date + 1, location ) === null || sunset( date, location ) === null ) {
    return null
  }
  return ( 1 / 12 ) * ( sunrise( date + 1, location ) - sunset( date, location ) )
}

// Standard time of temporal moment tee at location.
// Returns bogus if temporal hour is undefined that day.
const standardFromSundial = ( tee, location ) => {
  const date = Math.floor( tee )
  const hour = 24 * timeFromMoment( tee )
  let h
  if ( hour >= 6 && hour <= 18 ) {
    h = daytimeTemporalHour( date, location )
  } else if ( hour < 6 ) {
    h = nighttimeTemporalHour( date - 1, location )
  } else {
    h = nighttimeTemporalHour( date, location )
  }
  if ( h === null ) {
    return null
  }
  if ( hour >= 6 && hour <= 18 ) {
    return sunrise( date, location ) + ( hour - 6 ) * h
  }
  if ( hour < 6 ) {
    return sunset( date - 1, location ) + ( hour + 6 ) * h
  }
  return sunset( date, location ) + ( hour - 18 ) * h
}

// Angular separation of sun and moon at moment tee.
const arcOfLight = tee => (
  arccosDegrees( cosDegrees( lunarLatitude( tee ) ) * cosDegrees( lunarPhase( tee ) ) )
)

// Best viewing time (UT) in the evening.
// Simple version.
const simpleBestView = ( date, location ) => {
  const dark = dusk( date, location, 4.5 )
  const best = dark === null ? date + 1 : dark
  return universalFromStandard( best, location )
}

// S. K. Shaukat's criterion for likely
// visibility of crescent moon on eve of date at location.
// Not intended for high altitudes or polar regions.
const shaukatCriterion = ( date, location ) => {
  const tee = simpleBestView( date - 1, location )
  const phase = lunarPhase( tee )
  const h = lunarAltitude( tee, location )
  const ARCL = arcOfLight( tee )
  return ( phase > 0 && phase < 90 ) && ( ARCL >= 10.6 && ARCL <= 90 ) && ( h > 4.1 )
}

// Criterion for possible visibility of crescent moon
// on eve of date at location.
// Shaukat's criterion may be replaced with another.
const visibleCrescent = ( date, location ) => shaukatCriterion( date, location )

// Closest fixed date on or before 'date' when crescent
// moon first became visible at 'location'.
const phasisOnOrBefore = ( date, location ) => {
  const moon = Math.floor( lunarPhaseAtOrBefore( 0, date ) )
  const age = date - moon
  const tau = ( age <= 3 && !visibleCrescent( date, location ) ) ? moon - 30 : moon
  return next( tau, d => visibleCrescent( d, location ) )
}

// Closest fixed date on or after 'date' on the eve
// of which crescent moon first became visible at 'location'.
const phasisOnOrAfter = ( date, location ) => {
  const moon = Math.floor( lunarPhaseAtOrBefore( 0, date ) )
  const age = date - moon
  const tau = ( age >= 4 && visibleCrescent( date - 1, location ) ) ? moon + 29 : date
  return next( tau, d => visibleCrescent( d, location ) )
}

export {
  zoneFromLongitude,
  universalFromLocal,
  localFromUniveral,
  standardFromUniversal,
  universalFromStandard,
  standardFromLocal,
  localFromStandard,
  ephemerisCorrection,
  universalFromDynamical,
  dynamicalFromUniversal,
  J2000,
  julianCenturies,
  obliquity,
  equationOfTime,
  localFromApparent,
  universalFromApparent,
  midnight,
  midday,
  siderealFromMoment,
  declination,
  rightAscension,
  nutation,
  aberration,
  solarLongitude,
  MEAN_TROPICAL_YEAR,
  solarLongitudeAfter,
  precession,
  MEAN_SIDEREAL_YEAR,
  SIDEREAL_START,
  siderealSolarLongitude,
  estimatePriorSolarLongitude,
  MEAN_SYNODIC_MONTH,
  meanLunarLongitude,
  lunarElongation,
  solarAnomaly,
  lunarAnomaly,
  moonNode,
  lunarLongitude,
  nthNewMoon,
  lunarPhase,
  lunarPhaseAtOrBefore,
  lunarPhaseAtOrAfter,
  lunarLatitude,
  lunarAltitude,
  lunarDistance,
  lunarParallax,
  topocentricLunarAltitude,
  newMoonBefore,
  newMoonAtOrAfter,
  sineOffset,
  approxMomentOfDepression,
  momentOfDepression,
  dawn,
  dusk,
  refraction,
  sunrise,
  sunset,
  observedLunarAltitude,
  moonrise,
  moonset,
  daytimeTemporalHour,
  nighttimeTemporalHour,
  standardFromSundial,
  arcOfLight,
  simpleBestView,
  shaukatCriterion,
  visibleCrescent,
  phasisOnOrBefore,
  phasisOnOrAfter,
}

