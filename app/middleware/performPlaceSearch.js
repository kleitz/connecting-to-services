const log = require('../lib/logger');
const locate = require('../lib/locate');
const placeHelper = require('../lib/placeHelper');
const getAddress = require('../lib/getAddress');
const renderer = require('./renderer');
const createPlaceViewModel = require('./createPlaceViewModel');
const placeDisambiguationViews = require('../lib/promCounters').placeDisambiguationViews;
const zeroPlaceResultsViews = require('../lib/promCounters').zeroPlaceResultsViews;

const maxResults = 10;

function englandFilter(place) {
  return place.country === 'England';
}

function logZeroResults(places, location) {
  if (places.length === 0) {
    log.warn({ location }, `No results were found for ${location}`);
    zeroPlaceResultsViews.inc(1);
  }
}

function incrementDisambiguationViews(places) {
  if (places.length > 0) {
    placeDisambiguationViews.inc(1);
  }
}

function getCoordinates(place) {
  return {
    latitude: place.latitude,
    longitude: place.longitude
  };
}

async function getPlaces(req, res, next) {
  const location = res.locals.location;
  try {
    const allPlaces = await locate.byPlace(location, 100);
    res.locals.countries = placeHelper.getCountries(allPlaces);
    const places = placeHelper.sortPlace(allPlaces.filter(englandFilter)).slice(0, maxResults);
    logZeroResults(places, location);
    if (places.length === 1) {
      res.locals.coordinates = getCoordinates(places[0]);
      res.locals.location = getAddress(places[0]);
      next();
    } else {
      incrementDisambiguationViews(places);
      res.locals.places = createPlaceViewModel(places);
      renderer.places(req, res);
    }
  } catch (e) {
    log.error({ placeLookupResponse: { error: e } }, 'Place lookup error');
    next({ type: 'place-lookup-error', message: e.message });
  }
}

module.exports = getPlaces;
