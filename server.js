// http://127.0.0.1:9001
// http://localhost:9001

const fs = require('fs');
const path = require('path');
const url = require('url');
var httpServer = require('http');

// Google Cloud
const speech = require('@google-cloud/speech');
const speechClient = new speech.SpeechClient(); // Creates a client

const ioServer = require('socket.io');
const RTCMultiConnectionServer = require('./node_scripts/index.js');

var PORT = 9001;
var isUseHTTPs = false;

const jsonPath = {
    config: 'config.json',
    logs: 'logs.json'
};

const BASH_COLORS_HELPER = RTCMultiConnectionServer.BASH_COLORS_HELPER;
const getValuesFromConfigJson = RTCMultiConnectionServer.getValuesFromConfigJson;
const getBashParameters = RTCMultiConnectionServer.getBashParameters;

var config = getValuesFromConfigJson(jsonPath);
config = getBashParameters(config, BASH_COLORS_HELPER);

// if user didn't modifed "PORT" object
// then read value from "config.json"
if(PORT === 9001) {
    PORT = config.port;
}
if(isUseHTTPs === false) {
    isUseHTTPs = config.isUseHTTPs;
}

function serverHandler(request, response) {
    // to make sure we always get valid info from json file
    // even if external codes are overriding it
    config = getValuesFromConfigJson(jsonPath);
    config = getBashParameters(config, BASH_COLORS_HELPER);

    response.writeHead(200, {
        'Content-Type': 'text/plain'
    });
    response.write('RTCMultiConnection Socket.io Server.\n\n' + 'https://github.com/muaz-khan/RTCMultiConnection-Server\n\n' + 'npm install RTCMultiConnection-Server');
    response.end();
}

var httpApp;

if (isUseHTTPs) {
    httpServer = require('https');

    // See how to use a valid certificate:
    // https://github.com/muaz-khan/WebRTC-Experiment/issues/62
    var options = {
        key: null,
        cert: null,
        ca: null
    };

    var pfx = false;

    if (!fs.existsSync(config.sslKey)) {
        console.log(BASH_COLORS_HELPER.getRedFG(), 'sslKey:\t ' + config.sslKey + ' does not exist.');
    } else {
        pfx = config.sslKey.indexOf('.pfx') !== -1;
        options.key = fs.readFileSync(config.sslKey);
    }

    if (!fs.existsSync(config.sslCert)) {
        console.log(BASH_COLORS_HELPER.getRedFG(), 'sslCert:\t ' + config.sslCert + ' does not exist.');
    } else {
        options.cert = fs.readFileSync(config.sslCert);
    }

    if (config.sslCabundle) {
        if (!fs.existsSync(config.sslCabundle)) {
            console.log(BASH_COLORS_HELPER.getRedFG(), 'sslCabundle:\t ' + config.sslCabundle + ' does not exist.');
        }

        options.ca = fs.readFileSync(config.sslCabundle);
    }

    if (pfx === true) {
        options = {
            pfx: sslKey
        };
    }

    httpApp = httpServer.createServer(options, serverHandler);
} else {
    httpApp = httpServer.createServer(serverHandler);
}

RTCMultiConnectionServer.beforeHttpListen(httpApp, config);
httpApp = httpApp.listen(process.env.PORT || PORT, process.env.IP || "0.0.0.0", function() {
    RTCMultiConnectionServer.afterHttpListen(httpApp, config);
});

// --------------------------
// socket.io codes goes below

ioServer(httpApp).on('connection', function(socket) {
    socket.on('startGoogleCloudStream', function (data) {
        startRecognitionStream(this, data);
    });

    socket.on('endGoogleCloudStream', function () {
        stopRecognitionStream();
    });

    socket.on('binaryData', function (data) {
    // console.log(data); //log binary data
        if (recognizeStream !== null) {
            recognizeStream.write(data);
        }
    });

    function startRecognitionStream(socket) {
    recognizeStream = speechClient
    .streamingRecognize(request)
    .on('error', console.error)
    .on('data', (data) => {
        process.stdout.write(
          data.results[0] && data.results[0].alternatives[0]
            ? `Transcription: ${data.results[0].alternatives[0].transcript}\n`
            : '\n\nReached transcription time limit, press Ctrl+C\n'
        );
        socket.emit('speechData', data);

        // if end of utterance, let's restart stream
        // this is a small hack. After 65 seconds of silence, the stream will still throw an error for speech length limit
            if (data.results[0] && data.results[0].isFinal) {
              stopRecognitionStream();
              startRecognitionStream(socket);
              // console.log('restarted stream serverside');
            }
        });
    }

    function stopRecognitionStream() {
    if (recognizeStream) {
      recognizeStream.end();
    }
    recognizeStream = null;
  }


    RTCMultiConnectionServer.addSocket(socket, config);

    // ----------------------
    // below code is optional

    const params = socket.handshake.query;

    if (!params.socketCustomEvent) {
        params.socketCustomEvent = 'custom-message';
    }

    socket.on(params.socketCustomEvent, function(message) {

        socket.broadcast.emit(params.socketCustomEvent, message);
    });

});


// =========================== GOOGLE CLOUD SETTINGS ================================ //

// The encoding of the audio file, e.g. 'LINEAR16'
// The sample rate of the audio file in hertz, e.g. 16000
// The BCP-47 language code to use, e.g. 'en-US'
const encoding = 'LINEAR16';
const sampleRateHertz = 16000;
const languageCode = 'en-US'; //en-US

const request = {
  config: {
    encoding: encoding,
    sampleRateHertz: sampleRateHertz,
    languageCode: languageCode,
    profanityFilter: false,
    enableWordTimeOffsets: true,
    // speechContexts: [{
    //     phrases: ["hoful","shwazil"]
    //    }] // add your own speech context for better recognition
  },
  interimResults: true, // If you want interim results, set this to true
};


