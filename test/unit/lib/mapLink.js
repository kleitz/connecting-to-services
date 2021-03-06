require('object.values').shim();
const qs = require('querystring');
const chai = require('chai');

const mapLink = require('../../../app/lib/mapLink');
const constants = require('../../../app/lib/constants');

const expect = chai.expect;

describe('mapLink', () => {
  describe('addUrl', () => {
    const searchTerm = 'some place';
    const coordinates = { latitude: 52.4, longitude: -1.9 };
    const searchCriteria = { searchTerm, coordinates };

    it(
      'should add an additional property to all items in the input list with the google maps Url',
      () => {
        const nameOne = 'place name one';
        const nameTwo = 'place name two';
        const address = {
          line1: 'line1',
          line2: 'line2',
          line3: 'line3',
          city: 'city',
          county: 'county',
          postcode: 'AB12 3CD',
        };
        const inputList = [{
          name: nameOne,
          address,
        },
        {
          name: nameTwo,
          address,
        }];

        const start = `saddr=${qs.escape(searchTerm)}`;
        const nameAndAddressOne = `${nameOne},${Object.values(address).join()}`;
        const nameAndAddressOneEncoded = qs.escape(nameAndAddressOne);
        const destinationOne = `daddr=${nameAndAddressOneEncoded}`;
        const nearOne = `near=${nameAndAddressOneEncoded}`;
        const nameAndAddressTwo = `${nameTwo},${Object.values(address).join()}`;
        const nameAndAddressTwoEncoded = qs.escape(nameAndAddressTwo);
        const destinationTwo = `daddr=${nameAndAddressTwoEncoded}`;
        const nearTwo = `near=${nameAndAddressTwoEncoded}`;
        const encodedQueryOne = `${start}&${destinationOne}&${nearOne}`;
        const encodedQueryTwo = `${start}&${destinationTwo}&${nearTwo}`;
        const expectedMapLinkOne = `https://maps.google.com/maps?${encodedQueryOne}`;
        const expectedMapLinkTwo = `https://maps.google.com/maps?${encodedQueryTwo}`;

        const results = mapLink.addUrl(searchCriteria, inputList);

        expect(results).to.not.be.undefined;
        expect(results).to.be.an('array');
        expect(results.length).to.be.equal(2);
        expect(results[0].mapUrl).to.be.equal(expectedMapLinkOne);
        expect(results[1].mapUrl).to.be.equal(expectedMapLinkTwo);
      }
    );

    it('should remove any empty, null or undefined address properties', () => {
      const inputList = [{
        name: 'name',
        address: {
          line1: 'line1',
          line2: '',
          line3: null,
          city: '',
          county: undefined,
          postcode: 'AB12 3CD',
        },
      }];

      const destination = 'name,line1,AB12 3CD';
      const encodedQuery = `saddr=${qs.escape(searchTerm)}&daddr=${qs.escape(destination)}&near=${qs.escape(destination)}`;
      const expectedMapLink = `https://maps.google.com/maps?${encodedQuery}`;

      const results = mapLink.addUrl(searchCriteria, inputList);

      expect(results).to.not.be.undefined;
      expect(results).to.not.be.equal(undefined);
      expect(results).to.be.an('array');
      expect(results.length).to.be.equal(1);
      expect(results[0].mapUrl).to.be.equal(expectedMapLink);
    });

    it('should use coordinates for \'your location\' searches', () => {
      const yourLocationSearchCriteria = {
        coordinates,
        searchTerm,
        searchType: constants.yourLocationSearch,
      };
      const inputList = [{
        name: 'name',
        address: {
          line1: 'line1',
        },
      }];
      const destination = 'name,line1';
      const params = {
        saddr: `${coordinates.latitude},${coordinates.longitude}`,
        daddr: `${destination}`,
        near: `${destination}`,
      };
      const expectedMapLink = `https://maps.google.com/maps?${qs.stringify(params)}`;

      const results = mapLink.addUrl(yourLocationSearchCriteria, inputList);

      expect(results.length).to.be.equal(1);
      expect(results[0].mapUrl).to.be.equal(expectedMapLink);
    });
  });
});
