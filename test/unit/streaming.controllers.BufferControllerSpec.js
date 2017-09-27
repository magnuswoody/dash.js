import ObjectUtils from '../../src/streaming/utils/ObjectUtils';
import BufferController from '../../src/streaming/controllers/BufferController';
import MetricsModel from '../../src/streaming/models/MetricsModel';
import ErrorHandler from '../../src/streaming/utils/ErrorHandler';
import StreamController from '../../src/streaming/controllers/StreamController';
import MediaController from '../../src/streaming/controllers/MediaController';
import TextController from '../../src/streaming/text/TextController';
import AbrController from '../../src/streaming/controllers/AbrController';
import EventBus from '../../src/core/EventBus';
import Events from '../../src/core/events/Events';
import InitCache from '../../src/streaming/utils/InitCache';
import Debug from '../../src/core/Debug';

import StreamControllerMock from './mocks/StreamControllerMock';
import SourceBufferSinkMock from './mocks/SourceBufferSinkMock';
import PlaybackControllerMock from './mocks/PlaybackControllerMock';
import StreamProcessorMock from './mocks/StreamProcessorMock';
import MetricsModelMock from './mocks/MetricsModelMock';
import AdapterMock from './mocks/AdapterMock';

const chai = require('chai');
const expect = chai.expect;

const context = {};
const testType = 'video';
const streamInfo = {
    id: 'id'
};
const eventBus = EventBus(context).getInstance();
const objectUtils = ObjectUtils(context).getInstance();
const initCache = InitCache(context).getInstance();

