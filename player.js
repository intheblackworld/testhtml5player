(function($, window) {
    function log(message) {
        if (console && console.log) {
            console.log(message);
        }
    }

    function Html5play() {
        // JavaScript Document
        var mimeType = 'video/mp4';
        var codecs = 'avc1.4d002d';
        var mediaSource;
        var videoElement;
        var videoSourceBuffer;
        var sessionId = 0;
        var ws;
        var ResetIntID;
        var ModifyPlayTime = 0;
        var bPlayInit = 0;
        var reConIntID;
        var playChn = 11;
        var PicWidth = 0;
        var PicHeight = 0;
        var TimerCnt = 0;
        var PlayState = 'stop';
        var WatchPlayStateTime = 5000;
        var currentHost = '';

        function ipc_play(host) {
            if (host) {
                currentHost = host;
            } else {
                host = currentHost;
            }

            if ((PlayState == 'play') || (PlayState == 'pause')) {
                return 0;
            }

            if (bPlayInit == 1) {
                return 0;
            }

            sessionId = Math.floor(Math.random() * (10000 + 1));
            var wsUrl = 'ws://' + host + '/html5play?sessionid=' + sessionId + '&-type=websocket&-chn=' + playChn;
            wsUrl += '&-time="' + new Date().getTime() + '"';

            if ('WebSocket' in window) {
                ws = new WebSocket(wsUrl);
            } else if ('MozWebSocket' in window) {
                ws = new MozWebSocket(wsUrl);
            } else {
                log('web not support websocket!!!');
            }

            ws.onopen = function() {
                ws.binaryType = 'arraybuffer';
                playInit();
                log('connect success!!');
            };

            ws.onmessage = function(evt) {
                try {
                    //check updating status
                    var cnt = 30;
                    while (videoSourceBuffer.updating && cnt) {
                        var start = new Date().getTime();
                        while (1) {
                            var end = new Date().getTime();
                            if (end - start > 100) {
                                break;
                            }
                        }
                        cnt--;
                    }

                    if (!videoSourceBuffer.updating) {
                        videoSourceBuffer.appendBuffer(new Uint8Array(evt.data));
                    }
                } catch (e) {
                    log('Exception while appending:' + e);
                }
            };

            ws.onclose = function() {
                PlayState = 'stop';
                log('disconnet success');
                playDeInit();
            };

            ws.onerror = function() {
                log('error');
            };
        }

        function ipc_stop() {
            if (PlayState == 'stop') {
                return 0;
            }
            ws.close();
        }

        function ipc_replay() {
            ipc_stop();
            reConIntID = setInterval(function() {
                    if (bPlayInit == 0) {
                        clearInterval(reConIntID);
                        ipc_play();
                        log('reconnect');
                    }
                },
                500);
        }

        function WatchPlayState() {
            var bReset = 0;

            if (videoElement.currentTime == 0) {
                bReset = 1;
                log('currentTime error!!');
            } else {
                if (ModifyPlayTime == 0) {
                    bReset = 1;
                    log('not play!!');
                }
                ModifyPlayTime = 0;
            }

            if (TimerCnt < 1800 / (WatchPlayStateTime / 1000)) {
                TimerCnt++;
            } else {
                bReset = 1;
                TimerCnt = 0;
                log('timeout reconnect!!');
            }

            if (bReset == 1) {
                clearInterval(ResetIntID);
                ipc_replay();
                return 0;
            }
        }

        function playInit() {
            if (bPlayInit == 1) {
                return 0;
            }

            mediaSource = new(window.MediaSource || window.WebKitMediaSource)();
            videoElement.pause();
            $(videoElement).attr('src', URL.createObjectURL(mediaSource))
                .width(PicWidth)
                .height(PicHeight);

            //video element call back
            videoElement.addEventListener('error',
                function(e) {
                    log('video error:' + videoElement.error.code);
                });

            videoElement.addEventListener('play',
                function() {

                    if (PlayState == 'play') {
                        return 0;
                    }

                    log('play!!!');
                    PlayState = 'play';
                    ws.send('cmd=connect');
                    ResetIntID = setInterval(function() {
                            WatchPlayState();
                        },
                        WatchPlayStateTime);
                });

            videoElement.addEventListener('pause',
                function() {

                    if (PlayState == 'pause') {
                        return 0;
                    }

                    log('pause!!!');
                    PlayState = 'pause';
                    clearInterval(ResetIntID);
                });

            videoElement.addEventListener('timeupdate',
                function() {
                    //log(videoElement.currentTime);
                    ModifyPlayTime = 1;
                });

            videoElement.addEventListener('waiting',
                function() {
                    log('video waiting!!!');
                });

            videoElement.addEventListener('durationchange',
                function() {
                    log('video durationchange!!!');
                });

            mediaSource.addEventListener('sourceopen',
                function() {
                    try {
                        log('mimeType=' + mimeType);
                        log('codecs=' + codecs);

                        //videoSourceBuffer call back
                        videoSourceBuffer = mediaSource.addSourceBuffer(mimeType + '; codecs=' + codecs);

                        videoSourceBuffer.addEventListener('updateend',
                            function() {
                                if (PlayState == 'play') {
                                    ws.send('cmd=updateend');
                                }
                            },
                            false);

                        videoSourceBuffer.addEventListener('error',
                            function(e) {
                                log('video sourcebuffer error:' + e);
                            },
                            false);

                        videoSourceBuffer.addEventListener('abort',
                            function(e) {
                                log('video sourcebuffer abort' + e);
                            },
                            false);

                        log('addSourceBuffer ok!!!');

                        bPlayInit = 1;

                        log('auto play!!!');
                        PlayState = 'play';
                        videoElement.play();
                        ws.send('cmd=connect');
                        ResetIntID = setInterval(function() {
                                WatchPlayState();
                            },
                            WatchPlayStateTime);
                    } catch (e) {
                        log('Exception calling addSourceBuffer for video:' + e);
                    }
                });
        }

        function playDeInit() {

            if (bPlayInit == 0) {
                return 0;
            }

            if (mediaSource.readyState === 'open') {
                videoSourceBuffer.abort();
            }
            mediaSource.removeSourceBuffer(videoSourceBuffer);

            delete mediaSource;

            bPlayInit = 0;

            ModifyPlayTime = 0;

            log('removeSourceBuffer ok!!!');
        }

        this.play = function(host, stream, width, height) {
            PicWidth = width ? width : this.GetPlayerLayerWidthHeight().w;
            PicHeight = height ? height : this.GetPlayerLayerWidthHeight().h;
            playChn = stream
            try {
                ipc_play(host);
            } catch (e) {
                log(e);
            }
            return true;
        };

        this.GetPlayerLayerWidthHeight = function() {
            var w = $(wrapper).innerWidth();
            var h = $(wrapper).innerHeight();
            return {
                w: w,
                h: h
            };
        };

        var wrapper = null;
        this.Load = function(obj) {
            wrapper = obj;

            var width = parseInt(this.GetPlayerLayerWidthHeight().w) - 270;
            var height = parseInt(this.GetPlayerLayerWidthHeight().h) - 100;

            var video = $('<video />').width(width).height(height)
                .html('Your browser does not support HTML5 video.');
            $(obj).append(video);
            videoElement = video[0]
        };

        this.StopPlay = function() {
            try {
                ipc_stop();
            } catch (e) {
                log(e);
                return false;
            }

        };

        this.PlayerResize = function(width, height) {
            try {
                PicWidth = width;
                PicHeight = height;
            } catch (e) {
                return false;
            }

        };

        this.GetVideoWidthHeight = function() {
            return {
                w: PicWidth,
                h: PicHeight
            };
        };
    }

    window.DigitusPlayer = Html5play;
})(jQuery, window);