const chai = require('chai');
const chaiHttp = require('chai-http');
const cheerio = require('cheerio');
const nock = require('nock');
const server = require('../../server');
const constants = require('../../app/lib/constants');
const getSampleResponse = require('../resources/getSampleResponse');
const iExpect = require('../lib/expectations');

const expect = chai.expect;

chai.use(chaiHttp);

const resultsRoute = `${constants.SITE_ROOT}/results`;
const numberOfOpenResults = constants.numberOfOpenResults;
const numberOfNearbyResults = constants.numberOfNearbyResultsToRequest;

describe('The place results page', () => {
  it('should return list of pharmacies for unique place search', (done) => {
    const singlePlaceResponse = getSampleResponse('postcodesio-responses/singlePlaceResult.json');
    const serviceApiResponse = getSampleResponse('service-api-responses/-1,54.json');
    const singleResult = JSON.parse(singlePlaceResponse).result;
    const latitude = singleResult[0].latitude;
    const longitude = singleResult[0].longitude;

    nock('https://api.postcodes.io')
      .get('/places?q=oneresult&limit=100')
      .times(1)
      .reply(200, singlePlaceResponse);

    nock(process.env.API_BASE_URL)
      .get(`/nearby?latitude=${latitude}&longitude=${longitude}&limits:results:open=${numberOfOpenResults}&limits:results:nearby=${numberOfNearbyResults}`)
      .times(1)
      .reply(200, serviceApiResponse);

    chai.request(server)
      .get(resultsRoute)
      .query({ location: 'oneresult' })
      .end((err, res) => {
        iExpect.htmlWith200Status(err, res);
        const $ = cheerio.load(res.text);

        expect($('.results__header--nearest').text())
          .to.equal('Nearest open pharmacy to Midsomer Norton');

        expect($('.results__header--nearby').text())
          .to.equal('Other pharmacies nearby');

        const openResults = $('.results__details-nearest .results__maplink');
        expect(openResults.length).to.equal(1);

        const nearbyResults = $('.results__item--nearby');
        expect(nearbyResults.length).to.equal(constants.numberOfNearbyResultsToDisplay);

        const mapLinks = $('.results__maplink');
        mapLinks.toArray().forEach((link) => {
          expect($(link).attr('href')).to.have.string('https://maps.google.com');
        });

        const ChoicesOverviewLinks = $('.overview a');
        ChoicesOverviewLinks.toArray().forEach((link) => {
          expect($(link).attr('href')).to.have.string('https://www.nhs.uk/Services/pharmacies/Overview/DefaultView.aspx');
        });
        expect(ChoicesOverviewLinks.length).to.equal(constants.numberOfNearbyResultsToDisplay + 1);

        expect($('.link-back').text()).to.equal('Back to find a pharmacy');
        expect($('.link-back').attr('href')).to.equal(`${constants.SITE_ROOT}/`);
        expect($('title').text()).to.equal('Pharmacies near Midsomer Norton - NHS.UK');
        done();
      });
  });

  it('should return disambiguation page for non unique place search', (done) => {
    const multiPlaceResponse = getSampleResponse('postcodesio-responses/multiplePlaceResult.json');
    const multiPlaceTerm = 'multiresult';
    nock('https://api.postcodes.io')
      .get(`/places?q=${multiPlaceTerm}&limit=100`)
      .times(1)
      .reply(200, multiPlaceResponse);

    chai.request(server)
      .get(resultsRoute)
      .query({ location: multiPlaceTerm })
      .end((err, res) => {
        iExpect.htmlWith200Status(err, res);
        const $ = cheerio.load(res.text);

        expect($('.results__header').text())
          .to.include(`We found 3 places that match '${multiPlaceTerm}'`);

        expect($('.link-back').text()).to.equal('Back to find a pharmacy');
        expect($('.link-back').attr('href')).to.equal(`${constants.SITE_ROOT}/`);
        expect($('title').text()).to.equal('Places disambiguation - NHS.UK');

        done();
      });
  });

  function expectSearchAgainPage($) {
    expect($('.error-summary-heading').text())
      .to.contain('You must enter a town, city or postcode to find a pharmacy.');
  }

  it('should return search page for empty search', (done) => {
    chai.request(server)
      .get(resultsRoute)
      .query({ location: '' })
      .end((err, res) => {
        iExpect.htmlWith200Status(err, res);
        const $ = cheerio.load(res.text);
        expectSearchAgainPage($);
        expect($('title').text()).to.equal('Find a pharmacy - We can\'t find the postcode \'\' - NHS.UK');

        done();
      });
  });

  it('should return no results page for unknown place search', (done) => {
    const noResultsTerm = 'noresults';
    nock('https://api.postcodes.io')
      .get(`/places?q=${noResultsTerm}&limit=100`)
      .times(1)
      .reply(200, { status: 200, result: [] });

    chai.request(server)
      .get(resultsRoute)
      .query({ location: noResultsTerm })
      .end((err, res) => {
        iExpect.htmlWith200Status(err, res);
        const $ = cheerio.load(res.text);
        expect($('.results__header--none').text()).to.be.equal(`We can't find '${noResultsTerm}'`);
        done();
      });
  });

  it('should return search page for non-alphanumeric search', (done) => {
    chai.request(server)
      .get(resultsRoute)
      .query({ location: '!@£$%' })
      .end((err, res) => {
        iExpect.htmlWith200Status(err, res);
        const $ = cheerio.load(res.text);
        expectSearchAgainPage($);
        expect($('title').text()).to.equal('Find a pharmacy - We can\'t find the postcode \'!@£$%\' - NHS.UK');

        done();
      });
  });
});