describe("BufferController", function () {

    // disable log

    let debug = Debug(context).getInstance();
    debug.setLogToBrowserConsole(false);
    let streamProcessor = new StreamProcessorMock(testType, streamInfo);
    let streamControllerMock = new StreamControllerMock();
    let adapterMock = new AdapterMock();
    let metricsModelMock = new MetricsModelMock();
    let playbackControllerMock = new PlaybackControllerMock();

    let bufferController;

    beforeEach(function () {

        bufferController = BufferController(context).create({
            metricsModel: metricsModelMock,
            errHandler: ErrorHandler(context).getInstance(),
            streamController: streamControllerMock,
            mediaController: MediaController(context).getInstance(),
            adapter: adapterMock,
            textController: TextController(context).getInstance(),
            abrController: AbrController(context).getInstance(),
            streamProcessor: streamProcessor,
            type: testType,
            playbackController: playbackControllerMock
        });
    });

    afterEach(function () {
        bufferController = null;
        streamProcessor.reset();
        sourceBufferMock.reset(testType);
    });

    describe('Method initialize', function () {
        it('should initialize the controller', function () {

            expect(bufferController.getType()).to.equal(testType);
            bufferController.initialize({});

        });
    })

    describe('Method createBuffer', function () {
        it('should not create a sourceBuffer if controller is not initialized', function () {

            let buffer = bufferController.createBuffer('mediaInfos');
            expect(buffer).to.not.exist;
        });

        it('should not create a sourceBuffer if controller is initialized with incorrect mediaSource', function () {
            bufferController.initialize(null);
            let buffer = bufferController.createBuffer('mediaInfos');
            expect(buffer).to.not.exist;
        });

        it('should create a sourceBuffer and initialize it', function () {
            bufferController.initialize({});
            let buffer = bufferController.createBuffer('mediaInfos');
            expect(buffer).to.exist;
            expect(buffer.timestampOffset).to.equal(1);
        });
    });

    describe('Method getStreamProcessor', function () {
        it('should return configured stream processor', function () {
            let configuredSP = bufferController.getStreamProcessor();
            expect(objectUtils.areEqual(configuredSP, streamProcessor)).to.be.true;
        });
    });

    describe('Methods get/set Buffer', function () {
        it('should update buffer', function () {
            let buffer = 'testBuffer';
            bufferController.setBuffer(buffer);
            expect(bufferController.getBuffer()).to.equal(buffer);
        });
    });

    describe('Methods get/set Media Source', function () {
        it('should update media source', function () {
            let mediaSource = 'test';
            bufferController.setMediaSource(mediaSource);
            expect(bufferController.getMediaSource()).to.equal(mediaSource);
        });
    });

    describe('Method switchInitData', function () {
        it('should append init data to source buffer if data have been cached', function () {
            let chunk = {
                bytes: 'initData',
                quality: 2,
                mediaInfo: {
                    type: 'video'
                },
                streamId: 'streamId',
                representationId: 'representationId'
            };

            initCache.save(chunk);

            bufferController.initialize({});
            bufferController.switchInitData('streamId', 'representationId');
            expect(sourceBufferMock.buffer.bytes).to.equal(chunk.bytes);
        });

        it('should trigger INIT_REQUESTED if no init data is cached', function (done) {

            // reset cache
            initCache.reset();

            bufferController.initialize({});
            let onInitRequest = function () {
                eventBus.off(Events.INIT_REQUESTED, onInitRequest);
                done();
            }
            eventBus.on(Events.INIT_REQUESTED, onInitRequest, this);

            bufferController.switchInitData('streamId', 'representationId');
        });
    });

    describe('Method reset', function () {
        it('should reset buffer controller', function () {
            let buffer = 'testBuffer';
            bufferController.setBuffer(buffer);
            expect(bufferController.getBuffer()).to.equal(buffer);

            bufferController.reset();
            expect(sourceBufferMock.aborted).to.be.true;
            expect(sourceBufferMock.sourceBufferRemoved).to.be.true;
            expect(bufferController.getBuffer()).to.not.exist;
        });
    });

    describe('Event INIT_FRAGMENT_LOADED handler', function () {
        it('should not append data to source buffer if wrong fragment model', function (done) {

            let event = {
                fragmentModel: 'wrongFragmentModel',
                chunk: {
                    bytes: 'initData',
                    quality: 2,
                    mediaInfo: {
                        type: 'video'
                    },
                    streamId: 'streamId',
                    representationId: 'representationId'
                }
            }
            let onInitDataLoaded = function () {
                eventBus.off(Events.INIT_FRAGMENT_LOADED, onInitDataLoaded);
                expect(sourceBufferMock.buffer.bytes).to.be.undefined;
                done();
            }
            eventBus.on(Events.INIT_FRAGMENT_LOADED, onInitDataLoaded, this);

            expect(sourceBufferMock.buffer.bytes).to.be.undefined;
            // send event
            eventBus.trigger(Events.INIT_FRAGMENT_LOADED, event)
        });

        it('should append data to source buffer ', function (done) {

            let event = {
                fragmentModel: streamProcessor.getFragmentModel(),
                chunk: {
                    bytes: 'initData',
                    quality: 2,
                    mediaInfo: {
                        type: 'video'
                    },
                    streamId: 'streamId',
                    representationId: 'representationId'
                }
            }
            let onInitDataLoaded = function () {
                eventBus.off(Events.INIT_FRAGMENT_LOADED, onInitDataLoaded);
                expect(sourceBufferMock.buffer.bytes).to.equal(event.chunk.bytes);
                done();
            }
            eventBus.on(Events.INIT_FRAGMENT_LOADED, onInitDataLoaded, this);

            expect(sourceBufferMock.buffer.bytes).to.be.undefined;
            // send event
            eventBus.trigger(Events.INIT_FRAGMENT_LOADED, event)
        });

        it('should save init data into cache', function (done) {

            let chunk = {
                bytes: 'initData',
                quality: 2,
                mediaInfo: {
                    type: 'video'
                },
                streamId: 'streamId',
                representationId: 'representationId'
            }
            let event = {
                fragmentModel: streamProcessor.getFragmentModel(),
                chunk: chunk
            }

            initCache.reset();
            let cache = initCache.extract(chunk.streamId, chunk.representationId);
            let onInitDataLoaded = function () {
                eventBus.off(Events.INIT_FRAGMENT_LOADED, onInitDataLoaded);

                // check initCache
                cache = initCache.extract(chunk.streamId, chunk.representationId);
                expect(cache.bytes).to.equal(chunk.bytes);
                done();
            }
            eventBus.on(Events.INIT_FRAGMENT_LOADED, onInitDataLoaded, this);

            expect(cache).to.not.exist;
            // send event
            eventBus.trigger(Events.INIT_FRAGMENT_LOADED, event)
        });
    });
    describe('Event MEDIA_FRAGMENT_LOADED handler', function () {
        it('should not append data to source buffer if wrong fragment model', function (done) {

            let event = {
                fragmentModel: 'wrongFragmentModel',
                chunk: {
                    bytes: 'data',
                    quality: 2,
                    mediaInfo: {
                        type: 'video'
                    },
                    streamId: 'streamId',
                    representationId: 'representationId'
                }
            }
            let onMediaFragmentLoaded = function () {
                eventBus.off(Events.MEDIA_FRAGMENT_LOADED, onMediaFragmentLoaded);
                expect(sourceBufferMock.buffer.bytes).to.be.undefined;
                done();
            }
            eventBus.on(Events.MEDIA_FRAGMENT_LOADED, onMediaFragmentLoaded, this);

            expect(sourceBufferMock.buffer.bytes).to.be.undefined;
            // send event
            eventBus.trigger(Events.MEDIA_FRAGMENT_LOADED, event)
        });

        it('should append data to source buffer ', function (done) {

            let event = {
                fragmentModel: streamProcessor.getFragmentModel(),
                chunk: {
                    bytes: 'data',
                    quality: 2,
                    mediaInfo: 'video'
                }
            }
            let onMediaFragmentLoaded = function () {
                eventBus.off(Events.MEDIA_FRAGMENT_LOADED, onMediaFragmentLoaded);
                expect(sourceBufferMock.buffer.bytes).to.equal(event.chunk.bytes);
                done();
            }
            eventBus.on(Events.MEDIA_FRAGMENT_LOADED, onMediaFragmentLoaded, this);

            expect(sourceBufferMock.buffer.bytes).to.be.undefined
            // send event
            eventBus.trigger(Events.MEDIA_FRAGMENT_LOADED, event)
        });

        it('should trigger VIDEO_CHUNK_RECEIVED if event is video', function (done) {

            let event = {
                fragmentModel: streamProcessor.getFragmentModel(),
                chunk: {
                    bytes: 'data',
                    quality: 2,
                    mediaInfo: {
                        type: 'video'
                    }
                }
            }
            let onVideoChunk = function () {
                eventBus.off(Events.VIDEO_CHUNK_RECEIVED, onVideoChunk);
                done();
            }
            eventBus.on(Events.VIDEO_CHUNK_RECEIVED, onVideoChunk, this);

            // send event
            eventBus.trigger(Events.MEDIA_FRAGMENT_LOADED, event)
        });
    });

    describe('Event MEDIA_FRAGMENT_LOADED handler', function () {
        it('should not update buffer timestamp offset - wrong stream processor id', function (done) {

            // init test
            bufferController.initialize({});
            let buffer = bufferController.createBuffer('mediaInfos');
            expect(buffer).to.exist;
            expect(buffer.timestampOffset).to.equal(1);

            let event = {
                newQuality : 2,
                mediaType : testType,
                streamInfo: {
                    id : 'wrongid'
                }
            }
            let onQualityChanged = function () {
                eventBus.off(Events.QUALITY_CHANGE_REQUESTED, onQualityChanged, this);

                expect(buffer.timestampOffset).to.equal(1);
                done();
            }
            eventBus.on(Events.QUALITY_CHANGE_REQUESTED, onQualityChanged, this);

            // send event
            eventBus.trigger(Events.QUALITY_CHANGE_REQUESTED, event)
        });

        it('should not update buffer timestamp offset - wrong media type', function (done) {

            // init test
            bufferController.initialize({});
            let buffer = bufferController.createBuffer('mediaInfos');
            expect(buffer).to.exist;
            expect(buffer.timestampOffset).to.equal(1);

            let event = {
                newQuality : 2,
                mediaType : 'wrongMediaType',
                streamInfo: {
                    id : streamProcessor.getStreamInfo().id
                }
            }
            let onQualityChanged = function () {
                eventBus.off(Events.QUALITY_CHANGE_REQUESTED, onQualityChanged, this);

                expect(buffer.timestampOffset).to.equal(1);
                done();
            }
            eventBus.on(Events.QUALITY_CHANGE_REQUESTED, onQualityChanged, this);

            // send event
            eventBus.trigger(Events.QUALITY_CHANGE_REQUESTED, event)
        });

        it('should not update buffer timestamp offset - wrong quality', function (done) {
            // init test
            bufferController.initialize({});
            let buffer = bufferController.createBuffer('mediaInfos');
            expect(buffer).to.exist;
            expect(buffer.timestampOffset).to.equal(1);

            let event = {
                newQuality : 0,
                mediaType : testType,
                streamInfo: {
                    id : streamProcessor.getStreamInfo().id
                }
            }
            let onQualityChanged = function () {
                eventBus.off(Events.QUALITY_CHANGE_REQUESTED, onQualityChanged, this);

                expect(buffer.timestampOffset).to.equal(1);
                done();
            }
            eventBus.on(Events.QUALITY_CHANGE_REQUESTED, onQualityChanged, this);

            // send event
            eventBus.trigger(Events.QUALITY_CHANGE_REQUESTED, event)
        });

        it('should update buffer timestamp offset', function (done) {

            // init test
            bufferController.initialize({});
            let buffer = bufferController.createBuffer('mediaInfos');
            expect(buffer).to.exist;
            expect(buffer.timestampOffset).to.equal(1);

            let event = {
                newQuality : 2,
                mediaType : testType,
                streamInfo: {
                    id : streamProcessor.getStreamInfo().id
                }
            }
            let onQualityChanged = function () {
                eventBus.off(Events.QUALITY_CHANGE_REQUESTED, onQualityChanged, this);

                expect(buffer.timestampOffset).to.equal(2);
                done();
            }
            eventBus.on(Events.QUALITY_CHANGE_REQUESTED, onQualityChanged, this);

            // send event
            eventBus.trigger(Events.QUALITY_CHANGE_REQUESTED, event)
        });
    });

    describe('Event PLAYBACK_SEEKING handler', function () {
        it('should trigger BUFFER_LEVEL_UPDATED event', function (done) {

            // init test
            bufferController.initialize({});
            let buffer = bufferController.createBuffer('mediaInfos');
            expect(buffer).to.exist;

            let onBufferLevelUpdated = function (e) {
                eventBus.off(Events.BUFFER_LEVEL_UPDATED, onBufferLevelUpdated, this);
                expect(e.bufferLevel).to.equal(sourceBufferMock.getBufferLength());

                done();
            }
            eventBus.on(Events.BUFFER_LEVEL_UPDATED, onBufferLevelUpdated, this);

            // send event
            eventBus.trigger(Events.PLAYBACK_SEEKING)
        });

        it('should trigger BUFFER_LEVEL_STATE_CHANGED event', function (done) {

            // init test
            bufferController.initialize({});
            let buffer = bufferController.createBuffer('mediaInfos');
            expect(buffer).to.exist;

            let onBufferStateChanged = function (e) {
                eventBus.off(Events.BUFFER_LEVEL_STATE_CHANGED, onBufferStateChanged, this);
                expect(e.state).to.equal('bufferLoaded');

                done();
            }
            eventBus.on(Events.BUFFER_LEVEL_STATE_CHANGED, onBufferStateChanged, this);

            // send event
            eventBus.trigger(Events.PLAYBACK_SEEKING)
        });

        it('should trigger BUFFER_LOADED event if enough buffer', function (done) {

            // init test
            bufferController.initialize({});
            let buffer = bufferController.createBuffer('mediaInfos');
            expect(buffer).to.exist;

            let onBufferLoaded = function (e) {
                eventBus.off(Events.BUFFER_LOADED, onBufferLoaded, this);
                done();
            }
            eventBus.on(Events.BUFFER_LOADED, onBufferLoaded, this);

            // send event
            eventBus.trigger(Events.PLAYBACK_SEEKING)
        });
    });
   /* 
    describe('Method getTotalBufferedTime', function () {
        let buffer;
        beforeEach(function () {
            let mediaInfo = {
                codec: 'video/webm; codecs="vp8, vorbis"'
            };

            let mediaSource = new MediaSourceMock();
            
            buffer = SourceBufferSink(context).create(mediaSource, mediaInfo);
            expect(mediaSource.buffers).to.have.lengthOf(1);
        });

        it('should return 0 if no buffer', function () {

            let totalBufferedTime = sourceBufferController.getTotalBufferedTime(buffer);
            expect(totalBufferedTime).to.equal(0);
        });

        it('should return totalBufferedTime ', function () {

            buffer.addRange({
                start: 2,
                end: 5
            });
            buffer.addRange({
                start: 8,
                end: 9
            });
            let totalBufferedTime = sourceBufferController.getTotalBufferedTime(buffer);
            expect(totalBufferedTime).to.equal(4);
        });
    });

    describe('Method getBufferLength', function () {
        let buffer;
        beforeEach(function () {
            let mediaInfo = {
                codec: 'video/webm; codecs="vp8, vorbis"'
            };

            let mediaSource = new MediaSourceMock();
            buffer = SourceBufferSink(context).create(mediaSource, mediaInfo);
            expect(mediaSource.buffers).to.have.lengthOf(1);
        });

        it('should return 0 if no buffer', function () {

            let totalBufferedLength = sourceBufferController.getBufferLength(buffer, 10);
            expect(totalBufferedLength).to.equal(0);
        });

        it('should return 0 if no data buffered in time', function () {

            buffer.addRange({
                start: 2,
                end: 5
            });
            let totalBufferedLength = sourceBufferController.getBufferLength(buffer, 10);
            expect(totalBufferedLength).to.equal(0);
        });

        it('should return buffer length ', function () {

            buffer.addRange({
                start: 2,
                end: 5
            });
            buffer.addRange({
                start: 8,
                end: 9
            });

            buffer.addRange({
                start: 9,
                end: 11
            });
            let totalBufferedLength = sourceBufferController.getBufferLength(buffer, 10);
            expect(totalBufferedLength).to.equal(1);
        });
    });
    */

    describe('Method getBufferRange', function () {
        let buffer;
        beforeEach(function () {
            let mediaInfo = {
                codec: 'video/webm; codecs="vp8, vorbis"'
            };

            let mediaSource = new MediaSourceMock();
            sourceBufferSink = SourceBufferSink(context).create(mediaSource, mediaInfo);
            expect(mediaSource.buffers).to.have.lengthOf(1);
            buffer = mediaSource.buffers[0];
        });

        it('should return range of buffered data', function () {
            buffer.addRange({
                start: 2,
                end: 5
            });
            buffer.addRange({
                start: 8,
                end: 9
            });
            buffer.addRange({
                start: 9,
                end: 11
            });
            let range = sourceBufferSink.getBufferRange(buffer, 10);
            expect(range.start).to.equal(9);
            expect(range.end).to.equal(11);
        });

        it('should return range of buffered data - small discontinuity', function () {
            buffer.addRange({
                start: 2,
                end: 5
            });
            buffer.addRange({
                start: 8,
                end: 9
            });
            buffer.addRange({
                start: 9,
                end: 10.05
            });
            buffer.addRange({
                start: 10.1,
                end: 11
            });
            let range = sourceBufferController.getBufferRange(buffer, 10);
            expect(range.start).to.equal(9);
            expect(range.end).to.equal(11);
        });

        it('should return null - time not in range', function () {
            buffer.addRange({
                start: 2,
                end: 5
            });
            buffer.addRange({
                start: 8,
                end: 9
            });
            buffer.addRange({
                start: 9,
                end: 9.5
            });
            buffer.addRange({
                start: 10.5,
                end: 11
            });
            let range = sourceBufferController.getBufferRange(buffer, 10);
            expect(range).to.be.null;
        });

        it('should return range of buffered data - time not in range (little gap)', function () {
            buffer.addRange({
                start: 2,
                end: 5
            });
            buffer.addRange({
                start: 8,
                end: 9
            });
            buffer.addRange({
                start: 9,
                end: 9.9
            });
            buffer.addRange({
                start: 10.1,
                end: 11
            });
            let range = sourceBufferController.getBufferRange(buffer, 10);
            expect(range.start).to.equal(10.1);
            expect(range.end).to.equal(11);
        });
    });

});
