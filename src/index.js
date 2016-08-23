require('dotenv').load();

var https      = require( 'https' )
  , AlexaSkill = require( './AlexaSkill' )
  , APP_ID     = process.env.APP_ID
  , username   = process.env.username
  , password   = process.env.password;

var getCookiesFromThinkEco = function( location, temperature, callback ) {
  var options = {
    host: 'mymodlet.com',
    path: '/Account/Login?loginForm.Email=' + username + '&loginForm.Password=' + encodeURIComponent( password ) + '&loginForm.RememberMe=True&ReturnUrl=',
    port: '443',
    headers: {
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'Content-Type': 'application/json; charset=UTF-8'
    },
    method: 'POST'
  };

  var req = https.request( options, function( res ) {
    res.on( 'data', function( body ) {
      command( res.headers[ 'set-cookie' ], getLocation( location ), getThermostate( temperature ), callback );
    });
  });
  req.on( 'error', function( e ) {
    console.log( 'Request error: ' + e.message );
  });
  req.end();
};

function getLocation( value ) {
  switch( value ) {
    case 'living room':
      return 1966;
    case 'bedroom':
      return 1967;
  }
}

function getThermostate( value ) {
  switch( value ) {
    case 'on':
      return 77;
    case 'off':
      return 0;
    default:
      return value;
  }
}

function command( cookies, applianceId, temperature, callback ) {
  var thermostate = true;
  if ( temperature == 0 ) {
    temperature = 77;
    thermostate = false;
  }
  var data = JSON.stringify( {
    "applianceId": applianceId,
    "targetTemperature": temperature,
    "thermostated": thermostate
  });

  var options = {
    host: 'mymodlet.com',
    path: '/SmartAC/UserSettings',
    port: '443',
    headers: {
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'Accept-Encoding': 'gzip, deflate, br',
      'Content-Length': Buffer.byteLength( data ),
      'Content-Type': 'application/json; charset=UTF-8',
      'Cookie': cookies.join( '; ' )
    },
    method: 'POST'
  };

  var req = https.request( options, function( res ) {
    res.on('data', function( body ) {
      callback( temperature );
    });
  });
  req.on( 'error', function( e ) {
    console.log( 'Request error: ' + e.message );
  });
  req.write( data );
  req.end();
}

var handleThermostatRequest = function( intent, session, response ) {
  console.log( intent.toString() );
  getCookiesFromThinkEco( intent.slots.location.value, intent.slots.temperature.value, function( data ) {
    if( data ){
      var text = data;
      var cardText = 'The thermostat is set to: ' + text;
    } else {
      var text = 'That value does not exist.'
      var cardText = text;
    }

    var heading = 'Thermostat set to: ' + intent.slots.temperature.value;
    response.tellWithCard( text, heading, cardText );
  });
};

var handleThermostateRequest = function( intent, session, response ) {
  console.log( intent.toString() );
  getCookiesFromThinkEco( intent.slots.location.value, intent.slots.state.value, function( data ) {
    if( data ){
      var text = data;
      var cardText = 'The thermostat is set to: ' + intent.slots.state.value;
    } else {
      var text = 'That value does not exist.'
      var cardText = text;
    }

    var heading = 'Thermostat set to: ' + intent.slots.state.value;
    response.tellWithCard( text, heading, cardText );
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
