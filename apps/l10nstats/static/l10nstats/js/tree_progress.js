/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function Data(stacked, nonstacked) {
  this.stacked = stacked;
  this.nonstacked = nonstacked;
  this._data = {};
  var _d = this._data;
  if (this.stacked) {
    $.each(this.stacked, function(i, n) {
      _d[n] = 0;
    });
  }
  if (this.nonstacked) {
    $.each(this.nonstacked, function(i, n) {
      _d[n] = 0;
    });
  }
}

Data.prototype = {
   update: function(from, to) {
     if (from) {
       this._data[from] -= 1;
     }
     this._data[to] += 1;
   },
  data: function(date) {
    var v = 0, rv = {}, _d = this._data;
    if (date) rv.date = date;
    if (this.stacked) {
      $.each(this.stacked, function(i, n) {
        v += _d[n];
        rv[n] = v;
      });
    }
    if (this.nonstacked) {
      $.each(this.nonstacked, function(i, n) {
        rv[n] = _d[n];
      });
    }
    return rv;
  }
};

var showBad = SHOW_BAD;
var bound = BOUND;
var params = {
  bound: bound,
  showBad: showBad
};

var data, state, data0, X;
var loc_data = LOCALE_DATA;
var locales = [];

function renderPlot() {
  var _p = {};
  if (!params.showBad) _p.hideBad = true;
  if (params.bound) _p.bound = params.bound;
  var tp = timeplot("#my-timeplot",
                    fullrange,
                    [startdate, enddate],
                    _p);
  var svg = tp.svg;
  X = tp.x;

  var i = 0, loc;
  state = new Data(null, ['good', 'shady', 'bad']);
  var latest = {};
  var _data = {};
  data = [];
  function _getState(_count) {
    if (_count === 0) return 'good';
    if (_count > params.bound) return 'bad';
    return 'shady';
  }
  for (loc in loc_data[i].locales) {
    locales.push(loc);
    latest[loc] = _getState(loc_data[i].locales[loc]);
    _data[loc] = loc_data[i].locales[loc];
    // no breaks on purpose, to stack data
    state.update(undefined, latest[loc]);
  }
  data.push(state.data(loc_data[i].time));
  var changeEvents = [];
  for (i = 1; i < loc_data.length; ++i) {
    var loclist = [];
    for (loc in loc_data[i].locales) {
      _data[loc] = loc_data[i].locales[loc];
      isGood = _getState(loc_data[i].locales[loc]);
      if (isGood != latest[loc]) {
        state.update(latest[loc], isGood);
        loclist.push(loc);
        latest[loc] = isGood;
      }
    }
    if (loclist.length) {
      loclist.sort();
      // UX needed, bug 773612
      // incorporate the list of locales changing now into the graph
    }
    data.push(state.data(loc_data[i].time));
  }
  data.push(state.data(enddate));
  var layers = ['good', 'shady'];
  if (params.showBad) {
    layers.push('bad');
  }
  data0 = d3.layout.stack()(layers.map(function(k){
    return data.map(function(d){
      return {
        x: d.date,
        y: d[k]
      };
    });
  }));
  var area = d3.svg.area()
    .interpolate("step-after")
    .x(function(d) {
      return tp.x(d.x);
    })
    .y0(function(d) { return tp.y(d.y0); })
    .y1(function(d) { return tp.y(d.y + d.y0); });
  tp.yDomain([0, d3.max(data.map(function(d) { return d.good + d.shady + (params.showBad ? d.bad : 0); })) + 10]);
  svg.selectAll("path.progress")
     .data(data0)
     .enter()
     .append("path")
     .attr("class", "progress")
     .style("stroke", "black")
     .style("fill", function (d, i) {
        return ['#339900', 'grey', '#990000'][i];
      })
     .attr("d", area);

  paintHistogram(_data);
  $('#my-timeplot').click(onClickPlot);
  $('#boundField').attr('value', params.bound);
  if (params.showBad)
    $('#showBadField').attr('checked', 'checked');
  else
    $('#showBadField').removeAttr('checked');
}

