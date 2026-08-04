import React, { useState } from 'react';
import { Charts } from './components/Charts';
import { Solvers } from './components/Solvers';
import { Static } from './components/Static';
import Storymode from './components/Storymode.jsx';
import ManualInput from './components/ManualInput.jsx';
import { treeOak } from './components/svgs';

// Object containing default values for variables
const varObj = {
  a: '-9.82',
  x1: '',
  x2: '',
  v1: '',
  v2: '',
  t: '',
  units: 'metric',
};

const App = () => {
  // State variables
  const [variables, setVariables] = useState(varObj);
  const [animate, setAnimate] = useState(0);
  const [showScene, setShowScene] = useState(false);

  // Check if all variables are empty
  const empty = (
    variables.x1 === ''
    && variables.x2 === ''
    && variables.v1 === ''
    && variables.v2 === ''
    && variables.t === ''
  );

  // Update state with new variable values
  const onChangeVariables = (obj) => {
    setVariables(obj);
  };

  // Reset state to default variable values
  const resetVars = () => {
    setVariables(varObj);
  };

  // Determine the type of animation to use
  // Currently being developed access the animationType and show scene state variables in the react dev tools to view in browser
  const animationType = () => {
    if (animate !== 0) setAnimate(0); //reset apple
    else if (variables.v1 > 0) setAnimate(1); // animate v1 > 0
    else if (variables.v1 === 0) setAnimate(2); // animate v1 = 0
    else if (variables.v1 < 0) setAnimate(3); // animate v1 < 0
  };

  return (
    <section style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '95vh', width: '95vw' }}>
      <Static.SyzygyLogo />
      <Static.FFKinHeader vars={variables} />

      {/* Rendering of static variables and equations components*/}
      <div className="fr eqs-vars">
        <Static.VariableNames />
        <Static.Equations />
      </div>

      {/* Rendering of manual input component */}
      <div className="maths fr jc-sb">
        <ManualInput vars={variables} onChangeVariables={onChangeVariables} animationType={animationType} resetVars={resetVars} />

        {/* Conditional rendering of solver components */}
        {variables.t === '?' &&
          <Solvers.TimeSolver vars={variables} />}

        {variables.x1 === '?' &&
          <Solvers.InitialPositionSolver vars={variables} />}

        {variables.x2 === '?' &&
          <Solvers.FinalPositionSolver vars={variables} />}

        {variables.v1 === '?' &&
          <Solvers.InitialVelocitySolver vars={variables} />}

        {variables.v2 === '?' &&
          <Solvers.FinalVelocitySolver vars={variables} />}

        {empty &&
          <Static.NoQuestionMark vars={variables} />}
      </div>

          {/* Rendering of scene and chart components */}
          {/* Not implemented currently */}
      <div className="diagrams fr">
        <div id="scene">
          {showScene ? treeOak(animate, animationType) : <Storymode vars={variables} onChangeVariables={onChangeVariables} />}
        </div>
        <div id="free-body">

          {/* Conditional rendering of chart components */}
          {variables.t === '?' &&
            <Charts.TimeChart vars={variables} />}

          {variables.x1 === '?' &&
            <Charts.InitialPositionChart vars={variables} />}

          {variables.x2 === '?' &&
            <Charts.FinalPositionChart vars={variables} />}

          {variables.v1 === '?' &&
            <Charts.InitialVelocityChart vars={variables} />}

          {variables.v2 === '?' &&
            <Charts.FinalVelocityChart vars={variables} />}
        </div>
      </div>
    </section>
  );
};
export default App;