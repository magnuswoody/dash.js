/**
 * The copyright in this software is being made available under the BSD License,
 * included below. This software may be subject to other third party and contributor
 * rights, including patent rights, and no such rights are granted under this license.
 *
 * Copyright (c) 2013, Dash Industry Forum.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification,
 * are permitted provided that the following conditions are met:
 *  * Redistributions of source code must retain the above copyright notice, this
 *  list of conditions and the following disclaimer.
 *  * Redistributions in binary form must reproduce the above copyright notice,
 *  this list of conditions and the following disclaimer in the documentation and/or
 *  other materials provided with the distribution.
 *  * Neither the name of Dash Industry Forum nor the names of its
 *  contributors may be used to endorse or promote products derived from this software
 *  without specific prior written permission.
 *
 *  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS AS IS AND ANY
 *  EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 *  WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.
 *  IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT,
 *  INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT
 *  NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 *  PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
 *  WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 *  ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 *  POSSIBILITY OF SUCH DAMAGE.
 */
import Constants from './constants/Constants';
import MetricsConstants from './constants/MetricsConstants';
import PlaybackController from './controllers/PlaybackController';
import StreamController from './controllers/StreamController';
import MediaController from './controllers/MediaController';
import BaseURLController from './controllers/BaseURLController';
import ManifestLoader from './ManifestLoader';
import ErrorHandler from './utils/ErrorHandler';
import Capabilities from './utils/Capabilities';
import TextTracks from './text/TextTracks';
import RequestModifier from './utils/RequestModifier';
import TextController from './text/TextController';
import URIFragmentModel from './models/URIFragmentModel';
import ManifestModel from './models/ManifestModel';
import MediaPlayerModel from './models/MediaPlayerModel';
import MetricsModel from './models/MetricsModel';
import AbrController from './controllers/AbrController';
import VideoModel from './models/VideoModel';
import DOMStorage from './utils/DOMStorage';
import Debug from './../core/Debug';
import Errors from './../core/errors/Errors';
import EventBus from './../core/EventBus';
import Events from './../core/events/Events';
import MediaPlayerEvents from './MediaPlayerEvents';
import FactoryMaker from '../core/FactoryMaker';
import {
    getVersionString
}
from './../core/Version';

//Dash
import DashAdapter from '../dash/DashAdapter';
import DashManifestModel from '../dash/models/DashManifestModel';
import DashMetrics from '../dash/DashMetrics';
import TimelineConverter from '../dash/utils/TimelineConverter';
import {
    HTTPRequest
} from './vo/metrics/HTTPRequest';
import BASE64 from '../../externals/base64';
import ISOBoxer from 'codem-isoboxer';
import DashJSError from './vo/DashJSError';
import { checkParameterType } from './utils/SupervisorTools';

/**
 * @module MediaPlayer
 * @description The MediaPlayer is the primary dash.js Module and a Facade to build your player around.
 * It will allow you access to all the important dash.js properties/methods via the public API and all the
 * events to build a robust DASH media player.
 */