function update(args) {
  $.extend(params, args);
  renderPlot();
}

function onClickPlot(evt) {
  var x = evt.pageX-$("g.x.axis").offset().left;
  var t = X.invert(x);
  var d = {};
  for (var i = 0; i < loc_data.length && loc_data[i].time < t; ++i) {
    for (var loc in loc_data[i].locales) {
      d[loc] = loc_data[i].locales[loc];
    }
  }
  paintHistogram(d);
}

function paintHistogram(d) {
  var data = [], loc, i;
  for (loc in d) {
    data.push(d[loc]);
  }
  function numerical(a, b) {return a-b;}
  data.sort(numerical);
  var smooth = Math.sqrt;
  var clusterer = new Clusterer(data, smooth);
  var ranges = clusterer.get_ranges(4); // TODO find something better
  var hists = new Array(ranges.length);
  for (i = 0; i < hists.length; ++i) hists[i] = [];
  var maxcount = 1;
  for (loc in d) {
    var val = d[loc];
    for (i = 0; i < ranges.length && val > ranges[i].max; ++i) {
    }
    if (hists[i][val]) {
      hists[i][val].push(loc);
      if (hists[i][val].length > maxcount) {
        maxcount = hists[i][val].length;
      }
    } else {
      hists[i][val] = [loc];
    }
  }

  // histogram
  var hist_block = $('<div>').addClass('hist_block');
  var graphs_row = $('<tr>').addClass("hist graph")
      .append($('<td>').addClass("axis")
              .append(hist_block));
  var descs_row = $('<tr>').addClass("hist desc").append('<td>');
  $('#histogram').empty().append($('<table>').append(graphs_row).append(descs_row));
  var atitle = $('<span>').text(maxcount);
  atitle.css('position', 'absolute').css('top', '0px');
  hist_block.append(atitle);
  hist_block.css('width', atitle.css('width'));
  hist_block.css('padding-left', '1px').css('padding-right', '1px');
  // create display of histogram
  var barwidth = 10;
  var chart_height = Number(hist_block.css('height').replace('px',''));
  var display_f = function(_v) {
    return Math.pow(_v, 3 / 4);
  };
  var scale = chart_height * 1.0 / display_f(maxcount);
  var hist, range, td, values, previous_j, _left, v, height;
  function valuesForHist(h) {
    function m(v, i) {
      return v ? i : undefined;
    }
    function f(v) {return v!== undefined;}
    return h.map(m).filter(f);
  }
  for (i in hists) {
    hist = hists[i];
    range = ranges[i];
    td = $('<td>').appendTo(descs_row);
    if (range.min == range.max) {
      td.append(range.min);
    } else {
      td.append(range.min + ' - ' + range.max);
    }
    td = $('<td>').attr('title', range.count).appendTo(graphs_row);
    hist_block = $("<div>").addClass("hist_block").appendTo(td);
    values = valuesForHist(hist);
    values.sort(numerical);
    previous_j = null;
    _left = 0;
    for (var k in values) {
      j = values[k];
      v = hist[j];
      v.sort();
      height = display_f(v.length) * scale;
      if (previous_j !== null) {
        _left += (smooth(j - 1) - smooth(previous_j)) * barwidth;
      }
      $('<div>')
          .addClass('bar')
          .attr('title', j + ': ' + v.join(' ') + ' (' + v.length + ')')
          .css({
            top: chart_height - height + 'px',
            width: barwidth - 2 + 'px',
            height: height - 1 + 'px',
            left: Number(_left).toFixed(1) + 'px'
          })
          .appendTo(hist_block);
      previous_j = j;
      _left += barwidth;
    }
    hist_block.css("width", Number(_left).toFixed(1) + 'px');
  }
}

$(renderPlot);
