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
import Constants from '../constants/Constants';
import FragmentModel from '../models/FragmentModel';
import SourceBufferSink from '../SourceBufferSink';
import PreBufferSink from '../PreBufferSink';
import AbrController from './AbrController';
import MediaController from './MediaController';
import EventBus from '../../core/EventBus';
import Events from '../../core/events/Events';
import BoxParser from '../utils/BoxParser';
import FactoryMaker from '../../core/FactoryMaker';
import Debug from '../../core/Debug';
import InitCache from '../utils/InitCache';
import VideoModel from '../models/VideoModel';

const BUFFER_LOADED = 'bufferLoaded';
const BUFFER_EMPTY = 'bufferStalled';
const STALL_THRESHOLD = 0.5;
const QUOTA_EXCEEDED_ERROR_CODE = 22;
const BUFFER_LENGTH_TO_KEEP_ON_TRACK_CHANGE = 2;

const BUFFER_CONTROLLER_TYPE = 'BufferController';

function BufferController(config) {
    const context = this.context;
    const eventBus = EventBus(context).getInstance();
    const metricsModel = config.metricsModel;
    const mediaPlayerModel = config.mediaPlayerModel;
    const errHandler = config.errHandler;
    const streamController = config.streamController;
    const mediaController = config.mediaController;
    const adapter = config.adapter;
    const textController = config.textController;
    const abrController = config.abrController;
    const playbackController = config.playbackController;
    const type = config.type;
    const streamProcessor = config.streamProcessor;

    let instance,
        log,
        requiredQuality,
        isBufferingCompleted,
        bufferLevel,
        criticalBufferLevel,
        mediaSource,
        maxAppendedIndex,
        lastIndex,
        buffer,
        dischargeBuffer,
        bufferState,
        appendedBytesInfo,
        wallclockTicked,
        appendingMediaChunk,
        isPruningInProgress,
        videoModel,
        initCache,
        seekStartTime,
        seekClearedBufferingCompleted,
        isSafariOnMac;

    function setup() {
        log = Debug(context).getInstance().log.bind(instance);
        initCache = InitCache(context).getInstance();

        resetInitialSettings();
    }

    function getBufferControllerType() {
        return BUFFER_CONTROLLER_TYPE;
    }

    function initialize(Source) {
        setMediaSource(Source);
        videoModel = VideoModel(context).getInstance();

        requiredQuality = abrController.getQualityFor(type, streamProcessor.getStreamInfo());
        const ua = navigator.userAgent.toLowerCase();
        //This whole test is just for safari on a mac.
        isSafariOnMac = /safari/.test(ua) && /mac/.test(ua) && !/chrome/.test(ua) && !/windows phone/.test(ua);

        eventBus.on(Events.DATA_UPDATE_COMPLETED, onDataUpdateCompleted, this);
        eventBus.on(Events.INIT_FRAGMENT_LOADED, onInitFragmentLoaded, this);
        eventBus.on(Events.MEDIA_FRAGMENT_LOADED, onMediaFragmentLoaded, this);
        eventBus.on(Events.QUALITY_CHANGE_REQUESTED, onQualityChanged, this);
        eventBus.on(Events.STREAM_COMPLETED, onStreamCompleted, this);
        eventBus.on(Events.PLAYBACK_PROGRESS, onPlaybackProgression, this);
        eventBus.on(Events.PLAYBACK_TIME_UPDATED, onPlaybackProgression, this);
        eventBus.on(Events.PLAYBACK_RATE_CHANGED, onPlaybackRateChanged, this);
        eventBus.on(Events.PLAYBACK_SEEKING, onPlaybackSeeking, this);
        eventBus.on(Events.WALLCLOCK_TIME_UPDATED, onWallclockTimeUpdated, this);
        eventBus.on(Events.CURRENT_TRACK_CHANGED, onCurrentTrackChanged, this, EventBus.EVENT_PRIORITY_HIGH);
        eventBus.on(Events.SOURCEBUFFER_REMOVE_COMPLETED, onRemoved, this);

        if (isSafariOnMac) {
            eventBus.on(Events.PLAYBACK_SEEKED, onSeeked, this);
        }
    }

    function createBuffer(mediaInfo) {
        if (!initCache || !mediaInfo || !streamProcessor) return null;
        if (mediaSource) {
            try {
                buffer = SourceBufferSink(context).create(mediaSource, mediaInfo, onAppended.bind(this));
                if (typeof buffer.getBuffer().initialize === 'function') {
                    buffer.getBuffer().initialize(type, streamProcessor);
                }
            } catch (e) {
                log('Caught error on create SourceBuffer: ' + e);
                errHandler.mediaSourceError('Error creating ' + type + ' source buffer.');
            }
        } else {
            buffer = PreBufferSink(context).create(onAppended.bind(this));
        }
        updateBufferTimestampOffset(streamProcessor.getRepresentationInfoForQuality(requiredQuality).MSETimeOffset);
    }

    function dischargePreBuffer() {
        if (buffer && dischargeBuffer && typeof dischargeBuffer.discharge === 'function') {
            const ranges = dischargeBuffer.getAllBufferRanges();

            if (ranges.length > 0) {
                let rangeStr = 'Beginning ' + type + 'PreBuffer discharge, adding buffer for:';
                for (let i = 0; i < ranges.length; i++) {
                    rangeStr += ' start: ' + ranges.start(i) + ', end: ' + ranges.end(i) + ';';
                }
                log(rangeStr);
            } else {
                log('PreBuffer discharge requested, but the PreBuffer was empty.');
            }

            let chunks = dischargeBuffer.discharge();
            let lastInit = null;
            for (let j = 0; j < chunks.length; j++) {
                const chunk = chunks[j];
                const initChunk = initCache.extract(chunk.streamId, chunk.representationId);
                if (initChunk) {
                    if (lastInit !== initChunk) {
                        buffer.append(initChunk);
                        lastInit = initChunk;
                    }
                    buffer.append(chunk); //TODO Think about supressing buffer events the second time round after a discharge?
                }
            }

            dischargeBuffer.reset();
            dischargeBuffer = null;
        }
    }

    function isActive() {
        return streamProcessor && streamController ? streamProcessor.getStreamInfo().id === streamController.getActiveStreamInfo().id : false;
    }

    function onInitFragmentLoaded(e) {
        if (e.fragmentModel !== streamProcessor.getFragmentModel()) return;
        log('Init fragment finished loading saving to', type + '\'s init cache');
        initCache.save(e.chunk);
        appendToBuffer(e.chunk);
    }

    function switchInitData(streamId, representationId) {
        const chunk = initCache.extract(streamId, representationId);
        if (chunk) {
            appendToBuffer(chunk);
        } else {
            eventBus.trigger(Events.INIT_REQUESTED, {sender: instance});
        }
    }

    function onMediaFragmentLoaded(e) {
        if (e.fragmentModel !== streamProcessor.getFragmentModel()) return;

        const chunk = e.chunk;
        const bytes = chunk.bytes;
        const quality = chunk.quality;
        const currentRepresentation = streamProcessor.getRepresentationInfoForQuality(quality);
        const eventStreamMedia = adapter.getEventsFor(currentRepresentation.mediaInfo, streamProcessor);
        const eventStreamTrack = adapter.getEventsFor(currentRepresentation, streamProcessor);

        if (eventStreamMedia && eventStreamMedia.length > 0 || eventStreamTrack && eventStreamTrack.length > 0) {
            const request = streamProcessor.getFragmentModel().getRequests({
                state: FragmentModel.FRAGMENT_MODEL_EXECUTED,
                quality: quality,
                index: chunk.index
            })[0];

            const events = handleInbandEvents(bytes, request, eventStreamMedia, eventStreamTrack);
            streamProcessor.getEventController().addInbandEvents(events);
        }

        appendToBuffer(chunk);
    }


    function appendToBuffer(chunk) {
        buffer.append(chunk);

        if (chunk.mediaInfo.type === Constants.VIDEO) {
            eventBus.trigger(Events.VIDEO_CHUNK_RECEIVED, {chunk: chunk});
        }
    }

    function onQualityChanged(e) {
        if (requiredQuality === e.newQuality || type !== e.mediaType || streamProcessor.getStreamInfo().id !== e.streamInfo.id) return;

        updateBufferTimestampOffset(streamProcessor.getRepresentationInfoForQuality(e.newQuality).MSETimeOffset);
        requiredQuality = e.newQuality;
    }

    //**********************************************************************
    // START Buffer Level, State & Sufficiency Handling.
    //**********************************************************************
    function onPlaybackSeeking() {
        if (isBufferingCompleted) {
            seekClearedBufferingCompleted = true;
            isBufferingCompleted = false;
            maxAppendedIndex = 0;
        }
        seekStartTime = undefined;
        onPlaybackProgression();
    }

    function getWorkingTime() {
        // This function returns current working time for buffer (either start time or current time if playback has started)
        let ret = playbackController.getTime();

        if (seekStartTime) {
            // if there is a seek start time, the first buffer data will be available on maximum value between first buffer range value and seek start time.
            let ranges = buffer.getAllBufferRanges();
            if (ranges && ranges.length) {
                ret = Math.max(ranges.start(0), seekStartTime);
            }
        }
        return ret;
    }

    function onPlaybackProgression() {
        updateBufferLevel();
        addBufferMetrics();
    }

    function getRangeAt(time, tolerance) {
        const ranges = buffer.getAllBufferRanges();
        let start = 0;
        let end = 0;
        let firstStart = null;
        let lastEnd = null;
        let gap = 0;
        let len,
            i;

        const toler = (tolerance || 0.15);

        if (ranges !== null && ranges !== undefined) {
            for (i = 0, len = ranges.length; i < len; i++) {
                start = ranges.start(i);
                end = ranges.end(i);
                if (firstStart === null) {
                    gap = Math.abs(start - time);
                    if (time >= start && time < end) {
                        // start the range
                        firstStart = start;
                        lastEnd = end;
                    } else if (gap <= toler) {
                        // start the range even though the buffer does not contain time 0
                        firstStart = start;
                        lastEnd = end;
                    }
                } else {
                    gap = start - lastEnd;
                    if (gap <= toler) {
                        // the discontinuity is smaller than the tolerance, combine the ranges
                        lastEnd = end;
                    } else {
                        break;
                    }
                }
            }

            if (firstStart !== null) {
                return {
                    start: firstStart,
                    end: lastEnd
                };
            }
        }

        return null;
    }

    function getBufferLength(time, tolerance) {
        let range,
            length;

        range = getRangeAt(time, tolerance);

        if (range === null) {
            length = 0;
        } else {
            length = range.end - time;
        }

        return length;
    }

    function updateBufferLevel() {
        if (playbackController) {
            bufferLevel = getBufferLength(getWorkingTime() || 0);
            eventBus.trigger(Events.BUFFER_LEVEL_UPDATED, {sender: instance, bufferLevel: bufferLevel});
            checkIfSufficientBuffer();
        }
    }

    function addBufferMetrics() {
        if (!isActive()) return;
        metricsModel.addBufferState(type, bufferState, streamProcessor.getScheduleController().getBufferTarget());
        metricsModel.addBufferLevel(type, new Date(), bufferLevel * 1000);
    }

    function checkIfBufferingCompleted() {
        const isLastIdxAppended = maxAppendedIndex >= lastIndex - 1; // Handles 0 and non 0 based request index
        if (isLastIdxAppended && !isBufferingCompleted && buffer.discharge === undefined) {
            isBufferingCompleted = true;
            eventBus.trigger(Events.BUFFERING_COMPLETED, {sender: instance, streamInfo: streamProcessor.getStreamInfo()});
        }
    }

    function checkIfSufficientBuffer() {
        // No need to check buffer if type is not audio or video (for example if several errors occur during text parsing, so that the buffer cannot be filled, no error must occur on video playback)
        if (type !== 'audio' && type !== 'video') return;

        if (seekClearedBufferingCompleted && !isBufferingCompleted && playbackController && playbackController.getTimeToStreamEnd() - bufferLevel < STALL_THRESHOLD) {
            seekClearedBufferingCompleted = false;
            isBufferingCompleted = true;
            eventBus.trigger(Events.BUFFERING_COMPLETED, {sender: instance, streamInfo: streamProcessor.getStreamInfo()});
        }
        if (bufferLevel < STALL_THRESHOLD && !isBufferingCompleted) {
            var videoElement = videoModel.getElement();
            if (videoElement) {
                var t = videoElement.currentTime;
                var d = videoElement.duration;
                if (d - t > STALL_THRESHOLD || isNaN(d)) {
                    notifyBufferStateChanged(BUFFER_EMPTY);
                    return;
                }
            } else {
                return;
            }
        }
        notifyBufferStateChanged(BUFFER_LOADED);
    }

    function notifyBufferStateChanged(state) {
        if (bufferState === state || (type === Constants.FRAGMENTED_TEXT && textController.getAllTracksAreDisabled())) return;
        bufferState = state;
        addBufferMetrics();
        eventBus.trigger(Events.BUFFER_LEVEL_STATE_CHANGED, {sender: instance, state: state, mediaType: type, streamInfo: streamProcessor.getStreamInfo()});
        eventBus.trigger(state === BUFFER_LOADED ? Events.BUFFER_LOADED : Events.BUFFER_EMPTY, {mediaType: type});
        log(state === BUFFER_LOADED ? 'Got enough buffer to start.' : 'Waiting for more buffer before starting playback.');
    }


    function handleInbandEvents(data, request, mediaInbandEvents, trackInbandEvents) {
        const fragmentStartTime = Math.max(isNaN(request.startTime) ? 0 : request.startTime, 0);
        const eventStreams = [];
        const events = [];

        /* Extract the possible schemeIdUri : If a DASH client detects an event message box with a scheme that is not defined in MPD, the client is expected to ignore it */
        const inbandEvents = mediaInbandEvents.concat(trackInbandEvents);
        for (let i = 0, ln = inbandEvents.length; i < ln; i++) {
            eventStreams[inbandEvents[i].schemeIdUri] = inbandEvents[i];
        }

        const isoFile = BoxParser(context).getInstance().parse(data);
        const eventBoxes = isoFile.getBoxes('emsg');

        for (let i = 0, ln = eventBoxes.length; i < ln; i++) {
            const event = adapter.getEvent(eventBoxes[i], eventStreams, fragmentStartTime);

            if (event) {
                events.push(event);
            }
        }

        return events;
    }

    /* prune buffer on our own in background to avoid browsers pruning buffer silently */
    function pruneBuffer() {
        if (!buffer) return;
        if (type === Constants.FRAGMENTED_TEXT) return;
        const buffered = buffer.getAllBufferRanges();
        const start = buffered.length ? buffered.start(0) : 0;
        const bufferToPrune = playbackController.getTime() - start - mediaPlayerModel.getBufferToKeep();
        if (bufferToPrune > 0) {
            log('pruning buffer: ' + bufferToPrune + ' seconds.');
            isPruningInProgress = true;
            buffer.remove(0, Math.round(start + bufferToPrune));
        }
    }

    function getBehindRangeToClear(threshold) {
        if (!buffer) return null;
        const buffered = buffer.getAllBufferRanges();
        if (!buffered || buffered.length <= 0) return null;

        // we need to remove data that is more than one fragment before the video currentTime
        const currentTime = playbackController.getTime();
        const req = streamProcessor.getFragmentModel().getRequests({state: FragmentModel.FRAGMENT_MODEL_EXECUTED, time: currentTime, threshold: threshold})[0];
        const range = getRangeAt(currentTime);

        let removeEnd = (req && !isNaN(req.startTime)) ? req.startTime : Math.floor(currentTime);
        if ((range === null) && (buffered.length > 0)) {
            removeEnd = buffered.end(buffered.length - 1);
        }

        return {
            start: buffered.start(0),
            end: removeEnd
        };
    }

    function getAheadRangeToClear(bufferToKeep) {
        if (!buffer) return null;
        const buffered = buffer.getAllBufferRanges();
        if (!buffered || buffered.length <= 0) return null;

        // we need to remove data that is more than one fragment before the video currentTime
        const removeStart = playbackController.getTime() + (bufferToKeep > 0 ? bufferToKeep : 0);
        const removeEnd = buffered.end(buffered.length - 1);
        if (removeStart >= removeEnd) return null;

        return {
            start: removeStart,
            end: removeEnd
        };
    }

    function clearBuffer(range, forceRemoval) {
        if (!range || !buffer) return;
        buffer.remove(range.start, range.end, mediaSource, forceRemoval);
    }

    function updateBufferTimestampOffset(MSETimeOffset) {
        // Each track can have its own @presentationTimeOffset, so we should set the offset
        // if it has changed after switching the quality or updating an mpd
        const sourceBuffer = buffer && buffer.getBuffer ? buffer.getBuffer() : null;
        if (sourceBuffer && sourceBuffer.timestampOffset !== MSETimeOffset && !isNaN(MSETimeOffset)) {
            sourceBuffer.timestampOffset = MSETimeOffset;
        }
    }

    function onDataUpdateCompleted(e) {
        if (e.sender.getStreamProcessor() !== streamProcessor || e.error) return;
        updateBufferTimestampOffset(e.currentRepresentation.MSETimeOffset);
    }

    function onStreamCompleted(e) {
        if (e.fragmentModel !== streamProcessor.getFragmentModel()) return;
        lastIndex = e.request.index;
        checkIfBufferingCompleted();
    }

    function onCurrentTrackChanged(e) {
        if (!buffer || (e.newMediaInfo.type !== type) || (e.newMediaInfo.streamInfo.id !== streamProcessor.getStreamInfo().id)) return;
        if (mediaController.getSwitchMode(type) === MediaController.TRACK_SWITCH_MODE_ALWAYS_REPLACE) {
            clearPlaybackBuffer(BUFFER_LENGTH_TO_KEEP_ON_TRACK_CHANGE);
        }
    }

    function clearPlaybackBuffer(bufferAheadToKeep) {
        clearBuffer(getBehindRangeToClear(0));
        const aheadRange = getAheadRangeToClear(bufferAheadToKeep);
        if (aheadRange) {
            isBufferingCompleted = false;
            maxAppendedIndex = 0;

            const currentTime = playbackController.getTime();
            streamProcessor.getScheduleController().setSeekTarget(currentTime);
            adapter.setIndexHandlerTime(streamProcessor, currentTime);
            clearBuffer(aheadRange, true);
        }
    }

    function onWallclockTimeUpdated() {
        wallclockTicked++;
        const secondsElapsed = (wallclockTicked * (mediaPlayerModel.getWallclockTimeUpdateInterval() / 1000));
        if ((secondsElapsed >= mediaPlayerModel.getBufferPruningInterval())) {
            wallclockTicked = 0;
            pruneBuffer();
        }
    }

    /*
     * Listener set only for MacOS Safari.
     * MacOS Safari doesn't like buffer being appended to the start of a buffered range.
     * It removes a little bit of buffer just after the segment we append.
     * Therefore, let's remove all buffer ahead of us after a seek.
     */
    function onSeeked() {
        removeBufferAhead(playbackController.getTime());
    }

    //Removes buffered ranges ahead. It will not remove anything part of the current buffer timeRange.
    function removeBufferAhead(time) {
        const ranges = buffer.getAllBufferRanges();
        for (let i = 0; i < ranges.length; i++) {
            if (ranges.start(i) > time) {
                log('Removing buffer from: ' + ranges.start(i) + '-' + ranges.end(i));
                buffer.remove(ranges.start(i), ranges.end(i));
            }
        }
    }

    function onPlaybackRateChanged() {
        checkIfSufficientBuffer();
    }

    function getType() {
        return type;
    }

    function getStreamProcessor() {
        return streamProcessor;
    }

    function setSeekStartTime(value) {
        seekStartTime = value;
    }

    function getBuffer() {
        return buffer;
    }

    function getBufferLevel() {
        return bufferLevel;
    }

    function setMediaSource(value, mediaInfo) {
        mediaSource = value;
        if (buffer && mediaInfo) { //if we have a prebuffer, we should prepare to discharge it, and make a new sourceBuffer ready
            if (typeof buffer.discharge === 'function') {
                dischargeBuffer = buffer;
                createBuffer(mediaInfo);
            }
        }
    }

    function getMediaSource() {
        return mediaSource;
    }

    function getIsBufferingCompleted() {
        return isBufferingCompleted;
    }

    function onAppended(e) {
        appendedBytesInfo = e.chunk;
        if (appendedBytesInfo && !isNaN(appendedBytesInfo.index)) {
            maxAppendedIndex = Math.max(appendedBytesInfo.index, maxAppendedIndex);
            checkIfBufferingCompleted();
        }

        onPlaybackProgression();

        const ranges = buffer.getAllBufferRanges();
        if (ranges && ranges.length > 0) {
            for (let i = 0, len = ranges.length; i < len; i++) {
                log('Buffered Range for type:', type , ':' ,ranges.start(i) ,  ' - ' ,  ranges.end(i));
            }
        }

        let closestEndDifference = NaN;
        let closestRange = NaN;
        for (let i = 0; i < ranges.length; i++) {
            let endDifference = ranges.end(i) - e.chunk.end;
            if (endDifference < 0) {
                endDifference = -endDifference;
            }
            if ((closestEndDifference > endDifference) || isNaN(closestEndDifference) ) {
                closestEndDifference = endDifference;
                closestRange = i;
            }
        }

        if (!isNaN(closestRange) && !isNaN(e.chunk.end)) {
            console.log('#a ' + e.chunk.mediaInfo.type + '-manifest: ' + (ranges.end(closestRange) - e.chunk.end).toFixed(2) + '; media: ' + ranges.end(closestRange).toFixed(2) + '; manifest: ' + e.chunk.end.toFixed(2));
        }

        if (appendedBytesInfo) {
            eventBus.trigger(Events.BYTES_APPENDED, {
                sender: instance,
                quality: appendedBytesInfo.quality,
                startTime: appendedBytesInfo.start,
                index: appendedBytesInfo.index,
                bufferedRanges: ranges
            });
        }

        if (e.error) {
            if (e.error.code === QUOTA_EXCEEDED_ERROR_CODE) {
                criticalBufferLevel = getTotalBufferedTime() * 0.8;
            }
            if (e.error.code === QUOTA_EXCEEDED_ERROR_CODE || !hasEnoughSpaceToAppend()) {
                eventBus.trigger(Events.QUOTA_EXCEEDED, {sender: instance, criticalBufferLevel: criticalBufferLevel}); //Tells ScheduleController to stop scheduling.
                clearPlaybackBuffer(mediaPlayerModel.getStableBufferTime());
            }
        }
    }

    function onRemoved(e) {
        if (buffer !== e.buffer) return;

        if (isPruningInProgress) {
            isPruningInProgress = false;
        }

        updateBufferLevel();
        eventBus.trigger(Events.BUFFER_CLEARED, {sender: instance, from: e.from, to: e.to, hasEnoughSpaceToAppend: hasEnoughSpaceToAppend()});
        //TODO - REMEMBER removed a timerout hack calling clearBuffer after manifestInfo.minBufferTime * 1000 if !hasEnoughSpaceToAppend() Aug 04 2016
    }

    function getTotalBufferedTime() {
        const ranges = buffer.getAllBufferRanges();
        let totalBufferedTime = 0;
        let ln,
            i;

        if (!ranges) return totalBufferedTime;

        for (i = 0, ln = ranges.length; i < ln; i++) {
            totalBufferedTime += ranges.end(i) - ranges.start(i);
        }

        return totalBufferedTime;
    }

    function hasEnoughSpaceToAppend() {
        const totalBufferedTime = getTotalBufferedTime();
        return (totalBufferedTime < criticalBufferLevel);
    }

    function resetInitialSettings() {
        criticalBufferLevel = Number.POSITIVE_INFINITY;
        bufferState = BUFFER_EMPTY;
        requiredQuality = AbrController.QUALITY_DEFAULT;
        lastIndex = Number.POSITIVE_INFINITY;
        maxAppendedIndex = 0;
        appendedBytesInfo = null;
        appendingMediaChunk = false;
        isBufferingCompleted = false;
        isPruningInProgress = false;
        seekClearedBufferingCompleted = false;
        bufferLevel = 0;
        wallclockTicked = 0;
    }

    function reset(errored) {
        eventBus.off(Events.DATA_UPDATE_COMPLETED, onDataUpdateCompleted, this);
        eventBus.off(Events.QUALITY_CHANGE_REQUESTED, onQualityChanged, this);
        eventBus.off(Events.INIT_FRAGMENT_LOADED, onInitFragmentLoaded, this);
        eventBus.off(Events.MEDIA_FRAGMENT_LOADED, onMediaFragmentLoaded, this);
        eventBus.off(Events.STREAM_COMPLETED, onStreamCompleted, this);
        eventBus.off(Events.CURRENT_TRACK_CHANGED, onCurrentTrackChanged, this);
        eventBus.off(Events.PLAYBACK_PROGRESS, onPlaybackProgression, this);
        eventBus.off(Events.PLAYBACK_TIME_UPDATED, onPlaybackProgression, this);
        eventBus.off(Events.PLAYBACK_RATE_CHANGED, onPlaybackRateChanged, this);
        eventBus.off(Events.PLAYBACK_SEEKING, onPlaybackSeeking, this);
        eventBus.off(Events.WALLCLOCK_TIME_UPDATED, onWallclockTimeUpdated, this);
        eventBus.off(Events.SOURCEBUFFER_REMOVE_COMPLETED, onRemoved, this);
        eventBus.off(Events.PLAYBACK_SEEKED, onSeeked, this);

        if (isSafariOnMac) {
            eventBus.off(Events.PLAYBACK_SEEKED, onSeeked, this);
        }

        if (buffer) {
            if (!errored) {
                buffer.abort();
            }
            buffer.reset();
            buffer = null;
        }

        resetInitialSettings();
    }

    instance = {
        getBufferControllerType: getBufferControllerType,
        initialize: initialize,
        createBuffer: createBuffer,
        dischargePreBuffer: dischargePreBuffer,
        getType: getType,
        getStreamProcessor: getStreamProcessor,
        setSeekStartTime: setSeekStartTime,
        getBuffer: getBuffer,
        getBufferLevel: getBufferLevel,
        getRangeAt: getRangeAt,
        setMediaSource: setMediaSource,
        getMediaSource: getMediaSource,
        getIsBufferingCompleted: getIsBufferingCompleted,
        switchInitData: switchInitData,
        reset: reset
    };

    setup();
    return instance;
}

BufferController.__dashjs_factory_name = BUFFER_CONTROLLER_TYPE;
const factory = FactoryMaker.getClassFactory(BufferController);
factory.BUFFER_LOADED = BUFFER_LOADED;
factory.BUFFER_EMPTY = BUFFER_EMPTY;
FactoryMaker.updateClassFactory(BufferController.__dashjs_factory_name, factory);
export default factory;
