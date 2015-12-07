var webusb = {};

(function() {
  'use strict';

  webusb.devices = {};

  webusb.getDevices = function() {
    return navigator.usb.getDevices().then(devices => {
      return devices.map(device => new webusb.Device(device));
    });
  };

  webusb.Device = function(device) {
    this.device_ = device;
    webusb.devices[device.guid] = this;
  };

  webusb.deleteDevice = function(device) {
    delete webusb.devices[device.device_.guid];
  };

  webusb.getDeviceFromGuid = function(guid) {
    return webusb.devices[guid];
  };

  webusb.Device.prototype.connect = function() {
    return this.device_.open()
      .then(() => this.device_.getConfiguration()
            .then(config => {
              if (config.configurationValue == 1) {
                return Promise.resolve();
              } else {
                return Promise.reject("Need to setConfiguration(1).");
              }
            })
            .catch(error => this.device_.setConfiguration(1)))
      .then(() => this.device_.claimInterface(0))
      .then(() => this.device_.controlTransferOut({
        'requestType': 'class',
        'recipient': 'interface',
        'request': 0x22,
        'value': 0x01,
        'index': 0x00}));
  };

  webusb.Device.prototype.disconnect = function() {
    return this.device_.controlTransferOut({
      'requestType': 'class',
      'recipient': 'interface',
      'request': 0x22,
      'value': 0x00,
      'index': 0x00})
      .then(() => this.device_.close());
  };

  webusb.Device.prototype.controlTransferOut = function(setup, data) {
    return this.device_.controlTransferOut(setup, data);
  };

  webusb.Device.prototype.controlTransferIn = function(setup, length) {
    return this.device_.controlTransferIn(setup, length);
  };

})();

function logDeviceStrings(device) {
  console.log("Connection:",
              device.device_.manufacturerName,
              device.device_.productName,
              device.device_.serialNumber);
}

