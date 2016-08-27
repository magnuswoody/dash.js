import ObjectsHelper from './helpers/ObjectsHelper';
import VoHelper from './helpers/VOHelper';
import MPDfiles from './helpers/MPDfiles';

import SegmentsGetter from '../src/dash/utils/SegmentsGetter';
import DashParser from '../src/dash/parser/DashParser';
import DashManifestModel from '../src/dash/models/DashManifestModel';
import TimelineConverter from '../src/dash/utils/TimelineConverter';

const expect = require('chai').expect;
const DOMParser = require('xmldom').DOMParser;
const sinon = require('sinon');

describe('SegmentsGetter', function () {
    const objectsHelper = new ObjectsHelper();
    const voHelper = new VoHelper();
    var clock;

    const createSegmentsGetter = (isDynamic) => {
        const context = {};
        const config = {
            timelineConverter: createTimelineConverter()
        };

        return SegmentsGetter(context).create(config, !!isDynamic);
    };

    const createDashParser = () => {
        const context = {};

        return DashParser(context).create();
    };

    const createDashManifestModel = () => {
        return DashManifestModel({}).getInstance();
    };

    const createTimelineConverter = () => {
        const timelineConverter = TimelineConverter({}).getInstance();
        timelineConverter.initialize();
        return timelineConverter;
    };

    const parseManifest = xmlStr => {
        const manifest = createDashParser().parse(xmlStr, objectsHelper.getDummyXlinkController());
        manifest.loadedTime = {getTime: () => (new Date()).getTime()};
        return manifest;
    };

    const getResourcesForSegmentGettingFromManifest = mpdStr => {
        const model = createDashManifestModel();
        const timelineConverter = createTimelineConverter();
        const manifest = parseManifest(mpdStr);
        const mpd = model.getMpd(manifest);
        const period = model.getRegularPeriods(manifest, mpd)[0];
        const adaptationIndex = model.getIndexForAdaptation(model.getAdaptationForType(manifest, 0, 'video'), manifest, period.index);
        const adaptationSet = model.getAdaptationsForPeriod(manifest, period)[adaptationIndex];
        const representations = model.getRepresentationsForAdaptation(manifest, adaptationSet);
        const representation = representations[representations.length - 1];

        return {
            representation: representation,
            segmentsGetter: createSegmentsGetter(model.getIsDynamic(manifest))
        };
    };

    beforeEach(() => {
        global.window = {
            DOMParser: DOMParser
        };
        clock = sinon.useFakeTimers(new Date().getTime());
    });

    afterEach(() => {
        clock.restore();
    });

    it('should not regenerate segments for a static MPD if they are already there', () => {
        const segmentsGetter = createSegmentsGetter(false);
        const representation = voHelper.createRepresentation('audio');
        const callback = (representation, segments) => {
            assert.fail('Segment list should not have updated.');
        };

        representation.segments = [ voHelper.createSegment(0), voHelper.createSegment(1) ];

        const segments = segmentsGetter.getSegments(representation, null, null, callback, null);

        expect(segments[0]).to.deep.equal(voHelper.createSegment(0));
        expect(segments[1]).to.deep.equal(voHelper.createSegment(1));
        expect(segments.length).to.equal(2);
    });

    it('should calculate the correct number of segments for an ondemand SegmentTemplate manifest', (done) => {
        const args = getResourcesForSegmentGettingFromManifest(MPDfiles.bbcrdtestcard);

        args.segmentsGetter.getSegments(args.representation, 0, 0, (representation, segments) => {
            expect(segments.length).to.equal(938);
            done();
        });
    });

    it('should calculate the correct range for a dynamic SegmentTemplate mpd, adding/removing as appropriate', (done) => {
        const args = getResourcesForSegmentGettingFromManifest(MPDfiles.bbcone);

        args.segmentsGetter.getSegments(args.representation, 0, 0, (representation, segments) => {
            var firstTickFirstSegmentIdx = segments[0].availabilityIdx;
            var firstTickLastSegmentIdx = segments[segments.length - 1].availabilityIdx;
            expect(segments.length).to.equal(900);

            clock.tick(8000);

            args.segmentsGetter.getSegments(args.representation, 0, 0, (representation, segments) => {
                expect(segments.length).to.equal(900);
                expect(segments[0].availabilityIdx).to.equal(firstTickFirstSegmentIdx + 1);
                expect(segments[segments.length - 1].availabilityIdx).to.equal(firstTickLastSegmentIdx + 1);

                done();
            });
        });
    });
});
