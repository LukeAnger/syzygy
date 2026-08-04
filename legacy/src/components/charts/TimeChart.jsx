import React from 'react'
import PropTypes from 'prop-types';

import DynamicChart from './DynamicChart.jsx'

const TimeChart = ({vars}) => {

  let t = 0;
  if (vars.v1 && vars.v2) {
    t = (vars.v2 - vars.v1)/vars.a
    let timeLabels = [...Array(Math.ceil(t) + 1).keys()]
    let vData = [];
    timeLabels.forEach(t => {
      let v = Number(vars.v1) + vars.a*t
      vData.push(v.toFixed(2))
    })
    return (
      <DynamicChart
      data = {vData}
      xLabels = {timeLabels}
      titleLabel = {'Change in Velocity Over Time'}
      xAxisLabel = {'time (s)'}
      yAxisLabel = {'velocity (m/s)'}
      />
    )
  } else if ((vars.v1 || vars.v1 === 0)  && (vars.x1 || vars.x1 === 0) && (vars.x2 || vars.x2 === 0)) {
    t = (-vars.v1 - Math.sqrt(vars.v1**2 - 2*vars.a*(vars.x1-vars.x2)))/vars.a
    let timeLabels = [...Array(Math.ceil(t) + 1).keys()]
    let xData = [];
    timeLabels.forEach(t => {
      let x = Number(vars.x1) + vars.v1*t + 0.5*vars.a*t**2
      xData.push(x.toFixed(2))
    })
    return (
      <DynamicChart
      data = {xData}
      xLabels = {timeLabels}
      titleLabel = {'Change in Position Over Time'}
      xAxisLabel = {'time (s)'}
      yAxisLabel = {'position (m)'}
      />
    )
  } else {
    return null
  }
}

TimeChart.propTypes = {
  vars: PropTypes.shape({
    a: PropTypes.string.isRequired,
    x1: PropTypes.string.isRequired,
    x2: PropTypes.string.isRequired,
    v1: PropTypes.string.isRequired,
    v2: PropTypes.string.isRequired,
    t: PropTypes.string.isRequired,
    units: PropTypes.oneOf(['metric', 'imperial']).isRequired,
  }).isRequired,
};

export default TimeChart