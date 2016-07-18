import ObjectsHelper from './helpers/ObjectsHelper';
import VoHelper from './helpers/VOHelper';
import SegmentsGetter from '../src/dash/utils/SegmentsGetter';

const expect = require('chai').expect;

describe('SegmentsGetter', function () {
    const objectsHelper = new ObjectsHelper();
    const voHelper = new VoHelper();
    const createSegmentsGetter = (isDynamic) => {
        const context = {};
        const config = {};

        return SegmentsGetter(context).create(config, !!isDynamic);
    };

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
});
