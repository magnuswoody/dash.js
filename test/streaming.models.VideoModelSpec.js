import ObjectsHelper from './helpers/ObjectsHelper';
import VideoModel from '../src/streaming/models/VideoModel';

const chai = require('chai');
const expect = chai.expect;
const sinon = require('sinon');

const context = {};
const objectsHelper = new ObjectsHelper();

describe('VideoModel', function () {
    it('should not emit a playing event if streams become unstalled whilst paused', () => {
        var playingEvent = false;
        const videoModel = VideoModel(context).getInstance();
        const mediaElement = {
            dispatchEvent: function(e) {
                if (e.type === 'playing') {
                    playingEvent = true;
                }
            },
            paused: true
        };
        
        videoModel.initialize();
        videoModel.setElement(mediaElement);
        videoModel.setStallState('video', true);
        videoModel.setStallState('video', false);

        expect(playingEvent).to.not.be.ok; // jshint ignore:line
    });
});
