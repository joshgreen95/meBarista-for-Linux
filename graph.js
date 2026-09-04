
function meCoffeeGraph () {
  this.n = 243;
  this.data = d3.range(this.n).map(function() { return 18; });
  this.data2 = d3.range(this.n).map(function() { return 18; });
  this.data_sp = d3.range(this.n).map(function() { return 18; });    
}

// superclass method
meCoffeeGraph.prototype.draw = function( ) {

this.duration = 750;

this.now = new Date(Date.now() - this.duration);
var
    count = 0;

var margin = {top: 6, right: 0, bottom: 20, left: 30};

var rect = $('#graph').parent()[0].getBoundingClientRect();

this.width = rect.width - margin.right - margin.left;
this.height = rect.height - margin.top - margin.bottom;

this.x = d3.time.scale()
    .domain([this.now - (this.n - 2) * this.duration, this.now - this.duration])
    .range([0, this.width]);

this.y = d3.scale.linear()
    .range([this.height, 0]);

this.line = d3.svg.line()
    .interpolate("basis")
    .y(function(d, i) { return thiss.y(d); })
    .x(function(d, i) { return thiss.x(thiss.now - (thiss.n - 1 - i) * thiss.duration); });
    //.x(function(d, i) { return this.y(i); });
    
this.line_tmp2 = d3.svg.line()
    .interpolate("basis")
    .y(function(d, i) { return thiss.y(d); })
    .x(function(d, i) { return thiss.x(thiss.now - (thiss.n - 1 - i) * thiss.duration); });
    //.x(function(d, i) { return this.y(i); });    

this.line2 = d3.svg.line()
    .interpolate("basis")
    .x(function(d, i) { return thiss.x(thiss.now - (thiss.n - 1 - i) * thiss.duration); })
    .y(function(d, i) { return thiss.y(d); });

$('#graph svg').remove(  );

this.svg = d3.select("#graph").append("svg")
    .attr( "class", "svg-content" )
    .attr( "viewBox", "0 0 " + rect.width +  " " + rect.height )
    .attr( "preserveAspectRatio", "none" )
    .attr("id", "svg-g")
    //.attr("width", width + margin.left + margin.right)
    //.attr("height", height + margin.top + margin.bottom)
    //.style("margin-left", -margin.left + "px")
  .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

this.svg.append("defs").append("clipPath")
    .attr("id", "clip")
  .append("rect")
    .attr("width", this.width)
    .attr("height", this.height);

this.axis = this.svg.append("g")
    .attr("class", "x axis")
    .attr("transform", "translate(0," + this.height + ")")
    .call( this.x.axis = d3.svg.axis().scale(this.x).orient("bottom"));

this.yaxis = this.svg.append("g")
    .attr("class", "y axis")
    .call( this.y.axis = d3.svg.axis().scale(this.y).ticks( 5 ).orient("left"));

this.path = this.svg.append("g")
    .attr("clip-path", "url(#clip)")
    .style("stroke", "blue")
  .append("path")
    .datum(this.data)
    .attr("id", "line_tmp");

this.path = this.svg.append("g")
    .attr("clip-path", "url(#clip)")
    .style("stroke", "red")
  .append("path")
    .datum(this.data2)
    .attr("id", "line_tmp2");

this.path_sp = this.svg.append("g")
    .attr("clip-path", "url(#clip)")
    .style("stroke", "green")
  .append("path")
    .datum(this.data_sp)
    .attr("id", "line_sp");

this.transition = d3.select({}).transition()
    .duration(100)
    .ease("linear");

}

meCoffeeGraph.prototype.tick = function( tmp, tmp2, sp, timestamp ) {
  thiss = this

  if( !this.started )
    this.started = new Date();

  //thiss.transition = thiss.transition.each(function() {

    // update the domains
    if( timestamp )
        thiss.now = new Date( this.started.getTime() + timestamp * 1000 );
    else
        thiss.now = new Date();

    thiss.x.domain([thiss.now - (thiss.n - 2) * thiss.duration, thiss.now - thiss.duration]);
    

    var data2_min = d3.min(thiss.data2),
        data2_max = d3.max(thiss.data2),
        data_min = d3.min(thiss.data),
        data_max = d3.max(thiss.data);

    if( data2_min > 5 && data2_max < 190 ) {
        data_min = Math.min( data2_min, data_min );
        data_max = Math.max( data2_max, data_max );
    }

    thiss.y.domain( [ data_min * 0.90, data_max * 1.1 ] );

    // push the accumulated count onto the back, and reset the count
    thiss.data.push( tmp );
    thiss.data2.push( tmp2 );
    thiss.data_sp.push( sp );
    count = 0;

    // redraw the line
    //thiss = this
    thiss.svg.select("#line_tmp")
        .attr("d", thiss.line )
        .attr("transform", null); 

    thiss.svg.select("#line_tmp2")
        .attr("d", thiss.line_tmp2 )
        .attr("transform", null); 

    thiss.svg.select("#line_sp")
        .attr("d", thiss.line2 )
        .attr("transform", null);

    // slide the x-axis left
    thiss.axis.call( thiss.x.axis);
    thiss.yaxis.call( thiss.y.axis);

    // slide the line left
    thiss.path.transition()
        .attr("transform", "translate(" + thiss.x(thiss.now - (thiss.n - 1) * thiss.duration) + ")");

     thiss.path_sp.transition()
        .attr("transform", "translate(" + thiss.x(thiss.now - (thiss.n - 1) * thiss.duration) + ")");

    // pop the old data point off the front
    thiss.data.shift();
    thiss.data2.shift();
    thiss.data_sp.shift();

  //}).transition(); //.each("start", tick);
}

meCoffeeGraph.prototype.redraw = function() {
    thiss = this;

    thiss.svg.select("#line_tmp")
        .attr("d", thiss.line )
        .attr("transform", null); 

    thiss.svg.select("#line_sp")
        .attr("d", thiss.line2 )
        .attr("transform", null);
}

