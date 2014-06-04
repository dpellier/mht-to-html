'use strict';

var fs = require('fs'),
    readline = require('readline');

// Get the file to parse
var file = process.argv[2];

var email = {images: {}};
var currentBlockDecoding = '';
var currentBlockContentType = '';
var currentBlockContentExt = '';
var currentBlockContentId = '';
var currentBlockDecodingIndex = 0;
var blockstart = false;

/**
 * Find and set the content type of the current block
 * @param {string} line
 */
function extractContentType(line) {
    var contentTypeMatch = line.match(/^Content-Type: ([^\/]*)\/([a-z]+)/);
    if (contentTypeMatch) {
        currentBlockContentType = contentTypeMatch[1];
        currentBlockContentExt = contentTypeMatch[2];
    }
}

/**
 * Find and set the content id of the current block
 * @param {string} line
 */
function extractContentId(line) {
    var contentIdMatch = line.match(/^Content-ID: <([^>]*)/);
    if (contentIdMatch) {
        currentBlockContentId = contentIdMatch[1];
    }
}

/**
 * We have a full base64 block to decode
 * If the content type is image, we save it in the image object
 * If the content type is text, we decode it
 */
function finishBaseDecoding() {
    if (currentBlockContentType === 'image') {
        email.images[currentBlockContentId] = {
            ext: currentBlockContentExt,
            base: currentBlockDecoding
        };
    } else if (currentBlockContentType === 'text') {
        email.body = atob(currentBlockDecoding);
    }

    blockstart = false;
    currentBlockDecodingIndex = 0;
    currentBlockDecoding = '';
}

/**
 * Base64 decode function
 */
function atob(string) {
    return new Buffer(string, 'base64').toString('binary');
}

/**
 * Replace each img cid by a valid base64 src
 */
function replaceCidByBase64() {
    Object.keys(email.images).forEach(function(id) {
        var image = email.images[id];
        var search = new RegExp('src="cid:' + id + '[^"]*', 'g');

        email.body = email.body.replace(search, 'src="data:image/' + image.ext + ';base64,' + image.base);
    });
}

// Interface of the file we want to parse
var rd = readline.createInterface({
    input: fs.createReadStream(file),
    output: process.stdout,
    terminal: false
});

// Start reading
rd.on('line', function(line) {
    if (line !== '') {
        if (!email.subject) {
            var subjectMatch = /^Subject: (.*)/.exec(line);
            
            if (subjectMatch) {
                email.subject = subjectMatch[1];
            }
        }

        var boundaryMatch = /^----boundary/.test(line);
        if (boundaryMatch) {
            finishBaseDecoding();
            blockstart = true;
        } else if (blockstart) {
            var contentMatch = /^Content-([^:]*)/.exec(line);
            if (contentMatch) {
                switch(contentMatch[1]) {
                    case 'Type':
                        extractContentType(line);
                        break;
                    case 'ID':
                        extractContentId(line);
                        break;
                    default:
                        break;
                }
            } else {
                currentBlockDecoding += line;
            }
        }
    }
}).on('close', function() {
    replaceCidByBase64();

    // Change here the way you want to get your html result
    console.log(email.body);
});
