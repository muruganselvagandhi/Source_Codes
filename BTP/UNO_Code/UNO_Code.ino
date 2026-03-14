#include <WiFiS3.h>
#include <WiFiUdp.h>
#include <SPI.h>
#include <Wire.h>
#include <U8g2lib.h>

// ================= WIFI STA SETTINGS =================
const char* ssid     = "SHYZNM";
const char* password = "iiits@123";

WiFiServer server(80);

// ================= FIREBASE REALTIME DB SETTINGS =================
// Realtime DB host (NO https://, just domain)
const char* FIREBASE_HOST      = "batterydata-53844-default-rtdb.firebaseio.com";
// Base path for logs
// Full path example: /vehicles/scooter01/logs/<key>.json
const char* FIREBASE_BASE_PATH = "/vehicles/scooter01/logs";

// ================= NTP / TIME (UTC + IST) =================
WiFiUDP ntpUDP;
const char* NTP_SERVER = "pool.ntp.org";
const int   NTP_PORT   = 123;
const unsigned long NTP_INTERVAL_MS = 3600000UL; // re-sync every 1 hour

byte ntpPacketBuffer[48];
bool timeSynced        = false;
unsigned long epoch_base_utc = 0;   // epoch UTC at last sync
unsigned long ms_at_sync     = 0;   // millis() at last sync
unsigned long lastNtpSync    = 0;

// Send NTP request packet
void sendNTPpacket(const char* address) {
  memset(ntpPacketBuffer, 0, 48);
  ntpPacketBuffer[0] = 0b11100011;   // LI, Version, Mode
  ntpPacketBuffer[1] = 0;           // Stratum, or type of clock
  ntpPacketBuffer[2] = 6;           // Polling Interval
  ntpPacketBuffer[3] = 0xEC;        // Peer Clock Precision

  ntpPacketBuffer[12] = 49;
  ntpPacketBuffer[13] = 0x4E;
  ntpPacketBuffer[14] = 49;
  ntpPacketBuffer[15] = 52;

  IPAddress ntpServerIP;
  WiFi.hostByName(address, ntpServerIP);
  ntpUDP.beginPacket(ntpServerIP, NTP_PORT);
  ntpUDP.write(ntpPacketBuffer, 48);
  ntpUDP.endPacket();
}

// Try to sync time from NTP
bool syncTimeFromNTP() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[NTP] WiFi not connected");
    return false;
  }

  Serial.println("[NTP] Syncing time...");
  ntpUDP.begin(2390);
  sendNTPpacket(NTP_SERVER);

  unsigned long start = millis();
  while (millis() - start < 2000) {
    int size = ntpUDP.parsePacket();
    if (size >= 48) {
      ntpUDP.read(ntpPacketBuffer, 48);

      unsigned long highWord = word(ntpPacketBuffer[40], ntpPacketBuffer[41]);
      unsigned long lowWord  = word(ntpPacketBuffer[42], ntpPacketBuffer[43]);
      unsigned long secsSince1900 = (highWord << 16) | lowWord;
      const unsigned long seventyYears = 2208988800UL; // seconds from 1900 to 1970
      unsigned long epoch = secsSince1900 - seventyYears;

      epoch_base_utc = epoch;
      ms_at_sync     = millis();
      timeSynced     = true;
      lastNtpSync    = millis();

      Serial.print("[NTP] UTC epoch: ");
      Serial.println(epoch_base_utc);
      return true;
    }
  }

  Serial.println("[NTP] No response");
  return false;
}

// Current UTC epoch seconds
unsigned long getEpochUtc() {
  if (!timeSynced) return 0;
  unsigned long msNow = millis();
  unsigned long deltaSec = (msNow - ms_at_sync) / 1000UL;
  return epoch_base_utc + deltaSec;
}

// Current IST epoch (UTC + 5h30m)
unsigned long getEpochIst() {
  unsigned long utc = getEpochUtc();
  if (utc == 0) return 0;
  const unsigned long IST_OFFSET = 5UL * 3600UL + 30UL * 60UL; // 19800 seconds
  return utc + IST_OFFSET;
}

