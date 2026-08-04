import React from 'react'
import PropTypes from 'prop-types';
import DynamicChart from './DynamicChart.jsx'

const InitialPositionChart = ({vars}) => {

  let x1 = 0;
  console.log('Initial Position Chart')
  if (vars.t && vars.v1 && vars.x2) {

    x1 = vars.x2 - vars.v1*vars.t - 0.5*vars.a*vars.t**2
    let timeLabels = [...Array(Math.ceil(vars.t) + 1).keys()]
    let xData = [];
    timeLabels.forEach(t => {
      let x = x1 + vars.v1*t + 0.5*vars.a*t**2
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

  } else if (vars.t && vars.v2 && vars.x2) {
    x1 = vars.x2 - (vars.v2 - 0.5*vars.a*vars.t) - 0.5*vars.a*vars.t**2
    let timeLabels = [...Array(Math.ceil(vars.t) + 1).keys()]
    let xData = [];
    timeLabels.forEach(t => {
      let x = x1 + vars.v1*t + 0.5*vars.a*t**2
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

  } else if (vars.v1 && vars.v2 && vars.x2) {
    x1 = (vars.v2**2 - vars.v1**2)/(-vars.a*2 + vars.x2)

    let time = (vars.v2 - vars.v1)/vars.a
    let timeLabels = [...Array(Math.ceil(time) + 1).keys()]
    let xData = []
    timeLabels.forEach(t => {
      let x = x1 + vars.v1*t + 0.5 * vars.a * t**2
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

InitialPositionChart.propTypes = {
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

export default InitialPositionChart

