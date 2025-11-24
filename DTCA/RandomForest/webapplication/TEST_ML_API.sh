#!/bin/bash

echo "🧪 Testing ML Model API"
echo "======================="
echo ""

# Test 1: Wind speed 5 m/s
echo "Test 1: Wind Speed = 5 m/s"
curl -X POST http://localhost:5068/api/ml/predict \
  -H "Content-Type: application/json" \
  -d '{"windSpeed":5}' 2>/dev/null | jq '.predictedPower'
echo ""

# Test 2: Wind speed 7 m/s
echo "Test 2: Wind Speed = 7 m/s"
curl -X POST http://localhost:5068/api/ml/predict \
  -H "Content-Type: application/json" \
  -d '{"windSpeed":7}' 2>/dev/null | jq '.predictedPower'
echo ""

# Test 3: Wind speed 10 m/s
echo "Test 3: Wind Speed = 10 m/s"
curl -X POST http://localhost:5068/api/ml/predict \
  -H "Content-Type: application/json" \
  -d '{"windSpeed":10}' 2>/dev/null | jq '.predictedPower'
echo ""

# Test 4: Wind speed 12 m/s
echo "Test 4: Wind Speed = 12 m/s"
curl -X POST http://localhost:5068/api/ml/predict \
  -H "Content-Type: application/json" \
  -d '{"windSpeed":12}' 2>/dev/null | jq '.predictedPower'
echo ""

# Test 5: Wind speed 15 m/s
echo "Test 5: Wind Speed = 15 m/s"
curl -X POST http://localhost:5068/api/ml/predict \
  -H "Content-Type: application/json" \
  -d '{"windSpeed":15}' 2>/dev/null | jq '.predictedPower'
echo ""

# Test 6: Wind speed 18 m/s
echo "Test 6: Wind Speed = 18 m/s"
curl -X POST http://localhost:5068/api/ml/predict \
  -H "Content-Type: application/json" \
  -d '{"windSpeed":18}' 2>/dev/null | jq '.predictedPower'
echo ""

# Test 7: Wind speed 20 m/s
echo "Test 7: Wind Speed = 20 m/s"
curl -X POST http://localhost:5068/api/ml/predict \
  -H "Content-Type: application/json" \
  -d '{"windSpeed":20}' 2>/dev/null | jq '.predictedPower'
echo ""

echo "======================="
echo "✅ All different values? Model is working!"
echo "❌ Same values? Model has a problem!"
