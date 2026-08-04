import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { BiMicrophone } from 'react-icons/bi';

let defaultString = 'Get started with Storymode by clicking and holding down the microphone and reading your story problem';

const Storymode = ({ vars, onChangeVariables }) => {
  const [value, setValue] = useState('');
  const [newString, setNewString] = useState(defaultString);
  const [isListening, setIsListening] = useState(false);

  let initialVelocity = value.search(/from rest/i) !== -1 ? 0 : "";
  let finalVelocityMatch = /[\s-](hits the ground at|lands at|landsat)[\s-](?<finalVelocity>-?\d+(\.\d+)?)/i.exec(value);

  // console.log(finalVelocityMatch.groups.finalVelocity)
  let finalVelocity = finalVelocityMatch !== null ? -parseFloat(finalVelocityMatch.groups.finalVelocity) : "";

  const handleListen = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.start();
    setIsListening(true);

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setValue(transcript);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);

    };
  };



  const handleStop = () => {

    let formattedString = value.charAt(0).toUpperCase() + value.slice(1);
    formattedString = formattedString.replace("Apple", "apple")
      .replace("landsat", "lands at")
      .replace(/m per second|meters per second|m per s/gi, 'm/s');

    setNewString(formattedString);

    onChangeVariables({
      v1: initialVelocity.toString(),
      v2: finalVelocity.toString(),
      x1: '',
      x2: '',
      t: '?',
      a: '-9.82',
      units: 'metric',
    });
  };

  return (
    <div className='story'>
      <div className='story-container fc jc-cen ai-cen'>
        <div className='fr' style={{ position: 'absolute', top: '10px', width: '90%' }}>
          <h1 style={{ fontSize: '1.8rem' }}>Storymode</h1>
          <button className='mic' style={{ marginLeft: 'auto' }} onMouseDown={handleListen} onMouseUp={handleStop}>
            <BiMicrophone style={{ transform: 'scale(2)', color: 'beige' }} /><div></div>
          </button>
        </div>
        <div className='story-text' style={{ width: '90%', height: '80%', fontSize: '1.2rem' }}>{newString}</div>
      </div>
    </div>
  );
};

Storymode.propTypes = {
  vars: PropTypes.shape({
    a: PropTypes.string.isRequired,
    x1: PropTypes.string.isRequired,
    x2: PropTypes.string.isRequired,
    v1: PropTypes.string.isRequired,
    v2: PropTypes.string.isRequired,
    t: PropTypes.string.isRequired,
    units: PropTypes.oneOf(['metric', 'imperial']).isRequired,
  }).isRequired,
  onChangeVariables: PropTypes.func.isRequired,
};

export default Storymode