// ---------- EPOCH → DATE/TIME HELPERS (IST STRING) ----------
bool isLeapYear(int year) {
  return ((year % 4 == 0) && (year % 100 != 0)) || (year % 400 == 0);
}

int daysInMonth(int year, int month) {
  static const int days[12] = {31,28,31,30,31,30,31,31,30,31,30,31};
  if (month == 2 && isLeapYear(year)) return 29;
  return days[month - 1];
}

// Convert Unix epoch (seconds) to date/time components
void epochToDateTime(unsigned long epoch, int &year, int &month, int &day,
                     int &hour, int &minute, int &second) {
  unsigned long secondsInDay = epoch % 86400UL;
  unsigned long days = epoch / 86400UL;

  hour   = secondsInDay / 3600;
  minute = (secondsInDay % 3600) / 60;
  second = secondsInDay % 60;

  year = 1970;
  while (true) {
    int daysThisYear = isLeapYear(year) ? 366 : 365;
    if (days >= (unsigned long)daysThisYear) {
      days -= daysThisYear;
      year++;
    } else {
      break;
    }
  }

  month = 1;
  while (true) {
    int dim = daysInMonth(year, month);
    if (days >= (unsigned long)dim) {
      days -= dim;
      month++;
    } else {
      break;
    }
  }

  day = (int)days + 1;
}

// Build "YYYY-MM-DD HH:MM:SS" for IST
String getIstTimestampString() {
  unsigned long tsIst = getEpochIst();
  if (tsIst == 0) return "1970-01-01 00:00:00";

  int y, m, d, hh, mm, ss;
  epochToDateTime(tsIst, y, m, d, hh, mm, ss);

  char buf[25];
  snprintf(buf, sizeof(buf), "%04d-%02d-%02d %02d:%02d:%02d",
           y, m, d, hh, mm, ss);
  return String(buf);
}

// ================= DAC / THROTTLE SECTION =================

// Pins
#define THROTTLE_PIN  A1   // Throttle analog input
#define DAC_PIN       A0   // DAC output (0–5V true analog on UNO R4)

// DAC settings (UNO R4 has 12-bit DAC 0..4095 = 0..5V)
#define MIN_DAC   500      // Minimum DAC (≈0.6V) to start motion
#define MAX_DAC   4095     // Maximum DAC (~5V)

// Ramping
#define RAMP_STEP        40    // Acceleration smoothness
#define BRAKE_STEP       120   // Braking speed
#define RAMP_INTERVAL    20    // ms

// Throttle calibration (tune with Serial)
#define THROTTLE_START   600   // ADC value where motion starts
#define THROTTLE_MAX     3500  // ADC value for full throttle

// Variables
int throttleValue = 0;      // raw ADC from throttle
int targetDAC     = 0;      // desired DAC value
int currentDAC    = 0;      // smoothed DAC value

unsigned long lastRampTime = 0;

// Remote control state (via WiFi)
bool isRemoteMode = false;
int  remoteDAC    = 0;      // 0..4095

// ================= SIMPLE WEB UI (for Remote DAC) =================

