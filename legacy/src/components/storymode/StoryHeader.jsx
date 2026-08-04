import React from 'react';
import PropTypes from 'prop-types';
import { BiMicrophone } from 'react-icons/bi';

const StoryHeader = ({ handleListen, isListening }) => {
  return (
    <div className='story-header'>
      <h1 style={{ fontSize: '1.8rem' }}>Storymode</h1>
      <button className='mic' style={{ marginLeft: 'auto' }} onMouseDown={handleListen} disabled={isListening}>
        <BiMicrophone style={{ transform: 'scale(2)', color: 'beige' }} /><div></div>
      </button>
    </div>
  );
};

StoryHeader.propTypes = {
  handleListen: PropTypes.func.isRequired,
  isListening: PropTypes.bool.isRequired,
};

export default StoryHeader;
