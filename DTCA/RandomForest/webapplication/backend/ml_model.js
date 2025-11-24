const { spawn } = require('child_process');
const path = require('path');

// Full path to your Python interpreter
const PYTHON_PATH = "C:\\Users\\S Murugan\\AppData\\Local\\Programs\\Python\\Python310\\python.exe";

// Path to the Python script and model
const PYTHON_SCRIPT = path.join(__dirname, 'predict_power.py');
const MODEL_PATH = path.join(__dirname, '../../wind_power_rf_model.pkl');

/**
 * Make power prediction using the Random Forest model
 * @param {number} windSpeed - Wind speed in m/s
 * @returns {Promise<number>} - Predicted power in kW
 */
const predictPower = (windSpeed) => {
  return new Promise((resolve, reject) => {
    
    // Validate input
    if (typeof windSpeed !== 'number' || isNaN(windSpeed)) {
      return reject(new Error('Invalid wind speed'));
    }

    // Clamp wind speed to valid range
    windSpeed = Math.max(0, Math.min(windSpeed, 25));

    // Spawn python using the FULL PATH (Windows-safe)
    const python = spawn(PYTHON_PATH, [
      PYTHON_SCRIPT,
      MODEL_PATH,
      windSpeed.toString()
    ]);

    let dataString = '';
    let errorString = '';

    python.stdout.on('data', (data) => {
      dataString += data.toString();
    });

    python.stderr.on('data', (data) => {
      errorString += data.toString();
    });

    python.on('close', (code) => {
      if (code !== 0) {
        console.error('Python script error:', errorString);
        return reject(new Error(`Model prediction failed: ${errorString}`));
      }

      try {
        const result = JSON.parse(dataString);
        if (result.success) {
          resolve(result.power);
        } else {
          reject(new Error(result.error || 'Prediction failed'));
        }
      } catch (err) {
        reject(new Error('Failed to parse prediction result'));
      }
    });
  });
};

/**
 * Predict for multiple wind speeds
 */
const predictPowerBatch = async (windSpeeds) => {
  try {
    const predictions = await Promise.all(
      windSpeeds.map(ws => predictPower(ws))
    );
    return predictions;
  } catch (error) {
    throw error;
  }
};

module.exports = {
  predictPower,
  predictPowerBatch
};