function MediaPlayer() {
    /**
    * @constant {string} STREAMING_NOT_INITIALIZED_ERROR error string thrown when a function is called before the dash.js has been fully initialized
    * @inner
    */
    const STREAMING_NOT_INITIALIZED_ERROR = 'You must first call initialize() and set a source before calling this method';
    /**
    * @constant {string} PLAYBACK_NOT_INITIALIZED_ERROR error string thrown when a function is called before the dash.js has been fully initialized
    * @inner
    */
    const PLAYBACK_NOT_INITIALIZED_ERROR = 'You must first call initialize() and set a valid source and view before calling this method';
    /**
    * @constant {string} ELEMENT_NOT_ATTACHED_ERROR error string thrown when a function is called before the dash.js has received a reference of an HTML5 video element
    * @inner
    */
    const ELEMENT_NOT_ATTACHED_ERROR = 'You must first call attachView() to set the video element before calling this method';
    /**
    * @constant {string} SOURCE_NOT_ATTACHED_ERROR error string thrown when a function is called before the dash.js has received a valid source stream.
    * @inner
    */
    const SOURCE_NOT_ATTACHED_ERROR = 'You must first call attachSource() with a valid source before calling this method';
    /**
    * @constant {string} MEDIA_PLAYER_NOT_INITIALIZED_ERROR error string thrown when a function is called before the dash.js has been fully initialized.
    * @inner
    */
    const MEDIA_PLAYER_NOT_INITIALIZED_ERROR = 'MediaPlayer not initialized!';
    /**
    * @constant {string} PLAYBACK_LOW_LATENCY_MIN_DRIFT_BAD_ARGUMENT_ERROR error string thrown when setLowLatencyMinDrift function is called with an invalid value.
    * @inner
    */
    const PLAYBACK_LOW_LATENCY_MIN_DRIFT_BAD_ARGUMENT_ERROR = 'Playback minimum drift has an invalid value! Use a number from 0 to 0.5';
    /**
    * @constant {string} PLAYBACK_LOW_LATENCY_MAX_DRIFT_BAD_ARGUMENT_ERROR error string thrown when setLowLatencyMaxDriftBeforeSeeking function is called with an invalid value.
    * @inner
    */
    const PLAYBACK_LOW_LATENCY_MAX_DRIFT_BAD_ARGUMENT_ERROR = 'Playback maximum drift has an invalid value! Use a number greater or equal to 0';

    const context = this.context;
    const eventBus = EventBus(context).getInstance();
    const debug = Debug(context).getInstance();

    let instance,
        logger,
        source,
        protectionData,
        mediaPlayerInitialized,
        streamingInitialized,
        playbackInitialized,
        autoPlay,
        abrController,
        timelineConverter,
        mediaController,
        protectionController,
        metricsReportingController,
        mssHandler,
        adapter,
        metricsModel,
        mediaPlayerModel,
        errHandler,
        capabilities,
        streamController,
        playbackController,
        dashMetrics,
        dashManifestModel,
        manifestModel,
        videoModel,
        textController,
        domStorage,
        uriFragmentModel,
        savedElementAttributes;

    /*
    ---------------------------------------------------------------------------

        INIT FUNCTIONS

    ---------------------------------------------------------------------------
    */
    function setup() {
        logger = debug.getLogger(instance);
        mediaPlayerInitialized = false;
        playbackInitialized = false;
        streamingInitialized = false;
        autoPlay = true;
        protectionController = null;
        protectionData = null;
        adapter = null;
        Events.extend(MediaPlayerEvents);
        mediaPlayerModel = MediaPlayerModel(context).getInstance();
        videoModel = VideoModel(context).getInstance();
        uriFragmentModel = URIFragmentModel(context).getInstance();
    }

    /**
     * Configure media player with customs controllers. Helpful for tests
     *
     * @param {object=} config controllers configuration
     * @memberof module:MediaPlayer
     * @instance
     */
    function setConfig(config) {
        if (!config) {
            return;
        }
        if (config.capabilities) {
            capabilities = config.capabilities;
        }
        if (config.streamController) {
            streamController = config.streamController;
        }
        if (config.playbackController) {
            playbackController = config.playbackController;
        }
        if (config.mediaPlayerModel) {
            mediaPlayerModel = config.mediaPlayerModel;
        }
        if (config.abrController) {
            abrController = config.abrController;
        }
        if (config.mediaController) {
            mediaController = config.mediaController;
        }
    }

    /**
     * Upon creating the MediaPlayer you must call initialize before you call anything else.
     * There is one exception to this rule. It is crucial to call {@link module:MediaPlayer#extend extend()}
     * with all your extensions prior to calling initialize.
     *
     * ALL arguments are optional and there are individual methods to set each argument later on.
     * The args in this method are just for convenience and should only be used for a simple player setup.
     *
     * @param {HTML5MediaElement=} view - Optional arg to set the video element. {@link module:MediaPlayer#attachView attachView()}
     * @param {string=} source - Optional arg to set the media source. {@link module:MediaPlayer#attachSource attachSource()}
     * @param {boolean=} AutoPlay - Optional arg to set auto play. {@link module:MediaPlayer#setAutoPlay setAutoPlay()}
     * @see {@link module:MediaPlayer#attachView attachView()}
     * @see {@link module:MediaPlayer#attachSource attachSource()}
     * @see {@link module:MediaPlayer#setAutoPlay setAutoPlay()}
     * @memberof module:MediaPlayer
     * @instance
     */
    function initialize(view, source, AutoPlay) {
        if (!capabilities) {
            capabilities = Capabilities(context).getInstance();
        }
        errHandler = ErrorHandler(context).getInstance();

        if (!capabilities.supportsMediaSource()) {
            errHandler.capabilityError('mediasource');
            errHandler.error(new DashJSError(Errors.CAPABILITY_MEDIASOURCE_ERROR_CODE, Errors.CAPABILITY_MEDIASOURCE_ERROR_MESSAGE));
            return;
        }

        if (mediaPlayerInitialized) return;
        mediaPlayerInitialized = true;

        // init some controllers and models
        timelineConverter = TimelineConverter(context).getInstance();
        if (!abrController) {
            abrController = AbrController(context).getInstance();
        }

        if (!playbackController) {
            playbackController = PlaybackController(context).getInstance();
        }

        if (!mediaController) {
            mediaController = MediaController(context).getInstance();
        }

        adapter = DashAdapter(context).getInstance();
        dashManifestModel = DashManifestModel(context).getInstance({
            timelineConverter: timelineConverter,
            errHandler: errHandler,
            BASE64: BASE64
        });
        manifestModel = ManifestModel(context).getInstance();
        dashMetrics = DashMetrics(context).getInstance({
            manifestModel: manifestModel,
            dashManifestModel: dashManifestModel
        });
        metricsModel = MetricsModel(context).getInstance();

        textController = TextController(context).getInstance();
        domStorage = DOMStorage(context).getInstance({
            mediaPlayerModel: mediaPlayerModel
        });

        adapter.setConfig({
            dashManifestModel: dashManifestModel
        });

        restoreDefaultUTCTimingSources();
        setAutoPlay(AutoPlay !== undefined ? AutoPlay : true);
        savedElementAttributes = {};

        if (view) {
            attachView(view);
        }

        if (source) {
            attachSource(source);
        }

        logger.info('[dash.js ' + getVersion() + '] ' + 'MediaPlayer has been initialized');
    }

    /**
     * Sets the MPD source and the video element to null. You can also reset the MediaPlayer by
     * calling attachSource with a new source file.
     *
     * Calling this method is all that is necessary to destroy a MediaPlayer instance.
     *
     * @memberof module:MediaPlayer
     * @instance
     */
    function reset() {
        attachSource(null);
        attachView(null);
        protectionData = null;
        if (protectionController) {
            protectionController.reset();
            protectionController = null;
        }
        if (metricsReportingController) {
            metricsReportingController.reset();
            metricsReportingController = null;
        }
    }

    /**
     * The ready state of the MediaPlayer based on both the video element and MPD source being defined.
     *
     * @returns {boolean} The current ready state of the MediaPlayer
     * @see {@link module:MediaPlayer#attachView attachView()}
     * @see {@link module:MediaPlayer#attachSource attachSource()}
     * @memberof module:MediaPlayer
     * @instance
     */
    function isReady() {
        return (!!source && !!videoModel.getElement());
    }

    /**
     * Use the on method to listen for public events found in MediaPlayer.events. {@link MediaPlayerEvents}
     *
     * @param {string} type - {@link MediaPlayerEvents}
     * @param {Function} listener - callback method when the event fires.
     * @param {Object} scope - context of the listener so it can be removed properly.
     * @memberof module:MediaPlayer
     * @instance
     */
    function on(type, listener, scope) {
        eventBus.on(type, listener, scope);
    }

    /**
     * Use the off method to remove listeners for public events found in MediaPlayer.events. {@link MediaPlayerEvents}
     *
     * @param {string} type - {@link MediaPlayerEvents}
     * @param {Function} listener - callback method when the event fires.
     * @param {Object} scope - context of the listener so it can be removed properly.
     * @memberof module:MediaPlayer
     * @instance
     */
    function off(type, listener, scope) {
        eventBus.off(type, listener, scope);
    }

    /**
     * Current version of Dash.js
     * @returns {string} the current dash.js version string.
     * @memberof module:MediaPlayer
     * @instance
     */
    function getVersion() {
        return getVersionString();
    }

    /**
     * Use this method to access the dash.js logging class.
     *
     * @returns {Debug}
     * @memberof module:MediaPlayer
     * @instance
     */
    function getDebug() {
        return debug;
    }

    /*
    ---------------------------------------------------------------------------

        PLAYBACK FUNCTIONS

    ---------------------------------------------------------------------------
    */

    /**
     * Causes the player to begin streaming the media as set by the {@link module:MediaPlayer#attachSource attachSource()}
     * method in preparation for playing. It specifically does not require a view to be attached with {@link module:MediaPlayer#attachSource attachView()} to begin preloading.
     * When a view is attached after preloading, the buffered data is transferred to the attached mediaSource buffers.
     *
     * @see {@link module:MediaPlayer#attachSource attachSource()}
     * @see {@link module:MediaPlayer#attachView attachView()}
     * @memberof module:MediaPlayer
     * @throws {@link module:MediaPlayer~SOURCE_NOT_ATTACHED_ERROR SOURCE_NOT_ATTACHED_ERROR} if called before attachSource function
     * @instance
     */
    function preload() {
        if (videoModel.getElement() || streamingInitialized) {
            return false;
        }
        if (source) {
            initializePlayback();
        } else {
            throw SOURCE_NOT_ATTACHED_ERROR;
        }
    }

    /**
     * The play method initiates playback of the media defined by the {@link module:MediaPlayer#attachSource attachSource()} method.
     * This method will call play on the native Video Element.
     *
     * @see {@link module:MediaPlayer#attachSource attachSource()}
     * @throws {@link module:MediaPlayer~PLAYBACK_NOT_INITIALIZED_ERROR PLAYBACK_NOT_INITIALIZED_ERROR} if called before initializePlayback function
     * @memberof module:MediaPlayer
     * @instance
     */
    function play() {
        if (!playbackInitialized) {
            throw PLAYBACK_NOT_INITIALIZED_ERROR;
        }
        if (!autoPlay || (isPaused() && playbackInitialized)) {
            playbackController.play();
        }
    }

    /**
     * This method will call pause on the native Video Element.
     *
     * @throws {@link module:MediaPlayer~PLAYBACK_NOT_INITIALIZED_ERROR PLAYBACK_NOT_INITIALIZED_ERROR} if called before initializePlayback function
     * @memberof module:MediaPlayer
     * @instance
     */
    function pause() {
        if (!playbackInitialized) {
            throw PLAYBACK_NOT_INITIALIZED_ERROR;
        }
        playbackController.pause();
    }

    /**
     * Returns a Boolean that indicates whether the Video Element is paused.
     * @return {boolean}
     * @throws {@link module:MediaPlayer~PLAYBACK_NOT_INITIALIZED_ERROR PLAYBACK_NOT_INITIALIZED_ERROR} if called before initializePlayback function
     * @memberof module:MediaPlayer
     * @instance
     */
    function isPaused() {
        if (!playbackInitialized) {
            throw PLAYBACK_NOT_INITIALIZED_ERROR;
        }
        return playbackController.isPaused();
    }

    /**
     * Sets the currentTime property of the attached video element.  If it is a live stream with a
     * timeShiftBufferLength, then the DVR window offset will be automatically calculated.
     *
     * @param {number} value - A relative time, in seconds, based on the return value of the {@link module:MediaPlayer#duration duration()} method is expected
     * @see {@link module:MediaPlayer#getDVRSeekOffset getDVRSeekOffset()}
     * @throws {@link module:MediaPlayer~PLAYBACK_NOT_INITIALIZED_ERROR PLAYBACK_NOT_INITIALIZED_ERROR} if called before initializePlayback function
     * @throws {@link Constants#BAD_ARGUMENT_ERROR BAD_ARGUMENT_ERROR} if called with an invalid argument, not number type or is NaN.
     * @memberof module:MediaPlayer
     * @instance
     */
    function seek(value) {
        if (!playbackInitialized) {
            throw PLAYBACK_NOT_INITIALIZED_ERROR;
        }

        checkParameterType(value, 'number');

        if (isNaN(value)) {
            throw Constants.BAD_ARGUMENT_ERROR;
        }

        let s = playbackController.getIsDynamic() ? getDVRSeekOffset(value) : value;
        playbackController.seek(s);
    }

    /**
     * Returns a Boolean that indicates whether the media is in the process of seeking to a new position.
     * @return {boolean}
     * @throws {@link module:MediaPlayer~PLAYBACK_NOT_INITIALIZED_ERROR PLAYBACK_NOT_INITIALIZED_ERROR} if called before initializePlayback function
     * @memberof module:MediaPlayer
     * @instance
     */
    function isSeeking() {
        if (!playbackInitialized) {
            throw PLAYBACK_NOT_INITIALIZED_ERROR;
        }
        return playbackController.isSeeking();
    }

    /**
     * Returns a Boolean that indicates whether the media is in the process of dynamic.
     * @return {boolean}
     * @throws {@link module:MediaPlayer~PLAYBACK_NOT_INITIALIZED_ERROR PLAYBACK_NOT_INITIALIZED_ERROR} if called before initializePlayback function
     * @memberof module:MediaPlayer
     * @instance
     */
    function isDynamic() {
        if (!playbackInitialized) {
            throw PLAYBACK_NOT_INITIALIZED_ERROR;
        }
        return playbackController.getIsDynamic();
    }

    /**
     * Use this method to set the native Video Element's playback rate.
     * @param {number} value
     * @memberof module:MediaPlayer
     * @instance
     */
    function setPlaybackRate(value) {
        getVideoElement().playbackRate = value;
    }

    /**
     * Returns the current playback rate.
     * @returns {number}
     * @memberof module:MediaPlayer
     * @instance
     */
    function getPlaybackRate() {
        return getVideoElement().playbackRate;
    }

    /**
     * Use this method to set the maximum catch up rate, as a percentage, for low latency live streams. In low latency mode,
     * when measured latency is higher/lower than the target one ({@link module:MediaPlayer#setLiveDelay setLiveDelay()}),
     * dash.js increases/decreases playback rate respectively up to (+/-) the percentage defined with this method until target is reached.
     *
     * Valid values for catch up rate are in range 0-0.5 (0-50%). Set it to 0 to turn off live catch up feature.
     *
     * Note: Catch-up mechanism is only applied when playing low latency live streams.
     *
     * @param {number} value Percentage in which playback rate is increased/decreased when live catch up mechanism is activated.
     * @memberof module:MediaPlayer
     * @see {@link module:MediaPlayer#setLiveDelay setLiveDelay()}
     * @default {number} 0.5
     * @throws {@link Constants#BAD_ARGUMENT_ERROR BAD_ARGUMENT_ERROR} if called with an invalid argument, value is not number type, or value is not between 0 and 0.5.
     * @instance
     */
    function setCatchUpPlaybackRate(value) {
        mediaPlayerModel.setCatchUpPlaybackRate(value);
    }

    /**
     * Returns the current catchup playback rate.
     * @returns {number}
     * @see {@link module:MediaPlayer#setCatchUpPlaybackRate setCatchUpPlaybackRate()}
     * @memberof module:MediaPlayer
     * @instance
     */
    function getCatchUpPlaybackRate() {
        return mediaPlayerModel.getCatchUpPlaybackRate();
    }


    /**
     * Use this method to set the minimum latency deviation allowed before activating catch-up mechanism. In low latency mode,
     * when the difference between the measured latency and the target one ({@link module:MediaPlayer#setLiveDelay setLiveDelay()}),
     * as an absolute number, is higher than the one sets with this method, then dash.js increases/decreases
     * playback rate until target latency is reached.
     *
     * LowLatencyMinDrift should be provided in seconds, and it uses values between 0.0 and 0.5.
     *
     * Note: Catch-up mechanism is only applied when playing low latency live streams.
     *
     * @param {number} value Maximum difference between measured latency and the target one before applying playback rate modifications.
     * @memberof module:MediaPlayer
     * @see {@link module:MediaPlayer#setLiveDelay setLiveDelay()}
     * @default {number} 0.05
     * @throws {@link module:MediaPlayer~PLAYBACK_LOW_LATENCY_MIN_DRIFT_BAD_ARGUMENT_ERROR PLAYBACK_LOW_LATENCY_MIN_DRIFT_BAD_ARGUMENT_ERROR} if called with an invalid argument
     * @instance
     */
    function setLowLatencyMinDrift(value) {
        if ( typeof value !== 'number' || isNaN(value) || value < 0.0 || value > 0.50) {
            throw PLAYBACK_LOW_LATENCY_MIN_DRIFT_BAD_ARGUMENT_ERROR;
        }
        mediaPlayerModel.setLowLatencyMinDrift(value);
    }

    /**
     * Returns the current latency minimum allowed drift.
     * @returns {number}
     * @see {@link module:MediaPlayer#setLowLatencyMinDrift setLowLatencyMinDrift()}
     * @memberof module:MediaPlayer
     * @instance
     */
    function getLowLatencyMinDrift() {
        return mediaPlayerModel.getLowLatencyMinDrift();
    }

    /**
     * Use this method to set the maximum latency deviation allowed before dash.js to do a seeking to live position. In low latency mode,
     * when the difference between the measured latency and the target one ({@link module:MediaPlayer#setLiveDelay setLiveDelay()}),
     * as an absolute number, is higher than the one sets with this method, then dash.js does a seek to live edge position minus
     * the target live delay.
     *
     * LowLatencyMaxDriftBeforeSeeking should be provided in seconds. If 0, then seeking operations won't be used for
     * fixing latency deviations.
     *
     * Note: Catch-up mechanism is only applied when playing low latency live streams.
     *
     * @param {number} value Maximum difference between measured latency and the target one before using seek to
     * fix drastically live latency deviations.
     * @memberof module:MediaPlayer
     * @see {@link module:MediaPlayer#setLiveDelay setLiveDelay()}
     * @default {number} 0
     * @throws {@link module:MediaPlayer~PLAYBACK_LOW_LATENCY_MAX_DRIFT_BAD_ARGUMENT_ERROR PLAYBACK_LOW_LATENCY_MAX_DRIFT_BAD_ARGUMENT_ERROR} if called with an invalid argument
     * @instance
     */
    function setLowLatencyMaxDriftBeforeSeeking(value) {
        if ( typeof value !== 'number' || isNaN(value) || value < 0) {
            throw PLAYBACK_LOW_LATENCY_MAX_DRIFT_BAD_ARGUMENT_ERROR;
        }
        mediaPlayerModel.setLowLatencyMaxDriftBeforeSeeking(value);
    }

    /**
     * Returns the maximum latency drift before applying a seek operation to reduce the latency.
     * @returns {number}
     * @see {@link module:MediaPlayer#setLowLatencyMaxDriftBeforeSeeking setLowLatencyMaxDriftBeforeSeeking()}
     * @memberof module:MediaPlayer
     * @instance
     */
    function getLowLatencyMaxDriftBeforeSeeking() {
        return mediaPlayerModel.getLowLatencyMaxDriftBeforeSeeking();
    }

    /**
     * Use this method to set the native Video Element's muted state. Takes a Boolean that determines whether audio is muted. true if the audio is muted and false otherwise.
     * @param {boolean} value
     * @memberof module:MediaPlayer
     * @throws {@link Constants#BAD_ARGUMENT_ERROR BAD_ARGUMENT_ERROR} if called with an invalid argument, not boolean type.
     * @instance
     */
    function setMute(value) {
        checkParameterType(value, 'boolean');
        getVideoElement().muted = value;
    }

    /**
     * A Boolean that determines whether audio is muted.
     * @returns {boolean}
     * @memberof module:MediaPlayer
     * @instance
     */
    function isMuted() {
        return getVideoElement().muted;
    }

    /**
     * A double indicating the audio volume, from 0.0 (silent) to 1.0 (loudest).
     * @param {number} value
     * @memberof module:MediaPlayer
     * @throws {@link Constants#BAD_ARGUMENT_ERROR BAD_ARGUMENT_ERROR} if called with an invalid argument, not number type, or is NaN or not between 0 and 1.
     * @instance
     */
    function setVolume(value) {
        if ( typeof value !== 'number' || isNaN(value) || value < 0.0 || value > 1.0) {
            throw Constants.BAD_ARGUMENT_ERROR;
        }
        getVideoElement().volume = value;
    }

    /**
     * Returns the current audio volume, from 0.0 (silent) to 1.0 (loudest).
     * @returns {number}
     * @memberof module:MediaPlayer
     * @instance
     */
    function getVolume() {
        return getVideoElement().volume;
    }

    /**
     * The length of the buffer for a given media type, in seconds. Valid media
     * types are "video", "audio" and "fragmentedText". If no type is passed
     * in, then the minimum of video, audio and fragmentedText buffer length is
     * returned. NaN is returned if an invalid type is requested, the
     * presentation does not contain that type, or if no arguments are passed
     * and the presentation does not include any adaption sets of valid media
     * type.
     *
     * @param {string} type - the media type of the buffer
     * @returns {number} The length of the buffer for the given media type, in
     *  seconds, or NaN
     * @memberof module:MediaPlayer
     * @instance
     */
    function getBufferLength(type) {
        const types = [Constants.VIDEO, Constants.AUDIO, Constants.FRAGMENTED_TEXT];
        if (!type) {
            const buffer = types.map(
                t => getTracksFor(t).length > 0 ? getDashMetrics().getCurrentBufferLevel(getMetricsFor(t)) : Number.MAX_VALUE
            ).reduce(
                (p, c) => Math.min(p, c)
            );
            return buffer === Number.MAX_VALUE ? NaN : buffer;
        } else {
            if (types.indexOf(type) !== -1) {
                const buffer = getDashMetrics().getCurrentBufferLevel(getMetricsFor(type));
                return buffer ? buffer : NaN;
            } else {
                logger.warn('getBufferLength requested for invalid type');
                return NaN;
            }
        }
    }

    /**
     * The timeShiftBufferLength (DVR Window), in seconds.
     *
     * @returns {number} The window of allowable play time behind the live point of a live stream.
     * @memberof module:MediaPlayer
     * @instance
     */
    function getDVRWindowSize() {
        let metric = getDVRInfoMetric();
        if (!metric) {
            return 0;
        }
        return metric.manifestInfo.DVRWindowSize;
    }

    /**
     * This method should only be used with a live stream that has a valid timeShiftBufferLength (DVR Window).
     * NOTE - If you do not need the raw offset value (i.e. media analytics, tracking, etc) consider using the {@link module:MediaPlayer#seek seek()} method
     * which will calculate this value for you and set the video element's currentTime property all in one simple call.
     *
     * @param {number} value - A relative time, in seconds, based on the return value of the {@link module:MediaPlayer#duration duration()} method is expected.
     * @returns {number} A value that is relative the available range within the timeShiftBufferLength (DVR Window).
     * @see {@link module:MediaPlayer#seek seek()}
     * @memberof module:MediaPlayer
     * @instance
     */
    function getDVRSeekOffset(value) {
        let metric = getDVRInfoMetric();
        if (!metric) {
            return 0;
        }

        let liveDelay = playbackController.getLiveDelay();

        let val = metric.range.start + value;

        if (val > (metric.range.end - liveDelay)) {
            val = metric.range.end - liveDelay;
        }

        return val;
    }

    /**
     * Current time of the playhead, in seconds.
     *
     * If called with no arguments then the returned time value is time elapsed since the start point of the first stream, or if it is a live stream, then the time will be based on the return value of the {@link module:MediaPlayer#duration duration()} method.
     * However if a stream ID is supplied then time is relative to the start of that stream, or is null if there is no such stream id in the manifest.
     *
     * @param {string} streamId - The ID of a stream that the returned playhead time must be relative to the start of. If undefined, then playhead time is relative to the first stream.
     * @returns {number} The current playhead time of the media, or null.
     * @throws {@link module:MediaPlayer~PLAYBACK_NOT_INITIALIZED_ERROR PLAYBACK_NOT_INITIALIZED_ERROR} if called before initializePlayback function
     * @memberof module:MediaPlayer
     * @instance
     */
    function time(streamId) {
        if (!playbackInitialized) {
            throw PLAYBACK_NOT_INITIALIZED_ERROR;
        }
        let t = getVideoElement().currentTime;

        if (streamId !== undefined) {
            t = streamController.getTimeRelativeToStreamId(t, streamId);
        } else if (playbackController.getIsDynamic()) {
            let metric = getDVRInfoMetric();
            t = (metric === null) ? 0 : duration() - (metric.range.end - metric.time);
        }

        return t;
    }

    /**
     * Duration of the media's playback, in seconds.
     *
     * @returns {number} The current duration of the media.
     * @memberof module:MediaPlayer
     * @throws {@link module:MediaPlayer~PLAYBACK_NOT_INITIALIZED_ERROR PLAYBACK_NOT_INITIALIZED_ERROR} if called before initializePlayback function
     * @instance
     */
    function duration() {
        if (!playbackInitialized) {
            throw PLAYBACK_NOT_INITIALIZED_ERROR;
        }
        let d = getVideoElement().duration;

        if (playbackController.getIsDynamic()) {

            let metric = getDVRInfoMetric();
            let range;

            if (!metric) {
                return 0;
            }

            range = metric.range.end - metric.range.start;
            d = range < metric.manifestInfo.DVRWindowSize ? range : metric.manifestInfo.DVRWindowSize;
        }
        return d;
    }

    /**
     * Override duration of the media's playback, in seconds.
     * Example use: force early payback end if last fragment fails
     *
     * @param {string} d - duration in seconds
     * @memberof module:MediaPlayer
     * @instance
     */
    function setDuration(d) {
        if (!playbackInitialized) {
            throw PLAYBACK_NOT_INITIALIZED_ERROR;
        }
        streamController.setMediaDuration(d);
    }

    /**
     * Use this method to get the current playhead time as an absolute value, the time in seconds since midnight UTC, Jan 1 1970.
     * Note - this property only has meaning for live streams. If called before play() has begun, it will return a value of NaN.
     *
     * @returns {number} The current playhead time as UTC timestamp.
     * @throws {@link module:MediaPlayer~PLAYBACK_NOT_INITIALIZED_ERROR PLAYBACK_NOT_INITIALIZED_ERROR} if called before initializePlayback function
     * @memberof module:MediaPlayer
     * @instance
     */
    function timeAsUTC() {
        if (!playbackInitialized) {
            throw PLAYBACK_NOT_INITIALIZED_ERROR;
        }
        if (time() < 0) {
            return NaN;
        }
        return getAsUTC(time());
    }

    /**
     * Use this method to get the current duration as an absolute value, the time in seconds since midnight UTC, Jan 1 1970.
     * Note - this property only has meaning for live streams.
     *
     * @returns {number} The current duration as UTC timestamp.
     * @throws {@link module:MediaPlayer~PLAYBACK_NOT_INITIALIZED_ERROR PLAYBACK_NOT_INITIALIZED_ERROR} if called before initializePlayback function
     * @memberof module:MediaPlayer
     * @instance
     */
    function durationAsUTC() {
        if (!playbackInitialized) {
            throw PLAYBACK_NOT_INITIALIZED_ERROR;
        }
        return getAsUTC(duration());
    }

    /*
    ---------------------------------------------------------------------------

        AUTO BITRATE

    ---------------------------------------------------------------------------
    */
    /**
     * When switching multi-bitrate content (auto or manual mode) this property specifies the maximum bitrate allowed.
     * If you set this property to a value lower than that currently playing, the switching engine will switch down to
     * satisfy this requirement. If you set it to a value that is lower than the lowest bitrate, it will still play
     * that lowest bitrate.
     *
     * You can set or remove this bitrate cap at anytime before or during playback.  To clear this setting you must use the API
     * and set the value param to NaN.
     *
     * This feature is typically used to reserve higher bitrates for playback only when the player is in large or full-screen format.
     *
     * @param {string} type - 'video' or 'audio' are the type options.
     * @param {number} value - Value in kbps representing the maximum bitrate allowed.
     * @memberof module:MediaPlayer
     * @instance
     */
    function setMaxAllowedBitrateFor(type, value) {
        abrController.setMaxAllowedBitrateFor(type, value);
    }

    /**
     * When switching multi-bitrate content (auto or manual mode) this property specifies the minimum bitrate allowed.
     * If you set this property to a value higher than that currently playing, the switching engine will switch up to
     * satisfy this requirement. If you set it to a value that is lower than the lowest bitrate, it will still play
     * that lowest bitrate.
     *
     * You can set or remove this bitrate limit at anytime before or during playback. To clear this setting you must use the API
     * and set the value param to NaN.
     *
     * This feature is used to force higher quality playback.
     *
     * @param {string} type - 'video' or 'audio' are the type options.
     * @param {number} value - Value in kbps representing the minimum bitrate allowed.
     * @memberof module:MediaPlayer
     * @instance
     */
    function setMinAllowedBitrateFor(type, value) {
        abrController.setMinAllowedBitrateFor(type, value);
    }

    /**
     * @param {string} type - 'video' or 'audio' are the type options.
     * @memberof module:MediaPlayer
     * @see {@link module:MediaPlayer#setMaxAllowedBitrateFor setMaxAllowedBitrateFor()}
     * @instance
     */
    function getMaxAllowedBitrateFor(type) {
        return abrController.getMaxAllowedBitrateFor(type);
    }

    /**
     * Gets the top quality BitrateInfo checking portal limit and max allowed.
     *
     * It calls getTopQualityIndexFor internally
     *
     * @param {string} type - 'video' or 'audio' are the type options.
     * @memberof module:MediaPlayer
     * @returns {BitrateInfo | null}
     * @throws {@link module:MediaPlayer~STREAMING_NOT_INITIALIZED_ERROR STREAMING_NOT_INITIALIZED_ERROR} if called before initializePlayback function
     * @instance
     */
    function getTopBitrateInfoFor(type) {
        if (!streamingInitialized) {
            throw STREAMING_NOT_INITIALIZED_ERROR;
        }
        return abrController.getTopBitrateInfoFor(type);
    }

    /**
     * @param {string} type - 'video' or 'audio' are the type options.
     * @memberof module:MediaPlayer
     * @see {@link module:MediaPlayer#setMinAllowedBitrateFor setMinAllowedBitrateFor()}
     * @instance
     */
    function getMinAllowedBitrateFor(type) {
        return abrController.getMinAllowedBitrateFor(type);
    }

    /**
     * When switching multi-bitrate content (auto or manual mode) this property specifies the maximum representation allowed,
     * as a proportion of the size of the representation set.
     *
     * You can set or remove this cap at anytime before or during playback. To clear this setting you must use the API
     * and set the value param to NaN.
     *
     * If both this and maxAllowedBitrate are defined, maxAllowedBitrate is evaluated first, then maxAllowedRepresentation,
     * i.e. the lowest value from executing these rules is used.
     *
     * This feature is typically used to reserve higher representations for playback only when connected over a fast connection.
     *
     * @param {string} type - 'video' or 'audio' are the type options.
     * @param {number} value - number between 0 and 1, where 1 is allow all representations, and 0 is allow only the lowest.
     * @memberof module:MediaPlayer
     * @instance
     */
    function setMaxAllowedRepresentationRatioFor(type, value) {
        abrController.setMaxAllowedRepresentationRatioFor(type, value);
    }

    /**
     * @param {string} type - 'video' or 'audio' are the type options.
     * @returns {number} The current representation ratio cap.
     * @memberof module:MediaPlayer
     * @see {@link module:MediaPlayer#setMaxAllowedRepresentationRatioFor setMaxAllowedRepresentationRatioFor()}
     * @instance
     */
    function getMaxAllowedRepresentationRatioFor(type) {
        return abrController.getMaxAllowedRepresentationRatioFor(type);
    }

    /**
     * Gets the current download quality for media type video, audio or images. For video and audio types the ABR
     * rules update this value before every new download unless setAutoSwitchQualityFor(type, false) is called. For 'image'
     * type, thumbnails, there is no ABR algorithm and quality is set manually.
     *
     * @param {string} type - 'video', 'audio' or 'image' (thumbnails)
     * @returns {number} the quality index, 0 corresponding to the lowest bitrate
     * @memberof module:MediaPlayer
     * @see {@link module:MediaPlayer#setAutoSwitchQualityFor setAutoSwitchQualityFor()}
     * @see {@link module:MediaPlayer#setQualityFor setQualityFor()}
     * @throws {@link module:MediaPlayer~STREAMING_NOT_INITIALIZED_ERROR STREAMING_NOT_INITIALIZED_ERROR} if called before initializePlayback function
     * @instance
     */
    function getQualityFor(type) {
        if (!streamingInitialized) {
            throw STREAMING_NOT_INITIALIZED_ERROR;
        }
        if (type === Constants.IMAGE) {
            const activeStream = getActiveStream();
            if (!activeStream) {
                return -1;
            }
            const thumbnailController = activeStream.getThumbnailController();
            if (!thumbnailController) {
                return -1;
            }
            return thumbnailController.getCurrentTrackIndex();
        }
        return abrController.getQualityFor(type, streamController.getActiveStreamInfo());
    }

    /**
     * Sets the current quality for media type instead of letting the ABR Heuristics automatically selecting it.
     * This value will be overwritten by the ABR rules unless setAutoSwitchQualityFor(type, false) is called.
     *
     * @param {string} type - 'video', 'audio' or 'image'
     * @param {number} value - the quality index, 0 corresponding to the lowest bitrate
     * @memberof module:MediaPlayer
     * @see {@link module:MediaPlayer#setAutoSwitchQualityFor setAutoSwitchQualityFor()}
     * @see {@link module:MediaPlayer#getQualityFor getQualityFor()}
     * @throws {@link module:MediaPlayer~STREAMING_NOT_INITIALIZED_ERROR STREAMING_NOT_INITIALIZED_ERROR} if called before initializePlayback function
     * @instance
     */
    function setQualityFor(type, value) {
        if (!streamingInitialized) {
            throw STREAMING_NOT_INITIALIZED_ERROR;
        }
        if (type === Constants.IMAGE) {
            const activeStream = getActiveStream();
            if (!activeStream) {
                return;
            }
            const thumbnailController = activeStream.getThumbnailController();
            if (thumbnailController) {
                thumbnailController.setTrackByIndex(value);
            }
        }
        abrController.setPlaybackQuality(type, streamController.getActiveStreamInfo(), value);
    }

    /**
     * Update the video element size variables
     * Should be called on window resize (or any other time player is resized). Fullscreen does trigger a window resize event.
     *
     * Once windowResizeEventCalled = true, abrController.checkPortalSize() will use element size variables rather than querying clientWidth every time.
     *
     * @memberof module:MediaPlayer
     * @instance
     */
    function updatePortalSize() {
        abrController.setElementSize();
        abrController.setWindowResizeEventCalled(true);
    }

    /**
     * @memberof module:MediaPlayer
     * @instance
     */
    function getLimitBitrateByPortal() {
        return abrController.getLimitBitrateByPortal();
    }

    /**
     * Sets whether to limit the representation used based on the size of the playback area
     *
     * @param {boolean} value
     * @memberof module:MediaPlayer
     * @instance
     */
    function setLimitBitrateByPortal(value) {
        abrController.setLimitBitrateByPortal(value);
    }

    /**
     * @memberof module:MediaPlayer
     * @instance
     */
    function getUsePixelRatioInLimitBitrateByPortal() {
        return abrController.getUsePixelRatioInLimitBitrateByPortal();
    }

    /**
     * Sets whether to take into account the device's pixel ratio when defining the portal dimensions.
     * Useful on, for example, retina displays.
     *
     * @param {boolean} value
     * @memberof module:MediaPlayer
     * @instance
     * @default {boolean} false
     */
    function setUsePixelRatioInLimitBitrateByPortal(value) {
        abrController.setUsePixelRatioInLimitBitrateByPortal(value);
    }

    function setPortalScale(value) {
        abrController.setPortalScale(value);
    }

    function getPortalScale() {
        return abrController.getPortalScale();
    }

    /**
     * Use this method to explicitly set the starting bitrate for audio | video
     *
     * @param {string} type
     * @param {number} value - A value of the initial bitrate, kbps
     * @memberof module:MediaPlayer
     * @instance
     */
    function setInitialBitrateFor(type, value) {
        abrController.setInitialBitrateFor(type, value);
    }

    /**
     * @param {string} type
     * @returns {number} A value of the initial bitrate, kbps
     * @memberof module:MediaPlayer
     * @throws {@link module:MediaPlayer~STREAMING_NOT_INITIALIZED_ERROR STREAMING_NOT_INITIALIZED_ERROR} if called before initializePlayback function
     * @instance
     */
    function getInitialBitrateFor(type) {
        if (!streamingInitialized) {
            throw STREAMING_NOT_INITIALIZED_ERROR; //abrController.getInitialBitrateFor is overloaded with ratioDict logic that needs manifest force it to not be callable pre play.
        }
        return abrController.getInitialBitrateFor(type);
    }

    /**
     * @param {string} type
     * @param {number} value - A value of the initial Representation Ratio
     * @memberof module:MediaPlayer
     * @instance
     */
    function setInitialRepresentationRatioFor(type, value) {
        abrController.setInitialRepresentationRatioFor(type, value);
    }

    /**
     * @param {string} type
     * @returns {number} A value of the initial Representation Ratio
     * @memberof module:MediaPlayer
     * @instance
     */
    function getInitialRepresentationRatioFor(type) {
        return abrController.getInitialRepresentationRatioFor(type);
    }

    /**
     * @param {string} type - 'audio' | 'video'
     * @returns {boolean} Current state of adaptive bitrate switching
     * @memberof module:MediaPlayer
     * @instance
     */
    function getAutoSwitchQualityFor(type) {
        return abrController.getAutoSwitchBitrateFor(type);
    }

    /**
     * Set to false to switch off adaptive bitrate switching.
     *
     * @param {string} type - 'audio' | 'video'
     * @param {boolean} value
     * @default true
     * @memberof module:MediaPlayer
     * @instance
     */
    function setAutoSwitchQualityFor(type, value) {
        abrController.setAutoSwitchBitrateFor(type, value);
    }

    /**
     * Get the value of useDeadTimeLatency in AbrController. @see setUseDeadTimeLatencyForAbr
     *
     * @returns {boolean}
     *
     * @memberof module:MediaPlayer
     * @instance
     */
    function getUseDeadTimeLatencyForAbr() {
        return abrController.getUseDeadTimeLatency();
    }

    /**
     * Set the value of useDeadTimeLatency in AbrController. If true, only the download
     * portion will be considered part of the download bitrate and latency will be
     * regarded as static. If false, the reciprocal of the whole transfer time will be used.
     * Defaults to true.
     *
     * @param {boolean=} useDeadTimeLatency - True or false flag.
     *
     * @memberof module:MediaPlayer
     * @instance
     */
    function setUseDeadTimeLatencyForAbr(useDeadTimeLatency) {
        abrController.setUseDeadTimeLatency(useDeadTimeLatency);
    }

    /*
    ---------------------------------------------------------------------------

        MEDIA PLAYER CONFIGURATION

    ---------------------------------------------------------------------------
    */
    /**
     * <p>Set to false to prevent stream from auto-playing when the view is attached.</p>
     *
     * @param {boolean} value
     * @default true
     * @memberof module:MediaPlayer
     * @see {@link module:MediaPlayer#attachView attachView()}
     * @throws {@link Constants#BAD_ARGUMENT_ERROR BAD_ARGUMENT_ERROR} if called with an invalid argument, not boolean type.
     * @instance
     *
     */
    function setAutoPlay(value) {
        checkParameterType(value, 'boolean');
        autoPlay = value;
    }

    /**
     * @returns {boolean} The current autoPlay state.
     * @memberof module:MediaPlayer
     * @instance
     */
    function getAutoPlay() {
        return autoPlay;
    }

    /**
     * <p>Changing this value will lower or increase live stream latency.  The detected segment duration will be multiplied by this value
     * to define a time in seconds to delay a live stream from the live edge.</p>
     * <p>Lowering this value will lower latency but may decrease the player's ability to build a stable buffer.</p>
     *
     * @param {number} value - Represents how many segment durations to delay the live stream.
     * @default 4
     * @memberof module:MediaPlayer
     * @see {@link module:MediaPlayer#useSuggestedPresentationDelay useSuggestedPresentationDelay()}
     * @throws {@link Constants#BAD_ARGUMENT_ERROR BAD_ARGUMENT_ERROR} if called with an invalid argument, value is not number type.
     * @instance
     */
    function setLiveDelayFragmentCount(value) {
        mediaPlayerModel.setLiveDelayFragmentCount(value);
    }

    /**
     * <p>Equivalent in seconds of setLiveDelayFragmentCount</p>
     * <p>Lowering this value will lower latency but may decrease the player's ability to build a stable buffer.</p>
     * <p>This value should be less than the manifest duration by a couple of segment durations to avoid playback issues</p>
     * <p>If set, this parameter will take precedence over setLiveDelayFragmentCount and manifest info</p>
     *
     * @param {number} value - Represents how many seconds to delay the live stream.
     * @default undefined
     * @memberof module:MediaPlayer
     * @see {@link module:MediaPlayer#useSuggestedPresentationDelay useSuggestedPresentationDelay()}
     * @throws {@link Constants#BAD_ARGUMENT_ERROR BAD_ARGUMENT_ERROR} if called with an invalid argument, value, if defined, is not number type.
     * @instance
     */
    function setLiveDelay(value) {
        mediaPlayerModel.setLiveDelay(value);
    }

    /**
     * @memberof module:MediaPlayer
     * @see {@link module:MediaPlayer#setLiveDelay setLiveDelay()}
     * @instance
     * @returns {number|undefined} Current live stream delay in seconds when previously set, or `undefined`
     */
    function getLiveDelay() {
        return mediaPlayerModel.getLiveDelay();
    }

    /**
     * @memberof module:MediaPlayer
     * @instance
     * @returns {number|NaN} Current live stream latency in seconds. It is the difference between current time and time position at the playback head.
     * @throws {@link module:MediaPlayer~MEDIA_PLAYER_NOT_INITIALIZED_ERROR MEDIA_PLAYER_NOT_INITIALIZED_ERROR} if called before initialize function
     */
    function getCurrentLiveLatency() {
        if (!mediaPlayerInitialized) {
            throw MEDIA_PLAYER_NOT_INITIALIZED_ERROR;
        }

        if (!playbackInitialized) {
            return NaN;
        }

        return playbackController.getCurrentLiveLatency();
    }

    /**
     * <p>Set to true if you would like to override the default live delay and honor the SuggestedPresentationDelay attribute in by the manifest.</p>
     * @param {boolean} value
     * @default false
     * @memberof module:MediaPlayer
     * @see {@link module:MediaPlayer#setLiveDelayFragmentCount setLiveDelayFragmentCount()}
     * @throws {@link Constants#BAD_ARGUMENT_ERROR BAD_ARGUMENT_ERROR} if called with an invalid argument, value is not boolean type.
     * @instance
     */
    function useSuggestedPresentationDelay(value) {
        mediaPlayerModel.setUseSuggestedPresentationDelay(value);
    }

    /**
     * Set to false if you would like to disable the last known bit rate from being stored during playback and used
     * to set the initial bit rate for subsequent playback within the expiration window.
     *
     * The default expiration is one hour, defined in milliseconds. If expired, the default initial bit rate (closest to 1000 kbps) will be used
     * for that session and a new bit rate will be stored during that session.
     *
     * @param {boolean} enable - Will toggle if feature is enabled. True to enable, False to disable.
     * @param {number=} ttl - (Optional) A value defined in milliseconds representing how long to cache the bit rate for. Time to live.
     * @default enable = True, ttl = 360000 (1 hour)
     * @memberof module:MediaPlayer
     * @throws {@link Constants#BAD_ARGUMENT_ERROR BAD_ARGUMENT_ERROR} if called with invalid arguments, enable is not boolean type and, if defined, ttl is not a number or is NaN.
     * @instance
     *
     */
    function enableLastBitrateCaching(enable, ttl) {
        mediaPlayerModel.setLastBitrateCachingInfo(enable, ttl);
    }

    /**
     * Set to false if you would like to disable the last known lang for audio (or camera angle for video) from being stored during playback and used
     * to set the initial settings for subsequent playback within the expiration window.
     *
     * The default expiration is one hour, defined in milliseconds. If expired, the default settings will be used
     * for that session and a new settings will be stored during that session.
     *
     * @param {boolean} enable - Will toggle if feature is enabled. True to enable, False to disable.
     * @param {number=} [ttl] - (Optional) A value defined in milliseconds representing how long to cache the settings for. Time to live.
     * @default enable = True, ttl = 360000 (1 hour)
     * @memberof module:MediaPlayer
     * @throws {@link Constants#BAD_ARGUMENT_ERROR BAD_ARGUMENT_ERROR} if called with invalid arguments, enable is not boolean type and, if defined, ttl is not a number or is NaN.
     * @instance
     *
     */
    function enableLastMediaSettingsCaching(enable, ttl) {
        mediaPlayerModel.setLastMediaSettingsCachingInfo(enable, ttl);
    }

    /**
     * Set to true if you would like dash.js to keep downloading fragments in the background
     * when the video element is paused.
     *
     * @default true
     * @param {boolean} value
     * @memberof module:MediaPlayer
     * @throws {@link Constants#BAD_ARGUMENT_ERROR BAD_ARGUMENT_ERROR} if called with an invalid argument, value is not boolean type.
     * @instance
     */
    function setScheduleWhilePaused(value) {
        mediaPlayerModel.setScheduleWhilePaused(value);
    }

    /**
     * Returns a boolean of the current state of ScheduleWhilePaused.
     * @returns {boolean}
     * @see {@link module:MediaPlayer#setScheduleWhilePaused setScheduleWhilePaused()}
     * @memberof module:MediaPlayer
     * @instance
     */
    function getScheduleWhilePaused() {
        return mediaPlayerModel.getScheduleWhilePaused();
    }

    /**
     * When enabled, after an ABR up-switch in quality, instead of requesting and appending the next fragment
     * at the end of the current buffer range it is requested and appended closer to the current time
     * When enabled, The maximum time to render a higher quality is current time + (1.5 * fragment duration).
     *
     * Note, When ABR down-switch is detected, we appended the lower quality at the end of the buffer range to preserve the
     * higher quality media for as long as possible.
     *
     * If enabled, it should be noted there are a few cases when the client will not replace inside buffer range but rather
     * just append at the end.  1. When the buffer level is less than one fragment duration 2.  The client
     * is in an Abandonment State due to recent fragment abandonment event.
     *
     * Known issues:
     * 1. In IE11 with auto switching off, if a user switches to a quality they can not download in time the
     * fragment may be appended in the same range as the playhead or even in the past, in IE11 it may cause a stutter
     * or stall in playback.
     *
     *
     * @param {boolean} value
     * @default {boolean} false
     * @memberof module:MediaPlayer
     * @throws {@link Constants#BAD_ARGUMENT_ERROR BAD_ARGUMENT_ERROR} if called with an invalid argument, value is not boolean type.
     * @instance
     */
    function setFastSwitchEnabled(value) { //TODO we need to look at track switches for adaptation sets.  If always replace it works much like this but clears buffer. Maybe too many ways to do same thing.
        mediaPlayerModel.setFastSwitchEnabled(value);
    }

    /**
     * Disabled by default. Will return the current state of Fast Switch.
     * @return {boolean} Returns true if FastSwitch ABR is enabled.
     * @see {@link module:MediaPlayer#setFastSwitchEnabled setFastSwitchEnabled()}
     * @memberof module:MediaPlayer
     * @instance
     */
    function getFastSwitchEnabled() {
        return mediaPlayerModel.getFastSwitchEnabled();
    }

    /**
     * Sets the ABR strategy. Valid strategies are "abrDynamic", "abrBola" and "abrThroughput".
     * The ABR strategy can also be changed during a streaming session.
     * The call has no effect if an invalid method is passed.
     *
     * The BOLA strategy chooses bitrate based on current buffer level, with higher bitrates for higher buffer levels.
     * The Throughput strategy chooses bitrate based on the recent throughput history.
     * The Dynamic strategy switches smoothly between BOLA and Throughput in real time, playing to the strengths of both.
     *
     * @param {string} value
     * @default "abrDynamic"
     * @memberof module:MediaPlayer
     * @instance
     */
    function setABRStrategy(value) {
        mediaPlayerModel.setABRStrategy(value);
    }

    /**
     * Returns the current ABR strategy being used.
     * @return {string} "abrDynamic", "abrBola" or "abrThroughput"
     * @see {@link module:MediaPlayer#setABRStrategy setABRStrategy()}
     * @memberof module:MediaPlayer
     * @instance
     */
    function getABRStrategy() {
        return mediaPlayerModel.getABRStrategy();
    }

    /**
     * Enable/disable builtin dashjs ABR rules
     * @param {boolean} value
     * @default true
     * @memberof module:MediaPlayer
     * @throws {@link Constants#BAD_ARGUMENT_ERROR BAD_ARGUMENT_ERROR} if called with an invalid argument, not boolean type.
     * @instance
     */
    function useDefaultABRRules(value) {
        mediaPlayerModel.setUseDefaultABRRules(value);
    }

    /**
     * Add a custom ABR Rule
     * Rule will be apply on next stream if a stream is being played
     *
     * @param {string} type - rule type (one of ['qualitySwitchRules','abandonFragmentRules'])
     * @param {string} rulename - name of rule (used to identify custom rule). If one rule of same name has been added, then existing rule will be updated
     * @param {object} rule - the rule object instance
     * @memberof module:MediaPlayer
     * @throws {@link Constants#BAD_ARGUMENT_ERROR BAD_ARGUMENT_ERROR} if called with invalid arguments.
     * @instance
     */
    function addABRCustomRule(type, rulename, rule) {
        mediaPlayerModel.addABRCustomRule(type, rulename, rule);
    }

    /**
     * Remove a custom ABR Rule
     *
     * @param {string} rulename - name of the rule to be removed
     * @memberof module:MediaPlayer
     * @instance
     */
    function removeABRCustomRule(rulename) {
        mediaPlayerModel.removeABRCustomRule(rulename);
    }

    /**
     * Remove all custom rules
     * @memberof module:MediaPlayer
     * @instance
     */
    function removeAllABRCustomRule() {
        mediaPlayerModel.removeABRCustomRule();
    }

    /**
     * Sets the moving average method used for smoothing throughput estimates. Valid methods are
     * "slidingWindow" and "ewma". The call has no effect if an invalid method is passed.
     *
     * The sliding window moving average method computes the average throughput using the last four segments downloaded.
     * If the stream is live (as opposed to VOD), then only the last three segments are used.
     * If wide variations in throughput are detected, the number of segments can be dynamically increased to avoid oscillations.
     *
     * The exponentially weighted moving average (EWMA) method computes the average using exponential smoothing.
     * Two separate estimates are maintained, a fast one with a three-second half life and a slow one with an eight-second half life.
     * The throughput estimate at any time is the minimum of the fast and slow estimates.
     * This allows a fast reaction to a bandwidth drop and prevents oscillations on bandwidth spikes.
     *
     * @param {string} value
     * @default {string} 'slidingWindow'
     * @memberof module:MediaPlayer
     * @throws {@link Constants#BAD_ARGUMENT_ERROR BAD_ARGUMENT_ERROR} if called with an invalid argument, value is not slidingWindow or ewma.
     * @instance
     */
    function setMovingAverageMethod(value) {
        mediaPlayerModel.setMovingAverageMethod(value);
    }

    /**
     * Return the current moving average method used for smoothing throughput estimates.
     * @return {string} Returns "slidingWindow" or "ewma".
     * @see {@link module:MediaPlayer#setMovingAverageMethod setMovingAverageMethod()}
     * @memberof module:MediaPlayer
     * @instance
     */
    function getMovingAverageMethod() {
        return mediaPlayerModel.getMovingAverageMethod();
    }

    /**
     * Returns if low latency mode is enabled. Disabled by default.
     * @return {boolean} true - if enabled
     * @see {@link module:MediaPlayer#setLowLatencyEnabled setLowLatencyEnabled()}
     * @memberof module:MediaPlayer
     * @instance
     */
    function getLowLatencyEnabled() {
        return mediaPlayerModel.getLowLatencyEnabled();
    }

    /**
     * Enables low latency mode for dynamic streams. If not specified, liveDelay is set to 3s of buffer.
     * Browser compatibility (Check row 'ReadableStream response body'): https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
     * @param {boolean} value
     * @memberof module:MediaPlayer
     * @throws {@link Constants#BAD_ARGUMENT_ERROR BAD_ARGUMENT_ERROR} if called with an invalid argument, value is not boolean type.
     * @instance
     */
    function setLowLatencyEnabled(value) {
        mediaPlayerModel.setLowLatencyEnabled(value);
    }

    /**
     * <p>Allows you to set a scheme and server source for UTC live edge detection for dynamic streams.
     * If UTCTiming is defined in the manifest, it will take precedence over any time source manually added.</p>
     * <p>If you have exposed the Date header, use the method {@link module:MediaPlayer#clearDefaultUTCTimingSources clearDefaultUTCTimingSources()}.
     * This will allow the date header on the manifest to be used instead of a time server</p>
     * @param {string} schemeIdUri - <ul>
     * <li>urn:mpeg:dash:utc:http-head:2014</li>
     * <li>urn:mpeg:dash:utc:http-xsdate:2014</li>
     * <li>urn:mpeg:dash:utc:http-iso:2014</li>
     * <li>urn:mpeg:dash:utc:direct:2014</li>
     * </ul>
     * <p>Some specs referencing early ISO23009-1 drafts incorrectly use
     * 2012 in the URI, rather than 2014. support these for now.</p>
     * <ul>
     * <li>urn:mpeg:dash:utc:http-head:2012</li>
     * <li>urn:mpeg:dash:utc:http-xsdate:2012</li>
     * <li>urn:mpeg:dash:utc:http-iso:2012</li>
     * <li>urn:mpeg:dash:utc:direct:2012</li>
     * </ul>
     * @param {string} value - Path to a time source.
     * @default
     * <ul>
     *     <li>schemeIdUri:urn:mpeg:dash:utc:http-xsdate:2014</li>
     *     <li>value:http://time.akamai.com/?iso&ms/li>
     * </ul>
     * @memberof module:MediaPlayer
     * @see {@link module:MediaPlayer#removeUTCTimingSource removeUTCTimingSource()}
     * @instance
     */
    function addUTCTimingSource(schemeIdUri, value) {
        mediaPlayerModel.addUTCTimingSource(schemeIdUri, value);
    }

    /**
     * <p>Allows you to remove a UTC time source. Both schemeIdUri and value need to match the Dash.vo.UTCTiming properties in order for the
     * entry to be removed from the array</p>
     * @param {string} schemeIdUri - see {@link module:MediaPlayer#addUTCTimingSource addUTCTimingSource()}
     * @param {string} value - see {@link module:MediaPlayer#addUTCTimingSource addUTCTimingSource()}
     * @memberof module:MediaPlayer
     * @see {@link module:MediaPlayer#clearDefaultUTCTimingSources clearDefaultUTCTimingSources()}
     * @throws {@link Constants#BAD_ARGUMENT_ERROR BAD_ARGUMENT_ERROR} if called with invalid arguments, schemeIdUri and value are not string type.
     * @instance
     */
    function removeUTCTimingSource(schemeIdUri, value) {
        mediaPlayerModel.removeUTCTimingSource(schemeIdUri, value);
    }

    /**
     * <p>Allows you to clear the stored array of time sources.</p>
     * <p>Example use: If you have exposed the Date header, calling this method
     * will allow the date header on the manifest to be used instead of the time server.</p>
     * <p>Example use: Calling this method, assuming there is not an exposed date header on the manifest,  will default back
     * to using a binary search to discover the live edge</p>
     *
     * @memberof module:MediaPlayer
     * @see {@link module:MediaPlayer#restoreDefaultUTCTimingSources restoreDefaultUTCTimingSources()}
     * @instance
     */
    function clearDefaultUTCTimingSources() {
        mediaPlayerModel.clearDefaultUTCTimingSources();
    }

    /**
     * <p>Allows you to restore the default time sources after calling {@link module:MediaPlayer#clearDefaultUTCTimingSources clearDefaultUTCTimingSources()}</p>
     *
     * @default
     * <ul>
     *     <li>schemeIdUri:urn:mpeg:dash:utc:http-xsdate:2014</li>
     *     <li>value:http://time.akamai.com/?iso&ms</li>
     * </ul>
     *
     * @memberof module:MediaPlayer
     * @see {@link module:MediaPlayer#addUTCTimingSource addUTCTimingSource()}
     * @instance
     */
    function restoreDefaultUTCTimingSources() {
        mediaPlayerModel.restoreDefaultUTCTimingSources();
    }

    /**
     * <p>Allows you to enable the use of the Date Header, if exposed with CORS, as a timing source for live edge detection. The
     * use of the date header will happen only after the other timing source that take precedence fail or are omitted as described.
     * {@link module:MediaPlayer#clearDefaultUTCTimingSources clearDefaultUTCTimingSources()} </p>
     *
     * @param {boolean} value - true to enable
     * @default {boolean} True
     * @memberof module:MediaPlayer
     * @see {@link module:MediaPlayer#addUTCTimingSource addUTCTimingSource()}
     * @throws {@link Constants#BAD_ARGUMENT_ERROR BAD_ARGUMENT_ERROR} if called with an invalid argument, value is not boolean type.
     * @instance
     */
    function enableManifestDateHeaderTimeSource(value) {
        mediaPlayerModel.setUseManifestDateHeaderTimeSource(value);
    }

    /**
     * This value influences the buffer pruning logic.
     * Allows you to modify the buffer that is kept in source buffer in seconds.
     * <pre>0|-----------bufferToPrune-----------|-----bufferToKeep-----|currentTime|</pre>
     *
     * @default 20 seconds
     * @param {int} value
     * @memberof module:MediaPlayer
     * @throws {@link Constants#BAD_ARGUMENT_ERROR BAD_ARGUMENT_ERROR} if called with an invalid argument, not number type.
     * @instance
     */
    function setBufferToKeep(value) {
        mediaPlayerModel.setBufferToKeep(value);
    }

    /**
     * This value influences the buffer pruning logic.
     * Allows you to modify the buffer ahead of current time position that is kept in source buffer in seconds.
     * <pre>0|--------|currentTime|-----bufferAheadToKeep----|----bufferToPrune-----------|end|</pre>
     *
     * @default 80 seconds
     * @param {int} value
     * @memberof module:MediaPlayer
     * @throws {@link Constants#BAD_ARGUMENT_ERROR BAD_ARGUMENT_ERROR} if called with an invalid argument, not number type.
     * @instance
     */
    function setBufferAheadToKeep(value) {
        mediaPlayerModel.setBufferAheadToKeep(value);
    }

    /**
     * This value influences the buffer pruning logic.
     * Allows you to modify the interval of pruning buffer in seconds.
     *
     * @default 10 seconds
     * @param {int} value
     * @memberof module:MediaPlayer
     * @throws {@link Constants#BAD_ARGUMENT_ERROR BAD_ARGUMENT_ERROR} if called with an invalid argument, not a number type.
     * @instance
     */
    function setBufferPruningInterval(value) {
        mediaPlayerModel.setBufferPruningInterval(value);
    }

    /**
     * The time that the internal buffer target will be set to post startup/seeks (NOT top quality).
     *
     * When the time is set higher than the default you will have to wait longer
     * to see automatic bitrate switches but will have a larger buffer which
     * will increase stability.
     *
     * Note: The value set for Stable Buffer Time is not considered when Low Latency Mode is enabled.
     * When in Low Latency mode dash.js takes ownership of Stable Buffer Time value to minimize latency
     * that comes from buffer filling process.
     *
     * @default 12 seconds.
     * @param {int} value
     * @memberof module:MediaPlayer
     * @throws {@link Constants#BAD_ARGUMENT_ERROR BAD_ARGUMENT_ERROR} if called with an invalid argument, not number type.
     * @instance
     */
    function setStableBufferTime(value) {
        mediaPlayerModel.setStableBufferTime(value);
    }

    /**
     * The time that the internal buffer target will be set to post startup/seeks (NOT top quality).
     *
     * When the time is set higher than the default you will have to wait longer
     * to see automatic bitrate switches but will have a larger buffer which
     * will increase stability.
     *
     * @default 12 seconds.
     * @memberof module:MediaPlayer
     * @instance
     */
    function getStableBufferTime() {
        return mediaPlayerModel.getStableBufferTime();
    }

    /**
     * The time that the internal buffer target will be set to once playing the top quality.
     * If there are multiple bitrates in your adaptation, and the media is playing at the highest
     * bitrate, then we try to build a larger buffer at the top quality to increase stability
     * and to maintain media quality.
     *
     * @default 30 seconds.
     * @param {int} value
     * @memberof module:MediaPlayer
     * @throws {@link Constants#BAD_ARGUMENT_ERROR BAD_ARGUMENT_ERROR} if called with an invalid argument, not number type.
     * @instance
     */
    function setBufferTimeAtTopQuality(value) {
        mediaPlayerModel.setBufferTimeAtTopQuality(value);
    }

    /**
     * The time that the internal buffer target will be set to once playing the top quality.
     * If there are multiple bitrates in your adaptation, and the media is playing at the highest
     * bitrate, then we try to build a larger buffer at the top quality to increase stability
     * and to maintain media quality.
     *
     * @default 30 seconds.
     * @memberof module:MediaPlayer
     * @instance
     */
    function getBufferTimeAtTopQuality() {
        return mediaPlayerModel.getBufferTimeAtTopQuality();
    }

    /**
     * The time that the internal buffer target will be set to once playing the top quality for long form content.
     *
     * @default 60 seconds.
     * @see {@link module:MediaPlayer#setLongFormContentDurationThreshold setLongFormContentDurationThreshold()}
     * @see {@link module:MediaPlayer#setBufferTimeAtTopQuality setBufferTimeAtTopQuality()}
     * @param {int} value
     * @memberof module:MediaPlayer
     * @throws {@link Constants#BAD_ARGUMENT_ERROR BAD_ARGUMENT_ERROR} if called with an invalid argument, not number type.
     * @instance
     */
    function setBufferTimeAtTopQualityLongForm(value) {
        mediaPlayerModel.setBufferTimeAtTopQualityLongForm(value);
    }

    /**
     * The time that the internal buffer target will be set to once playing the top quality for long form content.
     *
     * @default 60 seconds.
     * @see {@link module:MediaPlayer#setLongFormContentDurationThreshold setLongFormContentDurationThreshold()}
     * @see {@link module:MediaPlayer#setBufferTimeAtTopQuality setBufferTimeAtTopQuality()}
     * @memberof module:MediaPlayer
     * @instance
     */
    function getBufferTimeAtTopQualityLongForm() {
        return mediaPlayerModel.getBufferTimeAtTopQualityLongForm();
    }

    /**
     * The threshold which defines if the media is considered long form content.
     * This will directly affect the buffer targets when playing back at the top quality.
     *
     * @see {@link module:MediaPlayer#setBufferTimeAtTopQualityLongForm setBufferTimeAtTopQualityLongForm()}
     * @default 600 seconds (10 minutes).
     * @param {number} value
     * @memberof module:MediaPlayer
     * @throws {@link Constants#BAD_ARGUMENT_ERROR BAD_ARGUMENT_ERROR} if called with an invalid argument, not number type.
     * @instance
     */
    function setLongFormContentDurationThreshold(value) {
        mediaPlayerModel.setLongFormContentDurationThreshold(value);
    }

    /**
     * The overlap tolerance time, at both the head and the tail of segments, considered when doing time to segment conversions.
     *
     * This is used when calculating which of the loaded segments of a representation corresponds with a given time position.
     * Its value is never used for calculating the segment index in seeking operations in which it assumes overlap time threshold is zero.
     *
     * <pre>
     * |-o-|--- segment X ----|-o-|
     *                        |-o-|---- segment X+1 -----|-o-|
     *                                                   |-o-|---- segment X+2 -----|-o-|
     * </pre>
     * @default 0.05 seconds.
     * @param {number} value
     * @memberof module:MediaPlayer
     * @throws {@link Constants#BAD_ARGUMENT_ERROR BAD_ARGUMENT_ERROR} if called with an invalid argument, not number type.
     * @instance
    */
    function setSegmentOverlapToleranceTime(value) {
        mediaPlayerModel.setSegmentOverlapToleranceTime(value);
    }

    /**
     * For a given media type, the threshold which defines if the response to a fragment
     * request is coming from browser cache or not.
     * Valid media types are "video", "audio"
     *
     * @default 50 milliseconds for video fragment requests; 5 milliseconds for audio fragment requests.
     * @param {string} type 'video' or 'audio' are the type options.
     * @param {number} value Threshold value in milliseconds.
     * @memberof module:MediaPlayer
     * @throws {@link Constants#BAD_ARGUMENT_ERROR BAD_ARGUMENT_ERROR} if called with invalid arguments, type not a string type and its value is not audio or video, value not number type.
     * @instance
     */
    function setCacheLoadThresholdForType(type, value) {
        mediaPlayerModel.setCacheLoadThresholdForType(type, value);
    }

    /**
     * A percentage between 0.0 and 1 to reduce the measured throughput calculations.
     * The default is 0.9. The lower the value the more conservative and restricted the
     * measured throughput calculations will be. please use carefully. This will directly
     * affect the ABR logic in dash.js
     *
     * @param {number} value
     * @memberof module:MediaPlayer
     * @throws {@link Constants#BAD_ARGUMENT_ERROR BAD_ARGUMENT_ERROR} if called with an invalid argument, not number type.
     * @instance
     */
    function setBandwidthSafetyFactor(value) {
        mediaPlayerModel.setBandwidthSafetyFactor(value);
    }

    /**
     * Returns the number of the current BandwidthSafetyFactor
     *
     * @return {number} value
     * @see {@link module:MediaPlayer#setBandwidthSafetyFactor setBandwidthSafetyFactor()}
     * @memberof module:MediaPlayer
     * @instance
     */
    function getBandwidthSafetyFactor() {
        return mediaPlayerModel.getBandwidthSafetyFactor();
    }

    /**
     * Returns the average throughput computed in the ABR logic
     *
     * @param {string} type
     * @return {number} value
     * @memberof module:MediaPlayer
     * @instance
     */
    function getAverageThroughput(type) {
        const throughputHistory = abrController.getThroughputHistory();
        return throughputHistory ? throughputHistory.getAverageThroughput(type) : 0;
    }

    /**
     * A timeout value in seconds, which during the ABRController will block switch-up events.
     * This will only take effect after an abandoned fragment event occurs.
     *
     * @default 10 seconds
     * @param {int} value
     * @memberof module:MediaPlayer
     * @throws {@link Constants#BAD_ARGUMENT_ERROR BAD_ARGUMENT_ERROR} if called with an invalid argument, not number type.
     * @instance
     */
    function setAbandonLoadTimeout(value) {
        mediaPlayerModel.setAbandonLoadTimeout(value);
    }

    /**
     * Total number of retry attempts that will occur on a fragment load before it fails.
     * Increase this value to a maximum in order to achieve an automatic playback resume
     * in case of completely lost internet connection.
     *
     * Note: This parameter is not taken into account when Low Latency Mode is enabled. For Low Latency
     * Playback dash.js takes control and sets a number of retry attempts that ensures playback stability.
     *
     * @default 3
     * @param {int} value
     * @memberof module:MediaPlayer
     * @throws {@link Constants#BAD_ARGUMENT_ERROR BAD_ARGUMENT_ERROR} if called with an invalid argument, value is not number type.
     * @instance
     */
    function setFragmentLoaderRetryAttempts(value) {
        mediaPlayerModel.setRetryAttemptsForType(HTTPRequest.MEDIA_SEGMENT_TYPE, value);
    }

    /**
     * Time in milliseconds of which to reload a failed fragment load attempt.
     *
     * @default 1000 milliseconds
     * @param {int} value
     * @memberof module:MediaPlayer
     * @throws {@link Constants#BAD_ARGUMENT_ERROR BAD_ARGUMENT_ERROR} if called with an invalid argument, value is not number type.
     * @instance
     */
    function setFragmentLoaderRetryInterval(value) {
        mediaPlayerModel.setRetryIntervalForType(HTTPRequest.MEDIA_SEGMENT_TYPE, value);
    }

    /**
     * Total number of retry attempts that will occur on a manifest load before it fails.
     *
     * @default 4
     * @param {int} value
     * @memberof module:MediaPlayer
     * @instance
     */
    function setManifestLoaderRetryAttempts(value) {
        mediaPlayerModel.setRetryAttemptsForType(HTTPRequest.MPD_TYPE, value);
    }

    /**
     * Time in milliseconds of which to reload a failed manifest load attempt.
     *
     * @default 1000 milliseconds
     * @param {int} value
     * @memberof module:MediaPlayer
     * @instance
     */
    function setManifestLoaderRetryInterval(value) {
        mediaPlayerModel.setRetryIntervalForType(HTTPRequest.MPD_TYPE, value);
    }

    /**
     * Sets whether withCredentials on XHR requests for a particular request
     * type is true or false
     *
     * @default false
     * @param {string} type - one of HTTPRequest.*_TYPE
     * @param {boolean} value
     * @memberof module:MediaPlayer
     * @instance
     */
    function setXHRWithCredentialsForType(type, value) {
        mediaPlayerModel.setXHRWithCredentialsForType(type, value);
    }

    /**
     * Gets whether withCredentials on XHR requests for a particular request
     * type is true or false
     *
     * @param {string} type - one of HTTPRequest.*_TYPE
     * @return {boolean}
     * @memberof module:MediaPlayer
     * @instance
     */
    function getXHRWithCredentialsForType(type) {
        return mediaPlayerModel.getXHRWithCredentialsForType(type);
    }

    /**
     * Sets whether player should jump small gaps (discontinuities) in the buffer.
     *
     * @param {boolean} value
     * @default false
     * @memberof module:MediaPlayer
     * @throws {@link Constants#BAD_ARGUMENT_ERROR BAD_ARGUMENT_ERROR} if called with an invalid argument, value is not boolean type.
     * @instance
     *
     */
    function setJumpGaps(value) {
        mediaPlayerModel.setJumpGaps(value);
    }

    /**
     * Gets current status of jump gaps feature.
     * @returns {boolean} The current jump gaps state.
     * @memberof module:MediaPlayer
     * @instance
     */
    function getJumpGaps() {
        return mediaPlayerModel.getJumpGaps();
    }

    /**
     * Time in seconds for a gap to be considered small.
     *
     * @param {number} value
     * @default 0.8
     * @memberof module:MediaPlayer
     * @throws {@link Constants#BAD_ARGUMENT_ERROR BAD_ARGUMENT_ERROR} if called with an invalid argument, value is not number type.
     * @instance
     *
     */
    function setSmallGapLimit(value) {
        mediaPlayerModel.setSmallGapLimit(value);
    }

    /**
     * Time in seconds for a gap to be considered small.
     * @returns {boolean} Current small gap limit
     * @memberof module:MediaPlayer
     * @instance
     */
    function getSmallGapLimit() {
        return mediaPlayerModel.getSmallGapLimit();
    }

    /**
     * For live streams, set the interval-frequency in milliseconds at which
     * dash.js will check if the current manifest is still processed before
     * downloading the next manifest once the minimumUpdatePeriod time has
     * expired.
     * @param {int} value
     * @default 100
     * @memberof module:MediaPlayer
     * @throws {@link Constants#BAD_ARGUMENT_ERROR BAD_ARGUMENT_ERROR} if called with an invalid argument, value is not number type.
     * @instance
     * @see {@link module:MediaPlayer#getManifestUpdateRetryInterval getManifestUpdateRetryInterval()}
     *
     */
    function setManifestUpdateRetryInterval(value) {
        mediaPlayerModel.setManifestUpdateRetryInterval(value);
    }

    /**
     * For live streams, get the interval-frequency in milliseconds at which
     * dash.js will check if the current manifest is still processed before
     * downloading the next manifest once the minimumUpdatePeriod time has
     * expired.
     * @returns {int} Current retry delay for manifest update
     * @memberof module:MediaPlayer
     * @instance
     * @see {@link module:MediaPlayer#setManifestUpdateRetryInterval setManifestUpdateRetryInterval()}
     */
    function getManifestUpdateRetryInterval() {
        return mediaPlayerModel.getManifestUpdateRetryInterval();
    }

    /*
    ---------------------------------------------------------------------------

        METRICS

    ---------------------------------------------------------------------------
    */
    /**
     * Returns the DashMetrics.js Module. You use this Module to get access to all the public metrics
     * stored in dash.js
     *
     * @see {@link module:DashMetrics}
     * @returns {Object}
     * @memberof module:MediaPlayer
     * @instance
     */
    function getDashMetrics() {
        return dashMetrics;
    }

    /**
     *
     * @param {string} type
     * @returns {Object}
     * @memberof module:MediaPlayer
     * @instance
     */
    function getMetricsFor(type) {
        return metricsModel.getReadOnlyMetricsFor(type);
    }
    /*
    ---------------------------------------------------------------------------

        TEXT MANAGEMENT

    ---------------------------------------------------------------------------
    */
    /**
     * Set default language for text. If default language is not one of text tracks, dash will choose the first one.
     *
     * @param {string} lang - default language
     * @memberof module:MediaPlayer
     * @instance
     */
    function setTextDefaultLanguage(lang) {
        if (textController === undefined) {
            textController = TextController(context).getInstance();
        }

        textController.setTextDefaultLanguage(lang);
    }

    /**
     * Get default language for text.
     *
     * @return {string} the default language if it has been set using setTextDefaultLanguage
     * @memberof module:MediaPlayer
     * @instance
     */
    function getTextDefaultLanguage() {
        if (textController === undefined) {
            textController = TextController(context).getInstance();
        }

        return textController.getTextDefaultLanguage();
    }

    /**
     * Set enabled default state.
     * This is used to enable/disable text when a file is loaded.
     * During playback, use enableText to enable text for the file
     *
     * @param {boolean} enable - true to enable text, false otherwise
     * @memberof module:MediaPlayer
     * @instance
     */
    function setTextDefaultEnabled(enable) {
        if (textController === undefined) {
            textController = TextController(context).getInstance();
        }

        textController.setTextDefaultEnabled(enable);
    }

    /**
     * Get enabled default state.
     *
     * @return {boolean}  default enable state
     * @memberof module:MediaPlayer
     * @instance
     */
    function getTextDefaultEnabled() {
        if (textController === undefined) {
            textController = TextController(context).getInstance();
        }

        return textController.getTextDefaultEnabled();
    }

    /**
     * Enable/disable text
     * When enabling text, dash will choose the previous selected text track
     *
     * @param {boolean} enable - true to enable text, false otherwise (same as setTextTrack(-1))
     * @memberof module:MediaPlayer
     * @instance
     */
    function enableText(enable) {
        if (textController === undefined) {
            textController = TextController(context).getInstance();
        }

        textController.enableText(enable);
    }

    /**
     * Enable/disable text
     * When enabling dash will keep downloading and process fragmented text tracks even if all tracks are in mode "hidden"
     *
     * @param {boolean} enable - true to enable text streaming even if all text tracks are hidden.
     * @memberof module:MediaPlayer
     * @instance
     */
    function enableForcedTextStreaming(enable) {
        if (textController === undefined) {
            textController = TextController(context).getInstance();
        }

        textController.enableForcedTextStreaming(enable);
    }

    /**
     * Return if text is enabled
     *
     * @return {boolean} return true if text is enabled, false otherwise
     * @memberof module:MediaPlayer
     * @instance
     */
    function isTextEnabled() {
        if (textController === undefined) {
            textController = TextController(context).getInstance();
        }

        return textController.isTextEnabled();
    }

    /**
     * Use this method to change the current text track for both external time text files and fragmented text tracks. There is no need to
     * set the track mode on the video object to switch a track when using this method.
     * @param {number} idx - Index of track based on the order of the order the tracks are added Use -1 to disable all tracks. (turn captions off).  Use module:MediaPlayer#dashjs.MediaPlayer.events.TEXT_TRACK_ADDED.
     * @see {@link MediaPlayerEvents#event:TEXT_TRACK_ADDED dashjs.MediaPlayer.events.TEXT_TRACK_ADDED}
     * @throws {@link module:MediaPlayer~PLAYBACK_NOT_INITIALIZED_ERROR PLAYBACK_NOT_INITIALIZED_ERROR} if called before initializePlayback function
     * @memberof module:MediaPlayer
     * @instance
     */
    function setTextTrack(idx) {
        if (!playbackInitialized) {
            throw PLAYBACK_NOT_INITIALIZED_ERROR;
        }

        if (textController === undefined) {
            textController = TextController(context).getInstance();
        }

        textController.setTextTrack(idx);
    }

    function getCurrentTextTrackIndex() {
        let idx = NaN;
        if (textController) {
            idx = textController.getCurrentTrackIdx();
        }
        return idx;
    }

    /**
     * This method serves to control captions z-index value. If 'true' is passed, the captions will have the highest z-index and be
     * displayed on top of other html elements. Default value is 'false' (z-index is not set).
     * @param {boolean} value
     * @memberof module:MediaPlayer
     * @instance
     */
    function displayCaptionsOnTop(value) {
        let textTracks = TextTracks(context).getInstance();
        textTracks.setConfig({
            videoModel: videoModel
        });
        textTracks.initialize();
        textTracks.displayCConTop(value);
    }

    /*
    ---------------------------------------------------------------------------

        VIDEO ELEMENT MANAGEMENT

    ---------------------------------------------------------------------------
    */

    /**
     * Returns instance of Video Element that was attached by calling attachView()
     * @returns {Object}
     * @memberof module:MediaPlayer
     * @throws {@link module:MediaPlayer~ELEMENT_NOT_ATTACHED_ERROR ELEMENT_NOT_ATTACHED_ERROR} if called before attachView function
     * @instance
     */
    function getVideoElement() {
        if (!videoModel.getElement()) {
            throw ELEMENT_NOT_ATTACHED_ERROR;
        }
        return videoModel.getElement();
    }

    /**
     * Use this method to attach an HTML5 element that wraps the video element.
     *
     * @param {HTMLElement} container - The HTML5 element containing the video element.
     * @memberof module:MediaPlayer
     * @instance
     * @deprecated
     */
    function attachVideoContainer(container) { /* jshint ignore:line */
        logger.warn('attachVideoContainer method has been deprecated and will be removed in dash.js v3.0.0');
    }

    /**
     * Use this method to attach an HTML5 VideoElement for dash.js to operate upon.
     *
     * @param {Object} element - An HTMLMediaElement that has already been defined in the DOM (or equivalent stub).
     * @memberof module:MediaPlayer
     * @throws {@link module:MediaPlayer~MEDIA_PLAYER_NOT_INITIALIZED_ERROR MEDIA_PLAYER_NOT_INITIALIZED_ERROR} if called before initialize function
     * @instance
     */
    function attachView(element) {
        if (!mediaPlayerInitialized) {
            throw MEDIA_PLAYER_NOT_INITIALIZED_ERROR;
        }

        videoModel.setElement(element);

        if (element) {
            detectProtection();
            detectMetricsReporting();
            detectMss();

            if (streamController) {
                streamController.switchToVideoElement(savedElementAttributes.seekTime);
            }
        }

        if (playbackInitialized) { //Reset if we have been playing before, so this is a new element.
            resetPlaybackControllers();
        }

        initializePlayback();
    }

    function detachView() {
        const element = videoModel.getElement();
        if (element) {
            savedElementAttributes.seekTime = playbackController.getTime();
            streamController.detachVideoElement();
            playbackController.reset();
            playbackController.setConfig({
                streamController: streamController,
                metricsModel: metricsModel,
                dashMetrics: dashMetrics,
                manifestModel: manifestModel,
                mediaPlayerModel: mediaPlayerModel,
                dashManifestModel: dashManifestModel,
                adapter: adapter,
                videoModel: videoModel
            });
        }
    }

    function reattachView(element) {
        if (element) {
            videoModel.setElement(element);
            detectProtection();
            detectMetricsReporting();
            detectMss();

            if (streamController) {
                streamController.switchToVideoElement(savedElementAttributes.seekTime);
            }
        }
    }

    /**
     * Returns instance of Div that was attached by calling attachTTMLRenderingDiv()
     * @returns {Object}
     * @memberof module:MediaPlayer
     * @instance
     */
    function getTTMLRenderingDiv() {
        return videoModel ? videoModel.getTTMLRenderingDiv() : null;
    }

    /**
     * Use this method to attach an HTML5 div for dash.js to render rich TTML subtitles.
     *
     * @param {HTMLDivElement} div - An unstyled div placed after the video element. It will be styled to match the video size and overlay z-order.
     * @memberof module:MediaPlayer
     * @throws {@link module:MediaPlayer~ELEMENT_NOT_ATTACHED_ERROR ELEMENT_NOT_ATTACHED_ERROR} if called before attachView function
     * @instance
     */
    function attachTTMLRenderingDiv(div) {
        if (!videoModel.getElement()) {
            throw ELEMENT_NOT_ATTACHED_ERROR;
        }
        videoModel.setTTMLRenderingDiv(div);
    }

    /*
    ---------------------------------------------------------------------------

        STREAM AND TRACK MANAGEMENT

    ---------------------------------------------------------------------------
    */
    /**
     * @param {string} type
     * @returns {Array}
     * @memberof module:MediaPlayer
     * @throws {@link module:MediaPlayer~STREAMING_NOT_INITIALIZED_ERROR STREAMING_NOT_INITIALIZED_ERROR} if called before initializePlayback function
     * @instance
     */
    function getBitrateInfoListFor(type) {
        if (!streamingInitialized) {
            throw STREAMING_NOT_INITIALIZED_ERROR;
        }
        let stream = getActiveStream();
        return stream ? stream.getBitrateListFor(type) : [];
    }

    /**
     * This method returns the list of all available streams from a given manifest
     * @param {Object} manifest
     * @returns {Array} list of {@link StreamInfo}
     * @memberof module:MediaPlayer
     * @throws {@link module:MediaPlayer~STREAMING_NOT_INITIALIZED_ERROR STREAMING_NOT_INITIALIZED_ERROR} if called before initializePlayback function
     * @instance
     */
    function getStreamsFromManifest(manifest) {
        if (!streamingInitialized) {
            throw STREAMING_NOT_INITIALIZED_ERROR;
        }
        return adapter.getStreamsInfo(manifest);
    }

    /**
     * This method returns the list of all available tracks for a given media type
     * @param {string} type
     * @returns {Array} list of {@link MediaInfo}
     * @memberof module:MediaPlayer
     * @throws {@link module:MediaPlayer~STREAMING_NOT_INITIALIZED_ERROR STREAMING_NOT_INITIALIZED_ERROR} if called before initializePlayback function
     * @instance
     */
    function getTracksFor(type) {
        if (!streamingInitialized) {
            throw STREAMING_NOT_INITIALIZED_ERROR;
        }
        let streamInfo = streamController.getActiveStreamInfo();
        return mediaController.getTracksFor(type, streamInfo);
    }

    /**
     * This method returns the list of all available tracks for a given media type and streamInfo from a given manifest
     * @param {string} type
     * @param {Object} manifest
     * @param {Object} streamInfo
     * @returns {Array}  list of {@link MediaInfo}
     * @memberof module:MediaPlayer
     * @throws {@link module:MediaPlayer~STREAMING_NOT_INITIALIZED_ERROR STREAMING_NOT_INITIALIZED_ERROR} if called before initializePlayback function
     * @instance
     */
    function getTracksForTypeFromManifest(type, manifest, streamInfo) {
        if (!streamingInitialized) {
            throw STREAMING_NOT_INITIALIZED_ERROR;
        }

        streamInfo = streamInfo || adapter.getStreamsInfo(manifest, 1)[0];

        return streamInfo ? adapter.getAllMediaInfoForType(streamInfo, type, manifest) : [];
    }

    /**
     * @param {string} type
     * @returns {Object|null} {@link MediaInfo}
     *
     * @memberof module:MediaPlayer
     * @throws {@link module:MediaPlayer~STREAMING_NOT_INITIALIZED_ERROR STREAMING_NOT_INITIALIZED_ERROR} if called before initializePlayback function
     * @instance
     */
    function getCurrentTrackFor(type) {
        if (!streamingInitialized) {
            throw STREAMING_NOT_INITIALIZED_ERROR;
        }
        let streamInfo = streamController.getActiveStreamInfo();
        return mediaController.getCurrentTrackFor(type, streamInfo);
    }

    /**
     * This method allows to set media settings that will be used to pick the initial track. Format of the settings
     * is following:
     * {lang: langValue,
     *  viewpoint: viewpointValue,
     *  audioChannelConfiguration: audioChannelConfigurationValue,
     *  accessibility: accessibilityValue,
     *  role: roleValue}
     *
     *
     * @param {string} type
     * @param {Object} value
     * @memberof module:MediaPlayer
     * @throws {@link module:MediaPlayer~MEDIA_PLAYER_NOT_INITIALIZED_ERROR MEDIA_PLAYER_NOT_INITIALIZED_ERROR} if called before initialize function
     * @instance
     */
    function setInitialMediaSettingsFor(type, value) {
        if (!mediaPlayerInitialized) {
            throw MEDIA_PLAYER_NOT_INITIALIZED_ERROR;
        }
        mediaController.setInitialSettings(type, value);
    }

    /**
     * This method returns media settings that is used to pick the initial track. Format of the settings
     * is following:
     * {lang: langValue,
     *  viewpoint: viewpointValue,
     *  audioChannelConfiguration: audioChannelConfigurationValue,
     *  accessibility: accessibilityValue,
     *  role: roleValue}
     * @param {string} type
     * @returns {Object}
     * @memberof module:MediaPlayer
     * @throws {@link module:MediaPlayer~MEDIA_PLAYER_NOT_INITIALIZED_ERROR MEDIA_PLAYER_NOT_INITIALIZED_ERROR} if called before initialize function
     * @instance
     */
    function getInitialMediaSettingsFor(type) {
        if (!mediaPlayerInitialized) {
            throw MEDIA_PLAYER_NOT_INITIALIZED_ERROR;
        }
        return mediaController.getInitialSettings(type);
    }

    /**
     * @param {MediaInfo} track - instance of {@link MediaInfo}
     * @memberof module:MediaPlayer
     * @throws {@link module:MediaPlayer~STREAMING_NOT_INITIALIZED_ERROR STREAMING_NOT_INITIALIZED_ERROR} if called before initializePlayback function
     * @instance
     */
    function setCurrentTrack(track) {
        if (!streamingInitialized) {
            throw STREAMING_NOT_INITIALIZED_ERROR;
        }
        mediaController.setTrack(track);
    }

    /**
     * This method returns the current track switch mode.
     *
     * @param {string} type
     * @returns {string} mode
     * @memberof module:MediaPlayer
     * @throws {@link module:MediaPlayer~MEDIA_PLAYER_NOT_INITIALIZED_ERROR MEDIA_PLAYER_NOT_INITIALIZED_ERROR} if called before initialize function
     * @instance
     */
    function getTrackSwitchModeFor(type) {
        if (!mediaPlayerInitialized) {
            throw MEDIA_PLAYER_NOT_INITIALIZED_ERROR;
        }
        return mediaController.getSwitchMode(type);
    }

    /**
     * This method sets the current track switch mode. Available options are:
     *
     * MediaController.TRACK_SWITCH_MODE_NEVER_REPLACE
     * (used to forbid clearing the buffered data (prior to current playback position) after track switch.
     * Defers to fastSwitchEnabled for placement of new data. Default for video)
     *
     * MediaController.TRACK_SWITCH_MODE_ALWAYS_REPLACE
     * (used to clear the buffered data (prior to current playback position) after track switch. Default for audio)
     *
     * @param {string} type
     * @param {string} mode
     * @memberof module:MediaPlayer
     * @throws {@link module:MediaPlayer~MEDIA_PLAYER_NOT_INITIALIZED_ERROR MEDIA_PLAYER_NOT_INITIALIZED_ERROR} if called before initialize function
     * @instance
     */
    function setTrackSwitchModeFor(type, mode) {
        if (!mediaPlayerInitialized) {
            throw MEDIA_PLAYER_NOT_INITIALIZED_ERROR;
        }
        mediaController.setSwitchMode(type, mode);
    }

    /**
     * This method sets the selection mode for the initial track. This mode defines how the initial track will be selected
     * if no initial media settings are set. If initial media settings are set this parameter will be ignored. Available options are:
     *
     * MediaController.TRACK_SELECTION_MODE_HIGHEST_BITRATE
     * this mode makes the player select the track with a highest bitrate. This mode is a default mode.
     *
     * MediaController.TRACK_SELECTION_MODE_WIDEST_RANGE
     * this mode makes the player select the track with a widest range of bitrates
     *
     * @param {string} mode
     * @memberof module:MediaPlayer
     * @throws {@link module:MediaPlayer~MEDIA_PLAYER_NOT_INITIALIZED_ERROR MEDIA_PLAYER_NOT_INITIALIZED_ERROR} if called before initialize function
     * @instance
     */
    function setSelectionModeForInitialTrack(mode) {
        if (!mediaPlayerInitialized) {
            throw MEDIA_PLAYER_NOT_INITIALIZED_ERROR;
        }
        mediaController.setSelectionModeForInitialTrack(mode);
    }

    /**
     * This method returns the track selection mode.
     *
     * @returns {string} mode
     * @memberof module:MediaPlayer
     * @throws {@link module:MediaPlayer~MEDIA_PLAYER_NOT_INITIALIZED_ERROR MEDIA_PLAYER_NOT_INITIALIZED_ERROR} if called before initialize function
     * @instance
     */
    function getSelectionModeForInitialTrack() {
        if (!mediaPlayerInitialized) {
            throw MEDIA_PLAYER_NOT_INITIALIZED_ERROR;
        }
        return mediaController.getSelectionModeForInitialTrack();
    }

    /**
     * Get the portal limit minimum (in kbps). Below this bitrate, the portal size will not restrict the representation chosen.
     *
     * @returns {number} bitrate
     * @memberof module:MediaPlayer
     * @instance
     */
    function getPortalLimitMinimum() {
        return abrController.getPortalLimitMinimum();
    }

    /**
     * Set the portal limit minimum (in kbps). Below this bitrate, the portal size will not restrict the representation chosen.
     *
     * @param {number} bitrate
     * @memberof module:MediaPlayer
     * @instance
     */
    function setPortalLimitMinimum(bitrate) {
        abrController.setPortalLimitMinimum(bitrate);
    }

    /*
    ---------------------------------------------------------------------------

        PROTECTION MANAGEMENT

    ---------------------------------------------------------------------------
    /**
     * Detects if Protection is included and returns an instance of ProtectionController.js
     * @memberof module:MediaPlayer
     * @instance
     */
    function getProtectionController() {
        return detectProtection();
    }

    /**
     * Will override dash.js protection controller.
     * @param {ProtectionController} value - valid protection controller instance.
     * @memberof module:MediaPlayer
     * @instance
     */
    function attachProtectionController(value) {
        protectionController = value;
    }

    /**
     * Sets Protection Data required to setup the Protection Module (DRM). Protection Data must
     * be set before initializing MediaPlayer or, once initialized, before PROTECTION_CREATED event is fired.
     * @see {@link module:MediaPlayer#initialize initialize()}
     * @see {@link ProtectionEvents#event:PROTECTION_CREATED dashjs.Protection.events.PROTECTION_CREATED}
     * @param {ProtectionData} value - object containing
     * property names corresponding to key system name strings and associated
     * values being instances of.
     * @memberof module:MediaPlayer
     * @instance
     */
    function setProtectionData(value) {
        protectionData = value;

        // Propagate changes in case StreamController is already created
        if (streamController) {
            streamController.setProtectionData(protectionData);
        }
    }

    /*
    ---------------------------------------------------------------------------

        THUMBNAILS MANAGEMENT

    ---------------------------------------------------------------------------
    */

    /**
     * Return the thumbnail at time position.
     * @returns {Thumbnail|null} - Thumbnail for the given time position. It returns null in case there are is not a thumbnails representation or
     * if it doesn't contain a thumbnail for the given time position.
     * @param {number} time - A relative time, in seconds, based on the return value of the {@link module:MediaPlayer#duration duration()} method is expected
     * @param {function} callback - A Callback function provided when retrieving thumbnail
     * @memberof module:MediaPlayer
     * @instance
     */
    function getThumbnail(time, callback) {
        if (time < 0) {
            return null;
        }
        const s = playbackController.getIsDynamic() ? getDVRSeekOffset(time) : time;
        const stream = streamController.getStreamForTime(s);
        if (stream === null) {
            return null;
        }

        const thumbnailController = stream.getThumbnailController();
        if (!thumbnailController) {
            return null;
        }

        const timeInPeriod = streamController.getTimeRelativeToStreamId(s, stream.getId());
        return thumbnailController.get(timeInPeriod, callback);
    }

    /*
    ---------------------------------------------------------------------------

        PROTECTION CONTROLLER MANAGEMENT

    ---------------------------------------------------------------------------
    */

    /**
     * Set the value for the ProtectionController and MediaKeys life cycle. If true, the
     * ProtectionController and then created MediaKeys and MediaKeySessions will be preserved during
     * the MediaPlayer lifetime.
     *
     * @param {boolean=} value - True or false flag.
     *
     * @memberof module:MediaPlayer
     * @throws {@link Constants#BAD_ARGUMENT_ERROR BAD_ARGUMENT_ERROR} if called with an invalid argument, value is not boolean type.
     * @instance
     */
    function keepProtectionMediaKeys(value) {
        mediaPlayerModel.setKeepProtectionMediaKeys(value);
    }

    /*
    ---------------------------------------------------------------------------

        TOOLS AND OTHERS FUNCTIONS

    ---------------------------------------------------------------------------
    */
    /**
     * Allows application to retrieve a manifest.  Manifest loading is asynchro
     * nous and
     * requires the app-provided callback function
     *
     * @param {string} url - url the manifest url
     * @param {function} callback - A Callback function provided when retrieving manifests
     * @memberof module:MediaPlayer
     * @instance
     */
    function retrieveManifest(url, callback) {
        let manifestLoader = createManifestLoader();
        let self = this;

        const handler = function (e) {
            if (!e.error) {
                callback(e.manifest);
            } else {
                callback(null, e.error);
            }
            eventBus.off(Events.INTERNAL_MANIFEST_LOADED, handler, self);
            manifestLoader.reset();
        };

        eventBus.on(Events.INTERNAL_MANIFEST_LOADED, handler, self);

        uriFragmentModel.initialize(url);
        manifestLoader.load(url);
    }

    /**
     * Returns the source string or manifest that was attached by calling attachSource()
     * @returns {string | manifest}
     * @memberof module:MediaPlayer
     * @throws {@link module:MediaPlayer~SOURCE_NOT_ATTACHED_ERROR SOURCE_NOT_ATTACHED_ERROR} if called before attachSource function
     * @instance
     */
    function getSource() {
        if (!source) {
            throw SOURCE_NOT_ATTACHED_ERROR;
        }
        return source;
    }

    /**
     * Use this method to set a source URL to a valid MPD manifest file OR
     * a previously downloaded and parsed manifest object.  Optionally, can
     * also provide protection information
     *
     * @param {string|Object} urlOrManifest - A URL to a valid MPD manifest file, or a
     * parsed manifest object.
     *
     *
     * @throws {@link module:MediaPlayer~MEDIA_PLAYER_NOT_INITIALIZED_ERROR MEDIA_PLAYER_NOT_INITIALIZED_ERROR} if called before initialize function
     *
     * @memberof module:MediaPlayer
     * @instance
     */
    function attachSource(urlOrManifest) {
        if (!mediaPlayerInitialized) {
            throw MEDIA_PLAYER_NOT_INITIALIZED_ERROR;
        }

        if (typeof urlOrManifest === 'string') {
            uriFragmentModel.initialize(urlOrManifest);
        }

        source = urlOrManifest;

        if (streamingInitialized || playbackInitialized) {
            resetPlaybackControllers();
        }

        if (isReady()) {
            initializePlayback();
        }
    }

    /**
     *  Reload the manifest that the player is currently using.
     *
     *  @memberof module:MediaPlayer
     *  @instance
     */
    function refreshManifest() {
        streamController.refreshManifest();
    }

    /**
     * A utility methods which converts UTC timestamp value into a valid time and date string.
     *
     * @param {number} time - UTC timestamp to be converted into date and time.
     * @param {string} locales - a region identifier (i.e. en_US).
     * @param {boolean} hour12 - 12 vs 24 hour. Set to true for 12 hour time formatting.
     * @param {boolean} withDate - default is false. Set to true to append current date to UTC time format.
     * @returns {string} A formatted time and date string.
     * @memberof module:MediaPlayer
     * @instance
     */
    function formatUTC(time, locales, hour12, withDate = false) {
        const dt = new Date(time * 1000);
        const d = dt.toLocaleDateString(locales);
        const t = dt.toLocaleTimeString(locales, {
            hour12: hour12
        });
        return withDate ? t + ' ' + d : t;
    }

    /**
     * A utility method which converts seconds into TimeCode (i.e. 300 --> 05:00).
     *
     * @param {number} value - A number in seconds to be converted into a formatted time code.
     * @returns {string} A formatted time code string.
     * @memberof module:MediaPlayer
     * @instance
     */
    function convertToTimeCode(value) {
        value = Math.max(value, 0);

        let h = Math.floor(value / 3600);
        let m = Math.floor((value % 3600) / 60);
        let s = Math.floor((value % 3600) % 60);
        return (h === 0 ? '' : (h < 10 ? '0' + h.toString() + ':' : h.toString() + ':')) + (m < 10 ? '0' + m.toString() : m.toString()) + ':' + (s < 10 ? '0' + s.toString() : s.toString());
    }

    /**
     * This method should be used to extend or replace internal dash.js objects.
     * There are two ways to extend dash.js (determined by the override argument):
     * <ol>
     * <li>If you set override to true any public method or property in your custom object will
     * override the dash.js parent object's property(ies) and will be used instead but the
     * dash.js parent module will still be created.</li>
     *
     * <li>If you set override to false your object will completely replace the dash.js object.
     * (Note: This is how it was in 1.x of Dash.js with Dijon).</li>
     * </ol>
     * <b>When you extend you get access to this.context, this.factory and this.parent to operate with in your custom object.</b>
     * <ul>
     * <li><b>this.context</b> - can be used to pass context for singleton access.</li>
     * <li><b>this.factory</b> - can be used to call factory.getSingletonInstance().</li>
     * <li><b>this.parent</b> - is the reference of the parent object to call other public methods. (this.parent is excluded if you extend with override set to false or option 2)</li>
     * </ul>
     * <b>You must call extend before you call initialize</b>
     * @see {@link module:MediaPlayer#initialize initialize()}
     * @param {string} parentNameString - name of parent module
     * @param {Object} childInstance - overriding object
     * @param {boolean} override - replace only some methods (true) or the whole object (false)
     * @memberof module:MediaPlayer
     * @instance
     */
    function extend(parentNameString, childInstance, override) {
        FactoryMaker.extend(parentNameString, childInstance, override, context);
    }

    /**
     * This method returns the active stream
     *
     * @throws {@link module:MediaPlayer~STREAMING_NOT_INITIALIZED_ERROR STREAMING_NOT_INITIALIZED_ERROR} if called before initializePlayback function
     * @memberof module:MediaPlayer
     * @instance
     */
    function getActiveStream() {
        if (!streamingInitialized) {
            throw STREAMING_NOT_INITIALIZED_ERROR;
        }
        let streamInfo = streamController.getActiveStreamInfo();
        return streamInfo ? streamController.getStreamById(streamInfo.id) : null;
    }

    //***********************************
    // PRIVATE METHODS
    //***********************************

    function resetPlaybackControllers() {
        playbackInitialized = false;
        streamingInitialized = false;
        adapter.reset();
        streamController.reset();
        playbackController.reset();
        abrController.reset();
        mediaController.reset();
        textController.reset();
        if (protectionController) {
            if (mediaPlayerModel.getKeepProtectionMediaKeys()) {
                protectionController.stop();
            } else {
                protectionController.reset();
                protectionController = null;
                detectProtection();
            }
        }
        videoModel.reset();
    }

    function createPlaybackControllers() {
        // creates or get objects instances
        const manifestLoader = createManifestLoader();

        if (!streamController) {
            streamController = StreamController(context).getInstance();
        }

        // configure controllers
        mediaController.setConfig({
            domStorage: domStorage
        });

        streamController.setConfig({
            capabilities: capabilities,
            manifestLoader: manifestLoader,
            manifestModel: manifestModel,
            dashManifestModel: dashManifestModel,
            mediaPlayerModel: mediaPlayerModel,
            protectionController: protectionController,
            adapter: adapter,
            metricsModel: metricsModel,
            dashMetrics: dashMetrics,
            errHandler: errHandler,
            timelineConverter: timelineConverter,
            videoModel: videoModel,
            playbackController: playbackController,
            domStorage: domStorage,
            abrController: abrController,
            mediaController: mediaController,
            textController: textController
        });

        playbackController.setConfig({
            streamController: streamController,
            metricsModel: metricsModel,
            dashMetrics: dashMetrics,
            manifestModel: manifestModel,
            mediaPlayerModel: mediaPlayerModel,
            dashManifestModel: dashManifestModel,
            adapter: adapter,
            videoModel: videoModel,
            timelineConverter: timelineConverter,
            uriFragmentModel: uriFragmentModel
        });

        abrController.setConfig({
            streamController: streamController,
            domStorage: domStorage,
            mediaPlayerModel: mediaPlayerModel,
            metricsModel: metricsModel,
            dashMetrics: dashMetrics,
            manifestModel: manifestModel,
            videoModel: videoModel,
            adapter: adapter
        });
        abrController.createAbrRulesCollection();

        textController.setConfig({
            errHandler: errHandler,
            manifestModel: manifestModel,
            dashManifestModel: dashManifestModel,
            mediaController: mediaController,
            streamController: streamController,
            videoModel: videoModel
        });

        // initialises controller
        streamController.initialize(autoPlay, protectionData);
    }

    function createManifestLoader() {
        return ManifestLoader(context).create({
            errHandler: errHandler,
            metricsModel: metricsModel,
            mediaPlayerModel: mediaPlayerModel,
            requestModifier: RequestModifier(context).getInstance(),
            mssHandler: mssHandler
        });
    }

    function detectProtection() {
        if (protectionController) {
            return protectionController;
        }
        // do not require Protection as dependencies as this is optional and intended to be loaded separately
        let Protection = dashjs.Protection; /* jshint ignore:line */
        if (typeof Protection === 'function') { //TODO need a better way to register/detect plugin components
            let protection = Protection(context).create();
            Events.extend(Protection.events);
            MediaPlayerEvents.extend(Protection.events, {
                publicOnly: true
            });
            Errors.extend(Protection.errors);
            if (!capabilities) {
                capabilities = Capabilities(context).getInstance();
            }
            protectionController = protection.createProtectionSystem({
                debug: debug,
                errHandler: errHandler,
                videoModel: videoModel,
                capabilities: capabilities,
                eventBus: eventBus,
                events: Events,
                BASE64: BASE64,
                constants: Constants
            });
            return protectionController;
        }

        return null;
    }

    function detectMetricsReporting() {
        if (metricsReportingController) {
            return;
        }
        // do not require MetricsReporting as dependencies as this is optional and intended to be loaded separately
        let MetricsReporting = dashjs.MetricsReporting; /* jshint ignore:line */
        if (typeof MetricsReporting === 'function') { //TODO need a better way to register/detect plugin components
            let metricsReporting = MetricsReporting(context).create();

            metricsReportingController = metricsReporting.createMetricsReporting({
                debug: debug,
                eventBus: eventBus,
                mediaElement: getVideoElement(),
                dashManifestModel: dashManifestModel,
                metricsModel: metricsModel,
                events: Events,
                constants: Constants,
                metricsConstants: MetricsConstants
            });
        }
    }

    function detectMss() {
        if (mssHandler) {
            return;
        }
        // do not require MssHandler as dependencies as this is optional and intended to be loaded separately
        let MssHandler = dashjs.MssHandler; /* jshint ignore:line */
        if (typeof MssHandler === 'function') { //TODO need a better way to register/detect plugin components
            Errors.extend(MssHandler.errors);
            mssHandler = MssHandler(context).create({
                eventBus: eventBus,
                mediaPlayerModel: mediaPlayerModel,
                metricsModel: metricsModel,
                manifestModel: manifestModel,
                playbackController: playbackController,
                protectionController: protectionController,
                baseURLController: BaseURLController(context).getInstance(),
                errHandler: errHandler,
                events: Events,
                constants: Constants,
                debug: debug,
                initSegmentType: HTTPRequest.INIT_SEGMENT_TYPE,
                BASE64: BASE64,
                ISOBoxer: ISOBoxer
            });
        }
    }

    function getDVRInfoMetric() {
        let metric = metricsModel.getReadOnlyMetricsFor(Constants.VIDEO) || metricsModel.getReadOnlyMetricsFor(Constants.AUDIO);
        return dashMetrics.getCurrentDVRInfo(metric);
    }

    function getAsUTC(valToConvert) {
        let metric = getDVRInfoMetric();
        let availableFrom,
            utcValue;

        if (!metric) {
            return 0;
        }
        availableFrom = metric.manifestInfo.availableFrom.getTime() / 1000;
        utcValue = valToConvert + (availableFrom + metric.range.start);
        return utcValue;
    }

    function initializePlayback() {
        if (!streamingInitialized && source) {
            streamingInitialized = true;
            logger.info('Streaming Initialized');
            createPlaybackControllers();

            if (typeof source === 'string') {
                streamController.load(source);
            } else {
                streamController.loadWithManifest(source);
            }
        }

        if (!playbackInitialized && isReady()) {
            playbackInitialized = true;
            logger.info('Playback Initialized');
        }
    }

    instance = {
        initialize: initialize,
        setConfig: setConfig,
        on: on,
        off: off,
        extend: extend,
        attachView: attachView,
        detachView: detachView,
        reattachView: reattachView,
        attachSource: attachSource,
        isReady: isReady,
        preload: preload,
        play: play,
        isPaused: isPaused,
        pause: pause,
        isSeeking: isSeeking,
        isDynamic: isDynamic,
        seek: seek,
        setPlaybackRate: setPlaybackRate,
        getPlaybackRate: getPlaybackRate,
        setMute: setMute,
        isMuted: isMuted,
        setVolume: setVolume,
        getVolume: getVolume,
        time: time,
        duration: duration,
        setDuration: setDuration,
        timeAsUTC: timeAsUTC,
        durationAsUTC: durationAsUTC,
        getActiveStream: getActiveStream,
        getDVRWindowSize: getDVRWindowSize,
        getDVRSeekOffset: getDVRSeekOffset,
        convertToTimeCode: convertToTimeCode,
        formatUTC: formatUTC,
        getVersion: getVersion,
        getDebug: getDebug,
        getBufferLength: getBufferLength,
        getTTMLRenderingDiv: getTTMLRenderingDiv,
        getVideoElement: getVideoElement,
        getSource: getSource,
        setLiveDelayFragmentCount: setLiveDelayFragmentCount,
        setLiveDelay: setLiveDelay,
        getLiveDelay: getLiveDelay,
        getCurrentLiveLatency: getCurrentLiveLatency,
        useSuggestedPresentationDelay: useSuggestedPresentationDelay,
        enableLastBitrateCaching: enableLastBitrateCaching,
        enableLastMediaSettingsCaching: enableLastMediaSettingsCaching,
        setMaxAllowedBitrateFor: setMaxAllowedBitrateFor,
        getMaxAllowedBitrateFor: getMaxAllowedBitrateFor,
        getTopBitrateInfoFor: getTopBitrateInfoFor,
        setMinAllowedBitrateFor: setMinAllowedBitrateFor,
        getMinAllowedBitrateFor: getMinAllowedBitrateFor,
        setMaxAllowedRepresentationRatioFor: setMaxAllowedRepresentationRatioFor,
        getMaxAllowedRepresentationRatioFor: getMaxAllowedRepresentationRatioFor,
        setAutoPlay: setAutoPlay,
        getAutoPlay: getAutoPlay,
        setScheduleWhilePaused: setScheduleWhilePaused,
        getScheduleWhilePaused: getScheduleWhilePaused,
        getDashMetrics: getDashMetrics,
        getMetricsFor: getMetricsFor,
        getQualityFor: getQualityFor,
        setQualityFor: setQualityFor,
        updatePortalSize: updatePortalSize,
        getLimitBitrateByPortal: getLimitBitrateByPortal,
        setLimitBitrateByPortal: setLimitBitrateByPortal,
        getUsePixelRatioInLimitBitrateByPortal: getUsePixelRatioInLimitBitrateByPortal,
        setUsePixelRatioInLimitBitrateByPortal: setUsePixelRatioInLimitBitrateByPortal,
        setTextDefaultLanguage: setTextDefaultLanguage,
        getTextDefaultLanguage: getTextDefaultLanguage,
        setTextDefaultEnabled: setTextDefaultEnabled,
        getTextDefaultEnabled: getTextDefaultEnabled,
        enableText: enableText,
        enableForcedTextStreaming: enableForcedTextStreaming,
        isTextEnabled: isTextEnabled,
        setTextTrack: setTextTrack,
        getBitrateInfoListFor: getBitrateInfoListFor,
        setInitialBitrateFor: setInitialBitrateFor,
        getInitialBitrateFor: getInitialBitrateFor,
        setInitialRepresentationRatioFor: setInitialRepresentationRatioFor,
        getInitialRepresentationRatioFor: getInitialRepresentationRatioFor,
        getStreamsFromManifest: getStreamsFromManifest,
        getTracksFor: getTracksFor,
        getTracksForTypeFromManifest: getTracksForTypeFromManifest,
        getCurrentTrackFor: getCurrentTrackFor,
        setInitialMediaSettingsFor: setInitialMediaSettingsFor,
        getInitialMediaSettingsFor: getInitialMediaSettingsFor,
        setCurrentTrack: setCurrentTrack,
        getTrackSwitchModeFor: getTrackSwitchModeFor,
        setTrackSwitchModeFor: setTrackSwitchModeFor,
        setSelectionModeForInitialTrack: setSelectionModeForInitialTrack,
        getSelectionModeForInitialTrack: getSelectionModeForInitialTrack,
        setFastSwitchEnabled: setFastSwitchEnabled,
        getFastSwitchEnabled: getFastSwitchEnabled,
        setMovingAverageMethod: setMovingAverageMethod,
        getMovingAverageMethod: getMovingAverageMethod,
        getAutoSwitchQualityFor: getAutoSwitchQualityFor,
        setAutoSwitchQualityFor: setAutoSwitchQualityFor,
        setABRStrategy: setABRStrategy,
        getABRStrategy: getABRStrategy,
        useDefaultABRRules: useDefaultABRRules,
        addABRCustomRule: addABRCustomRule,
        removeABRCustomRule: removeABRCustomRule,
        removeAllABRCustomRule: removeAllABRCustomRule,
        setBandwidthSafetyFactor: setBandwidthSafetyFactor,
        getBandwidthSafetyFactor: getBandwidthSafetyFactor,
        getAverageThroughput: getAverageThroughput,
        setAbandonLoadTimeout: setAbandonLoadTimeout,
        retrieveManifest: retrieveManifest,
        addUTCTimingSource: addUTCTimingSource,
        removeUTCTimingSource: removeUTCTimingSource,
        clearDefaultUTCTimingSources: clearDefaultUTCTimingSources,
        restoreDefaultUTCTimingSources: restoreDefaultUTCTimingSources,
        setBufferToKeep: setBufferToKeep,
        setBufferAheadToKeep: setBufferAheadToKeep,
        setBufferPruningInterval: setBufferPruningInterval,
        setStableBufferTime: setStableBufferTime,
        getStableBufferTime: getStableBufferTime,
        setBufferTimeAtTopQuality: setBufferTimeAtTopQuality,
        getBufferTimeAtTopQuality: getBufferTimeAtTopQuality,
        setBufferTimeAtTopQualityLongForm: setBufferTimeAtTopQualityLongForm,
        getBufferTimeAtTopQualityLongForm: getBufferTimeAtTopQualityLongForm,
        setFragmentLoaderRetryAttempts: setFragmentLoaderRetryAttempts,
        setFragmentLoaderRetryInterval: setFragmentLoaderRetryInterval,
        setManifestLoaderRetryAttempts: setManifestLoaderRetryAttempts,
        setManifestLoaderRetryInterval: setManifestLoaderRetryInterval,
        setXHRWithCredentialsForType: setXHRWithCredentialsForType,
        getXHRWithCredentialsForType: getXHRWithCredentialsForType,
        setJumpGaps: setJumpGaps,
        getJumpGaps: getJumpGaps,
        setSmallGapLimit: setSmallGapLimit,
        getSmallGapLimit: getSmallGapLimit,
        setLowLatencyEnabled: setLowLatencyEnabled,
        getLowLatencyEnabled: getLowLatencyEnabled,
        setCatchUpPlaybackRate: setCatchUpPlaybackRate,
        getCatchUpPlaybackRate: getCatchUpPlaybackRate,
        setLowLatencyMinDrift: setLowLatencyMinDrift,
        getLowLatencyMinDrift: getLowLatencyMinDrift,
        setLowLatencyMaxDriftBeforeSeeking: setLowLatencyMaxDriftBeforeSeeking,
        getLowLatencyMaxDriftBeforeSeeking: getLowLatencyMaxDriftBeforeSeeking,
        setManifestUpdateRetryInterval: setManifestUpdateRetryInterval,
        getManifestUpdateRetryInterval: getManifestUpdateRetryInterval,
        setLongFormContentDurationThreshold: setLongFormContentDurationThreshold,
        setSegmentOverlapToleranceTime: setSegmentOverlapToleranceTime,
        setCacheLoadThresholdForType: setCacheLoadThresholdForType,
        getProtectionController: getProtectionController,
        attachProtectionController: attachProtectionController,
        setProtectionData: setProtectionData,
        enableManifestDateHeaderTimeSource: enableManifestDateHeaderTimeSource,
        displayCaptionsOnTop: displayCaptionsOnTop,
        attachVideoContainer: attachVideoContainer,
        attachTTMLRenderingDiv: attachTTMLRenderingDiv,
        getCurrentTextTrackIndex: getCurrentTextTrackIndex,
        getUseDeadTimeLatencyForAbr: getUseDeadTimeLatencyForAbr,
        setUseDeadTimeLatencyForAbr: setUseDeadTimeLatencyForAbr,
        refreshManifest: refreshManifest,
        setPortalScale: setPortalScale,
        getPortalScale: getPortalScale,
        getPortalLimitMinimum: getPortalLimitMinimum,
        setPortalLimitMinimum: setPortalLimitMinimum,
        getThumbnail: getThumbnail,
        keepProtectionMediaKeys: keepProtectionMediaKeys,
        reset: reset
    };

    setup();

    return instance;
}

MediaPlayer.__dashjs_factory_name = 'MediaPlayer';
const factory = FactoryMaker.getClassFactory(MediaPlayer);
factory.events = MediaPlayerEvents;
factory.errors = Errors;
FactoryMaker.updateClassFactory(MediaPlayer.__dashjs_factory_name, factory);

export default factory;
