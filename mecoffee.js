/*

    Bluetooth

    Bridges to the Electron main process (see bluetooth.js / preload.js),
    which binds the paired meCoffee board to an RFCOMM serial device.

*/

var receive_buffer = "";
var disconnect_timer;
var legacy = true;
var mecoffee_connected = false;

var slider_pistrt ;

function onReceiveTimeout() {

  //mecoffee_disconnect();
  mecoffee_start();

  disconnect_timer = null;

}

var onReceive = function( data ) {
  receive_buffer += data;

  var pos = 0, p = 0, i =0 ;
  while( ( p = receive_buffer.indexOf("\n") ) !== -1 ) {
  	line =  receive_buffer.substring( 0, p ).replace( /\r$/, '' );

    // console.log( line );
    receive_buffer = receive_buffer.substring( p + 1, receive_buffer.length );

    mecoffee_terminal( line );
    i++;
    if( i > 25 )
    	break;
  }

  // Disconnect timer
  if( disconnect_timer )
    clearTimeout( disconnect_timer );

  disconnect_timer = setTimeout( onReceiveTimeout, 5000 );
};

if( window.electronBT )
  window.electronBT.onData( onReceive );

function mecoffee_connect( device_name ) {
  $('#connect_error').text( '' );

  window.electronBT.connect( device_name ).then( function( result ) {
    if( !result.success ) {
      console.log( "Connection failed: " + result.error );
      $('#connect_error').text( "Connection failed: " + result.error );
      mecoffee_connected = false;

      // The Start button was optimistically flipped to "Stop" before this
      // resolved - put it back since nothing is actually connected.
      var start = $('#start')[0];
      start.className = "btn btn-primary";
      $('#start_icon')[0].className = "glyphicon glyphicon-play";
      $('#start_label')[0].innerHTML = "Start";

      return;
    }

    mecoffee_connected = true;
  });
}

function mecoffee_disconnect( ) {
  mecoffee_connected = false;
  window.electronBT.disconnect();

  mecoffee_timestamp_start = null;
}

function mecoffee_bt_enum_devices( ) {
  if( !window.electronBT )
    return ;

  window.electronBT.listDevices().then( function( result ) {
    $('#device option[value="none"]').remove()

    if( !result.success ) {
      console.log( 'Failed to list Bluetooth devices: ' + result.error );
      return;
    }

    var devices = result.devices;

    for (var i = 0; i < devices.length; i++) {
      $('#devices').append('<option value="device_' + devices[i].name + '">' + devices[i].name + '</option>');
    }

    $('#device')[0].selectedIndex = 0;
    $('#device').selectpicker("refresh")
  });

}

/* 
    meCoffee protocol 
*/

var mecoffee_timestamp_start;
function mecoffee_terminal_tmp( items ) {
	var ts = parseInt( items[1] );
	var tmp = parseInt( items[3] ) / 100;
  var tmp2 = parseInt( items[4] ) / 100;
	var tmpsp = parseInt( items[2] ) / 100;

  if( !mecoffee_timestamp_start && mecoffee_timestamp_start != 0 ) {
    mecoffee_timestamp_start = ts ;

    mecoffee_terminal_write( "\r\ncmd dump OK\r\n" );
  }

  if( ts - mecoffee_timestamp_start == 2 ) {
    var d = new Date(), e = new Date(d);
    var msSinceMidnight = e - d.setHours(0,0,0,0);

    mecoffee_terminal_write( "\r\ncmd clock set " + parseInt( msSinceMidnight / 1000 ) + " OK\r\n" );

    console.log( 'clock set to ' + parseInt( msSinceMidnight / 1000 ) );
  }

  if( ts - mecoffee_timestamp_start == 5 ) {
   
    mecoffee_terminal_write( "\r\ncmd uname OK\r\n");
  
  }
  
  graph.tick( tmp, tmp2, tmpsp, ts - mecoffee_timestamp_start );

	//mecoffee_cur_tmp = tmp;
	//mecoffee_cur_sp = tmpsp;

	document.querySelector('#mc_tmp').value = tmp;
	document.querySelector('#mc_tmpsp').value = tmpsp;
}

var gauge_boiler;
function mecoffee_terminal_pid( items ) {
  var pid = parseInt( items[1] ) + parseInt( items[2] ) + parseInt( items[3] );
  gauge_boiler.write( pid / 65536 * 100);
}

