var https       = require( 'https' )
  , AlexaSkill  = require( './AlexaSkill' )
  , env         = require( './env.js' )
  , APP_ID      = process.env.APP_ID
  , username    = process.env.USERNAME
  , password    = process.env.PASSWORD;

const applianceId = { 'living room': '1966', 'bedroom': '1967' };

function getCookiesFromThinkEco( location, temperature, state, callback ) {
  var options = {
    host   : 'mymodlet.com',
    path   : '/Account/Login?loginForm.Email=' + username + '&loginForm.Password=' + encodeURIComponent( password ) + '&loginForm.RememberMe=True&ReturnUrl=',
    port   : '443',
    method : 'POST',
    headers: {
      'Accept'      : 'application/json, text/javascript, */*; q=0.01',
      'Content-Type': 'application/json; charset=UTF-8'
    }
  };

  var req = https.request( options, function( res ) {
    res.on( 'data', function( body ) {
      getThermostat( res.headers[ 'set-cookie' ], location, temperature, state, callback );
    });
  });

  req.on( 'error', function( e ) {
    console.log( 'Request error: ' + e.message );
  });

  req.end();
};

function getThermostat( cookies, location, temperature, state, callback ) {
  var options = {
    host   : 'mymodlet.com',
    path   : '/SmartAC/UserSettingsTable',
    port   : '443',
    method : 'POST',
    gzip   : true,
    headers: {
      'Accept'        : 'application/json, text/javascript, */*; q=0.01',
      'Content-Type'  : 'application/json; charset=UTF-8',
      'Cookie'        : cookies.join( '; ' )
    }
  };

  var req = https.request( options, function( res ) {
    var response = '';

    res.on( 'data', function( body ) {
      response += body;
    });

    res.on( 'end', function() {
      var data = JSON.parse( response ).match( /((select id="[0-9]+")|(option value="[0-9]+" selected))/g ).toString().match( /[0-9]+/g );
      setThermostat( cookies , applianceId[ location ], temperature ? temperature : thermostatObject( data )[ applianceId[ location ] ], state, callback );
    });
  });

  req.on( 'error', function( e ) {
    console.log( 'Request error: ' + e.message );
  });

  req.end();
}

function setThermostat( cookies, location, temperature, state, callback ) {
  var data = JSON.stringify( {
    'applianceId'      : location,
    'targetTemperature': temperature,
    'thermostated'     : ( state == 'on' )
  });

  var options = {
    host   : 'mymodlet.com',
    path   : '/SmartAC/UserSettings',
    port   : '443',
    method : 'POST',
    gzip   : true,
    headers: {
      'Accept'         : 'application/json, text/javascript, */*; q=0.01',
      'Accept-Encoding': 'gzip, deflate, br',
      'Content-Length' : Buffer.byteLength( data ),
      'Content-Type'   : 'application/json; charset=UTF-8',
      'Cookie'         : cookies.join( '; ' )
    }
  };

  var req = https.request( options, function( res ) {
    var response = '';

    res.on( 'data', function( body ) {
      response += body;
    });

    res.on( 'end', function() {
      callback( [ temperature, state ] );
    });
  });

  req.on( 'error', function( e ) {
    console.log( 'Request error: ' + e.message );
  });

  req.write( data );

  req.end();
}

function thermostatObject( data ) {
  var object = {};

  for( i = 0 ; i < data.length ; i++ ) {
    var temp = data.shift();
    object[ temp ] = data.shift();
  }

  return object;
}

function upperCase( string ) {
  return string[ 0 ].toUpperCase() + string.slice( 1 );
}

var handleThermostatRequest = function( intent, session, response ) {
  console.log( intent.toString() );
  getCookiesFromThinkEco( intent.slots.location.value, intent.slots.temperature.value, 'on', function( data ) {
    if( data ) {
      var text = data;
      var cardText = 'The ' + intent.slots.location.value + ' thermostat is set to: ' + text[ 0 ];
    } else {
      var text = 'That value does not exist.'
      var cardText = text;
    }

    var heading = upperCase( intent.slots.location.value ) + ' thermostat turned ' + text[ 1 ];
    response.tellWithCard( upperCase( intent.slots.location.value ) + ' thermostat set to ' + text[ 0 ], heading, cardText );
  });
};

var handleThermostateRequest = function( intent, session, response ) {
  console.log( intent.toString() );
  getCookiesFromThinkEco( intent.slots.location.value, '', intent.slots.state.value, function( data ) {
    if( data ) {
      var text = data;
      var cardText = 'The ' + intent.slots.location.value + ' AC turned: ' + text[ 1 ];
    } else {
      var text = 'That value does not exist.'
      var cardText = text;
    }

    var heading = upperCase( intent.slots.location.value ) + ' AC ' + text[ 1 ];
    response.tellWithCard( upperCase( intent.slots.location.value ) + ' AC turned ' + text[ 1 ], heading, cardText );
  });
};

var ThinkEco = function() {
  AlexaSkill.call( this, APP_ID );
};

ThinkEco.prototype = Object.create( AlexaSkill.prototype );
ThinkEco.prototype.constructor = ThinkEco;

ThinkEco.prototype.eventHandlers.onSessionStarted = function( sessionStartedRequest, session ) {
  // What happens when the session starts? Optional
  console.log( "onSessionStarted requestId: " + sessionStartedRequest.requestId
      + ", sessionId: " + session.sessionId );
};

ThinkEco.prototype.eventHandlers.onLaunch = function( launchRequest, session, response ) {
  // This is when they launch the skill but don't specify what they want. Prompt
  // them for their bus stop
  var output = 'Welcome to Think Eco. ' +
    'You can say things like set the living room thermostat to 77 or turn off the bedroom AC.';

  var reprompt = 'What thermostat would you like to change?';

  response.ask( output, reprompt );

  console.log( "onLaunch requestId: " + launchRequest.requestId
      + ", sessionId: " + session.sessionId );
};

ThinkEco.prototype.intentHandlers = {
  GetThermostatIntent: function( intent, session, response ) {
    handleThermostatRequest( intent, session, response );
  },

  GetThermostateIntent: function( intent, session, response ) {
    handleThermostateRequest( intent, session, response );
  },

  HelpIntent: function( intent, session, response ) {
    var speechOutput = 'You can say things like set the living room thermostat to 77 or turn off the bed room AC.' +
      'What thermostat would you like to change?';
    response.ask( speechOutput );
  }
};

exports.handler = function( event, context ) {
    var skill = new ThinkEco();
    skill.execute( event, context );
};
