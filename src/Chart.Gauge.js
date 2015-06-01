(function(){
    "use strict";

    var root = this,
        Chart = root.Chart,
        //Cache a local reference to Chart.helpers
        helpers = Chart.helpers;

    var defaultConfig = {
        //Boolean - Whether we should show a stroke on each segment
        segmentShowStroke : true,

        //String - The colour of each segment stroke
        segmentStrokeColor : "#fff",

        //Number - The width of each segment stroke
        segmentStrokeWidth : 2,

        //The percentage of the chart that we cut out of the middle.
        percentageInnerCutout : 50,

        //Number - Amount of animation steps
        animationSteps : 100,

        //String - Animation easing effect
        animationEasing : "easeOutExpo",

        //Boolean - Whether we animate the rotation of the Doughnut
        animateRotate : true,

        //Boolean - Whether we animate scaling the Doughnut from the centre
        animateScale : false,

        //String - A legend template
        legendTemplate : "<ul class=\"<%=name.toLowerCase()%>-legend\"><% for (var i=0; i<segments.length; i++){%><li><span style=\"background-color:<%=segments[i].fillColor%>\"></span><%if(segments[i].label){%><%=segments[i].label%><%}%></li><%}%></ul>",

        //String - Fill & stroke olour for the pointer needle
        pointerColor: '#000000',

        //Number - Pointer size in pixels
        pointerStrokeSize: 2.5,

        //Number - Pointer deflection in radians
        pointerAngle: 0,

        //Number - Fraction of guage radius that should be used for the pointer dot
        pointerDotSize: 1/50
    };

    // additional line type
    Chart.Line = Chart.Element.extend({
        draw: function() {
            var ctx = this.ctx;
            // save context state so we can restore later
            ctx.save();
            ctx.beginPath();
            ctx.strokeStyle = this.strokeColor;
            ctx.lineWidth = this.strokeWidth;
            // move the context origin to the specified origin
            ctx.translate(this.x,this.y);
            // rotate the entire context by specified radians, we are drawing
            // a simple line so rotating the entire context is fine
            ctx.rotate(this.t);
            // move to the translated origin
            ctx.moveTo(0,0);
            // draw a line along the x-axis of the specified length. The line be
            // rotated by the angle `t` even though we are drawing along the x-axis
            // because the entire context has been rotated by `t`
            // multiplying by -1 as we want to start from negative x-axis
            ctx.lineTo(-1 * this.l,0);
            ctx.stroke();
            ctx.closePath();
            ctx.restore();
        }
    });

    Chart.Type.extend({
        //Passing in a name registers this chart in the Chart namespace
        name: "Gauge",
        //Providing a defaults will also register the deafults in the chart namespace
        defaults : defaultConfig,
        //Initialize is fired when the chart is initialized - Data is passed in as a parameter
        //Config is automatically merged by the core of Chart.js, and is available at this.options
        initialize:  function(data){
            var minDimension = helpers.min([this.chart.width,this.chart.height]),
                pointerDotRadius = minDimension * this.options.pointerDotSize;

            //Declare segments as a static property to prevent inheriting across the Chart type prototype
            this.segments = [];
            this.outerRadius = minDimension - pointerDotRadius - this.options.segmentStrokeWidth/2;

            if (minDimension === this.chart.width) {
                this.outerRadius /=2;
            }

            this.SegmentArc = Chart.Arc.extend({
                ctx : this.chart.ctx,
                x : this.chart.width/2,
                y : this.chart.height - pointerDotRadius
            });

            this.pointerDot = new Chart.Point({
                ctx: this.chart.ctx,
                x : this.chart.width/2,
                // adjusting for the stroke width by subtracting pointer stroke size
                y : this.chart.height - pointerDotRadius - this.options.pointerStrokeSize,
                radius: pointerDotRadius,
                showStroke: true,
                strokeWidth: this.options.pointerStrokeSize,
                strokeColor: this.options.pointerColor,
                fillColor: '#FFFFFF'
            });

            this.pointerLine = new Chart.Line({
                ctx: this.chart.ctx,
                x: this.chart.width/2,
                // adjusting for the stroke width by subtracting pointer stroke size
                y: this.chart.height - pointerDotRadius - this.options.pointerStrokeSize,
                // pointer length is relative to the chart width
                l: this.outerRadius - 2 * this.outerRadius * this.options.pointerDotSize,
                t: this.options.pointerAngle,
                t0: this.options.pointerAngle,
                strokeColor: this.options.pointerColor,
                strokeWidth: this.options.pointerStrokeSize,
            });
            //Set up tooltip events on the chart
            if (this.options.showTooltips) {
                helpers.bindEvents(this, this.options.tooltipEvents, function(evt){
                    var activeSegments = (evt.type !== 'mouseout') ? this.getSegmentsAtEvent(evt) : [];

                    helpers.each(this.segments,function(segment){
                        segment.restore(["fillColor"]);
                    });
                    helpers.each(activeSegments,function(activeSegment){
                        activeSegment.fillColor = activeSegment.highlightColor;
                    });
                    this.showTooltip(activeSegments);
                });
            }

            this.calculateTotal(data);

            helpers.each(data,function(datapoint, index){
                this.addData(datapoint, index, true);
            },this);
            this.render();
        },
        getSegmentsAtEvent : function(e){
            var segmentsArray = [];

            var location = helpers.getRelativePosition(e);
            helpers.each(this.segments,function(segment){
                if (this.inRange(location.x,location.y, segment)) segmentsArray.push(segment);
            },this);

            return segmentsArray;
        },
        inRange : function(chartX,chartY, segment){
            var pointRelativePosition = helpers.getAngleFromPoint(segment, {
                x: chartX,
                y: chartY
            });

            var distanceFromXCenter = chartX - segment.x,
                distanceFromYCenter = chartY - segment.y;

            // helpers.getAngleFromPoint assumes Chart.Arc to start from PI/2 (90Deg)
            // and will therefore adjust the angle for hit point in the top-left
            // quadrant by 2PI. Gauge however assumes starting point from radian
            // 0 and needs to remove this adjustment
            if (distanceFromXCenter < 0 && distanceFromYCenter < 0){
                pointRelativePosition.angle -= Math.PI*2;
            }

            //Check if within the range of the open/close angle
            var betweenAngles = (pointRelativePosition.angle >= segment.startAngle && pointRelativePosition.angle <= segment.endAngle),
                withinRadius = (pointRelativePosition.distance >= segment.innerRadius && pointRelativePosition.distance <= segment.outerRadius);

            return (betweenAngles && withinRadius);
            //Ensure within the outside of the arc centre, but inside arc outer
        },
        addData : function(segment, atIndex, silent){
            var index = atIndex || this.segments.length;
            this.segments.splice(index, 0, new this.SegmentArc({
                value : segment.value,
                outerRadius : (this.options.animateScale) ? 0 : this.outerRadius,
                innerRadius : (this.options.animateScale) ? 0 : (this.outerRadius/100) * this.options.percentageInnerCutout,
                fillColor : segment.color,
                highlightColor : segment.highlight || segment.color,
                showStroke : this.options.segmentShowStroke,
                strokeWidth : this.options.segmentStrokeWidth,
                strokeColor : this.options.segmentStrokeColor,
                startAngle : Math.PI,
                circumference : (this.options.animateRotate) ? 0 : this.calculateCircumference(segment.value),
                label : segment.label
            }));
            if (!silent){
                this.reflow();
                this.update();
            }
        },
        setPointer: function(position) {
            this.options.pointerAngle = (Math.PI/100) * position;
            // set the current angle as the `t0` reference
            this.pointerLine.t0 = this.pointerLine.t;

            return this;
        },
        calculateCircumference : function(value){
            return (Math.PI)*(value / this.total);
        },
        calculateTotal : function(data){
            this.total = 0;
            helpers.each(data,function(segment){
                this.total += segment.value;
            },this);
        },
        update : function(){
            this.calculateTotal(this.segments);

            // Reset any highlight colours before updating.
            helpers.each(this.activeElements, function(activeElement){
                activeElement.restore(['fillColor']);
            });

            helpers.each(this.segments,function(segment){
                segment.save();
            });
            this.render();
        },

        removeData: function(atIndex){
            var indexToDelete = (helpers.isNumber(atIndex)) ? atIndex : this.segments.length-1;
            this.segments.splice(indexToDelete, 1);
            this.reflow();
            this.update();
        },

        reflow : function(){
            var pointerDotRadius = helpers.min([this.chart.width,this.chart.height])/50;
            helpers.extend(this.SegmentArc.prototype,{
                x : this.chart.width/2,
                y : this.chart.height - pointerDotRadius
            });
            this.outerRadius = (helpers.min([this.chart.width,this.chart.height]) - this.options.segmentStrokeWidth/2)/2;
            helpers.each(this.segments, function(segment){
                segment.update({
                    outerRadius : this.outerRadius,
                    innerRadius : (this.outerRadius/100) * this.options.percentageInnerCutout
                });
            }, this);

            this.pointerLine.update({
                x: this.chart.width/2,
                // adjusting for the stroke width by subtracting pointer stroke size
                y: this.chart.height - pointerDotRadius - this.options.pointerStrokeSize,
                l: this.chart.width/2 - 20,
                t: this.options.pointerAngle
            });
            this.pointerLine.draw();

            this.pointerDot.update({
                x : this.chart.width/2,
                y : this.chart.height - pointerDotRadius - this.options.pointerStrokeSize,
                radius: pointerDotRadius
            })
            this.pointerDot.draw();
        },

        draw : function(easeDecimal){
            var animDecimal = (easeDecimal) ? easeDecimal : 1;
            this.clear();

            helpers.each(this.segments,function(segment,index){
                segment.circumference = this.calculateCircumference(segment.value),
                segment.outerRadius = this.outerRadius,
                segment.innerRadius = (this.outerRadius/100) * this.options.percentageInnerCutout
                segment.endAngle = segment.startAngle + segment.circumference;

                segment.draw();
                if (index === 0){
                    segment.startAngle = Math.PI;
                }
                //Check to see if it's the last segment, if not get the next and update the start angle
                if (index < this.segments.length-1){
                    this.segments[index+1].startAngle = segment.endAngle;
                }
            },this);

            // animate the pointer by multiplying it by animation decimal. Using t0 as starting point
            // to make sure the pointer only animates the difference
            this.pointerLine.update({t: this.pointerLine.t0 + ((this.options.pointerAngle - this.pointerLine.t0) * animDecimal)});
            this.pointerLine.draw();
            this.pointerDot.draw();
        }
    });
}).call(this);