var gauge_shottimer;
var gauge_shottimer_time;
var gauge_shottimer_timeout;
var gauge_shottimer_interval = null;
function mecoffee_terminal_shot( items ) {
  var value = parseInt( items[ items.length - 2 ] );
  var speed = 1;

  if( mecoffee_demo_interval > 0 ) {
    speed = $('#demo_speed')[0].value;
  }

  if( gauge_shottimer_timeout ) {
    clearTimeout( gauge_shottimer_timeout );
    gauge_shottimer_timeout = null;
  }

  $('#gauge_shottimer').show();

  // start interval to update shot timer every sec 
  if( value == 0 && gauge_shottimer_interval == null ) {
    gauge_shottimer_time = 0;
    console.log( 'started interval ' );
    gauge_shottimer_interval = setInterval( function() {
      gauge_shottimer.write( ++gauge_shottimer_time );
      //console.log( 'update shot timer to ' + gauge_shottimer_time );
    },
    1000 / speed );
  }

  // clean up shot timer after 30 secs
  if( value > 0 ) {
    if( gauge_shottimer_interval ) {
      clearInterval( gauge_shottimer_interval );
      gauge_shottimer_interval = null;
      gauge_shottimer.write( value / 1000.0 );
    }



    gauge_shottimer_timeout = setTimeout( function() {                         
      gauge_shottimer.write( 0 );
      $('#gauge_shottimer').hide(); 
      gauge_shottimer_timeout = null; 

    },
    Math.min( 30000, 30000 / speed )                                
  );

  }

  gauge_shottimer.write( value / 1000 );
}


function mecoffee_terminal_cmd( items ) {
  
  if( items[1] == 'get' ) {
    var elems = $( '#mc_' + items[2] );
    var value = items[3];

    


    if( elems.length == 0 ) {
      console.log( '#mc_' + items[2]  + ' not found' );

      return;
    }

    var elem = elems[0];
    var scale = elem.getAttribute('data-scale');

    if( scale )
      value /= scale;

    if( elems[0].className.indexOf('timepicker') >= 0) {
      var hour = Math.floor( value / ( 60*60 ) );
      var min = value % ( 60*60 );

      elems[0].value = hour + ':' + Math.floor( min / 60 );

      return;
    }

    if( elems[0].type == "checkbox" ) {
      elems.bootstrapSwitch('state' , items[3] == "1" );
      return;
    }

    if( elems.attr( 'data-slider-value' ) ) {
      elems.slider( 'setValue', parseInt( items[3] ) );
      return;
    }

    elems[0].value = value;
  }
}

function mecoffee_terminal_uname( line ) {
  
  legacy = line.indexOf( 'V4' ) > 0;

  if( legacy ) {
    console.log( 'meCoffee is legacy ( V4 )' );

    $('#mc_pistrt')[0].setAttribute( 'data-scale', 1 );
    $('#mc_pistrt')[0].setAttribute( 'data-slider-step', 1 );

    $('#mc_pistrt').slider( 'destroy' );
    $('#mc_pistrt').slider( );

    $( '#mc_pistrt' ).change( mecoffee_control_change );
    
    $('#mc_piprd')[0].setAttribute( 'data-scale', 1 );
    $('#mc_piprd')[0].setAttribute( 'data-slider-step', 1 );

    $('#mc_piprd').slider( 'destroy' );
    $('#mc_piprd').slider( );

    $( '#mc_piprd' ).change( mecoffee_control_change );

  }
  else {

    console.log( 'meCoffee has newish firmware' );
  
    $('#mc_pistrt')[0].setAttribute( 'data-scale', 1000 );
    $('#mc_pistrt')[0].setAttribute( 'data-slider-step', "0.1" );

    $('#mc_pistrt').slider( 'destroy' );
    $('#mc_pistrt').slider( );

    $( '#mc_pistrt' ).change( mecoffee_control_change );

    $('#mc_piprd')[0].setAttribute( 'data-scale', 1000 );
    $('#mc_piprd')[0].setAttribute( 'data-slider-step', 0.1 );

    $('#mc_piprd').slider( 'destroy' );
    $('#mc_piprd').slider( );

    $( '#mc_piprd' ).change( mecoffee_control_change );

  }


  // $('.slider').destroy();

  // $('.slider').slider();

  // $('#mc_pistrt')[0].setAttribute( 'data-scala', 1000 );

}

function mecoffee_terminal( line ) {
  var items = line.split(' ');

  if( items[ items.length - 1 ] != 'OK' )
    return;

  if( items[0] == 'tmp' ) {
  	mecoffee_terminal_tmp( items );
  }

  if( items[1] == 'uname' ) {
    mecoffee_terminal_uname( line );
    return;
  }


  if( items[0] == 'cmd' )
    mecoffee_terminal_cmd( items );

  if( items[0] == 'pid' )
    mecoffee_terminal_pid( items );

  if( items[0] == 'sht' )
    mecoffee_terminal_shot( items );

}

function mecoffee_terminal_write( line ) {
  if( !mecoffee_connected )
    return ;

  window.electronBT.send( line ).then( function( result ) {
    if( !result.success )
      console.log( "Send failed: " + result.error );
  });
}


