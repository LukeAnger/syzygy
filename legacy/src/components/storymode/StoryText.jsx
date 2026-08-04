import React from 'react';
import PropTypes from 'prop-types';

const StoryText = ({ text }) => {
  const formattedText = text
    .charAt(0).toUpperCase() + text.slice(1)
    .replace("Apple", "apple")
    .replace("landsat", "lands at")
    .replace(/m per second|meters per second|m per s/gi, 'm/s');

  return (
    <div className='story-text' style={{ width: '90%', height: '80%', fontSize: '1.2rem' }}>
      {formattedText}
    </div>
  );
};

StoryText.propTypes = {
  text: PropTypes.string.isRequired,
};

export default StoryText;
