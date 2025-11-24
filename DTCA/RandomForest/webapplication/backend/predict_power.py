#!/usr/bin/env python3
"""
Wind Power Prediction Script
Loads the Random Forest model and makes predictions based on wind speed
"""

import sys
import json
import pickle
import numpy as np
import warnings
warnings.filterwarnings('ignore')

def predict_power(model_path, wind_speed):
    """
    Predict power generation using the trained Random Forest model
    
    Args:
        model_path (str): Path to the .pkl model file
        wind_speed (float): Wind speed in m/s
    
    Returns:
        dict: Prediction result with success status and power value
    """
    try:
        # Load the trained model
        with open(model_path, 'rb') as file:
            model = pickle.load(file)
        
        # Validate wind speed
        wind_speed = float(wind_speed)
        if wind_speed < 0 or wind_speed > 25:
            wind_speed = max(0, min(wind_speed, 25))
        
        # Prepare input (model expects 2D array)
        X = np.array([[wind_speed]])
        
        # Make prediction
        power = model.predict(X)[0]
        
        # Ensure power is non-negative
        power = max(0, float(power))
        
        return {
            'success': True,
            'power': round(power, 2),
            'wind_speed': wind_speed
        }
    
    except FileNotFoundError:
        return {
            'success': False,
            'error': f'Model file not found: {model_path}'
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }

if __name__ == '__main__':
    if len(sys.argv) != 3:
        result = {
            'success': False,
            'error': 'Usage: python predict_power.py <model_path> <wind_speed>'
        }
    else:
        model_path = sys.argv[1]
        wind_speed = sys.argv[2]
        result = predict_power(model_path, wind_speed)
    
    # Output as JSON
    print(json.dumps(result))
