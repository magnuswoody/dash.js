import DashParser from '../../src/dash/parser/DashParser';

import ErrorHandlerMock from './mocks/ErrorHandlerMock';
const expect = require('chai').expect;

const context = {};
let dashParser = DashParser(context).create({});

describe('DashParser', function () {

    beforeEach(function () {
        if (typeof window === 'undefined') {
            global.window = {
                performance: {
                    now: function () {
                        return Date.now();
                    }
                }
            };
        }
    });

    afterEach(function () {
        delete global.window;
    });

    it('should throw an error when parse is called and config object has not been set properly', function () {
        expect(dashParser.parse.bind('')).to.be.throw('Missing config parameter(s)');
    });

    it('should throw an error when parse is called without data and config object has been set properly', function () {
        const errorHandlerMock = new ErrorHandlerMock();
        dashParser = DashParser(context).create({errorHandler: errorHandlerMock});
        dashParser.parse();
        expect(errorHandlerMock.error).to.equal('parsing the manifest failed');
    });
});