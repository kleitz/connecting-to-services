const nock = require('nock');
const cheerio = require('cheerio');
const chai = require('chai');
const chaiHttp = require('chai-http');
const server = require('../../server');
const constants = require('../../app/lib/constants');
const messages = require('../../app/lib/messages');
const getSampleResponse = require('../resources/getSampleResponse');
const iExpect = require('../lib/expectations');

const expect = chai.expect;

chai.use(chaiHttp);

describe('The results page happy paths', () => {
  after('reset env vars', () => {
    process.env.API_BASE_URL = '';
  });

  const postcode = 'AB123CD';
  const postcodeioResponse = getSampleResponse('postcodesio-responses/ls27ue.json');
  const serviceApiResponse = getSampleResponse('service-api-responses/-1,54.json');
  const resultsRoute = `${constants.SITE_ROOT}/results`;

  process.env.API_BASE_URL = 'https://dummy.url/';

  nock(process.env.API_BASE_URL)
    .get(/.*/)
    .times(4)
    .reply(200, serviceApiResponse);

  nock('https://api.postcodes.io')
    .get(/.*/)
    .times(4)
    .reply(200, postcodeioResponse);

  describe('happy paths', () => {
    describe('with no or unknown context', () => {
      it('should return 3 open results, by default', (done) => {
        chai.request(server)
          .get(resultsRoute)
          .query({ location: postcode })
          .end((err, res) => {
            iExpect.htmlWith200Status(err, res);
            const $ = cheerio.load(res.text);

            expect($('.local-header--title--question').text())
              .to.equal(`Pharmacies near to '${postcode}'`);
            // Use something that every result with have in order to count them
            const mapLinks = $('.cta-blue');
            expect(mapLinks.length).to.equal(3);
            mapLinks.toArray().forEach((link) => {
              expect($(link).attr('href')).to.have.string('https://maps.google.com');
            });
            expect($('.list-tab__link').attr('href'))
              .to.equal(`${constants.SITE_ROOT}/results?location=${postcode}&open=false&context=`);
            done();
          });
      });

      it('should return 10 results', (done) => {
        chai.request(server)
          .get(resultsRoute)
          .query({ location: postcode, open: false })
          .end((err, res) => {
            iExpect.htmlWith200Status(err, res);
            const $ = cheerio.load(res.text);

            expect($('.local-header--title--question').text())
              .to.equal(`Pharmacies near to '${postcode}'`);
            // Use something that every result with have in order to count them
            const mapLinks = $('.cta-blue');
            expect(mapLinks.length).to.equal(10);
            mapLinks.toArray().forEach((link) => {
              expect($(link).attr('href')).to.have.string('https://maps.google.com');
            });
            expect($('.list-tab__link').attr('href'))
              .to.equal(`${constants.SITE_ROOT}/results?location=${postcode}&open=true&context=`);
            done();
          });
      });
    });

    describe('with context of stomach ache', () => {
      const context = 'stomach-ache';

      it('should return 3 open results, by default', (done) => {
        chai.request(server)
          .get(resultsRoute)
          .query({ location: postcode, context })
          .end((err, res) => {
            iExpect.htmlWith200Status(err, res);
            const $ = cheerio.load(res.text);

            expect($('.local-header--title--question').text())
              .to.equal(`Pharmacies that can help you near to '${postcode}'`);
            // Use something that every result with have in order to count them
            const mapLinks = $('.cta-blue');
            expect(mapLinks.length).to.equal(3);
            mapLinks.toArray().forEach((link) => {
              expect($(link).attr('href')).to.have.string('https://maps.google.com');
            });
            const expectedHref =
              `${constants.SITE_ROOT}/results?location=${postcode}&open=false&context=${context}`;
            expect($('.list-tab__link').attr('href')).to.equal(expectedHref);
            done();
          });
      });

      it('should return 10 results', (done) => {
        chai.request(server)
          .get(resultsRoute)
          .query({ location: postcode, open: false, context: 'stomach-ache' })
          .end((err, res) => {
            iExpect.htmlWith200Status(err, res);
            const $ = cheerio.load(res.text);

            expect($('.local-header--title--question').text())
              .to.equal(`Pharmacies that can help you near to '${postcode}'`);
            // Use something that every result with have in order to count them
            const mapLinks = $('.cta-blue');
            expect(mapLinks.length).to.equal(10);
            mapLinks.toArray().forEach((link) => {
              expect($(link).attr('href')).to.have.string('https://maps.google.com');
            });
            const expectedHref =
              `${constants.SITE_ROOT}/results?location=${postcode}&open=true&context=${context}`;
            expect($('.list-tab__link').attr('href')).to.equal(expectedHref);
            done();
          });
      });
    });
  });
});

