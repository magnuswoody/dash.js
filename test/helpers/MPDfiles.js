// The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
//
// Copyright (c) 2013, Microsoft Open Technologies, Inc.
//
// All rights reserved.
// Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
//     -             Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
//     -             Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
//     -             Neither the name of the Microsoft Open Technologies, Inc. nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

//This file contains valid MPD strings

var strMpd = {

    //http://dash.edgesuite.net/dash264/TestCases/1b/thomson-networks/manifest.mpd
    test1c: '<?xml version="1.0"?>\
                <MPD xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\
                  xmlns="urn:mpeg:dash:schema:mpd:2011"\
                  xsi:schemaLocation="urn:mpeg:dash:schema:mpd:2011 DASH-MPD.xsd"\
                  type="static"\
                  minBufferTime="PT2S"\
                  profiles="urn:mpeg:dash:profile:isoff-live:2011"\
                  mediaPresentationDuration="PT234S">\
                  <Period>\
                    <AdaptationSet mimeType="video/mp4" segmentAlignment="true" startWithSAP="1">\
                      <SegmentTemplate duration="2" startNumber="1" media="video_$Number$_$Bandwidth$bps.mp4" initialization="video_$Bandwidth$bps.mp4">\
                      </SegmentTemplate>\
                      <Representation id="v0" codecs="avc1.4d401e" width="720" height="576" bandwidth="900000"/>\
                      <Representation id="v1" codecs="avc1.4d401e" width="720" height="576" bandwidth="500000"/>\
                    </AdaptationSet>\
                    <AdaptationSet mimeType="audio/mp4" codecs="mp4a.40.5" segmentAlignment="true" startWithSAP="1">\
                      <SegmentTemplate duration="2" startNumber="1" media="audio_$Number$_$Bandwidth$bps_Input_2.mp4" initialization="audio_$Bandwidth$bps_Input_2.mp4">\
                      </SegmentTemplate>\
                      <Representation id="a2" bandwidth="56000"/>\
                    </AdaptationSet>\
                  </Period>\
                </MPD>',

    //http://demo.unified-streaming.com/video/ateam/ateam.ism/ateam.mpd
    uspateam: '<MPD xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="urn:mpeg:dash:schema:mpd:2011"\
                  xsi:schemaLocation="urn:mpeg:dash:schema:mpd:2011 http://standards.iso.org/ittf/PubliclyAvailableStandards/MPEG-DASH_schema_files/DASH-MPD.xsd"\
                  type="static"  mediaPresentationDuration="PT1M42.728S" maxSegmentDuration="PT5S" minBufferTime="PT10S" profiles="urn:mpeg:dash:profile:isoff-live:2011,urn:com:dashif:dash264,urn:hbbtv:dash:profile:isoff-live:2012">\
                  <BaseURL>http://demo.unified-streaming.com/video/ateam/ateam.ism/</BaseURL>\
                  <Period>\
                    <BaseURL>dash/</BaseURL>\
                    <AdaptationSet group="1" mimeType="audio/mp4" minBandwidth="148000" maxBandwidth="148000" segmentAlignment="true">\
                      <SegmentTemplate timescale="48000" initialization="ateam-$RepresentationID$.dash" media="ateam-$RepresentationID$-$Time$.dash">\
                        <SegmentTimeline>\
                         <S t="0" d="200704" />\
                          <S d="119808" />\
                          <S d="102400" />\
                          <S d="104448" />\
                          <S d="141312" />\
                          <S d="114688" />\
                          <S d="111616" />\
                          <S d="102400" />\
                          <S d="116736" />\
                          <S d="117760" />\
                          <S d="102400" />\
                          <S d="101376" />\
                          <S d="102400" />\
                          <S d="111616" />\
                          <S d="116736" />\
                          <S d="128000" />\
                          <S d="138240" />\
                          <S d="174080" />\
                          <S d="132096" />\
                          <S d="106496" />\
                          <S d="105472" />\
                          <S d="110592" />\
                          <S d="105472" />\
                          <S d="106496" />\
                          <S d="102400" />\
                          <S d="128000" />\
                          <S d="107520" />\
                          <S d="131072" />\
                          <S d="189440" />\
                          <S d="116736" />\
                          <S d="199680" />\
                          <S d="104448" />\
                          <S d="102400" />\
                          <S d="117760" />\
                          <S d="111616" />\
                          <S d="124928" />\
                          <S d="117760" />\
                          <S d="108544" />\
                          <S d="199680" />\
                          <S d="94208" />\
                        </SegmentTimeline>\
                      </SegmentTemplate>\
                      <Representation id="audio=148000" bandwidth="148000" codecs="mp4a.40.2" audioSamplingRate="48000">\
                        <AudioChannelConfiguration schemeIdUri="urn:mpeg:dash:23003:3:audio_channel_configuration:2011" value="2">\
                        </AudioChannelConfiguration>\
                      </Representation>\
                    </AdaptationSet>\
                    <AdaptationSet group="2" mimeType="video/mp4"\
                      par="16:9" minBandwidth="475000" maxBandwidth="6589000" minWidth="176" maxWidth="1680" minHeight="99" maxHeight="944" segmentAlignment="true" startWithSAP="1">\
                      <SegmentTemplate timescale="1000" initialization="ateam-$RepresentationID$.dash" media="ateam-$RepresentationID$-$Time$.dash">\
                        <SegmentTimeline>\
                          <S t="0"  d="4171" />\
                          <S d="2503" />\
                          <S d="2127" />\
                          <S d="2169" />\
                          <S d="2961" />\
                          <S d="2377" />\
                          <S d="2336" />\
                          <S d="2127" />\
                          <S d="2419" />\
                          <S d="2461" />\
                          <S d="2127"  r="2" />\
                          <S d="2336" />\
                          <S d="2419" />\
                          <S d="2670" />\
                          <S d="2877" />\
                          <S d="3629" />\
                          <S d="2753" />\
                          <S d="2210" />\
                          <S d="2211" />\
                          <S d="2294" />\
                          <S d="2210" />\
                          <S d="2211" />\
                          <S d="2127" />\
                          <S d="2669" />\
                          <S d="2253" />\
                          <S d="2711" />\
                          <S d="3962" />\
                          <S d="2419" />\
                          <S d="4171" />\
                          <S d="2169" />\
                          <S d="2127" />\
                          <S d="2461" />\
                          <S d="2335" />\
                          <S d="2586" />\
                          <S d="2461" />\
                          <S d="2252" />\
                          <S d="4171" />\
                          <S d="2002" />\
                        </SegmentTimeline>\
                      </SegmentTemplate>\
                      <Representation id="video=475000" bandwidth="475000" codecs="avc1.42C00D" width="176" height="99" frameRate="24000/1001"></Representation>\
                      <Representation id="video=639000" bandwidth="639000" codecs="avc1.42C014" width="369" height="208" frameRate="24000/1001"></Representation>\
                      <Representation id="video=2083000" bandwidth="2083000" codecs="avc1.42C01E" width="768" height="432" frameRate="24000/1001"></Representation>\
                      <Representation id="video=6589000" bandwidth="6589000" codecs="avc1.42C028" width="1680" height="944" frameRate="24000/1001"></Representation>\
                    </AdaptationSet>\
                  </Period>\
                </MPD>',
    bbcrdtestcard: '<?xml version="1.0" encoding="UTF-8"?>\
        <MPD type="static" xmlns="urn:mpeg:dash:schema:mpd:2011" xmlns:dvb="urn:dvb:dash-extensions:2014-1" profiles="urn:dvb:dash:profile:dvb-dash:2014,urn:dvb:dash:profile:dvb-dash:isoff-ext-live:2014" minBufferTime="PT2.049S" maxSegmentDuration="PT3.84S" mediaPresentationDuration="PT1H0.040S">\
            <!-- MPEG DASH ISO BMFF test stream -->\
            <!-- BBC Research & Development -->\
            <!-- For more information see http://rdmedia.bbc.co.uk -->\
            <!-- Email dash@rd.bbc.co.uk -->\
            <!-- (c) British Broadcasting Corporation 2014.  All rights reserved.-->\
            <ProgramInformation>\
                    <Title>Adaptive Bitrate Test Stream from BBC Research and Development</Title>\
                    <Source>BBC Research and Development</Source>\
                    <Copyright>British Broadcasting Corporation 2014</Copyright>\
            </ProgramInformation>\
            <BaseURL serviceLocation="A" dvb:priority="1" dvb:weight="1">http://rdmedia.bbc.co.uk/dash/ondemand/testcard/1/</BaseURL>\
            <Period duration="PT1H0.040S" start="PT0S">\
                    <AdaptationSet startWithSAP="2" segmentAlignment="true" id="1" sar="1:1" mimeType="video/mp4" >\
                            <InbandEventStream schemeIdUri="tag:rdmedia.bbc.co.uk,2014:events/ballposition" value="1"/>\
                            <Role schemeIdUri="urn:mpeg:dash:role:2011" value="main"/>\
                            <BaseURL>avc3-events/</BaseURL>\
                            <SegmentTemplate startNumber="1" timescale="1000" duration="3840" media="$RepresentationID$/$Number%06d$.m4s" initialization="$RepresentationID$/IS.mp4" />\
                            <Representation id="960x540p50" codecs="avc3.64001f" height="540" width="960" frameRate="50" scanType="progressive" bandwidth="2814440" />\
                            <Representation id="256x144p25" codecs="avc3.42c015" height="144" width="256" frameRate="25" scanType="progressive" bandwidth="158128" />\
                            <Representation id="704x396p50" codecs="avc3.64001f" height="396" width="704" frameRate="50" scanType="progressive" bandwidth="1572456" />\
                            <Representation id="1920x1080i25" codecs="avc3.640028" height="1080" width="1920" frameRate="25" scanType="interlaced" bandwidth="8060152" />\
                            <Representation id="512x288p25" codecs="avc3.4d4015" height="288" width="512" frameRate="25" scanType="progressive" bandwidth="440664" />\
                            <Representation id="640x360p25" codecs="avc3.42c01e" height="360" width="640" frameRate="25" scanType="progressive" bandwidth="166680" />\
                            <Representation id="384x216p25" codecs="avc3.42c015" height="216" width="384" frameRate="25" scanType="progressive" bandwidth="283320" />\
                            <Representation id="896x504p25" codecs="avc3.64001f" height="504" width="896" frameRate="25" scanType="progressive" bandwidth="1375216" />\
                            <Representation id="1280x720p50" codecs="avc3.640020" height="720" width="1280" frameRate="50" scanType="progressive" bandwidth="5072376" />\
                            <Representation id="704x396p25" codecs="avc3.4d401e" height="396" width="704" frameRate="25" scanType="progressive" bandwidth="834352" />\
                            <Representation id="192x108p25" codecs="avc3.42c015" height="108" width="192" frameRate="25" scanType="progressive" bandwidth="88648" />\
                            <Representation id="448x252p25" codecs="avc3.42c015" height="252" width="448" frameRate="25" scanType="progressive" bandwidth="437856" />\
                            <Representation id="192x108p6_25" codecs="avc3.42c015" height="108" width="192" frameRate="25/4" scanType="progressive" bandwidth="31368" />\
                    </AdaptationSet>\
                    <AdaptationSet startWithSAP="2" segmentAlignment="true" id="2" codecs="mp4a.40.5" audioSamplingRate="48000" lang="eng" mimeType="audio/mp4" >\
                            <AudioChannelConfiguration schemeIdUri="urn:mpeg:dash:23003:3:audio_channel_configuration:2011" value="2"/>\
                            <Role schemeIdUri="urn:mpeg:dash:role:2011" value="main"/>\
                            <BaseURL>audio/</BaseURL>\
                            <SegmentTemplate startNumber="1" timescale="1000" duration="3840" media="$RepresentationID$/$Number%06d$.m4s" initialization="$RepresentationID$/IS.mp4" />\
                            <Representation id="48kbps" bandwidth="48000" />\
                            <Representation id="96kbps" bandwidth="96000" />\
                    </AdaptationSet>\
                    <AdaptationSet startWithSAP="2" segmentAlignment="true" id="3" codecs="mp4a.40.2" audioSamplingRate="48000" lang="eng" mimeType="audio/mp4" >\
                            <AudioChannelConfiguration schemeIdUri="urn:mpeg:dash:23003:3:audio_channel_configuration:2011" value="2"/>\
                            <Role schemeIdUri="urn:mpeg:dash:role:2011" value="main"/>\
                            <BaseURL>audio/</BaseURL>\
                            <SegmentTemplate startNumber="1" timescale="1000" duration="3840" media="$RepresentationID$/$Number%06d$.m4s" initialization="$RepresentationID$/IS.mp4" />\
                            <Representation id="128kbps" bandwidth="128000" />\
                    </AdaptationSet>\
                    <AdaptationSet startWithSAP="2" segmentAlignment="true" id="5" codecs="mp4a.40.2" audioSamplingRate="48000" lang="eng" mimeType="audio/mp4" >\
                            <AudioChannelConfiguration schemeIdUri="urn:mpeg:dash:23003:3:audio_channel_configuration:2011" value="6"/>\
                            <Role schemeIdUri="urn:mpeg:dash:role:2011" value="main"/>\
                            <BaseURL>audio/</BaseURL>\
                            <SegmentTemplate startNumber="1" timescale="1000" duration="3840" media="$RepresentationID$/$Number%06d$.m4s" initialization="$RepresentationID$/IS.mp4" />\
                            <Representation id="320kbps-5_1" bandwidth="320000" />\
                    </AdaptationSet>\
            </Period>\
            <Metrics metrics="DVBErrors">\
                    <Reporting schemeIdUri="urn:dvb:dash:reporting:2014" value="1" dvb:reportingUrl="http://rdmedia.bbc.co.uk/dash/errorreporting/reporterror.php" dvb:probability="50"/>\
            </Metrics>\
        </MPD>',
    bbcone: '<?xml version="1.0" encoding="utf-8"?>\
        <MPD  xmlns="urn:mpeg:dash:schema:mpd:2011" xmlns:dvb="urn:dvb:dash:dash-extensions:2014-1"\
          type="dynamic"\
          availabilityStartTime="1970-01-01T00:00:32Z"\
          publishTime="2016-05-23T12:25:32"\
          minimumUpdatePeriod="PT1H"\
          timeShiftBufferDepth="PT2H"\
          maxSegmentDuration="PT8S"\
          minBufferTime="PT4S"\
          profiles="urn:dvb:dash:profile:dvb-dash:2014,urn:dvb:dash:profile:dvb-dash:isoff-ext-live:2014">\
          <UTCTiming schemeIdUri="urn:mpeg:dash:utc:http-iso:2014" value="http://time.akamai.com/?iso" />\
          <Period id="1" start="PT0S">\
        <!-- audio adaptation_set for mp4a.40.2 codec (low-complexity)-->\
            <AdaptationSet group="1" contentType="audio" lang="en" segmentAlignment="true" audioSamplingRate="48000" mimeType="audio/mp4" codecs="mp4a.40.2" startWithSAP="1"\
                minBandwidth="96000" maxBandwidth="96000">\
              <AudioChannelConfiguration schemeIdUri="urn:mpeg:dash:23003:3:audio_channel_configuration:2011" value="2"/>\
              <Role schemeIdUri="urn:mpeg:dash:role:2011" value="main"/>\
              <SegmentTemplate timescale="48000" initialization="bbc_one_hd-$RepresentationID$.dash" media="bbc_one_hd-$RepresentationID$-$Number$.m4s" startNumber="1" duration="384000"/>\
              <Representation id="pa3=96000" bandwidth="96000"/>\
            </AdaptationSet>\
        <!-- video adaptation_set -->\
            <AdaptationSet group="2" contentType="video" par="16:9" segmentAlignment="true" mimeType="video/mp4" startWithSAP="1"\
                minBandwidth="281000" maxBandwidth="5070000" minWidth="384" maxWidth="1280" minHeight="216" maxHeight="720" minFrameRate="25" maxFrameRate="50">\
              <Role schemeIdUri="urn:mpeg:dash:role:2011" value="main"/>\
              <SegmentTemplate timescale="25" initialization="bbc_one_hd-$RepresentationID$.dash" media="bbc_one_hd-$RepresentationID$-$Number$.m4s" startNumber="1" duration="200"/>\
              <Representation id="video=281000" bandwidth="281000" width="384" height="216" frameRate="25" codecs="avc3.42C015" scanType="progressive"/>\
              <Representation id="video=437000" bandwidth="437000" width="512" height="288" frameRate="25" codecs="avc3.4D4015" scanType="progressive"/>\
              <Representation id="video=827000" bandwidth="827000" width="704" height="396" frameRate="25" codecs="avc3.4D401E" scanType="progressive"/>\
              <Representation id="video=1604000" bandwidth="1604000" width="960" height="540" frameRate="25" codecs="avc3.4D401F" scanType="progressive"/>\
              <Representation id="video=2812000" bandwidth="2812000" width="960" height="540" frameRate="50" codecs="avc3.64001F" scanType="progressive"/>\
              <Representation id="video=5070000" bandwidth="5070000" width="1280" height="720" frameRate="50" codecs="avc3.640020" scanType="progressive"/>\
            </AdaptationSet>\
          </Period>\
        </MPD>'
};

export default strMpd;