function hexToRgb(hex) {
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

function setDeviceColor(device, r, g, b) {
  var rgb = new Uint8Array(3);
  rgb[0] = r;
  rgb[1] = g;
  rgb[2] = b;

  device.controlTransferOut({
    'requestType': 'vendor',
    'recipient': 'device',
    'request': 0x01,
    'value': 0x00,
    'index': 0x00}, rgb)
    .then(o => {
    }, e => {
      console.log(e); disconnectDevice(device.guid);
    });
}

function setAllDeviceColor(r, g, b) {
  for (var d in webusb.devices) {
    setDeviceColor(webusb.devices[d], r, g, b);
  }
}

var BRIGHTNESS = 64;
function connectDevice(device) {
  device.connect()
    .then(logDeviceStrings(device))
    .then(function() { console.log("connected", device) });
}

function handleConnectEvent(event) {
  var rawDevice = event.device;
  var guid = rawDevice.guid;
  console.log('connect event', rawDevice, guid);
  var device = new webusb.Device(rawDevice);
  connectDevice(device);
}

function cleanUpDevice(device) {
  webusb.deleteDevice(device);
}

function disconnectDevice(guid) {
  if (!guid in webusb.devices) {
    console.log(guid, "not known");
    return;
  }

  var device = webusb.getDeviceFromGuid(guid);
  if (device) {  // This can fail if the I/O code already threw an exception
    console.log("removing!");
    device.disconnect()
      .then(s => {
        console.log("disconnected", device);
        cleanUpDevice(device);
      }, e => {
        console.log("nothing to disconnect", device);
        cleanUpDevice(device);
      });
  }
}

function handleDisconnectEvent(event) {
  var rawDevice = event.device;
  var guid = rawDevice.guid;
  console.log('disconnect event', rawDevice, guid);
  disconnectDevice(guid);
}

function registerEventListeners() {
  navigator.usb.addEventListener('connect', handleConnectEvent);
  navigator.usb.addEventListener('disconnect', handleDisconnectEvent);
}

function startInitialConnections() {
  webusb.getDevices().then(devices => {
    console.log("Initial devices", devices);
    for (var i in devices) {
      var device = devices[i];
      connectDevice(device);
    }
  });
}

$(function() {

  var conn;
  var msg = $("#msg");
  var log = $("#log");
  // http://stackoverflow.com/a/1573141
  var colormap = {"aliceblue":"f0f8ff","antiquewhite":"faebd7","aqua":"00ffff","aquamarine":"7fffd4","azure":"f0ffff",
                  "beige":"f5f5dc","bisque":"ffe4c4","black":"000000","blanchedalmond":"ffebcd","blue":"0000ff","blueviolet":"8a2be2","brown":"a52a2a","burlywood":"deb887",
                  "cadetblue":"5f9ea0","chartreuse":"7fff00","chocolate":"d2691e","coral":"ff7f50","cornflowerblue":"6495ed","cornsilk":"fff8dc","crimson":"dc143c","cyan":"00ffff",
                  "darkblue":"00008b","darkcyan":"008b8b","darkgoldenrod":"b8860b","darkgray":"a9a9a9","darkgreen":"006400","darkkhaki":"bdb76b","darkmagenta":"8b008b","darkolivegreen":"556b2f",
                  "darkorange":"ff8c00","darkorchid":"9932cc","darkred":"8b0000","darksalmon":"e9967a","darkseagreen":"8fbc8f","darkslateblue":"483d8b","darkslategray":"2f4f4f","darkturquoise":"00ced1",
                  "darkviolet":"9400d3","deeppink":"ff1493","deepskyblue":"00bfff","dimgray":"696969","dodgerblue":"1e90ff",
                  "firebrick":"b22222","floralwhite":"fffaf0","forestgreen":"228b22","fuchsia":"ff00ff",
                  "gainsboro":"dcdcdc","ghostwhite":"f8f8ff","gold":"ffd700","goldenrod":"daa520","gray":"808080","green":"008000","greenyellow":"adff2f",
                  "honeydew":"f0fff0","hotpink":"ff69b4",
                  "indianred ":"cd5c5c","indigo":"4b0082","ivory":"fffff0","khaki":"f0e68c",
                  "lavender":"e6e6fa","lavenderblush":"fff0f5","lawngreen":"7cfc00","lemonchiffon":"fffacd","lightblue":"add8e6","lightcoral":"f08080","lightcyan":"e0ffff","lightgoldenrodyellow":"fafad2",
                  "lightgrey":"d3d3d3","lightgreen":"90ee90","lightpink":"ffb6c1","lightsalmon":"ffa07a","lightseagreen":"20b2aa","lightskyblue":"87cefa","lightslategray":"778899","lightsteelblue":"b0c4de",
                  "lightyellow":"ffffe0","lime":"00ff00","limegreen":"32cd32","linen":"faf0e6",
                  "magenta":"ff00ff","maroon":"800000","mediumaquamarine":"66cdaa","mediumblue":"0000cd","mediumorchid":"ba55d3","mediumpurple":"9370d8","mediumseagreen":"3cb371","mediumslateblue":"7b68ee",
                  "mediumspringgreen":"00fa9a","mediumturquoise":"48d1cc","mediumvioletred":"c71585","midnightblue":"191970","mintcream":"f5fffa","mistyrose":"ffe4e1","moccasin":"ffe4b5",
                  "navajowhite":"ffdead","navy":"000080",
                  "oldlace":"fdf5e6","olive":"808000","olivedrab":"6b8e23","orange":"ffa500","orangered":"ff4500","orchid":"da70d6",
                  "palegoldenrod":"eee8aa","palegreen":"98fb98","paleturquoise":"afeeee","palevioletred":"d87093","papayawhip":"ffefd5","peachpuff":"ffdab9","peru":"cd853f","pink":"ffc0cb","plum":"dda0dd","powderblue":"b0e0e6","purple":"800080",
                  "red":"ff0000","rosybrown":"bc8f8f","royalblue":"4169e1",
                  "saddlebrown":"8b4513","salmon":"fa8072","sandybrown":"f4a460","seagreen":"2e8b57","seashell":"fff5ee","sienna":"a0522d","silver":"c0c0c0","skyblue":"87ceeb","slateblue":"6a5acd","slategray":"708090","snow":"fffafa","springgreen":"00ff7f","steelblue":"4682b4",
                  "tan":"d2b48c","teal":"008080","thistle":"d8bfd8","tomato":"ff6347","turquoise":"40e0d0",
                  "violet":"ee82ee",
                  "wheat":"f5deb3","white":"ffffff","whitesmoke":"f5f5f5",
                  "yellow":"ffff00","yellowgreen":"9acd32"};

  var color_regexps = {};
  for (var color in colormap) {
    var re = new RegExp("\\b" + color + "\\b");
    color_regexps[color] = re;
  }

  function appendLog(msg) {
    var d = log[0]
    var doScroll = d.scrollTop == d.scrollHeight - d.clientHeight;
    msg.appendTo(log)
    if (doScroll) {
      d.scrollTop = d.scrollHeight - d.clientHeight;
    }
  }

  $("#form").submit(function() {
    if (!conn) {
      return false;
    }
    if (!msg.val()) {
      return false;
    }
    conn.send(msg.val());
    msg.val("");
    return false
  });

  if (window["WebSocket"]) {
    conn = new WebSocket("wss://z.sowbug.com:8443/ws");
    conn.onclose = function(evt) {
      appendLog($("<div><b>Connection closed.</b></div>"))
    }
    conn.onmessage = function(evt) {
      var s = evt.data;
      for (var color in color_regexps) {
        var re = color_regexps[color];
        if (s.toLowerCase().search(re) != -1) {
          var hex = colormap[color];
          var c = hexToRgb(hex);
          setAllDeviceColor(c.r, c.g, c.b);
        }
      }
      appendLog($("<div/>").text(evt.data))
    }
    registerEventListeners();
    startInitialConnections();
  } else {
    appendLog($("<div><b>Your browser does not support WebSockets.</b></div>"))
  }
});
