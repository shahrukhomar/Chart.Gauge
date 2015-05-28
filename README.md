# Chart.Gauge
Gauge chart type for [chartjs.org](http://www.chartjs.org)

## Installation

Inlcude the `src/Chart.Gauge.js` file in your page after the chart.js `Chart.Core`. The Gauge chart type will now be available as `Chart.Gauge`

## Usage

```javascript
var gaugetData = [
  {
      value: 50,
      color:"#c50200",
      label: "Getting there"
  },
  {
      value: 25,
      color: "#ff7700",
      label: "Almost there"
  },
  {
      value: 25,
      color: "#fdc702",
      label: "Winner"
  }
];
var gauge = new Chart(document.getElementById("targetNode").getContext("2d")).Gauge(gaugetData, {responsive : true});
gauge.setPointer(34); // set the gauge pointer to 34%
```

It is possible to live update the gauge pointer by re-setting the pointer and calling update on the chart

```javascript
guage.setPointer(6).update();
```

## License

Chart.js is available under the [MIT license](http://opensource.org/licenses/MIT).
