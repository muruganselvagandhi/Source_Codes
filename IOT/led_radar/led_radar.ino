#include <WiFi.h>
#include <WiFiSSLClient.h>
#include <ArduinoHttpClient.h>
#include "DFRobot_mmWave_Radar.h"

#define RADAR_BAUD 115200
#define STM32_BAUD 115200

// WiFi credentials
const char* ssid ="Shadow";
const char* password ="12345678";

// Firebase credentials
const char* FIREBASE_HOST = "radar-d1655-default-rtdb.firebaseio.com";
const char* FIREBASE_AUTH = "HAha99glvj2oic0kDNJ1wTTC1yHCQscsNnc8BZdd";

// Radar object
DFRobot_mmWave_Radar radar(&Serial2);

// Pin Configuration
const int motionPin = 25;
const int ledPresence = 13;
const int ledSpeed = 12;

// Sensor states
int humanPresence = 0;
int motionDetected = 0;
int speed = 0;

// Firebase communication
WiFiSSLClient wifiClient;
HttpClient firebaseClient = HttpClient(wifiClient, FIREBASE_HOST, 443);

// Timing
unsigned long lastFirebaseUpdate = 0;
const unsigned long firebaseInterval = 300;

// For better change detection
int lastHumanPresence = -1;
int lastMotionDetected = -1;
int lastSpeed = -1;

void connectWiFi() {
  WiFi.disconnect();
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED) {
    delay(300);
    Serial.print(".");
    if (++attempts > 20) {
      Serial.println("\nWiFi connection failed. Restarting...");
      NVIC_SystemReset();
    }
  }
  Serial.println("\nWiFi Connected!");
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());
}

void sendDataToFirebase(int speedVal, int humanVal, int motionVal) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected, reconnecting...");
    connectWiFi();
  }

  String path = "/sensorData.json?auth=" + String(FIREBASE_AUTH);
  String json = "{\"speed\": " + String(speedVal) +
                ", \"humanPresence\": " + String(humanVal) +
                ", \"motion\": " + String(motionVal) + "}";

  Serial.print("Uploading to Firebase: ");
  Serial.println(json);

  firebaseClient.beginRequest();
  firebaseClient.put(path);
  firebaseClient.sendHeader("Content-Type", "application/json");
  firebaseClient.sendHeader("Content-Length", json.length());
  firebaseClient.beginBody();
  firebaseClient.print(json);
  firebaseClient.endRequest();

  int statusCode = firebaseClient.responseStatusCode();
  String response = firebaseClient.responseBody();

  Serial.print("Firebase Status: ");
  Serial.println(statusCode);
  Serial.print("Response: ");
  Serial.println(response);
}

void setup() {
  Serial.begin(115200);
  Serial1.begin(STM32_BAUD);
  Serial2.begin(RADAR_BAUD);

  pinMode(motionPin, INPUT);
  pinMode(ledPresence, OUTPUT);
  pinMode(ledSpeed, OUTPUT);

  connectWiFi();

  radar.factoryReset();
  radar.DetRangeCfg(0, 0.1);
  radar.OutputLatency(0.0, 0.0);

  Serial.println("Radar initialized.");
}

void loop() {
  unsigned long currentMillis = millis();

  // --- Human Presence --- //
  int presence = radar.readPresenceDetection();
  humanPresence = (presence == 1) ? 1 : 0;
  digitalWrite(ledPresence, humanPresence);
  if (humanPresence != lastHumanPresence) {
    Serial.print("Human Presence: ");
    Serial.println(humanPresence ? "DETECTED" : "Not Detected");
    lastHumanPresence = humanPresence;
  }

  // --- Motion Sensor --- //
  motionDetected = digitalRead(motionPin);
  if (motionDetected != lastMotionDetected) {
    Serial.print("Motion Sensor: ");
    Serial.println(motionDetected ? "Motion Detected" : "No Motion");
    lastMotionDetected = motionDetected;
  }

  // --- Speed from STM32 --- //
  static String line = "";
  while (Serial1.available()) {
    char c = Serial1.read();
    if (c == '\n') {
      line.trim();
      if (line.startsWith("STM32: Speed:")) {
        int s = line.substring(line.indexOf(": Speed:") + 8, line.indexOf("km/h")).toInt();
        speed = s;
        if (speed != lastSpeed) {
          Serial.print("STM32 Speed: ");
          Serial.print(speed);
          Serial.println(" km/h");
          lastSpeed = speed;
        }
      }
      line = "";
    } else {
      line += c;
    }
  }

  // --- Speed LED Control --- //
  if (speed > 7) {
    digitalWrite(ledSpeed, HIGH);
    Serial.println("LED Speed: ON (Speed > 7)");
  } else {
    digitalWrite(ledSpeed, LOW);
    Serial.println("LED Speed: OFF (Speed <= 7)");
  }

  // --- Firebase Update --- //
  if (currentMillis - lastFirebaseUpdate >= firebaseInterval) {
    lastFirebaseUpdate = currentMillis;
    sendDataToFirebase(speed, humanPresence, motionDetected);
  }

  delay(1); // Minimal delay for high responsiveness
}
