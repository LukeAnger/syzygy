import React from 'react';
import {eq1, eq2} from './equations.js'
import Chart from 'chart.js/auto';
import { Line } from 'react-chartjs-2';


Chart.defaults.font.size = 14;
Chart.defaults.font.family = 'Poppins';
Chart.defaults.color = 'black';



const FreeBody = ({vars}) => {

  return (
    <div>
      <Line
          width={'280px'}
          height={'240px'}
          data = {
            {
            labels: ['0', '1', '2', '3', '4', '5'],
            datasets: [{
              label: 'Change in Velocity Over Time',
              data: [-40, -50, -60, -70, -80, -90],
              backgroundColor: '#fadb75',
              borderColor: '#4f4f4f'
            }],

            }
          }
          options = {{
            scales: {
              y: {
                title: {
                  display: true,
                  text: 'Velocity (m/s)',
                }
              },
              x: {
                title: {
                  display: true,
                  text: 'Time (s)'
                }
              }

            }
          }

          }
          />

    </div>
  )
}

export default FreeBody