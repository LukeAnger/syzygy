import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { BiMicrophone } from 'react-icons/bi';

const SpeechRecognition = ({ onListenStart, onListenStop }) => {
  const [isListening, setIsListening] = useState(false);

  const handleListen = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.start();
    setIsListening(true);

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      onListenStop(transcript);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };
  };

  const handleStop = () => {
    setIsListening(false);
    onListenStop();
  };

  return (
    <button
      className='mic'
      style={{ marginLeft: 'auto' }}
      onMouseDown={() => {
        onListenStart();
        handleListen();
      }}
      onMouseUp={handleStop}
    >
      <BiMicrophone style={{ transform: 'scale(2)', color: 'beige' }} />
      <div></div>
    </button>
  );
};

SpeechRecognition.propTypes = {
  onListenStart: PropTypes.func.isRequired,
  onListenStop: PropTypes.func.isRequired,
};

export default SpeechRecognition;
