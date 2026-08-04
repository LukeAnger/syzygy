import React from 'react'
import PropTypes from 'prop-types';

import DynamicChart from './DynamicChart.jsx'


const InitialVelocityChart = ({vars}) => {

  let v1 = 0;
  console.log('Initial Velocity Chart')
  if (vars.t && vars.v2) {

    v1 = Number(vars.v2) - vars.a*vars.t
    let timeLabels = [...Array(Math.ceil(vars.t) + 1).keys()]
    let data = []
    timeLabels.forEach(t => {
      let v = v1 + vars.a*t
      data.push(v.toFixed(2))
    })
    return (
    <DynamicChart
      data = {data}
      xLabels = {timeLabels}
      titleLabel = {'Change in Position Over Time'}
      xAxisLabel = {'time (s)'}
      yAxisLabel = {'position (m)'}
      />
    )

  } else if (vars.v2 && vars.x1 && vars.x2) {
    v1 = Math.sqrt(vars.v2**2 - 2*vars.a*(vars.x2-vars.x1))
    let time = (vars.v2 - v1)/vars.a
    let timeLabels = [...Array(Math.ceil(time) + 1).keys()]
    let data = []
    timeLabels.forEach(t => {
      let v = v1 + vars.a*t
      data.push(v.toFixed(2))
    })
    return (
    <DynamicChart
      data = {data}
      xLabels = {timeLabels}
      titleLabel = {'Change in Position Over Time'}
      xAxisLabel = {'time (s)'}
      yAxisLabel = {'position (m)'}
      />
    )

  } else if (vars.t && vars.x1 && vars.x2) {
    v1 = (vars.x2 - vars.x1)/vars.t - 0.5*vars.a*vars.t
    let timeLabels = [...Array(Math.ceil(vars.t) + 1).keys()]
    let data = []
    timeLabels.forEach(t => {
      let v = v1 + vars.a*t
      data.push(v.toFixed(2))
    })
    return (
    <DynamicChart
      data = {data}
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

InitialVelocityChart.propTypes = {
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

export default InitialVelocityChart