describe('The results page error handling', () => {
  describe('with a context', () => {
    const notFoundResponse = getSampleResponse('postcodesio-responses/404.json');
    const resultsRoute = `${constants.SITE_ROOT}/results`;
    const context = 'stomach-ache';

    it('should lookup a valid but unknown postcode and return an error message with the help context',
        (done) => {
          const invalidPostcodePassingRegex = 'LS0';
          const postcodesioScope =
          nock('https://api.postcodes.io')
            .get(`/outcodes/${invalidPostcodePassingRegex}`)
            .times(1)
            .reply(404, notFoundResponse);

          chai.request(server)
            .get(resultsRoute)
            .query({ location: invalidPostcodePassingRegex, context })
            .end((err, res) => {
              iExpect.htmlWith200Status(err, res);
              const $ = cheerio.load(res.text);

              expect($('.page-section').text()).to.contain('For help with');
              iExpect.findHelpPage($);
              expect(res.text).to
                .contain(messages.invalidPostcodeMessage(invalidPostcodePassingRegex));
              expect(postcodesioScope.isDone()).to.equal(true);
              done();
            });
        });

    it('should only validate the postcode and return an error message along with the help context',
        (done) => {
          const invalidPostcode = 'invalid';
          const errorMessage =
            `${invalidPostcode} is not a valid postcode, please try again`;

          chai.request(server)
            .get(resultsRoute)
            .query({ location: invalidPostcode, context })
            .end((err, res) => {
              iExpect.htmlWith200Status(err, res);
              const $ = cheerio.load(res.text);

              expect($('.page-section').text()).to.contain('For help with');
              iExpect.findHelpPage($);
              expect(res.text).to.contain(errorMessage);
              done();
            });
        });

    it('should handle an error produced by the postcode lookup and return an error message', (done) => {
      const postcode = 'AB123CD';
      const postcodesioScope =
        nock('https://api.postcodes.io')
        .get(`/postcodes/${postcode}`)
        .times(1)
        .reply(500);

      chai.request(server)
        .get(resultsRoute)
        .query({ location: postcode, context })
        .end((err, res) => {
          expect(err).to.not.be.equal(null);
          expect(res).to.have.status(500);
          // eslint-disable-next-line no-unused-expressions
          expect(res).to.be.html;

          const $ = cheerio.load(res.text);

          expect($('.page-section').text()).to.not.contain('For help with');
          expect($('.local-header--title--question').text())
            .to.contain('Sorry, we are experiencing technical problems');
          expect(postcodesioScope.isDone()).to.equal(true);
          done();
        });
    });
  });

  describe('with no context', () => {
    const notFoundResponse = getSampleResponse('postcodesio-responses/404.json');
    const resultsRoute = `${constants.SITE_ROOT}/results`;

    it('should lookup a valid but unknown postcode and return an error message with no context',
      (done) => {
        const invalidPostcodePassingRegex = 'LS0';
        const postcodesioScope =
          nock('https://api.postcodes.io')
          .get(`/outcodes/${invalidPostcodePassingRegex}`)
          .times(1)
          .reply(404, notFoundResponse);

        chai.request(server)
          .get(resultsRoute)
          .query({ location: invalidPostcodePassingRegex })
          .end((err, res) => {
            iExpect.htmlWith200Status(err, res);
            expect(res.text).to
              .contain(messages.invalidPostcodeMessage(invalidPostcodePassingRegex));
            expect(postcodesioScope.isDone()).to.equal(true);
            done();
          });
      });

    it('should only validate the postcode and return an error message', (done) => {
      const invalidPostcode = 'invalid';

      chai.request(server)
        .get(resultsRoute)
        .query({ location: invalidPostcode })
        .end((err, res) => {
          iExpect.htmlWith200Status(err, res);
          const $ = cheerio.load(res.text);

          expect($('.page-section').text()).to.not.contain('For help with');
          iExpect.findHelpPage($);
          expect(res.text).to.contain(messages.invalidPostcodeMessage(invalidPostcode));
          done();
        });
    });

    it('should handle an error produced by the postcode lookup and return an error message', (done) => {
      const postcode = 'AB123CD';
      const postcodesioScope =
        nock('https://api.postcodes.io')
        .get(`/postcodes/${postcode}`)
        .times(1)
        .reply(500);

      chai.request(server)
        .get(resultsRoute)
        .query({ location: postcode })
        .end((err, res) => {
          expect(err).to.not.be.equal(null);
          expect(res).to.have.status(500);
          // eslint-disable-next-line no-unused-expressions
          expect(res).to.be.html;

          const $ = cheerio.load(res.text);

          expect($('.page-section').text()).to.not.contain('For help with');
          expect($('.local-header--title--question').text())
            .to.contain('Sorry, we are experiencing technical problems');
          expect(postcodesioScope.isDone()).to.equal(true);
          done();
        });
    });
  });
});
