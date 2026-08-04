import React from 'react'
import PropTypes from 'prop-types';

import DynamicChart from './DynamicChart.jsx'

const FinalVelocityChart = ({vars}) => {
  let v2 = 0;
  console.log('Final Velocity Chart')
  if (vars.t && vars.v1) {

    v2 = Number(vars.v1) + vars.a*vars.t

    return (
<></>
    )

  } else if (vars.v1 && vars.x1 && vars.x2) {
    v2 = Math.sqrt(vars.v1**2 + 2*vars.a*(vars.x2-vars.x1))
    console.log(vars.v1**2 + 2*vars.a*(vars.x2-vars.x1))
    return (
<></>
    )

  } else {
    return null
  }
}

FinalVelocityChart.propTypes = {
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

export default FinalVelocityChart