const char index_html[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>UNO R4 Scooter DAC Control</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { background:#111; color:#eee; font-family:Arial; text-align:center; padding:20px; }
    .card { background:#222; border-radius:10px; padding:20px; max-width:420px; margin:20px auto; box-shadow:0 0 10px #000; }
    button { padding:10px 20px; margin:10px; font-size:16px; border:none; border-radius:6px; cursor:pointer; }
    .on  { background:#2e7d32; color:#fff; }
    .off { background:#c62828; color:#fff; }
    input[type=range] { width:100%; }
    .value { font-size:22px; margin-top:10px; }
  </style>
</head>
<body>
  <div class="card">
    <h2>UNO R4 WiFi – DAC Control</h2>
    <p>Mode: <b><span id="mode">Manual</span></b></p>
    <button id="toggleBtn" class="off" onclick="toggleMode()">Switch to Remote</button>

    <hr>

    <h3>Remote DAC Value</h3>
    <input type="range" min="0" max="4095" value="0" id="slider" oninput="setDAC(this.value)">
    <div class="value">DAC: <span id="val">0</span></div>
    <p style="font-size:12px;opacity:0.7;">(Slider only takes effect in Remote mode)</p>
  </div>

<script>
let isRemote = false;

function refreshStatus() {
  fetch("/status")
    .then(r => r.json())
    .then(d => {
      isRemote = d.remote;
      document.getElementById("mode").textContent = isRemote ? "Remote" : "Manual";
      document.getElementById("toggleBtn").textContent = isRemote ? "Switch to Manual" : "Switch to Remote";
      document.getElementById("toggleBtn").className = isRemote ? "on" : "off";
      document.getElementById("slider").value = d.remoteDAC;
      document.getElementById("val").textContent = d.remoteDAC;
    })
    .catch(e => console.log(e));
}

function toggleMode() {
  fetch("/remote?toggle=1")
    .then(() => refreshStatus());
}

function setDAC(v) {
  document.getElementById("val").textContent = v;
  if (isRemote) {
    fetch("/set?dac=" + v);
  }
}

setInterval(refreshStatus, 1000);
window.onload = refreshStatus;
</script>
</body>
</html>
)rawliteral";

// ================= E-SCOOTER BMS + OLED (Waveshare SSD1309) =================

// On UNO R4, Serial1 is the HW UART you should use for E-Scooter BMS
#define BmsSerial Serial1

#define FRAME_LEN 13

// --- Waveshare 2.42" SSD1309 SPI pins (SW SPI via U8g2) ---
#define OLED_CS_PIN     10
#define OLED_DC_PIN     7
#define OLED_RESET_PIN  8
#define OLED_CLK_PIN    13   // connect to OLED CLK
#define OLED_MOSI_PIN   11   // connect to OLED DIN

// U8g2: SSD1309 128x64, 4-wire SPI, software SPI (monochrome)
U8G2_SSD1309_128X64_NONAME0_F_4W_SW_SPI u8g2(
  U8G2_R0,          // rotation
  /* clock=*/ OLED_CLK_PIN,
  /* data =*/ OLED_MOSI_PIN,
  /* cs   =*/ OLED_CS_PIN,
  /* dc   =*/ OLED_DC_PIN,
  /* reset=*/ OLED_RESET_PIN
);

// BMS Variables
uint8_t frame[FRAME_LEN];
float cellVolt[8];
float packV = 0, remCap_real = 0, fullCap_real = 0, soc = 0;
float temp1 = 0, temp2 = 0;

// For logging FET/Protection state to Firebase
bool lastChargeFet    = false;
bool lastDischargeFet = false;
bool lastBalanceFet   = false;
int  protFlags        = 0;

// Capacity model
const float RATED_CAP_AH = 15.0;
float learnedFullCapAh   = RATED_CAP_AH;  // can only go down over time

// BMS timing
const unsigned long BMS_INTERVAL = 10000; // 10 seconds
unsigned long lastBmsTime = 0;

// Animation
uint8_t  animFrame        = 0;
bool     isCharging       = false;
const bool DEBUG_ALWAYS_ANIMATE = false;   // set true to see animation always
const unsigned long ANIM_INTERVAL = 300;   // ms between animation frames
unsigned long lastAnimTime = 0;

// Forward declaration for display drawing
void drawBmsDisplay();

// ---------- Helper for BMS ----------
uint8_t calcChecksum(uint8_t *d, int len) {
  uint16_t s = 0;
  for (int i = 0; i < len - 1; ++i) s += d[i];
  return s & 0xFF;
}

void sendCommand(uint8_t cmd) {
  uint8_t req[13] = {0xA5, 0x40, cmd, 0x08, 0,0,0,0,0,0,0,0,0};
  req[12] = calcChecksum(req, 13);
  BmsSerial.write(req, 13);
  BmsSerial.flush();
}

bool readFrame(uint8_t *buf, uint8_t cmdExpected, int timeout = 400) {
  unsigned long start = millis();
  while (millis() - start < (unsigned long)timeout) {
    if (BmsSerial.available() >= FRAME_LEN) {
      if (BmsSerial.peek() != 0xA5) { BmsSerial.read(); continue; }
      BmsSerial.readBytes(buf, FRAME_LEN);
      if (buf[0]==0xA5 && buf[1]==0x01 && buf[2]==cmdExpected) return true;
    }
  }
  return false;
}

// ---------- 0x90 - Basic Info (capacity + SOC) ----------
void query_0x90() {
  sendCommand(0x90);
  delay(200);
  if (!readFrame(frame, 0x90)) {
    Serial.println("No valid 0x90 frame");
    return;
  }

  packV = ((frame[4] << 8) | frame[5]) / 10.0;

  uint16_t remRaw  = (frame[9]  << 8) | frame[8];
  uint16_t fullRaw = (frame[11] << 8) | frame[10];

  float remAh_raw  = remRaw  / 100.0;  // BMS remaining
  float fullAh_raw = fullRaw / 100.0;  // BMS full capacity estimation

  // Learn full capacity (degradation model):
  if (fullAh_raw > 0.1f) {
    if (fullAh_raw < learnedFullCapAh) {
      learnedFullCapAh = fullAh_raw;   // degrade over time
    }
  }

  fullCap_real = learnedFullCapAh;
  if (fullCap_real <= 0.1f) fullCap_real = RATED_CAP_AH;  // safety fallback

  // Remaining capacity = what BMS reports, clamped to fullCap_real
  remCap_real = remAh_raw;
  if (remCap_real > fullCap_real) remCap_real = fullCap_real;
  if (remCap_real < 0.0f) remCap_real = 0.0f;

  // SOC based on our "real" full capacity
  if (fullCap_real > 0.1f) {
    soc = (remCap_real / fullCap_real) * 100.0f;
  } else {
    soc = 0.0f;
  }
  if (soc > 100.0f) soc = 100.0f;
  if (soc < 0.0f)   soc = 0.0f;

  Serial.print("ES-BMS: V=");
  Serial.print(packV, 2);
  Serial.print("V  Rem=");
  Serial.print(remCap_real, 2);
  Serial.print("Ah  Full=");
  Serial.print(fullCap_real, 2);
  Serial.print("Ah  SOC=");
  Serial.print(soc, 1);
  Serial.println("%");
}

// ---------- 0x95 - Cell Voltages ----------
void query_0x95_all() {
  for (int i=0;i<8;i++) cellVolt[i]=0.0;
  for (int group=1; group<=3; ++group) {
    sendCommand(0x95);
    delay(200);
    if (!readFrame(frame, 0x95)) continue;
    uint8_t gid = frame[4];
    if (gid<1||gid>3) gid=group;
    for (int i=0;i<3;i++) {
      int idx=(gid-1)*3+i;
      if (idx>=7) break;
      uint16_t raw=(frame[5+2*i]<<8)|frame[6+2*i];
      cellVolt[idx]=raw/1000.0;
    }
  }
  Serial.print("Cells: ");
  for (int i = 0; i < 7; i++) {
    Serial.print("C");
    Serial.print(i + 1);
    Serial.print("=");
    Serial.print(cellVolt[i], 3);
    Serial.print("V ");
  }
  Serial.println();
}

// ---------- 0x92 - Temperatures ----------
void query_0x92() {
  sendCommand(0x92);
  delay(200);
  if (!readFrame(frame, 0x92)) {
    Serial.println("No valid 0x92 frame");
    return;
  }
  temp1 = frame[4] - 40.0;
  temp2 = frame[6] - 40.0;

  Serial.print("Tmp: T1=");
  Serial.print(temp1, 1);
  Serial.print("C  T2=");
  Serial.print(temp2, 1);
  Serial.println("C");
}

// ---------- 0x93 - MOSFET States ----------
void query_0x93() {
  sendCommand(0x93);
  delay(200);
  if (!readFrame(frame, 0x93)) {
    Serial.println("No valid 0x93 frame");
    return;
  }
  bool charge    = frame[4];
  bool discharge = frame[5];
  bool balance   = frame[6];

  isCharging       = charge;  // used for animation
  lastChargeFet    = charge;  // used for logging
  lastDischargeFet = discharge;
  lastBalanceFet   = balance;

  Serial.print("FET: Chg=");
  Serial.print(charge ? "ON" : "OFF");
  Serial.print("  Dis=");
  Serial.print(discharge ? "ON" : "OFF");
  Serial.print("  Bal=");
  Serial.println(balance ? "ON" : "OFF");
}

// ---------- 0x91 - Min/Max Cell Voltage ----------
void query_0x91() {
  sendCommand(0x91);
  delay(200);
  if (!readFrame(frame, 0x91)) return;

  float   maxCellV   = ((frame[4] << 8) | frame[5]) / 1000.0;
  uint8_t maxCellNum = frame[6];
  float   minCellV   = ((frame[7] << 8) | frame[8]) / 1000.0;
  uint8_t minCellNum = frame[9];
  float   diff       = maxCellV - minCellV;

  Serial.print("CMax: C");
  Serial.print(maxCellNum);
  Serial.print("=");
  Serial.print(maxCellV, 3);
  Serial.print("V  CMin: C");
  Serial.print(minCellNum);
  Serial.print("=");
  Serial.print(minCellV, 3);
  Serial.print("V  dV=");
  Serial.print(diff, 3);
  Serial.println("V");
}

// ---------- 0x96 - Cell Balance Status ----------
void query_0x96() {
  sendCommand(0x96);
  delay(200);
  if (!readFrame(frame, 0x96)) return;
  uint16_t mask = (frame[4] << 8) | frame[5];

  Serial.print("Bal bits: ");
  for (int i=0; i<7; i++) {
    if (mask & (1 << i)) {
      Serial.print("C");
      Serial.print(i + 1);
      Serial.print(" ");
    }
  }
  Serial.println();
}

// ---------- 0x97 - Protection Flags ----------
void query_0x97() {
  sendCommand(0x97);
  delay(200);
  if (!readFrame(frame, 0x97)) return;
  uint16_t prot = (frame[4] << 8) | frame[5];
  protFlags = prot;   // store for logging

  Serial.print("Prot: ");
  if (prot == 0) {
    Serial.println("None");
  } else {
    if (prot & (1 << 0)) Serial.print("CellOV ");
    if (prot & (1 << 1)) Serial.print("CellUV ");
    if (prot & (1 << 2)) Serial.print("PackOV ");
    if (prot & (1 << 3)) Serial.print("PackUV ");
    if (prot & (1 << 4)) Serial.print("ChgOC ");
    if (prot & (1 << 5)) Serial.print("DisOC ");
    if (prot & (1 << 6)) Serial.print("OTmp ");
    if (prot & (1 << 7)) Serial.print("UTmp ");
    Serial.println();
  }
}

// ---------- OLED DRAW (battery animation on icon, monochrome) ----------
void drawBmsDisplay() {
  u8g2.clearBuffer();
  u8g2.setFont(u8g2_font_5x8_tr);   // small compact font

  char line[32];

  // 1) Battery icon at left (x=0..15), text starts at x=20
  int bx = 0, by = 4, bw = 14, bh = 28;
  u8g2.setDrawColor(1);  // white
  u8g2.drawFrame(bx, by, bw, bh);           // outer frame
  u8g2.drawFrame(bx + 4, by - 3, 6, 3);     // battery cap

  // Base SOC fill from bottom up (white)
  int fillH = (int)((soc / 100.0f) * (bh - 2));
  if (fillH < 0) fillH = 0;
  if (fillH > bh - 2) fillH = bh - 2;

  int fillY = by + bh - 1 - fillH;
  if (fillH > 0) {
    u8g2.setDrawColor(1);  // white
    u8g2.drawBox(bx + 1, fillY, bw - 2, fillH);
  }

  // 2) Charging animation INSIDE battery (dark slashes on white)
  bool animActive = isCharging || DEBUG_ALWAYS_ANIMATE;
  if (animActive && fillH > 6) {
    int innerX0   = bx + 2;
    int innerX1   = bx + bw - 3;
    int innerBot  = by + bh - 2;

    u8g2.setDrawColor(0);  // draw in black to "cut" into white

    switch (animFrame & 3) {
      case 0:
        u8g2.drawLine(innerX0, innerBot - 2, innerX1, innerBot - 6);
        u8g2.drawLine(innerX0, innerBot - 10, innerX1, innerBot - 14);
        break;
      case 1:
        u8g2.drawLine(innerX0, innerBot - 3, innerX1, innerBot - 7);
        u8g2.drawLine(innerX0, innerBot - 11, innerX1, innerBot - 15);
        break;
      case 2:
        u8g2.drawLine(innerX0, innerBot - 4, innerX1, innerBot - 8);
        u8g2.drawLine(innerX0, innerBot - 12, innerX1, innerBot - 16);
        break;
      case 3:
        u8g2.drawLine(innerX0, innerBot - 5, innerX1, innerBot - 9);
        u8g2.drawLine(innerX0, innerBot - 13, innerX1, innerBot - 17);
        break;
    }

    u8g2.setDrawColor(1);  // back to normal
  }

  // 3) Text info using short labels
  snprintf(line, sizeof(line), "V:%.2f  SOC:%3.0f%%", packV, soc);
  u8g2.drawStr(20, 8, line);

  snprintf(line, sizeof(line), "Rem:%.2fAh Ful:%.2f", remCap_real, fullCap_real);
  u8g2.drawStr(20, 16, line);

  snprintf(line, sizeof(line), "T1:%.1fC T2:%.1fC", temp1, temp2);
  u8g2.drawStr(20, 24, line);

  snprintf(line, sizeof(line), "C1:%.3f C2:%.3f", cellVolt[0], cellVolt[1]);
  u8g2.drawStr(20, 32, line);

  snprintf(line, sizeof(line), "C3:%.3f C4:%.3f", cellVolt[2], cellVolt[3]);
  u8g2.drawStr(20, 40, line);

  snprintf(line, sizeof(line), "C5:%.3f C6:%.3f", cellVolt[4], cellVolt[5]);
  u8g2.drawStr(20, 48, line);

  snprintf(line, sizeof(line), "C7:%.3f", cellVolt[6]);
  u8g2.drawStr(20, 56, line);

  u8g2.sendBuffer();
}

// ---------- SEND BMS TO FIREBASE REALTIME DB ----------
void sendBmsToFirebase() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[FB] WiFi not connected");
    return;
  }

  WiFiSSLClient client;

  if (!client.connect(FIREBASE_HOST, 443)) {
    Serial.println("[FB] Connection failed");
    return;
  }

  // Use millis() as a simple unique key for now
  unsigned long key = millis();
  String path = String(FIREBASE_BASE_PATH) + "/" + String(key) + ".json";

  // Time stamps
  unsigned long tsUtc = getEpochUtc();
  unsigned long tsIst = getEpochIst();
  String tsIstStr = getIstTimestampString();   // human-readable IST string

  // Build JSON payload
  String json = "{";
  json += "\"pack_v\":"   + String(packV, 3);
  json += ",\"rem_ah\":"  + String(remCap_real, 3);
  json += ",\"full_ah\":" + String(fullCap_real, 3);
  json += ",\"soc\":"     + String(soc, 2);
  json += ",\"temp1_c\":" + String(temp1, 2);
  json += ",\"temp2_c\":" + String(temp2, 2);

  json += ",\"c1_v\":" + String(cellVolt[0], 3);
  json += ",\"c2_v\":" + String(cellVolt[1], 3);
  json += ",\"c3_v\":" + String(cellVolt[2], 3);
  json += ",\"c4_v\":" + String(cellVolt[3], 3);
  json += ",\"c5_v\":" + String(cellVolt[4], 3);
  json += ",\"c6_v\":" + String(cellVolt[5], 3);
  json += ",\"c7_v\":" + String(cellVolt[6], 3);

  json += ",\"charge_fet\":"    + String(lastChargeFet ? "true" : "false");
  json += ",\"discharge_fet\":" + String(lastDischargeFet ? "true" : "false");
  json += ",\"balance_fet\":"   + String(lastBalanceFet ? "true" : "false");
  json += ",\"prot_flags\":"    + String(protFlags);

  if (tsUtc != 0) {
    json += ",\"ts_utc\":" + String(tsUtc);
    json += ",\"ts_ist\":" + String(tsIst);
    json += ",\"ts_ist_str\":\"" + tsIstStr + "\"";
  }

  json += "}";

  // HTTP PUT to: https://<host><path>
  client.print(String("PUT ") + path + " HTTP/1.1\r\n");
  client.print(String("Host: ") + FIREBASE_HOST + "\r\n");
  client.print("Content-Type: application/json\r\n");
  client.print("Connection: close\r\n");
  client.print(String("Content-Length: ") + json.length() + "\r\n\r\n");
  client.print(json);

  // Optional: read and discard response
  unsigned long start = millis();
  while (client.connected() && millis() - start < 2000) {
    while (client.available()) {
      char c = client.read();
      // Serial.write(c); // uncomment to debug
    }
  }
  client.stop();

  Serial.print("[FB] BMS sample pushed to Realtime DB at IST: ");
  Serial.println(tsIstStr);
}

// ---------- BMS Task (runs every 10s, Serial + OLED + Firebase) ----------
void bmsTask() {
  if (millis() - lastBmsTime < BMS_INTERVAL) return;
  lastBmsTime = millis();

  // Core data (OLED + Serial)
  query_0x90();
  query_0x95_all();
  query_0x92();
  query_0x93();

  // Extra diagnostic (Serial only)
  query_0x91();
  query_0x96();
  query_0x97();

  // Draw display once with latest values
  drawBmsDisplay();

  // Send full BMS snapshot to Firebase Realtime DB
  sendBmsToFirebase();

  Serial.println("---------------------------------------");
}

// ================= HTTP SERVER HELPERS =================
void sendHttpOkHtml(WiFiClient &client, const char* html) {
  client.println("HTTP/1.1 200 OK");
  client.println("Content-Type: text/html");
  client.println("Connection: close");
  client.println();
  client.print(html);
}

void sendHttpOkText(WiFiClient &client, const String &text) {
  client.println("HTTP/1.1 200 OK");
  client.println("Content-Type: text/plain");
  client.println("Connection: close");
  client.println();
  client.print(text);
}

void sendHttpOkJson(WiFiClient &client, const String &json) {
  client.println("HTTP/1.1 200 OK");
  client.println("Content-Type: application/json");
  client.println("Connection: close");
  client.println();
  client.print(json);
}

// ================= HTTP SERVER MAIN =================
void handleClient() {
  WiFiClient client = server.available();
  if (!client) return;

  unsigned long start = millis();
  while (!client.available() && millis() - start < 1000) {
    delay(1);
  }
  if (!client.available()) {
    client.stop();
    return;
  }

  String reqLine = client.readStringUntil('\r');
  client.readStringUntil('\n');  // consume LF

  // read headers (ignored)
  while (client.available()) {
    String header = client.readStringUntil('\n');
    if (header == "\r" || header.length() <= 1) break;
  }

  int firstSpace = reqLine.indexOf(' ');
  int secondSpace = reqLine.indexOf(' ', firstSpace + 1);
  if (firstSpace == -1 || secondSpace == -1) {
    client.stop();
    return;
  }

  String path = reqLine.substring(firstSpace + 1, secondSpace);

  if (path == "/") {
    sendHttpOkHtml(client, index_html);
  }
  else if (path.startsWith("/remote")) {
    if (path.indexOf("toggle=1") != -1) {
      isRemoteMode = !isRemoteMode;
    }
    sendHttpOkText(client, "OK");
  }
  else if (path.startsWith("/set")) {
    int idx = path.indexOf("dac=");
    if (idx != -1) {
      String valStr = path.substring(idx + 4);
      int amp = valStr.indexOf('&');
      if (amp != -1) valStr = valStr.substring(0, amp);
      int v = valStr.toInt();
      remoteDAC = constrain(v, 0, MAX_DAC);
    }
    sendHttpOkText(client, "OK");
  }
  else if (path.startsWith("/status")) {
    String json = "{";
    json += "\"remote\":" + String(isRemoteMode ? "true" : "false");
    json += ",\"remoteDAC\":" + String(remoteDAC);
    json += ",\"currentDAC\":" + String(currentDAC);
    json += "}";
    sendHttpOkJson(client, json);
  }
  else {
    sendHttpOkText(client, "Not found");
  }

  client.stop();
}

// ================= THROTTLE / DAC FUNCS =================
void readThrottle() {
  if (isRemoteMode) {
    // In remote mode we don't read throttle
    return;
  }

  throttleValue = analogRead(THROTTLE_PIN);  // 0..4095

  if (throttleValue >= THROTTLE_START) {
    targetDAC = map(throttleValue,
                    THROTTLE_START, THROTTLE_MAX,
                    MIN_DAC,       MAX_DAC);
  } else {
    targetDAC = 0;
  }

  targetDAC = constrain(targetDAC, 0, MAX_DAC);
}

void updateRamp() {
  if (millis() - lastRampTime > RAMP_INTERVAL) {
    int step = (targetDAC == 0) ? BRAKE_STEP : RAMP_STEP;

    if (currentDAC < targetDAC) {
      currentDAC = (currentDAC + step > targetDAC) ? targetDAC : currentDAC + step;
    } 
    else if (currentDAC > targetDAC) {
      currentDAC = (currentDAC - step < targetDAC) ? targetDAC : currentDAC - step;
    }

    lastRampTime = millis();
  }
}

void applyDAC() {
  analogWrite(DAC_PIN, currentDAC);  // 0..4095 → 0..5V on A0
}

// ================= SETUP =================
void setup() {
  Serial.begin(115200);
  delay(500);

  analogReadResolution(12);
  analogWriteResolution(12);

  pinMode(THROTTLE_PIN, INPUT);
  pinMode(DAC_PIN, OUTPUT);
  analogWrite(DAC_PIN, 0);

  Serial.println("UNO R4 – DAC + WiFi + E-Scooter BMS + SSD1309 + Firebase Logger");

  // WiFi STA connect
  WiFi.disconnect();
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);

  unsigned long startTime = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startTime < 15000) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("WiFi connected (STA)");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());

    // Initial NTP sync
    syncTimeFromNTP();
  } else {
    Serial.println("WiFi connect failed (check SSID/password / 2.4GHz)");
  }

  server.begin();
  Serial.println("HTTP server started on port 80");

  // E-Scooter BMS UART init
  BmsSerial.begin(9600);
  delay(1000);
  Serial.println("E-Scooter BMS UART ready (15Ah rated pack)");

  // Waveshare SSD1309 init via U8g2 (monochrome)
  u8g2.begin();
  u8g2.clearBuffer();
  u8g2.setFont(u8g2_font_6x10_tr);
  u8g2.drawStr(10, 20, "E-Scooter BMS");
  u8g2.drawStr(0, 40, "UNO R4 + SSD1309 OK");
  u8g2.sendBuffer();
  delay(1500);
}

// ================= LOOP =================
void loop() {
  handleClient();   // WiFi HTTP

  // Periodic NTP re-sync
  if (WiFi.status() == WL_CONNECTED &&
      (millis() - lastNtpSync > NTP_INTERVAL_MS || !timeSynced)) {
    syncTimeFromNTP();
  }

  // DAC control: remote overrides throttle
  if (isRemoteMode) {
    targetDAC = remoteDAC;
  } else {
    readThrottle();
  }

  updateRamp();
  applyDAC();

  // BMS data update (slow, every 10s)
  bmsTask();

  // Charging animation refresh (fast, every ~300 ms)
  if ((isCharging || DEBUG_ALWAYS_ANIMATE) && (millis() - lastAnimTime > ANIM_INTERVAL)) {
    lastAnimTime = millis();
    animFrame = (animFrame + 1) & 0x03;  // 0..3
    drawBmsDisplay();
  }
}