/* 

    Demo 

*/
var mecoffee_demo_log = "";
var mecoffee_demo_interval = 0;
var mecoffee_demo_cnt = 0;

function mecoffee_demo_timer( ) {
  if( mecoffee_demo_cnt >= mecoffee_demo_log.length ) {
    
    mecoffee_demo_stop();

    //clearInterval( mecoffee_demo_interval );
    // TODO: change start button state
    
    //mecoffee_demo_cnt = 0;
  }

  for( ; mecoffee_demo_cnt < mecoffee_demo_log.length ; mecoffee_demo_cnt++ ) {
    var line = mecoffee_demo_log[mecoffee_demo_cnt];
    mecoffee_terminal( line );

    if( line.indexOf('tmp ') == 0 ) {
      mecoffee_demo_cnt++;
      break;
    }
  }
}

function mecoffee_demo( log ) {
  log = log.replace( "share_", "" ); 

  $.get( "https://mecoffee.nl/share/logs/" + log, function( data ) {
    mecoffee_demo_log = data.split("\n");
    
    mecoffee_demo_interval = setInterval( mecoffee_demo_timer, 1000 / $('#demo_speed')[0].value );
  });
 
  return false;
}

function mecoffee_demo_speed( e ) {
  if( !mecoffee_demo_interval )
    return ;

  clearInterval( mecoffee_demo_interval );
  mecoffee_demo_interval = setInterval( mecoffee_demo_timer, 1000 / e.target.value  );
}

function mecoffee_demo_stop( e ) {
  if( mecoffee_demo_interval )
    clearInterval( mecoffee_demo_interval );
  mecoffee_demo_interval = 0;

  mecoffee_demo_cnt = 0;

   $('#start_icon')[0].className = "glyphicon glyphicon-play";
  $('#start_label')[0].innerHTML = "Start";
  start.className ="btn btn-primary";

}


/*

    App  

*/

function mecoffee_start( e ) {
  var start = $('#start')[0];

  if( start.className.indexOf("danger") > 0 ) {
    // Stop
    start.className ="btn btn-primary";
    $('#start_icon')[0].className = "glyphicon glyphicon-play";
    $('#start_label')[0].innerHTML = "Start";

    mecoffee_disconnect( );
    mecoffee_demo_stop( );
  }
  else {
    // Start
    start.className ="btn btn-danger";
    $('#start_icon')[0].className = "glyphicon glyphicon-stop";
    $('#start_label')[0].innerHTML = "Stop";

    var value = $('#device')[0].value;

    if( value.indexOf('device_') == 0 )
      mecoffee_connect( value.replace( 'device_', '' ) );

    if( value.indexOf('share_') == 0 )
      mecoffee_demo( value );
  } 

  return false;
}

function mecoffee_control_change( e ) {
  var elem = e.target;

  if( elem.id.indexOf('mc_') != 0 )
    return;

  var value = elem.value;

  if( e.value && e.value.newValue )
    value = e.value.newValue;

  if( elem.type == "checkbox" )
    value = elem.checked ? 1 : 0;

  if( value.indexOf && value.indexOf(':') > 0 ) {
    var p = value.split(':');

    value = 60*60*p[0] + 60*p[1];
  }

  var scale = elem.getAttribute('data-scale');

  if( scale )
    value *= scale;
  
  var line = "\r\ncmd set " + elem.id.replace( "mc_", "" ) + " " + value + " OK\r\n";
  
  console.log( line );
  mecoffee_terminal_write( line );
}

var graph;  
function mecoffee_app_startup() {

  //document.querySelector("#doit").addEventListener( 'click', doit_doit );

  $('#start').click( mecoffee_start );

  window.addEventListener("resize",  function() { graph.draw(); });

  graph = new meCoffeeGraph(); graph.draw();

  $("input[type='checkbox']").bootstrapSwitch( { onSwitchChange: function ( e ) { mecoffee_control_change( e ); }});

  // slider_pistrt = new Slider( '#mc_pistrt' );

  $('.slider').slider();
  $('.timepicker').timepicker( { showMeridian: false } );

  $( ".target" ).change( mecoffee_control_change );
  $( "#demo_speed").change( mecoffee_demo_speed );

  //var 
  gauge_boiler = new Gauge();
  gauge_boiler.draw( $('#gauge_boiler')[0] , { label: 'Boiler %' } );

  gauge_shottimer = new Gauge();
  gauge_shottimer.draw( $('#gauge_shottimer')[0] , { label: 'Shot (s)', max: 30 } );


  mecoffee_bt_enum_devices( );

}

window.addEventListener("DOMContentLoaded", mecoffee_app_startup );
  